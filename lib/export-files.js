import ExcelJS from "exceljs";
import pdfmake from "pdfmake";
import path from "node:path";
import fs from "node:fs";
import { formatUserDisplayName } from "./user-display.js";

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
  ["asset_code","Asset Code",23],["legacy_asset_codes","รหัสเดิม",23],
  ["asset_name","ชื่อทรัพย์สิน",32],["asset_type","ประเภท",20],
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
  sheet.getRow(1).height=28;sheet.autoFilter={from:"A1",to:"P1"};
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

// Shared AMZAP form appearance: logo, headings, ruled tables and Thai type.
function formHeading(title, subtitle) {
  return {columns:[
    {image:"data:image/png;base64,"+fs.readFileSync(resource("logo.png")).toString("base64"),width:65},
    {stack:[{text:title,style:"title",alignment:"center"},{text:subtitle,alignment:"center"}],width:"*"},
  ],margin:[0,0,0,14]};
}
function formTable(body, widths) {
  return {table:{widths,body},layout:{hLineColor:()=>"#afc2d2",vLineColor:()=>"#afc2d2",paddingTop:()=>8,paddingBottom:()=>8}};
}
// รายงานรายการ Asset แสดง Owner และผู้รับมอบหมายแยกบรรทัดให้เห็นทั้งสองบทบาท
// headerRows ทำให้หัวตารางซ้ำเมื่อตารางต่อหน้าถัดไป และ value() แสดง "-" เมื่อข้อมูลว่าง
export async function assetPdf(rows) {
  setupPdf();
  const body=[["Asset Code","ชื่อ / ประเภท","Serial Number","สถานะ","Owner / ผู้ครอบครอง","สถานที่"].map(text=>({text,bold:true,fillColor:"#dceaf5"})),
    ...rows.map(a=>[`${a.asset_code}${a.legacy_asset_codes?`\nเดิม: ${a.legacy_asset_codes}`:""}`,`${value(a.asset_name)}\n${value(a.asset_type)}`,value(a.serial_number),a.status,`Owner: ${value(a.owner_name)}\nผู้ครอบครอง: ${value(a.current_holder)}`,value(a.location)])];
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
export async function handoverPdf(rows,recipient,form,accessories=[]) {
  setupPdf();
  const section=text=>({text,style:"section"});
  const table=formTable;
  const equipment=[["ลำดับ","รายการ","Asset Code","Brand / Model","Serial Number","จำนวน"].map(text=>({text,bold:true,fillColor:"#dceaf5"}))];
  const equipmentRows=[
    ...rows.map((asset)=>({
      item:`Asset: ${value(asset.asset_type)}`,
      code:asset.asset_code,
      brandModel:`${value(asset.brand)} / ${value(asset.model)}`,
      serial:value(asset.serial_number),
      quantity:"1",
    })),
    ...accessories.map((accessory)=>({
      item:`Accessory: ${value(accessory.accessory_type)}`,
      code:"-",
      brandModel:`${value(accessory.brand)} / ${value(accessory.model)}`,
      serial:value(accessory.serial_number),
      quantity:String(accessory.quantity),
    })),
  ];
  for(let i=0;i<Math.max(5,equipmentRows.length);i++){const item=equipmentRows[i];equipment.push(item?[String(i+1),item.item,item.code,item.brandModel,item.serial,item.quantity]:[String(i+1)," "," "," "," "," "]);}
  const blank="________________________";
  const content=[
    formHeading("แบบฟอร์มรับมอบทรัพย์สินและอุปกรณ์ IT", "IT Asset Handover Form | FM-IT-001 Rev.00"),
    table([[`เลขที่เอกสาร: ${form.documentNo||blank}`,`วันที่ส่งมอบ: ${form.date||blank}`],[`ประเภทการรับมอบ: ${form.kind||blank}`,`สถานที่: ${form.location||blank}`]],["*","*"]),
    section("1. ข้อมูลพนักงาน"),table([[`ชื่อ-นามสกุล: ${recipient.full_name}`,`รหัสพนักงาน: ${value(recipient.employee_code)}`],[`แผนก: ${value(recipient.department)}`,`ตำแหน่ง: ${value(recipient.position)}`]],["*","*"]),
    section("2. รายการ Asset และ Accessory ที่รับมอบ"),{...table(equipment,[25,85,75,85,"*",30]),fontSize:9},
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

// Keep the usual employee form on one A4 page without shrinking signatures away.
// Very long equipment lists may still flow to another page instead of being clipped.
function verificationDefinition(content) {
  const doc = definition(content);
  doc.pageMargins = [30, 24, 30, 30];
  doc.defaultStyle = { ...doc.defaultStyle, fontSize: 9, lineHeight: 1.08 };
  doc.styles.title = { ...doc.styles.title, fontSize: 15, margin: [0, 0, 0, 5] };
  doc.styles.section = { ...doc.styles.section, fontSize: 10, margin: [0, 7, 0, 4] };
  return doc;
}

function verificationTable(body, widths) {
  const table = formTable(body, widths);
  table.layout = { ...table.layout, paddingTop: () => 4, paddingBottom: () => 4,
    paddingLeft: () => 5, paddingRight: () => 5 };
  return table;
}

export function verificationEquipmentRowCount(itemCount) {
  return Math.max(5, itemCount);
}

// Periodic employee verification is a separate signed record, not a handover.
// It always renders the immutable snapshot saved when the AV number was issued.
function assetVerificationContent(record) {
  const snapshot = record.snapshot;
  const employee = snapshot.employee;
  const blank = '________________________';
  const equipment = [
    ['ลำดับ', 'รายการ', 'Asset Code', 'Brand / Model', 'Serial Number', 'จำนวน']
      .map((text) => ({ text, bold: true, fillColor: '#dceaf5' })),
  ];
  const items = [
    ...snapshot.assets.map((asset) => ({
      name: `Asset: ${value(asset.asset_type)}`,
      code: value(asset.asset_code), brandModel: `${value(asset.brand)} / ${value(asset.model)}`,
      serial: value(asset.serial_number), quantity: '1',
    })),
    ...snapshot.accessories.map((accessory) => ({
      name: `Accessory: ${value(accessory.accessory_type)}`,
      code: '-', brandModel: `${value(accessory.brand)} / ${value(accessory.model)}`,
      serial: value(accessory.serial_number), quantity: String(accessory.quantity),
    })),
  ];
  // Keep five numbered lines on the form; never drop items when there are more.
  for (let index = 0; index < verificationEquipmentRowCount(items.length); index++) {
    const item = items[index];
    equipment.push(item
      ? [String(index + 1), item.name, item.code, item.brandModel, item.serial, item.quantity]
      : [String(index + 1), ' ', ' ', ' ', ' ', ' ']);
  }
  const heading = formHeading('ใบตรวจยืนยันทรัพย์สินประจำรอบ', 'Periodic IT Asset Verification');
  heading.columns[0].width = 52;
  heading.margin = [0, 0, 0, 7];
  return [
    heading,
    verificationTable([
      [`รหัสแบบฟอร์ม: ${record.form_revision}`, `เลขที่ใบตรวจ: ${record.document_no}`],
      [`รอบตรวจ: ${record.round_no}/${record.year}`, `วันที่ออกใบตรวจ: ${snapshot.issued_date}`],
    ], ['*', '*']),
    { text: '1. ข้อมูลพนักงาน', style: 'section' },
    verificationTable([
      [`ชื่อ-นามสกุล: ${value(employee.full_name)}`, `รหัสพนักงาน: ${value(employee.employee_code)}`],
      [`แผนก: ${value(employee.department)}`, `ตำแหน่ง: ${value(employee.position)}`],
    ], ['*', '*']),
    { text: '2. รายการทรัพย์สินและอุปกรณ์ที่ต้องตรวจ', style: 'section' },
    { ...verificationTable(equipment, [25, 85, 75, 85, '*', 30]), fontSize: 8.5 },
    { text: items.length
      ? 'รายการข้างต้นบันทึกจากข้อมูลผู้ครอบครองในระบบ ณ วันที่ออกใบตรวจ โปรดตรวจอุปกรณ์จริงก่อนลงนาม'
      : 'ระบบไม่พบทรัพย์สินหรืออุปกรณ์ที่พนักงานครอบครอง ณ วันที่ออกใบตรวจ โปรดตรวจสอบจริงก่อนลงนาม',
    margin: [0, 6, 0, 3], color: '#475569' },
    { text: '3. ผลการตรวจและการยืนยัน', style: 'section' },
    { text: `ผลการตรวจ:  □ ตรงตามรายการ  □ ไม่ตรงตามรายการ (ระบุรายละเอียด)\n${blank} ${blank}\nวันที่ตรวจจริง: ____ / ____ / ______`,
      margin: [0, 0, 0, 6] },
    { text: 'ข้าพเจ้าได้ตรวจสอบรายการทรัพย์สินและอุปกรณ์ข้างต้นแล้ว และยืนยันผลการตรวจตามที่ระบุในเอกสารฉบับนี้',
      margin: [0, 0, 0, 6] },
    verificationTable([['พนักงานผู้ครอบครอง', 'เจ้าหน้าที่ IT ผู้ตรวจ'].map((title, index) => ({
      stack: [
        { text: title, bold: true, alignment: 'center' },
        { text: `ชื่อ ${index === 0 ? value(employee.full_name) : blank}`, margin: [0, 12, 0, 12] },
        { text: `ลายเซ็น ${blank}`, margin: [0, 0, 0, 12] },
        { text: 'วันที่ ____ / ____ / ______' },
      ], fontSize: 8.5,
    }))], ['*', '*']),
  ];
}

export async function assetVerificationPdf(record) {
  setupPdf();
  return pdfmake.createPdf(verificationDefinition(assetVerificationContent(record))).getBuffer();
}

export async function assetVerificationBatchPdf(records) {
  if (!records.length) throw new Error('No verification records to print');
  setupPdf();
  const content = records.flatMap((record, index) => {
    const pages = assetVerificationContent(record);
    if (index > 0) pages[0] = { ...pages[0], pageBreak: 'before' };
    return pages;
  });
  return pdfmake.createPdf(verificationDefinition(content)).getBuffer();
}

// Read only: use the saved request snapshot, never live assignments/stock.
// This is a request, not the handover confirmation or its employee agreements.
export function requisitionDefinition(request) {
  const employee = request.employee_snapshot;
  const replacement = request.request_kind === "replacement";
  const number = `REQ-${String(request.id).padStart(6,"0")}`;
  const blank = "________________________";
  const equipment = [(replacement
    ? ["ลำดับ","รายการอุปกรณ์","Asset Code ที่คืน","Asset Code ทดแทน","รายละเอียด / สเปก","จำนวน"]
    : ["ลำดับ","รายการอุปกรณ์","รายละเอียด / สเปก","จำนวน"])
    .map(text => ({text,bold:true,fillColor:"#dceaf5"}))];
  for (let i=0; i<Math.max(5,request.items.length); i++) {
    const item=request.items[i];
    equipment.push(item
      ? replacement
        ? [String(i+1),item.name,value(item.returnedAssetCode),value(item.replacementAssetCode || item.originalAssetCode),value(item.details),String(item.quantity)]
        : [String(i+1),item.name,value(item.details),String(item.quantity)]
      : Array(replacement ? 6 : 4).fill(" ").map((value,index) => index === 0 ? String(i+1) : value));
  }
  const equipmentTable=formTable(equipment,replacement ? [22,62,66,66,"*",28] : [25,115,"*",35]);
  equipmentTable.table.headerRows=1;
  // Keep normal equipment rows together; allow exceptionally tall imported text
  // to flow instead of forcing a row larger than an entire printable page.
  equipmentTable.table.dontBreakRows=request.items.every(item =>
    [item.name,item.details,item.returnedAssetCode,item.replacementAssetCode,item.originalAssetCode].join('\n').split(/\r\n|\r|\n/).length <= 24);
  const signatures=formTable([["ผู้ขอ","เจ้าหน้าที่ IT","ผู้อนุมัติ / ผู้บังคับบัญชา"].map((title,i)=>({
    stack:[{text:title,bold:true,alignment:"center"},
      {text:`ชื่อ ${i===0 ? employee.full_name : i===1 ? value(request.it_staff_name) : blank}`,margin:[0,16,0,16]},
      {text:`ลายเซ็น ${blank}`,margin:[0,0,0,16]},
      {text:"วันที่ ____ / ____ / ______"}],fontSize:9,
  }))],["*","*","*"]);
  signatures.table.dontBreakRows=true;
  const content=[
    formHeading("แบบฟอร์มขอเบิก / เปลี่ยนทดแทนและรับคืนอุปกรณ์ IT", "IT Asset Requisition / Replacement & Return Form"),
    formTable([[`เลขที่เอกสาร: ${number}`,`วันที่ขอ: ${request.requested_date.split("-").reverse().join("/")}`],
      [`ประเภทคำขอ: ${replacement ? "เปลี่ยนทดแทน / คืน" : "ขอเพิ่ม"}`,`สถานที่: ${value(employee.location_name)}`]],["*","*"]),
    {text:"1. ข้อมูลพนักงาน",style:"section"},
    formTable([[`ชื่อ-นามสกุล: ${formatUserDisplayName(employee)}`,`รหัสพนักงาน: ${value(employee.employee_code)}`],
      [`แผนก: ${value(employee.department_name)}`,`ตำแหน่ง: ${value(employee.position)}`]],["*","*"]),
    {text:"2. รายการอุปกรณ์ที่ขอเบิก / เปลี่ยน",style:"section"},
    {...equipmentTable,fontSize:9},
    {text:"3. เหตุผล / วัตถุประสงค์ที่ขอ",style:"section"},
    {text:request.reason,margin:[0,0,0,8]},
    {text:"ใบนี้เป็นคำขอเท่านั้น ไม่ใช่หลักฐานรับมอบหรือรับคืนอุปกรณ์ การจ่ายและรับคืนให้ IT บันทึกเมื่อส่งมอบจริง",fontSize:9,color:"#555555",margin:[0,4,0,6]},
    {unbreakable:true,stack:[
      {text:"4. การลงนาม",style:"section"},signatures,
      {text:`หมายเหตุฝ่าย IT: ${blank}`,margin:[0,14,0,0]},
    ]},
  ];
  return {...definition(content),
    footer:(page,total)=>({stack:[
      {text:`ผู้บันทึก: ${value(request.created_by_name)} | เจ้าหน้าที่ IT: ${value(request.it_staff_name)} | ${number}`,fontSize:7},
      {text:`AMZAP Group | IT Asset Management     ${page} / ${total}`,fontSize:8},
    ],alignment:"center",color:"#777777",margin:[35,8,35,0]}),
    info:{title:`AMZAP ${number} - IT Asset Requisition`,author:"AMZAP IT Asset Management"}};
}

export async function requisitionPdf(request) {
  setupPdf();
  return pdfmake.createPdf(requisitionDefinition(request)).getBuffer();
}
