import { query } from "./db.js";
import { masterConfig } from "./master-config.js";

// =========================================================
// Save Master Data
// =========================================================
export async function saveMaster(kind, body) {
  const config = masterConfig[kind];

  // ตรวจว่า Master ที่ส่งมาอยู่ใน Allowlist จริง
  if (!config || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid master data");
  }

  const columns = Object.keys(config.fields);

  // =======================================================
  // Validate field
  // =======================================================
  const values = columns.map((key) => {
    const value = body[key];

    if (
      value != null &&
      (typeof value !== "string" || value.length > config.fields[key])
    ) {
      throw new Error(`Invalid ${key}`);
    }

    let cleanedValue = value?.trim() || null;

    // Asset Type Prefix เก็บเป็นตัวใหญ่เสมอ
    if (kind === "asset_types" && key === "prefix" && cleanedValue) {
      cleanedValue = cleanedValue.toUpperCase();
    }

    return cleanedValue;
  });

  // field แรกของทุก Master คือ name
  if (!values[0]) {
    throw new Error("Name is required");
  }

  // =======================================================
  // Vendor email validation
  // =======================================================
  if (
    kind === "vendors" &&
    body.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  ) {
    throw new Error("Invalid email");
  }

  // =======================================================
  // Asset Type Prefix Validation
  //
  // ต้องตรงกับ constraint ของ PostgreSQL:
  // ^[A-Z0-9]{2,10}$
  //
  // ตัวอย่างที่ผ่าน:
  // NB
  // MON
  // DES
  // AP
  // NAS
  // =======================================================
if (kind === "asset_types") {
  // Normalize ให้เป็นตัวใหญ่ก่อน validate
  const prefix = body.prefix
    ?.trim()
    .toUpperCase();

  if (!prefix) {
    throw new Error("Prefix is required");
  }

  if (!/^[A-Z0-9]{2,10}$/.test(prefix)) {
    throw new Error(
      "Prefix ต้องเป็น A-Z หรือ 0-9 จำนวน 2-10 ตัว เช่น NB, MON, DES"
    );
  }
}


  // =======================================================
  // Active / Inactive
  // =======================================================
  if (typeof body.is_active !== "boolean") {
    throw new Error("Active status is required");
  }

  columns.push("is_active");
  values.push(body.is_active);

  // =======================================================
  // Validate ID ตอน Edit
  // =======================================================
  if (
    body.id != null &&
    (typeof body.id !== "string" || !/^[1-9]\d{0,18}$/.test(body.id))
  ) {
    throw new Error("Invalid ID");
  }

  // =======================================================
  // UPDATE
  // =======================================================
  if (body.id) {
    return query(
      `
        UPDATE public.${kind}
        SET ${columns
          .map((column, index) => `${column}=$${index + 1}`)
          .join(",")}
        WHERE id=$${values.length + 1}
        RETURNING *
      `,
      [...values, body.id],
    );
  }

  // =======================================================
  // INSERT
  // =======================================================
  return query(
    `
      INSERT INTO public.${kind}
      (${columns.join(",")})
      VALUES
      (${values.map((_, index) => `$${index + 1}`).join(",")})
      RETURNING *
    `,
    values,
  );
}

// =========================================================
// Validate Lookup ที่ Asset ใช้งาน
//
// Master ที่ Inactive:
// - ห้ามเลือกใหม่
// - แต่ Asset เดิมยังเก็บค่าเดิมไว้ได้
// =========================================================
export async function validateAssetLookups(body, assetId = null) {
  const mappings = {
    department: ["departments", "owning_department_id"],

    location: ["locations", "location_id"],

    vendor: ["vendors", "vendor_id"],
  };

  for (const [field, [table, column]] of Object.entries(mappings)) {
    const value = body[field];

    if (value == null || value === "") {
      continue;
    }

    if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) {
      throw new Error(`Invalid ${field}`);
    }

    const found = await query(
      `
        SELECT id
        FROM public.${table}
        WHERE id=$1
          AND (
            is_active
            OR EXISTS (
              SELECT 1
              FROM public.assets
              WHERE id=$2
                AND ${column}=$1
            )
          )
      `,
      [value, assetId],
    );

    if (!found.rowCount) {
      throw new Error(`Invalid or inactive ${field}`);
    }
  }
}
