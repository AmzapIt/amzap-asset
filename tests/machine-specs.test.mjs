import assert from "node:assert/strict";
import test from "node:test";
import { compareSerial, normalizeSerial, parseMachineSpecs } from "../lib/machine-specs.js";

// ผลจริงจากสคริปต์ Windows (public/tools/amzap-specs-windows.bat)
const windowsOutput = JSON.stringify({
  amzapSpecs: 1,
  serialNumber: "5CD61208BJ",
  hostname: "LAPTOP-5AIER82G",
  ipAddress: "192.168.100.38",
  macAddress: "44:25:38:65:5B:C4",
  operatingSystem: "Windows 11 Home Single Language 25H2 (build 26200.9974)",
  cpu: "AMD Ryzen 7 7730U with Radeon Graphics",
  ramGb: 16,
  storageGb: 512,
  biosFirmware: "AMI F.25",
  screenSize: "15.3\"",
  resolution: "1920x1080",
  officeProduct: "Microsoft 365 Family/Personal",
  officeVersion: "16.0.20527.20196 (x64)",
  officeLicense: "Subscription (Microsoft 365)",
  officeAccount: "user@example.com",
  windowsActivation: "Activated (OEM)",
});

test("parses Windows script output into form values", () => {
  const { values, serialNumber } = parseMachineSpecs(`  ${windowsOutput}\r\n`);
  assert.equal(serialNumber, "5CD61208BJ");
  assert.deepEqual(values, {
    hostname: "LAPTOP-5AIER82G",
    operatingSystem: "Windows 11 Home Single Language 25H2 (build 26200.9974)",
    cpu: "AMD Ryzen 7 7730U with Radeon Graphics",
    biosFirmware: "AMI F.25",
    screenSize: "15.3\"",
    resolution: "1920x1080",
    officeProduct: "Microsoft 365 Family/Personal",
    officeVersion: "16.0.20527.20196 (x64)",
    officeLicense: "Subscription (Microsoft 365)",
    officeAccount: "user@example.com",
    windowsActivation: "Activated (OEM)",
    ramGb: "16",
    storageGb: "512",
    ipAddress: "192.168.100.38",
    macAddress: "44:25:38:65:5B:C4",
  });
});

test("parses Mac script output where numbers are strings and screen size is empty", () => {
  const { values } = parseMachineSpecs(JSON.stringify({
    amzapSpecs: 1, serialNumber: "LXFV7N6K50", hostname: "Mac-NB-042",
    ipAddress: "", macAddress: "a4:83:e7:01:02:0f", ramGb: "8", storageGb: "256",
    screenSize: "", resolution: "2560x1664",
  }));
  assert.equal(values.macAddress, "A4:83:E7:01:02:0F");
  assert.equal(values.ramGb, "8");
  assert.equal(values.storageGb, "256");
  assert.equal("ipAddress" in values, false);
  assert.equal("screenSize" in values, false);
});

test("normalizes MAC separators and drops invalid values instead of failing", () => {
  const { values } = parseMachineSpecs(JSON.stringify({
    amzapSpecs: 1, macAddress: "442538655BC4", ipAddress: "300.1.1.1",
    ramGb: "16 GB", storageGb: -5, cpu: "x".repeat(151), hostname: 42,
  }));
  assert.deepEqual(values, { hostname: "42", macAddress: "44:25:38:65:5B:C4" });
});

test("rounds sizes to two decimals and ignores zero", () => {
  const { values } = parseMachineSpecs(JSON.stringify({ amzapSpecs: 1, ramGb: 15.7349, storageGb: 0 }));
  assert.deepEqual(values, { ramGb: "15.73" });
});

test("rejects text that is not script output", () => {
  for (const input of ["", "hello", "[1]", "{}", JSON.stringify({ amzapSpecs: 2 }), null]) {
    assert.throws(() => parseMachineSpecs(input), /ไม่ใช่ผลจากสคริปต์ตรวจเครื่อง/);
  }
});

test("compares serial numbers ignoring case and spaces", () => {
  assert.equal(normalizeSerial(" 5cd6 1208bj "), "5CD61208BJ");
  assert.equal(compareSerial("5cd61208bj", "5CD61208BJ"), "match");
  assert.equal(compareSerial("LXFV7N6K50", "5CD61208BJ"), "mismatch");
  assert.equal(compareSerial("", "5CD61208BJ"), "unknown");
  assert.equal(compareSerial("5CD61208BJ", ""), "unknown");
});
