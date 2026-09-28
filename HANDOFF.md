# AMZAP Asset Management — เอกสารส่งต่องาน

อัปเดต: 29 กันยายน 2026 (Asia/Bangkok)

เอกสารนี้ใช้เริ่มทำงานต่อจากเครื่องอื่น โดยแยกสิ่งที่มีโค้ดแล้ว สิ่งที่ทดสอบแล้ว และสิ่งที่ยังต้องทำให้ชัดเจน ค่าการเชื่อมต่อ รหัสผ่าน และ Token เก็บแยกจาก Git

## 1. จุดที่ส่งต่องาน

| รายการ | สถานะ |
| --- | --- |
| Repository | [watchakornday/amzap-asset](https://github.com/watchakornday/amzap-asset) |
| Branch ที่ใช้งาน | `main` |
| Commit โค้ดล่าสุดที่ตรวจแล้ว | [`22de93e`](https://github.com/watchakornday/amzap-asset/commit/22de93ec6c946608d15de40ea7e1c91fd6970806) — Accessories Stock และการแก้ Settings/Password/Preview |
| โค้ดก่อนหน้า | `56bc563` — รูป Asset และรายงาน; `ad112d6` — Asset workflows และบัญชีระบบ |
| ฐานข้อมูล | PostgreSQL ผ่าน `DATABASE_URL` ฝั่ง Server |
| Stack | Next.js 16.3.4, React 19.2.8, Auth.js Credentials/JWT, `pg`, Tailwind CSS 4 |
| เครื่องที่ตรวจผ่าน | Node.js v25.2.1, npm 11.6.2, Windows PowerShell |
| เผยแพร่โค้ด | Push `22de93e` ขึ้น `origin/main` แล้ว |
| Production/Vercel | ยังไม่ได้ตรวจยืนยัน Deployment และทดสอบการใช้งานจริงหลัง Push ในรอบนี้ |

หลังเอกสารนี้อัปขึ้น GitHub จะมี Commit เอกสารต่อจาก `22de93e` ให้ดึง `main` ล่าสุด เอกสารนี้เป็นสถานะ ณ วันที่ข้างต้น ไม่ใช่ยอดสดของฐานข้อมูล

## 2. สิ่งที่ทำแล้วในรอบงานนี้

### 2.1 Accessories และ Stock กลาง

ข้อกำหนดที่ผู้ใช้ยืนยัน: **คลังกลางรวมทั้งบริษัท ไม่แยกโรงงาน 1/2**

- หน้า `/accessories` เป็น **Accessories / Stock** มีค้นหาประเภท ยี่ห้อ รุ่น Serial และกรองประเภท
- แสดงยอดพร้อมเบิกในคลัง จำนวนที่พนักงานถืออยู่ ยอดคงเหลือทั้งบริษัท และยอดตัดออก
- รับเข้ารายการเดิมหรือสร้างรายการ Stock ใหม่ พร้อมวันที่ ที่มา/เหตุผล และหมายเหตุ
- เบิกให้พนักงานจากหน้า Stock หรือส่วน Accessories ในหน้า `/users/[id]` โดยหักยอดพร้อมเบิก
- แก้จำนวนที่ถืออยู่ วันที่เบิก หมายเหตุ และรายการ Stock ที่เลือกผิด ส่วนต่างปรับยอดคลังอัตโนมัติ
- แก้ประเภท ยี่ห้อ รุ่น Serial ของ Stock และรายการที่ยังถืออยู่ที่เชื่อมกัน เก็บข้อมูลก่อน/หลังแก้ไข
- โอนระหว่างพนักงานได้บางส่วนหรือทั้งหมด โดยยอดคลังไม่เปลี่ยน
- คืนบางส่วนหรือทั้งหมด โดยเพิ่มยอดคลังเฉพาะจำนวนที่คืน
- ตัดออกได้ทั้งจากของในคลังและของที่พนักงานถืออยู่ เช่น เสีย สูญหาย เสื่อมสภาพ หรือเหตุผลอื่น
- ถ้ารายการมีประวัติคืน/โอน/ตัดออกแล้ว การเปลี่ยนชนิด Stock ใช้วิธีคืนส่วนที่เหลือและเบิกใหม่
- จำนวนที่มี Serial ใช้ 1 ชิ้นต่อรายการ และไม่รับ Serial เดิมซ้ำขณะที่มีของอยู่ในคลังหรือมีผู้ถืออยู่
- เมื่อจำนวนที่ถืออยู่เหลือ 0 ระบบปิดรายการและแสดงในประวัติรายการที่ปิดแล้ว
- ประวัติเก็บจำนวน ผลต่อยอดคลัง พนักงาน เหตุผล หมายเหตุ ผู้บันทึก และเวลา โหลดประวัติเก่าเพิ่มได้ครั้งละ 100 รายการ
- Server ตรวจสิทธิ์ Admin/IT Staff; Read-only ดูได้; พนักงาน Inactive รับเบิกใหม่หรือรับโอนไม่ได้ แต่คืน/โอนออก/ตัดออกได้
- Transaction, Advisory Lock, Row Lock, เวอร์ชัน และ Constraint ป้องกันยอดติดลบ/รายการเก่า การส่ง Request ID เดิมซ้ำไม่ตัดยอดซ้ำ
- Dashboard และรายงานใบรับมอบใช้ **จำนวนที่ยังถืออยู่** หลังคืน/โอน/ตัดออก
- เพิ่มการตรวจอ้างอิงประวัติ Accessories ก่อนลบพนักงาน

ไฟล์หลัก: [StockManager](app/accessories/StockManager.js), [AccessoryActionForm](app/accessories/AccessoryActionForm.js), [AccessoryHistory](app/accessories/AccessoryHistory.js), [AccessorySection](app/users/%5Bid%5D/AccessorySection.js), [inventory logic](lib/accessory-inventory.js), [read queries](lib/accessory-read.js), [API permissions](lib/accessory-api.js)

รายละเอียดการใช้งานและ Endpoint: [docs/accessory-stock.md](docs/accessory-stock.md)

### 2.2 Settings และบัญชี

- ย้าย **System Accounts** และ **Change Password** มารวมในเมนู **Settings** ทั้ง Desktop/Mobile
- System Accounts แสดงเฉพาะ Admin; Change Password ใช้ได้กับทุกบทบาท
- เปลี่ยนข้อกำหนดรหัสผ่านใหม่เป็น **6–12 ตัว ไม่มีข้อกำหนดชนิดตัวอักษรอื่น** ใช้ทั้งสร้างบัญชี รีเซ็ต และเปลี่ยนรหัสผ่านเอง
- อนุญาตให้ใช้รหัสผ่านเดิมซ้ำหากยาวอยู่ในช่วงที่กำหนด การเปลี่ยนด้วยตนเองยังต้องตรวจรหัสผ่านปัจจุบันและยืนยันรหัสผ่านให้ตรงกัน
- เก็บรหัสผ่านด้วย bcrypt; ไม่ส่ง Hash ไปหน้าเว็บ

ไฟล์หลัก: [Sidebar](app/components/Sidebar.js), [account-security](lib/account-security.js), [accounts](lib/accounts.js), [AccountManager](app/accounts/AccountManager.js), [ChangePasswordForm](app/account/password/ChangePasswordForm.js)

### 2.3 Preview รูปและ Google Drive

- แก้ ESLint ใน [AssetPhotoField](app/assets/AssetPhotoField.js) โดยใช้ callback ref ของ React 19 จัดการ Object URL และ cleanup เมื่อเปลี่ยนรูป/ถอด Preview
- ยังคงเลือก/ถ่ายรูปและ Preview, รองรับ JPG/PNG/WebP ไม่เกิน 4 MB
- เครื่องนี้มี Google Drive Client ID, Client Secret, Refresh Token และ Folder ID ครบ
- ในรอบตรวจการเชื่อมต่อก่อนหน้านี้ OAuth ตอบ HTTP 200 และอ่านโฟลเดอร์ได้ HTTP 200 พร้อม `canAddChildren: true`
- การตรวจดังกล่าว **ยังไม่ได้อัปโหลดรูปจริงผ่านหน้าเว็บ** และไม่ยืนยันการตั้งค่า Google Drive บน Production

คู่มือตั้งค่า: [docs/google-drive-photo-setup.md](docs/google-drive-photo-setup.md)

## 3. ฟีเจอร์เดิมที่มีโค้ดอยู่แล้ว

รายการด้านล่างตรวจจากโค้ดใน Repository ไม่ได้หมายความว่าได้ทดสอบผ่านหน้าจอจริงทุกกรณีในรอบนี้

| ส่วน | สิ่งที่มีโค้ดแล้ว | จุดเริ่มอ่าน |
| --- | --- | --- |
| Dashboard | สรุปสถานะ/ประเภท/Owner และ Accessories, รายการติดตาม | [app/page.tsx](app/page.tsx), [lib/dashboard.js](lib/dashboard.js) |
| Asset | List/Add/Edit/Detail, Serial Number, Owner, แผนก/Location, ข้อมูลเทคนิค/ความปลอดภัย/เอกสาร/ซ่อมบำรุง | [app/assets](app/assets), [lib/asset-additional.js](lib/asset-additional.js) |
| Assignment/Return | เบิกและคืน Asset พร้อมประวัติผู้ถือ | [lib/assignments.js](lib/assignments.js) |
| Asset Movement | เปลี่ยน Owner/แผนก/Location แยกจากผู้ถือและ Assignment | [lib/asset-movements.js](lib/asset-movements.js) |
| พนักงาน | List/Add/Edit/Detail, Active/Inactive, ชื่อเล่น, Location, การตรวจข้อมูลอ้างอิงก่อนลบ | [app/users](app/users) |
| Master Data | Departments, Locations, Vendors, Asset Types, Accessory Types และ Active/Inactive | [lib/master-config.js](lib/master-config.js), [app/master](app/master) |
| บัญชีระบบ | Login ด้วย Email/Username, Admin จัดการบัญชี/บทบาท/รีเซ็ตรหัส, บังคับเปลี่ยนรหัสผ่าน | [auth.js](auth.js), [auth.config.js](auth.config.js), [lib/accounts.js](lib/accounts.js) |
| Asset Code V2 | `F1-NB-001`, เลือกสถานที่ขึ้นทะเบียน, กรอกเลข 3 หลัก, Preview, Latest Running ตาม Asset Type ร่วมทุกโรงงาน, ตรวจเลขซ้ำใน API | [lib/asset-code.js](lib/asset-code.js), [app/api/assets/latest-code/route.js](app/api/assets/latest-code/route.js) |
| รูป Asset | Upload ผ่าน Server ไป Google Drive, ตรวจ MIME/ลายเซ็นไฟล์/ขนาด/สิทธิ์, รูปล่าสุดเป็นรูปหลัก, เก็บรายการเก่า | [lib/google-drive.js](lib/google-drive.js), [photo API](app/api/assets/%5Bid%5D/photos/route.js) |
| รายงาน | Export Asset เป็น Excel/PDF และใบรับมอบ Asset/Accessory, ตรวจผู้ถือก่อนสร้างเอกสาร | [app/reports](app/reports), [lib/export-files.js](lib/export-files.js), [lib/asset-report.js](lib/asset-report.js) |
| Mobile | Sidebar แบบ Drawer, การ์ดและฟอร์มที่ปรับตามขนาดหน้าจอ | [Sidebar](app/components/Sidebar.js), [AssetTable](app/assets/AssetTable.js), [UserTable](app/users/UserTable.js) |

กติกา Owner/Movement และผู้ถือ/Assignment เป็นคนละส่วน Location ปัจจุบันของ Asset ไม่ควรถูกทับด้วย Location เก่าใน Assignment

## 4. สถานะฐานข้อมูลที่ตรวจแล้ว

### 4.1 Accessories Migration 019

[migrations/019-accessory-stock.sql](migrations/019-accessory-stock.sql) **รันจริงแล้ว** กับฐานข้อมูลที่ `.env.local` เครื่องนี้เชื่อมอยู่ และตรวจแบบอ่านอย่างเดียวซ้ำวันที่ 29 กันยายน 2026

| รายการ | ผลที่ตรวจได้ |
| --- | --- |
| รายการพนักงานเดิม | 3 รายการ เก็บ ID/ข้อมูลเดิมไว้ครบ |
| รายการ Stock | 2 รายการ |
| พร้อมเบิกในคลัง | 0 ชิ้น |
| พนักงานถืออยู่ | 3 ชิ้น |
| รายการพนักงานที่ยังไม่เชื่อม Stock | 0 รายการ |
| ตารางใหม่ | `accessory_stock_items`, `accessory_stock_movements`, `accessory_operations` มีแล้ว |
| คอลัมน์ใหม่ใน `employee_accessories` | `stock_item_id`, counters คืน/โอน/ตัดออก, `close_reason`, `version` |

ยอดพร้อมเบิกเป็น 0 โดยตั้งใจ ยอดเปิดนับเฉพาะของที่พนักงานกำลังถืออยู่ ไม่สมมติว่าของที่เคยคืนยังอยู่ในคลัง ต้องตรวจนับของจริงแล้วบันทึกรับเข้าคลังกลาง

หากเครื่องใหม่ใช้ `DATABASE_URL` เดียวกัน จะเห็น Schema และข้อมูลชุดนี้ ไม่ต้องสร้างข้อมูลเปิดซ้ำ หากใช้ฐานข้อมูลอีกชุด ต้องตรวจ Schema และ Migration ของชุดนั้นก่อน

### 4.2 งานฐานข้อมูลที่พบว่ายังค้าง: Migration 018

ใน Repository มี [migrations/018-global-asset-type-running-number.sql](migrations/018-global-asset-type-running-number.sql) แต่ฐานข้อมูลที่เครื่องนี้เชื่อมอยู่ยังไม่อยู่ในรูปแบบที่ Migration นี้กำหนด:

- ไม่พบตาราง `public.asset_code_type_counters`
- `generate_asset_code()` และ `protect_asset_identity()` ยังอ้าง `asset_code_v2_counters` แบบแยก Site/Type
- ไม่พบ Trigger `trg_validate_asset_running_number` บน `assets`

**สิ่งที่ต้องทำต่อ:** ตรวจฐานข้อมูลเป้าหมายและข้อมูลเดิม ทดลอง Migration 018 ใน Transaction/ฐานทดสอบ แล้วดำเนินการกับฐานข้อมูลเป้าหมายและตรวจซ้ำ โค้ด Add/Latest Code มีการใช้เลขร่วมตาม Asset Type แล้ว แต่การสร้าง/ป้องกันเลขซ้ำที่ระดับฐานข้อมูลยังต้องอัปเดตตาม 018

รอบเขียนเอกสารนี้อ่าน Schema/ชื่อ Trigger เท่านั้น **ไม่ได้รัน Migration 018 หรือแก้ข้อมูล Asset**

### 4.3 การเริ่มฐานข้อมูลใหม่

- Repository มี Migration ตั้งแต่ 007 เป็นต้นไป และ 008 อยู่ที่ `app/migrations/008-employee-accessories.sql`
- ยังไม่มีชุด Schema/Seed ครบสำหรับสร้างฐานข้อมูลว่างจากศูนย์ใน Repository
- Migration บางไฟล์แก้ข้อมูลและอ้าง Schema/Location เดิม เช่น 009, 012, 013, 014 อย่ารันทุกไฟล์รวดเดียวกับฐานข้อมูลใหม่โดยไม่ตรวจ
- เครื่องใหม่ที่ทำต่อระบบเดิมควรใช้ Connection ของฐานข้อมูลเดิมที่เจ้าของระบบจัดเตรียมผ่านช่องทางเก็บ Secret หรือ Restore Schema/ข้อมูลที่จัดเตรียมไว้ก่อน
- `npm run dev` และ `npm run build` ไม่ได้รัน SQL Migration ให้เอง
- เมื่อใช้ฐานข้อมูลร่วม ให้ใช้โค้ดล่าสุดที่รองรับ Stock ในทุกเครื่องที่เขียน Accessories; API เก่าไม่ได้ทำบัญชีคลังตามกติกาใหม่

## 5. ผลตรวจที่เสร็จแล้ว

ผลด้านล่างมาจากการตรวจโค้ดที่ส่งขึ้นใน `22de93e` ก่อน Commit เอกสารนี้:

| การตรวจ | ผล |
| --- | --- |
| `npm test` | ผ่าน 42 Tests |
| `npm run lint` | ผ่าน ไม่มี ESLint error |
| `npm run build` | ผ่าน Compile, TypeScript และการสร้าง Routes |
| Migration 019 ก่อนใช้จริง | ทดลองใน Transaction ที่ Rollback และตรวจการรันซ้ำแล้วผ่านก่อน Apply |
| `npm run test:accessories:db` | ผ่าน 44 Checks หลังใช้ Migration จริงและเพิ่มการตรวจรายงาน/Serial/แบ่งหน้า |
| PostgreSQL Lock | ตรวจว่า Transaction ที่สองรับ Lock คลังกลางไม่ได้ขณะที่ตัวแรกถืออยู่ และรับได้หลังปล่อย |
| ข้อมูลจำลอง | Rollback ทั้งหมด; ตรวจแล้วไม่เหลือประเภท `QA stock` และรายการพนักงานเดิมไม่เปลี่ยน |
| หน้าจอหลัง Login | ยังไม่เสร็จ: แท็บที่ใช้ตรวจกลับหน้า Login แม้ผู้ใช้แจ้งว่า Login แล้ว จึงไม่ได้ยืนยันการคลิกจริง |

Integration test ใช้ PostgreSQL จริงใน Transaction ที่ Rollback อาจทำให้ Sequence เพิ่มเลขได้ตามพฤติกรรม PostgreSQL และถือ Lock คลังกลางระหว่างทดสอบ ควรใช้ฐานทดสอบเมื่อมีผู้ใช้งานระบบพร้อมกัน

Build ใช้ Google Fonts (`Geist`/`Geist Mono`) ต้องเชื่อมต่อ `fonts.googleapis.com` ได้ รอบที่ตรวจผ่านอนุญาต Network แล้ว ไม่ได้เปลี่ยนฟอนต์ในโปรเจกต์

## 6. สิ่งที่ยังไม่ได้ทำ / คิวทำต่อ

### งานถัดไปที่ควรทำ

| ลำดับ | งาน | เกณฑ์จบงาน |
| --- | --- | --- |
| 1 | ตรวจ/ใช้ Migration 018 กับ DB เป้าหมาย | มี Counter/Trigger ตาม 018; เลขของ Type เดียวกันร่วม F1/F2; เลขซ้ำถูกปฏิเสธและรหัสเดิมไม่เปลี่ยน |
| 2 | ทดสอบ Accessories ผ่าน Browser ที่ Login ได้จริง | รับ 10 → เบิก 4 เหลือคลัง 6 → คืน 1 เป็นคลัง 7/ถือ 3 → โอน 2 คลังยัง 7 → ตัดออกจากผู้ถือและคลังได้; ใช้ข้อมูลทดสอบที่จัดเตรียมไว้ |
| 3 | ตรวจนับและรับเข้า Stock ตั้งต้น | เจ้าของงานยืนยันจำนวนจริงและบันทึกที่มา ไม่เติมยอดจากการคาดเดาประวัติคืน |
| 4 | ทดสอบสิทธิ์บน UI | Admin/IT Staff เขียนได้; Read-only เขียนไม่ได้; Inactive รับเบิก/รับโอนไม่ได้; หน้าจอเก่าหรือส่งซ้ำไม่เปลี่ยนยอดซ้ำ |
| 5 | ทดสอบรูป Asset ผ่านเว็บครบขั้นตอน | Add/Edit เลือกรูป, Preview, Upload, เปิดลิงก์รูปใน Google Drive, MIME/ขนาดผิดถูกปฏิเสธ และเช็กกรณี Upload ไม่สำเร็จ |
| 6 | ตรวจ Production/Vercel หลัง Push | ตรวจ Commit ที่ Deploy, Environment, Login, DB, Accessories และ Google Drive ของ Environment นั้น ไม่สรุปว่า Push เท่ากับ Deploy สำเร็จ |
| 7 | ทดสอบ Mobile และรายงานจาก UI | ตรวจ Drawer, Settings, ฟอร์ม Accessories บนมือถือ, Excel/PDF/ใบรับมอบ และยอดคงเหลือหลังคืน/โอน |

ใบรับมอบเป็นการสร้างเอกสารแบบอ่านข้อมูล ไม่ได้เบิก/คืน/โอนอุปกรณ์ให้อัตโนมัติ การทำรายการจริงใช้หน้าจอ Asset/Accessories

### ฟีเจอร์รูปที่ยังไม่ครบตาม Backlog เดิม

- หน้า Detail ปัจจุบันแสดง **ลิงก์เอกสาร/รูปไป Google Drive** พร้อมป้ายรูปหลัก ยังไม่มี Gallery/Thumbnail ในหน้า Detail
- ยังไม่มี Endpoint ส่งเนื้อหารูป Private ผ่าน Server ของ AMZAP ให้ผู้ใช้ดูโดยไม่เปิด Drive
- ยังไม่มี UI/API ลบรูปที่อัปโหลดสำเร็จแล้วหรือเลือกสลับรูปหลักด้วยตนเอง; รูปที่ Upload ล่าสุดเป็นรูปหลัก
- `deleteGoogleDriveFile()` ที่มีอยู่ใช้ cleanup เมื่อบันทึก Upload ไม่สำเร็จ ไม่ใช่ฟีเจอร์ลบรูปสำหรับผู้ใช้
- ยังไม่มีการกำหนดจำนวนรูปสูงสุดต่อ Asset หรือการบีบอัดก่อน Upload
- ประวัติรูปหลัก/เก็บรายการเก่ามีแล้ว แต่ Audit Log สำหรับเพิ่ม/ลบ/เปลี่ยนรูปแบบเฉพาะยังไม่ได้ทำครบ
- การเปิดลิงก์รูป Private ใช้สิทธิ์ Google Drive ของผู้เปิดด้วย ต้องทดสอบกับบัญชีที่จะใช้งานจริง

### งานระบบที่ยังไม่มีชุดทำงานครบ

- ชุดสร้างฐานข้อมูลจากศูนย์และ Seed/Bootstrap Admin สำหรับฐานใหม่
- Automated Browser/E2E test suite และ Workflow CI ใน `.github/workflows` ยังไม่มีใน Repository
- ยังไม่ได้สร้าง/จัดการ Deployment หรือยืนยัน Environment ของ Production ในรอบงานนี้

## 7. เริ่มทำต่อบนเครื่องใหม่

### 7.1 ดึงโค้ดและติดตั้ง

ต้องมี Git, Node.js/npm และบัญชีที่เข้าถึง GitHub Repository นี้ เครื่องเดิมทดสอบด้วย Node v25.2.1/npm 11.6.2; ถ้าใช้รุ่นอื่นให้รัน Checks ใหม่ Next.js ที่ติดตั้งระบุขั้นต่ำ Node 20.9 แต่ DB integration script ใช้ `process.loadEnvFile()` จึงต้องใช้ Node ที่มี API นี้ด้วย

ตัวอย่าง Windows PowerShell:

```powershell
git clone https://github.com/watchakornday/amzap-asset.git
Set-Location amzap-asset
npm.cmd ci
Copy-Item -LiteralPath .env.example -Destination .env.local
```

คำสั่ง Copy ด้านบนสำหรับ Clone ใหม่ที่ยังไม่มี `.env.local` เท่านั้น หากมีค่าของเครื่องนั้นอยู่แล้วให้เก็บไฟล์เดิมและเติมเฉพาะค่าที่ขาด

สำหรับ Checkout เดิม ให้ตรวจ `git status` ก่อน จากนั้นดึงด้วย `git pull --ff-only origin main` โดยรักษางานที่ยังไม่ Commit ของเครื่องนั้นไว้

### 7.2 ตั้งค่า Environment แยกจาก Git

เติม `.env.local` จากช่องทางเก็บ Secret ของเจ้าของระบบ เอกสารและ `.env.example` มีเฉพาะชื่อค่า:

| ตัวแปร | ใช้ทำอะไร | สถานะเครื่องเดิม |
| --- | --- | --- |
| `DATABASE_URL` | Connection PostgreSQL | ตั้งแล้ว/อ่าน DB ได้ |
| `AUTH_SECRET` | Secret ของ Auth.js และ Proxy ต้องใช้ค่าเดียวกันใน App นี้ | ตั้งแล้ว |
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth Client ID | ตั้งแล้ว |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth Client Secret | ตั้งแล้ว |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | แลก Access Token ที่ Server | ตั้งแล้ว |
| `GOOGLE_DRIVE_FOLDER_ID` | โฟลเดอร์รับรูป | ตั้งแล้ว |
| `AUTH_URL` | URL ของ App เมื่อจำเป็นต้องกำหนดเอง | เครื่องเดิมไม่ได้ตั้ง; ตรวจ Host อัตโนมัติ |

ทุกค่าข้างต้นใช้ฝั่ง Server อย่าเติม `NEXT_PUBLIC_` ให้ค่าลับ หากตั้ง `AUTH_URL` บนเครื่องใหม่ให้ตรงกับ URL ของ Environment นั้น ไม่คัดลอก URL ของ Production มาใช้กับ Local

`.env.local` และ `env.download` ไม่อยู่ใน Git จึงไม่มากับ Clone ต้องเตรียมค่าตั้งค่าบนเครื่องใหม่เอง ใช้ Password/Secret Manager หรือการส่งไฟล์ที่เจ้าของระบบจัดเตรียม ห้ามเติมค่าจริงลงเอกสารที่ Commit

สำหรับ Local ที่แยกจาก Environment เดิมและยังไม่มี `AUTH_SECRET` สามารถสร้างค่าของตัวเองด้วยคำสั่งด้านล่างแล้วใส่ใน `.env.local` คำสั่งนี้แสดง Secret ทาง Terminal ของผู้รัน อย่านำผลไปใส่ใน Commit/แชต:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

ถ้าจะใช้ Environment เดิมให้รับ Secret ของ Environment นั้นจากเจ้าของ ไม่เปลี่ยน Production Secret ระหว่างตั้งค่าเครื่องใหม่ หลังแก้ `.env.local` ให้ Restart Dev Server

### 7.3 ตรวจ Schema แบบอ่านอย่างเดียวก่อนทำ Migration

ตัวอย่าง SQL สำหรับฐานข้อมูลเป้าหมาย:

```sql
SELECT
  to_regclass('public.app_accounts') AS accounts,
  to_regclass('public.employee_accessories') AS employee_accessories,
  to_regclass('public.accessory_stock_items') AS stock_items,
  to_regclass('public.accessory_stock_movements') AS stock_movements,
  to_regclass('public.accessory_operations') AS stock_operations,
  to_regclass('public.asset_code_type_counters') AS type_counters;
```

ค่า `NULL` หมายถึงไม่พบตารางนั้น ตรวจ Migration/ฐานข้อมูลเป้าหมายต่อ ก่อนใช้งาน Stock ต้องมี 019 และก่อนยืนยันตัวนับร่วมระดับ DB ต้องดำเนินการ 018 ให้ครบตามหัวข้อ 4

### 7.4 ตรวจและเปิดระบบ

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

เปิด `http://localhost:3000` แล้ว Login ด้วยบัญชีที่เจ้าของระบบจัดเตรียม Admin สำหรับทดสอบต้องเป็นบัญชี Active ใน `app_accounts` และถ้าถูกบังคับเปลี่ยนรหัสผ่านให้ทำขั้นตอนนั้นก่อน ไม่มีรหัสผ่าน Admin เก็บไว้ในเอกสารนี้

DB integration เป็นคำสั่งแยกที่ต้องเตรียม Connection และ Schema ให้ครบ:

```powershell
npm.cmd run test:accessories:db
# ทดลอง Migration ภายใน Transaction ที่ Rollback
npm.cmd run test:accessories:db -- --with-migration
```

บน macOS/Linux ใช้ `npm` แทน `npm.cmd` และ `cp .env.example .env.local` สำหรับ Clone ใหม่ หาก PowerShell ปฏิเสธ `npm.ps1` ใช้ `npm.cmd` ตามตัวอย่าง ไม่ต้องเปลี่ยน Execution Policy

## 8. สิ่งที่ควรรักษาเมื่อทำต่อ

- อ่าน [AGENTS.md](AGENTS.md) ก่อนแก้โค้ด และอ่าน Guide ที่เกี่ยวข้องใน `node_modules/next/dist/docs/` หลังติดตั้ง Dependencies ตามข้อกำหนดของ Next.js รุ่นนี้
- ใช้ `main` ล่าสุด; อย่า Reset ฐานข้อมูล/ประวัติหรือปรับยอดพร้อมเบิกเป็นจำนวนที่คาดเดา
- อย่าเอากติกา Asset Code แบบแยกโรงงานจาก Backlog เก่ามาใช้ทับกติกาเลขร่วมตาม Asset Type ในโค้ดปัจจุบัน
- รักษา Request ID เดิมเมื่อ Retry Mutation ที่ข้อมูลเดิม และใช้ `expected_version` ล่าสุดเมื่อแก้รายการ
- Backend เป็นผู้ตรวจสิทธิ์และคำนวณยอด; การซ่อนปุ่มบน UI ไม่ใช่การตรวจสิทธิ์
- Environment ของเครื่องใหม่และ Production ตั้งแยกกัน; การใช้ `DATABASE_URL` เดียวกันหมายถึงเขียนข้อมูลชุดเดียวกัน
- ก่อน Commit ให้ตรวจไฟล์ที่ Stage และใช้ข้อความ Commit ที่บอกงานจริง รัน Checks ตามส่วนที่แก้
- เครื่องเดิมไม่ได้ตั้ง Git `user.name`/`user.email` ถาวร Commit `22de93e` ใช้ข้อมูลผู้เขียนเดิมของ Repository เฉพาะคำสั่ง เครื่องใหม่ควรตั้งตัวตน Git ของผู้ที่จะ Commit ก่อน Push

ตัวอย่างตั้งตัวตนเฉพาะ Repository นี้ ให้แทนค่าตัวอย่างด้วยชื่อและอีเมล GitHub/อีเมล noreply ของผู้ที่จะ Commit:

```powershell
git config --local user.name "YOUR_GIT_NAME"
git config --local user.email "YOUR_GIT_EMAIL"
```

## 9. ข้อความเริ่มงานต่อที่คัดลอกใช้ได้

> อ่าน HANDOFF.md, PROJECT_BACKLOG.md และ AGENTS.md ใน Repository watchakornday/amzap-asset branch main ก่อนทำต่อ โค้ดระบบ Accessories/Stock กลางอยู่ใน Commit 22de93e และ Migration 019 ใช้แล้วในฐานข้อมูลเดิม แต่ Migration 018 ยังต้องตรวจ/ดำเนินการตามสถานะที่บันทึกไว้ ช่วยตรวจ Environment/Schema ของเครื่องนี้โดยไม่แสดง Secret แล้วทำงานค้างตามลำดับ โดยเริ่มจาก 018 และการทดสอบ Accessories ผ่าน Browser ที่ Login ได้จริง รักษาข้อมูลเดิมและอย่าเติม Stock ตั้งต้นจากการคาดเดา รายงานสิ่งที่ตรวจได้และข้อที่ยังไม่ตรวจแยกกัน
