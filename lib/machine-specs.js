// แปลงข้อมูลที่สคริปต์ตรวจเครื่อง (public/tools/amzap-specs-*) คัดลอกไว้ใน Clipboard
// ให้เป็นค่าสำหรับฟอร์ม Technical Information · ไฟล์นี้ใช้ได้ทั้งฝั่ง browser และ server
// สคริปต์ส่ง JSON บรรทัดเดียว: {"amzapSpecs":1,"serialNumber":"...","hostname":"...",...}

const TEXT_FIELDS = {
  hostname: 150,
  operatingSystem: 150,
  cpu: 150,
  biosFirmware: 150,
  screenSize: 100,
  resolution: 100,
  officeProduct: 300,
  officeVersion: 100,
  officeLicense: 100,
  officeAccount: 255,
  windowsActivation: 150,
};

const NUMBER_FIELDS = ["ramGb", "storageGb"];

function clean(value, maxLength = 150) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? "" : text;
}

function cleanNumber(value) {
  const text = clean(value, 30);
  if (!/^\d+(\.\d+)?$/.test(text)) return "";
  const rounded = Math.round(Number(text) * 100) / 100;
  return rounded > 0 ? String(rounded) : "";
}

function cleanIpv4(value) {
  const text = clean(value, 45);
  const parts = text.split(".");
  const valid = parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  return valid ? text : "";
}

function cleanMac(value) {
  const hex = clean(value, 30).replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 12) return "";
  return hex.toUpperCase().match(/.{2}/g).join(":");
}

// ค่าหลอกที่เมนบอร์ดบางรุ่น/เครื่องประกอบใส่ไว้แทนข้อมูลจริง
const PLACEHOLDER = /^(to be filled by o\.?e\.?m\.?|default string|system (serial number|product name|manufacturer|version)|chassis serial number|not specified|not applicable|none|null|n\/?a|invalid|oem|o\.e\.m\.?|0+|0?123456789|1234567890|x+)$/i;

function cleanReal(value, maxLength) {
  const text = clean(value, maxLength);
  return PLACEHOLDER.test(text) ? "" : text;
}

export function normalizeSerial(value) {
  return cleanReal(value, 100).replace(/\s+/g, "").toUpperCase();
}

// ชื่อยี่ห้อจากเครื่องมักยาวหรือตัวพิมพ์ไม่เหมือนกัน เช่น "Hewlett-Packard", "LENOVO", "Dell Inc."
const BRANDS = [
  [/^(hp|hewlett[- ]?packard)\b/i, "HP"],
  [/^lenovo\b/i, "Lenovo"],
  [/^dell\b/i, "Dell"],
  [/^(asustek|asus)\b/i, "ASUS"],
  [/^acer\b/i, "Acer"],
  [/^(micro-star|msi)\b/i, "MSI"],
  [/^apple\b/i, "Apple"],
  [/^microsoft\b/i, "Microsoft"],
  [/^gigabyte\b/i, "GIGABYTE"],
  [/^samsung\b/i, "Samsung"],
  [/^huawei\b/i, "HUAWEI"],
  [/^xiaomi\b/i, "Xiaomi"],
  [/^lg\b/i, "LG"],
  [/^fujitsu\b/i, "Fujitsu"],
  [/^(toshiba|dynabook)\b/i, "Dynabook"],
];

export function normalizeBrand(value) {
  const text = cleanReal(value, 100);
  if (!text) return "";
  const known = BRANDS.find(([pattern]) => pattern.test(text));
  if (known) return known[1];
  return text.replace(/[,.]?\s+(inc|corp|corporation|co\.?,?\s*ltd|ltd|limited|gmbh)\.?$/i, "").trim();
}

export function parseMachineSpecs(input) {
  let data;
  try {
    data = JSON.parse(String(input ?? "").trim());
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.amzapSpecs !== 1) {
    throw new Error("ข้อมูลที่วางไม่ใช่ผลจากสคริปต์ตรวจเครื่อง กรุณารันสคริปต์ใหม่แล้ววางอีกครั้ง");
  }

  const values = {};
  for (const [name, maxLength] of Object.entries(TEXT_FIELDS)) {
    const value = clean(data[name], maxLength);
    if (value) values[name] = value;
  }
  for (const name of NUMBER_FIELDS) {
    const value = cleanNumber(data[name]);
    if (value) values[name] = value;
  }
  const ipAddress = cleanIpv4(data.ipAddress);
  if (ipAddress) values.ipAddress = ipAddress;
  const macAddress = cleanMac(data.macAddress);
  if (macAddress) values.macAddress = macAddress;

  // Brand / Model เป็นช่องหลักของ Asset แยกจาก values (Technical / Software)
  const asset = {};
  const brand = normalizeBrand(data.brand);
  if (brand) asset.brand = brand;
  const model = cleanReal(data.model, 150);
  if (model) asset.model = model;

  return { values, asset, serialNumber: normalizeSerial(data.serialNumber) };
}

// Brand / Model / Serial ที่จะเปลี่ยนใน Asset
// Serial เติมเฉพาะตอนว่าง · Brand / Model เขียนทับเมื่อ overwrite = true ไม่งั้นเติมเฉพาะช่องว่าง
// ค่าที่สคริปต์อ่านไม่ได้จะไม่ลบค่าเดิม · คืน { brand:{from,to}, ... } เฉพาะช่องที่เปลี่ยน
export function assetIdentityChanges(current, specs, { overwrite = true } = {}) {
  const changes = {};
  const now = (value) => clean(value ?? "", 1000);
  for (const name of ["brand", "model"]) {
    const next = specs.asset?.[name];
    const before = now(current?.[name]);
    if (!next || next === before) continue;
    if (before && !overwrite) continue;
    changes[name] = { from: before, to: next };
  }
  if (specs.serialNumber && !now(current?.serialNumber)) {
    changes.serialNumber = { from: "", to: specs.serialNumber };
  }
  return changes;
}

// ตรวจไฟล์ .json หลายไฟล์ก่อนนำเข้า (ยังไม่จับคู่กับ Asset)
// status: "ok" | "invalid" | "no_serial" | "duplicate" (Serial ซ้ำในชุดเดียวกัน ใช้ไฟล์หลังสุด)
export function planMachineSpecsImport(files) {
  const plan = files.map(({ fileName, text }) => {
    try {
      // machine = Brand / Model ที่อ่านได้จากเครื่อง
      const { values, asset: machine, serialNumber } = parseMachineSpecs(text);
      if (!serialNumber) return { fileName, status: "no_serial", values, machine };
      return { fileName, status: "ok", serialNumber, values, machine };
    } catch (error) {
      return { fileName, status: "invalid", error: error.message };
    }
  });
  const lastIndex = new Map();
  plan.forEach((item, index) => { if (item.serialNumber) lastIndex.set(item.serialNumber, index); });
  return plan.map((item, index) => (
    item.serialNumber && lastIndex.get(item.serialNumber) !== index ? { ...item, status: "duplicate" } : item
  ));
}

// "match" | "mismatch" | "unknown" (ฝั่งใดฝั่งหนึ่งไม่มี Serial)
export function compareSerial(assetSerial, machineSerial) {
  const asset = normalizeSerial(assetSerial);
  const machine = normalizeSerial(machineSerial);
  if (!asset || !machine) return "unknown";
  return asset === machine ? "match" : "mismatch";
}
