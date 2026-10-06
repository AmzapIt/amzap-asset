'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmployeePicker from '@/app/components/EmployeePicker';
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass, todayBangkok } from '../accessories/accessory-ui';

const blankLicense = () => ({ name: '', vendor_id: '', total_seats: '1', purchase_date: '',
  expiration_date: '', purchase_cost: '', notes: '', is_active: true, product_key: '', clear_product_key: false });

function Field({ label, children, hint }) {
  return <label className="block space-y-1.5 text-sm font-medium text-slate-700">
    <span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
  </label>;
}

function showDate(value) { return value ? String(value).slice(0, 10).split('-').reverse().join('/') : '–'; }

export default function LicenseManager({ initialInventory, canWrite }) {
  const router = useRouter();
  const [data, setData] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState(null);
  const [form, setForm] = useState(blankLicense);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visibleKey, setVisibleKey] = useState(null);
  const retry = useRef(null);
  const submitting = useRef(false);
  const formPanel = useRef(null);

  const licenses = data.licenses.filter(item => [item.name, item.vendor_name]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const used = data.licenses.reduce((sum, item) => sum + item.used_seats, 0);
  const total = data.licenses.reduce((sum, item) => sum + item.total_seats, 0);
  const within30 = new Date(`${todayBangkok()}T00:00:00Z`);
  within30.setUTCDate(within30.getUTCDate() + 30);
  const expiring = data.licenses.filter(item => item.is_active && item.expiration_date &&
    item.expiration_date <= within30.toISOString().slice(0, 10)).length;
  const inactiveHolders = data.assignments.filter(item => item.user_id && item.user_is_active === false).length;

  function start(mode, license = null, assignment = null) {
    retry.current = null;
    setAction({ mode, license, assignment });
    setError(''); setMessage(''); setVisibleKey(null);
    if (mode === 'create' || mode === 'edit') {
      setForm(mode === 'create' ? blankLicense() : {
        name: license.name, vendor_id: license.vendor_id || '', total_seats: String(license.total_seats),
        purchase_date: license.purchase_date || '', expiration_date: license.expiration_date || '',
        purchase_cost: license.purchase_cost || '', notes: license.notes || '', is_active: license.is_active,
        product_key: '', clear_product_key: false,
      });
    } else if (mode === 'assign') {
      setForm({ target_type: 'user', target_id: '', assigned_date: todayBangkok(), notes: '' });
    } else {
      setForm({ released_date: todayBangkok(), reason: '' });
    }
    requestAnimationFrame(() => formPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function refresh() {
    const fresh = await accessoryFetch('/api/licenses');
    setData(fresh); setVisibleKey(null); router.refresh();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !action) return;
    submitting.current = true; setBusy(true); setError('');
    let saved = false;
    try {
      const { mode, license, assignment } = action;
      let url = '/api/licenses'; let method = 'POST';
      let body = { ...form };
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
      await refresh();
      setAction(null); setMessage('บันทึก License สำเร็จ');
    } catch (failure) {
      setError(`${saved ? 'บันทึกสำเร็จ แต่โหลดข้อมูลใหม่ไม่ได้: ' : ''}${failure.message}`);
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

  return <div className="space-y-6">
    <header className="rounded-2xl bg-slate-900 p-6 text-white">
      <p className="text-sm tracking-widest text-blue-200">AMZAP · SOFTWARE</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Licenses</h1>
          <p className="mt-2 text-slate-200">ติดตามจำนวนสิทธิ์ วันหมดอายุ และผู้ใช้หรือ Asset ที่ได้รับสิทธิ์</p></div>
        {canWrite && <button type="button" className={primaryClass} onClick={() => start('create')}>+ เพิ่ม License</button>}
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["License", data.licenses.length], ["สิทธิ์ที่ใช้ / ทั้งหมด", `${used} / ${total}`], ["หมดอายุภายใน 30 วันหรือเลยกำหนด", expiring], ["สิทธิ์ของพนักงาน Inactive", inactiveHolders]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
    </div>
    {!data.keyConfigured && canWrite && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      การเก็บ Product Key ต้องตั้งค่า LICENSE_ENCRYPTION_KEY ก่อน; ข้อมูลจำนวนสิทธิ์ยังใช้งานได้ตามปกติ
    </p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

    <div ref={formPanel} className="scroll-mt-20">
      {action && <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
        <div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{{ create: 'เพิ่ม License', edit: 'แก้ License', assign: 'จ่ายสิทธิ์', release: 'คืนสิทธิ์' }[action.mode]}</h2>
          <button type="button" className={buttonClass} onClick={() => setAction(null)}>ยกเลิก</button></div>
        {action.license && <p className="mt-1 text-sm text-slate-600">{action.license.name}</p>}
        <fieldset disabled={busy} className="mt-5 grid gap-4 sm:grid-cols-2">
          {['create', 'edit'].includes(action.mode) && <>
            <Field label="ชื่อซอฟต์แวร์ / License *"><input className={inputClass} required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="ผู้ขาย"><select className={inputClass} value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}><option value="">ไม่ระบุ</option>{data.vendors.filter(v => v.is_active || v.id === form.vendor_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
            <Field label="จำนวนสิทธิ์ทั้งหมด *"><input className={inputClass} type="number" min="1" max="100000" required value={form.total_seats} onChange={e => setForm({ ...form, total_seats: e.target.value })} /></Field>
            <Field label="ราคาซื้อรวม (บาท)"><input className={inputClass} type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} /></Field>
            <Field label="วันที่ซื้อ"><input className={inputClass} type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></Field>
            <Field label="วันหมดอายุ"><input className={inputClass} type="date" min={form.purchase_date || undefined} value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} /></Field>
            {data.keyConfigured && <Field label={action.mode === 'edit' ? 'Product Key ใหม่ (เว้นว่างเพื่อคงเดิม)' : 'Product Key'}>
              <input className={inputClass} type="password" autoComplete="off" maxLength={2000} value={form.product_key} onChange={e => setForm({ ...form, product_key: e.target.value, clear_product_key: false })} />
            </Field>}
            {action.mode === 'edit' && data.keyConfigured && action.license.product_key_hint && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.clear_product_key} onChange={e => setForm({ ...form, clear_product_key: e.target.checked, product_key: '' })} />ลบ Product Key เดิม</label>}
            <Field label="หมายเหตุ"><textarea className={inputClass} rows={3} maxLength={10000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />เปิดใช้งาน</label>
          </>}
          {action.mode === 'assign' && <>
            <Field label="จ่ายสิทธิ์ให้"><select className={inputClass} value={form.target_type} onChange={e => setForm({ ...form, target_type: e.target.value, target_id: '' })}><option value="user">พนักงาน</option><option value="asset">Asset</option></select></Field>
            {form.target_type === 'user' ? <EmployeePicker name="target_id" label="พนักงาน *" users={data.users} value={form.target_id} onChange={id => setForm({ ...form, target_id: id })} required />
              : <Field label="Asset *"><select className={inputClass} required value={form.target_id} onChange={e => setForm({ ...form, target_id: e.target.value })}><option value="">เลือก Asset</option>{data.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.asset_code} · {asset.asset_name}</option>)}</select></Field>}
            <Field label="วันที่จ่ายสิทธิ์ *"><input className={inputClass} type="date" max={todayBangkok()} required value={form.assigned_date} onChange={e => setForm({ ...form, assigned_date: e.target.value })} /></Field>
            <Field label="หมายเหตุ"><textarea className={inputClass} rows={2} maxLength={10000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          </>}
          {action.mode === 'release' && <>
            <Field label="วันที่คืนสิทธิ์ *"><input className={inputClass} type="date" min={action.assignment.assigned_date} max={todayBangkok()} required value={form.released_date} onChange={e => setForm({ ...form, released_date: e.target.value })} /></Field>
            <Field label="เหตุผล *"><input className={inputClass} required maxLength={500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="เช่น พนักงานลาออก" /></Field>
          </>}
          <div className="sm:col-span-2"><button type="submit" className={primaryClass}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
        </fieldset>
      </form>}
    </div>

    <section className="space-y-4">
      <label className="block max-w-lg text-sm font-medium">ค้นหา License
        <input className={`${inputClass} mt-1`} value={search} onChange={e => setSearch(e.target.value)} placeholder="ชื่อหรือผู้ขาย" /></label>
      {!licenses.length && <p className="rounded-xl border bg-white p-5 text-slate-500">ยังไม่มี License ที่ตรงกับการค้นหา</p>}
      {licenses.map(license => {
        const active = data.assignments.filter(a => a.license_id === license.id);
        const remaining = license.total_seats - license.used_seats;
        const expired = license.expiration_date && license.expiration_date < todayBangkok();
        return <article key={license.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-lg font-bold">{license.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{license.vendor_name || 'ไม่ระบุผู้ขาย'} · ซื้อ {showDate(license.purchase_date)} · หมดอายุ {showDate(license.expiration_date)}</p>
              {license.product_key_hint && canWrite && <p className="mt-1 text-xs text-slate-500">Product Key ลงท้าย {license.product_key_hint}</p>}
              {!license.is_active && <span className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-xs">ปิดใช้งาน</span>}
              {expired && <span className="ml-2 inline-block rounded bg-red-100 px-2 py-1 text-xs text-red-800">หมดอายุแล้ว</span>}
            </div>
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-center"><p className="text-xs text-blue-700">ใช้ / ว่าง / ทั้งหมด</p><p className="text-lg font-bold text-blue-900">{license.used_seats} / {remaining} / {license.total_seats}</p></div>
          </div>
          {license.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{license.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {canWrite && <><button className={buttonClass} onClick={() => start('edit', license)}>แก้ไข</button>
              <button className={primaryClass} disabled={!license.is_active || remaining <= 0} onClick={() => start('assign', license)}>จ่ายสิทธิ์</button>
              {license.product_key_hint && <button className={buttonClass} onClick={() => revealKey(license.id)}>{visibleKey?.id === license.id ? 'ซ่อน Key' : 'แสดง Key'}</button>}</>}
          </div>
          {visibleKey?.id === license.id && <p className="mt-3 break-all rounded-lg bg-amber-50 p-3 font-mono text-sm" role="status">{visibleKey.value}</p>}
          {active.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="font-semibold">สิทธิ์ที่ใช้อยู่ ({active.length})</h3>
            <ul className="mt-2 divide-y">{active.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span>{a.user_id ? <Link className="text-blue-700 hover:underline" href={`/users/${a.user_id}`}>{personLabel(a)}</Link>
                : <Link className="text-blue-700 hover:underline" href={`/assets/${a.asset_id}`}>{a.asset_code} · {a.asset_name}</Link>}
                <span className="ml-2 text-slate-500">ตั้งแต่ {showDate(a.assigned_date)}</span></span>
              {a.user_id && a.user_is_active === false && <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">พนักงาน Inactive · ตรวจคืนสิทธิ์</span>}
              {canWrite && <button className={buttonClass} onClick={() => start('release', license, a)}>คืนสิทธิ์</button>}
            </li>)}</ul>
          </div>}
        </article>;
      })}
    </section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">ประวัติ License ล่าสุด</h2>
      <ul className="mt-3 divide-y">{data.history.map(row => <li key={row.id} className="py-2 text-sm">
        <span className="font-medium">{{ create: 'เพิ่ม', update: 'แก้ไข', assign: 'จ่ายสิทธิ์', release: 'คืนสิทธิ์' }[row.action]}</span>
        {' · '}{data.licenses.find(l => l.id === row.license_id)?.name || `#${row.license_id}`}
        {(row.full_name || row.asset_code) && ` · ${row.full_name || row.asset_code}`}
        <span className="ml-2 text-slate-500">{row.actor_name || 'ไม่ทราบผู้บันทึก'} · {new Date(row.created_at).toLocaleString('th-TH')}</span>
      </li>)}</ul>
      {!data.history.length && <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติ</p>}
    </section>
  </div>;
}
