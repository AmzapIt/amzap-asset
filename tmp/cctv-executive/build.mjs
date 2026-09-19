import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const out='D:/Myproject/my-app/outputs/cctv-executive-20260917';
const tmp='D:/Myproject/my-app/tmp/cctv-executive';
const wb=Workbook.create();
const summary=wb.worksheets.add('สรุปผู้บริหาร');
const specs=wb.worksheets.add('อุปกรณ์และบริการ');
const inputs=wb.worksheets.add('ข้อมูลใบเสนอราคา');
const navy='#233750', ink='#243247', blue='#EAF0F7', amber='#FFF0CF', pale='#F5F7FA';
const money='#,##0.00"  ";[Red](#,##0.00)"  ";"-  "';
const delta='+#,##0.00"  ";[Red](#,##0.00)"  ";"-  "';
function cell(s,a,v){s.getRange(a).values=[[v]];}
function fx(s,a,v){s.getRange(a).formulas=[[v]];}
function base(s,range,widths){
 s.showGridLines=false;
 s.getRange(range).format={font:{name:'Arial',size:11,color:ink},rowHeight:25,verticalAlignment:'center'};
 widths.forEach((w,i)=>s.getRangeByIndexes(0,i,1,1).format.columnWidthPx=w);
}
function title(s,t,sub,last){
 cell(s,'A2',t);s.getRange('A2').format.font={name:'Arial',size:17,bold:true,color:navy};
 s.getRange('A2').format.rowHeight=32;
 cell(s,'A3',sub);s.getRange('A3').format.font={name:'Arial',size:11,color:'#526379'};
 s.getRange(`A4:${last}4`).format.borders={bottom:{style:'thin',color:navy}};
}
function head(s,row,vals){
 const r=s.getRangeByIndexes(row-1,0,1,vals.length);r.values=[vals];
 r.format={fill:navy,font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',rowHeight:40};
 r.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};
}
function band(s,row,text,last){cell(s,`A${row}`,text);s.getRange(`A${row}:${last}${row}`).format={fill:blue,font:{name:'Arial',size:11,bold:true,color:navy},rowHeight:29};}
function body(s,a,b,last,h){
 const r=s.getRange(`A${a}:${last}${b}`);r.format.wrapText=true;r.format.rowHeight=h;r.format.verticalAlignment='center';
 for(let n=a;n<=b;n++)if((n-a)%2===1)s.getRange(`A${n}:${last}${n}`).format.fill=pale;
}
function date(y,m,d){return new Date(Date.UTC(y,m-1,d));}

