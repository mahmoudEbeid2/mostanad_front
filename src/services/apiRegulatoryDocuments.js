import apiClient from "./apiClient";

// The new §7.4 ingestion surface (regulatory_documents + regulatory_rules), distinct
// from the legacy apiEdaRequirements.js shim. Upload → compile-rules → audit-coverage
// → human review/approve → active ruleset. See MOSTANAD_ARCHITECTURE.md §5.6/§5.7/§7.4.

const unwrap = (promise, fallbackMessage) =>
  promise.then((r) => r.data).catch((error) => {
    throw new Error(error.response?.data?.message || fallbackMessage);
  });

export const getDocuments = (params = {}) =>
  unwrap(apiClient.get("/regulatory-documents", { params }), "Failed to fetch regulatory documents").then((d) => ({
    documents: d.data.documents,
    total: d.total,
  }));

export const getDocument = (id) =>
  unwrap(apiClient.get(`/regulatory-documents/${id}`), "Failed to fetch regulatory document").then((d) => d.data.document);

export const uploadDocument = (formData) =>
  unwrap(
    apiClient.post("/regulatory-documents", formData, { headers: { "Content-Type": "multipart/form-data" } }),
    "Failed to upload regulatory document"
  ).then((d) => d.data);

export const compileRules = (id) =>
  unwrap(apiClient.post(`/regulatory-documents/${id}/compile-rules`), "Failed to compile rules").then((d) => d.data);

export const auditCoverage = (id) =>
  unwrap(apiClient.post(`/regulatory-documents/${id}/audit-coverage`), "Failed to audit coverage").then((d) => d.data.document);

export const approveDocument = (id) =>
  unwrap(apiClient.post(`/regulatory-documents/${id}/approve`), "Failed to approve document").then((d) => d.data.document);

export const clearClause = (id, reference) =>
  unwrap(apiClient.patch(`/regulatory-documents/${id}/clauses/clear`, { reference }), "Failed to clear clause").then((d) => d.data.document);
