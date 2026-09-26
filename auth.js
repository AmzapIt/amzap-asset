import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { query } from "@/lib/db";

// =========================================================
// ดึง Account Login จาก PostgreSQL
// =========================================================
async function getAccountByLogin(login) {
  const result = await query(
    `
      SELECT
        id,
        email,
        username,
        display_name,
        password_hash,
        role,
        is_active,
        user_id,
        must_change_password
      FROM public.app_accounts
      WHERE (
        POSITION('@' IN $1) > 0
        AND LOWER(email) = LOWER($1)
      ) OR (
        POSITION('@' IN $1) = 0
        AND LOWER(username) = LOWER($1)
      )
      LIMIT 1
    `,
    [login],
  );

  return result.rows[0] ?? null;
}

// =========================================================
// Auth.js
// =========================================================
export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
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
            login: z.string().trim().min(1).max(255),
            // Existing legacy credentials may be shorter than the current
            // creation policy. They are accepted only when the database marks
            // the account as requiring an immediate password change.
            password: z.string().min(1).max(1000),
          })
          .safeParse({
            login: credentials.email,
            password: credentials.password,
          });

        if (!parsed.success) {
          return null;
        }

        const { login, password } = parsed.data;

        // -----------------------------------------------------
        // หา account จาก DB
        // -----------------------------------------------------
        const account = await getAccountByLogin(login);

        if (!account) {
          return null;
        }

        // Account ถูกปิดใช้งาน
        if (!account.is_active) {
          return null;
        }

        if (
          new TextEncoder().encode(password).length > 72 ||
          (password.length < 6 && !account.must_change_password)
        ) {
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
          mustChangePassword: account.must_change_password === true,
        };
      },
    }),
  ],

  callbacks: {
    // เก็บ role ลง JWT
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role;
        token.employeeUserId = user.employeeUserId;
        token.mustChangePassword = user.mustChangePassword;
      }

      // Session updates are initiated by the server after a successful
      // password change. Always reload the flag from the database instead of
      // trusting client-provided session data.
      if (trigger === "update" && token.sub) {
        const result = await query(
          `SELECT must_change_password
           FROM public.app_accounts
           WHERE id=$1 AND is_active=true
           LIMIT 1`,
          [token.sub],
        );
        token.mustChangePassword =
          result.rows[0]?.must_change_password === true;
      }

      return token;
    },

    // เอา role จาก JWT มาใส่ session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.employeeUserId = token.employeeUserId;
        session.user.mustChangePassword = token.mustChangePassword === true;
      }

      return session;
    },

    // ใช้ authorized callback เดิมจาก auth.config.js
    authorized: authConfig.callbacks.authorized,
  },
});
