export async function readApiResponse(response) {
  const redirectPath = response.redirected && response.url
    ? new URL(response.url).pathname
    : null;

  if (response.status === 401 || redirectPath === "/login") {
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  if (redirectPath === "/account/password") {
    throw new Error("กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานต่อ");
  }

  if (!response.headers.get("content-type")?.includes("json")) {
    if (response.status === 404) {
      throw new Error("ไม่พบ API บนเว็บเวอร์ชันนี้ (404) กรุณาโหลดหน้าใหม่หรือติดต่อ IT");
    }
    throw new Error(`เซิร์ฟเวอร์ไม่ได้ส่งข้อมูล API กลับมา (${response.status}) กรุณาลองโหลดหน้าใหม่`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("ข้อมูลตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง กรุณาลองโหลดหน้าใหม่");
  }

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || `ไม่สามารถดำเนินการได้ (${response.status})`);
  }

  return data;
}
