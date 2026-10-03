const maintenanceStatuses = ["Open", "In Progress", "Completed", "Cancelled"];

export const additionalFieldNames = [
  "hostname", "ipAddress", "macAddress", "operatingSystem", "cpu",
  "ramGb", "storageGb", "biosFirmware", "vlan", "managementIp",
  "rack", "rackU", "screenSize", "resolution", "encryptionEnabled",
  "encryptionType", "antivirusEdr", "lastSecurityCheck", "patchStatus",
  "localAdminPolicy", "dataClassification", "lastAssetCheck", "securityNotes",
  "documentType", "documentName", "documentUrl", "maintenanceType",
  "maintenanceDescription", "maintenanceStatus", "maintenanceReportedAt",
  "maintenanceCompletedAt", "maintenanceCost", "maintenanceNotes",
  "maintenanceSentAt", "maintenanceSentTo", "maintenanceExpectedReturnAt",
];

export const emptyAdditionalForm = Object.fromEntries(
  additionalFieldNames.map((name) => [name, ""]),
);

function text(value, field, maxLength) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} ไม่ถูกต้อง`);
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Error(`${field} ยาวเกิน ${maxLength} ตัวอักษร`);
  return cleaned;
}

function date(value, field) {
  const cleaned = text(value, field, 10);
  if (cleaned === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) throw new Error(`${field} ไม่ใช่วันที่ที่ถูกต้อง`);
  const parsed = new Date(`${cleaned}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== cleaned) {
    throw new Error(`${field} ไม่ใช่วันที่ที่ถูกต้อง`);
  }
  return cleaned;
}

function decimal(value, field) {
  const cleaned = text(value, field, 30);
  if (cleaned === null) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(`${field} ต้องเป็นเลขไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง`);
  return cleaned;
}

