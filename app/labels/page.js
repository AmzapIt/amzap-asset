import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { formatUserDisplayName } from "@/lib/user-display";
import LabelManager from "./LabelManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const account = (await query(
    `SELECT role, is_active, must_change_password
       FROM public.app_accounts WHERE id=$1 LIMIT 1`,
    [session.user.id],
  )).rows[0];
  if (!account?.is_active || account.must_change_password ||
      !["Admin", "IT Staff"].includes(account.role)) {
    redirect("/");
  }

  const assets = (await query(
    `SELECT a.id::text AS id, a.asset_code, a.asset_name,
            a.status, t.name AS asset_type, l.name AS location,
            owner_user.full_name AS owner_full_name,
            owner_user.nickname AS owner_nickname,
            COALESCE(prints.print_count, 0)::int AS print_count,
            COALESCE(prints.has_existing_label, false) AS has_existing_label,
            to_char(prints.last_printed_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_printed_at
       FROM public.assets a
       LEFT JOIN public.asset_types t ON t.id=a.asset_type_id
       LEFT JOIN public.locations l ON l.id=a.location_id
       LEFT JOIN public."user" owner_user ON owner_user.id=a.asset_owner_id
       LEFT JOIN (
         SELECT p.asset_id, COUNT(*) AS print_count,
                BOOL_OR(b.source='existing') AS has_existing_label,
                MAX(printed_at) AS last_printed_at
           FROM public.asset_label_prints p
           JOIN public.asset_label_print_batches b ON b.id=p.batch_id
          GROUP BY p.asset_id
       ) prints ON prints.asset_id=a.id
      ORDER BY a.asset_code ASC, a.id ASC`,
  )).rows.map(({ owner_full_name, owner_nickname, ...asset }) => ({
    ...asset,
    owner_name: formatUserDisplayName({
      full_name: owner_full_name,
      nickname: owner_nickname,
    }) || null,
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">Asset labels</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">พิมพ์ Asset Code และ QR</h1>
          <p className="mt-2 text-blue-100">QR เก็บ Asset Code ตรงตัว เลือก Asset แล้วดูตัวอย่างก่อนพิมพ์</p>
        </header>
        <LabelManager initialAssets={assets} />
      </div>
    </main>
  );
}
