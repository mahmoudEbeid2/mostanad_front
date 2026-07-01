import apiClient from "./apiClient";

export const getCompanies = async (params = {}) => {
  const response = await apiClient.get("/companies", { params });
  return response.data;
};
