import apiClient from "./apiClient";

export const generateCertificates = async (companyId, formData) => {
  const url = companyId 
    ? `/companies/${companyId}/certificates/generate` 
    : `/certificates/generate`;
    
  const response = await apiClient.post(url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getBackgroundTaskStatus = async (taskId) => {
  const response = await apiClient.get(`/background-tasks/${taskId}`);
  return response.data;
};
