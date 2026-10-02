import assert from "node:assert/strict";
import test from "node:test";
import { authConfig } from "../auth.config.js";
import { readApiResponse } from "../lib/client-api.js";

function authorize(pathname, auth) {
  return authConfig.callbacks.authorized({
    auth,
    request: { nextUrl: new URL(pathname, "https://asset.example.com") },
  });
}

test("forced-password session is redirected away from normal pages", () => {
  const result = authorize("/assets", {
    user: { mustChangePassword: true },
  });

  assert.equal(result.status, 302);
  assert.equal(
    result.headers.get("location"),
    "https://asset.example.com/account/password",
  );
});

test("forced-password session may access password page and endpoint", () => {
  const session = { user: { mustChangePassword: true } };

  assert.equal(authorize("/account/password", session), true);
  assert.equal(authorize("/api/account/password", session), true);
});

test("ordinary logged-in session retains normal navigation", () => {
  assert.equal(
    authorize("/assets", { user: { mustChangePassword: false } }),
    true,
  );
});

test("expired sessions receive JSON errors from API routes instead of login HTML", async () => {
  const response = authorize("/api/accessories", null);
  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type"), /json/);
  assert.match((await response.json()).error, /เซสชันหมดอายุ/);
  assert.equal(authorize("/assets", null), false);
});

test("forced-password sessions receive JSON errors from API routes", async () => {
  const response = authorize("/api/users/1/offboarding", {
    user: { mustChangePassword: true },
  });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /เปลี่ยนรหัสผ่าน/);
});

test("client reports a login redirect instead of parsing HTML as JSON", async () => {
  const response = {
    redirected: true,
    url: "https://asset.example.com/login",
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "text/html" }),
  };
  await assert.rejects(readApiResponse(response), /เซสชันหมดอายุ/);
});

test("client identifies a missing API route instead of showing a JSON syntax error", async () => {
  await assert.rejects(
    readApiResponse(new Response("<!DOCTYPE html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    })),
    /ไม่พบ API.*404/,
  );
});

test("client keeps the API's validation message", async () => {
  await assert.rejects(
    readApiResponse(Response.json({ success: false, error: "กรุณาระบุเหตุผล" }, { status: 400 })),
    /กรุณาระบุเหตุผล/,
  );
});
