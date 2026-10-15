import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { readServerSettings } from "./server-settings.js";

const EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const ASSET_ID_PATTERN = /^[1-9]\d{0,18}$/;
const FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export class LocalPhotoStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "LocalPhotoStorageError";
  }
}

export function assetPhotoStorageMode(value = readServerSettings().photoStorageMode) {
  const mode = value?.trim().toLowerCase() || "google_drive";
  if (mode !== "google_drive" && mode !== "local") {
    throw new LocalPhotoStorageError("ASSET_PHOTO_STORAGE must be google_drive or local");
  }
  return mode;
}

export function localPhotoRoot(value = readServerSettings().localPhotoDir, projectRoot = process.cwd()) {
  if (!value?.trim() || !path.isAbsolute(value.trim())) {
    throw new LocalPhotoStorageError("ASSET_PHOTO_DIR must be an absolute path");
  }
  const root = path.resolve(value.trim());
  const relativeToProject = path.relative(path.resolve(projectRoot), root);
  if (!relativeToProject.startsWith("..") && !path.isAbsolute(relativeToProject)) {
    throw new LocalPhotoStorageError("ASSET_PHOTO_DIR must be outside the project folder");
  }
  return root;
}

export function localPhotoUrl(assetId, fileName) {
  if (!ASSET_ID_PATTERN.test(String(assetId)) || !FILE_NAME_PATTERN.test(fileName)) {
    throw new LocalPhotoStorageError("Invalid local Asset photo path");
  }
  return `/api/assets/${assetId}/photos/${fileName}`;
}

export function localPhotoFilePath(assetId, fileName, root = localPhotoRoot()) {
  localPhotoUrl(assetId, fileName);
  return path.join(root, String(assetId), fileName);
}

export async function saveLocalAssetPhoto({ assetId, buffer, mimeType }) {
  const extension = EXTENSIONS.get(mimeType);
  if (!extension) throw new LocalPhotoStorageError("Unsupported Asset photo type");
  const fileName = `${randomUUID()}.${extension}`;
  const filePath = localPhotoFilePath(assetId, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, buffer, { flag: "wx", mode: 0o600 });
  } catch (error) {
    // A failed write can leave a partial file behind. Never touch another name.
    if (error.code !== "EEXIST") await unlink(filePath).catch(() => {});
    throw error;
  }
  return { fileName, storagePath: localPhotoUrl(assetId, fileName) };
}

export async function readLocalAssetPhoto(assetId, fileName) {
  return readFile(localPhotoFilePath(assetId, fileName));
}

export async function removeLocalAssetPhoto(assetId, fileName) {
  return unlink(localPhotoFilePath(assetId, fileName));
}
