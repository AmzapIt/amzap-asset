import Link from 'next/link';
import { redirect } from 'next/navigation';
import { workflowPageAccount } from '@/lib/asset-workflow-api';
import { getItFollowUp, REPAIR_FOLLOW_UP_DAYS } from '@/lib/it-follow-up';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function date(value) {
  if (!value) return 'ไม่ระบุ';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function assetLink(assetId, label = 'เปิด Asset') {
  return <Link className="font-semibold text-blue-700 hover:underline" href={`/assets/${assetId}`}>{label}</Link>;
}

function FollowUpSection({ id, title, description, count, children }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{count} รายการ</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children = 'ไม่มีรายการค้าง' }) {
  return <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{children}</p>;
}

export default async function ItFollowUpPage() {
  const account = await workflowPageAccount();
  if (!account.canWrite) redirect('/');
  const data = await getItFollowUp();
  const total = data.offboarding.length + data.waiting_repair.length +
    data.long_repairs.length + data.unprocessed_returns.length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">IT Operations</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">งานที่ IT ต้องติดตาม</h1>
          <p className="mt-2 text-blue-100">รายการค้างพร้อมทางลัดไปทำต่อ · งานซ่อมนานหมายถึงเกิน {REPAIR_FOLLOW_UP_DAYS} วัน</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ['รายการค้างทั้งหมด', total, '#offboarding'],
              ['ลาออก · คืนของไม่ครบ', data.offboarding.length, '#offboarding'],
              ['เครื่องรอจัดการซ่อม', data.waiting_repair.length, '#waiting-repair'],
              [`ซ่อมเกิน ${REPAIR_FOLLOW_UP_DAYS} วัน`, data.long_repairs.length, '#long-repairs'],
              ['รับคืนยังไม่เปิดงานซ่อม', data.unprocessed_returns.length, '#unprocessed-returns'],
            ].map(([label, count, href]) => (
              <a key={label} href={href} className="rounded-xl bg-white/10 p-3 transition hover:bg-white/20">
                <p className="text-sm text-blue-100">{label}</p>
                <p className="mt-1 text-2xl font-bold">{Number(count).toLocaleString('th-TH')}</p>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-blue-100">รายการรับคืนรอเปิดงานซ่อมแสดงแยก ไม่ซ้ำกับคิวเครื่องรอเริ่มซ่อม</p>
        </header>

        <FollowUpSection id="offboarding" title="พนักงานลาออก · คืนของไม่ครบ"
          description="เคสลาออกที่ยังมี Asset หรือ Accessories รอรับคืน" count={data.offboarding.length}>
          {!data.offboarding.length ? <Empty /> : <div className="mt-4 divide-y divide-slate-100">
            {data.offboarding.map((item) => (
              <article key={item.offboarding_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.full_name}{item.nickname ? ` (${item.nickname})` : ''}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.employee_code || 'ไม่มีรหัสพนักงาน'} · ค้าง {item.pending_items} รายการ / {item.pending_quantity} ชิ้น
                    {Number(item.review_items) > 0 ? ` · ตรวจสอบผู้ถือจริง ${item.review_items} รายการ` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">เริ่มติดตาม {date(item.started_at)}</p>
                </div>
                <Link href={`/users/${item.user_id}#offboarding`} className="min-h-11 rounded-lg bg-blue-50 px-4 py-2.5 text-center text-sm font-semibold text-blue-800 hover:bg-blue-100">
                  เปิดรายการคืนของ
                </Link>
              </article>
            ))}
          </div>}
        </FollowUpSection>

        <FollowUpSection id="waiting-repair" title="เครื่องสถานะ Repair · รอเริ่มซ่อม"
          description="Asset สถานะ Repair ที่ยังไม่มีงานซ่อม Open / In Progress และไม่ใช่รายการรับคืนรอเปิดงาน" count={data.waiting_repair.length}>
          {!data.waiting_repair.length ? <Empty /> : <div className="mt-4 divide-y divide-slate-100">
            {data.waiting_repair.map((item) => (
              <article key={item.asset_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.asset_code} · {item.asset_name || 'ไม่ระบุชื่อ'}</p>
                  <p className="mt-1 text-sm text-slate-600">สถานที่: {item.location_name || 'ไม่ระบุ'} · รอติดตามตั้งแต่ {date(item.waiting_since)}</p>
                </div>
                <div className="flex flex-wrap gap-4">{assetLink(item.asset_id)}{assetLink(`${item.asset_id}/edit`, 'บันทึกงานซ่อม')}</div>
              </article>
            ))}
          </div>}
        </FollowUpSection>

        <FollowUpSection id="long-repairs" title={`เครื่องซ่อมเกิน ${REPAIR_FOLLOW_UP_DAYS} วัน`}
          description="งานซ่อม Open / In Progress ที่ยังเป็นสถานะ Repair" count={data.long_repairs.length}>
          {!data.long_repairs.length ? <Empty /> : <div className="mt-4 divide-y divide-slate-100">
            {data.long_repairs.map((item) => (
              <article key={item.maintenance_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.asset_code} · {item.asset_name || 'ไม่ระบุชื่อ'}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.maintenance_type || 'งานซ่อม'} · {item.status} · แจ้ง {date(item.reported_date)} · ผ่านมา {item.age_days} วัน</p>
                  {item.description && <p className="mt-1 text-sm text-slate-500">{item.description}</p>}
                </div>
                <div className="flex flex-wrap gap-4">{assetLink(item.asset_id)}{assetLink(`${item.asset_id}/edit`, 'อัปเดตงานซ่อม')}</div>
              </article>
            ))}
          </div>}
        </FollowUpSection>

        <FollowUpSection id="unprocessed-returns" title="รับคืนสภาพต้องซ่อม · ยังไม่เปิดงานซ่อม"
          description="รับคืนเข้าคลังเป็นสภาพต้องซ่อม แต่ยังไม่มีบันทึก Maintenance หลังรับคืน" count={data.unprocessed_returns.length}>
          {!data.unprocessed_returns.length ? <Empty /> : <div className="mt-4 divide-y divide-slate-100">
            {data.unprocessed_returns.map((item) => (
              <article key={item.receipt_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{item.asset_code} · {item.asset_name || 'ไม่ระบุชื่อ'}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    รับคืน {date(item.receipt_date)} · จาก {item.returned_by_name || 'ไม่ระบุ'}
                    {item.returned_by_nickname ? ` (${item.returned_by_nickname})` : ''}
                    {' '}· IT ผู้รับ {item.received_by_name || 'ไม่ระบุ'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">เหตุผล: {item.reason}</p>
                </div>
                <div className="flex flex-wrap gap-4">{assetLink(item.asset_id)}{assetLink(`${item.asset_id}/edit`, 'เปิดงานซ่อม')}</div>
              </article>
            ))}
          </div>}
        </FollowUpSection>
      </div>
    </main>
  );
}
