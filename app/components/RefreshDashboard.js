"use client";
import {useTransition} from "react";
import {useRouter} from "next/navigation";
// แยกปุ่มเป็น Client Component เพื่อให้ Dashboard หลักยังอ่าน DB ฝั่ง server ได้
// router.refresh() ขอผล Server Component ใหม่; useTransition คุมข้อความรอและป้องกันกดซ้ำ
// ไม่แก้ข้อมูล Asset และไม่ใช้การนำทางกลับ URL เดิมแทนการรีเฟรช
export default function RefreshDashboard(){
  const router=useRouter();const [pending,startTransition]=useTransition();
  // Explicitly refresh server data instead of navigating to the same cached URL.
  return <button className="rounded-lg border border-white/30 px-4 py-2 hover:bg-white/10 disabled:opacity-50" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?"กำลังโหลด…":"รีเฟรช"}</button>;
}
