"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  MapPin,
  Package,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export default function Sidebar({ user }) {
  // =========================================================
  // Sidebar state
  // =========================================================
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

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
    { href: "/accessories", label: "Accessory Summary", icon: Package },
    { href: "/users", label: "User Management", icon: Users },
    { href: "/reports", label: "Export / ใบรับมอบ", icon: Download },
  ];

  function isActive(href) {
    return href === "/" ? pathname === href : pathname.startsWith(href);
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
    <aside
      className={`${
        isCollapsed ? "w-16 px-2" : "w-56 px-4"
      } min-h-screen shrink-0 border-r border-slate-200 bg-white py-6 shadow-sm transition-all duration-200`}
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
            {navItems.slice(0, -1).map((item) => (
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

            <Link href="/reports" className={linkClass(isActive("/reports"))}>
              Export / ใบรับมอบ
            </Link>
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
          {navItems.map((item) => (
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
        </nav>
      )}
    </aside>
  );
}
