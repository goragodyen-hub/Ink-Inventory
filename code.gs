const SCRIPT_VERSION = "1.0";
// URL: The URL of the web app after deployment

const SHEET_NAME = "Sheet1"; // Change this if your sheet has a different name
// IMPORTANT: สร้าง Folder ใน Google Drive เพื่อเก็บรูป แล้วเอา ID มาใส่ตรงนี้ (เช่น "1A2B3C4D...")
const DRIVE_FOLDER_ID = "1zhUVsfCGW2y6WD0XAx1NeeGQtw3wfIo0";

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getData") {
    return ContentService.createTextOutput(JSON.stringify(getInventoryData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === "checkMachine") {
    const serial = e.parameter.serial;
    return ContentService.createTextOutput(JSON.stringify(checkMachineStatus(serial)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getSheets") {
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName());
    return ContentService.createTextOutput(JSON.stringify({ status: "success", sheets: sheets }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getArchiveData") {
    const sheetName = e.parameter.sheetName;
    return ContentService.createTextOutput(JSON.stringify(getInventoryData(sheetName)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", version: SCRIPT_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === "receive") {
      const result = receiveInk(data.model, data.serial, data.receiver, data.room);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "issue") {
      const result = issueInk(data.serial, data.model, data.room, data.signatureBase64);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Invalid action");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// Core Functions
// ==========================================

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name || SHEET_NAME);
}

function getInventoryData(customSheetName) {
  const sheet = getSheet(customSheetName);
  if (!sheet) return { status: "error", message: "Sheet not found" };
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return { status: "success", recentActivity: [], allRows: [] }; // Only headers
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    rows.push({
      model: data[i][0],
      serial: data[i][1],
      room: data[i][2],
      dateReceived: formatDate(data[i][3]),
      dateIssued: formatDate(data[i][4]),
      signer: data[i][5],
      receiver: data[i][6]
    });
  }
  
  // Return last 50 for activity feed, and summary stats
  return {
    status: "success",
    recentActivity: rows.slice(-50).reverse(),
    allRows: rows
  };
}

function checkMachineStatus(serial) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  let availableModels = [];
  let room = "";
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(serial).trim()) {
      room = data[i][2] || room; // Keep the last known room if empty
      const isIssued = data[i][4] !== "" && data[i][4] !== null;
      if (!isIssued) {
        availableModels.push(data[i][0]);
      }
    }
  }
  
  if (availableModels.length > 0) {
    // Unique models
    availableModels = [...new Set(availableModels)];
    return { status: "success", message: "พบหมึกในสต๊อก", models: availableModels, room: room };
  } else {
    return { status: "error", message: "ไม่พบหมึกในสต๊อกสำหรับเครื่องนี้" };
  }
}

function receiveInk(model, serial, receiver, room) {
  const sheet = getSheet();
  
  // Append new row: หมึกรุ่น, เลข serial, ห้อง, วันรับเข้า, วันส่งออก, ผู้เซ็นต์รับ, ผู้รับเข้า (Col G)
  const dateStr = getThaiDateTimeStr();
  
  sheet.appendRow([model, serial, room || "", dateStr, "", "", receiver]);
  
  return { status: "success", message: "รับเข้าสต๊อกเรียบร้อยแล้ว" };
}

function issueInk(serial, model, room, signatureBase64) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  let rowIndex = -1;
  
  // Find the OLDEST unissued ink of this model for this machine serial
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(serial).trim() && String(data[i][0]).trim() === String(model).trim()) {
      // Check if not issued
      if (data[i][4] === "" || data[i][4] === null) {
        rowIndex = i + 1; // 1-based index for sheet
        break; // Found the oldest one (starting from top)
      }
    }
  }
  
  if (rowIndex === -1) {
    return { status: "error", message: "ไม่พบหมึกรุ่นนี้ในสต๊อกสำหรับเครื่องนี้" };
  }
  
  // Process Signature Image
  let imageUrl = "";
  if (signatureBase64 && signatureBase64.includes(",")) {
    if (DRIVE_FOLDER_ID !== "") {
      try {
        const base64Data = signatureBase64.split(",")[1];
        const decoded = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decoded, "image/png", "Sign_" + serial + "_" + new Date().getTime() + ".png");
        const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        const file = folder.createFile(blob);
        // Make it accessible
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        // USE DIRECT IMAGE LINK FOR GOOGLE DRIVE
        imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      } catch (e) {
        imageUrl = "Error: " + e.message;
      }
    } else {
      imageUrl = signatureBase64; 
    }
  } else {
    imageUrl = "-";
  }
  
  // Update the row
  const dateTimeStr = getThaiDateTimeStr();
  
  sheet.getRange(rowIndex, 3).setValue(room);
  sheet.getRange(rowIndex, 5).setValue(dateTimeStr);
  sheet.getRange(rowIndex, 6).setValue(imageUrl); // column F (ผู้เซ็นต์รับ)
  
  return { status: "success", message: "บันทึกการเบิกเรียบร้อยแล้ว" };
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  try {
    // Check if it's already a formatted string containing Thai year
    if (typeof dateObj === 'string' && dateObj.includes('/')) return dateObj;
    return Utilities.formatDate(new Date(dateObj), "GMT+7", "dd/MM/yyyy HH:mm:ss");
  } catch(e) {
    return String(dateObj);
  }
}

// Helper: Format current date to Thai Buddhist Era (พ.ศ.) with Time
function getThaiDateTimeStr() {
  const date = new Date();
  
  // Create formatter with GMT+7
  const day = Utilities.formatDate(date, "GMT+7", "dd");
  const month = Utilities.formatDate(date, "GMT+7", "MM");
  const ceYear = parseInt(Utilities.formatDate(date, "GMT+7", "yyyy"), 10);
  const timeStr = Utilities.formatDate(date, "GMT+7", "HH:mm:ss");
  
  const thaiYear = ceYear + 543;
  
  return `${day}/${month}/${thaiYear} ${timeStr}`;
}

// SETUP FUNCTION: Run this once to setup CORS properly if needed
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
