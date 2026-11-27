import { LANG, t } from "../i18n";

// Human messages for Certificates V2 error codes (plan §13.4, §13.7): the UI
// always shows the backend message, mapped to a next step where we know one.
// A known code has its text in the UI language. In Arabic (26 Nov) a raw backend sentence is never the
// whole message: an unknown code gets a plain Arabic line with the original kept for support.
const MESSAGES = {
  NO_PDF_CONTENT: t("certificateErrors.thisAiFileHasNo"),
  NO_LIVE_TEXT: t("certificateErrors.theTextInThisDesign"),
  UNSUPPORTED_FORMAT: t("certificateErrors.uploadAnIllustratorAiA"),
  FILE_TOO_LARGE: t("certificateErrors.theFileIsTooBig"),
  CONVERTER_UNREACHABLE: t("certificateErrors.theDesignConverterIsntRunning"),
  CONVERTER_OUTDATED: t("certificateErrors.theDesignConverterIsToo"),
  GROUPS_NEED_PDF: t("certificateErrors.repeatingTablesNeedAnAi"),
  CERTIFICATE_FLAGGED: t("certificateErrors.somePlacesAreMissingOr"),
  FIELDS_UNCONFIRMED: t("certificateErrors.someSuggestedFieldsArentConfirmed"),
  VERSION_CONFLICT: t("certificateErrors.someoneElseChangedThisAt"),
  NOTHING_TO_GENERATE: t("certificateErrors.noActiveTemplateForThese"),
  DATA_NEEDS_OPEN: t("certificateErrors.someRequiredValuesAreMissing"),
  TEMPLATE_SLOT_TAKEN: t("certificateErrors.anotherTemplateCoversTheSame"),
  INVOICE_NOT_READY: t("certificateErrors.confirmTheInvoiceFirst"),
  CERTIFICATE_FINAL: t("certificateErrors.thisCertificateIsApprovedMake"),
  CERTIFICATE_NOT_FINAL: t("certificateErrors.onlyAnApprovedCertificateGets"),
  LINES_UNCLEAR: t("certificateErrors.pickTheProductForEvery"),
  REVIEW_STATE: t("certificateErrors.thisStepIsntAvailableIn"),
  COMMENT_REQUIRED: t("certificateErrors.sayWhichFieldAndHow"),
  PDF_NOT_EXPORTED: t("certificateErrors.exportThePdfFirst"),
  VERSION_NOT_READY: t("certificateErrors.prepareTheVersionAndPass"),
  VERSION_NOT_DRAFT: t("certificateErrors.thisVersionIsntADraft"),
  NO_FIELDS: t("certificateErrors.markAtLeastOneField"),
  UNKNOWN_AREA: t("certificateErrors.thisPlaceIsntOneOf"),
  PRODUCTS_REQUIRED: t("certificateErrors.pickAtLeastOneProduct"),
  TYPES_REQUIRED: t("certificateErrors.pickAtLeastOneCertificate"),
};

/** err: { code?, message? } — or a stored "CODE: message" string. */
const arabic = (s) => /[؀-ۿ]/.test(String(s || ""));
const generic = (raw) => (raw ? t("certificateErrors.weCouldntContinueTryAgain", { raw }) : t("certificateErrors.somethingWentWrongTryAgain"));

export function describeCertificateError(err) {
  if (!err) return "";
  const raw = typeof err === "string" ? err : err?.response?.data?.message || err.message;
  const code = typeof err === "string" ? err.split(":")[0] : err?.response?.data?.code || err.code;
  if (MESSAGES[code]) return MESSAGES[code];
  if (LANG === "ar") return arabic(raw) ? raw : generic(raw);
  return raw || generic();
}
