import apiClient from "./apiClient";

export const getProducts = async (params = {}) => {
  const response = await apiClient.get("/products", { params });
  return response.data;
};

export const getProductById = async (id) => {
  const response = await apiClient.get(`/products/${id}`);
  return response.data;
};

export const uploadCatalog = async (formData) => {
  const response = await apiClient.post("/products/upload-catalog", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getTaskStatus = async (taskId) => {
  const response = await apiClient.get(`/background-tasks/${taskId}`);
  return response.data;
};

export const extractProductAi = async (data) => {
  const response = await apiClient.post("/products/extract-ai", data);
  return response.data;
};

export const createProduct = async (data) => {
  const response = await apiClient.post("/products", data);
  return response.data;
};

export const updateProduct = async (id, data) => {
  const response = await apiClient.patch(`/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await apiClient.delete(`/products/${id}`);
  return response.data;
};

// Copy to another brand (backend productCopyService). Errors carry the API's own message.
const msg = (e, fallback) => {
  const m = e?.response?.data?.message;
  const err = new Error(m || fallback);
  err.data = e?.response?.data?.data;
  return err;
};
/** → { groups: [{ key, label, fields }], neverCopied } */
export const getCopyFields = () => apiClient.get("/products/copy-fields").then((r) => r.data.data, (e) => Promise.reject(msg(e, "Couldn't load the copy options")));
/** body: { targetCompanyId?, targetBrandId, name, productCode?, fieldsToCopy?, keepLinked } → { product, copied, needsRegistrationNumber } */
export const copyProduct = (id, body) => apiClient.post(`/products/${id}/copy`, body).then((r) => r.data.data, (e) => Promise.reject(msg(e, "Couldn't copy the product")));
/** body: { productIds, targetCompanyId?, targetBrandId, names: [{ productId, name, productCode }], fieldsToCopy?, keepLinked } → { results, copied, failed } */
export const copyProductsBulk = (body) =>
  apiClient.post("/products/copy-bulk", body).then(
    (r) => r.data.data,
    (e) => (e?.response?.data?.data?.results ? e.response.data.data : Promise.reject(msg(e, "Couldn't copy the products")))
  );
/** → { source, copy, fields: [{ field, group, source, copy, same }], changed } */
export const getSourceDiff = (id) => apiClient.get(`/products/${id}/source-diff`).then((r) => r.data.data, (e) => Promise.reject(msg(e, "Couldn't compare with the original")));
export const updateFromSource = (id, fields) => apiClient.post(`/products/${id}/update-from-source`, { fields }).then((r) => r.data.data, (e) => Promise.reject(msg(e, "Couldn't update from the original")));
