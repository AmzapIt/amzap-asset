import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isLocalSettingsServer,
  readServerSettings,
  saveServerSettings,
  validatePhotoStorageSettings,
} from "../lib/server-settings.js";
import {
  DEFAULT_LABEL_PREFERENCES,
  labelPreferenceStyle,
  normalizeLabelPreferences,
} from "../lib/label-preferences.js";
import {
  ensureGoogleDriveLinkSharing,
  looksLikeGoogleAccessToken,
} from "../lib/google-drive.js";

test("warn when an access token is placed in the Google Drive refresh-token setting", () => {
  assert.equal(looksLikeGoogleAccessToken("ya29.example"), true);
  assert.equal(looksLikeGoogleAccessToken("1//example"), false);
  assert.equal(looksLikeGoogleAccessToken(null), false);
});

test("Google Drive link sharing creates only a reader permission and is safe to retry", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET", "GOOGLE_DRIVE_REFRESH_TOKEN"];
  const originals = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const calls = [];
  let permissionExists = false;
  process.env.GOOGLE_DRIVE_CLIENT_ID = "test-share-client";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-share-secret";
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "1//test-share-refresh";
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "test-share-access", expires_in: 3600 });
    }
    if (options.method === "POST") {
      permissionExists = true;
      return Response.json({ id: "permission-1", type: "anyone", role: "reader", allowFileDiscovery: false });
    }
    return Response.json({ permissions: permissionExists
      ? [{ id: "permission-1", type: "anyone", role: "reader", allowFileDiscovery: false }]
      : [] });
  };

  try {
    assert.deepEqual(await ensureGoogleDriveLinkSharing("photo_1"), {
      permissionId: "permission-1", alreadyShared: false,
    });
    assert.deepEqual(await ensureGoogleDriveLinkSharing("photo_1"), {
      permissionId: "permission-1", alreadyShared: true,
    });
    const creates = calls.filter((call) => call.options.method === "POST" && call.url.includes("/permissions"));
    assert.equal(creates.length, 1);
    assert.deepEqual(JSON.parse(creates[0].options.body), {
      type: "anyone", role: "reader", allowFileDiscovery: false,
    });
    await assert.rejects(ensureGoogleDriveLinkSharing("bad/file"), /Invalid Google Drive file ID/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (originals[name] === undefined) delete process.env[name];
      else process.env[name] = originals[name];
    }
  }
});

test("photo settings reject invalid modes, project paths, disk roots and folder IDs", () => {
  const projectRoot = path.join(tmpdir(), "amzap-app");
  const base = { photoStorageMode: "google_drive", localPhotoDir: "", googleDriveFolderId: "" };
  assert.throws(() => validatePhotoStorageSettings({ ...base, photoStorageMode: "other" }, projectRoot));
  assert.throws(() => validatePhotoStorageSettings({ ...base, photoStorageMode: "local" }, projectRoot));
  assert.throws(() => validatePhotoStorageSettings({ ...base, localPhotoDir: projectRoot }, projectRoot));
  assert.throws(() => validatePhotoStorageSettings({ ...base, localPhotoDir: path.parse(projectRoot).root }, projectRoot));
  assert.throws(() => validatePhotoStorageSettings({ ...base, googleDriveFolderId: "bad/id" }, projectRoot));
  assert.equal(validatePhotoStorageSettings({ ...base, photoStorageMode: "local", localPhotoDir: path.join(tmpdir(), "amzap-photos") }, projectRoot).photoStorageMode, "local");
  if (process.platform === "win32") {
    assert.equal(
      validatePhotoStorageSettings({ ...base, photoStorageMode: "local", localPhotoDir: "//Laptop-5aier82g/it/Asset" }, projectRoot).localPhotoDir,
      "//Laptop-5aier82g/it/Asset",
    );
  }
});

test("local settings persist only in the selected installation folder", { skip: !isLocalSettingsServer() }, async () => {
  const prefix = path.join(tmpdir(), "amzap-settings-test-");
  const projectRoot = await mkdtemp(prefix);
  const settings = { photoStorageMode: "local", localPhotoDir: path.join(tmpdir(), "amzap-photos"), googleDriveFolderId: "folder_123" };
  try {
    await saveServerSettings(settings, projectRoot);
    assert.deepEqual(readServerSettings(projectRoot), settings);
  } finally {
    if (path.resolve(projectRoot).startsWith(path.resolve(prefix))) {
      await rm(projectRoot, { recursive: true, force: true });
    }
  }
});

test("sticker preferences keep the 40 × 30 paper fixed and clamp display controls", () => {
  assert.deepEqual(normalizeLabelPreferences({ qrSizeMm: 99, offsetXmm: -2.5, offsetYmm: 0, codeFontPt: 9 }), {
    ...DEFAULT_LABEL_PREFERENCES,
    offsetXmm: -2.5,
  });
  assert.equal(labelPreferenceStyle({ qrSizeMm: 20 })["--label-qr-size"], "20mm");
});
