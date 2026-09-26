// =========================================================
// Auth.js base configuration
// =========================================================

export const authConfig = {
  // Production และ local `next start` ทำงานหลัง reverse proxy
  // จึงต้องอนุญาตให้ Auth.js ใช้ Host header ของ request สร้าง callback URL
  trustHost: true,

  pages: {
    // ถ้ายังไม่ได้ login ให้ไปหน้า /login
    signIn: "/login",
  },

  callbacks: {
    // Proxy uses this lightweight config and reads custom values from the JWT.
    // Exposing only the forced-change flag is enough to restrict navigation.
    async session({ session, token }) {
      if (session.user) {
        session.user.mustChangePassword =
          token.mustChangePassword === true;
      }

      return session;
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      const isLoginPage = nextUrl.pathname.startsWith("/login");
      const isPasswordChangePage = nextUrl.pathname.startsWith(
        "/account/password",
      );
      const isPasswordChangeApi = nextUrl.pathname.startsWith(
        "/api/account/password",
      );

      // A temporary/legacy password creates a restricted session. It may use
      // only the change-password page and endpoint until the flag is cleared.
      if (
        isLoggedIn &&
        auth.user.mustChangePassword === true &&
        !isPasswordChangePage &&
        !isPasswordChangeApi
      ) {
        return Response.redirect(new URL("/account/password", nextUrl));
      }

      // ถ้า login แล้ว แต่ยังอยู่หน้า login
      // ให้กลับหน้าหลัก
      if (isLoginPage && isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }

      // หน้า login เปิดได้โดยไม่ต้อง login
      if (isLoginPage) {
        return true;
      }

      // หน้าอื่นต้อง login ก่อน
      return isLoggedIn;
    },
  },

  // provider จริงจะใส่ใน auth.js
  providers: [],
};
