import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";

// Certificates V2 — templates, versions, fields, prepare, preview, field sources
// (backend CERTIFICATES_V2_PLAN.md §8, §12). The frontend never measures or saves
// geometry (plan D11): every layout number shown here comes from the server.

export const listTemplates = (scope = {}, filters = {}) =>
  unwrap(apiClient.get("/certificate-templates", { params: { ...scope, ...filters } }), "Failed to load templates").then((d) => ({
    templates: d.data.templates,
    total: d.total,
  }));

export const getTemplate = (scope = {}, id) =>
  unwrap(apiClient.get(`/certificate-templates/${id}`, { params: scope }), "Failed to load the template").then((d) => d.data.template);

/** multipart: file + name, certificateTypeId, brandId?, country?, scope → { templateId, versionId, taskId } */
export const uploadTemplate = (scope = {}, { file, name, certificateTypeId, brandId, country, scope: templateScope }) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("name", name);
  fd.append("certificateTypeId", certificateTypeId);
  if (brandId) fd.append("brandId", brandId);
  if (country) fd.append("country", country);
  fd.append("scope", templateScope || "per_product");
  return unwrap(apiClient.post("/certificate-templates", fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }), "Upload failed").then(
    (d) => d.data
  );
};

export const uploadTemplateVersion = (scope = {}, templateId, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return unwrap(
    apiClient.post(`/certificate-templates/${templateId}/versions`, fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }),
    "Upload failed"
  ).then((d) => d.data);
};

export const updateTemplateSettings = (scope = {}, id, body) =>
  unwrap(apiClient.patch(`/certificate-templates/${id}`, body, { params: scope }), "Failed to save the settings").then((d) => d.data.template);

export const archiveTemplate = (scope = {}, id) =>
  unwrap(apiClient.post(`/certificate-templates/${id}/archive`, {}, { params: scope }), "Failed to archive the template").then((d) => d.data.template);

export const getVersion = (scope = {}, versionId) =>
  unwrap(apiClient.get(`/template-versions/${versionId}`, { params: scope }), "Failed to load the template version").then((d) => d.data.version);

/** Raw HTML of a version (sanitized | prepared | sample) — only ever shown inside DocumentFrame. */
export const getVersionHtml = (scope = {}, versionId, variant = "sanitized") =>
  unwrap(apiClient.get(`/template-versions/${versionId}/html`, { params: { ...scope, variant }, responseType: "text", transformResponse: (x) => x }), "Failed to load the document");

export const getVersionThumbnail = (scope = {}, versionId) =>
  apiClient.get(`/template-versions/${versionId}/thumbnail`, { params: scope, responseType: "blob" }).then((r) => r.data);

// ── Phase 2: fields, prepare, preview, activate ─────────────────────────────
export const getFieldSources = (scope = {}) =>
  unwrap(apiClient.get("/certificate-field-sources", { params: scope }), "Failed to load the field sources").then((d) => d.data);

/** Re-reads the company's products into its data dictionary (AI plan §3.2) → { dictionary } */
export const rebuildDataDictionary = (scope = {}) =>
  unwrap(apiClient.post("/certificate-data-dictionary/rebuild", {}, { params: scope }), "Failed to refresh the product data").then((d) => d.data);

/**
 * Replaces the full field list (draft only); `groups` (repeating groups, plan
 * §7.8) replaces the group list when given, omitted keeps the stored one.
 * → { fields, groups, groupDetection: { key: { ok, shape, band, footerY, footerProposal, capacity… } | { ok: false, error, message } }, suggestions, fieldsHash, boxes }
 */
export const saveFields = (scope = {}, versionId, fields, groups) =>
  unwrap(apiClient.put(`/template-versions/${versionId}/fields`, groups === undefined ? { fields } : { fields, groups }, { params: scope }), "Failed to save the fields").then((d) => d.data);

/** Repeating groups need a vector background: a NEW draft version of the same design, fields copied → { templateId, versionId, versionNumber, taskId } */
export const enableGroups = (scope = {}, versionId) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/enable-groups`, {}, { params: scope }), "Couldn't create the version for repeating groups").then((d) => d.data);

export const confirmFields = (scope = {}, versionId, keys) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/fields/confirm`, { keys }, { params: scope }), "Failed to confirm the fields").then((d) => d.data.fields);

export const suggestFields = (scope = {}, versionId) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/suggest`, {}, { params: scope }), "Couldn't get suggestions").then((d) => d.data);

/** → { versionId, taskId } */
export const prepareVersion = (scope = {}, versionId) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/prepare`, {}, { params: scope }), "Failed to start prepare").then((d) => d.data);

export const getPrepareDiff = (scope = {}, versionId, page = 1) =>
  apiClient.get(`/template-versions/${versionId}/prepare-diff`, { params: { ...scope, page }, responseType: "blob" }).then((r) => r.data);

/** body: { values?, productId?, invoiceItemId? } → { html, values, flags } — rendered on the server, never stored */
export const previewVersion = (scope = {}, versionId, body) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/preview`, body, { params: scope }), "Preview failed").then((d) => d.data);

export const activateVersion = (scope = {}, versionId) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/activate`, {}, { params: scope }), "Activation failed").then((d) => d.data);

/** Clone as a new draft (same design, same fields) → { templateId, versionId, versionNumber } */
export const newVersionFrom = (scope = {}, versionId) =>
  unwrap(apiClient.post(`/template-versions/${versionId}/new-version`, {}, { params: scope }), "Failed to create a new version").then((d) => d.data);

/** Tenant-forced product search for certificate screens → [{ id, name, productCode, packaging, brand }] */
export const searchCertificateProducts = (scope = {}, q = "", limit = 20) =>
  unwrap(apiClient.get("/certificate-products", { params: { ...scope, q, limit } }), "Failed to search products").then((d) => d.data.products);
