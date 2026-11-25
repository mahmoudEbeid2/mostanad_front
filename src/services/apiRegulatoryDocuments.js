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

// "No rules for <country>" on a label review: where the country's rules stand, add them
// (upload for review, resume a stuck document, copy another country's), approve, check again.
/** → { country, rulesInForce, documents: [{ id, title, status, rules, stuck, awaitingApproval, copied }], copyFrom: [{ country, rules }] } */
export const getCountryRules = (country) =>
  unwrap(apiClient.get("/regulatory-documents/coverage", { params: { country } }), "Couldn't load the country's rules").then((d) => d.data);
/** The regulation PDF for that country, stopped before activation: a person approves it. → { taskId } */
export const uploadRulesForReview = ({ file, country, title, authority }) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("country", country);
  fd.append("review", "true");
  if (title) fd.append("title", title);
  if (authority) fd.append("authority", authority);
  return uploadDocument(fd);
};
export const resumeRules = (id) => unwrap(apiClient.post(`/regulatory-documents/${id}/resume`), "Couldn't resume reading the rules").then((d) => d.data);
export const copyRules = (fromCountry, toCountry) => unwrap(apiClient.post("/regulatory-documents/copy", { fromCountry, toCountry }), "Couldn't copy the rules").then((d) => d.data);
/** Resolves when the background task is done; rejects with its real error. */
export async function waitForRulesTask(taskId, { timeoutMs = 600_000, onProgress } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { data } = await apiClient.get(`/background-tasks/${taskId}`);
    const t = data?.data;
    onProgress?.(t);
    if (t?.status === "completed") return t;
    if (t?.status === "failed") throw new Error(t.error || "Reading the rules failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Reading the rules is taking long — it continues in the background; check the Regulatory page later");
}
