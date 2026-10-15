import { randomUUID } from "node:crypto";
import { readServerSettings } from "./server-settings.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_PREVIEW_SOURCE_BYTES = 25 * 1024 * 1024;
let cachedAccessToken = null;
let pendingAccessToken = null;

export function looksLikeGoogleAccessToken(value) {
  return typeof value === "string" && value.startsWith("ya29.");
}

export function googleDriveFileIdFromUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return null;
    const match = /^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function googleDriveConfig() {
  const config = {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    folderId: readServerSettings().googleDriveFolderId,
  };

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error("Google Drive upload is not configured");
  }
  if (looksLikeGoogleAccessToken(config.refreshToken)) {
    throw new Error("Google Drive access token was used instead of a refresh token");
  }

  return config;
}

// Refresh Token อยู่เฉพาะฝั่ง Server และใช้แลก Access Token อายุสั้นทุกครั้ง
// จึงไม่มี Google Secret หรือ Token ถูกส่งไปที่ Browser
async function getGoogleDriveAccessToken() {
  const config = googleDriveConfig();
  const configKey = `${config.clientId}:${config.clientSecret}:${config.refreshToken}`;
  if (cachedAccessToken?.key === configKey && Date.now() < cachedAccessToken.expiresAt) {
    return { accessToken: cachedAccessToken.value, folderId: config.folderId };
  }
  if (pendingAccessToken?.key === configKey) {
    return { accessToken: await pendingAccessToken.promise, folderId: config.folderId };
  }

  const promise = requestGoogleDriveAccessToken(config).then(({ value, expiresAt }) => {
    cachedAccessToken = { key: configKey, value, expiresAt };
    return value;
  }).finally(() => {
    if (pendingAccessToken?.promise === promise) pendingAccessToken = null;
  });
  pendingAccessToken = { key: configKey, promise };
  return { accessToken: await promise, folderId: config.folderId };
}

async function requestGoogleDriveAccessToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new Error("Google Drive authorization expired");
    }
    throw new Error("Unable to authorize Google Drive upload");
  }

  return {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600) - 60) * 1000,
  };
}

/**
 * Upload one small Asset photo with metadata in a multipart/related request.
 * GOOGLE_DRIVE_FOLDER_ID is optional; without it Google saves the file in the
 * authorized account's My Drive root.
 */
export async function uploadAssetPhotoToGoogleDrive({
  buffer,
  fileName,
  mimeType,
}) {
  const { accessToken, folderId } = await getGoogleDriveAccessToken();
  const boundary = `amzap_${randomUUID()}`;
  const metadata = {
    name: fileName,
    ...(folderId ? { parents: [folderId] } : {}),
    appProperties: { source: "AMZAP Asset Management" },
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const query = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,name,mimeType,size,webViewLink",
  });

  const response = await fetch(`${DRIVE_UPLOAD_URL}?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok || !data.id) {
    throw new Error("Unable to upload the photo to Google Drive");
  }

  return {
    id: data.id,
    name: data.name || fileName,
    mimeType: data.mimeType || mimeType,
    size: Number(data.size || buffer.length),
    webViewLink:
      data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

// The Drive viewer URL is already stored in asset_documents.storage_path.
// This grants link-only reader access to that same URL; it does not change
// the application's authenticated photo-preview endpoint.
export async function ensureGoogleDriveLinkSharing(fileId) {
  if (typeof fileId !== "string" || !DRIVE_FILE_ID_PATTERN.test(fileId)) {
    throw new Error("Invalid Google Drive file ID");
  }

  const { accessToken } = await getGoogleDriveAccessToken();
  const endpoint = `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}/permissions`;
  let pageToken;

  do {
    const parameters = new URLSearchParams({
      fields: "nextPageToken,permissions(id,type,role,allowFileDiscovery)",
      pageSize: "100",
      supportsAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(`${endpoint}?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to inspect Google Drive photo sharing");
    const data = await response.json();
    const anyone = data.permissions?.find((permission) => permission.type === "anyone");
    if (anyone) {
      if (anyone.role !== "reader" || anyone.allowFileDiscovery === true) {
        throw new Error("Google Drive photo has broader public access; review it manually");
      }
      return { permissionId: anyone.id, alreadyShared: true };
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const response = await fetch(`${endpoint}?${new URLSearchParams({
    fields: "id,type,role,allowFileDiscovery",
    supportsAllDrives: "true",
  })}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "anyone", role: "reader", allowFileDiscovery: false }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to share Google Drive photo by link");
  const permission = await response.json();
  if (!permission.id || permission.type !== "anyone" || permission.role !== "reader") {
    throw new Error("Google Drive did not confirm link-only reader access");
  }
  return { permissionId: permission.id, alreadyShared: false };
}

// ถ้าบันทึกข้อมูลลง PostgreSQL ไม่สำเร็จ ให้ลบไฟล์ที่เพิ่ง Upload เพื่อไม่ให้
// มีไฟล์กำพร้าใน Google Drive ฟังก์ชันนี้ไม่ถูกเรียกเมื่อบันทึกสำเร็จ
export async function deleteGoogleDriveFile(fileId) {
  const { accessToken } = await getGoogleDriveAccessToken();
  const query = new URLSearchParams({ supportsAllDrives: "true" });
  const response = await fetch(
    `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?${query}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error("Unable to remove an incomplete Google Drive upload");
  }
}

export async function downloadGoogleDrivePhoto(storagePath) {
  const fileId = googleDriveFileIdFromUrl(storagePath);
  if (!fileId) throw new Error("Unsupported Google Drive photo URL");

  const { accessToken } = await getGoogleDriveAccessToken();
  const parameters = new URLSearchParams({ alt: "media", supportsAllDrives: "true" });
  const response = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?${parameters}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok || !response.body) {
    throw new Error("Unable to download Google Drive photo");
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > MAX_PREVIEW_SOURCE_BYTES) {
    await response.body.cancel();
    throw new Error("Google Drive photo is too large to preview");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PREVIEW_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("Google Drive photo is too large to preview");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, totalBytes);
}

export async function checkGoogleDriveConnection() {
  const { accessToken, folderId } = await getGoogleDriveAccessToken();
  const url = folderId
    ? `${DRIVE_FILES_URL}/${encodeURIComponent(folderId)}?${new URLSearchParams({ fields: "id,mimeType,capabilities(canAddChildren)", supportsAllDrives: "true" })}`
    : "https://www.googleapis.com/drive/v3/about?fields=user(displayName)";
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Drive connection failed");
  if (folderId) {
    const folder = await response.json();
    if (folder.mimeType !== "application/vnd.google-apps.folder" ||
        folder.capabilities?.canAddChildren === false) {
      throw new Error("Google Drive folder cannot accept files");
    }
  }
  return true;
}
