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
