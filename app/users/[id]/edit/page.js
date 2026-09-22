"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [form, setForm] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    position: "",
    department_id: "",
    is_active: "true",
  });

  const [departments, setDepartments] = useState([]);

  // Department เดิม
  // ใช้กรณีถูก Inactive ไปแล้ว
  const [currentDepartment, setCurrentDepartment] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  // =========================================================
  // โหลด Employee + Departments
  // =========================================================
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setMessage("");

        const [userResponse, departmentResponse] = await Promise.all([
          fetch(`/api/users/${id}`, {
            signal: controller.signal,
          }),

          fetch("/api/master/departments", {
            signal: controller.signal,
          }),
        ]);

        const userData = await userResponse.json();

        const departmentData = await departmentResponse.json();

        if (!userResponse.ok || !userData.success) {
          throw new Error(userData.error || "ไม่สามารถโหลดข้อมูลพนักงานได้");
        }

        if (!departmentResponse.ok) {
          throw new Error(
            departmentData.error || "ไม่สามารถโหลด Department ได้",
          );
        }

        const user = userData.user;

        setForm({
          employee_code: user.employee_code || "",

          full_name: user.full_name || "",

          email: user.email || "",

          position: user.position || "",

          department_id:
            user.department_id != null ? String(user.department_id) : "",

          is_active: String(user.is_active),
        });

        // =================================================
        // Active Departments
        // =================================================
        const activeDepartments = (departmentData.rows || [])
          .filter((department) => department.is_active)
          .sort((a, b) => Number(a.id) - Number(b.id));

        setDepartments(activeDepartments);

        // =================================================
        // ถ้า Department เดิมถูก Inactive
        // ให้ยังแสดงใน Dropdown
        // =================================================
        if (
          user.department_id != null &&
          !activeDepartments.some(
            (department) =>
              String(department.id) === String(user.department_id),
          )
        ) {
          setCurrentDepartment({
            id: user.department_id,
            name: user.department_name || `Department ID ${user.department_id}`,
          });
        } else {
          setCurrentDepartment(null);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setMessage(error.message || "ไม่สามารถโหลดข้อมูลได้");
        }
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    }

    return () => controller.abort();
  }, [id]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // =========================================================
  // Save
  // =========================================================
  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถแก้ไขพนักงานได้");
      }

      window.alert("แก้ไขข้อมูลพนักงานเรียบร้อย");

      router.push(`/users/${id}`);
    } catch (error) {
      setMessage(error.message || "ไม่สามารถแก้ไขพนักงานได้");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-bold">Edit Employee</h1>

        <p className="mt-2 text-gray-500">แก้ไขข้อมูลพนักงาน</p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-medium">Employee Code</label>

              <input
                name="employee_code"
                value={form.employee_code}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Full Name *</label>

              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Email</label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Position</label>

              <input
                name="position"
                value={form.position}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Department</label>

              <select
                name="department_id"
                value={form.department_id}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">-- ไม่ระบุ Department --</option>

                {/* Department เดิมที่ Inactive */}
                {currentDepartment && (
                  <option value={String(currentDepartment.id)}>
                    {currentDepartment.name} (Inactive)
                  </option>
                )}

                {/* Active Departments */}
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.department_code
                      ? `${department.department_code} - ${department.name}`
                      : department.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-medium">Status</label>

              <select
                name="is_active"
                value={form.is_active}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="true">Active</option>

                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {message && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-red-700">
              {message}
            </p>
          )}

          <div className="mt-6 flex justify-between">
            <Link href={`/users/${id}`} className="rounded-lg border px-5 py-3">
              Back
            </Link>

            <button
              disabled={saving}
              className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
