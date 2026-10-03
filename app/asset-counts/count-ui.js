export const results = { pending:'ยังไม่ตรวจ',found:'พบแล้ว / ตรง',mismatch:'ข้อมูลไม่ตรง',missing:'ไม่พบ' };
export const colors = { pending:'bg-slate-100 text-slate-700',found:'bg-emerald-50 text-emerald-800',mismatch:'bg-amber-50 text-amber-800',missing:'bg-red-50 text-red-700' };
export function formatCountTime(value) {
  return value ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value)) : '-';
}
export function countCsv(items) {
  const escape = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  const rows = [['Asset Code','ชื่อ Asset','สถานที่ตามรายการ','ผู้ถือตามรายการ','สถานะ Asset ตอนเปิดรอบ','ผลตรวจ',
    'สถานที่ที่พบ','ผู้ถือที่พบ','หมายเหตุ','ผู้ตรวจ','เวลาตรวจ'],
    ...items.map((i) => [i.asset_code,i.asset_name,i.expected_location_name,i.expected_holder_name,i.expected_status,
      results[i.result],i.observed_location_name,i.observed_holder_name,i.notes,i.checked_by_name,formatCountTime(i.checked_at)])];
  return '\uFEFF'+rows.map((row) => row.map(escape).join(',')).join('\r\n');
}
