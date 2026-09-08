import { Pool } from "pg";

// เก็บ pool เดียวไว้ใช้ซ้ำ ลดการเปิด connection ใหม่ทุก request
const globalForDb = globalThis;

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForDb.dbPool) {
    globalForDb.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  return globalForDb.dbPool;
}

// ใช้สำหรับรัน SQL แบบ parameterized query เพื่อช่วยป้องกัน SQL injection
export async function query(text, values) {
  return getDbPool().query(text, values);
}