base(inputs,'A1:L36',[150,110,135,125,145,145,235,115,205,28,400,340]);
title(inputs,'ข้อมูลใบเสนอราคาและแหล่งอ้างอิง','หน่วยเงิน: บาท | วันที่แสดงเป็น ค.ศ. | เก็บยอดตามเอกสารเพื่อป้องกันการบวก VAT หรือค่าติดตั้งซ้ำ','L');
cell(inputs,'A5','วันที่เปรียบเทียบ');cell(inputs,'B5',date(2026,9,17));inputs.getRange('B5').setNumberFormat('dd/mm/yyyy');
head(inputs,7,['ผู้เสนอ / ฉบับ','วันที่เอกสาร','ก่อน VAT ตามใบ','VAT ตามใบ','ยอดคำนวณ','ยอดสุทธิตามใบ','ขอบเขตราคา','ใช้ได้ถึง','สถานะราคา','','แหล่งข้อมูล','หมายเหตุ']);
inputs.getRange('J7').format.fill='#FFFFFF';
const quotes=[
 ['JW+',date(2026,9,7),257650,18035.50,null,275685.50,'อุปกรณ์และติดตั้ง',date(2026,10,7),null,null,'JW+_QT2026080032_HIKVISION ระบบกล้องวงจรปิด สําหรับ บริษัท .pdf หน้า 1','ใช้ได้ถึงคำนวณจากวันที่ออก + 30 วัน ต้องยืนยันรุ่นและขอบเขตงาน'],
 ['Work',date(2026,8,3),216233.64,15136.36,null,231370,'อุปกรณ์และติดตั้ง',date(2026,8,18),null,null,'MX-3051_20260915_175848.pdf หน้า 1','ยอดรวมรายการสินค้าในใบเป็นยอดสุทธิแล้ว ไม่บวก VAT อีก ไม่บวกค่าติดตั้งหน้า 2 ซ้ำ'],
 ['SSD',date(2026,9,16),279760.10,19583.21,null,299343.31,'อุปกรณ์และติดตั้ง',null,null,null,'ใบเสนอราคา_ บริษัท แอมแซ่บ กรุ๊ป จำกัด.pdf หน้า 1','ไม่ระบุอายุราคา กำหนดส่งมอบ หรือเงื่อนไขชำระเงิน'],
 ['Automation R1',date(2026,8,14),537112.50,37597.88,null,574710.38,'อุปกรณ์และติดตั้ง',date(2026,8,31),null,null,'MX-3051_20260915_175806.pdf หน้า 1 ฉบับ R1','ใช้ฉบับปรับปรุง R1 เป็นฐาน ไม่รวมกับฉบับเดิม'],
 ['SEC',date(2026,8,4),150808,10556.56,null,161364.56,'อุปกรณ์ ไม่รวมงานติดตั้ง',date(2026,8,19),null,null,'MX-3051_20260915_175836.pdf หน้า 1','ไฟล์มี 1 หน้า แต่ท้ายเอกสารพิมพ์หน้า 1/2 ควรขอเอกสารครบชุด'],
 ['OTT 48 จุด',date(2026,7,27),70400,0,null,70400,'ค่าแรงติดตั้ง 48 จุด',date(2026,8,3),null,null,'MX-3051_20260915_175912.pdf หน้า 1','เอกสารระบุยอดไม่มี/ยกเว้น VAT ใช้ยอดงาน 70,400 บาท ไม่ใช้ยอดหลังหัก ณ ที่จ่ายเป็นต้นทุน'],
 ['Work ค่าติดตั้ง',date(2026,8,3),61308.41,4291.59,null,65600,'ทางเลือกงานติดตั้งแยก',date(2026,8,18),null,null,'MX-3051_20260915_175848.pdf หน้า 2','รายการซ้ำกับส่วนติดตั้งในหน้า 1 ต้องยืนยันว่ารับติดตั้งของที่ลูกค้าซื้อเองในราคานี้'],
 ['OTT 32 จุด',date(2026,7,27),45200,0,null,45200,'ทางเลือกค่าแรง 32 จุด',date(2026,8,27),null,null,'MX-3051_20260915_175912.pdf หน้า 2','ไม่เทียบตรงกับโครงการ 48 จุด และไม่บวกกับหน้า 1'],
 ['Automation เดิม',date(2026,8,7),550910,38563.70,null,589473.70,'ฉบับเดิม ใช้ดูประวัติ',date(2026,8,31),null,null,'MX-3051_20260915_175806.pdf หน้า 2','ไม่นำมาบวกกับฉบับ R1']
];
inputs.getRange('A8:L16').values=quotes;
for(let r=8;r<=16;r++){
 fx(inputs,`E${r}`,`=ROUND(SUM(C${r}:D${r}),2)`);
 fx(inputs,`I${r}`,`=IF(H${r}="","ไม่ระบุ ต้องยืนยัน",IF(H${r}<$B$5,"พ้นช่วงยืนราคา","อยู่ในช่วงตามเอกสาร"))`);
}
body(inputs,8,16,'L',84);inputs.getRange('J8:J16').format.fill='#FFFFFF';
inputs.getRange('B8:B16').setNumberFormat('dd/mm/yyyy');inputs.getRange('H8:H16').setNumberFormat('dd/mm/yyyy');
inputs.getRange('C8:F16').setNumberFormat(money);inputs.getRange('C8:F16').format.horizontalAlignment='right';
inputs.getRange('I8:I16').conditionalFormats.add('containsText',{text:'พ้นช่วง',format:{fill:amber,font:{color:'#8A4D00'}}});
inputs.getRange('I8:I16').conditionalFormats.add('containsText',{text:'ไม่ระบุ',format:{fill:amber}});
band(inputs,18,'ตรวจยอดและคำนวณส่วนต่าง','I');
head(inputs,19,['รายการ','หน่วย','ผลคำนวณ','ฐานเปรียบเทียบ','คำอธิบาย']);
const calcs=[
 ['JW+ สูงกว่า Work','บาท','=E8-E9','งานพร้อมติดตั้ง','ขอบเขตต่างกัน JW+ มีจอและ HDD มากกว่า'],
 ['JW+ สูงกว่า Work','สัดส่วน','=C20/E9','ยอดสุทธิ Work','ส่วนต่างราคา ไม่ใช่ส่วนต่างสเปคที่ปรับให้เท่ากัน'],
 ['SSD สูงกว่า Work','บาท','=E10-E9','งานพร้อมติดตั้ง','สเปคหลักใกล้เคียง แต่บริการต่างกัน'],
 ['SSD สูงกว่า JW+','บาท','=E10-E8','งานพร้อมติดตั้ง','SSD ไม่มีจอในรายการและ HDD น้อยกว่า'],
 ['Automation สูงกว่า JW+','บาท','=E11-E8','งานพร้อมติดตั้ง','งานเอกสารและขอบเขตประกอบต่างกัน'],
 ['SEC + Work ติดตั้ง','บาท','=SUM(E12,E14)','ประมาณการรวมสองใบ','ยังขาด PoE และต้องยืนยันการรับติดตั้ง ไม่ใช่ราคาพร้อมใช้'],
 ['SEC + OTT 48 จุด','บาท','=SUM(E12:E13)','ประมาณการรวมสองใบ','ยังขาด PoE วัสดุ และงานประกอบ ต้องยืนยันเพิ่ม'],
 ['ยอดคลาดเคลื่อนรวม','บาท','=SUM(E8:E16)-SUM(F8:F16)','เทียบยอดคำนวณกับใบ','ผลควรเป็นศูนย์']
];
for(let i=0;i<calcs.length;i++){const r=20+i;let [a,b,f,d,e]=calcs[i];inputs.getRange(`A${r}:E${r}`).values=[[a,b,null,d,e]];fx(inputs,`C${r}`,f);}
body(inputs,20,27,'E',58);inputs.getRange('C20:C27').setNumberFormat(money);inputs.getRange('C21').setNumberFormat('0.0%');
band(inputs,29,'แหล่งข้อมูลเพิ่มเติมสำหรับประเมินอุปกรณ์','I');
const refs=[
 ['แปลนโครงการ','MX-3051_20260915_175704.pdf หน้า 1–2','กล้องใหม่ 48 จุด แยกจากกล้องเดิมที่เขียนกำกับ 39 ตัว'],
 ['สเปคกล้อง Hikvision','https://pro-av.hikvision.com/mena-en/products/IP-Products/Network-Cameras/value-series/ds-2cd1043g2-liu-f-/','4MP, เลนส์ 2.8/4 มม., IP67, H.265+, ภาพ 4MP สูงสุด 20 fps'],
 ['สวิตช์ 8 พอร์ต','https://pro-av.hikvision.com/mena-en/products/transmission/Network-Switches/smart-managed-series/ds-3e1310p-ei-m/','DS-3E1310P-EI/M มี PoE 8 พอร์ตและ Gigabit uplink 2 พอร์ต กำลัง PoE รวมตามรุ่น 60W'],
 ['โหมดแสงกลางคืน','https://pro-av.hikvision.com/ca-en/core-technologies/see-clearer-technology/smart-hybrid-light/','Smart mode อาจเป็นภาพขาวดำและเปลี่ยนเป็นสีเมื่อเปิดไฟขาว'],
 ['ระยะสาย Ethernet','https://www.eaton.com/us/en-us/products/backup-power-ups-surge-it-power-distribution/network-connectivity/ethernet-cables-explained.html','CAT5E/CAT6 ทั่วไป ออกแบบช่องสัญญาณรวมไม่เกิน 100 เมตร'],
 ['NVR DS-7616NXI-K2','https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000132/S000000007/S000000026/OFR031212/M000058885/Data_Sheet/Datasheet-of-DS-7616NXI-K2_V4.74.000_20230209.pdf','รองรับ 16 กล้อง ข้อมูลขาเข้า 160 Mbps ต้องยืนยันรุ่นย่อย']
];
for(let i=0;i<refs.length;i++){cell(inputs,`A${30+i}`,refs[i][0]);cell(inputs,`C${30+i}`,refs[i][2]);cell(inputs,`K${30+i}`,refs[i][1]);}
inputs.getRange('A30:L35').format.rowHeight=85;inputs.getRange('A30:L35').format.wrapText=true;
inputs.getRange('C30:I35').merge(true); // source descriptions only, one distinct field per row
inputs.freezePanes.freezeRows(7);inputs.freezePanes.freezeColumns(1);

