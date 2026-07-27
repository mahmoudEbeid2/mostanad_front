import axios from "axios";
import { getAuthHeader } from "./apiAuth";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export const getReferenceLabels = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/v1/reference-labels`, {
      headers: getAuthHeader(),
    });
    return response.data.data.referenceLabels;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch reference labels");
  }
};

export const uploadReferenceLabels = async (formData) => {
  try {
    const response = await axios.post(`${API_URL}/api/v1/reference-labels`, formData, {
      headers: {
        ...getAuthHeader(),
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to upload reference labels");
  }
};

export const deleteReferenceLabel = async (id) => {
  try {
    await axios.delete(`${API_URL}/api/v1/reference-labels/${id}`, {
      headers: getAuthHeader(),
    });
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete reference label");
  }
};
