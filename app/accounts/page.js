import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import AccountManager from "./AccountManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Do not trust the role stored in the JWT for this sensitive page. Reading
  // the current account from the database makes role changes and deactivation
  // effective here immediately, without waiting for the session to expire.
  const currentResult = await query(
    `SELECT id::text AS id, role, is_active
     FROM public.app_accounts
     WHERE id=$1
     LIMIT 1`,
    [session.user.id],
  );
  const currentAccount = currentResult.rows[0];

  if (!currentAccount?.is_active || currentAccount.role !== "Admin") {
    redirect("/");
  }

  // Never select password_hash for a page or API response.
  const [accountResult, employeeResult] = await Promise.all([
    query(`
      SELECT
        a.id::text AS id,
        a.email,
        a.username,
        a.display_name,
        a.role,
        a.is_active,
        a.user_id::text AS user_id,
        a.must_change_password,
        a.created_at::text AS created_at,
        a.updated_at::text AS updated_at,
        u.employee_code,
        u.full_name AS employee_name,
        u.nickname AS employee_nickname,
        u.is_active AS employee_is_active
      FROM public.app_accounts a
      LEFT JOIN public."user" u ON u.id = a.user_id
      ORDER BY a.is_active DESC, a.display_name ASC, a.id ASC
    `),
    query(`
      SELECT
        u.id::text AS id,
        u.employee_code,
        u.full_name,
        u.nickname,
        u.is_active,
        d.name AS department_name,
        l.name AS location_name
      FROM public."user" u
      LEFT JOIN public.departments d ON d.id = u.department_id
      LEFT JOIN public.locations l ON l.id = u.location_id
      ORDER BY u.is_active DESC, u.full_name ASC
    `),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 xl:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
            Security & access
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">System Accounts</h1>
          <p className="mt-2 max-w-3xl text-blue-100">
            จัดการบัญชี Login, สิทธิ์การใช้งาน และการเชื่อมบัญชีกับพนักงาน
          </p>
        </header>

        <AccountManager
          initialAccounts={accountResult.rows}
          employees={employeeResult.rows}
          currentAccountId={currentAccount.id}
        />
      </div>
    </main>
  );
}
