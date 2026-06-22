const SPREADSHEET_ID = "1eJXQSa2VjP2nFW2z8tLS6FkLZ05xTJOVwrYHQ_goN98";
const SHEET_NAME = "";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : spreadsheet.getSheets()[0];
    if (!sheet) throw new Error("Sheet not found");

    const data = (e && e.parameter) || {};
    const userIp = data.userIp || "not captured";
    sheet.appendRow([
      new Date(),
      data.form || "",
      data.parent || data.name || "",
      data.phone || "",
      data.email || "",
      data.studentClass || "",
      data.board || "",
      data.subject || "",
      data.notes || data.message || "",
      userIp
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function testWrite() {
  return doPost({
    parameter: {
      form: "Trial Request",
      parent: "Apps Script Test",
      phone: "0000000000",
      email: "test@example.com",
      studentClass: "Class 8",
      board: "CBSE",
      subject: "Mathematics",
      notes: "If this row appears, the script can write to the sheet."
    }
  });
}
