"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordForm({ mustChangePassword = false }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to change password");
      }

      // Clear all password values immediately after a successful request.
      setForm(initialForm);
      setSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว รหัสใหม่จะใช้ในการ Login ครั้งถัดไป");

      if (mustChangePassword) {
        // The API has refreshed the JWT cookie, so a full navigation now
        // unlocks the normal application routes with the updated session.
        router.replace("/");
        router.refresh();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
      <form onSubmit={submit} className="space-y-5">
        {mustChangePassword && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            บัญชีนี้กำลังใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ก่อนเข้าใช้งานระบบ
          </div>
        )}
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Current Password *</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setField("currentPassword", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>New Password *</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setField("newPassword", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-slate-700">
          <span>Confirm New Password *</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => setField("confirmPassword", event.target.value)}
            className={inputClass}
          />
        </label>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร และมีตัวพิมพ์ใหญ่ A-Z,
          ตัวพิมพ์เล็ก a-z, ตัวเลข และอักขระพิเศษ
        </div>

        {(error || success) && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || success}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "กำลังเปลี่ยนรหัสผ่าน..." : "Change Password"}
        </button>
      </form>
    </section>
  );
}
