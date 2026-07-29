import apiClient from "./apiClient";

export const getReferenceLabels = async (params = {}) => {
  try {
    const response = await apiClient.get("/reference-labels", { params });
    return response.data.data.referenceLabels;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch reference labels");
  }
};

export const uploadReferenceLabels = async (formData) => {
  try {
    const response = await apiClient.post("/reference-labels", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to upload reference labels");
  }
};

export const createReferenceLabelManual = async (data) => {
  try {
    const response = await apiClient.post("/reference-labels/manual", data);
    return response.data.data.referenceLabel;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create reference label");
  }
};

export const deleteReferenceLabel = async (id) => {
  try {
    await apiClient.delete(`/reference-labels/${id}`);
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete reference label");
  }
};

export const retryReferenceLabelTask = async (taskId) => {
  try {
    const response = await apiClient.post(`/reference-labels/retry/${taskId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to retry reference label");
  }
};

export const generateLabelAi = async (data) => {
  try {
    const response = await apiClient.post("/reference-labels/generate-text-ai", data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to generate label with AI");
  }
};
