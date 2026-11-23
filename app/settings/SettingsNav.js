import Link from "next/link";

export default function SettingsNav({ view, admin = false }) {
  const tabs = [
    ["overview", "ภาพรวมระบบ", "/settings"],
    ...(admin ? [
      ["photos", "การจัดเก็บรูป Asset", "/settings?tab=photos"],
      ["labels", "การพิมพ์สติ๊กเกอร์", "/settings?tab=labels"],
      ["documents", "รูปแบบเอกสาร", "/settings?tab=documents"],
      ["machine", "สคริปต์ตรวจเครื่อง", "/settings?tab=machine"],
      ["master", "Master Data", "/settings?tab=master"],
      ["subtypes", "ประเภทย่อย", "/settings?tab=subtypes"],
      ["accounts", "System Accounts", "/accounts"],
    ] : []),
    ["password", "Change Password", "/account/password"],
  ];

  return (
    <nav aria-label="เมนูการตั้งค่า" className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex sm:flex-wrap">
      {tabs.map(([key, label, href]) => <Link key={key} href={href} aria-current={view === key ? "page" : undefined} className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${view === key ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</Link>)}
    </nav>
  );
}
