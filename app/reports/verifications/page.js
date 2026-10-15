import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getVerificationRound, listVerificationRounds } from '@/lib/asset-verifications';
import ReportsShell, { ReportLoadError } from '../ReportsShell';
import VerificationManager from './VerificationManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function VerificationReportsPage({ searchParams }) {
  const account = await workflowPageAccount();
  const params = await searchParams;
  let rounds;
  let data = null;
  try {
    rounds = await listVerificationRounds();
    const requested = typeof params.round === 'string' ? params.round : '';
    const selected = rounds.find((round) => round.id === requested) || rounds[0];
    if (selected) data = await getVerificationRound(selected.id);
  } catch (error) {
    if (error.code === '42P01') {
      return <ReportsShell view="verifications" title="ตรวจยืนยันทรัพย์สินประจำรอบ"
        description="ตรวจพนักงานทุกคน พิมพ์ใบให้เซ็น และติดตามใบที่รับคืน">
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          ยังไม่ได้เตรียมฐานข้อมูลสำหรับใบตรวจ กรุณาให้ IT รัน migrations/029-asset-verifications.sql ก่อนใช้งาน
        </p>
      </ReportsShell>;
    }
    console.error('Verification reports load failed', error);
    return <ReportLoadError retryHref="/reports/verifications" />;
  }
  const currentYear = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric',
  }).format(new Date()));
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return (
    <ReportsShell view="verifications" title="ตรวจยืนยันทรัพย์สินประจำรอบ"
      description="ตรวจพนักงานทุกคน พิมพ์ใบให้เซ็น และติดตามใบที่รับคืน โดยไม่เปลี่ยน Assignment หรือยอดคลัง">
      <VerificationManager rounds={rounds} data={data} canWrite={account.canWrite}
        currentYear={currentYear} today={today} />
    </ReportsShell>
  );
}
