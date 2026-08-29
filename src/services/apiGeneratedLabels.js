import apiClient from "./apiClient";

// The generated-label engine (Phases 1-9 of the backend rebuild). Distinct resource
// from apiLabels.js's verifyLabel (POST /products/verify-label) — this wraps /labels/*.
// See ../../../mostanad/MOSTANAD_ARCHITECTURE.md §5/§10-§13 for the contracts.

const unwrap = (promise, fallbackMessage) =>
  promise.then((r) => r.data).catch((error) => {
    throw new Error(error.response?.data?.message || fallbackMessage);
  });

export const getAllLabels = (params = {}) =>
  unwrap(apiClient.get("/labels", { params }), "Failed to fetch labels").then((d) => ({
    labels: d.data.labels,
    total: d.total,
  }));

export const getLabel = (id) =>
  unwrap(apiClient.get(`/labels/${id}`), "Failed to fetch label").then((d) => d.data); // { label, currentVersion, latestValidation, provenance }

export const postValidate = (id) =>
  unwrap(apiClient.post(`/labels/${id}/validate`), "Failed to run validation").then((d) => d.data.report);

export const getValidation = (id) =>
  unwrap(apiClient.get(`/labels/${id}/validation`), "Failed to fetch validation report").then((d) => d.data.report);

export const getLabelVersions = (id) =>
  unwrap(apiClient.get(`/labels/${id}/versions`), "Failed to fetch version history").then((d) => d.data.versions);

export const getVersion = (id, versionNumber) =>
  unwrap(apiClient.get(`/labels/${id}/versions/${versionNumber}`), "Failed to fetch version").then((d) => d.data.version);

export const getVersionsDiff = (id, a, b) =>
  unwrap(apiClient.get(`/labels/${id}/versions/${a}/diff/${b}`), "Failed to diff versions").then((d) => d.data.diff);

// §13: forward-only. Creates a NEW version N+1 with version K's content — it never
// discards anything created after K. Returns { version, report } for the new version.
export const postRestore = (id, versionNumber) =>
  unwrap(apiClient.post(`/labels/${id}/versions/${versionNumber}/restore`), "Failed to restore version").then((d) => d.data);

// §11: three outcomes distinguished by `result.status` / `result.intent`:
//  - intent "question"|"explain_validation" → { intent, answer } — no version bump.
//  - status "applied" → { status, resultVersion, report } — label + report both changed.
//  - status "conflict" (HTTP 409) → { status, proposedPatch, wouldViolate, options } —
//    NOT applied. axios throws for 409; the caller must catch and read err.response.data.data.
export const postChat = (id, { message, expectedVersion, overrideAcknowledged }) =>
  apiClient
    .post(`/labels/${id}/chat`, { message, expectedVersion, overrideAcknowledged })
    .then((r) => r.data.data);

export const getChat = (id) =>
  unwrap(apiClient.get(`/labels/${id}/chat`), "Failed to fetch chat history").then((d) => d.data.messages);

// §11.4: direct patch protocol, no AI. Same conflict shape as chat's edit path.
export const patchLabel = (id, { changes, rationale, expectedVersion }) =>
  apiClient
    .patch(`/labels/${id}`, { changes, rationale, expectedVersion })
    .then((r) => r.data.data);

export const postApprove = (id, body) =>
  apiClient.post(`/labels/${id}/approve`, body).then((r) => r.data.data);

export const getApprovals = (id) =>
  unwrap(apiClient.get(`/labels/${id}/approvals`), "Failed to fetch approvals").then((d) => d.data.approvals);

export const postRevoke = (id, approvalId, reason) =>
  unwrap(apiClient.post(`/labels/${id}/approvals/${approvalId}/revoke`, { reason }), "Failed to revoke approval").then((d) => d.data);

export const getLabelExtraction = (id) =>
  unwrap(apiClient.get(`/labels/${id}/extraction`), "Failed to fetch extraction data").then((d) => d.data);

export const postConfirmField = (id, { path, value, expectedVersion }) =>
  unwrap(apiClient.post(`/labels/${id}/confirm-field`, { path, value, expectedVersion }), "Failed to confirm field").then((d) => d.data);
