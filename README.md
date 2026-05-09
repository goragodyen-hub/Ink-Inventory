# รับ-เบิก หมึก งานศูนย์คอมฯ (Ink Inventory Management)

ระบบจัดการสต๊อกหมึกพิมพ์แบบ Modern Web App ที่เชื่อมต่อกับ Google Sheets เป็นฐานข้อมูล รองรับการใช้งานทั้งบนคอมพิวเตอร์และมือถือ

## ฟีเจอร์หลัก
- 📦 **ระบบรับเข้าสต๊อก:** บันทึกรุ่นหมึก, Serial Number และผู้รับเข้า (รองรับปี พ.ศ. และเวลา)
- 📤 **ระบบเบิกออก:** ค้นหาหมึกตาม Serial เครื่องพิมพ์, ระบุห้องที่นำไปใช้ และเซ็นชื่อรับของแบบดิจิทัล
- 📊 **Dashboard:** สรุปยอดคงเหลือรวม และดูรายละเอียดแยกตามห้อง/รุ่นหมึกได้ทันที
- 🚀 **Direct Issue:** ปุ่มเบิกด่วนจากหน้า Dashboard ช่วยข้ามขั้นตอนการกรอกข้อมูล
- 📱 **Mobile Friendly:** รองรับการทำ Home Screen Icon และใช้งานบนมือถือได้อย่างลื่นไหล
- ☁️ **Google Sheets Backend:** ข้อมูลทั้งหมดถูกเก็บไว้ใน Google Sheets และรูปลายเซ็นถูกเก็บไว้ใน Google Drive

## วิธีการติดตั้ง (Deployment)
1.  **Backend:** นำโค้ดใน `code.gs` ไปวางใน Google Apps Script และ Deploy เป็น Web App
2.  **Frontend:** แก้ไขตัวแปร `SCRIPT_URL` ใน `app.js` ให้เป็น URL ของ Web App ที่ได้จากข้อ 1
3.  **Hosting:** อัปโหลดไฟล์ `index.html`, `style.css`, `app.js` และ `icon.png` ขึ้น GitHub Pages หรือ Web Hosting อื่นๆ

## เทคโนโลยีที่ใช้
- HTML5 / CSS3 (Vanilla JS)
- Google Apps Script (GAS)
- Google Sheets API
- Phosphor Icons
- Google Fonts (Prompt / Outfit)

---
*พัฒนาโดย Antigravity AI (Google Deepmind)*
