import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";
import { t } from "../i18n";

// Certificates V2 — invoices: upload, extraction review, product matching,
// confirm (backend CERTIFICATES_V2_PLAN.md §9, §12). Every call takes `scope`
// = { companyId } for system users ({} for a company session).

/** multipart: invoice + brandId?, country? → { invoiceId, taskId } */
/** → { invoiceId, taskId } — extract=false (AI unavailable): taskId null, opened for manual entry */
// certificateTypeIds: undefined = no choice (the company's default), null = every type, an array = only those
export const uploadInvoice = (scope = {}, { file, brandId, country, extract, certificateTypeIds, saveAsDefault }) => {
  const fd = new FormData();
  fd.append("invoice", file);
  if (extract === false) fd.append("extract", "false");
  if (brandId) fd.append("brandId", brandId);
  if (country) fd.append("country", country);
  if (certificateTypeIds !== undefined) fd.append("certificateTypeIds", JSON.stringify(certificateTypeIds));
  if (saveAsDefault) fd.append("saveAsDefault", "true");
  return unwrap(apiClient.post("/invoices", fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }), t("errors.uploadFailed")).then((d) => d.data);
};

export const listInvoices = (scope = {}, filters = {}) =>
  unwrap(apiClient.get("/invoices", { params: { ...scope, ...filters } }), t("errors.failedToLoadInvoices")).then((d) => ({ invoices: d.data.invoices, total: d.total }));

/** → invoice with items (+ product, candidates), counts by match status, source file info */
export const getInvoice = (scope = {}, id) => unwrap(apiClient.get(`/invoices/${id}`, { params: scope }), t("errors.failedToLoadTheInvoice")).then((d) => d.data.invoice);

/** The original uploaded file as a Blob (shown side by side with the extraction). */
export const getInvoiceSource = (scope = {}, id) => apiClient.get(`/invoices/${id}/source`, { params: scope, responseType: "blob" }).then((r) => r.data);

/** body: { header?: { key: value }, brandId?, country? } */
export const updateInvoice = (scope = {}, id, body) =>
  unwrap(apiClient.patch(`/invoices/${id}`, body, { params: scope }), t("errors.failedToSaveTheInvoice")).then((d) => d.data.invoice);

export const addInvoiceItem = (scope = {}, id, body = {}) =>
  unwrap(apiClient.post(`/invoices/${id}/items`, body, { params: scope }), t("errors.failedToAddTheLine")).then((d) => d.data.item);

/** body: { data?: { key: value }, productId?: id | null, ignored?: boolean } */
export const updateInvoiceItem = (scope = {}, id, itemId, body) =>
  unwrap(apiClient.patch(`/invoices/${id}/items/${itemId}`, body, { params: scope }), t("errors.failedToSaveTheLine")).then((d) => d.data.item);

export const deleteInvoiceItem = (scope = {}, id, itemId) =>
  unwrap(apiClient.delete(`/invoices/${id}/items/${itemId}`, { params: scope }), t("errors.failedToDeleteTheLine"));

/** → { matched, needsMatch } — lines matched or ignored by hand are kept */
export const rematchInvoice = (scope = {}, id) => unwrap(apiClient.post(`/invoices/${id}/rematch`, {}, { params: scope }), t("errors.matchingFailed")).then((d) => d.data);

export const confirmInvoice = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/confirm`, {}, { params: scope }), t("errors.couldntConfirmTheInvoice")).then((d) => d.data.invoice);

/** What the "+ New product" modal needs for this line → { prefill, neededFields, notAsked, noCertificate, similar, fullFields, … } */
export const getNewProductDraft = (scope = {}, id, itemId) =>
  unwrap(apiClient.get(`/invoices/${id}/items/${itemId}/new-product-draft`, { params: scope }), t("errors.couldntPrepareTheNewProduct")).then((d) => d.data.draft);

/** AI suggestions for the empty fields shown; nothing is saved → { suggestions, unavailable?, reason? } */
export const suggestNewProduct = (scope = {}, id, itemId, { mode, values }) =>
  unwrap(apiClient.post(`/invoices/${id}/items/${itemId}/new-product-suggest`, { mode, values }, { params: scope }), "AI couldn't suggest values").then((d) => d.data);

/** → { item, product, matching } */
export const createProductFromLine = (scope = {}, id, itemId, body) =>
  unwrap(apiClient.post(`/invoices/${id}/items/${itemId}/create-product`, body, { params: scope }), t("errors.couldntCreateTheProduct")).then((d) => d.data);

/** Re-runs extraction of a failed invoice (same model, same prompt) → { invoiceId, taskId } */
export const retryInvoice = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/retry`, {}, { params: scope }), t("errors.couldntStartReadingTheInvoice")).then((d) => d.data);