function integer(value, field, min, max = 32767) {
  const cleaned = text(value, field, 10);
  if (cleaned === null) return null;
  if (!/^\d+$/.test(cleaned)) throw new Error(`${field} ต้องเป็นจำนวนเต็ม`);
  const number = Number(cleaned);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${field} ต้องอยู่ระหว่าง ${min}–${max}`);
  }
  return number;
}

function nullableBoolean(value, field) {
  if (value == null || value === "") return null;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`${field} ไม่ถูกต้อง`);
}

function ipAddress(value, field) {
  const cleaned = text(value, field, 45);
  if (cleaned === null) return null;
  const ipv4Parts = cleaned.split(".");
  const validIpv4 =
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  // PostgreSQL จะตรวจ IPv6 แบบละเอียดอีกชั้น รูปแบบเบื้องต้นนี้ป้องกัน
  // ข้อความทั่วไปไม่ให้หลุดไปเป็น Database error 500
  const validIpv6 = cleaned.includes(":") && /^[0-9a-f:]+$/i.test(cleaned);
  if (!validIpv4 && !validIpv6) throw new Error(`${field} ไม่ถูกต้อง`);
  return cleaned;
}

function macAddress(value) {
  const cleaned = text(value, "MAC Address", 30);
  if (cleaned === null) return null;
  if (!/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(cleaned)) {
    throw new Error("MAC Address ไม่ถูกต้อง");
  }
  return cleaned;
}

function hasValue(object) {
  return Object.values(object).some((value) => value !== null && value !== "");
}

export function parseAssetAdditional(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("ข้อมูลเพิ่มเติมไม่ถูกต้อง");
  }

  const technical = {
    hostname: text(body.hostname, "Hostname", 150),
    ipAddress: ipAddress(body.ipAddress, "IP Address"),
    macAddress: macAddress(body.macAddress),
    operatingSystem: text(body.operatingSystem, "Operating System", 150),
    cpu: text(body.cpu, "CPU", 150),
    ramGb: decimal(body.ramGb, "RAM"),
    storageGb: decimal(body.storageGb, "Storage"),
    biosFirmware: text(body.biosFirmware, "BIOS / Firmware", 150),
    vlan: integer(body.vlan, "VLAN", 1, 4094),
    managementIp: text(body.managementIp, "Management IP", 45),
    rack: text(body.rack, "Rack", 100),
    rackU: integer(body.rackU, "Rack U", 1),
    screenSize: text(body.screenSize, "Screen Size", 100),
    resolution: text(body.resolution, "Resolution", 100),
  };

  const security = {
    encryptionEnabled: nullableBoolean(body.encryptionEnabled, "Encryption"),
    encryptionType: text(body.encryptionType, "Encryption Type", 100),
    antivirusEdr: text(body.antivirusEdr, "Antivirus / EDR", 150),
    lastSecurityCheck: date(body.lastSecurityCheck, "Last Security Check"),
    patchStatus: text(body.patchStatus, "Patch Status", 100),
    localAdminPolicy: text(body.localAdminPolicy, "Local Admin Policy", 10000),
    dataClassification: text(body.dataClassification, "Data Classification", 100),
    lastAssetCheck: date(body.lastAssetCheck, "Last Asset Check"),
    securityNotes: text(body.securityNotes, "Security Notes", 10000),
  };

  const documentValues = {
    type: text(body.documentType, "Document Type", 100),
    name: text(body.documentName, "Document Name", 255),
    url: text(body.documentUrl, "Document URL", 2000),
  };
  let document = null;
  if (hasValue(documentValues)) {
    if (!documentValues.name || !documentValues.url) {
      throw new Error("Document ต้องระบุชื่อและ URL");
    }
    let parsedUrl;
    try { parsedUrl = new URL(documentValues.url); } catch { throw new Error("Document URL ไม่ถูกต้อง"); }
    if (parsedUrl.protocol !== "https:") throw new Error("Document URL ต้องเป็น HTTPS");
    document = documentValues;
  }

  const maintenanceValues = {
    type: text(body.maintenanceType, "Maintenance Type", 100),
    description: text(body.maintenanceDescription, "Maintenance Description", 10000),
    status: text(body.maintenanceStatus, "Maintenance Status", 30) || "Open",
    reportedAt: date(body.maintenanceReportedAt, "Reported Date"),
    completedAt: date(body.maintenanceCompletedAt, "Completed Date"),
    cost: decimal(body.maintenanceCost, "Maintenance Cost"),
    notes: text(body.maintenanceNotes, "Maintenance Notes", 10000),
    sentAt: date(body.maintenanceSentAt, "Sent Date"),
    sentTo: text(body.maintenanceSentTo, "Repair Provider", 255),
    expectedReturnAt: date(body.maintenanceExpectedReturnAt, "Expected Return Date"),
  };
  const maintenanceRequested = [
    maintenanceValues.type, maintenanceValues.description,
    maintenanceValues.reportedAt, maintenanceValues.completedAt,
    maintenanceValues.cost, maintenanceValues.notes, maintenanceValues.sentAt,
    maintenanceValues.sentTo, maintenanceValues.expectedReturnAt,
  ].some((value) => value !== null);
  let maintenance = null;
  if (maintenanceRequested) {
    if (!maintenanceValues.description) throw new Error("Maintenance ต้องระบุรายละเอียด");
    if (!maintenanceStatuses.includes(maintenanceValues.status)) throw new Error("Maintenance Status ไม่ถูกต้อง");
    const dispatchRequested = maintenanceValues.sentAt !== null ||
      maintenanceValues.sentTo !== null || maintenanceValues.expectedReturnAt !== null;
    if (dispatchRequested) {
      if (!maintenanceValues.sentAt || !maintenanceValues.sentTo) {
        throw new Error("การส่งซ่อมต้องระบุวันที่ส่งและร้าน/ผู้รับซ่อม");
      }
      if (maintenanceValues.status !== "In Progress") {
        throw new Error("เมื่อส่งซ่อมแล้ว สถานะ Maintenance ต้องเป็น In Progress");
      }
      if (maintenanceValues.expectedReturnAt &&
        maintenanceValues.expectedReturnAt < maintenanceValues.sentAt) {
        throw new Error("กำหนดรับคืนต้องไม่ก่อนวันที่ส่งซ่อม");
      }
    }
    if (maintenanceValues.reportedAt && maintenanceValues.completedAt && maintenanceValues.completedAt < maintenanceValues.reportedAt) {
      throw new Error("Completed Date ต้องไม่ก่อน Reported Date");
    }
    maintenance = maintenanceValues;
  }

  return {
    technical,
    technicalHasValues: hasValue(technical),
    security,
    securityHasValues: hasValue(security),
    document,
    maintenance,
  };
}

export function additionalFromApi(additional = {}) {
  const technical = additional.technical || {};
  const security = additional.security || {};
  return {
    ...emptyAdditionalForm,
    hostname: technical.hostname || "",
    ipAddress: technical.ip_address || "",
    macAddress: technical.mac_address || "",
    operatingSystem: technical.operating_system || "",
    cpu: technical.cpu || "",
    ramGb: technical.ram_gb == null ? "" : String(technical.ram_gb),
    storageGb: technical.storage_gb == null ? "" : String(technical.storage_gb),
    biosFirmware: technical.bios_firmware || "",
    vlan: technical.vlan == null ? "" : String(technical.vlan),
    managementIp: technical.management_ip || "",
    rack: technical.rack || "",
    rackU: technical.rack_u == null ? "" : String(technical.rack_u),
    screenSize: technical.extra_specs?.screenSize || technical.extra_specs?.screen_size || "",
    resolution: technical.extra_specs?.resolution || "",
    encryptionEnabled: security.encryption_enabled == null ? "" : String(security.encryption_enabled),
    encryptionType: security.encryption_type || "",
    antivirusEdr: security.antivirus_edr || "",
    lastSecurityCheck: security.last_security_check || "",
    patchStatus: security.patch_status || "",
    localAdminPolicy: security.local_admin_policy || "",
    dataClassification: security.data_classification || "",
    lastAssetCheck: security.last_asset_check || "",
    securityNotes: security.security_notes || "",
  };
}

export async function saveAssetAdditional(client, assetId, parsed, accountId = null) {
  if (parsed.technicalHasValues) {
    const t = parsed.technical;
    await client.query(
      `INSERT INTO public.asset_technical
       (asset_id, hostname, ip_address, mac_address, operating_system, cpu, ram_gb,
        storage_gb, bios_firmware, vlan, management_ip, rack, rack_u, extra_specs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (asset_id) DO UPDATE SET
         hostname=EXCLUDED.hostname, ip_address=EXCLUDED.ip_address,
         mac_address=EXCLUDED.mac_address, operating_system=EXCLUDED.operating_system,
         cpu=EXCLUDED.cpu, ram_gb=EXCLUDED.ram_gb, storage_gb=EXCLUDED.storage_gb,
         bios_firmware=EXCLUDED.bios_firmware, vlan=EXCLUDED.vlan,
         management_ip=EXCLUDED.management_ip, rack=EXCLUDED.rack,
         rack_u=EXCLUDED.rack_u, extra_specs=EXCLUDED.extra_specs, updated_at=NOW()`,
      [assetId, t.hostname, t.ipAddress, t.macAddress, t.operatingSystem, t.cpu,
       t.ramGb, t.storageGb, t.biosFirmware, t.vlan, t.managementIp, t.rack,
       t.rackU, JSON.stringify({ screenSize: t.screenSize, resolution: t.resolution })],
    );
  } else {
    await client.query("DELETE FROM public.asset_technical WHERE asset_id=$1", [assetId]);
  }

  if (parsed.securityHasValues) {
    const s = parsed.security;
    await client.query(
      `INSERT INTO public.asset_security
       (asset_id, encryption_enabled, encryption_type, antivirus_edr,
        last_security_check, patch_status, local_admin_policy, data_classification,
        last_asset_check, security_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (asset_id) DO UPDATE SET
         encryption_enabled=EXCLUDED.encryption_enabled,
         encryption_type=EXCLUDED.encryption_type, antivirus_edr=EXCLUDED.antivirus_edr,
         last_security_check=EXCLUDED.last_security_check, patch_status=EXCLUDED.patch_status,
         local_admin_policy=EXCLUDED.local_admin_policy,
         data_classification=EXCLUDED.data_classification,
         last_asset_check=EXCLUDED.last_asset_check,
         security_notes=EXCLUDED.security_notes, updated_at=NOW()`,
      [assetId, s.encryptionEnabled, s.encryptionType, s.antivirusEdr,
       s.lastSecurityCheck, s.patchStatus, s.localAdminPolicy,
       s.dataClassification, s.lastAssetCheck, s.securityNotes],
    );
  } else {
    await client.query("DELETE FROM public.asset_security WHERE asset_id=$1", [assetId]);
  }

  if (parsed.document) {
    const d = parsed.document;
    await client.query(
      `INSERT INTO public.asset_documents
       (asset_id, document_type, file_name, storage_path, uploaded_by_account_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [assetId, d.type, d.name, d.url, accountId],
    );
  }

  if (parsed.maintenance) {
    const m = parsed.maintenance;
    await client.query(
      `INSERT INTO public.asset_maintenance
       (asset_id, maintenance_type, description, status, reported_at,
        completed_at, cost, notes, recorded_by_account_id, sent_at, sent_to,
        expected_return_at)
       VALUES ($1,$2,$3,$4,
         COALESCE($5::date AT TIME ZONE 'Asia/Bangkok', NOW()),
         $6::date AT TIME ZONE 'Asia/Bangkok',$7,$8,$9,$10,$11,$12)`,
      [assetId, m.type, m.description, m.status, m.reportedAt,
       m.completedAt, m.cost, m.notes, accountId, m.sentAt, m.sentTo,
       m.expectedReturnAt],
    );
  }
}
