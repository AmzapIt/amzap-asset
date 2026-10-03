import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { normalizeAssetCode, workflowId, lookupAsset } from '../lib/asset-scan.js';
import { parseCountSession, parseCountCheck, effectiveCountResult } from '../lib/asset-counts.js';
import { assetChanges, parseAssetDisposalReason, recordAssetEdit } from '../lib/asset-history.js';
import { countCsv } from '../app/asset-counts/count-ui.js';

test('scanner accepts existing codes but refuses URLs, scripts, whitespace and oversized input', () => {
  assert.equal(normalizeAssetCode(' F1-MON-001 '),'F1-MON-001');
  assert.equal(normalizeAssetCode('F1-NB-41'),'F1-NB-41');
  for (const value of ['https://evil.example/asset','javascript:alert(1)','<script>','A\nB','x'.repeat(101),'',null]) {
    assert.throws(() => normalizeAssetCode(value));
  }
  assert.throws(() => workflowId('9223372036854775808'));
});

test('QR decoder reads the same literal asset code produced by existing label generator', () => {
  for (const code of ['F1-MON-001','F1-NB-41']) {
    const qr=QRCode.create(code,{errorCorrectionLevel:'M'});
    const scale=6,margin=4,width=(qr.modules.size+margin*2)*scale;
    const pixels=new Uint8ClampedArray(width*width*4).fill(255);
    for (let y=0;y<width;y++) for (let x=0;x<width;x++) {
      const mx=Math.floor(x/scale)-margin,my=Math.floor(y/scale)-margin;
      if (mx>=0 && my>=0 && mx<qr.modules.size && my<qr.modules.size && qr.modules.get(my,mx)) {
        const index=(y*width+x)*4; pixels[index]=0;pixels[index+1]=0;pixels[index+2]=0;
      }
    }
    assert.equal(jsQR(pixels,width,width)?.data,code);
  }
});

test('lookup uses parameters and rejects ambiguous codes instead of choosing an asset', async () => {
  let values;
  await assert.rejects(lookupAsset("F1-'",{query:async (_sql,args) => {values=args;return {rows:[]};}}),{status:404});
  assert.deepEqual(values,["F1-'"]);
  await assert.rejects(lookupAsset('ABC',{query:async () => ({rows:[{id:'1'},{id:'2'}]})}),{status:409});
});

test('count round validates scope and checks reject invalid versions or unexplained mismatches', () => {
  assert.equal(parseCountSession({requestId:randomUUID(),name:' October ',locationId:'',assetTypeId:''}).name,'October');
  assert.throws(() => parseCountSession({requestId:randomUUID(),name:' ',locationId:''}));
  assert.throws(() => parseCountSession({requestId:randomUUID(),name:'Round',locationId:1}));
  assert.throws(() => parseCountCheck({requestId:randomUUID(),result:'found',expectedVersion:'0'}));
  assert.throws(() => parseCountCheck({requestId:randomUUID(),result:'mismatch',expectedVersion:0,notes:' '}));
  const missing=parseCountCheck({requestId:randomUUID(),result:'missing',expectedVersion:0,observedHolderId:'garbage',observedLocationId:'garbage'});
  assert.equal(missing.observedHolderId,null);
  assert.equal(missing.observedLocationId,null);
});

test('different observed holder/location forces discrepancy even if browser sends found', () => {
  const item={expected_location_id:'1',expected_holder_id:'2'};
  assert.equal(effectiveCountResult(item,{result:'found',observedLocationId:'1',observedHolderId:'2'}),'found');
  assert.equal(effectiveCountResult(item,{result:'found',observedLocationId:'3',observedHolderId:'2'}),'mismatch');
  assert.equal(effectiveCountResult(item,{result:'found',observedLocationId:'1',observedHolderId:null}),'mismatch');
  assert.equal(effectiveCountResult(item,{result:'missing'}),'missing');
});

test('history detects disposal and ignores timestamp-only saves and numeric representation', () => {
  const before={status:'In Stock',purchase_price:'1200',purchase_date:new Date('2026-10-01T00:00:00Z')};
  const after={...before,status:'Disposed',purchase_price:1200,purchase_date:'2026-10-01',updated_at:'now'};
  assert.deepEqual(assetChanges(before,after),[{field:'สถานะ',before:'In Stock',after:'Disposed'}]);
});

test('disposing an asset requires a reason and stores it with the audit event', async () => {
  assert.throws(() => parseAssetDisposalReason('Disposed','In Stock','  '),/เหตุผลการจำหน่าย/);
  assert.throws(() => parseAssetDisposalReason('Disposed','In Stock','x'.repeat(1001)),/เหตุผลการจำหน่าย/);
  assert.equal(parseAssetDisposalReason('Disposed','Disposed',''),null);
  const reason=parseAssetDisposalReason('Disposed','In Stock','อุปกรณ์ชำรุด');
  assert.equal(reason,'อุปกรณ์ชำรุด');
  let values;
  await recordAssetEdit({query:async (_sql,params) => {values=params;}},'7','9',
    {status:'In Stock'},{status:'Disposed'},reason);
  assert.equal(JSON.parse(values[2]).event_reason,reason);
  assert.equal(values[3],'9');
});

test('count CSV quotes multiline notes and prevents spreadsheet formula execution', () => {
  const csv=countCsv([{asset_code:'=CMD()',asset_name:'A"B',notes:'line1\nline2',result:'pending'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=CMD()"'));
  assert.ok(csv.includes('"A""B"'));
  assert.ok(csv.includes('"line1\nline2"'));
});
