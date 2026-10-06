'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmployeePicker from '@/app/components/EmployeePicker';
import { accessoryFetch, buttonClass, inputClass, personLabel, primaryClass, todayBangkok } from '../accessories/accessory-ui';

const blankItem = () => ({ name: '', category: '', brand: '', model: '', unit: 'ชิ้น',
  vendor_id: '', min_quantity: '0', notes: '', is_active: true });
const actionTitle = { create: 'เพิ่ม Consumable', edit: 'แก้ไขรายการ', receive: 'รับเข้าคลัง',
  issue: 'เบิกใช้', adjust: 'ปรับยอดจากการตรวจนับ' };

function Field({ label, children, hint }) {
  return <label className="block space-y-1.5 text-sm font-medium text-slate-700">
    <span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
  </label>;
}

function showDate(value) { return value ? String(value).slice(0, 10).split('-').reverse().join('/') : '–'; }

export default function ConsumableManager({ initialInventory, canWrite }) {
  const router = useRouter();
  const [data, setData] = useState(initialInventory);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState(null);
  const [form, setForm] = useState(blankItem);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef(null);
  const submitting = useRef(false);
  const formPanel = useRef(null);

  const items = data.items.filter(item => [item.name, item.category, item.brand, item.model]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  function start(mode, item = null) {
    retry.current = null;
    setAction({ mode, item }); setMessage(''); setError('');
    if (mode === 'create') setForm(blankItem());
    else if (mode === 'edit') setForm({ name: item.name, category: item.category || '',
      brand: item.brand || '', model: item.model || '', unit: item.unit,
      vendor_id: item.vendor_id || '', min_quantity: String(item.min_quantity),
      notes: item.notes || '', is_active: item.is_active });
    else setForm({ action: mode, quantity: '1', new_quantity: String(item.available_quantity),
      user_id: '', event_date: todayBangkok(), reason: '', notes: '' });
    requestAnimationFrame(() => formPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function refresh() {
    const fresh = await accessoryFetch('/api/consumables');
    setData(fresh); router.refresh();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !action) return;
    submitting.current = true; setBusy(true); setError('');
    let saved = false;
    try {
      const { mode, item } = action;
      let url = '/api/consumables'; let method = 'POST';
      const body = { ...form };
      if (mode === 'edit') { url += `/${item.id}`; method = 'PATCH'; body.expected_version = item.version; }
      else if (mode !== 'create') url += `/${item.id}/movements`;
      const fingerprint = JSON.stringify({ url, method, body });
      if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
      body.request_id = retry.current.id;
      await accessoryFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      saved = true;
      await refresh(); setAction(null); setMessage('บันทึก Consumable สำเร็จ');
    } catch (failure) {
      setError(`${saved ? 'บันทึกสำเร็จ แต่โหลดข้อมูลใหม่ไม่ได้: ' : ''}${failure.message}`);
    } finally { submitting.current = false; setBusy(false); }
  }

  return <div className="space-y-6">
    <header className="rounded-2xl bg-slate-900 p-6 text-white">
      <p className="text-sm tracking-widest text-blue-200">AMZAP · STOCK</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold">Consumables</h1>
          <p className="mt-2 text-slate-200">ของใช้สิ้นเปลือง: รับเข้า เบิกแล้วตัดยอด และดูรายการใกล้หมด</p></div>
        {canWrite && <button type="button" className={primaryClass} onClick={() => start('create')}>+ เพิ่มรายการ</button>}
      </div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      {[["รายการ", data.items.length], ["หน่วยพร้อมเบิก", data.summary.available], ["รายการถึงขั้นต่ำ", data.summary.lowStock]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
    </div>
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

    <div ref={formPanel} className="scroll-mt-20">
      {action && <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
        <div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{actionTitle[action.mode]}</h2>
          <button type="button" className={buttonClass} onClick={() => setAction(null)}>ยกเลิก</button></div>
        {action.item && <p className="mt-1 text-sm text-slate-600">{action.item.name} · พร้อมเบิก {action.item.available_quantity} {action.item.unit}</p>}
        <fieldset disabled={busy} className="mt-5 grid gap-4 sm:grid-cols-2">
          {['create', 'edit'].includes(action.mode) && <>
            <Field label="ชื่อรายการ *"><input className={inputClass} required maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="ประเภท"><input className={inputClass} maxLength={120} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="เช่น หมึกพิมพ์" /></Field>
            <Field label="ยี่ห้อ"><input className={inputClass} maxLength={150} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="รุ่น / รหัสสินค้า"><input className={inputClass} maxLength={150} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></Field>
            <Field label="หน่วยนับ *"><input className={inputClass} required maxLength={40} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="ชิ้น / กล่อง / ขวด" /></Field>
            <Field label="จำนวนขั้นต่ำ"><input className={inputClass} type="number" min="0" max="100000" required value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} /></Field>
            <Field label="ผู้ขาย"><select className={inputClass} value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}><option value="">ไม่ระบุ</option>{data.vendors.filter(v => v.is_active || v.id === form.vendor_id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
            <Field label="หมายเหตุ"><textarea className={inputClass} rows={3} maxLength={10000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />เปิดใช้งาน</label>
            {action.mode === 'create' && <p className="text-xs text-slate-500 sm:col-span-2">สร้างรายการด้วยยอด 0 ก่อน แล้วใช้ “รับเข้า” เพื่อบันทึกยอดตั้งต้นพร้อมที่มา</p>}
          </>}
          {!['create', 'edit'].includes(action.mode) && <>
            {action.mode === 'adjust' ? <Field label="ยอดที่ตรวจนับได้ *"><input className={inputClass} type="number" min="0" max="100000" required value={form.new_quantity} onChange={e => setForm({ ...form, new_quantity: e.target.value })} /></Field>
              : <Field label={`จำนวน (${action.item.unit}) *`}><input className={inputClass} type="number" min="1" max={action.mode === 'issue' ? action.item.available_quantity : 100000} required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></Field>}
            {action.mode === 'issue' && <EmployeePicker name="user_id" label="พนักงานผู้เบิก *" users={data.users} value={form.user_id} onChange={id => setForm({ ...form, user_id: id })} required />}
            <Field label="วันที่ดำเนินการ *"><input className={inputClass} type="date" max={todayBangkok()} required value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></Field>
            <Field label="เหตุผล *"><input className={inputClass} required maxLength={500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder={action.mode === 'receive' ? 'เช่น ซื้อเข้า' : action.mode === 'adjust' ? 'เช่น ตรวจนับคลัง' : 'เช่น ใช้ในงาน IT'} /></Field>
            <div className="sm:col-span-2"><Field label="หมายเหตุ"><textarea className={inputClass} rows={2} maxLength={10000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </>}
          <div className="sm:col-span-2"><button type="submit" className={primaryClass}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
        </fieldset>
      </form>}
    </div>

    <section className="space-y-4">
      <label className="block max-w-lg text-sm font-medium">ค้นหา Consumable
        <input className={`${inputClass} mt-1`} value={search} onChange={e => setSearch(e.target.value)} placeholder="ชื่อ ประเภท ยี่ห้อ หรือรุ่น" /></label>
      {!items.length && <p className="rounded-xl border bg-white p-5 text-slate-500">ยังไม่มีรายการที่ตรงกับการค้นหา</p>}
      <div className="grid gap-4 lg:grid-cols-2">{items.map(item => {
        const low = item.is_active && item.available_quantity <= item.min_quantity;
        return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between gap-3"><div><h2 className="text-lg font-bold">{item.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{[item.category, item.brand, item.model, item.vendor_name].filter(Boolean).join(' · ') || 'ไม่ระบุรายละเอียด'}</p></div>
            <div className={`rounded-xl px-4 py-2 text-center ${low ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-900'}`}><p className="text-xl font-bold">{item.available_quantity}</p><p className="text-xs">{item.unit}</p></div></div>
          <p className="mt-3 text-sm text-slate-600">ขั้นต่ำ {item.min_quantity} {item.unit}{low && <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">ถึงจุดสั่งซื้อ</span>}{!item.is_active && <span className="ml-2 rounded bg-slate-100 px-2 py-1 text-xs">ปิดใช้งาน</span>}</p>
          {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{item.notes}</p>}
          {canWrite && <div className="mt-4 flex flex-wrap gap-2"><button className={buttonClass} onClick={() => start('edit', item)}>แก้ไข</button>
            <button className={primaryClass} disabled={!item.is_active} onClick={() => start('receive', item)}>รับเข้า</button>
            <button className={buttonClass} disabled={!item.is_active || item.available_quantity === 0} onClick={() => start('issue', item)}>เบิกใช้</button>
            <button className={buttonClass} disabled={!item.is_active} onClick={() => start('adjust', item)}>ปรับยอด</button></div>}
        </article>;
      })}</div>
    </section>

    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">ประวัติคลังล่าสุด</h2>
      <ul className="mt-3 divide-y">{data.movements.map(row => <li key={row.id} className="py-2 text-sm">
        <span className="font-medium">{{ receive: 'รับเข้า', issue: 'เบิกใช้', adjust: 'ปรับยอด' }[row.action]}</span>
        {' · '}{data.items.find(item => item.id === row.item_id)?.name || `#${row.item_id}`}
        {' · '}{row.stock_delta > 0 ? '+' : ''}{row.stock_delta} → คงเหลือ {row.balance_after}
        {row.user_id && <> · <Link className="text-blue-700 hover:underline" href={`/users/${row.user_id}`}>{personLabel(row)}</Link></>}
        <span className="ml-2 text-slate-500">{row.reason} · {showDate(row.event_date)} · {row.actor_name || 'ไม่ทราบผู้บันทึก'}</span>
      </li>)}</ul>
      {!data.movements.length && <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติ</p>}
    </section>
  </div>;
}
