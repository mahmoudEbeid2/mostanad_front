import apiClient from "./apiClient";

// The generated-label engine (Phases 1-9 of the backend rebuild). Distinct resource
// from apiLabels.js's verifyLabel (POST /products/verify-label) — this wraps /labels/*.
// See ../../../mostanad/FRONTEND-GUIDE.md and API-CHANGES.md for the contracts.

export const getLabel = async (id) => {
  try {
    const response = await apiClient.get(`/labels/${id}`);
    return response.data.data; // { label, currentVersion, latestValidation, provenance }
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch label");
  }
};
