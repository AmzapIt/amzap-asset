"use client";

import Link from "next/link";
import { useState } from "react";

export default function Sidebar() {
  // ควบคุมว่าแถบเมนูจะแสดงเต็มหรือย่อเหลือเฉพาะไอคอน
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`${
        isCollapsed ? "w-16 px-2" : "w-56 px-4"
      } min-h-screen shrink-0 border-r bg-white py-6 shadow-sm transition-all duration-200`}
    >
      <div
        className={`${
          isCollapsed ? "justify-center" : "justify-end"
        } -mx-0 flex items-center gap-2 border-b-2 border-gray-200 pb-5`}
      >
        {!isCollapsed && (
          <h1 className="mr-auto text-lg font-bold text-gray-800">
            
          </h1>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          aria-label={isCollapsed ? "Show menu" : "Hide menu"}
          title={isCollapsed ? "Show menu" : "Hide menu"}
        >
          <span className="flex w-5 flex-col gap-1" aria-hidden="true">
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
            <span className="h-0.5 w-full bg-current" />
          </span>
        </button>
      </div>

      {/* เมนูเริ่มใต้เส้นคั่นของส่วนหัว และซ่อนทั้งหมดเมื่อย่อแถบ */}
      {!isCollapsed && (
        <nav className="mt-6 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-md px-3 py-2 font-semibold text-gray-800 hover:bg-gray-100 hover:text-blue-600"
          >
            Dashboard
          </Link>
          <Link
            href="/assets"
            className="rounded-md px-3 py-2 font-semibold text-gray-800 hover:bg-gray-100 hover:text-blue-600"
          >
            Asset List
          </Link>
        </nav>
      )}
    </aside>
  );
}
