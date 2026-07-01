import apiClient from "./apiClient";

export const verifyLabel = async (formData) => {
  const response = await apiClient.post("/products/verify-label", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};
