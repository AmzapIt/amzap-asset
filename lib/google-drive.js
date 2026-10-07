import { randomUUID } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

function googleDriveConfig() {
  const config = {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  };

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error("Google Drive upload is not configured");
  }

  return config;
}

// Refresh Token อยู่เฉพาะฝั่ง Server และใช้แลก Access Token อายุสั้นทุกครั้ง
// จึงไม่มี Google Secret หรือ Token ถูกส่งไปที่ Browser
async function getGoogleDriveAccessToken() {
  const config = googleDriveConfig();
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

  return { accessToken: data.access_token, folderId: config.folderId };
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
