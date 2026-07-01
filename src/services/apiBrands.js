import apiClient from "./apiClient";

export const getBrands = async (companyId) => {
  const params = companyId ? { companyId } : {};
  const response = await apiClient.get("/brands", { params });
  return response.data;
};
