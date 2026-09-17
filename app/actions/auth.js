"use server";

import { signOut } from "@/auth";

// =========================================================
// Logout
// =========================================================
export async function logoutAction() {
  // ลบ Session แล้วกลับไปหน้า Login
  await signOut({
    redirectTo: "/login",
  });
}