import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ให้ไลบรารีสร้างไฟล์ทำงานบน Node.js โดยตรง แทนการ bundle dependency ภายในทั้งหมด
  serverExternalPackages: ["pdfmake", "exceljs"],
  // รวมฟอนต์ ใบอนุญาต และโลโก้ในไฟล์ deploy ของ Export เพื่อให้ PDF ทำงานได้บนเครื่องอื่น
  outputFileTracingIncludes: {
    "/api/reports/export": ["./resources/reports/**/*"],
    "/api/asset-requisitions/**": ["./resources/reports/**/*"],
  },
};

export default nextConfig;
