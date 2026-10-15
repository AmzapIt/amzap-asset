import { getDbPool } from "../lib/db.js";
import {
  checkGoogleDriveConnection,
  ensureGoogleDriveLinkSharing,
  googleDriveFileIdFromUrl,
} from "../lib/google-drive.js";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) {
  console.error("Usage: node --env-file=.env.local scripts/share-asset-photos.mjs [--apply]");
  process.exitCode = 1;
} else {
  const pool = getDbPool();
  try {
    const result = await pool.query(
      `SELECT id::text AS id, storage_path
       FROM public.asset_documents
       WHERE document_type=$1
       ORDER BY id`,
      ["Asset Photo"],
    );
    const drivePhotos = result.rows.map((photo) => ({
      documentId: photo.id,
      fileId: googleDriveFileIdFromUrl(photo.storage_path),
    })).filter((photo) => photo.fileId);

    console.log(`Asset photos: ${result.rows.length}; Google Drive: ${drivePhotos.length}; skipped: ${result.rows.length - drivePhotos.length}`);
    if (!args.includes("--apply")) {
      console.log("Dry run only. Add --apply to set anyone-with-link reader access on these Drive files.");
    } else {
      await checkGoogleDriveConnection();
      let alreadyShared = 0;
      let newlyShared = 0;
      let failed = 0;

      for (const [index, photo] of drivePhotos.entries()) {
        try {
          const result = await ensureGoogleDriveLinkSharing(photo.fileId);
          if (result.alreadyShared) alreadyShared++;
          else newlyShared++;
        } catch (error) {
          failed++;
          console.error(`Document ${photo.documentId}: ${error.message}`);
        }
        if ((index + 1) % 10 === 0 || index + 1 === drivePhotos.length) {
          console.log(`Checked ${index + 1}/${drivePhotos.length}`);
        }
      }

      console.log(`Already shared: ${alreadyShared}; newly shared: ${newlyShared}; failed: ${failed}`);
      if (failed) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
