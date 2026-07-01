import apiClient from "./apiClient";

export const getProducts = async (params = {}) => {
  const response = await apiClient.get("/products", { params });
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
