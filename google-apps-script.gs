const SPREADSHEET_ID = "1eJXQSa2VjP2nFW2z8tLS6FkLZ05xTJOVwrYHQ_goN98";
const SHEET_NAME = "";
const RECAPTCHA_SECRET = "YOUR_RECAPTCHA_V3_SECRET_KEY_HERE";

function verifyRecaptcha(token) {
  if (!token) return { success: false, score: "no token" };
  try {
    const response = UrlFetchApp.fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "post",
      payload: { secret: RECAPTCHA_SECRET, response: token }
    });
    return JSON.parse(response.getContentText());
  } catch (err) {
    return { success: false, score: "verify failed" };
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : spreadsheet.getSheets()[0];
    if (!sheet) throw new Error("Sheet not found");

    const data = (e && e.parameter) || {};
    const userIp = data.userIp || "not captured";
    const recaptchaResult = verifyRecaptcha(data.recaptchaToken || "");
    const recaptchaScore = recaptchaResult.score !== undefined ? recaptchaResult.score : "n/a";

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
      userIp,
      recaptchaScore
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
