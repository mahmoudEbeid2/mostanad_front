import apiClient from "./apiClient";

export const getTemplates = async (companyId, params) => {
  const url = companyId 
    ? `/companies/${companyId}/templates` 
    : `/templates`; // assuming global templates if no companyId
  const response = await apiClient.get(url, { params });
  return response.data;
};

export const createTemplate = async (companyId, data) => {
  const url = companyId 
    ? `/companies/${companyId}/templates` 
    : `/templates`;
  const response = await apiClient.post(url, data);
  return response.data;
};
