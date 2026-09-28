import { redirect } from "next/navigation";

// เก็บ URL เดิมไว้เพื่อไม่ให้ bookmark หรือลิงก์เก่าเสีย
// ผู้ใช้ที่เปิด /reports จะถูกส่งไปหน้า Export Asset โดยอัตโนมัติ
export default function ReportsPage() {
  redirect("/reports/assets");
}
