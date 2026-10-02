"use client";

import { useId, useState } from "react";
import { formatUserDisplayName } from "@/lib/user-display";
import { searchEmployees } from "@/lib/employee-search";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function employeeLabel(user) {
  return [user.employee_code, formatUserDisplayName(user)].filter(Boolean).join(" — ");
}

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
  const listId = `${inputId}-results`;
  const [internalId, setInternalId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedId = value === undefined ? internalId : String(value ?? "");
  const selectedUser = users.find((user) => String(user.id) === selectedId);
  const matches = selectedId
    ? selectedUser ? [selectedUser] : []
    : searchEmployees(users, searchText);
  const visibleMatches = matches.slice(0, 5);

  function updateSelection(id, user) {
    if (value === undefined) setInternalId(id);
    onChange?.(id);
    onSelect?.(user);
  }

  function choose(user) {
    updateSelection(String(user.id), user);
    setSearchText("");
    setIsOpen(false);
  }

  function clear() {
    updateSelection("", null);
    setSearchText("");
    setActiveIndex(0);
    setIsOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => event.key === "ArrowDown"
        ? Math.min(isOpen ? index + 1 : 0, Math.max(visibleMatches.length - 1, 0))
        : Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && isOpen && visibleMatches.length > 0) {
      event.preventDefault();
      choose(visibleMatches[activeIndex] ?? visibleMatches[0]);
    }
  }

  return (
    <div
      className={`relative block text-sm font-medium text-slate-700 ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          if (!selectedId) setSearchText("");
        }
      }}
    >
      <label htmlFor={inputId}>{label}{required && <span className="text-red-600"> *</span>}</label>
      {name && <input type="hidden" name={name} value={selectedId} />}
      <div className="relative">
        <input
          id={inputId}
          type="search"
          value={selectedId && selectedUser ? employeeLabel(selectedUser) : searchText}
          onChange={(event) => {
            setSearchText(event.target.value);
            updateSelection("", null);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={(event) => {
            setIsOpen(true);
            if (selectedId) event.currentTarget.select();
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={isOpen && visibleMatches.length > 0 ? `${listId}-${activeIndex}` : undefined}
          aria-required={required}
          autoComplete="off"
          disabled={disabled}
          placeholder="ค้นหาชื่อ ชื่อเล่น หรือ Employee Code"
          className={`${inputClass} ${selectedId || searchText ? "pr-16" : ""}`}
        />
        {(selectedId || searchText) && !disabled && (
          <button
            type="button"
            aria-label={`ล้าง${label}`}
            onClick={clear}
            className="absolute inset-y-0 right-2 mt-1 px-2 text-xs text-slate-500 hover:text-slate-900"
          >
            ล้าง
          </button>
        )}
      </div>
      {isOpen && !disabled && (
        <div id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {visibleMatches.length === 0 ? (
            <p className="px-3 py-2 text-sm font-normal text-slate-500">ไม่พบพนักงาน</p>
          ) : visibleMatches.map((user, index) => (
            <button
              key={user.id}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={String(user.id) === selectedId}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(user);
              }}
              onClick={() => choose(user)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm font-normal hover:bg-blue-50 ${index === activeIndex ? "bg-blue-50" : ""}`}
            >
              <span className="font-medium text-slate-900">{employeeLabel(user)}</span>
              {user.is_active === false && <span className="ml-1 text-xs text-amber-700">(Inactive)</span>}
            </button>
          ))}
          {matches.length > visibleMatches.length && (
            <p className="px-3 py-2 text-xs font-normal text-slate-500">พบ {matches.length} คน · พิมพ์เพิ่มเพื่อเจาะจง</p>
          )}
        </div>
      )}
      {!required && !selectedId && !searchText && <p className="mt-1 text-xs font-normal text-slate-500">{emptyLabel}</p>}
    </div>
  );
}
