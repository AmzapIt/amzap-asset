"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Printer,
  ScanLine,
  ClipboardCheck,
  ClipboardList,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function Sidebar({ user }) {
  // =========================================================
  // Sidebar state
  // =========================================================
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  // Drawer มือถือล็อกการเลื่อนหน้าด้านหลังและรองรับปุ่ม Escape
  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileOpen]);

  const masterItems = [
    { kind: "departments", label: "Departments", icon: Building2 },
    { kind: "locations", label: "Locations", icon: MapPin },
    { kind: "vendors", label: "Vendors", icon: Store },
    { kind: "asset_types", label: "Asset Types", icon: Tags },
    { kind: "accessory_types", label: "Accessory Types", icon: Tags },
  ];

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/assets", label: "Asset List", icon: Package },
    { href: "/scan", label: "สแกน QR / เพิ่มรูป", icon: ScanLine },
    { href: "/asset-counts", label: "ตรวจนับ Asset", icon: ClipboardCheck },
    ...(["Admin", "IT Staff"].includes(user?.role)
      ? [{ href: "/it-follow-up", label: "งาน IT ต้องติดตาม", icon: ClipboardList }]
      : []),
    ...(["Admin", "IT Staff"].includes(user?.role)
      ? [{ href: "/labels", label: "Print Asset Labels", icon: Printer }]
      : []),
    { href: "/accessories", label: "Accessories / Stock", icon: Package },
    { href: "/users", label: "User Management", icon: Users },
  ];

  const reportItems = [
    { href: "/reports/assets", view: "assets", label: "Export Asset" },
    { href: "/reports/requisitions", view: "requisitions", label: "ใบขอเบิก / เปลี่ยนอุปกรณ์" },
    {
      href: "/reports/handover",
      view: "handover",
      label: "ใบรับมอบ Asset/Accessory",
    },
    ...(["Admin", "IT Staff"].includes(user?.role)
      ? [
          { href: "/reports/custody", view: "custody", label: "ผู้ถือครองและเบิก–คืน" },
          { href: "/reports/offboarding", view: "offboarding", label: "ลาออก · คืนของค้าง" },
        ]
      : []),
  ];

  // Hiding links improves navigation, but it is not a security boundary.
  // The account page and every mutation verify the current role on the server.
  const settingsItems = [
    ...(user?.role === "Admin"
      ? [{ href: "/accounts", label: "System Accounts", icon: ShieldCheck }]
      : []),
    { href: "/account/password", label: "Change Password", icon: KeyRound },
  ];
  const isSettingsActive = settingsItems.some((item) => isActive(item.href));
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsActive);

  const compactItems = [
    ...navItems,
    { href: "/reports/assets", label: "Reports / Export", icon: Download },
  ];

  function isActive(href) {
    return href === "/" ? pathname === href : pathname.startsWith(href);
  }

  function isReportActive(href) {
    return pathname === href;
  }

  function linkClass(active) {
    return `flex items-center rounded-lg py-2.5 font-semibold transition ${
      isCollapsed ? "justify-center px-2" : "gap-3 px-3"
    } ${
      active
        ? "bg-blue-50 text-blue-700"
        : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
    }`;
  }

  // ถ้ายังไม่ได้ Login เช่นหน้า /login
  // ไม่ต้องแสดง Sidebar
  if (!user) {
    return null;
  }

  return (
    <>
      {/* มือถือใช้ Top bar + Drawer เพื่อไม่ให้ Sidebar บีบพื้นที่เนื้อหา */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:hidden">
        <Link href="/" className="font-bold text-slate-900">
          AMZAP Asset
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="เปิดเมนู"
          aria-controls="mobile-navigation"
          aria-expanded={isMobileOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
        >
          <Menu size={22} />
        </button>
      </header>

      {isMobileOpen && (
        <>
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          />

          <aside
            id="mobile-navigation"
            aria-label="เมนูหลักบนมือถือ"
            className="fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-3rem))] overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">AMZAP Asset</p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {user.name || user.email} · {user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="ปิดเมนู"
                className="ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
              >
                <X size={21} />
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-1.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <item.icon size={19} />
                  {item.label}
                </Link>
              ))}

              <details open={pathname.startsWith("/master/")}>
                <summary className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
                  Master Data
                </summary>
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                  {masterItems.map((item) => (
                    <Link
                      key={item.kind}
                      href={`/master/${item.kind}`}
                      onClick={() => setIsMobileOpen(false)}
                      className={`rounded-lg px-3 py-2.5 text-sm ${
                        isActive(`/master/${item.kind}`)
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>

              <details open={pathname.startsWith("/reports")}>
                <summary className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
                  Reports / Export
                </summary>
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                  {reportItems.map((item) => (
                    <Link
                      key={item.view}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`rounded-lg px-3 py-2.5 text-sm ${
                        isReportActive(item.href)
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>

              <details open={isSettingsOpen}>
                <summary
                  onClick={(event) => {
                    event.preventDefault();
                    setIsSettingsOpen((open) => !open);
                  }}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${
                    isSettingsActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Settings size={19} aria-hidden="true" />
                  <span>Settings</span>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className={`ml-auto transition-transform ${isSettingsOpen ? "rotate-90" : ""}`}
                  />
                </summary>
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                  {settingsItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                        isActive(item.href)
                          ? "bg-blue-50 font-semibold text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <item.icon size={17} aria-hidden="true" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            </nav>

            <form action={logoutAction} className="mt-6 border-t border-slate-200 pt-4">
              <button
                type="submit"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </form>
          </aside>
        </>
      )}

    <aside
      className={`${
        isCollapsed ? "w-16 px-2" : "w-56 px-4"
      } sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-slate-200 bg-white py-6 shadow-sm transition-all duration-200 lg:block`}
    >
      {/* =====================================================
          Header / Collapse button
         ===================================================== */}
      <div
        className={`${
          isCollapsed ? "justify-center" : "justify-end"
        } -mx-0 flex items-center gap-2 border-b border-slate-200 pb-5`}
      >
        {!isCollapsed && (
          <h1 className="mr-auto text-lg font-bold text-gray-800">
            AMZAP Asset
          </h1>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
          aria-label={isCollapsed ? "Show menu" : "Hide menu"}
          title={isCollapsed ? "Show menu" : "Hide menu"}
        >
          {isCollapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* =================================================
              Login User
             ================================================= */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold text-gray-800">
              {user.name || user.email}
            </p>

            <p className="mt-1 text-xs text-gray-500">{user.role}</p>
          </div>

          {/* =================================================
              Navigation
             ================================================= */}
          <nav className="mt-6 flex flex-col gap-1.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(isActive(item.href))}
              >
                {item.label}
              </Link>
            ))}

            {/* Master Data */}
            <details>
              <summary className="cursor-pointer rounded-lg px-3 py-2.5 font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                Master Data
              </summary>

              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                {masterItems.map((item) => (
                  <Link
                    key={item.kind}
                    href={`/master/${item.kind}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 capitalize transition ${isActive(`/master/${item.kind}`) ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>

            {/* Export และใบรับมอบเป็นคนละ Route จริง ส่วน /reports เดิม
                จะ redirect ไปหน้า Export Asset เพื่อรักษาลิงก์เก่า */}
            <details open={pathname.startsWith("/reports")}>
              <summary
                className={`cursor-pointer rounded-lg px-3 py-2.5 font-semibold transition ${
                  pathname.startsWith("/reports")
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                Reports / Export
              </summary>

              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                {reportItems.map((item) => (
                  <Link
                    key={item.view}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      isReportActive(item.href)
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>

            <details open={isSettingsOpen}>
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setIsSettingsOpen((open) => !open);
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 font-semibold transition ${
                  isSettingsActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <Settings size={18} aria-hidden="true" />
                <span>Settings</span>
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className={`ml-auto transition-transform ${isSettingsOpen ? "rotate-90" : ""}`}
                />
              </summary>
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2">
                {settingsItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      isActive(item.href)
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>

          {/* =================================================
              Logout
             ================================================= */}
          <div className="mt-8 border-t pt-4">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </form>
          </div>
        </>
      )}

      {isCollapsed && (
        <nav className="mt-6 flex flex-col items-center gap-2">
          {compactItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(isActive(item.href))}
              onClick={() => setIsCollapsed(false)}
              title={item.label}
              aria-label={item.label}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <item.icon size={18} strokeWidth={2} />
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setIsSettingsOpen(true);
            }}
            className={linkClass(isSettingsActive)}
            title="Settings"
            aria-label="Settings"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Settings size={18} strokeWidth={2} aria-hidden="true" />
            </span>
          </button>
        </nav>
      )}
    </aside>
    </>
  );
}
