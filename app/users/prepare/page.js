import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import Preparation from "./Preparation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PrepareEmployeePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const account = (await query("SELECT role, is_active, must_change_password FROM public.app_accounts WHERE id=$1", [session.user.id])).rows[0];
  if (!account?.is_active || account.must_change_password || !["Admin", "IT Staff"].includes(account.role)) redirect("/");

  const [users, assets, stocks, types, sites, locations, departments, today, templates] = await Promise.all([
    query(`SELECT u.id::text,u.employee_code,u.full_name,u.nickname,u.position,u.department_id::text,u.location_id::text,l.name AS location_name FROM public."user" u LEFT JOIN public.locations l ON l.id=u.location_id WHERE u.is_active ORDER BY u.full_name`),
    query(`SELECT a.id::text,a.asset_code,a.asset_name,a.brand,a.model,a.serial_number,t.name AS type FROM public.assets a JOIN public.asset_inventory_settings s ON s.it_stock_location_id=a.location_id AND s.singleton=true LEFT JOIN public.asset_types t ON t.id=a.asset_type_id WHERE a.status='In Stock' AND NOT EXISTS (SELECT 1 FROM public.asset_assignments x WHERE x.asset_id=a.id AND x.returned_date IS NULL) ORDER BY a.asset_code`),
    query(`SELECT s.id::text,t.name AS accessory_type,s.brand,s.model,s.serial_number,s.available_quantity FROM public.accessory_stock_items s JOIN public.accessory_types t ON t.id=s.accessory_type_id WHERE t.is_active AND s.available_quantity>0 ORDER BY t.name,s.brand,s.model`),
    query("SELECT id::text,name,prefix FROM public.asset_types WHERE is_active ORDER BY name"),
    query("SELECT id::text,site_code,name FROM public.asset_registration_sites WHERE is_active ORDER BY id"),
    query("SELECT id::text,name FROM public.locations WHERE is_active AND NOT EXISTS (SELECT 1 FROM public.asset_inventory_settings s WHERE s.singleton=true AND s.it_stock_location_id=locations.id) ORDER BY id"),
    query("SELECT id::text,name FROM public.departments WHERE is_active ORDER BY name"),
    query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today"),
    query(`SELECT a.id::text,a.asset_code,a.asset_name,a.brand,a.model,t.name AS type,tech.operating_system,tech.cpu,tech.ram_gb::text,tech.storage_gb::text FROM public.assets a JOIN public.asset_types t ON t.id=a.asset_type_id AND t.is_active LEFT JOIN public.asset_technical tech ON tech.asset_id=a.id ORDER BY a.asset_code`),
  ]);
  return <Preparation data={{ users:users.rows, assets:assets.rows, stocks:stocks.rows, types:types.rows, sites:sites.rows, locations:locations.rows, departments:departments.rows, today:today.rows[0].today, templates:templates.rows }} />;
}
