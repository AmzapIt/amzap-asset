import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { AccessoryError,accessoryId,accessoryQuantity,accessoryText,accessoryDate,receiveAccessories,issueAccessories,changeAccessoryHolding } from "../lib/accessory-inventory.js";
import { accessoryMovementFilters,getAccessoryMovements } from "../lib/accessory-read.js";

test("accessory quantities and IDs reject coercion, decimals, unsafe and out-of-range values",()=>{
  for (const bad of [0,-1,1.1,100001,"1e2","01","",null,{},[1],true]) assert.throws(()=>accessoryQuantity(bad),AccessoryError);
  assert.equal(accessoryQuantity("100000"),100000);
  for (const bad of [0,-1,1.1,Number.MAX_SAFE_INTEGER+1,"9223372036854775808","1;DROP TABLE",[],[1],{}]) assert.throws(()=>accessoryId(bad),AccessoryError);
  assert.equal(accessoryId("9223372036854775807"),"9223372036854775807");
});

test("dates reject invalid calendars and future events; text requires an explicit disposal reason",()=>{
  assert.equal(accessoryDate("2024-02-29"),"2024-02-29");
  assert.match(accessoryDate(),/^\d{4}-\d{2}-\d{2}$/);
  for (const bad of ["2025-02-29","2024-13-01","9999-01-01","0000-01-01","01/01/2024",123]) assert.throws(()=>accessoryDate(bad),AccessoryError);
  assert.throws(()=>accessoryText("  ","เหตุผล",500,true),AccessoryError);
  assert.throws(()=>accessoryText("a".repeat(501),"เหตุผล",500,true),AccessoryError);
  assert.equal(accessoryText("  เสีย  ","เหตุผล",500,true),"เสีย");
});

function fakePool(handler) {
  const calls=[];
  const client={async query(sql,params=[]){const normalized=sql.replace(/\s+/g," ").trim();calls.push(normalized);return await handler(normalized,params);},release(){calls.push("RELEASE");}};
  return {calls,async connect(){return client;}};
}
test("duplicate receipt retries return the stored response without touching balances",async()=>{
  const body={request_id:randomUUID(),stock_item_id:"1",quantity:2,reason:"รับเข้า"};
  let fingerprint;
  const pool=fakePool((sql,params)=>{
    if(sql.startsWith("SELECT fingerprint")) return {rows:fingerprint?[{fingerprint,response:{stock_item_id:"1",available_quantity:2}}]:[]};
    if(sql.startsWith("SELECT id::text,accessory_type_id")) return {rows:[{id:"1",accessory_type_id:"1",available_quantity:0,version:0,serial_number:null}]};
    if(sql.startsWith("SELECT id FROM public.accessory_types")) return {rows:[{id:"1"}]};
    if(sql.startsWith("UPDATE public.accessory_stock_items")) return {rows:[{available_quantity:2,version:1}]};
    if(sql.startsWith("INSERT INTO public.accessory_operations")) fingerprint=params[2];
    return {rows:[]};
  });
  assert.deepEqual(await receiveAccessories(body,"1",pool),{stock_item_id:"1",available_quantity:2});
  const updateCount=pool.calls.filter(s=>s.startsWith("UPDATE")).length;
  await receiveAccessories(body,"1",pool);
  assert.equal(pool.calls.filter(s=>s.startsWith("UPDATE")).length,updateCount);
  await assert.rejects(receiveAccessories({...body,quantity:3},"1",pool),error=>error.status===409);
  assert.equal(pool.calls.at(-2),"ROLLBACK");
});
test("insufficient warehouse stock rolls back before creating an employee issue or audit event",async()=>{
  const pool=fakePool(sql=>{
    if(sql.startsWith("SELECT id FROM")) return {rows:[{id:"1"}]};
    if(sql.startsWith("SELECT id::text,accessory_type_id")) return {rows:[{id:"1",accessory_type_id:"1",available_quantity:1,version:0}]};
    return {rows:[]};
  });
  await assert.rejects(issueAccessories("1",{request_id:randomUUID(),stock_item_id:"1",quantity:2},"1",pool),error=>error.status===409);
  assert.equal(pool.calls.some(s=>s.startsWith("INSERT") || s.startsWith("UPDATE")),false);
  assert.equal(pool.calls.at(-2),"ROLLBACK");
});
test("a stale holding version cannot return or transfer the same quantity again",async()=>{
  const pool=fakePool(sql=>{
    if(sql.startsWith("SELECT *,id::text")) return {rows:[{id:"1",user_id:"1",stock_item_id:"1",quantity:3,returned_quantity:1,transferred_quantity:0,disposed_quantity:0,version:2}]};
    return {rows:[]};
  });
  await assert.rejects(changeAccessoryHolding("1","1","return",{request_id:randomUUID(),expected_version:1,quantity:1},"1",pool),error=>error.status===409);
  assert.equal(pool.calls.some(s=>s.startsWith("INSERT") || s.startsWith("UPDATE")),false);
});

test("history API filters retain stock, employee and cursor when loading the next page",async()=>{
  const pool={async query(sql,params){
    assert.deepEqual(params,["500","2","3"]);
    return {rows:Array.from({length:101},(_,i)=>({id:String(499-i)}))};
  }};
  const result=await getAccessoryMovements(accessoryMovementFilters("http://localhost/api/accessories/movements?stock_id=2&user_id=3&before=500"),pool);
  assert.equal(result.movements.length,100);assert.equal(result.hasMore,true);assert.equal(result.movements.at(-1).id,"400");
});
