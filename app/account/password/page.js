import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import ChangePasswordForm from "./ChangePasswordForm";
import SettingsNav from "@/app/settings/SettingsNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // A JWT may outlive an account status change, so verify the account from
  // the database before rendering a security-sensitive form.
  const result = await query(
    `SELECT email, display_name, role, is_active, must_change_password
     FROM public.app_accounts
     WHERE id=$1
     LIMIT 1`,
    [session.user.id],
  );
  const account = result.rows[0];
  // Redirect to the dashboard instead of /login because Auth.js correctly
  // treats the still-valid JWT as logged in until the user signs out.
  if (!account?.is_active) redirect("/");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-7 text-white shadow-lg">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-200">
            Account security
          </p>
          <h1 className="mt-2 text-3xl font-bold">Change Password</h1>
          <p className="mt-2 text-blue-100">
            {account.display_name} · {account.email}
          </p>
        </header>

        <SettingsNav view="password" admin={account.role === "Admin"} />

        <ChangePasswordForm
          mustChangePassword={account.must_change_password === true}
        />
      </div>
    </main>
  );
}
