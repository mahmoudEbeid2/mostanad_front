import apiClient from "./apiClient";

// Certificates V2 — certificate type catalogue (backend CERTIFICATES_V2_PLAN.md §12).
// Every call takes `scope` = { companyId } for system users ({} for a company session).

const unwrap = (promise, fallbackMessage) =>
  promise.then((r) => r.data).catch((error) => {
    const err = new Error(error.response?.data?.message || fallbackMessage);
    err.code = error.response?.data?.code;
    err.status = error.response?.status;
    err.data = error.response?.data;
    throw err;
  });

export const listCertificateTypes = (scope = {}, { includeInactive = false } = {}) =>
  unwrap(apiClient.get("/certificate-types", { params: { ...scope, includeInactive } }), "Failed to load certificate types").then(
    (d) => d.data.types
  );

export const createCertificateType = (scope = {}, body) =>
  unwrap(apiClient.post("/certificate-types", body, { params: scope }), "Failed to create the certificate type").then((d) => d.data.type);

export const updateCertificateType = (scope = {}, id, body) =>
  unwrap(apiClient.patch(`/certificate-types/${id}`, body, { params: scope }), "Failed to update the certificate type").then((d) => d.data.type);

export const deleteCertificateType = (scope = {}, id) =>
  unwrap(apiClient.delete(`/certificate-types/${id}`, { params: scope }), "Failed to delete the certificate type");

export { unwrap };
