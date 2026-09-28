// Opt-in PostgreSQL integration check. All fixture/migration changes are inside
// one outer transaction that ALWAYS rolls back. No credentials are logged.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getDbPool } from "../lib/db.js";
import { receiveAccessories,issueAccessories,changeAccessoryHolding,disposeStock,editStockItem } from "../lib/accessory-inventory.js";
import { getAccessoryInventory,getEmployeeAccessories,getAccessoryMovements } from "../lib/accessory-read.js";
import { getCurrentAccessories } from "../lib/asset-report.js";
import { getAccessorySummary } from "../lib/accessory-summary.js";

if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
const pool=getDbPool();
const client=await pool.connect();
let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const rejects=async fn=>{await assert.rejects(fn);checks++;};
const body=data=>({request_id:randomUUID(),...data});
const original=(await client.query("SELECT to_jsonb(ea) AS row FROM public.employee_accessories ea ORDER BY id")).rows;
// Library transactions become savepoints within this private outer transaction.
let readQueue=Promise.resolve();
const scoped={query:(sql,params)=>{const result=readQueue.then(()=>client.query(sql,params));readQueue=result.catch(()=>{});return result;},async connect(){return {
  async query(sql,params){
    if(sql==="BEGIN") return client.query("SAVEPOINT accessory_operation");
    if(sql==="COMMIT") {
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      await client.query("SET CONSTRAINTS ALL DEFERRED");
      return client.query("RELEASE SAVEPOINT accessory_operation");
    }
    if(sql==="ROLLBACK") {await client.query("ROLLBACK TO SAVEPOINT accessory_operation");return client.query("RELEASE SAVEPOINT accessory_operation");}
    return client.query(sql,params);
  },release(){},
};}};
try {
  await client.query("BEGIN");
  if(process.argv.includes("--with-migration")) {
    const sql=(await readFile(new URL("../migrations/019-accessory-stock.sql",import.meta.url),"utf8")).replace(/^BEGIN;\s*$/m,"").replace(/^COMMIT;\s*$/m,"");
    await client.query(sql);await client.query("DROP TABLE accessory_legacy_opening");
    const opening=(await client.query("SELECT count(*)::int AS n FROM public.accessory_stock_movements WHERE action='opening'")).rows[0].n;
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query(sql);await client.query("DROP TABLE accessory_legacy_opening");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    check((await client.query("SELECT count(*)::int AS n FROM public.accessory_stock_movements WHERE action='opening'")).rows[0].n,opening);
  }
  const actor=(await client.query("SELECT id::text FROM public.app_accounts WHERE is_active=true AND role='Admin' ORDER BY id LIMIT 1")).rows[0]?.id;
  assert.ok(actor,"An active Admin is required as the audit actor");
  const baseline=await getAccessorySummary(scoped);
  const suffix=randomUUID();
  const type=(await client.query("INSERT INTO public.accessory_types(name) VALUES($1) RETURNING id::text",[`QA stock ${suffix}`])).rows[0].id;
  const user=async name=>(await client.query('INSERT INTO public."user"(full_name) VALUES($1) RETURNING id::text',[`QA ${name} ${suffix}`])).rows[0].id;
  const from=await user("from"),to=await user("to");
  const receive=body({accessory_type_id:type,brand:"QA",model:"Bulk",quantity:10,reason:"Integration test"});
  const received=await receiveAccessories(receive,actor,scoped);const stockId=received.stock_item_id;
  await receiveAccessories(receive,actor,scoped);
  const stock=async id=>(await client.query("SELECT * FROM public.accessory_stock_items WHERE id=$1",[id || stockId])).rows[0];
  const holding=async id=>(await getEmployeeAccessories(id,scoped)).accessories;
  check((await stock()).available_quantity,10);
  const issue=await issueAccessories(from,body({stock_item_id:stockId,quantity:4,issued_date:"2024-01-01"}),actor,scoped);
  check((await stock()).available_quantity,6);
  await rejects(()=>issueAccessories(from,body({stock_item_id:stockId,quantity:7}),actor,scoped));
  check((await stock()).available_quantity,6);
  let row=(await holding(from))[0];
  const returnBody=body({expected_version:row.version,quantity:1,event_date:"2024-01-02"});
  await changeAccessoryHolding(from,issue.id,"return",returnBody,actor,scoped);
  await changeAccessoryHolding(from,issue.id,"return",returnBody,actor,scoped);
  check((await stock()).available_quantity,7);check((await holding(from))[0].remaining_quantity,3);
  check((await getCurrentAccessories(from,scoped))[0].quantity,3);
  check((await getAccessorySummary(scoped)).currentQuantity,baseline.currentQuantity+3);
  await rejects(()=>changeAccessoryHolding(from,issue.id,"return",body({expected_version:0,quantity:1}),actor,scoped));
  await rejects(()=>changeAccessoryHolding(to,issue.id,"return",body({expected_version:1,quantity:1}),actor,scoped));
  row=(await holding(from))[0];
  const moved=await changeAccessoryHolding(from,issue.id,"transfer",body({expected_version:row.version,quantity:2,to_user_id:to,event_date:"2024-01-03",reason:"Move holder"}),actor,scoped);
  check((await stock()).available_quantity,7);check((await holding(from))[0].remaining_quantity,1);check((await holding(to))[0].remaining_quantity,2);
  row=(await holding(from))[0];
  await rejects(()=>changeAccessoryHolding(from,issue.id,"dispose",body({expected_version:row.version,quantity:1,reason:""}),actor,scoped));
  await changeAccessoryHolding(from,issue.id,"dispose",body({expected_version:row.version,quantity:1,event_date:"2024-01-04",reason:"Damaged"}),actor,scoped);
  check((await holding(from))[0].remaining_quantity,0);check((await holding(from))[0].close_reason,"dispose");check((await stock()).available_quantity,7);
  row=await stock();
  const disposal=body({expected_version:row.version,quantity:2,reason:"Damaged warehouse stock"});
  await disposeStock(stockId,disposal,actor,scoped);await disposeStock(stockId,disposal,actor,scoped);
  check((await stock()).available_quantity,5);
  row=(await holding(to))[0];
  await changeAccessoryHolding(to,moved.related_id,"edit",body({expected_version:row.version,stock_item_id:stockId,quantity:1,issued_date:"2024-01-03",reason:"Correct quantity",notes:"Corrected"}),actor,scoped);
  check((await stock()).available_quantity,6);check((await holding(to))[0].remaining_quantity,1);
  row=await stock();
  await editStockItem(stockId,body({expected_version:row.version,accessory_type_id:type,brand:"QA",model:"Corrected bulk",reason:"Correct metadata"}),actor,scoped);
  check((await stock()).available_quantity,6);check((await holding(to))[0].model,"Corrected bulk");
  const sku=(await receiveAccessories(body({accessory_type_id:type,brand:"QA",model:"Alternative",quantity:2,reason:"Receive other SKU"}),actor,scoped)).stock_item_id;
  row=(await holding(to))[0];
  await changeAccessoryHolding(to,row.id,"edit",body({expected_version:row.version,stock_item_id:sku,quantity:1,issued_date:"2024-01-03",reason:"Correct SKU"}),actor,scoped);
  check((await stock()).available_quantity,7);check((await stock(sku)).available_quantity,1);
  row=(await holding(to))[0];
  await changeAccessoryHolding(to,row.id,"return",body({expected_version:row.version,quantity:1,event_date:"2024-01-05"}),actor,scoped);
  check((await stock(sku)).available_quantity,2);check((await holding(to))[0].remaining_quantity,0);
  const serial=(await receiveAccessories(body({accessory_type_id:type,serial_number:suffix,quantity:1,reason:"Serial item"}),actor,scoped)).stock_item_id;
  await rejects(()=>receiveAccessories(body({stock_item_id:serial,quantity:1,reason:"Duplicate serial"}),actor,scoped));
  await rejects(()=>receiveAccessories(body({stock_item_id:serial,quantity:2,reason:"Multiple serial"}),actor,scoped));
  const serialIssue=await issueAccessories(from,body({stock_item_id:serial,quantity:1}),actor,scoped);
  await rejects(()=>receiveAccessories(body({stock_item_id:serial,quantity:1,reason:"Serial already held"}),actor,scoped));
  check((await getCurrentAccessories(from,scoped)).length,1);
  check((await getCurrentAccessories(to,scoped)).length,0);
  await client.query('UPDATE public."user" SET is_active=false WHERE id=$1',[from]);
  await rejects(()=>issueAccessories(from,body({stock_item_id:stockId,quantity:1}),actor,scoped));
  row=(await holding(from)).find(r=>r.id===serialIssue.id);
  await changeAccessoryHolding(from,row.id,"return",body({expected_version:row.version,quantity:1}),actor,scoped);
  check((await stock(serial)).available_quantity,1);
  const inventory=await getAccessoryInventory(scoped);
  const relevant=inventory.stocks.filter(s=>s.accessory_type_id===type);
  for(const s of relevant) check(s.received_quantity-s.disposed_quantity,s.available_quantity+s.held_quantity);
  const history=await getAccessoryMovements({stockId},scoped);
  assert.ok(history.movements.some(m=>m.action==="transfer" && m.stock_delta===0));checks++;
  const countBefore=(await client.query("SELECT count(*)::int AS n FROM public.accessory_stock_movements")).rows[0].n;
  row=await stock();
  await rejects(()=>disposeStock(stockId,body({expected_version:row.version,quantity:100,reason:"Overdraw"}),actor,scoped));
  check((await client.query("SELECT count(*)::int AS n FROM public.accessory_stock_movements")).rows[0].n,countBefore);
  await client.query(`INSERT INTO public.accessory_stock_movements(stock_item_id,action,quantity,stock_delta,balance_after,event_date,reason)
    SELECT $1,'edit',0,0,$2,current_date,'Paging test' FROM generate_series(1,102)`,[stockId,(await stock()).available_quantity]);
  const page1=await getAccessoryMovements({stockId},scoped);
  const page2=await getAccessoryMovements({stockId,before:page1.movements.at(-1).id},scoped);
  check(page1.movements.length,100);check(page1.hasMore,true);
  assert.ok(page2.movements.length>0 && page2.movements.every(m=>BigInt(m.id)<BigInt(page1.movements.at(-1).id)));checks++;
  // Check that replaying the migration cannot treat new receipts as legacy openings.
  const sql=(await readFile(new URL("../migrations/019-accessory-stock.sql",import.meta.url),"utf8")).replace(/^BEGIN;\s*$/m,"").replace(/^COMMIT;\s*$/m,"");
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  await client.query(sql);await client.query("DROP TABLE accessory_legacy_opening");
  check((await client.query("SELECT count(*)::int AS n FROM public.accessory_stock_movements WHERE action='opening' AND stock_item_id=$1",[stockId])).rows[0].n,0);
  // Force the deferred request-to-audit FKs to validate before rolling back.
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");checks++;
  console.log(`PASS: ${checks} PostgreSQL checks; all test data will be rolled back.`);
} finally {
  await client.query("ROLLBACK");
  const restored=(await client.query("SELECT to_jsonb(ea) AS row FROM public.employee_accessories ea ORDER BY id")).rows;
  assert.deepEqual(restored,original,"Existing employee records must be unchanged");
  client.release();await pool.end();
}
