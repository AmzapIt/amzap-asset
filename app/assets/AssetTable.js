"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ASSET_LIST_STORAGE_KEY = "amzap:asset-list-state:v1";
const DEFAULT_SORT_CONFIG = {
  key: "asset_code",
  direction: "asc",
};
const SORT_KEYS = new Set([
  "asset_code",
  "asset_type",
  "serial_number",
  "brand_model",
  "current_holder",
  "location",
  "status",
  "received_date",
]);

function storedText(value) {
  return typeof value === "string" && value.length <= 500 ? value : "";
}

// ==================================================
// 1. สีของ Status
// ใช้แสดงสถานะให้อ่านง่ายขึ้น
// ==================================================
const statusColors = {
  "In Stock": "bg-blue-100 text-blue-800",
  "In Use": "bg-green-100 text-green-800",
  Repair: "bg-yellow-100 text-yellow-800",
  Spare: "bg-purple-100 text-purple-800",
  Retired: "bg-gray-200 text-gray-700",
  Disposed: "bg-gray-200 text-gray-700",
  Lost: "bg-red-100 text-red-800",
};

const sortText = (left, right) =>
  String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });

function getOptionCounts(assets, key) {
  return assets.reduce((counts, asset) => {
    const value = asset[key];

    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    return counts;
  }, new Map());
}

function toSortableDate(value) {
  if (!value) {
    return "";
  }

  const parts = String(value).split("/");

  if (parts.length !== 3) {
    return String(value);
  }

  const [day, month, year] = parts;

  return `${year}-${month}-${day}`;
}

