// New inventory modules are rolled out with migration 027. Existing pages must
// remain usable until that migration is applied to each database.
export async function inventorySchema(db) {
  const result = await db.query(`SELECT
    to_regclass('public.software_licenses') IS NOT NULL AND
    to_regclass('public.license_seat_assignments') IS NOT NULL AS licenses,
    to_regclass('public.consumable_items') IS NOT NULL AND
    to_regclass('public.consumable_movements') IS NOT NULL AS consumables`);
  return { licenses: result.rows[0]?.licenses === true,
    consumables: result.rows[0]?.consumables === true };
}
