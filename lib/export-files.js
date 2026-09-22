import ExcelJS from "exceljs";
import pdfmake from "pdfmake";
import path from "node:path";
import fs from "node:fs";

// Bundle licensed Thai fonts; never load fonts, images or paths from request data.
// ทรัพยากรทั้งหมดอ้างอิงจาก resources/reports ในโปรเจกต์ และรวมตอน deploy
// ผู้ใช้ส่งได้เฉพาะข้อมูลฟอร์ม ไม่สามารถระบุ path ของไฟล์หรือ URL เพื่อให้ server โหลด
const resource = (...parts) => path.join(process.cwd(),"resources","reports",...parts);
const font = name => resource("fonts",name);
let fontsReady = false;
// ลงทะเบียน Sarabun ครั้งเดียวต่อ process เพื่อรองรับสระและวรรณยุกต์ไทย
// ปิดการโหลดจาก URL และอนุญาตให้อ่านเฉพาะไฟล์ฟอนต์สองไฟล์ที่ระบุเท่านั้น
function setupPdf() {
  if (!fontsReady) {
    const regular=font("Sarabun-Regular.ttf"),bold=font("Sarabun-Bold.ttf");
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(file => [regular,bold].includes(path.resolve(file)));
    pdfmake.addFonts({Sarabun:{normal:regular,bold,italics:regular,bolditalics:bold}});
    fontsReady=true;
  }
}
const value = v => v==null||v==="" ? "-" : String(v);
// แต่ละรายการคือ [ชื่อ property จาก query, หัวคอลัมน์ Excel, ความกว้างคอลัมน์]
// ใช้รายการนี้ทั้งสร้างหัวตารางและเติมแถว เพื่อลดโอกาสข้อมูลเหลื่อมคอลัมน์
const columns = [
  ["asset_code","Asset Code",23],["asset_name","ชื่อทรัพย์สิน",32],["asset_type","ประเภท",20],
  ["brand","Brand",18],["model","Model",24],["serial_number","Serial Number",25],
  ["status","สถานะ",18],["owner_name","Asset Owner",28],["current_holder","ผู้ครอบครองปัจจุบัน",28],
  ["department","แผนกเจ้าของ",24],["location","สถานที่ปัจจุบัน",25],
  ["received_date","วันที่รับเข้า",18],["warranty_end","วันหมดประกัน",18],
  ["purchase_price","ราคาซื้อ",18],["currency","สกุลเงิน",14],
];
// สร้าง .xlsx ในหน่วยความจำ: ตรึงหัวตาราง เพิ่มตัวกรอง และตั้งรูปแบบราคาทศนิยม 2 ตำแหน่ง
// ฟิลด์ข้อความเขียนเป็น string ไม่ใช่ formula จึงไม่รันข้อความจากฐานข้อมูลเป็นสูตร Excel
// คืน Buffer ให้ API ส่งดาวน์โหลด โดยไม่เขียนไฟล์รายงานค้างไว้บน server
export async function assetWorkbook(rows) {
  const workbook=new ExcelJS.Workbook();workbook.creator="AMZAP IT Asset Management";
  const sheet=workbook.addWorksheet("Assets",{views:[{state:"frozen",ySplit:1}]});
  sheet.columns=columns.map(([key,header,width])=>({key,header,width}));
  for(const asset of rows){const row={};for(const [key]of columns)row[key]=key==="purchase_price"?(asset[key]==null?null:Number(asset[key])):(asset[key]==null?"":String(asset[key]));sheet.addRow(row);}
  // Assign plain strings, never formula objects: imported names beginning with '='
  // remain text when opened in Excel. Numeric purchase prices retain number formatting.
  sheet.getColumn("purchase_price").numFmt='#,##0.00';
  sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"},name:"Sarabun"};
  sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17365D"}};
  sheet.getRow(1).height=28;sheet.autoFilter={from:"A1",to:"O1"};
  sheet.eachRow((row,index)=>{row.alignment={vertical:"middle",wrapText:true};if(index>1){row.font={name:"Sarabun",size:11};row.height=32;}});
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// รูปแบบกลางของ PDF ทั้งสองชนิด: A4, ฟอนต์ไทย, ระยะขอบ, หัวข้อ และเลขหน้า
// รายการ Asset ใช้แนวนอน ส่วนใบรับมอบใช้แนวตั้งตามแบบฟอร์มต้นฉบับ
function definition(content,landscape=false) {
  return {pageSize:"A4",pageOrientation:landscape?"landscape":"portrait",pageMargins:[35,35,35,40],
    defaultStyle:{font:"Sarabun",fontSize:10,lineHeight:1.2},
    footer:(page,total)=>({text:`AMZAP Group | IT Asset Management     ${page} / ${total}`,alignment:"center",fontSize:8,color:"#777777",margin:[0,15,0,0]}),
    styles:{title:{fontSize:17,bold:true,color:"#17365d",margin:[0,0,0,12]},section:{fontSize:12,bold:true,color:"#235789",margin:[0,12,0,8]}},content};
}
// รายงานรายการ Asset แสดง Owner และผู้รับมอบหมายแยกบรรทัดให้เห็นทั้งสองบทบาท
// headerRows ทำให้หัวตารางซ้ำเมื่อตารางต่อหน้าถัดไป และ value() แสดง "-" เมื่อข้อมูลว่าง
export async function assetPdf(rows) {
  setupPdf();
  const body=[["Asset Code","ชื่อ / ประเภท","Serial Number","สถานะ","Owner / ผู้ครอบครอง","สถานที่"].map(text=>({text,bold:true,fillColor:"#dceaf5"})),
    ...rows.map(a=>[a.asset_code,`${value(a.asset_name)}\n${value(a.asset_type)}`,value(a.serial_number),a.status,`${value(a.owner_name)}\n${value(a.current_holder)}`,value(a.location)])];
  if(!rows.length)body.push(["ไม่มีข้อมูล","","","","",""]);
  return pdfmake.createPdf(definition([{text:"รายงานทรัพย์สิน IT",style:"title"},{text:`จำนวน ${rows.length} รายการ`,margin:[0,0,0,12]}, {table:{headerRows:1,widths:[100,"*",100,65,120,85],body},layout:"lightHorizontalLines"}],true)).getBuffer();
}

/**
 * สร้างใบรับมอบตามแบบ AMZAP: ข้อมูลพนักงาน/อุปกรณ์ ตามด้วยข้อตกลงและช่องลงนาม
 * rows และ recipient อ่านจากฐานข้อมูล; form คือข้อมูลประกอบที่ผู้ใช้กรอกและ API ตรวจแล้ว
 * อุปกรณ์แต่ละ Asset มีจำนวน 1 และเติมแถวว่างให้ตารางมีอย่างน้อย 5 แถว
 * API จำกัดไม่เกิน 7 อุปกรณ์ต่อใบ; pageBreak เริ่มข้อตกลงที่หน้าใหม่
 * ชื่อผู้ส่งมอบ/ผู้อนุมัติเป็นข้อความบนเอกสาร ไม่ใช่หลักฐานยืนยันตัวตนหรือลายเซ็น
 * ไม่บันทึกเลขเอกสาร ไม่สร้าง Assignment และไม่ยืนยันว่ามีการส่งมอบจริง
 */
export async function handoverPdf(rows,recipient,form) {
  setupPdf();
  const section=text=>({text,style:"section"});
  const table=(body,widths)=>({table:{widths,body},layout:{hLineColor:()=>"#afc2d2",vLineColor:()=>"#afc2d2",paddingTop:()=>8,paddingBottom:()=>8}});
  const equipment=[["ลำดับ","Asset ID","ประเภท","Brand / Model","Serial Number","จำนวน"].map(text=>({text,bold:true,fillColor:"#dceaf5"}))];
  for(let i=0;i<Math.max(5,rows.length);i++){const a=rows[i];equipment.push(a?[String(i+1),a.asset_code,value(a.asset_type),`${value(a.brand)} / ${value(a.model)}`,value(a.serial_number),"1"]:[String(i+1)," "," "," "," "," "]);}
  const blank="________________________";
  const content=[
    {columns:[{image:"data:image/png;base64,"+fs.readFileSync(resource("logo.png")).toString("base64"),width:65},{stack:[{text:"แบบฟอร์มรับมอบทรัพย์สินและอุปกรณ์ IT",style:"title",alignment:"center"},{text:"IT Asset Handover Form",alignment:"center"}],width:"*"}],margin:[0,0,0,14]},
    table([[`เลขที่เอกสาร: ${form.documentNo||blank}`,`วันที่ส่งมอบ: ${form.date||blank}`],[`ประเภทการรับมอบ: ${form.kind||blank}`,`สถานที่: ${form.location||blank}`]],["*","*"]),
    section("1. ข้อมูลพนักงาน"),table([[`ชื่อ-นามสกุล: ${recipient.full_name}`,`รหัสพนักงาน: ${value(recipient.employee_code)}`],[`แผนก: ${value(recipient.department)}`,`ตำแหน่ง: ${value(recipient.position)}`]],["*","*"]),
    section("2. รายการอุปกรณ์ที่รับมอบ"),{...table(equipment,[25,85,60,95,"*",30]),fontSize:9},
    {text:`หมายเหตุ / ตำหนิของอุปกรณ์ก่อนส่งมอบ: ${form.notes||blank}`,margin:[0,12,0,8]},
    section("3. วัตถุประสงค์การใช้งาน"),{text:`${form.purpose||blank}\nวันที่เริ่มครอบครอง: ${form.startDate||blank}`},
    {text:"4. ข้อตกลงในการรับมอบอุปกรณ์",style:"section",pageBreak:"before"},
    {ol:["ใช้อุปกรณ์เพื่อการปฏิบัติงานของบริษัทตามวัตถุประสงค์ที่กำหนด และดูแลรักษาให้อยู่ในสภาพเหมาะสม","ไม่นำอุปกรณ์ของบริษัทให้บุคคลอื่นใช้งานโดยไม่ได้รับอนุญาต และไม่ติดตั้งซอฟต์แวร์หรือแก้ไขการตั้งค่าด้าน Security โดยไม่ได้รับอนุญาตจากฝ่าย IT","หากอุปกรณ์ชำรุด สูญหาย หรือถูกโจรกรรม ต้องแจ้งผู้บังคับบัญชาและฝ่าย IT โดยเร็ว","เมื่อมีการเปลี่ยนอุปกรณ์ ย้ายหน้าที่ หรือพ้นสภาพการเป็นพนักงาน ต้องส่งคืนอุปกรณ์และอุปกรณ์ประกอบให้บริษัทตามรายการ","การพิจารณาความรับผิดชอบกรณีเกิดความเสียหายหรือสูญหาย ให้เป็นไปตามระเบียบและนโยบายของบริษัท"].map(text=>({text,margin:[0,0,0,9]}))},
    section("5. การยืนยันรับมอบ"),{text:"ข้าพเจ้าได้ตรวจสอบรายการอุปกรณ์และสภาพของทรัพย์สินข้างต้นแล้ว และยืนยันว่าได้รับอุปกรณ์ครบถ้วนตามรายการ",margin:[0,0,0,10]},
    table([["ผู้รับมอบ","ผู้ส่งมอบ / ฝ่าย IT","ผู้อนุมัติ / ผู้บังคับบัญชา"].map((title,i)=>({stack:[{text:title,bold:true,alignment:"center"},{text:`ชื่อ ${[recipient.full_name,form.deliveredBy||blank,form.approvedBy||blank][i]}`,margin:[0,16,0,16]},{text:`ลายเซ็น ${blank}`,margin:[0,0,0,16]},{text:"วันที่ ____ / ____ / ______"}],fontSize:9}))],["*","*","*"]),
    {text:`หมายเหตุฝ่าย IT: ${form.itNotes||blank}`,margin:[0,14,0,0]},
  ];
  // Producing a form is read-only: signatures remain blank and no assignment is created.
  return pdfmake.createPdf(definition(content)).getBuffer();
}
