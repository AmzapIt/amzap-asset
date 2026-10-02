"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiResponse } from "@/lib/client-api";

function itemName(item) {
  if (item.item_type === "asset") {
    return [item.asset_code, item.asset_name, item.asset_brand, item.asset_model]
      .filter(Boolean).join(" · ");
  }
  return [item.accessory_type, item.accessory_brand, item.accessory_model,
    item.accessory_serial && `S/N: ${item.accessory_serial}`]
    .filter(Boolean).join(" · ");
}

export default function OffboardingPanel({
  userId,
  userName,
  isActive,
  canManageUsers,
  canWrite,
  overview,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const open = overview && !overview.closed_at;
  const canStart = canManageUsers && (!overview || (overview.closed_at && isActive));

  async function request(url, method, body) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await readApiResponse(response);
      setReviewingId(null);
      setReviewReason("");
      router.refresh();
    } catch (error) {
      setMessage(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!window.confirm(
      `เริ่มขั้นตอนลาออกของ ${userName}? ระบบจะปิดสถานะพนักงานและบันทึกรายการที่ต้องตรวจคืน แต่จะยังไม่เพิ่มยอดคลัง`,
    )) return;
    request(`/api/users/${userId}/offboarding`, "POST");
  }

  function close() {
    if (!window.confirm("ยืนยันปิดเคสลาออกที่ตรวจครบแล้ว?")) return;
    request(`/api/users/${userId}/offboarding`, "PATCH");
  }

  return (
    <section id="offboarding" className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">รายการตรวจคืนเมื่อพนักงานลาออก</h2>
          <p className="mt-1 text-sm text-slate-600">
            กดรับคืนในรายการ Asset / Accessories ตามของที่ IT ได้รับจริงเท่านั้น
            การเริ่มขั้นตอนนี้ไม่เพิ่มยอดคลัง
          </p>
        </div>
        {canStart && (
          <button
            type="button"
            disabled={busy}
            onClick={start}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            เริ่มขั้นตอนลาออก
          </button>
        )}
      </div>

      {!overview ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          ยังไม่ได้เริ่มขั้นตอนลาออก
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className={`rounded-full px-3 py-1 font-semibold ${open ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {open ? "กำลังตรวจคืน" : "ปิดเคสแล้ว"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              ค้าง {overview.pendingItems} รายการ / {overview.pendingQuantity} ชิ้น
            </span>
            {overview.reviewItems > 0 && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
                ตรวจสอบผู้ถือจริง {overview.reviewItems} รายการ
              </span>
            )}
          </div>
          {open && overview.pendingItems === 0 && canManageUsers && (
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
            >
              ตรวจครบแล้ว · ปิดเคสลาออก
            </button>
          )}
          {overview.items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">ไม่พบอุปกรณ์ค้างคืนตอนเริ่มขั้นตอนลาออก</p>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {item.item_type === "asset" ? "Asset" : "Accessories"}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">{itemName(item)}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.item_type === "accessory"
                          ? `ต้องตรวจ ${item.expected_quantity} ชิ้น · รับคืนแล้ว ${item.received_quantity} · ค้าง ${item.pending_quantity}`
                          : item.asset_serial ? `S/N: ${item.asset_serial}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.resolution === "not_held" || item.pending_quantity === 0
                        ? "bg-emerald-100 text-emerald-800"
                        : item.requires_review
                          ? "bg-orange-100 text-orange-800"
                          : "bg-amber-100 text-amber-800"
                    }`}>
                      {item.received_quantity > 0 && item.pending_quantity === 0
                        ? "รับคืนแล้ว"
                        : item.resolution === "not_held"
                          ? "ยืนยันว่าไม่ได้ถือ"
                          : item.pending_quantity === 0
                          ? "รับคืนแล้ว"
                          : item.requires_review
                            ? "ตรวจสอบผู้ถือจริง"
                            : "รอรับคืน"}
                    </span>
                  </div>
                  {item.resolution_reason && (
                    <p className="mt-2 text-xs text-slate-600">ผลตรวจสอบ: {item.resolution_reason}</p>
                  )}
                  {open && item.pending_quantity > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.item_type === "asset" ? (
                        <Link className="text-sm font-medium text-blue-700 underline" href={`/assets/${item.asset_id}#asset-action`}>
                          เปิด Asset เพื่อบันทึกรับคืน
                        </Link>
                      ) : (
                        <a className="text-sm font-medium text-blue-700 underline" href="#accessories">
                          ไปยัง Accessories เพื่อบันทึกรับคืน
                        </a>
                      )}
                      {item.requires_review && canWrite && (
                        <button
                          type="button"
                          onClick={() => { setReviewingId(item.id); setReviewReason(""); }}
                          className="text-sm font-medium text-orange-800 underline"
                        >
                          ยืนยันว่าไม่ได้ถือจริง
                        </button>
                      )}
                    </div>
                  )}
                  {open && reviewingId === item.id && (
                    <form
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        request(`/api/users/${userId}/offboarding/items/${item.id}`, "PATCH", {
                          reason: reviewReason,
                        });
                      }}
                    >
                      <input
                        required
                        maxLength={1000}
                        value={reviewReason}
                        onChange={(event) => setReviewReason(event.target.value)}
                        placeholder="ระบุเหตุผล/ผู้ถือจริงที่ตรวจพบ"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        disabled={busy}
                        className="rounded-lg bg-orange-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        บันทึกผลตรวจสอบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewingId(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                      >
                        ยกเลิก
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
    </section>
  );
}
