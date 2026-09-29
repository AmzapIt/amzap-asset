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

1. เปิด `https://developers.google.com/oauthplayground`
2. เปิด Settings รูปเฟือง
3. เลือก `Use your own OAuth credentials`
4. ใส่ Client ID และ Client Secret
5. ใช้ Scope ด้านล่าง แล้วกด Authorize APIs:

```text
https://www.googleapis.com/auth/drive
```

Scope นี้จำเป็นสำหรับการอัปโหลดเข้า Folder ที่สร้างไว้เอง จึงควรใช้ Google
Account แยกสำหรับระบบนี้เท่านั้น

6. Login ด้วยบัญชี Google Drive ที่เตรียมไว้
7. กด `Exchange authorization code for tokens`
8. คัดลอก Refresh Token ไปเก็บใน Environment Variable

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

## 5. ตั้งค่า Production ภายหลัง

เพิ่ม Environment Variables ชุดเดียวกันใน Vercel Project Settings โดยเลือก
เฉพาะ Environment ที่ต้องการ แล้ว Redeploy หลังตั้งค่าครบ

ข้อควรระวัง:

- ห้ามส่ง Client Secret หรือ Refresh Token ใน Chat
- ห้าม Commit `.env.local`
- ไฟล์ยังเป็น Private และระบบไม่ตั้งค่า Anyone with the link อัตโนมัติ
- ช่องถ่ายรูปบนมือถือรับรูปจากกล้องและคลังรูป รวมถึง HEIC/HEIF จาก iPhone
  แล้วแปลง/ย่อเป็น JPG ใน Browser อัตโนมัติเมื่อจำเป็น ก่อนส่งไฟล์ไม่เกิน 4 MB
- หากยกเลิกสิทธิ์ OAuth หรือเปลี่ยนรหัสผ่านจน Token ใช้ไม่ได้ ต้องสร้าง Refresh Token ใหม่
