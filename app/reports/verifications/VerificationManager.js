'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { isAmzapVerificationUser } from '@/lib/verification-eligibility';

const inputClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const buttonClass = 'rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';
const normalize = (value) => String(value || '').toLocaleLowerCase().trim();

async function send(url, method, body) {
  const response = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'ไม่สามารถดำเนินการได้');
  return result;
}

export default function VerificationManager({ rounds, data, canWrite, currentYear, today }) {
  const router = useRouter();
  const [year, setYear] = useState(currentYear);
  const [roundNo, setRoundNo] = useState(1);
  const [title, setTitle] = useState(`ตรวจทรัพย์สินรอบ 1/${currentYear}`);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState({});
  const [notes, setNotes] = useState({});
  const [dates, setDates] = useState({});
  const records = useMemo(() => data?.records || [], [data]);
  const activeRecords = useMemo(() => new Map(records.filter((record) => record.status !== 'cancelled')
    .map((record) => [record.user_id, record])), [records]);
  const assetUsers = useMemo(() => (data?.users || []).filter((user) =>
    isAmzapVerificationUser(user) && user.counts.assets > 0), [data]);
  const users = useMemo(() => (data?.users || []).filter((user) => {
    const record = activeRecords.get(user.id);
    if (user.counts.assets < 1 && !record) return false;
    const matchesStatus = !statusFilter ||
      (statusFilter === 'unissued' && !record) ||
      (statusFilter === 'issued' && record?.status === 'issued') ||
      (statusFilter === 'signed' && record?.status === 'signed');
    return matchesStatus && [user.full_name, user.nickname, user.employee_code, user.department]
      .some((value) => normalize(value).includes(normalize(search)));
  }), [data, search, statusFilter, activeRecords]);
  const activeCount = assetUsers.length;
  const unissuedAssetCount = data?.users.filter((user) => isAmzapVerificationUser(user) &&
    user.counts.assets > 0 && !activeRecords.has(user.id)).length || 0;
  const signedCount = assetUsers.filter((user) =>
    activeRecords.get(user.id)?.status === 'signed').length || 0;

  async function run(key, action) {
    setBusy(key);
    setError('');
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught.message || 'ไม่สามารถดำเนินการได้');
    } finally { setBusy(''); }
  }

  async function createRound(event) {
    event.preventDefault();
    await run('create', async () => {
      const response = await send('/api/asset-verifications', 'POST', { year, roundNo, title });
      router.push(`/reports/verifications?round=${response.round.id}`);
    });
  }

  async function issue(user) {
    if (!window.confirm(`ออกใบตรวจให้ ${user.display_name} จากรายการที่แสดงตอนนี้?`)) return;
    await run(`issue-${user.id}`, () => send(`/api/asset-verifications/${data.round.id}`,
      'POST', { userId: user.id }));
  }

  async function receive(record) {
    const checkResult = result[record.id] || 'matched';
    const detail = notes[record.id] || '';
    if (checkResult === 'discrepancy' && detail.trim().length < 3) {
      setError('กรุณาระบุรายละเอียดรายการที่ไม่ตรงก่อนรับเอกสาร');
      return;
    }
    if (!window.confirm(`ยืนยันว่าได้รับใบ ${record.document_no} ที่พนักงานและ IT เซ็นแล้ว?`)) return;
    await run(`receive-${record.id}`, () => send(`/api/asset-verifications/records/${record.id}`,
      'PATCH', { action: 'signed', signedDate: dates[record.id] || today,
        checkResult, notes: detail }));
  }

  async function cancel(record) {
    const reason = window.prompt(`เหตุผลยกเลิก ${record.document_no} (ใบเดิมยังอยู่ในประวัติ)`);
    if (reason === null) return;
    await run(`cancel-${record.id}`, () => send(`/api/asset-verifications/records/${record.id}`,
      'PATCH', { action: 'cancel', reason }));
  }

  async function deleteRound() {
    if (!data || records.some((record) => record.status === 'signed')) return;
    const confirmation = window.prompt(`ลบรอบ “${data.round.title}” พร้อมใบตรวจ ${records.length} ใบถาวร\nพิมพ์ชื่อรอบตรวจให้ตรงเพื่อยืนยัน:`);
    if (confirmation === null) return;
    await run('delete-round', async () => {
      await send(`/api/asset-verifications/${data.round.id}`, 'DELETE', {
        confirmTitle: confirmation, expectedRecords: records.length,
      });
      router.push('/reports/verifications');
    });
  }

  async function printAll() {
    if (!data || !assetUsers.length) return;
    const newCount = assetUsers.filter((user) => !activeRecords.has(user.id)).length;
    if (!window.confirm(`ออกใบตรวจใหม่ ${newCount} คน และพิมพ์ PDF รวมพนักงาน Amzap ${assetUsers.length} คน?\nใบเดิมจะใช้เลขและรายการเดิม`)) return;
    const preview = window.open('', '_blank');
    if (preview) preview.opener = null;
    await run('print-all', async () => {
      try {
        const response = await fetch(`/api/asset-verifications/${data.round.id}/pdf`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedHoldings: assetUsers.map((user) => ({ userId: user.id,
              assetIds: user.holdings.assets.map((asset) => asset.id) })),
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'ไม่สามารถสร้างใบตรวจรวมได้');
        }
        const pdfUrl = URL.createObjectURL(await response.blob());
        if (preview && !preview.closed) preview.location.replace(pdfUrl);
        else window.location.assign(pdfUrl);
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);
      } catch (caught) {
        if (preview && !preview.closed) preview.close();
        throw caught;
      }
    });
  }

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">รอบตรวจ</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">เลือกรอบตรวจ
          <select className={`mt-1 block min-w-56 ${inputClass}`} value={data?.round.id || ''}
            onChange={(event) => router.push(`/reports/verifications?round=${event.target.value}`)}>
            {!rounds.length && <option value="">ยังไม่มีรอบตรวจ</option>}
            {rounds.map((round) => <option key={round.id} value={round.id}>
              {round.title} ({round.year}/{String(round.round_no).padStart(2, '0')})
            </option>)}
          </select>
        </label>
        {data && <p className="pb-2 text-sm text-slate-600">เซ็นรับเอกสารแล้ว {signedCount}/{activeCount} คน · ออกใบแล้ว {assetUsers.filter((user) => activeRecords.has(user.id)).length} คน</p>}
      </div>
      {data && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        {canWrite && <button type="button" onClick={printAll} disabled={!!busy || !assetUsers.length}
          className={`${buttonClass} disabled:cursor-not-allowed`}>
          {busy === 'print-all' ? 'กำลังออกใบและสร้าง PDF...' : `ออกใบ + พิมพ์ทั้งหมด (${assetUsers.length} คน)`}
        </button>}
        {canWrite && <button type="button" onClick={deleteRound} disabled={!!busy || records.some((record) => record.status === 'signed')}
          title={records.some((record) => record.status === 'signed') ? 'มีใบตรวจที่เซ็นแล้ว จึงลบรอบไม่ได้' : undefined}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50">
          ลบรอบตรวจ
        </button>}
        {records.some((record) => record.status === 'signed') && <span className="text-xs text-amber-700">ลบรอบไม่ได้ เพราะมีใบที่เซ็นแล้ว</span>}
        <p className="w-full text-xs text-slate-600">พิมพ์เฉพาะพนักงาน Amzap ที่ Active และมี Asset; ปุ่มเดียวออกใบที่ยังไม่มีแล้วเปิด PDF รวม ใบเดิมใช้เลขและรายการเดิม ไม่รวม Memorize หรือผู้มีแต่ Accessories
          {unissuedAssetCount > 0 && <span className="ml-1 text-amber-700">· ยังไม่ได้ออกใบ {unissuedAssetCount} คน</span>}
        </p>
      </div>}
      {canWrite && <details className="mt-4 border-t border-slate-100 pt-3">
        <summary className="cursor-pointer font-medium text-blue-700">เปิดรอบตรวจใหม่</summary>
        <form onSubmit={createRound} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">ปี ค.ศ.<input className={`mt-1 block w-28 ${inputClass}`} type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(event.target.value)} required /></label>
          <label className="text-sm">รอบที่<input className={`mt-1 block w-24 ${inputClass}`} type="number" min="1" max="99" value={roundNo} onChange={(event) => setRoundNo(event.target.value)} required /></label>
          <label className="min-w-60 flex-1 text-sm">ชื่อรอบ<input className={`mt-1 block w-full ${inputClass}`} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} required /></label>
          <button className={buttonClass} disabled={!!busy}>สร้างรอบ</button>
        </form>
      </details>}
    </section>
    {data && <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-lg font-bold">จัดการใบรายคน / รับใบที่เซ็นแล้ว — {data.round.title}</summary>
      <p className="mt-1 text-sm text-slate-600">ใบที่ออกแล้วใช้รายการและเลขเดิมเมื่อพิมพ์ซ้ำ กรุณาตรวจอุปกรณ์จริงก่อนให้พนักงานเซ็น</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input type="search" aria-label="ค้นหาพนักงาน" placeholder="ค้นหาชื่อ / ชื่อเล่น / Employee Code / แผนก"
          className={`min-w-60 flex-1 ${inputClass}`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="กรองสถานะใบตรวจ" className={inputClass} value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">ทุกสถานะ</option><option value="unissued">ยังไม่ออกใบ</option>
          <option value="issued">รอใบเซ็น</option><option value="signed">รับใบเซ็นแล้ว</option>
        </select>
      </div>
      <div className="mt-4 space-y-3">
        {users.map((user) => {
          const record = activeRecords.get(user.id);
          return <article key={user.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{user.display_name} {!user.is_active && <span className="text-xs text-slate-500">(Inactive)</span>}</h3>
                <p className="text-sm text-slate-500">{user.employee_code || 'ไม่มีรหัสพนักงาน'} · {user.department || 'ไม่ระบุแผนก'}</p>
                <p className="mt-1 text-sm">Asset {user.counts.assets} · Accessory {user.counts.accessories}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {record ? <><span className={record.status === 'signed' ? 'font-medium text-green-700' : 'font-medium text-amber-700'}>
                  {record.status === 'signed' ? 'รับใบเซ็นแล้ว' : 'รอใบเซ็น'} · {record.document_no}</span>
                  <Link className="rounded-lg border border-blue-300 px-3 py-2 text-blue-700" href={`/api/asset-verifications/records/${record.id}/pdf`} target="_blank" rel="noopener noreferrer">ดู / พิมพ์ซ้ำ</Link>
                </> : canWrite && user.is_active ? <button type="button" className={buttonClass} disabled={!!busy}
                  onClick={() => issue(user)}>ออกใบตรวจ</button> : <span className="text-slate-500">ยังไม่ออกใบ</span>}
              </div>
            </div>
            <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-700">ดูรายการอุปกรณ์ปัจจุบัน</summary>
              <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                {user.holdings.assets.map((asset) => <li key={`asset-${asset.id}`}>{asset.asset_code} — {asset.asset_name || 'Asset'}</li>)}
                {user.holdings.accessories.map((item) => <li key={`accessory-${item.id}`}>{item.accessory_type} × {item.quantity}</li>)}
                {!user.holdings.assets.length && !user.holdings.accessories.length && <li>ไม่พบอุปกรณ์ที่ถืออยู่</li>}
              </ul>
              {record && <p className="mt-2 text-amber-700">หากข้อมูลปัจจุบันเปลี่ยน ใบ {record.document_no} ยังคงรายการเดิม ณ วันที่ออกใบ</p>}
            </details>
            {record?.status === 'issued' && canWrite && <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <label className="text-xs">วันที่รับใบเซ็น<input type="date" className={`mt-1 block ${inputClass}`} value={dates[record.id] || today} onChange={(event) => setDates((current) => ({ ...current, [record.id]: event.target.value }))} /></label>
              <label className="text-xs">ผลตรวจ<select className={`mt-1 block ${inputClass}`} value={result[record.id] || 'matched'} onChange={(event) => setResult((current) => ({ ...current, [record.id]: event.target.value }))}>
                <option value="matched">ตรงตามรายการ</option><option value="discrepancy">ไม่ตรงตามรายการ</option>
              </select></label>
              <label className="min-w-44 flex-1 text-xs">รายละเอียด (บังคับเมื่อไม่ตรง)<input className={`mt-1 block w-full ${inputClass}`} maxLength={1000} value={notes[record.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))} /></label>
              <button type="button" className={buttonClass} disabled={!!busy} onClick={() => receive(record)}>รับเอกสารที่เซ็นแล้ว</button>
              <button type="button" className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50" disabled={!!busy} onClick={() => cancel(record)}>ยกเลิกใบ</button>
            </div>}
            {record?.status === 'signed' && <p className="mt-2 text-xs text-slate-600">รับวันที่ {record.signed_date} · {record.check_result === 'discrepancy' ? `พบข้อมูลไม่ตรง: ${record.check_notes}` : 'ข้อมูลตรงตามรายการ'}</p>}
          </article>;
        })}
        {!users.length && <p className="py-6 text-center text-slate-500">ไม่พบพนักงาน</p>}
      </div>
    </details>}
    {data && records.some((record) => record.status === 'cancelled') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">ใบที่ยกเลิก (คงเลขไว้ในประวัติ)</h2>
      <ul className="mt-2 space-y-2 text-sm">{records.filter((record) => record.status === 'cancelled').map((record) => <li key={record.id}>
        {record.document_no} · {record.snapshot.employee.full_name} · {record.cancel_reason} · <Link className="text-blue-700" href={`/api/asset-verifications/records/${record.id}/pdf`} target="_blank">ดูใบเดิม</Link>
      </li>)}</ul>
    </section>}
  </div>;
}
