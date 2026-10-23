import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";

// Certificates V2 — invoices: upload, extraction review, product matching,
// confirm (backend CERTIFICATES_V2_PLAN.md §9, §12). Every call takes `scope`
// = { companyId } for system users ({} for a company session).

/** multipart: invoice + brandId?, country? → { invoiceId, taskId } */
export const uploadInvoice = (scope = {}, { file, brandId, country }) => {
  const fd = new FormData();
  fd.append("invoice", file);
  if (brandId) fd.append("brandId", brandId);
  if (country) fd.append("country", country);
  return unwrap(apiClient.post("/invoices", fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }), "Upload failed").then((d) => d.data);
};

export const listInvoices = (scope = {}, filters = {}) =>
  unwrap(apiClient.get("/invoices", { params: { ...scope, ...filters } }), "Failed to load invoices").then((d) => ({ invoices: d.data.invoices, total: d.total }));

/** → invoice with items (+ product, candidates), counts by match status, source file info */
export const getInvoice = (scope = {}, id) => unwrap(apiClient.get(`/invoices/${id}`, { params: scope }), "Failed to load the invoice").then((d) => d.data.invoice);

/** The original uploaded file as a Blob (shown side by side with the extraction). */
export const getInvoiceSource = (scope = {}, id) => apiClient.get(`/invoices/${id}/source`, { params: scope, responseType: "blob" }).then((r) => r.data);

/** body: { header?: { key: value }, brandId?, country? } */
export const updateInvoice = (scope = {}, id, body) =>
  unwrap(apiClient.patch(`/invoices/${id}`, body, { params: scope }), "Failed to save the invoice").then((d) => d.data.invoice);

export const addInvoiceItem = (scope = {}, id, body = {}) =>
  unwrap(apiClient.post(`/invoices/${id}/items`, body, { params: scope }), "Failed to add the line").then((d) => d.data.item);

/** body: { data?: { key: value }, productId?: id | null, ignored?: boolean } */
export const updateInvoiceItem = (scope = {}, id, itemId, body) =>
  unwrap(apiClient.patch(`/invoices/${id}/items/${itemId}`, body, { params: scope }), "Failed to save the line").then((d) => d.data.item);

export const deleteInvoiceItem = (scope = {}, id, itemId) =>
  unwrap(apiClient.delete(`/invoices/${id}/items/${itemId}`, { params: scope }), "Failed to delete the line");

/** → { matched, needsMatch } — lines matched or ignored by hand are kept */
export const rematchInvoice = (scope = {}, id) => unwrap(apiClient.post(`/invoices/${id}/rematch`, {}, { params: scope }), "Matching failed").then((d) => d.data);

export const confirmInvoice = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/confirm`, {}, { params: scope }), "Couldn't confirm the invoice").then((d) => d.data.invoice);

/** Re-runs extraction of a failed invoice (same model, same prompt) → { invoiceId, taskId } */
export const retryInvoice = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/retry`, {}, { params: scope }), "Couldn't start reading the invoice again").then((d) => d.data);

// ── certificate data check (backend plan.md §6, A2) ──────────────────────────
/** The check as last computed → { summary, certificates[], batchData[], unassigned[], computedAt } */
export const getDataCheck = (scope = {}, id) => unwrap(apiClient.get(`/invoices/${id}/data-needs`, { params: scope }), "Couldn't load the data check").then((d) => d.data.check);

/** Recomputes the check; the AI looks for new gaps once (ai: false = code only) → check + { ai } */
export const runDataCheck = (scope = {}, id, { ai = true } = {}) =>
  unwrap(apiClient.post(`/invoices/${id}/data-needs`, ai ? {} : { ai: false }, { params: scope }), "The data check failed").then((d) => d.data.check);

/** decisions: [{ needId, action: accept|edit|reject|reset, value?, applyTo?: "line" }] → check */
export const decideDataNeeds = (scope = {}, id, decisions) =>
  unwrap(apiClient.patch(`/invoices/${id}/data-needs`, { decisions }, { params: scope }), "Couldn't save").then((d) => d.data.check);

/** A5: one web lookup per product for the missing product facts (only on request) → check + { ai: { web } } */
export const webLookup = (scope = {}, id) =>
  unwrap(apiClient.post(`/invoices/${id}/data-needs/web-lookup`, {}, { params: scope }), "The web lookup failed").then((d) => d.data.check);

/** "Add as synonym for all products": the alternative path holds the same value as the canonical one. */
export const addDictionarySynonym = (scope = {}, { canonical, alternative }) =>
  unwrap(apiClient.post("/certificate-data-dictionary/synonyms", { canonical, alternative }, { params: scope }), "Couldn't add the synonym").then((d) => d.data.dictionary);
