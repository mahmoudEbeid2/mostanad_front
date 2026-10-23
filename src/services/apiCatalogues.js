import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";

// Product catalogues as source documents (backend plan.md §15, A6). Every call
// takes `scope` = { companyId } for system users ({} for a company session).
// Upload, new versions and linking need manage_catalogues (system users only).

/** multipart: file + companyId, manufacturer?, brandId?, label? → { catalogueId, versionId, jobId } */
export const uploadCatalogue = ({ companyId, file, manufacturer, brandId, label }) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("companyId", companyId);
  if (manufacturer) fd.append("manufacturer", manufacturer);
  if (brandId) fd.append("brandId", brandId);
  if (label) fd.append("label", label);
  return unwrap(apiClient.post("/catalogues", fd, { headers: { "Content-Type": "multipart/form-data" } }), "Upload failed").then((d) => d.data);
};

/** a newer file of an existing catalogue → { catalogueId, versionId, jobId } */
export const uploadCatalogueVersion = (scope = {}, catalogueId, { file, label }) => {
  const fd = new FormData();
  fd.append("file", file);
  if (label) fd.append("label", label);
  return unwrap(apiClient.post(`/catalogues/${catalogueId}/versions`, fd, { params: scope, headers: { "Content-Type": "multipart/form-data" } }), "Upload failed").then((d) => d.data);
};

export const listCatalogues = (scope = {}) => unwrap(apiClient.get("/catalogues", { params: scope }), "Failed to load catalogues").then((d) => d.data.catalogues);

/** → version + blocks [{ id, seq, kind, page, bbox, title, text, status, productId, extracted }] */
export const getCatalogueVersion = (scope = {}, id) => unwrap(apiClient.get(`/catalogue-versions/${id}`, { params: scope }), "Failed to load the catalogue").then((d) => d.data.version);

/** The kept PDF as an ArrayBuffer (rendered page by page in the review screen). */
export const getCatalogueFile = (scope = {}, id) => apiClient.get(`/catalogue-versions/${id}/file`, { params: scope, responseType: "arraybuffer" }).then((r) => r.data);

/** → block with text and line geometry */
export const getCatalogueBlock = (scope = {}, id) => unwrap(apiClient.get(`/catalogue-blocks/${id}`, { params: scope }), "Failed to load the block").then((d) => d.data.block);

export const linkCatalogueBlock = (scope = {}, blockId, productId) =>
  unwrap(apiClient.post(`/catalogue-blocks/${blockId}/link`, { productId }, { params: scope }), "Failed to link the product").then((d) => d.data);

// ── A6.4 review (plan §15.3 steps 6–7) ──
/** → { version, counts, categories, blocks: [{ …, lines, extracted, highlights, categoryId, match, bulkAcceptable }] } */
export const getCatalogueReview = (scope = {}, versionId) => unwrap(apiClient.get(`/catalogue-versions/${versionId}/review`, { params: scope }), "Failed to load the review").then((d) => d.data);

/** { values?: { field: text | [text] | null }, categoryId?: uuid | null } → { blockId, extracted } */
export const editCatalogueBlock = (scope = {}, blockId, body) => unwrap(apiClient.patch(`/catalogue-blocks/${blockId}`, body, { params: scope }), "Failed to save").then((d) => d.data);

/** Creates a product from the block → { blockId, productId, product } */
export const acceptCatalogueBlock = (scope = {}, blockId) => unwrap(apiClient.post(`/catalogue-blocks/${blockId}/accept`, {}, { params: scope }), "Failed to accept").then((d) => d.data);

export const rejectCatalogueBlock = (scope = {}, blockId) => unwrap(apiClient.post(`/catalogue-blocks/${blockId}/reject`, {}, { params: scope }), "Failed to reject").then((d) => d.data);

/** → { created, products, skipped: { flagged, existing, notExtracted } } */
export const acceptUnflaggedBlocks = (scope = {}, versionId) => unwrap(apiClient.post(`/catalogue-versions/${versionId}/accept-unflagged`, {}, { params: scope }), "Bulk accept failed").then((d) => d.data);

export const mergeCatalogueBlocks = (scope = {}, versionId, blockIds) => unwrap(apiClient.post(`/catalogue-versions/${versionId}/merge-blocks`, { blockIds }, { params: scope }), "Merge failed").then((d) => d.data);

export const splitCatalogueBlock = (scope = {}, blockId, atLine) => unwrap(apiClient.post(`/catalogue-blocks/${blockId}/split`, { atLine }, { params: scope }), "Split failed").then((d) => d.data);

/** (re-)extract; blockIds = only those pending blocks → { versionId, jobId } */
export const extractCatalogueVersion = (scope = {}, versionId, body = {}) => unwrap(apiClient.post(`/catalogue-versions/${versionId}/extract`, body, { params: scope }), "Extraction failed to start").then((d) => d.data);

/** { dotGroup3: "thousands" | "decimal" } — once per catalogue */
export const setCatalogueNumberConvention = (scope = {}, versionId, dotGroup3) => unwrap(apiClient.put(`/catalogue-versions/${versionId}/number-convention`, { dotGroup3 }, { params: scope }), "Failed to save the convention").then((d) => d.data);
