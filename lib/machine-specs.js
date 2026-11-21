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

export function normalizeSerial(value) {
  return clean(value, 100).replace(/\s+/g, "").toUpperCase();
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

  return { values, serialNumber: normalizeSerial(data.serialNumber) };
}

// "match" | "mismatch" | "unknown" (ฝั่งใดฝั่งหนึ่งไม่มี Serial)
export function compareSerial(assetSerial, machineSerial) {
  const asset = normalizeSerial(assetSerial);
  const machine = normalizeSerial(machineSerial);
  if (!asset || !machine) return "unknown";
  return asset === machine ? "match" : "mismatch";
}
