export async function getItStockLocation(client) {
  const result = await client.query(
    `SELECT location.id, location.name
     FROM public.asset_inventory_settings settings
     JOIN public.locations location ON location.id=settings.it_stock_location_id
     WHERE settings.singleton=true AND location.is_active=true`,
  );
  if (!result.rows[0]) {
    throw new Error("IT stock location is not configured. Run migration 021.");
  }
  return result.rows[0];
}
