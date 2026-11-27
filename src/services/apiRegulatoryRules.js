import apiClient from "./apiClient";
import { t } from "../i18n";

const unwrap = (promise, fallbackMessage) =>
  promise.then((r) => r.data).catch((error) => {
    throw new Error(error.response?.data?.message || fallbackMessage);
  });

export const getRules = (params = {}) =>
  unwrap(apiClient.get("/regulatory-rules", { params }), t("errors.failedToFetchRegulatoryRules")).then((d) => ({
    rules: d.data.rules,
    total: d.total,
  }));

export const updateRule = (id, data) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}`, data), t("errors.failedToUpdateRule")).then((d) => d.data.rule);

export const approveRule = (id) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}/approve`), t("errors.failedToApproveRule")).then((d) => d.data.rule);

export const rejectRule = (id) =>
  unwrap(apiClient.patch(`/regulatory-rules/${id}/reject`), t("errors.failedToRejectRule")).then((d) => d.data.rule);
