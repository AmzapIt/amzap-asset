import Link from "next/link";

const REPORT_TABS = [
  { href: "/reports/assets", view: "assets", label: "Export Asset" },
  { href: "/reports/requisitions", view: "requisitions", label: "ใบขอเบิก / เปลี่ยนทดแทน-คืน" },
  {
    href: "/reports/handover",
    view: "handover",
    label: "ใบรับมอบ Asset/Accessory",
  },
  { href: "/reports/return-forms", view: "return-forms", label: "ใบคืนทรัพย์สิน (ลาออก)" },
  { href: "/reports/verifications", view: "verifications", label: "ตรวจยืนยันทรัพย์สินประจำรอบ" },
  { href: "/reports/custody", view: "custody", label: "ผู้ถือครองและเบิก–คืน" },
  { href: "/reports/offboarding", view: "offboarding", label: "ลาออก · คืนของค้าง" },
];

// Layout กลางของหน้ารายงานรวมเมนูย่อย ขณะที่แต่ละ route โหลดเฉพาะข้อมูลที่ใช้
export default function ReportsShell({ children, description, title, view, canViewOperational = false }) {
  const tabs = REPORT_TABS.filter((tab) =>
    canViewOperational || !["custody", "offboarding", "return-forms"].includes(tab.view));
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
            Documents & exports
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-blue-100">{description}</p>
        </header>

        <nav
          aria-label="เมนูรายงาน"
          className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex sm:flex-wrap"
        >
          {tabs.map((tab) => {
            const isActive = view === tab.view;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </main>
  );
}

// แสดง error แทนรายการว่าง เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าไม่มีข้อมูลในระบบ
export function ReportLoadError({ retryHref }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 sm:py-8">
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
      >
        ไม่สามารถโหลดข้อมูลรายงานได้
      </p>
      <Link
        className="mt-4 inline-block text-blue-700 hover:underline"
        href={retryHref}
      >
        ลองใหม่
      </Link>
    </main>
  );
}
