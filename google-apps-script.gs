const SPREADSHEET_ID = "1eJXQSa2VjP2nFW2z8tLS6FkLZ05xTJOVwrYHQ_goN98";
const SHEET_NAME = "";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : spreadsheet.getSheets()[0];
    if (!sheet) throw new Error("Sheet not found");

    const data = e.parameter || {};
    sheet.appendRow([
      new Date(),
      data.form || "",
      data.parent || data.name || "",
      data.phone || "",
      data.email || "",
      data.subject || "",
      data.notes || data.message || ""
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
