import apiClient from "./apiClient";

// Printable label layouts and "Upload label to resize" (backend services/label/layout).
const fail = (fallback) => (e) => {
  const err = new Error(e?.response?.data?.message || fallback);
  err.status = e?.response?.status;
  return Promise.reject(err);
};
const data = (r) => r.data.data;

/** → { presets: [{ key, label, widthMm, heightMm }], sections, defaults } */
export const getLayoutSizes = () => apiClient.get("/labels/layout-sizes").then(data, fail("Couldn't load the label sizes"));
/** → { label, current, versions } */
export const getLabelLayout = (labelId) => apiClient.get(`/labels/${labelId}/layout`).then(data, fail("Couldn't load the label's layout"));
/** body: layout input → { old, new: { size, fit, warnings, empty, previewDataUrl, pdfAvailable } } */
export const previewLabelLayout = (labelId, body) => apiClient.post(`/labels/${labelId}/layout/preview`, body).then(data, fail("Couldn't lay the label out"));
/** → { layout } */
export const saveLabelLayout = (labelId, body) => apiClient.post(`/labels/${labelId}/layout`, body).then(data, fail("Couldn't save the size"));

/** A protected file (PDF / PNG) as a blob URL; the caller revokes it. */
export const layoutFileUrl = (path) => apiClient.get(path, { responseType: "blob" }).then((r) => URL.createObjectURL(r.data), fail("Couldn't load the file"));
/** Downloads a layout's PDF (the API needs the auth header, so not a plain link). */
export async function downloadLayoutPdf(layout, name = "label") {
  const url = await layoutFileUrl(layout.pdfUrl);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w؀-ۿ -]+/g, "").trim() || "label"}-${Math.round(layout.widthMm)}x${Math.round(layout.heightMm)}mm.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * multipart upload: { file, mode (smart | scale | rebuild), layout | sizes, resize, stretch, productId, labelId, country, companyId }
 * → { upload, layout?, layouts?, taskId? }. smart with sizes: [] keeps the design only (for the editor).
 */
export function uploadLabelToResize({ file, mode, layout, sizes, resize, stretch, productId, labelId, country, companyId }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);
  fd.append("layout", JSON.stringify(layout || {}));
  if (sizes) fd.append("sizes", JSON.stringify(sizes));
  if (resize) fd.append("resize", JSON.stringify(resize));
  if (labelId) fd.append("labelId", labelId);
  if (stretch) fd.append("stretch", "true");
  if (productId) fd.append("productId", productId);
  if (country) fd.append("country", country);
  if (companyId) fd.append("companyId", companyId);
  return apiClient.post("/label-uploads", fd, { headers: { "Content-Type": "multipart/form-data" } }).then(data, fail("Couldn't upload the label"));
}
export const getLabelUpload = (id, params = {}) => apiClient.get(`/label-uploads/${id}`, { params }).then(data, fail("Couldn't load the upload"));
export const confirmLabelUpload = (id, body) => apiClient.post(`/label-uploads/${id}/confirm`, body).then(data, fail("Couldn't lay the label out"));
export const rescaleLabelUpload = (id, body) => apiClient.post(`/label-uploads/${id}/scale`, body).then(data, fail("Couldn't scale the label"));

// keep the design: the original's blocks, a preview of sizes (nothing saved), save sizes as versions
/** → { uploadId, originalName, pageMm, pages, blocks, boxNet, minFontPt, minFontRule, originalDataUrl } */
export const getUploadDesign = (id, params = {}) => apiClient.get(`/label-uploads/${id}/design`, { params }).then(data, fail("Couldn't read the design"));
/** body: { sizes: [{ widthMm, heightMm }], minFontPt?, bleedMm?, cropMarks?, overrides? } → { results: [{ size, widthMm, heightMm, fit, previewDataUrl, pdfAvailable }] } */
export const previewUploadResize = (id, body, params = {}) => apiClient.post(`/label-uploads/${id}/preview`, body, { params }).then(data, fail("Couldn't preview the size"));
/** same body → { layouts } (one saved version per size, each with its PDF when it fits) */
export const saveUploadResize = (id, body, params = {}) => apiClient.post(`/label-uploads/${id}/resize`, body, { params }).then(data, fail("Couldn't save the sizes"));