base(specs,'A1:H57',[215,110,230,230,230,230,230,230]);
title(specs,'อุปกรณ์และบริการที่เสนอ','ตัวเลขตามใบเสนอราคา ส่วนความเหมาะสมเป็นการประเมินจากเอกสาร ไม่ใช่การตรวจผลงานหน้างาน','H');
head(specs,5,['รายการ','หน่วย','JW+','Work','SSD','Automation R1','SEC','OTT 48 จุด']);
const rows=[
 ['ขอบเขต','', 'อุปกรณ์และติดตั้ง','อุปกรณ์และติดตั้ง','อุปกรณ์และติดตั้ง','อุปกรณ์และติดตั้ง','อุปกรณ์เท่านั้น','ค่าแรงเท่านั้น'],
 ['กล้องใหม่','ตัว',48,48,48,48,48,'ติดตั้ง 48'],
 ['ชนิดและรุ่นกล้อง','', '4MP Bullet 42 ตัว + ภาพสี 6 ตัว ไม่ระบุรุ่น/ความละเอียดของ 6 ตัว','DS-2CD1043G2-LIU 4MP จำนวน 48 ตัว เลนส์ 2.8 มม.','DS-2CD1043G2-LIU 4MP จำนวน 48 ตัว ไม่ระบุเลนส์','4MP Bullet 13 ตัว + Dome 35 ตัว ไม่ระบุรหัสรุ่น','DS-2CD1043G2-LIU 4MP จำนวน 48 ตัว เลนส์ 2.8 มม.','ไม่เสนออุปกรณ์'],
 ['NVR','', 'AcuSense K Series 16 ช่อง × 3 ไม่ระบุรุ่นเต็ม','DS-7616NXI-K2 16 ช่อง × 3','DS-7616NXI-K2 16 ช่อง × 3 มี 2 SATA','AcuSense K Series 16 ช่อง × 3 ไม่ระบุรุ่นเต็ม','DS-7616NXI-K2(D) 16 ช่อง × 3','ค่าแรงติดตั้ง NVR 3 เครื่อง'],
 ['ช่องบันทึกรวม','ช่อง',48,48,48,48,48,'ไม่เสนออุปกรณ์'],
 ['HDD','', 'WD Surveillance 10TB × 3 ไม่ระบุรุ่นเต็ม','4TB × 6 ไม่ระบุยี่ห้อ/รุ่น','HDD CCTV 4TB × 6 ไม่ระบุยี่ห้อ/รุ่น','Seagate SkyHawk 4TB × 6','4TB × 6 WD หรือ Seagate ตามสต็อก ไม่ระบุรุ่น','ไม่เสนออุปกรณ์'],
 ['ความจุรวม','TB',30,24,24,24,24,'ไม่เสนออุปกรณ์'],
 ['สวิตช์ PoE','', '4 พอร์ต × 3 / 8 พอร์ต × 2 / 24 พอร์ต × 1 ไม่ระบุรุ่น','4 พอร์ต × 2 / 8 พอร์ต × 8 ไม่ระบุรหัสรุ่น','DS-3E1106P-EI/M × 2 และ DS-3E1310P-EI/M × 8','24 พอร์ต × 3 ไม่ระบุรหัสรุ่น','DS-3E1106P-EI/M × 2 และ DS-3E1310P-EI/M × 1','ไม่เสนออุปกรณ์'],
 ['พอร์ต PoE ตามรายการ','พอร์ต',52,72,72,72,16,'ไม่เสนออุปกรณ์'],
 ['สาย LAN','', 'CAT6 ไม่ระบุยี่ห้อ/ชนิด/ระยะ','LINK CAT5E Outdoor 1,200 เมตร','LINK US-9045 CAT5E Outdoor 1,200 เมตร','LINK CAT6 Outdoor และชนิดมี Drop Wire ไม่ระบุระยะรวม','LINK US-9045 CAT5E Outdoor 305 เมตร × 4 กล่อง','ระบุค่าแรงเดินสาย ต้องยืนยันวัสดุ'],
 ['ตู้เก็บอุปกรณ์','', 'Wall Rack 2 ตู้ ไม่ระบุขนาด','ตู้เหล็ก 4 ใบ ไม่ระบุขนาด','ตู้เหล็ก 4 ใบ ไม่ระบุขนาด','Wall Rack 6U × 2 พร้อมถาด พัดลม และปลั๊ก','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ'],
 ['จอแสดงผล','', 'Samsung 32 นิ้ว × 3 ไม่ระบุรุ่น','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ','ไม่ปรากฏเป็นรายการสินค้า','ไม่ปรากฏในรายการ','ไม่เสนอจอ มีค่าแรงเดินสัญญาณไปจอ 3 จุด'],
 ['ระบบส่งภาพไปจอ','', 'ต้องยืนยันวิธีและอุปกรณ์ให้ครบ','ต้องยืนยันว่ารวมงานนี้หรือไม่','ต้องยืนยันว่ารวมงานนี้หรือไม่','HDMI Extender 70 เมตร 1080p60 × 3','ไม่ปรากฏในรายการ','ค่าแรง 3 จุด ต้องยืนยันอุปกรณ์'],
 ['UPS สำรองไฟ','', 'ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ','ไม่ปรากฏในรายการ'],
 ['รับประกันอุปกรณ์','', 'Hikvision 3 ปี อุปกรณ์ประกอบ 1 ปี','กล้อง NVR HDD 3 ปี','1 ปีตามใบ ต้องชี้แจงประกันผู้ผลิต','12 เดือนตามใบ','กลุ่ม CCTV Hikvision 3 ปี อื่น ๆ ตามผู้ผลิต','ไม่ระบุ'],
 ['งานติดตั้งและบริการปีแรก','', 'ประกันงาน 1 ปี ตรวจ 4 ครั้ง','เซอร์วิสฟรี 1 ปี ไม่ระบุรอบตรวจ','ประกันงาน 1 ปี ตรวจทุก 3 เดือน','ประกัน 12 เดือน ไม่ระบุรอบตรวจ','ไม่รวมติดตั้ง','ไม่ระบุประกันงาน'],
 ['เวลาตอบรับและเข้าหน้างาน','', 'โทร/Remote ภายใน 6 ชม. เข้าหน้างาน 1–2 วันทำการถ้าแก้ทางไกลไม่ได้','ไม่ระบุ','ไม่ระบุ','ไม่ระบุ','ไม่ระบุบริการหน้างาน','ไม่ระบุ'],
 ['ค่าใช้จ่ายหลังปีแรก','', 'ไม่ระบุค่าต่อสัญญา/ค่าเดินทาง','ระบุค่าบริการครั้งละ 700 บาท ต้องยืนยันขอบเขต','ไม่ระบุ','ไม่ระบุ','ไม่ระบุ','ไม่ระบุ'],
 ['กำหนดส่งมอบตามใบ','', 'ประมาณ 30–45 วันหลังยืนยันและรับงวดแรก','ส่งของภายใน 30 วัน ต้องยืนยันวันติดตั้งเสร็จ','ไม่ระบุ','8–10 สัปดาห์หลัง PO','ส่งสินค้า 1–3 วันทำการหลังชำระครบและมีสต็อก','ไม่ระบุ'],
 ['เงื่อนไขชำระเงิน','', '50% สั่งซื้อ / 30% ส่งของ / 20% ติดตั้งเสร็จ','ไม่ระบุ','ไม่ระบุ','50% มัดจำ / 40% คืบหน้าเดินสาย / 10% ตั้งค่าและอบรม','100% หลัง PO ก่อนจัดส่ง','50% ก่อนเข้าหน้างาน / 50% เสร็จงาน'],
 ['จุดที่ต้องยืนยันรายเจ้า','', 'รุ่นเต็มทุกชิ้น งานจอ งานระบบเดิม ระยะสาย ระยะเก็บภาพ บริการปี 2–3','รุ่นสวิตช์/HDD งานจอ เวลาบริการ และราคาใหม่','เหตุผลส่วนต่างราคา ประกันหลังปีแรก HDD งานจอ และกำหนดส่ง','แจกแจงวัสดุ 138,000 และแรงงาน 187,000 บาทก่อน VAT พร้อมรุ่นอุปกรณ์','PoE ขาด 32 พอร์ตถ้าใช้ของใหม่ทั้งหมด และเอกสารหน้าที่ขาด','วัสดุรวมอะไรบ้าง ใครรับผิดชอบระบบเมื่อเสีย และประกันงาน']
];
specs.getRange('A6:H26').values=rows;body(specs,6,26,'H',78);
for(const r of [7,10,12,14]){specs.getRange(`A${r}:H${r}`).format.rowHeight=33;specs.getRange(`C${r}:G${r}`).setNumberFormat('#,##0');specs.getRange(`C${r}:G${r}`).format.horizontalAlignment='right';}
specs.getRange('G14').conditionalFormats.add('cellIs',{operator:'lessThan',formula:48,format:{fill:'#FCE5E5',font:{color:'#9B2020',bold:true}}});
band(specs,28,'การประเมินความเหมาะสมและข้อจำกัด','H');
head(specs,29,['อุปกรณ์ / ประเด็น','', 'เหมาะกับงานใด / ข้อดี','', 'ข้อจำกัด','', 'สิ่งที่ควรกำหนดก่อนสั่งซื้อ','']);
for(const pair of ['A29:B29','C29:D29','E29:F29','G29:H29'])specs.getRange(pair).merge();
const assessments=[
 ['กล้อง 4MP เลนส์ 2.8 มม.','ดูพื้นที่ทั่วไป คลัง ทางเดิน และสำนักงาน มุมกว้าง มีเสียงและไฟช่วยกลางคืน','วัตถุไกลมีรายละเอียดเล็ก ไม่รับรองเห็นหน้าหรือทะเบียนชัดทุกจุด รุ่น DS-2CD1043G2-LIU ให้ 4MP สูงสุด 20 fps','สำรวจระยะและมุม แยกจุดดูภาพรวมออกจากจุดต้องระบุหน้า/ทะเบียน ทดสอบกลางวันและกลางคืน'],
 ['กล้องภาพสี 6 จุดของ JW+','แนวคิดใช้กล้องเฉพาะกับจุดสำคัญเหมาะสม','ไม่ระบุรุ่นหรือความละเอียด จึงยังนับว่าเหนือกว่ารุ่นอื่นไม่ได้ Smart mode อาจสลับขาวดำ/สี','ให้ระบุรุ่นและตำแหน่งทั้ง 6 จุด พร้อมสาธิตภาพในแสงจริง'],
 ['NVR 16 ช่อง × 3','แบ่งกล้องเป็น 3 กลุ่ม ดูแลแยกได้ เครื่องหนึ่งเสียอาจกระทบเพียงกลุ่มนั้นหากไฟ/เครือข่ายส่วนร่วมยังปกติ','48 ช่องเต็มตั้งแต่เริ่ม ไม่มีช่องเผื่อเพิ่ม การรับบันทึกไม่เท่ากับการแสดงภาพเต็มความละเอียดพร้อมกัน','ยืนยันรุ่นย่อย โหมดแสดงผล และแผนเพิ่มกล้อง NVR หลายเครื่องไม่ใช่ระบบสำรองอัตโนมัติ'],
 ['HDD 24TB / 30TB','30TB เก็บภาพได้มากกว่า 24TB ประมาณ 25% ที่การตั้งค่าเดียวกัน','ไม่มีรายใดรับรองจำนวนวันย้อนหลัง HDD สองลูกไม่เท่ากับมีสำรองข้อมูล','ระบุรุ่น Surveillance และจำนวนวันเก็บภาพที่ความละเอียด/เฟรมเรตตามเกณฑ์ตรวจรับ'],
 ['PoE และการรวมเครือข่าย','พอร์ตกล้อง 100 Mbps รองรับกล้องที่ใช้ข้อมูลไม่กี่ Mbps ได้ จำนวนสวิตช์ควรสอดคล้องพื้นที่','จำนวนพอร์ตไม่รับรองกำลังไฟเพียงพอ และพอร์ตเผื่อไม่เพิ่มช่องบันทึก NVR','ตรวจโหลดไฟตอนกลางคืน ความเร็ว uplink และการระบายความร้อน โดย SEC ต้องเติมรายการที่ขาด'],
 ['CAT5E / CAT6 และงานสาย','CAT5E Outdoor ใช้กับกล้องชุดนี้ได้ CAT6 ให้ทางเลือกการใช้งานในอนาคตมากขึ้น','CAT6 ไม่ทำให้ภาพคมขึ้นเอง งานสายยาว/ข้ามอาคารต้องออกแบบตามระยะจริง','กำหนดเส้นทาง ระยะสาย จุดต่อ การป้องกันน้ำ และผลทดสอบสาย'],
 ['จอ ตู้ และ UPS','JW+ มีจอ 3 เครื่อง Automation ระบุตู้และ Extender ชัดกว่า','ทุกใบยังไม่เห็น UPS ชัดเจน จอและตัวส่งภาพเป็นคนละรายการ','รวมงานส่งภาพถึงจอทุกจุด และสำรองไฟทั้ง NVR กับ PoE ตามระยะเวลาที่ตกลง']
];
for(let i=0;i<assessments.length;i++){let r=30+i;for(let j=0;j<4;j++){const col=j*2;specs.getRangeByIndexes(r-1,col,1,2).merge();cell(specs,String.fromCharCode(65+col)+r,assessments[i][j]);}specs.getRange(`A${r}:H${r}`).format={wrapText:true,rowHeight:90,fill:i%2?pale:'#FFFFFF'};}
band(specs,38,'ประมาณการระยะเวลาเก็บภาพ แบบบันทึกต่อเนื่อง 24 ชั่วโมง','H');
cell(specs,'A39','จำนวนกล้อง');cell(specs,'B39',48);specs.getRange('B39').format.fill=amber;
cell(specs,'C39','TB ใช้ฐานสิบ / ยังไม่หักพื้นที่ระบบ เสียง และส่วนเผื่อ');
head(specs,41,['ความจุ (TB)','Mbps/กล้อง','วันโดยประมาณ','', 'คำอธิบาย']);
specs.getRange('A42:B45').values=[[24,2],[30,2],[24,4],[30,4]];
for(let r=42;r<=45;r++)fx(specs,`C${r}`,`=A${r}*1000000000000*8/($B$39*B${r}*1000000*86400)`);
specs.getRange('C42:C45').setNumberFormat('0.0');specs.getRange('A42:B45').format.fill=amber;
cell(specs,'E42','เป็นตัวอย่างคำนวณ ไม่ใช่ระยะเวลารับประกันจากผู้ขาย');
cell(specs,'E44','ใช้ผลคำนวณด้านซ้ายประกอบการกำหนดจำนวนวันเก็บภาพกับผู้ขาย');
specs.getRange('E42:H43').merge();specs.getRange('E44:H45').merge();specs.getRange('E42:H45').format.wrapText=true;
cell(specs,'A47','ช่องสีเหลืองปรับสมมติฐานได้ ผลคำนวณจะเปลี่ยนตาม ส่วนความเห็นผู้ขายเป็นข้อสรุป ณ วันที่จัดทำ');
specs.freezePanes.freezeRows(5);specs.freezePanes.freezeColumns(2);

