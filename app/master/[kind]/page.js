"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { masterConfig } from "@/lib/master-config";

export default function MasterPage() {
  const { kind } = useParams();

  const config = Object.hasOwn(masterConfig, kind)
    ? masterConfig[kind]
    : null;

  // =========================================================
  // State
  // =========================================================
  const [rows, setRows] = useState([]);
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // =========================================================
  // Load Master
  // =========================================================
  useEffect(() => {
    const controller = new AbortController();

    async function loadMaster() {
      try {
        setMessage("");

        const response = await fetch(
          `/api/master/${kind}`,
          {
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load master data",
          );
        }

        setRows(data.rows || []);
        setEditor(null);
      } catch (error) {
        if (error.name !== "AbortError") {
          setMessage(error.message);
        }
      }
    }

    loadMaster();

    return () => controller.abort();
  }, [kind]);

  if (!config) {
    return (
      <main className="px-4 py-5 sm:px-6 sm:py-8">
        <p>Master Data not found</p>
      </main>
    );
  }

  // =========================================================
  // Add
  // =========================================================
  function addNew() {
    const blankFields = Object.fromEntries(
      Object.keys(config.fields).map((field) => [
        field,
        "",
      ]),
    );

    setEditor({
      ...blankFields,
      is_active: true,
    });

    setMessage("");
  }

  // =========================================================
  // Save
  // =========================================================
  async function save(event) {
    event.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/master/${kind}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(editor),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save master data",
        );
      }

      // เอา record เก่าออก แล้วใส่ค่าที่ API ส่งกลับมา
      setRows((previous) =>
        [
          ...previous.filter(
            (row) =>
              String(row.id) !== String(data.row.id),
          ),

          data.row,
        ].sort((a, b) =>
          String(a.name).localeCompare(String(b.name)),
        ),
      );

      setEditor(null);

      setMessage("บันทึกเรียบร้อย");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
      {/* =====================================================
          Header
         ===================================================== */}
      <header className="mb-6 flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
            Configuration
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            {config.label}
          </h1>

          <p className="mt-2 text-blue-100">
            จัดการข้อมูล Master Data
          </p>
        </div>

        <button
          type="button"
          onClick={addNew}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-center font-semibold text-blue-900 shadow-sm hover:bg-blue-50 sm:w-auto"
        >
          + Add
        </button>
      </header>

      {/* =====================================================
          Message
         ===================================================== */}
      {message && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
        >
          {message}
        </div>
      )}

      {/* =====================================================
          Add / Edit Form
         ===================================================== */}
      {editor && (
        <form
          onSubmit={save}
          className="mb-6 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editor.id
              ? `Edit ${config.label}`
              : `Add ${config.label}`}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(config.fields).map(
              ([field, max]) => (
                <label
                  key={field}
                  className="block"
                >
                  <span className="mb-1 block text-sm font-medium">
                    {field}
                  </span>

                  <input
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    required={
                      field === "name" ||
                      (
                        kind === "asset_types" &&
                        field === "prefix"
                      )
                    }
                    maxLength={max}
                    value={editor[field] ?? ""}
                    onChange={(event) => {
                      let value = event.target.value;

                      // Prefix ของ Asset Type
                      // แปลงเป็นตัวใหญ่ทันที
                      if (
                        kind === "asset_types" &&
                        field === "prefix"
                      ) {
                        value = value.toUpperCase();
                      }

                      setEditor({
                        ...editor,
                        [field]: value,
                      });
                    }}
                  />
                </label>
              ),
            )}
          </div>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={editor.is_active ?? true}
              onChange={(event) =>
                setEditor({
                  ...editor,
                  is_active: event.target.checked,
                })
              }
            />

            Active
          </label>

          <div className="mt-5 grid gap-3 sm:flex">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-blue-900 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditor(null);
                setMessage("");
              }}
              className="rounded-lg border border-slate-300 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* =====================================================
          Table
         ===================================================== */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {config.listFields.map((field) => (
                <th
                  key={field.key}
                  className="whitespace-nowrap px-4 py-3 font-semibold"
                >
                  {field.label}
                </th>
              ))}

              <th className="px-4 py-3">
                Status
              </th>

              <th className="px-4 py-3">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 transition hover:bg-blue-50/40"
              >
                {config.listFields.map((field) => (
                  <td
                    key={field.key}
                    className="px-4 py-3"
                  >
                    {row[field.key] || "-"}
                  </td>
                ))}

                <td className="px-4 py-3">
                  <span
                    className={
                      row.is_active
                        ? "text-green-700"
                        : "text-slate-500"
                    }
                  >
                    {row.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    onClick={() => {
                      setEditor({
                        ...row,

                        // PostgreSQL bigint อาจถูกส่งเป็น String อยู่แล้ว
                        id: String(row.id),
                      });

                      setMessage("");
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={
                    config.listFields.length + 2
                  }
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>
    </main>
  );
}
