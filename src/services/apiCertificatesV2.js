import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";

// Certificates V2 — generation plan, batches, generated certificates
// (backend CERTIFICATES_V2_PLAN.md §10–§12). Every call takes `scope`.

/** → { entries[], unassigned[], gaps[], summary[] } — what "Generate" would produce */
export const getGenerationPlan = (scope = {}, invoiceId) =>
  unwrap(apiClient.get(`/invoices/${invoiceId}/generation-plan`, { params: scope }), "Failed to load the generation plan").then((d) => d.data.plan);

/** → { batchId, taskId, planned, unassigned } */
export const generateCertificates = (scope = {}, invoiceId) =>
  unwrap(apiClient.post(`/invoices/${invoiceId}/generate`, {}, { params: scope }), "Couldn't start generating").then((d) => d.data);

/** → batch with { status, counts, live, plan, certificates[] } */
export const getBatch = (scope = {}, batchId) => unwrap(apiClient.get(`/certificate-batches/${batchId}`, { params: scope }), "Failed to load the batch").then((d) => d.data.batch);

export const listCertificates = (scope = {}, filters = {}) =>
  unwrap(apiClient.get("/certificates", { params: { ...scope, ...filters } }), "Failed to load certificates").then((d) => ({ certificates: d.data.certificates, total: d.total }));

export const getCertificate = (scope = {}, id) => unwrap(apiClient.get(`/certificates/${id}`, { params: scope }), "Failed to load the certificate").then((d) => d.data.certificate);

/** Static HTML of a version — only ever shown inside DocumentFrame. */
export const getCertificateHtml = (scope = {}, id, version) =>
  unwrap(apiClient.get(`/certificates/${id}/html`, { params: { ...scope, ...(version ? { version } : {}) }, responseType: "text", transformResponse: (x) => x }), "Failed to load the certificate");

export const getCertificateThumbnail = (scope = {}, id) => apiClient.get(`/certificates/${id}/thumbnail`, { params: scope, responseType: "blob" }).then((r) => r.data);

// ── Phase 5: edit, versions, export, finalize ──────────────────────────────
/** → { version, values, flags, flagCount, changeSummary } · 409 VERSION_CONFLICT { currentVersion } · 409 CERTIFICATE_FINAL */
export const editCertificateValues = (scope = {}, id, expectedVersion, changes) =>
  unwrap(apiClient.patch(`/certificates/${id}/values`, { expectedVersion, changes }, { params: scope }), "Couldn't save").then((d) => d.data);

export const resetCertificateField = (scope = {}, id, key, expectedVersion) =>
  unwrap(apiClient.post(`/certificates/${id}/fields/${key}/reset`, { expectedVersion }, { params: scope }), "Couldn't reset the field").then((d) => d.data);

export const listCertificateVersions = (scope = {}, id) =>
  unwrap(apiClient.get(`/certificates/${id}/versions`, { params: scope }), "Failed to load the versions").then((d) => d.data.versions);

export const restoreCertificateVersion = (scope = {}, id, n, expectedVersion) =>
  unwrap(apiClient.post(`/certificates/${id}/versions/${n}/restore`, { expectedVersion }, { params: scope }), "Couldn't restore the version").then((d) => d.data);

/** → { taskId } — poll it, then downloadCertificatePdf */
export const exportCertificatePdf = (scope = {}, id) =>
  unwrap(apiClient.post(`/certificates/${id}/export-pdf`, {}, { params: scope }), "Couldn't start the PDF export").then((d) => d.data);

export const finalizeCertificate = (scope = {}, id, expectedVersion) =>
  unwrap(apiClient.post(`/certificates/${id}/finalize`, { expectedVersion }, { params: scope }), "Couldn't finalize").then((d) => d.data.certificate);

/** → { certificateId } of the new draft */
export const duplicateCertificate = (scope = {}, id) =>
  unwrap(apiClient.post(`/certificates/${id}/duplicate`, {}, { params: scope }), "Couldn't duplicate").then((d) => d.data);

export const exportBatchZip = (scope = {}, batchId) =>
  unwrap(apiClient.post(`/certificate-batches/${batchId}/export`, {}, { params: scope }), "Couldn't start the ZIP export").then((d) => d.data);

/** Downloads an authorised file response with the server's file name. */
async function saveDownload(request, fallbackName) {
  let res;
  try {
    res = await request;
  } catch (error) {
    let message = "Download failed";
    try {
      message = JSON.parse(await error.response?.data?.text())?.message || message;
    } catch {
      /* not a JSON error body */
    }
    throw new Error(message);
  }
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

export const downloadCertificatePdf = (scope = {}, id) => saveDownload(apiClient.get(`/certificates/${id}/pdf`, { params: scope, responseType: "blob" }), "certificate.pdf");

export const downloadBatchZip = (scope = {}, batchId) => saveDownload(apiClient.get(`/certificate-batches/${batchId}/zip`, { params: scope, responseType: "blob" }), "certificates.zip");

/** Resolves when a background task completes; rejects with its real error. */
export async function waitForTask(taskId, { timeoutMs = 120_000 } = {}) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { data } = await apiClient.get(`/background-tasks/${taskId}`);
    const t = data?.data;
    if (t?.status === "completed") return t;
    if (t?.status === "failed") throw new Error(t.error || "The export failed");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("The export is taking too long — try again in a moment");
}
