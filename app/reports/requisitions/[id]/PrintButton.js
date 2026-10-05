export default function PrintButton({ pdfUrl }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white">เปิด PDF / พิมพ์ใบขอเบิก</a>
      <a href={`${pdfUrl}?download=1`} className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700">ดาวน์โหลด PDF</a>
    </div>
  );
}
