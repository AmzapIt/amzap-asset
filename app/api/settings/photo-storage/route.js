import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { workflowAccount } from "@/lib/asset-workflow-api";
import { AssetWorkflowError } from "@/lib/asset-scan";
import { requireWrite } from "@/lib/access";
import { checkGoogleDriveConnection } from "@/lib/google-drive";
import {
  isLocalSettingsServer,
  readServerSettings,
  saveServerSettings,
  validatePhotoStorageSettings,
} from "@/lib/server-settings";

export const runtime = "nodejs";

async function requireSettingsReader() {
  const account = await workflowAccount();
  if (account.role !== "Admin") throw new AssetWorkflowError("Admin only", 403);
}

export async function GET() {
  try {
    await requireSettingsReader();
    return Response.json({
      success: true,
      settings: readServerSettings(),
      editable: isLocalSettingsServer(),
      driveCredentialsConfigured: Boolean(
        process.env.GOOGLE_DRIVE_CLIENT_ID &&
        process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
        process.env.GOOGLE_DRIVE_REFRESH_TOKEN
      ),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AssetWorkflowError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Read photo settings failed", error);
    return Response.json({ error: "Unable to read photo settings" }, { status: 500 });
  }
}

export async function PUT(request) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  if (!isLocalSettingsServer()) {
    return Response.json({ error: "Vercel settings must be changed in Vercel environment variables" }, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 1500) throw new Error("Settings are too long");
    const settings = validatePhotoStorageSettings(JSON.parse(raw));
    await saveServerSettings(settings);
    return Response.json({ success: true, settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError || error.message?.includes("path") ||
        error.message?.includes("folder") || error.message?.includes("Choose") ||
        error.message?.includes("Invalid") || error.message?.includes("long")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Save photo settings failed", error);
    return Response.json({ error: "Unable to save local server settings" }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireWrite(request, "Admin");
  if (denied) return denied;
  try {
    const { storage, localPhotoDir } = await request.json();
    if (storage === "google_drive") {
      await checkGoogleDriveConnection();
    } else if (storage === "local") {
      if (!isLocalSettingsServer()) {
        return Response.json({ error: "ตรวจโฟลเดอร์ Local server ได้จากเครื่อง local เท่านั้น" }, { status: 403 });
      }
      let directory;
      try {
        directory = validatePhotoStorageSettings({
          photoStorageMode: "local",
          localPhotoDir,
          googleDriveFolderId: "",
        }).localPhotoDir;
      } catch (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      try {
        const info = await stat(directory);
        if (!info.isDirectory()) return Response.json({ error: "path นี้ไม่ใช่โฟลเดอร์" }, { status: 400 });
        await access(directory, constants.R_OK | constants.W_OK);
      } catch (error) {
        const message = error.code === "ENOENT" || error.code === "ENOTDIR"
          ? "ไม่พบโฟลเดอร์นี้บนเครื่องที่รันเว็บ ตรวจชื่อเครื่อง ชื่อแชร์ และ path"
          : error.code === "EACCES" || error.code === "EPERM"
            ? "บัญชีที่รันเว็บไม่มีสิทธิ์อ่าน/เขียนโฟลเดอร์นี้ ตรวจสิทธิ์แชร์และสิทธิ์โฟลเดอร์"
            : "เข้าถึงโฟลเดอร์ไม่ได้ ตรวจว่าเครื่องปลายทางออนไลน์และบัญชีที่รันเว็บเข้าถึงแชร์ได้";
        return Response.json({ error: message }, { status: 503 });
      }
    } else {
      return Response.json({ error: "Invalid storage" }, { status: 400 });
    }
    return Response.json({
      success: true,
      ok: true,
      message: storage === "local" ? "เข้าถึง path ที่กรอกได้ (ยังไม่ได้บันทึก)" : "เชื่อมต่อได้",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error.message === "Google Drive access token was used instead of a refresh token"
        ? "ตั้งค่า Access Token ในช่อง Refresh Token กรุณาคัดลอกค่า Refresh token จาก Google OAuth Playground"
        : error.message === "Google Drive authorization expired"
          ? "Refresh Token ของ Google Drive ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิก กรุณาตรวจค่าอีกครั้ง"
          : "ยังเชื่อมต่อไม่ได้: ตรวจการตั้งค่าและสิทธิ์เข้าถึง",
    }, { status: 503 });
  }
}
