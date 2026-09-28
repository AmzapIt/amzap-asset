/**
 * ตรวจความสัมพันธ์ระหว่างพนักงานกับ Asset ก่อนสร้างใบรับมอบ
 *
 * - ใบคืน: ทุกชิ้นต้องอยู่กับพนักงานที่เลือกในปัจจุบัน
 * - ใบรับ/เปลี่ยน/รับเพิ่ม: เลือกของว่างหรือของที่พนักงานคนเดิมถืออยู่ได้
 *   แต่ห้ามนำ Asset ที่พนักงานคนอื่นถืออยู่ไปใส่เอกสาร
 *
 * คืนค่า null เมื่อใช้ได้ หรือคืน Asset แรกที่ขัดกับเงื่อนไขเพื่อให้ API
 * แจ้งรหัสที่ต้องแก้โดยไม่เปิดเผยข้อมูลส่วนอื่นเกินจำเป็น
 */
export function findHandoverConflict(rows, recipientId, kind) {
  return (
    rows.find((asset) => {
      if (kind === "คืนอุปกรณ์") {
        return asset.current_holder_id !== recipientId;
      }

      return (
        asset.current_holder_id != null &&
        asset.current_holder_id !== recipientId
      );
    }) ?? null
  );
}
