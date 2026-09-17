import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { query } from "@/lib/db";

// =========================================================
// ดึง Account Login จาก PostgreSQL
// =========================================================
async function getAccountByEmail(email) {
  const result = await query(
    `
      SELECT
        id,
        email,
        display_name,
        password_hash,
        role,
        is_active,
        user_id
      FROM public.app_accounts
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

// =========================================================
// Auth.js
// =========================================================
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,

  // Secret สำหรับเข้ารหัส/เซ็น session ของ Auth.js
  secret: process.env.AUTH_SECRET,

  // ใช้ JWT session เพราะตอนนี้เราไม่ได้ใช้ Auth.js database adapter
  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        // -----------------------------------------------------
        // Validate input ก่อนยิง DB
        // -----------------------------------------------------
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // -----------------------------------------------------
        // หา account จาก DB
        // -----------------------------------------------------
        const account = await getAccountByEmail(email);

        if (!account) {
          return null;
        }

        // Account ถูกปิดใช้งาน
        if (!account.is_active) {
          return null;
        }

        // -----------------------------------------------------
        // ตรวจ password
        // -----------------------------------------------------
        const passwordMatches = await bcrypt.compare(
          password,
          account.password_hash,
        );

        if (!passwordMatches) {
          return null;
        }

        // -----------------------------------------------------
        // ข้อมูลที่จะถูกส่งเข้า JWT callback
        // ห้ามส่ง password_hash กลับ
        // -----------------------------------------------------
        return {
          id: String(account.id),
          email: account.email,
          name: account.display_name,
          role: account.role,
          employeeUserId: account.user_id ? String(account.user_id) : null,
        };
      },
    }),
  ],

  callbacks: {
    // เก็บ role ลง JWT
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.employeeUserId = user.employeeUserId;
      }

      return token;
    },

    // เอา role จาก JWT มาใส่ session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.employeeUserId = token.employeeUserId;
      }

      return session;
    },

    // ใช้ authorized callback เดิมจาก auth.config.js
    authorized: authConfig.callbacks.authorized,
  },
});
