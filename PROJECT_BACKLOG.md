# AMZAP Asset Management — Project Backlog

อัปเดต 29 กันยายน 2026 อ้างอิงโค้ด `22de93e` และการอ่าน Schema ของฐานข้อมูลที่เครื่องเดิมเชื่อมอยู่ รายละเอียดเริ่มงานข้ามเครื่องดู [HANDOFF.md](HANDOFF.md)

เอกสารนี้แทนสถานะ Planned เก่าที่ไม่ได้อัปเดตตามโค้ด คำว่า “มีโค้ดแล้ว” และ “ตรวจผ่านแล้ว” เป็นคนละสถานะ ส่วน Production ยังไม่ได้ตรวจยืนยันในรอบนี้

## สิ่งที่ส่งขึ้น main แล้ว

- [x] Asset List/Add/Edit/Detail, Assignment/Return, Movement, พนักงาน, Master Data และบัญชีระบบ มีโค้ดใน Repository
- [x] Asset Code V2, Preview, เลข 3 หลัก และ Latest Running ตาม Asset Type ร่วมทุกโรงงาน มีโค้ดใน App/API
- [x] Export Excel/PDF และใบรับมอบ Asset/Accessory มีโค้ด ตรวจผู้ถือและอ่านข้อมูลใหม่ก่อนออกเอกสาร
- [x] Upload รูปไป Google Drive ผ่าน Server, JPG/PNG/WebP ไม่เกิน 4 MB, ตรวจเนื้อหาไฟล์ และรูปล่าสุดเป็นรูปหลัก มีโค้ดแล้ว
- [x] ตรวจ OAuth/สิทธิ์อ่านโฟลเดอร์ Google Drive ของ Local ผ่านแล้ว ยังไม่ได้ทดสอบ Upload จริงจาก UI
- [x] Settings รวม System Accounts และ Change Password ทั้ง Desktop/Mobile
- [x] รหัสผ่านใหม่ 6–12 ตัว ไม่มีข้อกำหนดชนิดตัวอักษรอื่น
- [x] แก้ ESLint และ Object URL cleanup ของ Preview รูป
- [x] Accessories คลังกลาง: รับเข้า เบิก แก้ไข โอนบางส่วน/ทั้งหมด คืนบางส่วน/ทั้งหมด ตัดออกพร้อมเหตุผล และประวัติ
- [x] Migration 019 ใช้แล้วกับฐานข้อมูลเดิมและรายการพนักงานเดิมยังอยู่ครบ
- [x] รายงาน/Dashboard ใช้จำนวน Accessories ที่ยังถืออยู่หลังคืน/โอน/ตัดออก
- [x] Unit Tests 42 ข้อ, Lint, Build และ PostgreSQL Integration Checks 44 ข้อผ่านก่อน Commit เอกสาร

## คิวงานที่ยังต้องทำ/ตรวจ

| ลำดับ | งาน | สถานะและเกณฑ์จบ |
| --- | --- | --- |
| 1 | Asset Code: Migration 018 | ฐานข้อมูลเดิมยังไม่มี `asset_code_type_counters` และ `trg_validate_asset_running_number`; ฟังก์ชันยังใช้ Site/Type Counter ต้องทดลอง/ดำเนินการ 018 และตรวจเลขร่วม Type เดียวกันข้าม F1/F2 |
| 2 | Accessories UI หลัง Login | ยังไม่ได้ตรวจคลิกจริง แท็บที่ใช้ตรวจกลับหน้า Login; ทดสอบรับ/เบิก/แก้/โอน/คืนบางส่วน/ตัดออกและประวัติจาก Browser ที่มี Session ใช้งานได้ |
| 3 | Stock ตั้งต้น | พร้อมเบิกเริ่ม 0 ต้องตรวจนับของจริงและบันทึกรับเข้า ไม่เพิ่มยอดจากประวัติคืนในอดีตโดยคาดเดา |
| 4 | ตรวจสิทธิ์จาก UI/API ในการใช้งานจริง | ทดสอบ Admin, IT Staff, Read-only, พนักงาน Inactive, Request ซ้ำและข้อมูลเก่า |
| 5 | Google Drive Upload จริง | OAuth/โฟลเดอร์ Local ผ่าน แต่ต้องทดสอบ Add/Edit → Preview → Upload → เปิดรูป ด้วยบัญชีที่จะใช้จริง |
| 6 | Production/Vercel | ตรวจ Commit ที่ Deploy, Environment และ Smoke test หลัง Push; ยังไม่ได้ตรวจยืนยัน |
| 7 | Mobile และ Export | ตรวจ Drawer/Settings/ฟอร์ม Accessories บนมือถือ และดาวน์โหลด Excel/PDF/ใบรับมอบจาก UI |

## Asset Code — กติกาปัจจุบัน

