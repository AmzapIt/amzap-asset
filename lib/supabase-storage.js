import { URL } from "node:url";

const BUCKET = "asset-photos";

function projectUrl() {
  const configured = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)\./i)?.[1];
  return host ? `https://${host}.supabase.co` : "";
}

function secretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function requireConfig() {
  const base = projectUrl();
  const key = secretKey();
  if (!base || !key) throw new Error("Supabase Storage is not configured");
  return { base, key };
}

export function supabasePublicAssetPhotoUrl(fileName) {
  const base = projectUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  return `${base}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
}

export function isSupabaseAssetPhotoUrl(value) {
  if (typeof value !== "string" || !value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    const base = new URL(projectUrl());
    return url.origin === base.origin && url.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`);
  } catch {
    return false;
  }
}

export async function uploadSupabaseAssetPhoto({ buffer, fileName, mimeType }) {
  const { base, key } = requireConfig();
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": mimeType, "x-upsert": "false" },
    body: buffer,
  });
  if (!response.ok) throw new Error(`Supabase Storage upload failed (${response.status})`);
  return { name: fileName, webViewLink: supabasePublicAssetPhotoUrl(fileName), mimeType, size: buffer.length };
}

export async function deleteSupabaseAssetPhoto(fileName) {
  const { base, key } = requireConfig();
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodeURIComponent(fileName)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Supabase Storage delete failed (${response.status})`);
}

export async function downloadSupabasePhoto(storagePath) {
  if (!isSupabaseAssetPhotoUrl(storagePath)) throw new Error("Invalid Supabase photo URL");
  const response = await fetch(storagePath, { cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase photo download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
