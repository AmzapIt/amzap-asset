import { getDbPool } from "./db.js";
import { getItStockLocation } from "./it-stock.js";

export class AssetMovementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (message, status) => {
  throw new AssetMovementError(message, status);
};

function requiredId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    fail(`Invalid ${label}`);
  }

  return value;
}

function optionalId(value, label) {
  if (value == null || value === "") {
    return null;
  }

  return requiredId(value, label);
}

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail("Invalid movement date");
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    fail("Invalid movement date");
  }

  return value;
}

function text(value, label, maximum, required = false) {
  if (value == null) {
    if (required) fail(`${label} is required`);
    return null;
  }

  if (typeof value !== "string") {
    fail(`${label} must be text`);
  }

  const normalized = value.trim();

  if (required && !normalized) {
    fail(`${label} is required`);
  }

  if (normalized.length > maximum) {
    fail(`${label} must be at most ${maximum.toLocaleString()} characters`);
  }

  return normalized || null;
}

function sameId(left, right) {
  return left == null && right == null
    ? true
    : String(left) === String(right);
}

async function requireActiveTarget(client, table, targetId, currentId, label) {
  if (targetId == null || sameId(targetId, currentId)) {
    return;
  }

  const result = await client.query(
    `SELECT id FROM public.${table} WHERE id=$1 AND is_active=true FOR SHARE`,
    [targetId],
  );

  if (!result.rowCount) {
    fail(`${label} must be active`);
  }
}

export async function moveAsset(
  assetId,
  body,
  changedByAccountId,
  pool = getDbPool(),
) {
  requiredId(assetId, "asset ID");
  requiredId(changedByAccountId, "account ID");

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail("Invalid request");
  }

  const requiredFields = [
    "toLocationId",
    "toDepartmentId",
    "toOwnerId",
    "expectedLocationId",
    "expectedDepartmentId",
    "expectedOwnerId",
  ];

  if (requiredFields.some((field) => !Object.hasOwn(body, field))) {
    fail("Movement state is incomplete");
  }

  const movementDate = date(body.movementDate);
  const reason = text(body.reason, "Reason", 1000, true);
  const notes = text(body.notes, "Notes", 10000);

  const targets = {
    locationId: optionalId(body.toLocationId, "location ID"),
    departmentId: optionalId(body.toDepartmentId, "department ID"),
    ownerId: optionalId(body.toOwnerId, "owner ID"),
  };
  const expected = {
    locationId: optionalId(body.expectedLocationId, "expected location ID"),
    departmentId: optionalId(
      body.expectedDepartmentId,
      "expected department ID",
    ),
    ownerId: optionalId(body.expectedOwnerId, "expected owner ID"),
  };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the asset so concurrent Movement/Edit/Assignment updates serialize.
    const asset = (
      await client.query(
        `SELECT id, status, asset_owner_id, owning_department_id, location_id
         FROM public.assets
         WHERE id=$1
         FOR UPDATE`,
        [assetId],
      )
    ).rows[0];

    if (!asset) {
      fail("Asset not found", 404);
    }

    const stale =
      !sameId(asset.location_id, expected.locationId) ||
      !sameId(asset.owning_department_id, expected.departmentId) ||
      !sameId(asset.asset_owner_id, expected.ownerId);

    if (stale) {
      fail("Asset movement data changed. Refresh and try again.", 409);
    }

    if (!sameId(asset.asset_owner_id, targets.ownerId)) {
      fail("เปลี่ยน Asset Owner ผ่านการรับคืนและเบิกใหม่ในเมนูดำเนินการ Asset เท่านั้น", 409);
    }

    const hasChange =
      !sameId(asset.location_id, targets.locationId) ||
      !sameId(asset.owning_department_id, targets.departmentId);

    if (!hasChange) {
      fail("Choose a new Department or Location");
    }

    if (!sameId(asset.location_id, targets.locationId)) {
      const itStock = await getItStockLocation(client);
      if (sameId(targets.locationId, itStock.id)) {
        const activeAssignment = await client.query(
          "SELECT 1 FROM public.asset_assignments WHERE asset_id=$1 AND returned_date IS NULL LIMIT 1",
          [assetId],
        );
        if (asset.status === "In Use" || activeAssignment.rowCount) {
          fail("รับคืนเข้าคลัง IT ผ่านหน้า Assignment เพื่อบันทึกเหตุผลและผู้รับ", 409);
        }
      }
      if (sameId(asset.location_id, itStock.id) && asset.status === "In Stock") {
        fail("มอบหมายจากคลัง IT ผ่านหน้า Assignment เพื่อบันทึกผู้ครอบครอง", 409);
      }
    }

    const today = (
      await client.query(
        "SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date::text AS today",
      )
    ).rows[0].today;

    if (movementDate > today) {
      fail("Future movement dates are not supported");
    }

    const latestMovementDate = (
      await client.query(
        `SELECT max(movement_date)::text AS movement_date
         FROM public.asset_movements
         WHERE asset_id=$1`,
        [assetId],
      )
    ).rows[0].movement_date;

    if (latestMovementDate && movementDate < latestMovementDate) {
      fail("Movement date cannot precede the latest movement");
    }

    await requireActiveTarget(
      client,
      "locations",
      targets.locationId,
      asset.location_id,
      "Location",
    );
    await requireActiveTarget(
      client,
      "departments",
      targets.departmentId,
      asset.owning_department_id,
      "Department",
    );
    const updatedAsset = (
      await client.query(
        `UPDATE public.assets
         SET location_id=$2,
             owning_department_id=$3,
             asset_owner_id=$4,
             updated_at=NOW()
         WHERE id=$1
         RETURNING id, location_id, owning_department_id, asset_owner_id`,
        [assetId, targets.locationId, targets.departmentId, targets.ownerId],
      )
    ).rows[0];

    const movement = (
      await client.query(
        `INSERT INTO public.asset_movements (
           asset_id, movement_date,
           from_location_id, to_location_id,
           from_department_id, to_department_id,
           from_owner_id, to_owner_id,
           reason, notes, changed_by_account_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *, movement_date::text AS movement_date`,
        [
          assetId,
          movementDate,
          asset.location_id,
          targets.locationId,
          asset.owning_department_id,
          targets.departmentId,
          asset.asset_owner_id,
          targets.ownerId,
          reason,
          notes,
          changedByAccountId,
        ],
      )
    ).rows[0];

    await client.query("COMMIT");

    return { movement, asset: updatedAsset };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
