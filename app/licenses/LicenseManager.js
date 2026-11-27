'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmployeePicker from '@/app/components/EmployeePicker';
import { LICENSE_FILTERS, matchesLicenseSearch, sortLicenses } from '@/lib/license-status';
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass, todayBangkok } from '../accessories/accessory-ui';

const blankLicense = () => ({ name: '', vendor_id: '', total_seats: '1', purchase_date: '',
  expiration_date: '', purchase_cost: '', notes: '', is_active: true, product_key: '', clear_product_key: false });

// สีพร้อมไอคอนและข้อความ ไม่สื่อด้วยสีอย่างเดียว
const STATUS_STYLES = {
  expired: ['bg-red-100 text-red-800', '⚠'],
  soon: ['bg-amber-100 text-amber-900', '●'],
  noExpiry: ['bg-slate-100 text-slate-700', '○'],
  ok: ['bg-emerald-50 text-emerald-800', '✓'],
  inactive: ['bg-slate-100 text-slate-500', '–'],
};
const MODE_TITLES = { create: 'เพิ่ม License', edit: 'แก้ไข License', assign: 'จ่ายสิทธิ์', release: 'คืนสิทธิ์' };
const HISTORY_LABELS = { create: 'เพิ่ม', update: 'แก้ไข', assign: 'จ่ายสิทธิ์', release: 'คืนสิทธิ์' };

