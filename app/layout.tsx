import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "./components/Sidebar";
import { auth } from "@/auth";
import "./globals.css";

// =========================================================
// Fonts
// =========================================================
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// =========================================================
// Browser metadata
// =========================================================
export const metadata: Metadata = {
  title: "AMZAP Asset",
  description: "AMZAP Asset Management System",
};

// =========================================================
// Root Layout
// =========================================================
export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  // อ่าน Login Session ฝั่ง Server
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full">
        {/* ถ้าไม่ได้ Login Sidebar จะ return null
            เช่นตอนอยู่หน้า /login */}
        <Sidebar user={session?.user ?? null} />

        {/* เนื้อหาของหน้าปัจจุบัน */}
        <div className="min-w-0 flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}