import apiClient from "./apiClient";
import { t } from "../i18n";

export const getReferenceLabels = async (params = {}) => {
  try {
    const response = await apiClient.get("/reference-labels", { params });
    return response.data.data.referenceLabels;
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.failedToFetchReferenceLabels"));
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
    return { state: "failed", reason: response.data.message || t("apiReferenceLabels.notQueued") };
  } catch (error) {
    const d = error.response?.data?.data;
    if (d?.skipped?.[0]) return { state: "skipped", uploadedAt: d.skipped[0].uploadedAt };
    if (d?.failed?.[0]) return { state: "failed", reason: d.failed[0].reason };
    return { state: "failed", reason: error.response?.data?.message || error.message || t("apiReferenceLabels.uploadFailed") };
  }
};

export const createReferenceLabelManual = async (data) => {
  try {
    const response = await apiClient.post("/reference-labels/manual", data);
    return response.data.data.referenceLabel;
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.failedToCreateReferenceLabel"));
  }
};

export const deleteReferenceLabel = async (id) => {
  try {
    await apiClient.delete(`/reference-labels/${id}`);
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.failedToDeleteReferenceLabel"));
  }
};

export const retryReferenceLabelTask = async (taskId) => {
  try {
    const response = await apiClient.post(`/reference-labels/retry/${taskId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.failedToRetryReferenceLabel"));
  }
};

export const generateLabelAi = async (data) => {
  try {
    const response = await apiClient.post("/reference-labels/generate-text-ai", data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.failedToGenerateLabelWith"));
  }
};

/** PATCH /reference-labels/:id { brandId } — the reference's brand (null clears it). */
export const setReferenceLabelBrand = async (id, brandId) => {
  try {
    const response = await apiClient.patch(`/reference-labels/${id}`, { brandId });
    return response.data.data.referenceLabel;
  } catch (error) {
    throw new Error(error.response?.data?.message || t("errors.couldntChangeTheBrand"));
  }
};
