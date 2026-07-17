import apiClient from "./apiClient";

export const uploadEdaRequirement = async (formData) => {
  const response = await apiClient.post("/eda-requirements", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return response.data.data;
};

export const getEdaRequirements = async (params = {}) => {
  const response = await apiClient.get("/eda-requirements", { params });
  return response.data;
};

export const deleteEdaRequirement = async (id) => {
  const response = await apiClient.delete(`/eda-requirements/${id}`);
  return response.data;
};

export const updateEdaRequirement = async (id, data) => {
  const response = await apiClient.patch(`/eda-requirements/${id}`, data);
  return response.data.data;
};
