// Replaced by the session-based authorization implementation in step 11.
// New write endpoints remain closed during incremental installation.
export async function requireWrite() {
  return Response.json({ error: "Authentication setup required" }, { status: 503 });
}
