# AMZAP Asset Management — Project Backlog

เอกสารนี้เก็บ Requirement ที่ยืนยันแล้วหรืออยู่ระหว่างรอรายละเอียดเพิ่มเติม
เพื่อใช้ตรวจผลกระทบก่อนแก้โค้ด ฐานข้อมูล และ Production

## Asset Code V2 — Planned

รูปแบบใหม่: `F1-NB-001`

- `F1` / `F2` คือโรงงานที่ขึ้นทะเบียน Asset ครั้งแรก
- `NB` คือ Prefix จาก Asset Type เช่น Notebook / Laptop
- `001` คือ Running number ที่ฐานข้อมูลสร้างให้อัตโนมัติ
- เลขรันแยกตามโรงงานและ Asset Type
- Asset Code ต้องไม่เปลี่ยนเมื่อย้าย Location ในภายหลัง
- Asset เดิมคงรหัสเดิม รูปแบบใหม่ใช้กับ Asset ที่สร้างใหม่
- ต้องมี Unique Constraint และ Transaction/Lock ป้องกันเลขซ้ำ
- ต้องแก้หน้า Add Asset, Server API, Database Counter/Trigger และ Tests

## Asset Photos — Planned

รองรับการถ่ายรูปหรือเลือกรูปจากอุปกรณ์ แล้วจัดเก็บไฟล์ภายนอกระบบ

- หน้า Add/Edit/Detail แสดงปุ่มถ่ายรูปหรือเลือกรูป
- บนโทรศัพท์ใช้ file input พร้อม `capture="environment"` เพื่อเปิดกล้องหลังเมื่อ Browser รองรับ
- แสดง Preview ก่อน Upload
- ตรวจชนิดไฟล์ ขนาดไฟล์ และ Permission ทั้งฝั่ง Client และ Server
- อัปโหลดผ่าน Server API เท่านั้น ห้ามส่ง Google Credential ไป Browser
- เก็บเฉพาะ File ID และ Metadata ที่จำเป็นใน PostgreSQL
- ผู้อ่านรูปต้องผ่าน Login/Permission ของ AMZAP
- ไม่ตั้งไฟล์เป็น Public หรือ Anyone with the link
- รองรับรูปหลัก รูปเพิ่มเติม การลบ และ Audit Log

### ตัวเลือกพื้นที่เก็บไฟล์

1. Google Shared Drive ผ่าน Google Drive API
   - เหมาะเมื่อบริษัทต้องการเห็นและบริหารไฟล์ใน Google Drive
   - ใช้ Service Account ที่เป็นสมาชิก Shared Drive หรือ OAuth ของบัญชีองค์กร
   - เก็บ Credential เฉพาะใน Environment Variables ของ Local/Vercel
2. Supabase Storage
   - เชื่อมกับระบบปัจจุบันง่ายกว่า และใช้ Private Bucket/Signed URL ได้ตรงกว่า
   - ควรเลือกตัวเลือกนี้หากไม่มีข้อกำหนดว่ารูปต้องอยู่ใน Google Drive

### รายละเอียดที่ต้องยืนยันก่อนพัฒนา

- บริษัทมี Google Workspace Shared Drive หรือใช้ My Drive ของบัญชีใดบัญชีหนึ่ง
- จำนวนรูปสูงสุดต่อ Asset
- ขนาดไฟล์สูงสุดต่อรูป
- ต้องเก็บรูปต้นฉบับหรือบีบอัดก่อน Upload
- ผู้มีสิทธิ์เพิ่ม ลบ และดูรูป

