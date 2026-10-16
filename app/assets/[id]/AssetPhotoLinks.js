"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AssetPhotoLinks({ assetId, photos, canWrite }) {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  async function removeLink(photo) {
    const label = photo.isPrimary ? "รูปหลัก" : "รูปรอง";
    if (!window.confirm(`ลบลิงก์${label}นี้ออกจาก Asset?\nไฟล์ต้นฉบับใน Google Drive หรือ local server จะไม่ถูกลบ`)) return;
    setDeletingId(photo.id);
    setDeleteError("");
    try {
      const response = await fetch(`/api/assets/${assetId}/photo-links/${photo.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ลบลิงก์รูปไม่สำเร็จ");
      router.refresh();
    } catch (error) {
      setDeleteError(error.message || "ลบลิงก์รูปไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-sm text-gray-500">ลิงก์รูป Asset</h3>
      {deleteError && <p role="alert" className="mt-2 text-sm text-red-700">{deleteError}</p>}
      {photos.length === 0 ? (
        <p className="mt-1 text-sm font-medium text-gray-800">-</p>
      ) : (
        <div className="mt-2 space-y-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">
                {photo.isPrimary ? "รูปหลัก" : `รูปที่ ${index + 1}`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`ลิงก์${photo.isPrimary ? "รูปหลัก" : `รูปที่ ${index + 1}`}`}
                  readOnly
                  value={photo.url}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  เปิด
                </a>
                <button
                  type="button"
                  onClick={async (event) => {
                    try {
                      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
                      await navigator.clipboard.writeText(new URL(photo.url, window.location.origin).href);
                      setCopyStatus({ id: photo.id, message: "คัดลอกแล้ว" });
                    } catch {
                      const input = event.currentTarget.parentElement?.querySelector("input");
                      input?.focus();
                      input?.select();
                      setCopyStatus({ id: photo.id, message: "เลือกลิงก์แล้ว กดคัดลอกได้เลย" });
                    }
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  คัดลอก
                </button>
                {canWrite && (
                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() => removeLink(photo)}
                    className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === photo.id ? "กำลังลบ..." : "ลบลิงก์"}
                  </button>
                )}
              </div>
              {copyStatus?.id === photo.id && (
                <p role="status" className="mt-1 text-xs text-slate-600">{copyStatus.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
