import apiClient from "./apiClient";

export const getBrands = async (companyId) => {
  const params = companyId ? { companyId } : {};
  const response = await apiClient.get("/brands", { params });
  return response.data;
};

export const getBrandById = async (id) => {
  const response = await apiClient.get(`/brands/${id}`);
  return response.data;
};

export const createBrand = async (data) => {
  const response = await apiClient.post("/brands", data);
  return response.data;
};

export const updateBrand = async (id, data) => {
  const response = await apiClient.patch(`/brands/${id}`, data);
  return response.data;
};

export const deleteBrand = async (id) => {
  const response = await apiClient.delete(`/brands/${id}`);
  return response.data;
};