base(summary,'A1:F33',[140,145,150,250,255,285]);summary.tabColor=navy;
title(summary,'เปรียบเทียบข้อเสนอระบบกล้องวงจรปิด 48 จุด','บริษัท แอมแซ่บ กรุ๊ป จำกัด | ณ 17 กันยายน 2569 | เน้นความคุ้มค่ารวมบริการหลังการขาย','F');
cell(summary,'A5','ข้อเสนอแนะ');summary.getRange('A5').format.font.bold=true;
cell(summary,'B5','เจรจา JW+ เป็นตัวเลือกแรก และ Work เป็นทางเลือกคุมงบ โดยขอราคาใหม่บนขอบเขตเดียวกัน');
cell(summary,'A6','เงื่อนไขตัดสินใจ');cell(summary,'B6','ยืนยันรุ่นอุปกรณ์ จำนวนวันเก็บภาพ งานจอ/ระบบเดิม และค่าใช้จ่ายบริการปีที่ 2–3 ก่อนสั่งซื้อ');
band(summary,8,'กลุ่มอุปกรณ์พร้อมติดตั้ง ขอบเขตยังต่างกัน','F');
head(summary,9,['ผู้เสนอ','ยอดสุทธิ (บาท)','ต่างจาก Work (บาท)','อุปกรณ์ที่แตกต่าง','บริการตามเอกสาร','ความเห็น / ประเด็นตัดสินใจ']);
const executive=[
 ['JW+',null,null,'HDD 30TB / จอ 32 นิ้ว 3 เครื่อง / CAT6 / กล้องพิเศษ 6 จุด','ตรวจ 4 ครั้งปีแรก Remote 6 ชม. เข้าหน้างาน 1–2 วันทำการ','ตัวเลือกแรกแบบมีเงื่อนไข ต้องระบุรุ่นเต็มและงานเชื่อมต่อให้ครบ'],
 ['Work',null,null,'4MP 48 ตัว / HDD 24TB / PoE 72 พอร์ต / CAT5E ไม่มีจอในรายการ','กล้อง NVR HDD 3 ปี เซอร์วิสฟรีปีแรก ไม่ระบุเวลาตอบรับ','คุ้มงบ ขอเพิ่มรอบตรวจ เวลาบริการ และยืนยันราคาใหม่'],
 ['SSD',null,null,'กล้อง/NVR หลักใกล้ Work / HDD 24TB / PoE 72 พอร์ต ไม่มีจอในรายการ','ประกันอุปกรณ์และงาน 1 ปี ตรวจทุก 3 เดือนปีแรก','ราคาสูงกว่า Work ต้องปรับราคาและชี้แจงประกัน/เวลาบริการ'],
 ['Automation R1',null,null,'HDD 24TB / Bullet 13 + Dome 35 / CAT6 / Extender 3 ชุด','ประกัน 12 เดือน มีงานเอกสารและอบรม ไม่ระบุรอบตรวจ','ขอแจกแจงต้นทุนงานที่เพิ่ม ราคาสูงแต่ยังไม่พิสูจน์ว่าภาพ/บริการดีกว่า']
];
summary.getRange('A10:F13').values=executive;body(summary,10,13,'F',66);
for(let r=10;r<=13;r++){fx(summary,`B${r}`,`='ข้อมูลใบเสนอราคา'!E${r-2}`);fx(summary,`C${r}`,`=B${r}-$B$11`);}
fx(summary,'C10',"='ข้อมูลใบเสนอราคา'!C20");fx(summary,'C12',"='ข้อมูลใบเสนอราคา'!C22");
summary.getRange('B10:B13').setNumberFormat(money);summary.getRange('C10:C13').setNumberFormat(delta);summary.getRange('B10:C13').format.horizontalAlignment='right';
band(summary,15,'กลุ่มจัดซื้อแยก ต้องเติมขอบเขตก่อนเทียบราคาพร้อมใช้','F');
head(summary,16,['ผู้เสนอ','ยอดสุทธิ (บาท)','ประเภทข้อเสนอ','สิ่งที่มีในใบ','สิ่งที่ยังขาด','ความเห็น']);
summary.getRange('A17:F18').values=[
 ['SEC',null,'อุปกรณ์เท่านั้น','4MP 48 ตัว / NVR 3 เครื่อง / HDD 24TB / สาย 1,220 ม.','PoE เพียง 16 พอร์ต ไม่รวมงานติดตั้งครบระบบ','เหมาะกับทีมที่จัดซื้อและคุมงานเอง ต้องเติม PoE และขอบเขตงาน'],
 ['OTT 48 จุด',null,'ค่าแรงเท่านั้น','ติดตั้งกล้อง/NVR เดินสัญญาณไปจอ และสาย DECO','ไม่รวมรายการอุปกรณ์หลัก ไม่ระบุประกันงานชัด','ต้องกำหนดผู้รับผิดชอบระบบและวัสดุให้ครบ ไม่รวมกับราคา OTT 32 จุด']
];
fx(summary,'B17',"='ข้อมูลใบเสนอราคา'!E12");fx(summary,'B18',"='ข้อมูลใบเสนอราคา'!E13");body(summary,17,18,'F',66);summary.getRange('B17:B18').setNumberFormat(money);
band(summary,20,'ส่วนต่างงบที่ใช้ประกอบการตัดสินใจ','F');
summary.getRange('A21:F22').values=[['JW+ สูงกว่า Work',null,'สัดส่วน',null,'SSD สูงกว่า JW+',null],['SSD สูงกว่า Work',null,'Automation สูงกว่า JW+',null,null,null]];
fx(summary,'B21',"='ข้อมูลใบเสนอราคา'!C20");fx(summary,'D21',"='ข้อมูลใบเสนอราคา'!C21");fx(summary,'F21',"='ข้อมูลใบเสนอราคา'!C23");
fx(summary,'B22',"='ข้อมูลใบเสนอราคา'!C22");fx(summary,'D22',"='ข้อมูลใบเสนอราคา'!C24");
summary.getRange('A21:F22').format.rowHeight=39;summary.getRange('A21:F22').format.wrapText=true;
for(const a of ['B21','F21','B22','D22'])summary.getRange(a).setNumberFormat(money);summary.getRange('D21').setNumberFormat('0.0%');
band(summary,24,'เรื่องที่ต้องปิดก่อนอนุมัติสั่งซื้อ','F');
const decisions=[
 ['01 รุ่นและตำแหน่ง','เลือกรุ่น/เลนส์ให้ตรงหน้าที่ โดยเฉพาะจุดเห็นหน้า ทะเบียน และกล้องภาพสีกลางคืน 6 จุด'],
 ['02 ระยะเก็บภาพ','24TB/30TB ไม่ได้แปลว่าเก็บได้ 30 วัน ต้องรับรองจำนวนวันที่คุณภาพภาพตามเกณฑ์ตรวจรับ'],
 ['03 งานครบระบบ','รวมการส่งภาพไปจอ งานระบบเดิม เส้นทางสาย UPS และทดสอบภาพครบทั้งกลางวัน/กลางคืน'],
 ['04 บริการและราคา','ระบุเวลาตอบรับ เวลาถึงหน้างาน เครื่องสำรอง ค่าเคลม/เดินทาง และค่าดูแลปีที่ 2–3']
];
for(let i=0;i<decisions.length;i++){cell(summary,`A${25+i}`,decisions[i][0]);cell(summary,`B${25+i}`,decisions[i][1]);summary.getRange(`A${25+i}:F${25+i}`).format.rowHeight=32;}
cell(summary,'A30','ข้อจำกัด');cell(summary,'B30','Work / SEC / Automation / OTT พ้นช่วงยืนราคาแล้ว ส่วน SSD ไม่ระบุอายุราคา ต้องยืนยันก่อนใช้ตัดสินใจ');
cell(summary,'B31','ไม่มีการให้คะแนนผู้ขาย เพราะยังไม่มีหลักฐานผลงานหน้างานและประวัติการให้บริการ เปรียบเทียบจากเอกสารที่ได้รับ');
summary.getRange('A30:F31').format.font.color='#725020';summary.getRange('A30:F31').format.rowHeight=27;
inputs.getRange('E20:I27').merge(true);inputs.getRange('E20:I27').format.wrapText=true;
cell(inputs,'D25','รวมสองใบ');cell(inputs,'D26','รวมสองใบ');
specs.getRange('D41').format={fill:'#FFFFFF',borders:{preset:'none'}};

