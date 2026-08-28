import apiClient from "./apiClient";

const unwrap = (promise, fallbackMessage) =>
  promise.then((r) => r.data).catch((error) => {
    throw new Error(error.response?.data?.message || fallbackMessage);
  });

export const getRules = (params = {}) =>
  unwrap(apiClient.get("/regulatory-rules", { params }), "Failed to fetch regulatory rules").then((d) => ({
    rules: d.data.rules,
    total: d.total,
  }));

export const updateRule = (id, data) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}`, data), "Failed to update rule").then((d) => d.data.rule);

export const approveRule = (id) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}/approve`), "Failed to approve rule").then((d) => d.data.rule);

export const rejectRule = (id) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}/reject`), "Failed to reject rule").then((d) => d.data.rule);
