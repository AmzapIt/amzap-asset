import assert from "node:assert/strict";
import test from "node:test";
import { searchEmployees } from "../lib/employee-search.js";

const employees = [
  { id: 1, employee_code: "AMZ-101", full_name: "สมชาย ใจดี", nickname: "บอย" },
  { id: 2, employee_code: "AMZ-102", full_name: "Suda Saelim", nickname: "May" },
];

test("employee picker searches full name, nickname, and employee code", () => {
  assert.deepEqual(searchEmployees(employees, "สมชาย").map((user) => user.id), [1]);
  assert.deepEqual(searchEmployees(employees, "บอย").map((user) => user.id), [1]);
  assert.deepEqual(searchEmployees(employees, "amz-102").map((user) => user.id), [2]);
  assert.deepEqual(searchEmployees(employees, "suda may").map((user) => user.id), [2]);
});

test("employee picker keeps the full list before searching", () => {
  assert.equal(searchEmployees(employees, "  "), employees);
  assert.deepEqual(searchEmployees(employees, "unknown"), []);
});
