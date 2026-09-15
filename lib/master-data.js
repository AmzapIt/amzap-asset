import { query } from "./db.js";
import { masterConfig } from "./master-config.js";

export async function saveMaster(kind, body) {
  const config = masterConfig[kind];
  if (!config || !body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid master data");
  const columns = Object.keys(config.fields);
  const values = columns.map(key => {
    const value = body[key];
    if (value != null && (typeof value !== "string" || value.length > config.fields[key])) throw new Error(`Invalid ${key}`);
    return value?.trim() || null;
  });
  if (!values[0]) throw new Error("Name is required");
  if (kind === "vendors" && body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error("Invalid email");
  if (typeof body.is_active !== "boolean") throw new Error("Active status is required");
  columns.push("is_active"); values.push(body.is_active);
  if (body.id != null && (typeof body.id !== "string" || !/^[1-9]\d{0,18}$/.test(body.id))) throw new Error("Invalid ID");
  // Update full editor values, retain identifiers and created_at. Inactive records
  // remain available for existing assets and history; nothing is deleted.
  return body.id ? query(`UPDATE public.${kind} SET ${columns.map((c,i) => `${c}=$${i+1}`).join(",")} WHERE id=$${values.length+1} RETURNING *`, [...values,body.id])
    : query(`INSERT INTO public.${kind}(${columns.join(",")}) VALUES(${values.map((_,i)=>`$${i+1}`).join(",")}) RETURNING *`, values);
}

export async function validateAssetLookups(body, assetId = null) {
  const mappings = { department: ["departments", "owning_department_id"], location: ["locations", "location_id"], vendor: ["vendors", "vendor_id"] };
  for (const [field,[table,column]] of Object.entries(mappings)) {
    const value = body[field];
    if (value == null || value === "") continue;
    if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) throw new Error(`Invalid ${field}`);
    // An unchanged inactive lookup is valid on Edit; new selections must be active.
    const found = await query(`SELECT id FROM public.${table} WHERE id=$1 AND (is_active OR EXISTS(SELECT 1 FROM public.assets WHERE id=$2 AND ${column}=$1))`, [value,assetId]);
    if (!found.rowCount) throw new Error(`Invalid or inactive ${field}`);
  }
}
