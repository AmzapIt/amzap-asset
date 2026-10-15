# AMZAP Asset Management

ระบบจัดการ IT Asset, พนักงาน, การเบิก/คืน/โอน, Accessories คลังกลาง และรายงาน ใช้ Next.js 16.3.4, React 19.2.8, PostgreSQL และ Auth.js

## เริ่มอ่านเมื่อย้ายเครื่อง

1. [LATEST_CHANGES.md](LATEST_CHANGES.md) — สรุปโค้ดล่าสุดและวิธีดึงไปใช้อีกเครื่องแบบสั้น
2. [HANDOFF.md](HANDOFF.md) — รายละเอียดงานก่อนหน้าและการตั้งค่าเครื่องใหม่
3. [PROJECT_BACKLOG.md](PROJECT_BACKLOG.md) — คิวงานที่ยังต้องทำ/ตรวจ
4. [AGENTS.md](AGENTS.md) — ข้อกำหนดสำหรับแก้โค้ด Next.js รุ่นที่ติดตั้ง
5. [คู่มือ Accessories / Stock](docs/accessory-stock.md)
6. [ตั้งค่า Google Drive สำหรับรูป Asset](docs/google-drive-photo-setup.md)
7. [รหัสเอกสาร IT และเลขใบตรวจทรัพย์สิน](docs/it-document-numbering.md)

สถานะโค้ดล่าสุด: 2 ตุลาคม 2026 ดู [LATEST_CHANGES.md](LATEST_CHANGES.md); รายละเอียดใน HANDOFF.md ด้านล่างเป็นภาพรวมรอบก่อนหน้า

## เปิดระบบบนเครื่องใหม่

ต้องมี Git, Node.js/npm, สิทธิ์เข้าถึง Repository และค่าตั้งค่าจากเจ้าของระบบ เครื่องที่ตรวจผ่านใช้ Node.js v25.2.1/npm 11.6.2

```powershell
git clone https://github.com/watchakornday/amzap-asset.git
Set-Location amzap-asset
npm.cmd ci
Copy-Item -LiteralPath .env.example -Destination .env.local
```

Copy เฉพาะ Clone ใหม่ที่ยังไม่มี `.env.local` แล้วเติม `DATABASE_URL`, `AUTH_SECRET` และค่า Google Drive ที่ต้องใช้ ดูรายละเอียดและรายการ Environment ใน [HANDOFF.md](HANDOFF.md) ไฟล์ `.env.local` และ `env.download` ไม่มากับ Git

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

เปิด `http://localhost:3000` แล้ว Login ด้วยบัญชีระบบที่เจ้าของจัดเตรียม macOS/Linux ใช้ `npm` แทน `npm.cmd` และ `cp .env.example .env.local` สำหรับ Clone ใหม่

## ฐานข้อมูล

ใช้ฐานข้อมูลเดิมผ่าน `DATABASE_URL` หรือฐานที่ Restore โครงสร้างไว้แล้ว Repository ยังไม่มี Schema/Seed ครบสำหรับสร้างฐานว่างจากศูนย์ Dev/Build ไม่ได้รัน Migration อัตโนมัติ

- `migrations/019-accessory-stock.sql` ใช้แล้วกับฐานข้อมูลเดิม: คลังกลาง, 2 รายการ Stock, พร้อมเบิก 0 และพนักงานถือ 3 ชิ้น ณ วันที่ตรวจ
- `migrations/018-global-asset-type-running-number.sql` มีในโค้ด แต่ฐานข้อมูลเดิมยังใช้ตัวนับ Site/Type ต้องตรวจและดำเนินการตามงานค้างใน HANDOFF
- Migration `008-employee-accessories.sql` อยู่ที่ `app/migrations/` ส่วน Migration อื่นอยู่ที่ `migrations/`
- อย่ารัน Migration ทั้งหมดกับฐานใหม่โดยไม่ตรวจโครงสร้าง/ข้อมูลเป้าหมายก่อน

## คำสั่งตรวจเพิ่มเติม

```powershell
# ต้องมี PostgreSQL/Schema และบัญชี Admin Active ตามเงื่อนไขของ Integration test
npm.cmd run test:accessories:db
# ทดลอง Migration 019 ภายใน Transaction ที่ Rollback
npm.cmd run test:accessories:db -- --with-migration
```

ผลก่อน Commit เอกสาร: Unit Tests 42 ข้อ, Lint, Build และ PostgreSQL Integration Checks 44 ข้อผ่าน การทดสอบคลิก UI หลัง Login และการตรวจ Production ยังอยู่ในคิวงาน Build ต้องเชื่อมต่อ Google Fonts ได้ตามการตั้งค่าฟอนต์เดิม
