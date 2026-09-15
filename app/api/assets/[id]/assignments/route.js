import { changeAssignment, AssignmentError } from "@/lib/assignments";

export const runtime = "nodejs";
export async function POST(request, { params }) {
  // Fail closed until the authentication integration is installed in step 11.
  return Response.json({ error: "Assignment writes require authentication setup" }, { status: 503 });
}