/** P8 — a failed invoice is entered by hand instead: → the invoice, under review with no lines */
export const enterInvoiceByHand = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/manual`, {}, { params: scope }), t("errors.couldntSwitchTheInvoiceTo")).then((d) => d.data.invoice);

// ── certificate data check (backend plan.md §6, A2) ──────────────────────────
/** The check as last computed → { summary, certificates[], batchData[], unassigned[], computedAt } */
export const getDataCheck = (scope = {}, id) => unwrap(apiClient.get(`/invoices/${id}/data-needs`, { params: scope }), t("errors.couldntLoadTheDataCheck")).then((d) => d.data.check);

/** Recomputes the check; the AI looks for new gaps once (ai: false = code only) → check + { ai } */
export const runDataCheck = (scope = {}, id, { ai = true } = {}) =>
  unwrap(apiClient.post(`/invoices/${id}/data-needs`, ai ? {} : { ai: false }, { params: scope }), t("errors.theDataCheckFailed")).then((d) => d.data.check);

/** decisions: [{ needId, action: accept|edit|reject|reset, value?, applyTo?: "line" }] → check */
export const decideDataNeeds = (scope = {}, id, decisions) =>
  unwrap(apiClient.patch(`/invoices/${id}/data-needs`, { decisions }, { params: scope }), "Couldn't save").then((d) => d.data.check);

/** A5: one web lookup per product for the missing product facts (only on request) → check + { ai: { web } } */
export const webLookup = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/data-needs/web-lookup`, {}, { params: scope }), t("errors.theWebLookupFailed")).then((d) => d.data.check);

/** "Add as synonym for all products": the alternative path holds the same value as the canonical one. */
export const addDictionarySynonym = (scope = {}, { canonical, alternative }) =>
  unwrap(apiClient.post("/certificate-data-dictionary/synonyms", { canonical, alternative }, { params: scope }), t("errors.couldntAddTheSynonym")).then((d) => d.data.dictionary);

// ── lab results (backend item 4): the results grid and supplier COAs ─────────
/** → { columns[], rows[{ rowKey, lines, batchNo, noBatch, warning?, cells }], summary, supplierCoas[] } */
export const getLabResults = (scope = {}, id) => unwrap(apiClient.get(`/invoices/${id}/lab-results`, { params: scope }), t("errors.couldntLoadTheResultsGrid")).then((d) => d.data.grid);

/** rows: [{ rowKey, batchNo?, values?: { [labelKey]: string | null } }] → the grid (every line of those batches filled) */
export const saveLabResults = (scope = {}, id, rows) =>
  unwrap(apiClient.put(`/invoices/${id}/lab-results`, { rows }, { params: scope }), t("errors.couldntSaveTheResults")).then((d) => d.data.grid);

/** Several supplier COA / lab report files (PDF or images), read in the background → { taskId, coas } */
export const uploadSupplierCoas = (scope = {}, id, files) => {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  return unwrap(apiClient.post(`/invoices/${id}/supplier-coas`, fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }), t("errors.couldntUploadTheFiles")).then((d) => d.data);
};

/** backend item 5: matching → product data → batch results → supplier COAs, one job → { taskId, stages } */
export const prepareCertificates = (scope = {}, id) => unwrap(apiClient.post(`/invoices/${id}/prepare`, {}, { params: scope }), t("errors.couldntStartPreparingTheCertificates")).then((d) => d.data);

export const deleteSupplierCoa = (scope = {}, id, coaId) => unwrap(apiClient.delete(`/invoices/${id}/supplier-coas/${coaId}`, { params: scope }), t("errors.couldntDeleteTheFile"));
