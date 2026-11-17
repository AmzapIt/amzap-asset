import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const SETTINGS_FILE = ".server-settings.json";

export function isLocalSettingsServer() {
  return !process.env.VERCEL;
}

export function serverSettingsPath(projectRoot = process.cwd()) {
  return path.join(projectRoot, SETTINGS_FILE);
}

export function validatePhotoStorageSettings(value, projectRoot = process.cwd()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid photo settings");
  }
  const { photoStorageMode, localPhotoDir, googleDriveFolderId } = value;
  if (!["google_drive", "supabase", "local"].includes(photoStorageMode)) {
    throw new Error("Choose Google Drive, Supabase, or local server");
  }
  if (typeof localPhotoDir !== "string" || localPhotoDir.length > 500 ||
      typeof googleDriveFolderId !== "string" || googleDriveFolderId.length > 150 ||
      (googleDriveFolderId && !/^[A-Za-z0-9_-]+$/.test(googleDriveFolderId))) {
    throw new Error("Invalid folder or path");
  }
  const directory = localPhotoDir.trim();
  if (directory) {
    if (!path.isAbsolute(directory)) throw new Error("Local photo path must be absolute");
    const resolved = path.resolve(directory);
    const relative = path.relative(path.resolve(projectRoot), resolved);
    if ((!relative.startsWith("..") && !path.isAbsolute(relative)) ||
        resolved === path.parse(resolved).root) {
      throw new Error("Choose a photo folder outside the app, not a disk root");
    }
  }
  if (photoStorageMode === "local" && !directory) {
    throw new Error("Specify a local photo folder first");
  }
  return {
    photoStorageMode,
    localPhotoDir: directory,
    googleDriveFolderId: googleDriveFolderId.trim(),
  };
}

export function readServerSettings(projectRoot = process.cwd()) {
  const defaults = {
    photoStorageMode: process.env.ASSET_PHOTO_STORAGE || "google_drive",
    localPhotoDir: process.env.ASSET_PHOTO_DIR || "",
    googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
  };
  if (!isLocalSettingsServer()) return defaults;
  try {
    const stored = JSON.parse(readFileSync(serverSettingsPath(projectRoot), "utf8"));
    return {
      photoStorageMode: stored.photoStorageMode ?? defaults.photoStorageMode,
      localPhotoDir: stored.localPhotoDir ?? defaults.localPhotoDir,
      googleDriveFolderId: stored.googleDriveFolderId ?? defaults.googleDriveFolderId,
    };
  } catch (error) {
    if (error.code === "ENOENT") return defaults;
    throw error;
  }
}

export async function saveServerSettings(settings, projectRoot = process.cwd()) {
  if (!isLocalSettingsServer()) throw new Error("Vercel settings are managed through environment variables");
  const target = serverSettingsPath(projectRoot);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
