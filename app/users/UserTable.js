"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function getCurrentAssetCount(user) {
  const count = Number(user.current_asset_count);
  return Number.isFinite(count) ? count : 0;
}

function OffboardingBadge({ user }) {
  if (!user.offboarding_id) {
    return <Link href={`/users/${user.id}#offboarding`} className="text-xs text-blue-700 underline">
      ลาออก / ตรวจรายการคืน
    </Link>;
  }
  const pending = Number(user.pending_items) || 0;
  const label = user.closed_at
    ? "คืนครบ · ปิดเคส"
    : pending
      ? `ค้าง ${pending} รายการ / ${Number(user.pending_quantity) || 0} ชิ้น`
      : "ตรวจครบ · รอปิดเคส";
  return <Link
    href={`/users/${user.id}#offboarding`}
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
      pending ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
    }`}
  >{label}</Link>;
}

export default function UserTable({ users }) {
  // ==================================================
  // State
  // ==================================================

  // เก็บข้อมูล User ไว้ใน Client
  // เพื่อเปลี่ยนสถานะแล้วหน้าเว็บอัปเดตทันที
  const [userList, setUserList] = useState(users);

  // คำค้นหา
  const [search, setSearch] = useState("");

  // Filter สถานะ
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter Location ของพนักงาน
  const [locationFilter, setLocationFilter] = useState("all");

  // Filter การครอบครอง Asset
  const [assetFilter, setAssetFilter] = useState("all");

  // เก็บ ID ของ User ที่กำลัง Update
  const [updatingId, setUpdatingId] = useState(null);

  // ==================================================
  // Search + Filter
  // ==================================================
  const locationOptions = useMemo(() => {
    const locations = new Map();

    userList.forEach((user) => {
      if (user.location_id != null && user.location_name) {
        const id = String(user.location_id);
        const current = locations.get(id);

        locations.set(id, {
          id,
          name: user.location_name,
          count: (current?.count ?? 0) + 1,
        });
      }
    });

    return {
      locations: [...locations.values()].sort((left, right) =>
        left.name.localeCompare(right.name, "th", { sensitivity: "base" }),
      ),
      amzapCount: userList.filter((user) =>
        ["1", "2"].includes(String(user.location_id)),
      ).length,
      unlocatedCount: userList.filter((user) => user.location_id == null)
        .length,
    };
  }, [userList]);

  const usersBeforeAssetFilter = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return userList.filter((user) => {
      const isActive = user.is_active === true;

      // ------------------------------
      // Search
      // ------------------------------
      const matchSearch =
        !keyword ||
        user.full_name?.toLowerCase().includes(keyword) ||
        user.nickname?.toLowerCase().includes(keyword) ||
        user.employee_code?.toLowerCase().includes(keyword) ||
        user.position?.toLowerCase().includes(keyword) ||
        user.department_name?.toLowerCase().includes(keyword) ||
        user.location_name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword);

      // ------------------------------
      // Filter Status
      // ------------------------------
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      const userLocationId =
        user.location_id == null ? "" : String(user.location_id);
      const matchLocation =
        locationFilter === "all" ||
        (locationFilter === "__amzap__" &&
          ["1", "2"].includes(userLocationId)) ||
        (locationFilter === "__none__" && !userLocationId) ||
        userLocationId === locationFilter;

      return matchSearch && matchStatus && matchLocation;
    });
  }, [userList, search, statusFilter, locationFilter]);

  const filteredUsers = useMemo(() => {
    return usersBeforeAssetFilter.filter((user) => {
      const hasCurrentAssets = getCurrentAssetCount(user) > 0;
      const matchAsset =
        assetFilter === "all" ||
        (assetFilter === "assigned" && hasCurrentAssets) ||
        (assetFilter === "unassigned" && !hasCurrentAssets);

      return matchAsset;
    });
  }, [usersBeforeAssetFilter, assetFilter]);

  const assetSummary = useMemo(() => {
    const assigned = usersBeforeAssetFilter.filter(
      (user) => getCurrentAssetCount(user) > 0,
    ).length;

    return {
      assigned,
      unassigned: usersBeforeAssetFilter.length - assigned,
    };
  }, [usersBeforeAssetFilter]);

  const activeFilterCount = [
    search.trim(),
    statusFilter !== "all",
    locationFilter !== "all",
    assetFilter !== "all",
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setLocationFilter("all");
    setAssetFilter("all");
  }

  // ==================================================
  // เปลี่ยนสถานะ User
  // ==================================================
  async function handleStatusChange(userId, newActivity) {
    try {
      // ป้องกันกดซ้ำระหว่างกำลัง Update
      setUpdatingId(userId);

      const response = await fetch(
        `/api/users/${userId}/status`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            is_active: newActivity === "true",
          }),
        }
      );

      const data = await response.json();

      // ถ้า API ตอบ Error
      if (!response.ok) {
        throw new Error(
          data.error || "ไม่สามารถเปลี่ยนสถานะได้"
        );
      }

      // ==================================================
      // Update ข้อมูลในหน้าเว็บทันที
      // ไม่ต้อง Refresh Browser
      // ==================================================
      setUserList((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                is_active: data.user.is_active,
              }
            : user
        )
      );
    } catch (error) {
      console.error(
        "Update user status error:",
        error
      );

      alert(
        error.message ||
          "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ"
      );
    } finally {
      // เปิด Dropdown ให้ใช้งานอีกครั้ง
      setUpdatingId(null);
    }
  }

  // ==================================================
  // UI
  // ==================================================
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_repeat(3,minmax(0,14rem))]">

        {/* Search */}
        <label className="space-y-1.5 md:col-span-2 xl:col-span-1">
          <span className="block text-xs font-medium text-slate-500">
            ค้นหาพนักงาน
          </span>
          <input
            type="search"
            placeholder="ชื่อ, ชื่อเล่น, รหัส, แผนก..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {/* Filter Status */}
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-slate-500">
            สถานะพนักงาน
          </span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        {/* Filter Location ของพนักงาน */}
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-slate-500">
            Location
          </span>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">ทุก Location ({userList.length})</option>
            <option value="__amzap__">
              AMZAP ทั้งหมด ({locationOptions.amzapCount})
            </option>
            {locationOptions.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.count})
              </option>
            ))}
            {locationOptions.unlocatedCount > 0 && (
              <option value="__none__">
                ยังไม่ระบุ Location ({locationOptions.unlocatedCount})
              </option>
            )}
          </select>
        </label>

        {/* Filter การครอบครอง Asset */}
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-slate-500">
            การครอบครอง Asset
          </span>
          <select
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">ทุกสถานะ Asset</option>
            <option value="assigned">
              มี Asset แล้ว ({assetSummary.assigned})
            </option>
            <option value="unassigned">
              ยังไม่มี Asset ({assetSummary.unassigned})
            </option>
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 md:col-span-2 xl:col-span-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAssetFilter("assigned")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                assetFilter === "assigned"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              มี Asset {assetSummary.assigned} คน
            </button>
            <button
              type="button"
              onClick={() => setAssetFilter("unassigned")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                assetFilter === "unassigned"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              ยังไม่มี Asset {assetSummary.unassigned} คน
            </button>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              ล้าง Filter ทั้งหมด ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ================= RESULT COUNT ================= */}
      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <span>พบ {filteredUsers.length} รายการ</span>
        <span>ทั้งหมด {userList.length} คน</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              ไม่พบข้อมูล
            </p>
          ) : (
            filteredUsers.map((user) => {
              const isActive = user.is_active === true;
              const currentAssetCount = getCurrentAssetCount(user);

              return (
                <article key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-500">
                        {user.employee_code || "-"}
                      </p>
                      <Link
                        href={`/users/${user.id}`}
                        className="mt-1 block break-words font-semibold text-blue-700"
                      >
                        {user.full_name}
                        {user.nickname ? ` (${user.nickname})` : ""}
                      </Link>
                    </div>
                    <select
                      aria-label={`สถานะของ ${user.full_name}`}
                      value={isActive ? "true" : "false"}
                      disabled={updatingId === user.id}
                      onChange={(event) =>
                        handleStatusChange(user.id, event.target.value)
                      }
                      className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-medium ${
                        isActive
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Position</dt>
                      <dd className="mt-0.5 break-words">{user.position || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Department</dt>
                      <dd className="mt-0.5 break-words">{user.department_name || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Location</dt>
                      <dd className="mt-0.5 break-words">{user.location_name || "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Email</dt>
                      <dd className="mt-0.5 break-all">{user.email || "-"}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">
                        Asset ที่ครอบครอง
                      </dt>
                      <dd className="mt-1">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            currentAssetCount > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {currentAssetCount > 0
                            ? `มี Asset ${currentAssetCount.toLocaleString("th-TH")} รายการ`
                            : "ยังไม่มี Asset"}
                        </span>
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">รายการตรวจคืน</dt>
                      <dd className="mt-1"><OffboardingBadge user={user} /></dd>
                    </div>
                  </dl>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">

          <table className="min-w-[1240px] text-sm">

            {/* Header */}
            <thead className="bg-slate-50 text-left">

              <tr>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Employee Code
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Full Name
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Position
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Department
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Location
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Email
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Asset ที่ครอบครอง
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  รายการตรวจคืน
                </th>

                <th className="px-4 py-3 font-semibold text-slate-600">
                  Status
                </th>

              </tr>

            </thead>

            {/* Body */}
            <tbody>

              {filteredUsers.length === 0 ? (

                // ไม่พบข้อมูล
                <tr>

                  <td
                    colSpan="9"
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    ไม่พบข้อมูล
                  </td>

                </tr>

              ) : (

                filteredUsers.map((user) => {
                  // ==================================================
                  // เช็กสถานะ User
                  // ==================================================
                  const isActive = user.is_active === true;
                  const currentAssetCount = getCurrentAssetCount(user);

                  return (
                    <tr
                      key={user.id}
                      className="border-t border-slate-100 transition hover:bg-blue-50/40"
                    >

                      {/* Employee Code */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {user.employee_code || "-"}
                        </span>
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3 font-medium">

                        <Link
                          href={`/users/${user.id}`}
                          className="text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {user.full_name}
                        </Link>

                        {user.nickname && (
                          <p className="mt-1 text-xs text-slate-500">
                            {user.nickname}
                          </p>
                        )}

                      </td>

                      {/* Position */}
                      <td className="px-4 py-3">
                        {user.position || "-"}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3">
                        {user.department_name || "-"}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3">
                        {user.location_name || "-"}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        {user.email || "-"}
                      </td>

                      {/* Current Assets */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            currentAssetCount > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {currentAssetCount > 0
                            ? `${currentAssetCount.toLocaleString("th-TH")} รายการ`
                            : "ยังไม่มี Asset"}
                        </span>
                      </td>

                      {/* ================= STATUS DROPDOWN ================= */}
                      <td className="px-4 py-3">
                        <OffboardingBadge user={user} />
                      </td>

                      <td className="px-4 py-3">

                        <select
                          value={
                            isActive ? "true" : "false"
                          }

                          disabled={
                            updatingId === user.id
                          }

                          onChange={(e) =>
                            handleStatusChange(
                              user.id,
                              e.target.value
                            )
                          }

                          className={`rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition ${
                            isActive
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          } ${
                            updatingId === user.id
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          }`}
                        >

                          <option value="true">
                            Active
                          </option>

                          <option value="false">
                            Inactive
                          </option>

                        </select>

                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