function PhotoStatus({ hasPhoto }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        hasPhoto
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-100 text-slate-500"
      }`}
      aria-label={hasPhoto ? "มีรูป Asset แล้ว" : "ยังไม่มีรูป Asset"}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          hasPhoto ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {hasPhoto ? "มีรูป" : "ยังไม่มีรูป"}
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = "",
}) {
  const icon =
    sortConfig.key !== sortKey
      ? "↕"
      : sortConfig.direction === "asc"
        ? "↑"
        : "↓";

  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500 ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 rounded transition hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <span>{label}</span>
        <span
          className={
            sortConfig.key === sortKey ? "text-blue-600" : "text-slate-400"
          }
        >
          {icon}
        </span>
      </button>
    </th>
  );
}

// ==================================================
// 2. Component รับข้อมูลจากหน้า Assets
// assets คือ Array ที่ PostgreSQL ส่งมา
// ==================================================
export default function AssetTable({ assets }) {
  // เก็บข้อความที่ผู้ใช้พิมพ์ค้นหา
  const [searchText, setSearchText] = useState("");

  // เก็บประเภทที่เลือก เช่น Monitor
  const [selectedType, setSelectedType] = useState("");

  // เก็บสถานะที่เลือก เช่น In Use
  const [selectedStatus, setSelectedStatus] = useState("");

  // Location และสถานะการครอบครองช่วยแยกรายการที่ต้องติดตามได้เร็วขึ้น
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedHolder, setSelectedHolder] = useState("");

  // ป้องกันค่าเริ่มต้นเขียนทับ sessionStorage ก่อนอ่านค่าที่เคยใช้เสร็จ
  const [hasRestoredFilters, setHasRestoredFilters] = useState(false);

  // ==================================================
  // เก็บข้อมูลการเรียง
  //
  // ค่าเริ่มต้น:
  // asset_code จากน้อยไปมาก
  // ==================================================
  const [sortConfig, setSortConfig] = useState(DEFAULT_SORT_CONFIG);

  // ใช้เปลี่ยนหน้าเมื่อผู้ใช้คลิกแถว
  const router = useRouter();

  // จำ Search / Filter / Sort ภายใน Browser tab เดิม เมื่อออกไปหน้าอื่นแล้วกลับมา
  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const storedValue = window.sessionStorage.getItem(
          ASSET_LIST_STORAGE_KEY,
        );

        if (storedValue) {
          const stored = JSON.parse(storedValue);

          if (stored && typeof stored === "object" && !Array.isArray(stored)) {
            setSearchText(storedText(stored.searchText));
            setSelectedType(storedText(stored.selectedType));
            setSelectedStatus(storedText(stored.selectedStatus));
            setSelectedLocation(storedText(stored.selectedLocation));
            setSelectedHolder(
              ["", "assigned", "unassigned"].includes(stored.selectedHolder)
                ? stored.selectedHolder
                : "",
            );

            if (
              stored.sortConfig &&
              SORT_KEYS.has(stored.sortConfig.key) &&
              ["asc", "desc"].includes(stored.sortConfig.direction)
            ) {
              setSortConfig({
                key: stored.sortConfig.key,
                direction: stored.sortConfig.direction,
              });
            }
          }
        }
      } catch (error) {
        console.warn("Restore Asset filters error:", error);
        window.sessionStorage.removeItem(ASSET_LIST_STORAGE_KEY);
      } finally {
        setHasRestoredFilters(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hasRestoredFilters) return;

    try {
      window.sessionStorage.setItem(
        ASSET_LIST_STORAGE_KEY,
        JSON.stringify({
          searchText,
          selectedType,
          selectedStatus,
          selectedLocation,
          selectedHolder,
          sortConfig,
        }),
      );
    } catch (error) {
      console.warn("Save Asset filters error:", error);
    }
  }, [
    hasRestoredFilters,
    searchText,
    selectedHolder,
    selectedLocation,
    selectedStatus,
    selectedType,
    sortConfig,
  ]);

  // ==================================================
  // 3. สร้างตัวเลือก Filter และจำนวนรายการจากข้อมูลจริง
  // เมื่อเพิ่ม Type, Status หรือ Location ใหม่ Dropdown จะอัปเดตตามข้อมูลอัตโนมัติ
  // ==================================================
  const filterOptions = useMemo(() => {
    const typeCounts = getOptionCounts(assets, "asset_type");
    const statusCounts = getOptionCounts(assets, "status");
    const locationCounts = getOptionCounts(assets, "location");
    const knownStatuses = Object.keys(statusColors).filter((status) =>
      statusCounts.has(status),
    );
    const additionalStatuses = [...statusCounts.keys()]
      .filter((status) => !statusColors[status])
      .sort(sortText);

    return {
      types: [...typeCounts.keys()].sort(sortText),
      statuses: [...knownStatuses, ...additionalStatuses],
      locations: [...locationCounts.keys()].sort(sortText),
      typeCounts,
      statusCounts,
      locationCounts,
      assignedCount: assets.filter((asset) => Boolean(asset.current_holder))
        .length,
      unlocatedCount: assets.filter((asset) => !asset.location).length,
    };
  }, [assets]);

  // ==================================================
  // 4. กรองข้อมูลด้วย JavaScript
  // ไม่ได้แก้หรือลบข้อมูลใน PostgreSQL
  // ==================================================
  const filteredAssets = useMemo(() => {
    // แปลงคำค้นหาเพียงครั้งเดียวต่อการเปลี่ยน Filter
    const keyword = searchText.toLowerCase().trim();

    return assets.filter((asset) => {
      // ค้นหาจากหลาย Field และยังรองรับรหัส Asset เดิม
      const matchesSearch =
        !keyword ||
        [
          asset.asset_code,
          asset.legacy_asset_codes,
          asset.asset_type,
          asset.asset_name,
          asset.brand,
          asset.model,
          asset.serial_number,
          asset.owner_name,
          asset.current_holder,
          asset.location,
          asset.department,
          asset.status,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(keyword)
        );

    // ถ้ายังไม่เลือกประเภท ให้ผ่านทั้งหมด
    const matchesType =
      !selectedType ||
      asset.asset_type === selectedType;

    // ถ้ายังไม่เลือกสถานะ ให้ผ่านทั้งหมด
    const matchesStatus =
      !selectedStatus ||
      asset.status === selectedStatus;

    const matchesLocation =
      !selectedLocation ||
      (selectedLocation === "__none__" && !asset.location) ||
      asset.location === selectedLocation;

    const hasHolder = Boolean(asset.current_holder);
    const matchesHolder =
      !selectedHolder ||
      (selectedHolder === "assigned" && hasHolder) ||
      (selectedHolder === "unassigned" && !hasHolder);

    // ต้องตรงกับเงื่อนไขทั้งหมด
    return (
      matchesSearch &&
      matchesType &&
      matchesStatus &&
      matchesLocation &&
      matchesHolder
    );
    });
  }, [
    assets,
    searchText,
    selectedHolder,
    selectedLocation,
    selectedStatus,
    selectedType,
  ]);

  // ==================================================
  // 5. ฟังก์ชันแปลงวันที่
  //
  // หน้า Assets รับวันที่มาเป็น:
  // dd/mm/yyyy
  //
  // เช่น:
  // 18/09/2026
  //
  // ตอน Sort ต้องแปลงเป็น:
  // 2026-09-18
  // ==================================================
  // ==================================================
  // 6. เรียงข้อมูลหลัง Search / Filter
  // ==================================================
  const sortedAssets = useMemo(
    () =>
      [...filteredAssets].sort((a, b) => {
      const key = sortConfig.key;

      let valueA;
      let valueB;

      // ==================================================
      // Brand / Model
      //
      // ใช้ค่ารวมเหมือนที่หน้า Table แสดงจริง
      // ==================================================
      if (key === "brand_model") {
        valueA = [a.brand, a.model]
          .filter(Boolean)
          .join(" ");

        valueB = [b.brand, b.model]
          .filter(Boolean)
          .join(" ");
      }

      // ==================================================
      // วันที่รับเข้า
      // ==================================================
      else if (key === "received_date") {
        valueA = toSortableDate(
          a.received_date
        );

        valueB = toSortableDate(
          b.received_date
        );
      }

      // ==================================================
      // Field ปกติ
      // ==================================================
      else {
        valueA = a[key];
        valueB = b[key];
      }

      // null / undefined ให้เป็นข้อความว่าง
      valueA = valueA ?? "";
      valueB = valueB ?? "";

      // ==================================================
      // localeCompare + numeric
      //
      // ทำให้:
      // 001
      // 002
      // 010
      //
      // เรียงถูกต้อง
      // ==================================================
      const result = String(valueA).localeCompare(
        String(valueB),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      );

      return sortConfig.direction === "asc"
        ? result
        : -result;
      }),
    [filteredAssets, sortConfig],
  );

  // ==================================================
  // 7. เมื่อกดหัวตาราง
  //
  // กดครั้งแรก:
  // ASC
  //
  // กดซ้ำ:
  // DESC
  // ==================================================
  function handleSort(key) {
    setSortConfig((previous) => {
      // ถ้ากด Column เดิม
      if (previous.key === key) {
        return {
          key,
          direction:
            previous.direction === "asc"
              ? "desc"
              : "asc",
        };
      }

      // ถ้าเปลี่ยนไป Column ใหม่
      // เริ่มจาก ASC
      return {
        key,
        direction: "asc",
      };
    });
  }

  const sortableHeaderProps = { sortConfig, onSort: handleSort };

  const activeFilterCount = [
    searchText.trim(),
    selectedType,
    selectedStatus,
    selectedLocation,
    selectedHolder,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearchText("");
    setSelectedType("");
    setSelectedStatus("");
    setSelectedLocation("");
    setSelectedHolder("");
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* ==========================================
          SEARCH & FILTER
      ========================================== */}
      <div className="border-b border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">ค้นหาและกรอง Asset</h2>
            <p className="mt-1 text-sm text-slate-500">
              เลือกหลายเงื่อนไขพร้อมกัน ระบบจะจำค่าไว้เมื่อกลับมาหน้านี้
            </p>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-500 sm:w-auto"
            >
              ล้าง Filter ทั้งหมด ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {/* ช่องค้นหา */}
        <div className="sm:col-span-2 xl:col-span-2">
          <label
            htmlFor="assetSearch"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            ค้นหา
          </label>

          <input
            id="assetSearch"
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            placeholder="รหัส, Serial, ชื่อ Asset, ผู้ครอบครอง..."
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* กรองประเภท */}
        <div>
          <label
            htmlFor="typeFilter"
            className="mb-2 block text-sm font-medium"
          >
            Asset Type
          </label>

          <select
            id="typeFilter"
            value={selectedType}
            onChange={(event) =>
              setSelectedType(
                event.target.value
              )
            }
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทุกประเภท ({assets.length})</option>

            {filterOptions.types.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type} ({filterOptions.typeCounts.get(type)})
              </option>
            ))}
          </select>
        </div>

        {/* กรองสถานะ */}
        <div>
          <label
            htmlFor="statusFilter"
            className="mb-2 block text-sm font-medium"
          >
            Status
          </label>

          <select
            id="statusFilter"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(
                event.target.value
              )
            }
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทุกสถานะ ({assets.length})</option>

            {filterOptions.statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status} ({filterOptions.statusCounts.get(status)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="locationFilter"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Location
          </label>
          <select
            id="locationFilter"
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทุกสถานที่ ({assets.length})</option>
            {filterOptions.locations.map((location) => (
              <option key={location} value={location}>
                {location} ({filterOptions.locationCounts.get(location)})
              </option>
            ))}
            {filterOptions.unlocatedCount > 0 && (
              <option value="__none__">
                ยังไม่ระบุ Location ({filterOptions.unlocatedCount})
              </option>
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="holderFilter"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            การครอบครอง
          </label>
          <select
            id="holderFilter"
            value={selectedHolder}
            onChange={(event) => setSelectedHolder(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทั้งหมด ({assets.length})</option>
            <option value="assigned">
              มีผู้ครอบครอง ({filterOptions.assignedCount})
            </option>
            <option value="unassigned">
              ยังไม่มีผู้ครอบครอง ({assets.length - filterOptions.assignedCount})
            </option>
          </select>
        </div>
      </div>
      </div>

      {/* ==========================================
          จำนวนรายการหลังกรอง
      ========================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
        <span>
          พบ <strong className="font-semibold text-slate-800">{sortedAssets.length}</strong>{" "}
          จาก {assets.length} รายการ
        </span>

        {/* แสดงว่าตอนนี้กำลังเรียงอะไร */}
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              ใช้ {activeFilterCount} Filter
            </span>
          )}
        <span className="text-xs text-slate-400">
          Sort: {sortConfig.key}{" "}
          {sortConfig.direction === "asc"
            ? "↑"
            : "↓"}
        </span>
        </div>
      </div>

      {/* มือถือไม่มีหัวตารางให้กด จึงมีตัวเลือก Sort แยกเพื่อคงความสามารถเดิม */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-slate-200 p-4 md:hidden">
        <select
          aria-label="เรียง Asset ตาม"
          value={sortConfig.key}
          onChange={(event) =>
            setSortConfig((previous) => ({
              ...previous,
              key: event.target.value,
            }))
          }
          className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="asset_code">เรียงตามรหัสทรัพย์สิน</option>
          <option value="asset_type">เรียงตามประเภท</option>
          <option value="serial_number">เรียงตาม Serial Number</option>
          <option value="current_holder">เรียงตามผู้ครอบครอง</option>
          <option value="location">เรียงตาม Location</option>
          <option value="status">เรียงตามสถานะ</option>
          <option value="received_date">เรียงตามวันที่รับเข้า</option>
        </select>
        <button
          type="button"
          onClick={() =>
            setSortConfig((previous) => ({
              ...previous,
              direction: previous.direction === "asc" ? "desc" : "asc",
            }))
          }
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
          aria-label="สลับทิศทางการเรียง"
        >
          {sortConfig.direction === "asc" ? "น้อย → มาก" : "มาก → น้อย"}
        </button>
      </div>

      {/* Card view อ่านง่ายกว่า Table บนมือถือและแตะเปิด Detail ได้ทั้งใบ */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sortedAssets.map((asset) => (
          <Link
            key={asset.id}
            href={`/assets/${asset.id}`}
            className="block p-4 transition active:bg-blue-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-blue-700">
                  {asset.asset_code}
                </p>
                <p className="mt-1 break-words font-mono text-sm font-medium text-slate-800">
                  {asset.serial_number || "-"}
                </p>
                <div className="mt-2">
                  <PhotoStatus hasPhoto={asset.has_photo} />
                </div>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                  statusColors[asset.status] || "bg-gray-100 text-gray-700"
                }`}
              >
                {asset.status || "-"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">ประเภท</dt>
                <dd className="mt-0.5 break-words text-slate-700">{asset.asset_type || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Brand / Model</dt>
                <dd className="mt-0.5 break-words text-slate-700">
                  {[asset.brand, asset.model].filter(Boolean).join(" / ") || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">ผู้ครอบครอง</dt>
                <dd className="mt-0.5 break-words text-slate-700">{asset.current_holder || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Location</dt>
                <dd className="mt-0.5 break-words text-slate-700">{asset.location || "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">วันที่รับเข้า</dt>
                <dd className="mt-0.5 text-slate-700">{asset.received_date || "-"}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

      {/* ==========================================
          ASSET TABLE
      ========================================== */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader
                {...sortableHeaderProps}
                label="รหัสทรัพย์สิน"
                sortKey="asset_code"
              />

              <th
                scope="col"
                className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-500"
              >
                รูป
              </th>

              <SortableHeader
                {...sortableHeaderProps}
                label="ประเภทอุปกรณ์"
                sortKey="asset_type"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="Serial Number"
                sortKey="serial_number"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="ยี่ห้อ / รุ่น"
                sortKey="brand_model"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="ผู้ครอบครอง"
                sortKey="current_holder"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="Location"
                sortKey="location"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="สถานะ"
                sortKey="status"
              />

              <SortableHeader
                {...sortableHeaderProps}
                label="วันที่รับเข้า"
                sortKey="received_date"
              />
            </tr>
          </thead>

          <tbody>
            {/* ==========================================
                สร้างแถวจากข้อมูลที่ผ่าน:
                Search
                Filter
                Sort
            ========================================== */}
            {sortedAssets.map((asset) => (
              <tr
                key={asset.id}
                className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/50"

                // คลิกตรงไหนของแถวก็เปิด Detail ของ Asset นั้น
                onClick={() =>
                  router.push(
                    `/assets/${asset.id}`
                  )
                }
              >
                {/* รหัสทรัพย์สิน */}
                <td className="whitespace-nowrap px-5 py-5 font-semibold text-slate-900">
                  {/* ลิงก์จริงรองรับคีย์บอร์ดและเปิดแท็บใหม่ได้
                      แม้ทั้งแถวจะคลิกได้ */}
                  <Link
                    href={`/assets/${asset.id}`}
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    className="rounded hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    {asset.asset_code}
                  </Link>
                </td>

                {/* สถานะรูปตรวจจาก asset_documents โดยไม่โหลดไฟล์จาก Google Drive */}
                <td className="px-5 py-5">
                  <PhotoStatus hasPhoto={asset.has_photo} />
                </td>

                {/* ประเภท */}
                <td className="px-5 py-5 text-slate-700">
                  {asset.asset_type || "-"}
                </td>

                {/* Serial Number */}
                <td className="px-5 py-5 text-slate-700">
                  <span className="font-mono">
                    {asset.serial_number || "-"}
                  </span>
                </td>

                {/* ยี่ห้อ / รุ่น */}
                <td className="px-5 py-5 text-slate-700">
                  {asset.brand || "-"}

                  {asset.model
                    ? ` / ${asset.model}`
                    : ""}
                </td>

                {/* ผู้ครอบครองปัจจุบัน */}
                <td className="px-5 py-5 text-slate-700">
                  {asset.current_holder ||
                    "-"}
                </td>

                {/* สถานที่ */}
                <td className="px-5 py-5 text-slate-700">
                  {asset.location || "-"}
                </td>

                {/* สถานะ */}
                <td className="px-5 py-5 text-slate-700">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                      statusColors[
                        asset.status
                      ] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {asset.status || "-"}
                  </span>
                </td>

                {/* วันที่รับเข้า */}
                <td className="whitespace-nowrap px-5 py-5 text-slate-700">
                  {asset.received_date ||
                    "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ==========================================
          ไม่พบข้อมูล
      ========================================== */}
      {sortedAssets.length === 0 && (
        <div className="p-8 text-center">
          <p className="font-medium text-slate-700">ไม่พบ Asset ที่ตรงกับเงื่อนไข</p>
          <p className="mt-1 text-sm text-slate-500">
            ลองเปลี่ยนคำค้นหาหรือยกเลิก Filter บางรายการ
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              ล้าง Filter ทั้งหมด
            </button>
          )}
        </div>
      )}
    </div>
  );
}
