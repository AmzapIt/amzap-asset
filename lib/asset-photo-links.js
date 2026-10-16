const LOCAL_PHOTO_URL = /^\/api\/assets\/[1-9]\d{0,18}\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export function shouldMakePrimaryPhoto(requestedPrimary, hasPrimaryPhoto) {
  return requestedPrimary || !hasPrimaryPhoto;
}

export function isViewableAssetDocumentUrl(value) {
  return typeof value === "string" && (
    value.startsWith("https://") || LOCAL_PHOTO_URL.test(value)
  );
}
