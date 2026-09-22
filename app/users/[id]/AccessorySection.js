"use client";

import { useCallback, useEffect, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AccessorySection({ userId, canWrite }) {
  const [accessories, setAccessories] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({
    accessory_type_id: "",
    quantity: "1",
    brand: "",
    model: "",
    serial_number: "",
    issued_date: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const [accessoriesResponse, typesResponse] = await Promise.all([
        fetch(`/api/users/${userId}/accessories`),
        fetch("/api/master/accessory_types"),
      ]);
      const accessoriesData = await accessoriesResponse.json();
      const typesData = await typesResponse.json();

      if (!accessoriesResponse.ok || !accessoriesData.success) {
        throw new Error(
          accessoriesData.error || "ไม่สามารถโหลด Accessories ได้",
        );
      }

      if (!typesResponse.ok) {
        throw new Error(typesData.error || "ไม่สามารถโหลด Accessory Types ได้");
      }

      setAccessories(accessoriesData.accessories || []);
      setTypes(
        (typesData.rows || [])
          .filter((type) => type.is_active)
          .sort((a, b) => Number(a.id) - Number(b.id)),
      );
    } catch (error) {
      setMessage(error.message || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData, userId]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setMessage("");
      const response = await fetch(`/api/users/${userId}/accessories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถเพิ่ม Accessory ได้");
      }

      setForm({
        accessory_type_id: "",
        quantity: "1",
        brand: "",
        model: "",
        serial_number: "",
        issued_date: "",
        notes: "",
      });
      setShowAdd(false);
      await loadData();
    } catch (error) {
      setMessage(error.message || "ไม่สามารถเพิ่ม Accessory ได้");
    } finally {
      setSaving(false);
    }
  }

  async function handleReturn(accessory) {
    if (returningId) return;
    if (!window.confirm(`ยืนยันการคืน ${accessory.accessory_type}?`)) return;

    try {
      setReturningId(String(accessory.id));
      setMessage("");
      const response = await fetch(
        `/api/users/${userId}/accessories/${accessory.id}/return`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถคืน Accessory ได้");
      }

      await loadData();
    } catch (error) {
      setMessage(error.message || "ไม่สามารถคืน Accessory ได้");
    } finally {
      setReturningId(null);
    }
  }

  function renderDetails(item) {
    return [item.brand, item.model].filter(Boolean).join(" / ") || "-";
  }

  const currentAccessories = accessories.filter((item) => !item.returned_date);
  const historyAccessories = accessories.filter((item) => item.returned_date);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Accessories</h2>
          <p className="mt-1 text-sm text-gray-500">
            อุปกรณ์ที่ไม่ต้องมี Asset Code
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowAdd((previous) => !previous)}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
          >
            + Add Equipment
          </button>
        )}
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {canWrite && showAdd && (
        <form
          onSubmit={handleAdd}
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"
        >
          <h3 className="font-semibold text-slate-800">Add Equipment</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium">
                Equipment Type *
              </span>
              <select
                name="accessory_type_id"
                value={form.accessory_type_id}
                onChange={handleChange}
                required
                className={inputClass}
              >
                <option value="">-- Select --</option>
                {types.map((type) => (
                  <option key={type.id} value={String(type.id)}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">Quantity *</span>
              <input
                type="number"
                min="1"
                step="1"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </label>
            {[
              ["brand", "Brand"],
              ["model", "Model"],
              ["serial_number", "Serial Number"],
              ["issued_date", "Issued Date"],
            ].map(([name, label]) => (
              <label key={name}>
                <span className="mb-1 block text-sm font-medium">{label}</span>
                <input
                  type={name === "issued_date" ? "date" : "text"}
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>
            ))}
            <label className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium">Notes</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
        ) : currentAccessories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-7 text-center text-sm text-gray-500">
            ยังไม่มี Accessories
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Brand / Model</th>
                  <th className="px-4 py-3">Serial</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Issued Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentAccessories.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {item.accessory_type}
                    </td>
                    <td className="px-4 py-3">{renderDetails(item)}</td>
                    <td className="px-4 py-3">{item.serial_number || "-"}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {formatDate(item.issued_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => handleReturn(item)}
                          disabled={returningId !== null}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {returningId === String(item.id)
                            ? "Returning..."
                            : "Return"}
                        </button>
                      ) : (
                        <span className="text-gray-400">Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-5 border-t pt-5">
        <button
          type="button"
          onClick={() => setShowHistory((previous) => !previous)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showHistory
            ? "ซ่อนประวัติ"
            : `ดูประวัติ (${historyAccessories.length})`}
        </button>
        {showHistory && (
          <div className="mt-4 overflow-x-auto">
            {historyAccessories.length === 0 ? (
              <p className="text-sm text-gray-500">ยังไม่มีประวัติการคืน</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Brand / Model</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Issued</th>
                    <th className="px-4 py-3">Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {historyAccessories.map((item) => (
                    <tr key={item.id} className="border-t text-gray-500">
                      <td className="px-4 py-3">{item.accessory_type}</td>
                      <td className="px-4 py-3">{renderDetails(item)}</td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {formatDate(item.issued_date)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(item.returned_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
