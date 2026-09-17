import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Proxy ต้องใช้ AUTH_SECRET ตัวเดียวกับ auth.js
export default NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
}).auth;



export const config = {
  matcher: [
    /*
     * ไม่ต้องตรวจ:
     * - /api/auth
     * - _next/static
     * - _next/image
     * - favicon / image files
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)",
  ],
};