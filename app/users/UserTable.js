"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

  // เก็บ ID ของ User ที่กำลัง Update
  const [updatingId, setUpdatingId] = useState(null);

  // ==================================================
  // Search + Filter
  // ==================================================
  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return userList.filter((user) => {
      const isActive =
        user.is_active === true &&
        Number(user.status) === 1;

      // ------------------------------
      // Search
      // ------------------------------
      const matchSearch =
        !keyword ||
        user.full_name?.toLowerCase().includes(keyword) ||
        user.employee_code?.toLowerCase().includes(keyword) ||
        user.position?.toLowerCase().includes(keyword) ||
        user.department_name?.toLowerCase().includes(keyword) ||
        user.email?.toLowerCase().includes(keyword);

      // ------------------------------
      // Filter Status
      // ------------------------------
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchSearch && matchStatus;
    });
  }, [userList, search, statusFilter]);

  // ==================================================
  // เปลี่ยนสถานะ User
  // ==================================================
  async function handleStatusChange(userId, newStatus) {
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
            status: Number(newStatus),
          }),
        }
      );

      const data = await response.json();

      // ถ้า API ตอบ Error
      if (!response.ok) {
        throw new Error(
          data.message || "ไม่สามารถเปลี่ยนสถานะได้"
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
                status: data.user.status,
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

      {/* ================= SEARCH / FILTER ================= */}
      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow md:flex-row">

        {/* Search */}
        <input
          type="text"
          placeholder="ค้นหาชื่อ, รหัสพนักงาน, ตำแหน่ง, แผนก, Email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500"
        />

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
          className="rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-blue-500 md:w-48"
        >
          <option value="all">
            ทุกสถานะ
          </option>

          <option value="active">
            Active
          </option>

          <option value="inactive">
            Inactive
          </option>
        </select>

      </div>

      {/* ================= RESULT COUNT ================= */}
      <div className="text-sm text-gray-500">
        พบ {filteredUsers.length} รายการ
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-hidden rounded-xl bg-white shadow">

        <div className="overflow-x-auto">

          <table className="min-w-full text-sm">

            {/* Header */}
            <thead className="bg-gray-50 text-left">

              <tr>

                <th className="px-4 py-3 font-semibold text-gray-600">
                  Employee Code
                </th>

                <th className="px-4 py-3 font-semibold text-gray-600">
                  Full Name
                </th>

                <th className="px-4 py-3 font-semibold text-gray-600">
                  Position
                </th>

                <th className="px-4 py-3 font-semibold text-gray-600">
                  Department
                </th>

                <th className="px-4 py-3 font-semibold text-gray-600">
                  Email
                </th>

                <th className="px-4 py-3 font-semibold text-gray-600">
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
                    colSpan="6"
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
                  const isActive =
                    user.is_active === true &&
                    Number(user.status) === 1;

                  return (
                    <tr
                      key={user.id}
                      className="border-t hover:bg-gray-50"
                    >

                      {/* Employee Code */}
                      <td className="px-4 py-3">
                        {user.employee_code || "-"}
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-3 font-medium">

                        <Link
                          href={`/users/${user.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {user.full_name}
                        </Link>

                      </td>

                      {/* Position */}
                      <td className="px-4 py-3">
                        {user.position || "-"}
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3">
                        {user.department_name || "-"}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        {user.email || "-"}
                      </td>

                      {/* ================= STATUS DROPDOWN ================= */}
                      <td className="px-4 py-3">

                        <select
                          value={
                            isActive ? "1" : "0"
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

                          className={`rounded-lg border px-3 py-2 text-sm font-medium outline-none ${
                            isActive
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          } ${
                            updatingId === user.id
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          }`}
                        >

                          <option value="1">
                            Active
                          </option>

                          <option value="0">
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