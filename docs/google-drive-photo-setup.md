# ตั้งค่า Google Drive สำหรับรูป Asset

ระบบอัปโหลดรูปผ่าน Server เท่านั้น ค่า OAuth ทั้งหมดต้องอยู่ใน `.env.local`
หรือ Environment Variables ของ Vercel และห้ามใส่คำว่า `NEXT_PUBLIC_` นำหน้า

## 1. เตรียม Google Drive

แนะนำให้ใช้ Google Account แยกสำหรับระบบ Asset เพื่อไม่ให้ Refresh Token มีสิทธิ์
เข้าถึง Drive ส่วนตัวของผู้ดูแลระบบ

1. Login ด้วยบัญชี Google ที่จะใช้เก็บรูป
2. สร้าง Folder ชื่อ `AMZAP Asset Photos`
3. เปิด Folder แล้วคัดลอก Folder ID จาก URL

ตัวอย่าง URL:

```text
https://drive.google.com/drive/folders/FOLDER_ID
```

## 2. ตั้งค่า Google Cloud

1. เปิด Google Cloud Console และสร้างหรือเลือก Project
2. เปิด `APIs & Services` > `Library`
3. เปิดใช้งาน `Google Drive API`
4. ตั้งค่า `OAuth consent screen`
5. หาก App อยู่ในโหมด Testing ให้เพิ่ม Google Account ข้างต้นเป็น Test user
6. สร้าง Credential ชนิด `OAuth client ID` > `Web application`
7. เพิ่ม Authorized redirect URI:

```text
https://developers.google.com/oauthplayground
```

8. เก็บ Client ID และ Client Secret ไว้ใน Password Manager ห้าม Commit ลง Git

## 3. สร้าง Refresh Token

ทำบนเครื่องส่วนตัวที่เชื่อถือได้ และใช้ Client ID/Client Secret จาก OAuth
Client ที่สร้างในข้อ 2 เท่านั้น:

1. เปิด [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. กดไอคอนรูปเฟือง **OAuth 2.0 configuration** มุมขวาบน
3. เปิด **Use your own OAuth credentials** แล้วใส่ค่า **OAuth Client ID**
   และ **OAuth Client secret** จาก Google Cloud Console โดยไม่ต้องใส่เครื่องหมายคำพูด
4. ตั้ง **Access type** เป็น `Offline` เพื่อขอ Refresh Token แล้วปิดหน้าต่าง Settings
   (ถ้ามีตัวเลือก **Force prompt** ให้เปิดเพื่อให้ Google แสดงหน้าขอสิทธิ์อีกครั้ง)
5. ในแผง **Step 1 Select & authorize APIs** ให้เลื่อนลงไปที่
   **Input your own scopes** แล้วใส่ Scope นี้:

```text
https://www.googleapis.com/auth/drive
```

6. กด **Authorize APIs**. ถ้าหน้าจอถามให้เลือกบัญชี ให้เลือกบัญชี Google
   ที่เป็นเจ้าของโฟลเดอร์รูป จากนั้นตรวจชื่อบัญชีและ Scope `Google Drive API`
   แล้วกด **Continue / Allow** เพื่ออนุญาต
7. เมื่อกลับมาที่ Playground ตรวจว่า **Step 2 Exchange authorization code
   for tokens** มี Authorization code แล้วกดปุ่ม **Exchange authorization
   code for tokens**
8. ในผลลัพธ์ของ Step 2 คัดลอกค่าจากบรรทัด **Refresh token** เท่านั้น
   อย่าคัดลอก **Access token**: Access token มักขึ้นต้นด้วย `ya29.` และหมดอายุ
   เร็ว ส่วน Refresh token คือค่าที่ต้องใช้กับ `GOOGLE_DRIVE_REFRESH_TOKEN`

หาก Step 2 ไม่มีบรรทัด **Refresh token**: ตรวจว่าเปิด **Use your own OAuth
credentials**, ตั้ง **Access type** เป็น `Offline` และใช้บัญชี/Client ที่ถูกต้อง
ถ้าเคยอนุญาตแอปนี้แล้ว Google อาจไม่ออก Refresh token ซ้ำ ให้เปิด
[การตั้งค่าบัญชี Google](https://myaccount.google.com/permissions), ลบสิทธิ์
ของแอปที่เกี่ยวข้อง แล้วกลับมาทำขั้นตอนนี้ใหม่โดยเปิด **Force prompt** หากมี
ตัวเลือกนี้ การลบสิทธิ์จะทำให้ Token เดิมของแอปนี้ใช้ไม่ได้ด้วย

ถ้า Google แจ้งว่าแอปอยู่ในโหมดทดสอบ ให้เพิ่มบัญชีนี้เป็น Test user ตามข้อ 2
Refresh Token ของ External app ที่ยังเป็นสถานะ Testing และใช้ Scope ของ Drive
อาจหมดอายุภายใน 7 วัน หากต้องการใช้ต่อเนื่อง ให้ตรวจสถานะ Publishing ของ
OAuth consent screen และข้อกำหนดการยืนยันแอปของ Google ก่อนใช้งานจริง

## 4. ตั้งค่า Local

เพิ่มค่าต่อไปนี้ใน `.env.local` โดยไม่ต้องใส่เครื่องหมายคำพูด:

```dotenv
GOOGLE_DRIVE_CLIENT_ID=ใส่_client_id
GOOGLE_DRIVE_CLIENT_SECRET=ใส่_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=ใส่_refresh_token
GOOGLE_DRIVE_FOLDER_ID=ใส่_folder_id
```

ถ้าไม่กำหนด `GOOGLE_DRIVE_FOLDER_ID` ไฟล์จะถูกอัปโหลดไว้ที่ My Drive root

หลังแก้ `.env.local` ต้องปิดและเปิด `npm run dev` ใหม่ เพราะ Next.js อ่านค่า
Environment Variables ตอนเริ่ม Server

## 5. ใส่ Refresh Token ใน Vercel (เว็บใช้งานจริง)

1. เข้า Vercel Dashboard → โปรเจกต์ `amzap-asset` → **Settings** → **Environment Variables** (บางหน้าจออยู่ใต้เมนู **Environments**)
2. ถ้ามี `GOOGLE_DRIVE_REFRESH_TOKEN` อยู่แล้ว ให้เปิดแก้ค่าของ Production; ถ้ายังไม่มี ให้กดเพิ่ม Environment Variable แล้วเลือกชนิด **Secret**
3. ช่อง **Key/Name** ใส่ `GOOGLE_DRIVE_REFRESH_TOKEN` ช่อง **Value** วางค่า **Refresh token** จาก Step 2 ของ OAuth Playground โดยไม่มีเครื่องหมายคำพูดหรือช่องว่างเกิน
4. เลือก Environment **Production** แล้วกด **Save** ตรวจว่ามี `GOOGLE_DRIVE_CLIENT_ID` และ `GOOGLE_DRIVE_CLIENT_SECRET` ใน Production ด้วย โดยค่าทั้งสามต้องเป็นชุดเดียวกัน `GOOGLE_DRIVE_FOLDER_ID` ใช้เมื่อจะเก็บรูปใน Folder เฉพาะ
5. ไปที่ **Deployments** แล้ว **Redeploy** Production Deployment ล่าสุด การ Save ค่า Environment อย่างเดียวยังไม่ทำให้ Deployment เดิมรับค่าใหม่
6. หลัง Redeploy สำเร็จ ให้เข้าเว็บด้วยบัญชี Admin/IT Staff เปิด Asset เดิมแล้วลองเพิ่มรูป 1 รูป ตรวจหน้า Asset Detail → Documents & History ว่ามีชื่อไฟล์ใหม่และป้าย “รูปหลัก” ถ้าข้อมูล Asset บันทึกสำเร็จแล้วแต่รูปพลาด **อย่าสร้าง Asset ใหม่ซ้ำ**

ระบบต้องการ **Refresh token** ไม่ใช่ Access token และต้องใส่ใน Environment ของ Server เท่านั้น ไม่ต้องใส่ใน Database, หน้าเว็บ หรือโค้ด หากทดสอบบน Local ให้แก้ `GOOGLE_DRIVE_REFRESH_TOKEN` ใน `.env.local` แล้วปิด/เปิด `npm run dev` ใหม่แทนการแก้ Vercel

อ้างอิงหน้าจอและพฤติกรรม Redeploy: [Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Google OAuth Playground](https://developers.google.com/oauthplayground/)

ข้อควรระวัง:

- ห้ามส่ง Client Secret หรือ Refresh Token ใน Chat
- ห้าม Commit `.env.local`
- รูปใหม่ที่อัปโหลดผ่านระบบจะได้รับสิทธิ์ **Anyone with the link — Viewer** เป็นรายไฟล์
  ระบบยังใช้ API ที่ต้องล็อกอินเพื่อแสดงรูปย่อในหน้า Asset ตามเดิม
- ผู้ที่ได้ลิงก์ Drive สามารถเปิดรูปได้โดยไม่ต้องล็อกอินระบบ Asset อย่าแชร์ลิงก์นอกผู้ที่ควรเห็นรูป
- ช่องถ่ายรูปบนมือถือรับรูปจากกล้องและคลังรูป รวมถึง HEIC/HEIF จาก iPhone
  แล้วแปลง/ย่อเป็น JPG ใน Browser อัตโนมัติ โดยตั้งเป้าไม่เกิน 1.5 MB
  และยังคงเพดานไฟล์ที่ส่งเข้า Server ไม่เกิน 4 MB
- หากยกเลิกสิทธิ์ OAuth หรือเปลี่ยนรหัสผ่านจน Token ใช้ไม่ได้ ต้องสร้าง Refresh Token ใหม่

## เมื่ออัปโหลดไม่ได้เพราะสิทธิ์หมดอายุ

ถ้า Google ตอบ `invalid_grant` หรือ `Token has been expired or revoked` ให้สร้าง Refresh Token
ใหม่ตามขั้นตอนที่ 3 ด้วย Client ID และ Client Secret ของโปรเจกต์เดิม แล้วอัปเดต
`GOOGLE_DRIVE_REFRESH_TOKEN` ใน `.env.local` หรือ Environment Variables ของ Vercel
จากนั้นรีสตาร์ตแอปหรือ Redeploy ห้ามส่ง Token ในแชตหรือ Commit ลง Git

ถ้า OAuth consent screen เป็น External และยังอยู่ในสถานะ Testing, Google อาจออก
Refresh Token ที่หมดอายุใน 7 วันสำหรับ Scope ของ Drive ดูรายละเอียดที่
https://developers.google.com/identity/protocols/oauth2#expiration

## แชร์รูปเก่าที่อยู่ใน Google Drive

ลิงก์รูปเก่าอยู่ใน `asset_documents.storage_path` แล้ว จึงไม่ต้องคัดลอกลิงก์ใหม่
ขั้นตอนนี้เพิ่มสิทธิ์ดูแบบ Anyone with the link ให้รูปเก่าเป็นรายไฟล์เท่านั้น
ไม่เปลี่ยนสิทธิ์ทั้งโฟลเดอร์ ไม่แก้ข้อมูลใน DB และไม่แตะรูปที่เก็บบน local server

1. ตั้ง `GOOGLE_DRIVE_REFRESH_TOKEN` ที่ถูกต้องและทดสอบการเชื่อมต่อใน Settings ก่อน
2. ในโฟลเดอร์โปรเจกต์บนเครื่องที่เข้าถึงฐานข้อมูลและ Google Drive ได้ ให้ตรวจจำนวนแบบไม่แก้อะไร:

   ```powershell
   node --env-file=.env.local scripts/share-asset-photos.mjs
   ```

3. เมื่อตั้งใจเปิดสิทธิ์ให้รูปเก่าทั้งหมดแล้ว จึงรัน:

   ```powershell
   node --env-file=.env.local scripts/share-asset-photos.mjs --apply
   ```

สคริปต์ตรวจสิทธิ์ก่อนแชร์ จึงรันซ้ำเพื่อเก็บรายการที่พลาดได้ หากไฟล์ใดมีสิทธิ์สาธารณะ
ที่กว้างกว่า Viewer อยู่แล้ว สคริปต์จะรายงานให้ตรวจเอง ไม่เปลี่ยนสิทธิ์นั้นโดยอัตโนมัติ
หลังรันให้ตรวจยอด `failed: 0` และลองเปิดลิงก์รูปหนึ่งรายการในหน้าต่างไม่ระบุตัวตน
