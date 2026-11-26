import { LANG } from "../i18n/lang";

// Human messages for Certificates V2 error codes (plan §13.4, §13.7): the UI
// always shows the backend message, mapped to a next step where we know one.
// In Arabic (26 Nov) a raw backend sentence is never the whole message: a known code has its
// Arabic text, an unknown one a plain Arabic line with the original kept for support.
const MESSAGES_AR = {
  NO_PDF_CONTENT: "ملف الـ .ai ده مفيهوش محتوى PDF. في Illustrator اختار File ← Save As، علّم «Create PDF Compatible File»، وارفعه تاني.",
  NO_LIVE_TEXT: "النص في التصميم ده اتحوّل لأشكال، فمفيش حاجة تتملى. طلّعه تاني بنص عادي قابل للتعديل.",
  UNSUPPORTED_FORMAT: "ارفع ملف Illustrator .ai أو .pdf أو .html.",
  FILE_TOO_LARGE: "الملف كبير قوي.",
  CONVERTER_UNREACHABLE: "محوّل التصميمات مش شغّال. كلّم المسؤول يشغّل خدمة pdf2htmlex.",
  CONVERTER_OUTDATED: "محوّل التصميمات قديم على الجداول المتكررة. كلّم المسؤول يحدّث خدمة pdf2htmlex.",
  GROUPS_NEED_PDF: "الجداول المتكررة محتاجة تصميم .ai أو .pdf — ملف .html مفيهوش طبقة رسم منفصلة.",
  CERTIFICATE_FLAGGED: "فيه خانات ناقصة أو متعلّم عليها — كمّلها الأول.",
  FIELDS_UNCONFIRMED: "فيه حقول مقترحة لسه ما اتأكدتش — أكّدها قبل التشغيل.",
  VERSION_CONFLICT: "حد تاني غيّر ده في نفس الوقت — حمّل الصفحة تاني وجرّب.",
  NOTHING_TO_GENERATE: "مفيش قالب شغّال للمنتجات دي — اعمل نوع الشهادة وارفع قالبها الأول.",
  DATA_NEEDS_OPEN: "فيه قيم مطلوبة ناقصة أو مستنية تأكيد — كمّل مراجعة البيانات الأول.",
  TEMPLATE_SLOT_TAKEN: "فيه قالب تاني بيغطي نفس النوع والبراند والدولة والنطاق — افتحه أو أرشفه.",
  INVOICE_NOT_READY: "أكّد الفاتورة الأول.",
  CERTIFICATE_FINAL: "الشهادة دي معتمدة — اعمل منها نسخة جديدة عشان تعدّل.",
  CERTIFICATE_NOT_FINAL: "بس الشهادة المعتمدة اللي بيتعمل منها نسخة جديدة؛ المسودة بتتعدل على طول.",
  LINES_UNCLEAR: "اختار المنتج لكل سطر مش واضح الأول.",
  REVIEW_STATE: "الخطوة دي مش متاحة في حالة الشهادة دلوقتي.",
  COMMENT_REQUIRED: "قول أنهي خانة ومحتاجة تتصلح إزاي.",
  PDF_NOT_EXPORTED: "طلّع الـ PDF الأول.",
  VERSION_NOT_READY: "جهّز النسخة وعدّي الاختبار الأول.",
  VERSION_NOT_DRAFT: "النسخة دي مش مسودة — اعمل نسخة جديدة عشان تعدّل.",
  NO_FIELDS: "حدد حقل واحد على الأقل الأول.",
  UNKNOWN_AREA: "المكان ده مش من أماكن التصميم المتغيرة.",
  PRODUCTS_REQUIRED: "اختار منتج واحد على الأقل.",
  TYPES_REQUIRED: "اختار نوع شهادة واحد على الأقل.",
};
const MESSAGES = {
  NO_PDF_CONTENT: "This .ai file has no PDF content. In Illustrator choose File → Save As, tick “Create PDF Compatible File”, and upload it again.",
  NO_LIVE_TEXT: "The text in this design was converted to outlines, so nothing can be filled in. Export it again with live (editable) text.",
  UNSUPPORTED_FORMAT: "Upload an Illustrator .ai, a .pdf or an .html file.",
  FILE_TOO_LARGE: "The file is too large.",
  CONVERTER_UNREACHABLE: "The design converter is not running. Ask an administrator to start the pdf2htmlex service.",
  CONVERTER_OUTDATED: "The design converter is too old for repeating groups. Ask an administrator to rebuild the pdf2htmlex service.",
  GROUPS_NEED_PDF: "Repeating groups need an .ai or .pdf design — an .html upload has no separate drawing layer.",
};

/** err: { code?, message? } — or a stored "CODE: message" string. */
const arabic = (s) => /[؀-ۿ]/.test(String(s || ""));
const generic = (raw) => (raw ? `معرفناش نكمّل — جرّب تاني، ولو اتكررت ابعت ده للدعم: ${raw}` : "حصلت مشكلة — جرّب تاني");

export function describeCertificateError(err) {
  if (!err) return "";
  const raw = typeof err === "string" ? err : err?.response?.data?.message || err.message;
  const code = typeof err === "string" ? err.split(":")[0] : err?.response?.data?.code || err.code;
  if (LANG === "ar") return MESSAGES_AR[code] || (arabic(raw) ? raw : generic(raw));
  return MESSAGES[code] || raw || "Something went wrong";
}
