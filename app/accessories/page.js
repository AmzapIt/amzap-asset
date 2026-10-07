import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getAccessoryInventory } from "@/lib/accessory-read";
import { getConsumableInventory } from "@/lib/consumable-inventory";
import ConsumableManager from "@/app/consumables/ConsumableManager";
import StockManager from "./StockManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccessoriesPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const account = (await query(
    "SELECT role,is_active,must_change_password FROM public.app_accounts WHERE id=$1",
    [session.user.id],
  )).rows[0];
  if (!account?.is_active) redirect("/login");
  if (account.must_change_password) redirect("/account/password");

  const section = (await searchParams)?.tab === "consumables" ? "consumables" : "accessories";
  const canWrite = ["Admin", "IT Staff"].includes(account.role);
  let inventory;
  try {
    inventory = section === "consumables"
      ? await getConsumableInventory()
      : await getAccessoryInventory();
  } catch (error) {
    console.error(`Load ${section} inventory failed:`, error);
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
    <div className="mx-auto max-w-[1600px] space-y-5">
      <nav aria-label="ประเภทคลัง" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <Link href="/accessories" aria-current={section === "accessories" ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === "accessories" ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          Accessories · คืนและโอนได้
        </Link>
        <Link href="/accessories?tab=consumables" aria-current={section === "consumables" ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${section === "consumables" ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          Consumables · ใช้แล้วหมด
        </Link>
      </nav>
      {!inventory ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        ไม่สามารถโหลดคลัง {section === "consumables" ? "Consumables" : "Accessories"} ได้ กรุณาลองใหม่
      </p> : section === "consumables"
        ? <ConsumableManager initialInventory={inventory} canWrite={canWrite} />
        : <StockManager initialInventory={inventory} canWrite={canWrite} />}
    </div>
  </main>;
}
