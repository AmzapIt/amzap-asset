import { getCurrentAccessories,getReportAssets,getRecipient } from "@/lib/asset-report";
import { assetWorkbook,assetPdf,handoverPdf } from "@/lib/export-files";
import { findHandoverConflict } from "@/lib/report-validation";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * POST /api/reports/export รับ format, ids และข้อมูลใบรับมอบ (กรณี handover)
 * ตรวจคำขอก่อน query แล้วอ่านข้อมูล Asset ใหม่จาก DB แทนเชื่อข้อมูลอุปกรณ์จาก browser
 * Endpoint นี้สร้างเอกสารแบบอ่านอย่างเดียว ยังต้องเชื่อมระบบสิทธิ์ในงานข้อ 11
 */
export async function POST(request) {
  // Only database IDs and bounded form text are accepted, never client-supplied
  // asset records, file paths, remote URLs, HTML or handwritten signatures.
  let body;
  try { const raw=await request.text();if(raw.length>150000)throw new Error();body=JSON.parse(raw); }
  catch {return Response.json({error:"ข้อมูลคำขอไม่ถูกต้องหรือมีขนาดใหญ่เกินไป"},{status:400});}
  // รับ ID เป็น string จำนวนเต็มบวกในช่วง PostgreSQL bigint เพื่อไม่ให้ Number ปัดค่า
  const validId=v=>typeof v==="string"&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
  // จำกัดชนิดเอกสาร จำนวนรายการ และห้าม ID ซ้ำ เพื่อลดงานสร้างไฟล์เกินขนาด
  // ขีดจำกัดแต่ละแบบ: handover 7, PDF 500, Excel 5,000 รายการ
  if(!body||!["xlsx","pdf","handover"].includes(body.format)||!Array.isArray(body.ids)||(body.format!=="handover"&&!body.ids.length)||body.ids.length>(body.format==="handover"?7:body.format==="pdf"?500:5000)||!body.ids.every(validId)||new Set(body.ids).size!==body.ids.length)
    return Response.json({error:"เลือกรายการให้ถูกต้อง: ใบส่งมอบไม่เกิน 7, PDF ไม่เกิน 500, Excel ไม่เกิน 5,000 รายการ"},{status:400});
  // whitelist ช่องฟอร์มและจำกัดความยาวก่อนนำไปจัดหน้า PDF
  // ตรวจวันที่ทั้งรูปแบบและวันจริง เช่น 30 กุมภาพันธ์ต้องไม่ผ่าน
  const form={};
  if(body.format==="handover") {
    if(!validId(body.recipientId))return Response.json({error:"กรุณาเลือกพนักงานผู้รับมอบ"},{status:400});
    for(const [key,max] of Object.entries({documentNo:60,date:10,kind:40,location:100,purpose:150,startDate:10,notes:350,deliveredBy:100,approvedBy:100,itNotes:350})){
      const v=body.form?.[key]??"";
      if(typeof v!=="string"||v.length>max)return Response.json({error:`ข้อมูล ${key} ยาวเกินกำหนด`},{status:400});
      form[key]=v.trim();
    }
    for(const key of ["date","startDate"])if(form[key]){const date=new Date(`${form[key]}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(form[key])||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==form[key])return Response.json({error:"วันที่ไม่ถูกต้อง"},{status:400});}
    if(!["พนักงานใหม่","เปลี่ยนอุปกรณ์","รับเพิ่ม","คืนอุปกรณ์"].includes(form.kind))return Response.json({error:"กรุณาเลือกประเภทการรับมอบ"},{status:400});
  }
  try {
    // หากบาง Asset ถูกลบหลังโหลดหน้า ให้แจ้ง 404 ไม่ส่งรายงานที่ข้อมูลหายเงียบ ๆ
    const rows=await getReportAssets(body.ids);
    if(rows.length!==body.ids.length)return Response.json({error:"บางรายการไม่พบในระบบ กรุณาโหลดหน้าใหม่"},{status:404});
    let buffer;
    if(body.format==="handover"){
      const recipient=await getRecipient(body.recipientId);
      if(!recipient)return Response.json({error:"ไม่พบพนักงาน"},{status:404});

      // ใบคืนต้องอ้างอิงเฉพาะ Asset ที่พนักงานคนนี้ถืออยู่จริง ส่วนใบรับมอบ
      // อนุญาต Asset ว่างหรือ Asset ที่คนเดิมถืออยู่ แต่ไม่ยอมให้เลือกของคนอื่น
      // การตรวจซ้ำฝั่ง Server ป้องกัน request ที่ข้ามข้อจำกัดบนหน้าเว็บ
      const wrongHolder = findHandoverConflict(
        rows,
        body.recipientId,
        form.kind,
      );

      if (wrongHolder) {
        return Response.json(
          {
            error:
              form.kind === "คืนอุปกรณ์"
                ? `Asset ${wrongHolder.asset_code} ไม่ได้อยู่ในการครอบครองของพนักงานที่เลือก`
                : `Asset ${wrongHolder.asset_code} มีผู้ครอบครองคนอื่นอยู่ กรุณาคืนหรือโอนก่อน`,
          },
          { status: 409 },
        );
      }

      // Accessory ถูกดึงด้วย recipientId ที่ตรวจแล้วและเฉพาะรายการยังไม่คืน
      // จึงไม่มีข้อมูล Accessory จาก Browser ปะปนในเอกสาร
      const accessories=await getCurrentAccessories(body.recipientId);
      if(!rows.length&&!accessories.length)return Response.json({error:"พนักงานไม่มี Asset หรือ Accessory สำหรับสร้างเอกสาร"},{status:400});
      buffer=await handoverPdf(rows,recipient,form,accessories);
    }else buffer=await (body.format==="xlsx"?assetWorkbook(rows):assetPdf(rows));
    // ส่งไฟล์เป็น binary พร้อมชื่อดาวน์โหลด และ no-store เพื่อไม่ cache รายงานพนักงาน
    const extension=body.format==="xlsx"?"xlsx":"pdf";
    return new Response(new Uint8Array(buffer),{headers:{"Content-Type":extension==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf","Content-Disposition":`attachment; filename="AMZAP-${body.format}.${extension}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){console.error("Export failed",error);return Response.json({error:"ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่"},{status:500});}
}
