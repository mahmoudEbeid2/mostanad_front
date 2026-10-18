// Human messages for Certificates V2 error codes (plan §13.4, §13.7): the UI
// always shows the backend message, mapped to a next step where we know one.
const MESSAGES = {
  NO_PDF_CONTENT: "This .ai file has no PDF content. In Illustrator choose File → Save As, tick “Create PDF Compatible File”, and upload it again.",
  NO_LIVE_TEXT: "The text in this design was converted to outlines, so nothing can be filled in. Export it again with live (editable) text.",
  UNSUPPORTED_FORMAT: "Upload an Illustrator .ai, a .pdf or an .html file.",
  FILE_TOO_LARGE: "The file is too large.",
  CONVERTER_UNREACHABLE: "The design converter is not running. Ask an administrator to start the pdf2htmlex service.",
};

/** err: { code?, message? } — or a stored "CODE: message" string. */
export function describeCertificateError(err) {
  if (!err) return "";
  if (typeof err === "string") {
    const code = err.split(":")[0];
    return MESSAGES[code] || err;
  }
  return MESSAGES[err.code] || err.message || "Something went wrong";
}
