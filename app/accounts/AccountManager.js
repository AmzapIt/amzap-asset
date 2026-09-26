"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const roles = ["Admin", "IT Staff", "Read-only"];

const emptyForm = {
  email: "",
  username: "",
  displayName: "",
  role: "Read-only",
  isActive: true,
  userId: "",
  password: "",
  confirmPassword: "",
};

function employeeLabel(employee) {
  const nickname = employee.nickname ? ` (${employee.nickname})` : "";
  const code = employee.employee_code ? `${employee.employee_code} — ` : "";
  return `${code}${employee.full_name}${nickname}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AccountManager({
  initialAccounts,
  employees,
  currentAccountId,
}) {
  const router = useRouter();
  const accounts = initialAccounts;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetId, setResetId] = useState(null);
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [resetting, setResetting] = useState(false);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !keyword ||
        account.email.toLowerCase().includes(keyword) ||
        account.username?.toLowerCase().includes(keyword) ||
        account.display_name.toLowerCase().includes(keyword) ||
        account.employee_code?.toLowerCase().includes(keyword) ||
        account.employee_name?.toLowerCase().includes(keyword) ||
        account.employee_nickname?.toLowerCase().includes(keyword);
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && account.is_active) ||
        (statusFilter === "inactive" && !account.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, search, statusFilter]);

  const selectableEmployees = useMemo(() => {
    const occupied = new Set(
      accounts
        .filter((account) => account.id !== editingId && account.user_id)
        .map((account) => account.user_id),
    );

    return employees.filter(
      (employee) =>
        !occupied.has(employee.id) &&
        (employee.is_active || employee.id === form.userId),
    );
  }, [accounts, editingId, employees, form.userId]);

  const activeCount = accounts.filter((account) => account.is_active).length;
  const adminCount = accounts.filter(
    (account) => account.is_active && account.role === "Admin",
  ).length;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  function startEdit(account) {
    setEditingId(account.id);
    setForm({
      email: account.email,
      username: account.username || "",
      displayName: account.display_name,
      role: account.role,
      isActive: account.is_active,
      userId: account.user_id || "",
      password: "",
      confirmPassword: "",
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function readJson(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function submitAccount(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingId ? `/api/accounts/${editingId}` : "/api/accounts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      await readJson(response);

      setMessage(editingId ? "บันทึกบัญชีเรียบร้อยแล้ว" : "สร้างบัญชีเรียบร้อยแล้ว");
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openReset(accountId) {
    setResetId(accountId);
    setResetForm({ password: "", confirmPassword: "" });
    setError("");
    setMessage("");
  }

  async function submitReset(event) {
    event.preventDefault();
    setResetting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/accounts/${resetId}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resetForm),
        },
      );
      await readJson(response);
      setResetId(null);
      setResetForm({ password: "", confirmPassword: "" });
      setMessage("รีเซ็ตรหัสผ่านเรียบร้อยแล้ว");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResetting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["บัญชีทั้งหมด", accounts.length, "text-slate-900"],
          ["Active", activeCount, "text-emerald-600"],
          ["Active Admin", adminCount, "text-blue-700"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {editingId ? "Edit System Account" : "Add System Account"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              บัญชี Login แยกจากข้อมูลพนักงาน และเลือกผูกกับพนักงานได้หนึ่งคนต่อหนึ่งบัญชี
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        <form onSubmit={submitAccount} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Email *</span>
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Username</span>
            <input
              type="text"
              minLength={3}
              maxLength={100}
              pattern="[a-z0-9._-]+"
              placeholder="optional-login-name"
              autoComplete="off"
              value={form.username}
              onChange={(event) => setField("username", event.target.value.toLowerCase())}
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Display Name *</span>
            <input
              type="text"
              required
              maxLength={255}
              value={form.displayName}
              onChange={(event) => setField("displayName", event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Role *</span>
            <select
              value={form.role}
              onChange={(event) => setField("role", event.target.value)}
              className={inputClass}
            >
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            <span>Linked Employee</span>
            <select
              value={form.userId}
              onChange={(event) => setField("userId", event.target.value)}
              className={inputClass}
            >
              <option value="">ไม่ผูกกับพนักงาน</option>
              {selectableEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeLabel(employee)}
                  {!employee.is_active ? " [Inactive]" : ""}
                  {employee.location_name ? ` — ${employee.location_name}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setField("isActive", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active account
          </label>

          {!editingId && (
            <>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Password *</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span>Confirm Password *</span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => setField("confirmPassword", event.target.value)}
                  className={inputClass}
                />
              </label>
              <p className="self-end text-xs leading-5 text-slate-500">
                อย่างน้อย 12 ตัว และมี A-Z, a-z, ตัวเลข และอักขระพิเศษ
              </p>
            </>
          )}

          <div className="md:col-span-2 xl:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : editingId ? "Save Account" : "Create Account"}
            </button>
          </div>
        </form>
      </section>

      {(error || message) && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      {resetId && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-amber-950">Reset Password</h2>
          <p className="mt-1 text-sm text-amber-800">
            ตั้งรหัสผ่านชั่วคราวให้บัญชีที่เลือก ระบบจะไม่แสดงรหัสผ่านนี้อีก
          </p>
          <form onSubmit={submitReset} className="mt-4 grid gap-4 md:grid-cols-2">
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="New password"
              value={resetForm.password}
              onChange={(event) =>
                setResetForm((current) => ({ ...current, password: event.target.value }))
              }
              className={inputClass}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={resetForm.confirmPassword}
              onChange={(event) =>
                setResetForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              className={inputClass}
            />
            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={resetting}
                className="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {resetting ? "กำลังรีเซ็ต..." : "Confirm Reset"}
              </button>
              <button
                type="button"
                onClick={() => setResetId(null)}
                className="rounded-lg border border-amber-300 px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px]">
          <input
            type="search"
            placeholder="ค้นหา Email, ชื่อบัญชี หรือพนักงาน..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClass}
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className={inputClass}
          >
            <option value="all">ทุก Role</option>
            {roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Linked Employee</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                      ไม่พบบัญชี
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr key={account.id} className="border-t border-slate-100 hover:bg-blue-50/30">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {account.display_name}
                          {account.id === currentAccountId && (
                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">You</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{account.email}</p>
                        {account.username && (
                          <p className="mt-1 font-mono text-xs text-blue-700">
                            @{account.username}
                          </p>
                        )}
                        {account.must_change_password && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Password change required
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {account.employee_name ? (
                          <>
                            <p className="font-medium text-slate-800">
                              {account.employee_name}
                              {account.employee_nickname ? ` (${account.employee_nickname})` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {account.employee_code || "ไม่มีรหัสพนักงาน"}
                              {account.employee_is_active === false ? " · Inactive employee" : ""}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">Not linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{account.role}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          account.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {account.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(account.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(account)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          {account.id !== currentAccountId && (
                            <button
                              type="button"
                              onClick={() => openReset(account.id)}
                              className="rounded-lg border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 hover:bg-amber-50"
                            >
                              Reset Password
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="px-1 text-xs text-slate-500">
          พบ {filteredAccounts.length} จาก {accounts.length} บัญชี · การเปลี่ยน Role จะแสดงครบทุกส่วนหลังผู้ใช้ออกจากระบบและ Login ใหม่
        </p>
      </section>
    </div>
  );
}
