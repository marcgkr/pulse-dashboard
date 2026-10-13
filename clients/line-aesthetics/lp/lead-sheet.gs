/* Line Aesthetics lead backup: every form submit lands in a Google Sheet,
   even if the patient never presses send in WhatsApp.
   Setup: new Google Sheet > Extensions > Apps Script > paste this > Deploy > New deployment >
   Web app, execute as Me, access Anyone > copy the /exec URL into `webhook: ""` in each page. */
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Time", "Treatment", "Name", "Mobile", "Answers", "Ad (utm_content)", "Campaign", "Page", "Status"]);
  }
  var answers = Object.keys(d.answers || {}).map(function (k) { return k + ": " + d.answers[k]; }).join(" | ");
  var utm = d.utm || {};
  sheet.appendRow([d.ts, d.treatment, d.name, "'" + d.phone, answers, utm.utm_content || "", utm.utm_campaign || "", d.page, "New"]);
  return ContentService.createTextOutput("ok");
}
