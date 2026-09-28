export const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
export const buttonClass = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const primaryClass = "min-h-10 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50";
export const actionLabels = { opening:"ยอดเปิด",receive:"รับเข้า",issue:"เบิกให้พนักงาน",return:"คืนเข้าคลัง",transfer:"โอนพนักงาน",dispose:"ตัดออก",edit:"แก้ไข" };
export function stockLabel(stock) {
  return [stock.accessory_type,stock.brand,stock.model,stock.serial_number && `S/N: ${stock.serial_number}`].filter(Boolean).join(" · ");
}
export function personLabel(person) {
  return `${person.full_name}${person.nickname ? ` (${person.nickname})` : ""}${person.employee_code ? ` · ${person.employee_code}` : ""}`;
}
export function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
export function formatDate(value) {
  return value ? new Date(`${String(value).slice(0,10)}T00:00:00Z`).toLocaleDateString("en-GB",{timeZone:"UTC"}) : "–";
}
export async function accessoryFetch(url, options) {
  const response = await fetch(url,{cache:"no-store",...options});
  const data = await response.json().catch(()=>null);
  if (!response.ok || !data?.success) throw new Error(data?.error || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่");
  return data;
}
