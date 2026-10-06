import { workflowAccount } from './asset-workflow-api.js';
import { AssetWorkflowError } from './asset-scan.js';
import { InventoryError } from './inventory-core.js';

export async function inventoryApi(write, handler) {
  try {
    const account = await workflowAccount();
    if (write && !account.canWrite) throw new InventoryError('บัญชีนี้ดูข้อมูลได้อย่างเดียว', 403);
    return Response.json({ success: true, ...await handler(account) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof InventoryError || error instanceof AssetWorkflowError) {
      return Response.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ success: false, error: 'JSON ไม่ถูกต้อง' }, { status: 400 });
    }
    if (error.code === '23505') {
      return Response.json({ success: false, error: 'มีรายการนี้อยู่แล้ว กรุณาโหลดข้อมูลล่าสุด' }, { status: 409 });
    }
    console.error('Inventory request failed:', error);
    return Response.json({ success: false, error: ['42P01', '42703'].includes(error.code)
      ? 'ระบบส่วนนี้ยังไม่พร้อม กรุณาอัปเดตฐานข้อมูลเวอร์ชันล่าสุด'
      : 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่' }, { status: 503 });
  }
}
