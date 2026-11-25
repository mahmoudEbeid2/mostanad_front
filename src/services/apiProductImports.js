import apiClient from "./apiClient";

// Products from many files at once (backend productImportService) and certificates for
// several products with no invoice (backend directService.generateForProducts).
const fail = (fallback) => (e) => {
  const err = new Error(e?.response?.data?.message || fallback);
  err.status = e?.response?.status;
  return Promise.reject(err);
};
const data = (r) => r.data.data;

/** files: File[] (labels, sheets, Excel/CSV) + text (a pasted list) → { versionId, files, rows, refused, taskId } */
export function startProductImport({ files = [], text = "", companyId, brandId }) {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  if (text) fd.append("text", text);
  if (companyId) fd.append("companyId", companyId);
  if (brandId) fd.append("brandId", brandId);
  return apiClient.post("/product-imports", fd, { headers: { "Content-Type": "multipart/form-data" } }).then(data, fail("Couldn't read the files"));
}
/** → { id, status, task, files, refused, warnings, categories, counts, rows } */
export const getProductImport = (id) => apiClient.get(`/product-imports/${id}`).then(data, fail("Couldn't load the products"));
export const editImportRow = (id, rowId, values) => apiClient.patch(`/product-imports/${id}/rows/${rowId}`, values).then((r) => r.data.data.row, fail("Couldn't save the change"));
export const skipImportRow = (id, rowId) => apiClient.post(`/product-imports/${id}/rows/${rowId}/skip`).then(data, fail("Couldn't skip the row"));
/** → { created: [{ rowId, productId, name }], left: [{ rowId, name, reason }] } */
export const saveAllImported = (id) => apiClient.post(`/product-imports/${id}/save-all`).then(data, fail("Couldn't save the products"));

/** body: { certificateTypeIds, products: [{ productId, batch? }], country?, dryRun?, companyId? } → { planned, missing, invoiceId?, batchId?, taskId? } */
export const certificatesForProducts = (body) => apiClient.post("/certificates/for-products", body).then(data, fail("Couldn't make the certificates"));
