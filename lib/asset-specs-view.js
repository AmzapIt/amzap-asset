// สเปกเครื่องในกล่องลอยของหน้ารายการ Asset (ใช้ได้ทั้ง browser และ server)
// ไม่มีบัญชี Office เพราะเป็นอีเมลของผู้ใช้ ดูได้ที่ Asset Detail

export const SPECS_TYPE_PREFIXES = ["NB", "PC"];

function gb(value) {
  const number = Number(value);
  return value != null && value !== "" && Number.isFinite(number) ? `${number} GB` : "";
}

// คืนเฉพาะช่องที่มีค่า: [{ title, rows: [[label, value], ...] }, ...]
export function specsSections(technical) {
  if (!technical) return [];
  const extra = technical.extra_specs || {};
  const sections = [
    { title: "Technical Information", rows: [
      ["Hostname", technical.hostname],
      ["OS", technical.operating_system],
      ["CPU", technical.cpu],
      ["RAM", gb(technical.ram_gb)],
      ["Storage", gb(technical.storage_gb)],
      ["IP", technical.ip_address],
      ["MAC", technical.mac_address],
      ["BIOS", technical.bios_firmware],
      ["จอ", [extra.screenSize, extra.resolution].filter(Boolean).join(" · ")],
    ] },
    { title: "Software", rows: [
      ["Office", extra.officeProduct],
      ["Office Version", extra.officeVersion],
      ["Office License", extra.officeLicense],
      ["Windows", extra.windowsActivation],
    ] },
  ];
  return sections
    .map(({ title, rows }) => ({ title, rows: rows.filter(([, value]) => value) }))
    .filter(({ rows }) => rows.length > 0);
}
