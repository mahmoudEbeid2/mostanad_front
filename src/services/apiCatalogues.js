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
