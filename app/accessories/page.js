import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getAccessoryInventory } from "@/lib/accessory-read";
import StockManager from "./StockManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccessoriesPage() {
  const session=await auth();
  if (!session?.user?.id) redirect("/login");
  const account=(await query("SELECT role,is_active,must_change_password FROM public.app_accounts WHERE id=$1",[session.user.id])).rows[0];
  if (!account?.is_active) redirect("/login");
  if (account.must_change_password) redirect("/account/password");
  let inventory;
  try { inventory=await getAccessoryInventory(); }
  catch(error) {
    console.error("Load accessory inventory failed:",error);
    return <main className="min-h-screen bg-slate-50 p-5 text-slate-900"><h1 className="text-2xl font-bold">Accessories / Stock</h1><p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">ไม่สามารถโหลดคลัง Accessories ได้ กรุณาลองใหม่</p></main>;
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8"><div className="mx-auto max-w-[1600px]"><StockManager initialInventory={inventory} canWrite={["Admin","IT Staff"].includes(account.role)} /></div></main>;
}
