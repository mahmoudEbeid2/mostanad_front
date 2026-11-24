import apiClient from "./apiClient";

export const getReferenceLabels = async (params = {}) => {
  try {
    const response = await apiClient.get("/reference-labels", { params });
    return response.data.data.referenceLabels;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch reference labels");
  }
};

/**
 * One label file → its own result, never thrown: { state: "queued", taskId } |
 * { state: "skipped", uploadedAt } (already a reference of this company) |
 * { state: "failed", reason }. `onProgress(0..1)` while the file is sent.
 */
export const uploadReferenceLabelFile = async (file, fields, onProgress) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => v && fd.append(k, v));
  fd.append("files", file);
  try {
    const response = await apiClient.post("/reference-labels", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
    });
    const d = response.data.data;
    if (d.tasks?.[0]) return { state: "queued", taskId: d.tasks[0].taskId };
    return { state: "failed", reason: response.data.message || "Not queued" };
  } catch (error) {
    const d = error.response?.data?.data;
    if (d?.skipped?.[0]) return { state: "skipped", uploadedAt: d.skipped[0].uploadedAt };
    if (d?.failed?.[0]) return { state: "failed", reason: d.failed[0].reason };
    return { state: "failed", reason: error.response?.data?.message || error.message || "Upload failed" };
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
