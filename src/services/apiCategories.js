import apiClient from "./apiClient";

export const getCategories = async (params = {}) => {
  const response = await apiClient.get("/categories", { params });
  return response.data;
};

export const getCategoryById = async (id) => {
  const response = await apiClient.get(`/categories/${id}`);
  return response.data;
};

export const createCategory = async (data) => {
  const response = await apiClient.post("/categories", data);
  return response.data;
};

export const updateCategory = async (id, data) => {
  const response = await apiClient.patch(`/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id) => {
  const response = await apiClient.delete(`/categories/${id}`);
  return response.data;
};