function Field({ label, children, hint, wide }) {
  return <label className={`block space-y-1.5 text-sm font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
    <span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
  </label>;
}

function Group({ title, children }) {
  return <fieldset className="grid gap-4 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-2">
    <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>{children}
  </fieldset>;
}

function showDate(value) { return value ? String(value).slice(0, 10).split('-').reverse().join('/') : '–'; }
function money(value) { return value == null || value === '' ? '–' : `${Number(value).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} บาท`; }

function StatusBadge({ status }) {
  const [tone, icon] = STATUS_STYLES[status.key];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><span aria-hidden="true">{icon}</span>{status.label}</span>;
}

function SeatBar({ used, total }) {
  const percent = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return <div>
    <div className="flex items-baseline justify-between text-sm">
      <span><strong className="text-lg">{used}</strong> <span className="text-slate-500">/ {total} สิทธิ์</span></span>
      <span className={used >= total ? 'font-semibold text-amber-800' : 'text-slate-600'}>{used >= total ? 'เต็มแล้ว' : `ว่าง ${total - used}`}</span>
    </div>
    <div className="mt-1.5 h-2.5 rounded-full bg-slate-100" role="img" aria-label={`ใช้ ${used} จาก ${total} สิทธิ์`}>
      <div className="h-2.5 rounded-full bg-[#2a78d6]" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

export default function LicenseManager({ initialInventory, canWrite }) {
  const router = useRouter();
  const [data, setData] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [action, setAction] = useState(null);
  const [form, setForm] = useState(blankLicense);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visibleKey, setVisibleKey] = useState(null);
  const retry = useRef(null);
  const submitting = useRef(false);

  const today = todayBangkok();
  const sorted = sortLicenses(data.licenses, today);
  const seatsOf = license => data.assignments.filter(a => a.license_id === license.id);
  const shown = sorted.filter(({ license, status }) => LICENSE_FILTERS[filter].match(status.key)
    && matchesLicenseSearch(license, seatsOf(license), search));
  const count = key => sorted.filter(({ status }) => status.key === key).length;
  const used = data.licenses.reduce((sum, item) => sum + item.used_seats, 0);
  const total = data.licenses.reduce((sum, item) => sum + item.total_seats, 0);
  const inactiveHolders = data.assignments.filter(item => item.user_id && item.user_is_active === false).length;
  const tiles = [
    ['License ทั้งหมด', data.licenses.length, 'all'],
    ['สิทธิ์ที่ใช้ / ทั้งหมด', `${used} / ${total}`, null],
    ['เลยกำหนด', count('expired'), 'attention'],
    ['หมดใน 30 วัน', count('soon'), 'attention'],
    ['ไม่มีวันหมดอายุ', count('noExpiry'), 'noExpiry'],
  ];

  useEffect(() => {
    if (!action) return undefined;
    const close = event => { if (event.key === 'Escape' && !submitting.current) setAction(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [action]);

  function start(mode, license = null, assignment = null) {
    retry.current = null;
    setAction({ mode, license, assignment });
    setError(''); setFormError(''); setMessage(''); setVisibleKey(null);
    if (mode === 'create' || mode === 'edit') {
      setForm(mode === 'create' ? blankLicense() : {
        name: license.name, vendor_id: license.vendor_id || '', total_seats: String(license.total_seats),
        purchase_date: license.purchase_date || '', expiration_date: license.expiration_date || '',
        purchase_cost: license.purchase_cost || '', notes: license.notes || '', is_active: license.is_active,
        product_key: '', clear_product_key: false,
      });
    } else if (mode === 'assign') {
      setForm({ target_type: 'user', target_id: '', assigned_date: today, notes: '' });
    } else {
      setForm({ released_date: today, reason: '' });
    }
  }

  async function refresh() {
    const fresh = await accessoryFetch('/api/licenses');
    setData(fresh); setVisibleKey(null); router.refresh();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !action) return;
    submitting.current = true; setBusy(true); setFormError('');
    let saved = false;
    try {
      const { mode, license, assignment } = action;
      let url = '/api/licenses'; let method = 'POST';
      const body = { ...form };
      if (mode === 'edit') {
        url += `/${license.id}`; method = 'PATCH'; body.expected_version = license.version;
      } else if (mode === 'assign') {
        url += `/${license.id}/assignments`;
      } else if (mode === 'release') {
        url += `/${license.id}/assignments/${assignment.id}/release`;
      }
      const fingerprint = JSON.stringify({ url, method, body });
      if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
      body.request_id = retry.current.id;
      await accessoryFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      saved = true;
      setAction(null); setMessage(`${MODE_TITLES[mode]}สำเร็จ`);
      await refresh();
    } catch (failure) {
      if (saved) setError(`บันทึกสำเร็จ แต่โหลดข้อมูลใหม่ไม่ได้: ${failure.message}`);
      else setFormError(failure.message);
    } finally { submitting.current = false; setBusy(false); }
  }

  async function revealKey(id) {
    if (visibleKey?.id === id) { setVisibleKey(null); return; }
    setError('');
    try {
      const result = await accessoryFetch(`/api/licenses/${id}/key`);
      setVisibleKey({ id, value: result.productKey });
    } catch (failure) { setError(failure.message); }
  }

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  return <div className="space-y-6">
    <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold sm:text-3xl">Licenses</h1>
          <p className="mt-2 text-sm text-blue-100 sm:text-base">จำนวนสิทธิ์ วันหมดอายุ และผู้ที่ได้รับสิทธิ์</p></div>
        {canWrite && <button type="button" className="rounded-lg bg-white px-4 py-2 font-medium text-blue-900 hover:bg-blue-50" onClick={() => start('create')}>+ เพิ่ม License</button>}
      </div>
    </header>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {tiles.map(([label, value, target]) => {
        const body = <><span className="block text-sm text-slate-500">{label}</span><span className="mt-1 block text-2xl font-bold">{value}</span></>;
        return target
          ? <button key={label} type="button" onClick={() => setFilter(target)} className="rounded-2xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition hover:border-blue-400">{body}</button>
          : <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">{body}</div>;
      })}
    </div>

    {inactiveHolders > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      ⚠ มีสิทธิ์ที่ยังอยู่กับพนักงาน Inactive {inactiveHolders} สิทธิ์ ควรคืนสิทธิ์และนำออกจากบัญชีผู้ให้บริการ
    </p>}
    {!data.keyConfigured && canWrite && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      การเก็บ Product Key ต้องตั้งค่า LICENSE_ENCRYPTION_KEY ก่อน ข้อมูลจำนวนสิทธิ์ยังใช้งานได้ตามปกติ
    </p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <label className="block w-full max-w-lg text-sm font-medium">ค้นหา
        <input className={`${inputClass} mt-1`} value={search} onChange={e => setSearch(e.target.value)} placeholder="ชื่อ License, ผู้ขาย, พนักงาน หรือรหัสเครื่อง" /></label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามสถานะ">
        {Object.entries(LICENSE_FILTERS).map(([key, { label }]) => <button key={key} type="button" aria-pressed={filter === key}
          onClick={() => setFilter(key)}
          className={`min-h-10 rounded-full border px-3 text-sm ${filter === key ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}</button>)}
      </div>
    </div>

    {!shown.length && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-500">
      {data.licenses.length ? 'ไม่มี License ที่ตรงกับการค้นหาหรือตัวกรอง' : 'ยังไม่มี License'}
    </p>}
    <div className="grid gap-4 lg:grid-cols-2">
      {shown.map(({ license, status }) => {
        const seats = seatsOf(license);
        const remaining = license.total_seats - license.used_seats;
        const canAssign = canWrite && license.is_active && remaining > 0;
        return <article key={license.id} className={`flex min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm ${status.key === 'expired' ? 'border-red-300' : status.key === 'soon' ? 'border-amber-300' : 'border-slate-200/70'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words text-lg font-bold">{license.name}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{license.vendor_name || 'ไม่ระบุผู้ขาย'} · หมดอายุ {showDate(license.expiration_date)}</p></div>
            <StatusBadge status={status} />
          </div>

          <div className="mt-4"><SeatBar used={license.used_seats} total={license.total_seats} /></div>

          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {seats.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0">
                {a.user_id ? <Link className="font-medium text-blue-700 hover:underline" href={`/users/${a.user_id}`}>{personLabel(a)}</Link>
                  : <Link className="font-medium text-blue-700 hover:underline" href={`/assets/${a.asset_id}`}>{a.asset_code} · {a.asset_name}</Link>}
                <span className="block text-xs text-slate-500">
                  {a.user_devices ? `${a.user_devices} · ` : ''}ตั้งแต่ {showDate(a.assigned_date)}
                </span>
                {a.user_id && a.user_is_active === false && <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">⚠ พนักงาน Inactive · ควรคืนสิทธิ์</span>}
              </span>
              {canWrite && <button className={buttonClass} onClick={() => start('release', license, a)}>คืนสิทธิ์</button>}
            </li>)}
            {remaining > 0 && <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-slate-500">
              <span>○ ว่าง {remaining} สิทธิ์</span>
              {canAssign && <button className={primaryClass} onClick={() => start('assign', license)}>+ จ่ายสิทธิ์</button>}
            </li>}
          </ul>

          <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none py-1 font-medium text-slate-700">รายละเอียด{canWrite ? 'และหมายเหตุ' : ''}</summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pb-1">
              <dt className="text-slate-500">วันที่ซื้อ</dt><dd>{showDate(license.purchase_date)}</dd>
              <dt className="text-slate-500">วันหมดอายุ</dt><dd>{showDate(license.expiration_date)}</dd>
              {canWrite && <><dt className="text-slate-500">ราคาซื้อรวม</dt><dd>{money(license.purchase_cost)}</dd>
                <dt className="text-slate-500">Product Key</dt><dd>{license.product_key_hint ? `ลงท้าย ${license.product_key_hint}` : 'ไม่ได้บันทึก'}</dd>
                <dt className="text-slate-500">หมายเหตุ</dt><dd className="whitespace-pre-wrap break-words">{license.notes || '–'}</dd></>}
            </dl>
          </details>

          {canWrite && <div className="mt-4 flex flex-wrap gap-2">
            <button className={buttonClass} onClick={() => start('edit', license)}>แก้ไข</button>
            {license.product_key_hint && <button className={buttonClass} onClick={() => revealKey(license.id)}>{visibleKey?.id === license.id ? 'ซ่อน Key' : 'แสดง Key'}</button>}
          </div>}
          {visibleKey?.id === license.id && <p className="mt-3 break-all rounded-lg bg-amber-50 p-3 font-mono text-sm" role="status">{visibleKey.value}</p>}
        </article>;
      })}
    </div>

    <details className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer select-none text-lg font-semibold">ประวัติล่าสุด ({data.history.length})</summary>
      <ul className="mt-3 divide-y divide-slate-100">{data.history.map(row => <li key={row.id} className="py-2 text-sm">
        <span className="font-medium">{HISTORY_LABELS[row.action] || row.action}</span>
        {' · '}{data.licenses.find(l => l.id === row.license_id)?.name || `#${row.license_id}`}
        {(row.full_name || row.asset_code) && ` · ${row.full_name || row.asset_code}`}
        <span className="ml-2 text-slate-500">{row.actor_name || 'ไม่ทราบผู้บันทึก'} · {new Date(row.created_at).toLocaleString('th-TH')}</span>
      </li>)}</ul>
      {!data.history.length && <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติ</p>}
    </details>

    {action && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) setAction(null); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="license-dialog-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="license-dialog-title" className="text-xl font-semibold">{MODE_TITLES[action.mode]}</h2>
            {action.license && <p className="mt-1 text-sm text-slate-600">{action.license.name}</p>}
            {action.assignment && <p className="text-sm text-slate-600">{action.assignment.user_id ? personLabel(action.assignment) : action.assignment.asset_code}</p>}</div>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setAction(null)} aria-label="ปิด">✕</button>
        </div>
        {formError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <fieldset disabled={busy} className="mt-5 space-y-5">
          {['create', 'edit'].includes(action.mode) && <>
            <Group title="ข้อมูลหลัก">
              <Field label="ชื่อซอฟต์แวร์ / License *" wide hint="ถ้ามีหลายชุด ตั้งชื่อให้แยกกัน เช่น ชุด 1 / ชุด 2">
                <input className={inputClass} required maxLength={200} value={form.name} onChange={set('name')} autoFocus /></Field>
              <Field label="ผู้ขาย"><select className={inputClass} value={form.vendor_id} onChange={set('vendor_id')}><option value="">ไม่ระบุ</option>{data.vendors.filter(v => v.is_active || v.id === form.vendor_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
              <Field label="จำนวนสิทธิ์ทั้งหมด *"><input className={inputClass} type="number" min="1" max="100000" required value={form.total_seats} onChange={set('total_seats')} /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />เปิดใช้งาน</label>
            </Group>
            <Group title="วันที่และราคา">
              <Field label="วันที่ซื้อ"><input className={inputClass} type="date" value={form.purchase_date} onChange={set('purchase_date')} /></Field>
              <Field label="วันหมดอายุ" hint="ระบบเตือนล่วงหน้า 30 วัน"><input className={inputClass} type="date" min={form.purchase_date || undefined} value={form.expiration_date} onChange={set('expiration_date')} /></Field>
              <Field label="ราคาซื้อรวม (บาท)"><input className={inputClass} type="number" min="0" step="0.01" value={form.purchase_cost} onChange={set('purchase_cost')} /></Field>
            </Group>
            {data.keyConfigured && <Group title="Product Key">
              <Field label={action.mode === 'edit' ? 'Product Key ใหม่ (เว้นว่างเพื่อคงเดิม)' : 'Product Key'} wide hint="เข้ารหัสก่อนบันทึก">
                <input className={inputClass} type="password" autoComplete="off" maxLength={2000} value={form.product_key} onChange={e => setForm({ ...form, product_key: e.target.value, clear_product_key: false })} />
              </Field>
              {action.mode === 'edit' && action.license.product_key_hint && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.clear_product_key} onChange={e => setForm({ ...form, clear_product_key: e.target.checked, product_key: '' })} />ลบ Product Key เดิม</label>}
            </Group>}
            <Group title="หมายเหตุ">
              <Field label="หมายเหตุ" wide hint="เห็นเฉพาะ Admin และ IT Staff · ห้ามใส่รหัสผ่าน">
                <textarea className={inputClass} rows={3} maxLength={10000} value={form.notes} onChange={set('notes')} /></Field>
            </Group>
          </>}
          {action.mode === 'assign' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="จ่ายสิทธิ์ให้"><select className={inputClass} value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value, target_id: '' })}><option value="user">พนักงาน</option><option value="asset">Asset</option></select></Field>
            <Field label="วันที่จ่ายสิทธิ์ *"><input className={inputClass} type="date" max={today} required value={form.assigned_date} onChange={set('assigned_date')} /></Field>
            <div className="sm:col-span-2">{form.target_type === 'user'
              ? <EmployeePicker name="target_id" label="พนักงาน *" users={data.users} value={form.target_id} onChange={id => setForm({ ...form, target_id: id })} required />
              : <Field label="Asset *"><select className={inputClass} required value={form.target_id} onChange={set('target_id')}><option value="">เลือก Asset</option>{data.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.asset_name}</option>)}</select></Field>}</div>
            <Field label="หมายเหตุ" wide><textarea className={inputClass} rows={2} maxLength={10000} value={form.notes} onChange={set('notes')} /></Field>
          </div>}
          {action.mode === 'release' && <div className="grid gap-4 sm:grid-cols-2">
            <Field label="วันที่คืนสิทธิ์ *"><input className={inputClass} type="date" min={action.assignment.assigned_date} max={today} required value={form.released_date} onChange={set('released_date')} /></Field>
            <Field label="เหตุผล *"><input className={inputClass} required maxLength={500} value={form.reason} onChange={set('reason')} placeholder="เช่น พนักงานลาออก" /></Field>
            <p className="text-xs text-slate-500 sm:col-span-2">ระบบบันทึกเท่านั้น อย่าลืมนำผู้ใช้ออกจากบัญชีของผู้ให้บริการด้วย</p>
          </div>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" className={buttonClass} onClick={() => setAction(null)}>ยกเลิก</button>
            <button type="submit" className={primaryClass}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          </div>
        </fieldset>
      </form>
    </div>}
  </div>;
}
