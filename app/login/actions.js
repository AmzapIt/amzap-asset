"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

// =========================================================
// Login Action
// =========================================================
export async function loginAction(previousState, formData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),

      // login สำเร็จกลับหน้าหลัก
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return "Email หรือ Password ไม่ถูกต้อง";
      }

      return "ไม่สามารถเข้าสู่ระบบได้";
    }

    // redirect ของ Next.js ต้องปล่อยออกไป
    throw error;
  }
}