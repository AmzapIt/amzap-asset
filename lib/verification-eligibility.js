// Locations 1 and 2 are Amzap factories; Memorize is a separate company.
// Keep this shared by the preview and the batch writer so counts cannot drift.
export function isAmzapVerificationUser(user) {
  return user?.is_active === true && ['1', '2'].includes(String(user.location_id));
}
