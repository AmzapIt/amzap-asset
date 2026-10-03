import { auth } from '@/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AssetWorkflowError } from './asset-scan.js';

export async function workflowAccount() {
  const session = await auth();
  if (!session?.user?.id) throw new AssetWorkflowError('กรุณาเข้าสู่ระบบ', 401);
  const account = (await query(
    'SELECT id::text,role,is_active,must_change_password FROM public.app_accounts WHERE id=$1',
    [session.user.id],
  )).rows[0];
  if (!account?.is_active) throw new AssetWorkflowError('บัญชีไม่สามารถเข้าใช้งานได้', 403);
  if (account.must_change_password) throw new AssetWorkflowError('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', 403);
  return { ...account, canWrite: ['Admin', 'IT Staff'].includes(account.role) };
}

export async function workflowPageAccount() {
  try { return await workflowAccount(); }
  catch (error) {
    if (error instanceof AssetWorkflowError) redirect(error.message.includes('เปลี่ยนรหัสผ่าน') ? '/account/password' : '/login');
    throw error;
  }
}

export async function assetWorkflowApi(write, handler) {
  try {
    const account = await workflowAccount();
    if (write && !account.canWrite) throw new AssetWorkflowError('บัญชีนี้ดูข้อมูลได้อย่างเดียว', 403);
    return Response.json({ success: true, ...await handler(account) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AssetWorkflowError) return Response.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ success: false, error: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 });
    console.error('Asset workflow request failed:', error);
    return Response.json({ success: false, error: ['42P01','42703'].includes(error.code)
      ? 'ระบบส่วนนี้ยังไม่พร้อม กรุณาให้ IT อัปเดตฐานข้อมูลเวอร์ชันล่าสุด'
      : 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่' }, { status: 503 });
  }
}
