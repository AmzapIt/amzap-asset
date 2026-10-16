import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { isViewableAssetDocumentUrl, shouldMakePrimaryPhoto } from "../lib/asset-photo-links.js";
import { googleDriveFileIdFromUrl } from "../lib/google-drive.js";
import {
  assetPhotoStorageMode,
  localPhotoFilePath,
  localPhotoRoot,
  localPhotoUrl,
  readLocalAssetPhoto,
  removeLocalAssetPhoto,
  saveLocalAssetPhoto,
} from "../lib/local-asset-photos.js";

test("first photo is primary; later secondary uploads keep the existing primary", () => {
  assert.equal(shouldMakePrimaryPhoto(false, false), true);
  assert.equal(shouldMakePrimaryPhoto(false, true), false);
  assert.equal(shouldMakePrimaryPhoto(true, true), true);
});

test("local photo storage is opt-in and requires an external absolute folder", () => {
  assert.equal(assetPhotoStorageMode(""), "google_drive");
  assert.equal(assetPhotoStorageMode("local"), "local");
  assert.throws(() => assetPhotoStorageMode("other"));
  assert.throws(() => localPhotoRoot("photos"));
  assert.throws(() => localPhotoRoot(path.join(process.cwd(), "photos")));
  assert.equal(localPhotoRoot(path.join(tmpdir(), "amzap-photos")), path.resolve(tmpdir(), "amzap-photos"));
});

test("local photo names cannot traverse directories", () => {
  const fileName = "123e4567-e89b-42d3-a456-426614174000.jpg";
  const url = localPhotoUrl("12", fileName);
  assert.equal(url, `/api/assets/12/photos/${fileName}`);
  assert.equal(isViewableAssetDocumentUrl(url), true);
  assert.equal(isViewableAssetDocumentUrl("https://drive.google.com/file/example"), true);
  assert.equal(isViewableAssetDocumentUrl("/api/assets/12/photos/../../secret"), false);
  assert.throws(() => localPhotoFilePath("12", "../secret", tmpdir()));
});

test("Google Drive preview accepts only a Drive file-view URL", () => {
  assert.equal(googleDriveFileIdFromUrl("https://drive.google.com/file/d/abc-123_X/view?usp=sharing"), "abc-123_X");
  assert.equal(googleDriveFileIdFromUrl("https://drive.google.com.evil.example/file/d/abc/view"), null);
  assert.equal(googleDriveFileIdFromUrl("https://example.com/file/d/abc/view"), null);
  assert.equal(googleDriveFileIdFromUrl("/api/assets/12/photos/file.jpg"), null);
});

test("local photo can be saved, read and removed outside the project", async () => {
  const prefix = path.join(tmpdir(), "amzap-photo-test-");
  const root = await mkdtemp(prefix);
  const previous = process.env.ASSET_PHOTO_DIR;
  process.env.ASSET_PHOTO_DIR = root;
  try {
    const original = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
    const saved = await saveLocalAssetPhoto({ assetId: "12", buffer: original, mimeType: "image/jpeg" });
    assert.equal(isViewableAssetDocumentUrl(saved.storagePath), true);
    assert.deepEqual(await readLocalAssetPhoto("12", saved.fileName), original);
    await removeLocalAssetPhoto("12", saved.fileName);
    await assert.rejects(() => readLocalAssetPhoto("12", saved.fileName), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.ASSET_PHOTO_DIR;
    else process.env.ASSET_PHOTO_DIR = previous;
    if (path.resolve(root).startsWith(path.resolve(prefix))) {
      await rm(root, { recursive: true, force: true });
    }
  }
});