- รูปแบบ `F1-NB-001`: Site ที่ขึ้นทะเบียน + Prefix ของ Asset Type + เลข 3 หลัก
- **Running Number ร่วมกันตาม Asset Type ทั้ง F1/F2** ไม่แยกตามโรงงาน: ตัวอย่าง `F1-NB-019` แล้ว `F2-NB-020`
- หน้า Add กรอกเลข 3 หลัก โดยมี Preview และเลขล่าสุด; API ตรวจเลขซ้ำของ Type เดียวกันร่วมทุกโรงงาน
- Site ที่ขึ้นทะเบียนเป็นตัวตนเดิมของ Asset; การเปลี่ยน Location ภายหลังไม่ควรเปลี่ยน Asset Code
- เก็บรหัสพิมพ์เดิมไว้ใน `history_assets`; ไม่ Rename รหัสเดิมอัตโนมัติจากการย้าย Location
- Migration 013/014 เป็นส่วนโครงสร้างเดิม; 018 เป็นขั้นอัปเดตการสร้าง/ป้องกันเลขซ้ำที่ระดับ DB ยังต้องดำเนินการกับฐานข้อมูลที่ตรวจ

ไฟล์: [lib/asset-code.js](lib/asset-code.js), [Migration 018](migrations/018-global-asset-type-running-number.sql)

## Accessories — ข้อกำหนดที่ยืนยัน

- คลังกลางรวมทั้งบริษัท ไม่แยกโรงงาน
- ยอดคงเหลือทั้งบริษัท = พร้อมเบิกในคลัง + พนักงานถืออยู่
- โอนระหว่างพนักงานไม่เปลี่ยนยอดในคลัง; คืนเพิ่มยอดเฉพาะจำนวนคืน; ตัดออกจากผู้ถือไม่เพิ่มของเสียกลับคลัง
- การแก้จำนวนที่ถืออยู่คืน/เบิกส่วนต่างอัตโนมัติ พร้อมเหตุผลและข้อมูลก่อน/หลัง
- Serial 1 ชิ้นต่อรายการ; Request ID ป้องกันบันทึกซ้ำ; เวอร์ชันป้องกันข้อมูลเก่า; ยอดติดลบถูกปฏิเสธ
- ไม่ได้เพิ่มฟีเจอร์ใหม่ในงานเอกสารรอบนี้ งานที่ค้างเป็นการตั้งยอด/ตรวจ UI/ตรวจ Production ตามตารางข้างต้น

คู่มือ: [docs/accessory-stock.md](docs/accessory-stock.md)

## Asset Photos — ส่วนที่ยังไม่ครบตาม Backlog เดิม

โค้ด Upload/Preview มีแล้ว และใช้ Google Drive OAuth โดยไม่เปิดไฟล์ Public อัตโนมัติ ส่วนต่อไปนี้ยังไม่มีหรือยังไม่ได้ยืนยัน:

- [ ] Gallery/Thumbnail ของรูปในหน้า Detail (ปัจจุบันเป็นลิงก์เอกสารไป Drive)
- [ ] อ่านเนื้อหารูป Private ผ่าน Server ของ AMZAP แทนเปิดลิงก์ Drive
- [ ] UI/API ลบรูปสำเร็จแล้วและเปลี่ยนรูปหลักด้วยตนเอง
- [ ] Audit Log เฉพาะเพิ่ม/ลบ/เปลี่ยนรูปให้ครบ
- [ ] กำหนดจำนวนรูปสูงสุดต่อ Asset
- [ ] ตัดสินใจและทำการบีบอัดก่อน Upload หากต้องการ
- [ ] ตรวจสิทธิ์เปิดรูปของบัญชีผู้ใช้งานจริง และ Environment Google Drive บน Production

`deleteGoogleDriveFile()` ที่มีอยู่ใช้ cleanup เมื่อ Upload/บันทึกไม่สำเร็จ ไม่ใช่ปุ่มลบรูปของผู้ใช้ ให้จัดลำดับการเพิ่มฟีเจอร์เหล่านี้กับเจ้าของงานก่อนเริ่มพัฒนา

คู่มือ: [docs/google-drive-photo-setup.md](docs/google-drive-photo-setup.md)

## งานระบบที่ยังไม่มีชุดครบ

- [ ] Schema/Seed ครบสำหรับสร้างฐานว่างและ Bootstrap Admin
- [ ] Automated Browser/E2E test suite
- [ ] Workflow CI ใน `.github/workflows`
- [ ] ตรวจ Deployment และ Smoke test Production สำหรับโค้ดล่าสุด

เมื่อทำงานค้างเสร็จ ให้ปรับสถานะพร้อมวันที่ ผลทดสอบ และ Commit ในไฟล์นี้และ HANDOFF เพื่อให้เครื่องถัดไปอ่านแล้วทำต่อได้
