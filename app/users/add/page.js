"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100";

const initialForm = {
  employee_code: "",
  full_name: "",
  full_name_en: "",
  nickname: "",
  nickname_en: "",
  email: "",
  position: "",
  department_id: "",
  location_id: "",
  is_active: "true",
};

export default function AddUserPage() {
  const router = useRouter();

  const [form, setForm] = useState(initialForm);

  const [departments, setDepartments] =
    useState([]);

  const [locations, setLocations] = useState([]);

  const [loadingDepartments, setLoadingDepartments] =
    useState(true);

  const [loadingLocations, setLoadingLocations] = useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  // =========================================================
  // โหลด Department Master
  // =========================================================
  useEffect(() => {
    const controller = new AbortController();

    async function loadMasterData() {
      try {
        setLoadingDepartments(true);
        setLoadingLocations(true);

        const [departmentResponse, locationResponse] = await Promise.all([
          fetch("/api/master/departments", { signal: controller.signal }),
          fetch("/api/master/locations", { signal: controller.signal }),
        ]);

        const [departmentData, locationData] = await Promise.all([
          departmentResponse.json(),
          locationResponse.json(),
        ]);

        if (!departmentResponse.ok) {
          throw new Error(
            departmentData.error ||
              "ไม่สามารถโหลด Department ได้"
          );
        }

        if (!locationResponse.ok) {
          throw new Error(locationData.error || "ไม่สามารถโหลด Location ได้");
        }

        // Employee ใหม่เลือกได้เฉพาะ Active
        const activeDepartments = (
          departmentData.rows || []
        )
          .filter(
            (department) =>
              department.is_active
          )
          .sort(
            (a, b) =>
              Number(a.id) - Number(b.id)
          );

        setDepartments(activeDepartments);

        const activeLocations = (locationData.rows || [])
          .filter((location) => location.is_active)
          .sort((a, b) => Number(a.id) - Number(b.id));

        setLocations(activeLocations);
      } catch (error) {
        if (error.name !== "AbortError") {
          setMessage(error.message);
        }
      } finally {
        setLoadingDepartments(false);
        setLoadingLocations(false);
      }
    }

    loadMasterData();

    return () => controller.abort();
  }, []);

  // =========================================================
  // Input Change
  // =========================================================
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

      const response = await fetch(
        "/api/users",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "ไม่สามารถเพิ่มพนักงานได้"
        );
      }

      window.alert(
        "เพิ่มพนักงานเรียบร้อย"
      );

      // ไปหน้า Detail ของ User ที่เพิ่งสร้าง
      router.push(
        `/users/${data.user.id}`
      );
    } catch (error) {
      setMessage(
        error.message ||
          "ไม่สามารถเพิ่มพนักงานได้"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Add Employee
          </h1>

          <p className="mt-2 text-gray-500">
            เพิ่มข้อมูลพนักงานใหม่
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Employee Code */}
            <div>
              <label className="mb-2 block font-medium">
                Employee Code
              </label>

              <input
                name="employee_code"
                value={form.employee_code}
                onChange={handleChange}
                className={inputClass}
                placeholder="เช่น EMP001"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="mb-2 block font-medium">
                Full Name (Thai)
                <span className="text-red-600">
                  {" "}*
                </span>
              </label>

              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Full Name (English)</label>
              <input
                name="full_name_en"
                value={form.full_name_en}
                onChange={handleChange}
                maxLength={200}
                className={inputClass}
              />
            </div>

            {/* Nickname */}
            <div>
              <label className="mb-2 block font-medium">
                Nickname (Thai)
              </label>

              <input
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">Nickname (English)</label>
              <input
                name="nickname_en"
                value={form.nickname_en}
                onChange={handleChange}
                maxLength={100}
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block font-medium">
                Email
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* Position */}
            <div>
              <label className="mb-2 block font-medium">
                Position
              </label>

              <input
                name="position"
                value={form.position}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            {/* Department */}
            <div>
              <label className="mb-2 block font-medium">
                Department
              </label>

              <select
                name="department_id"
                value={form.department_id}
                onChange={handleChange}
                disabled={loadingDepartments}
                className={inputClass}
              >
                <option value="">
                  {loadingDepartments
                    ? "กำลังโหลด..."
                    : "-- ไม่ระบุ Department --"}
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department.id}
                      value={String(
                        department.id
                      )}
                    >
                      {department.department_code
                        ? `${department.department_code} - ${department.name}`
                        : department.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="mb-2 block font-medium">
                Location
              </label>

              <select
                name="location_id"
                value={form.location_id}
                onChange={handleChange}
                disabled={loadingLocations}
                className={inputClass}
              >
                <option value="">
                  {loadingLocations
                    ? "กำลังโหลด..."
                    : "-- ไม่ระบุ Location --"}
                </option>

                {locations.map((location) => (
                  <option key={location.id} value={String(location.id)}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-2 block font-medium">
                Status
              </label>

              <select
                name="is_active"
                value={form.is_active}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="true">
                  Active
                </option>

                <option value="false">
                  Inactive
                </option>
              </select>
            </div>
          </div>

          {message && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-3 text-red-700"
            >
              {message}
            </p>
          )}

          <div className="mt-6 flex justify-between">
            <Link
              href="/users"
              className="rounded-lg border border-gray-300 px-5 py-3"
            >
              Back
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Employee"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
