"use client";

import { useId, useState } from "react";
import { formatEmployeeOptionLabel, orderEmployeesByCompany } from "@/lib/user-display";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

// Preserve string IDs, controlled/uncontrolled callers, and native FormData.
export default function EmployeePicker({
  name,
  label,
  users,
  value,
  onChange,
  onSelect,
  required = false,
  disabled = false,
  emptyLabel = "ไม่ระบุพนักงาน",
  className = "",
}) {
  const inputId = useId();
  const [internalId, setInternalId] = useState("");
  const selectedId = value === undefined ? internalId : String(value ?? "");
  const selectedUser = users.find((user) => String(user.id) === selectedId);

  return (
    <div className={`block text-sm font-medium text-slate-700 ${className}`}>
      <label htmlFor={inputId}>{label}{required && <span className="text-red-600"> *</span>}</label>
      <select
        id={inputId}
        name={name}
        value={selectedId}
        required={required}
        disabled={disabled}
        className={`${inputClass} ${selectedUser?.is_active === false ? "text-slate-500" : "text-slate-900"}`}
        onChange={(event) => {
          const id = event.target.value;
          if (value === undefined) setInternalId(id);
          onChange?.(id);
          onSelect?.(users.find((user) => String(user.id) === id) ?? null);
        }}
      >
        <option value="">{required ? "เลือกพนักงาน" : emptyLabel}</option>
        {selectedId && !selectedUser && (
          <option value={selectedId} disabled>ไม่พบพนักงานในรายการ (ID: {selectedId})</option>
        )}
        {orderEmployeesByCompany(users).map((user) => (
          <option key={user.id} value={String(user.id)} style={{ color: user.is_active === false ? "#64748b" : "#0f172a" }}>
            {formatEmployeeOptionLabel(user)}{user.is_active === false ? " (Inactive)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