// Test representative dependency changes, then restore the authoritative inputs.
const before=summary.getRange('C10').values[0][0];cell(inputs,'C8',257750);
const after=summary.getRange('C10').values[0][0];
if(Math.abs(after-before-100)>0.001)throw new Error('Price dependency test failed');
cell(inputs,'C8',257650);
const duration=specs.getRange('C42').values[0][0];cell(specs,'B42',4);
if(Math.abs(specs.getRange('C42').values[0][0]-duration/2)>0.0001)throw new Error('Storage dependency test failed');
cell(specs,'B42',2);
wb.recalculate();
const checks={jwPremium:summary.getRange('C10').values[0][0],ssdPremium:summary.getRange('C12').values[0][0],reconciliation:inputs.getRange('C27').values[0][0],days24:specs.getRange('C44').values[0][0],days30:specs.getRange('C45').values[0][0]};
if(Math.abs(checks.jwPremium-44315.5)>0.01||Math.abs(checks.ssdPremium-67973.31)>0.01||Math.abs(checks.reconciliation)>0.01)throw new Error(JSON.stringify(checks));
console.log(JSON.stringify(checks));
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},summary:'final errors'})).ndjson);
await fs.mkdir(out,{recursive:true});
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(`${out}/CCTV_เปรียบเทียบข้อเสนอสำหรับผู้บริหาร.xlsx`);
for(const [name,sheetName,range] of [
 ['summary','สรุปผู้บริหาร','A1:F32'],
 ['specs-top','อุปกรณ์และบริการ','A1:H16'],
 ['specs-service','อุปกรณ์และบริการ','A17:H27'],
 ['specs-assessment','อุปกรณ์และบริการ','A28:H47'],
 ['inputs','ข้อมูลใบเสนอราคา','A1:I17'],
 ['sources','ข้อมูลใบเสนอราคา','K7:L16'],
 ['calculations','ข้อมูลใบเสนอราคา','A18:I35']
]){
 const png=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(`${tmp}/${name}.png`,new Uint8Array(await png.arrayBuffer()));
}
console.log('Saved workbook and previews');
