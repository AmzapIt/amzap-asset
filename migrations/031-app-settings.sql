-- ค่าตั้งค่าที่ใช้ร่วมกันทั้ง local server และ Vercel (เก็บใน DB ไม่ใช่ไฟล์บนเครื่อง)
-- key แรกที่ใช้: document.it_signer_name = ชื่อผู้เซ็นฝั่ง IT ที่พิมพ์ลงเอกสาร
CREATE TABLE IF NOT EXISTS public.app_settings (
  key varchar(100) PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_account_id bigint REFERENCES public.app_accounts(id) ON DELETE SET NULL
);
