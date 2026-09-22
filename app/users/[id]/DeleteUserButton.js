"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const dependencyLabels = {
  owned_assets: "Asset Owner",
  assignments: "Assignment",
  accessories: "Accessories",
  audit_logs: "Audit Log",
  documents: "Documents",
  login_accounts: "Login Account",
};

function dependencyMessage(dependencies) {
  if (!dependencies) return "";

  const items = Object.entries(dependencies)
    .filter(([, count]) => Number(count) > 0)
    .map(([key, count]) => `${dependencyLabels[key] || key}: ${count}`);

  return items.length ? `\n\nข้อมูลที่ยังอ้างอิง:\n${items.join("\n")}` : "";
}

export default function DeleteUserButton({ userId, userName }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;

    const confirmed = window.confirm(
      `ยืนยันลบพนักงาน “${userName}” แบบถาวร?\n\nระบบจะไม่อนุญาตให้ลบหากยังมี Asset, Assignment, Accessory, ประวัติ หรือบัญชี Login อ้างอิงอยู่`,
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          `${data.error || "ไม่สามารถลบพนักงานได้"}${dependencyMessage(data.dependencies)}`,
        );
      }

      window.alert("ลบพนักงานเรียบร้อยแล้ว");
      router.push("/users");
      router.refresh();
    } catch (error) {
      window.alert(error.message || "ไม่สามารถลบพนักงานได้");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-lg border border-red-200 bg-white px-4 py-2 font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete Employee"}
    </button>
  );
}
