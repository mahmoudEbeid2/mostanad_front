import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";
import { t } from "../i18n";

// The client's certificate workflow (backend services/certificates/workflow): a request and its
// matrix, the review steps, revisions, the designer's panel, composition disagreements.

export const createCertificateRequest = (scope = {}, body) => unwrap(apiClient.post("/certificate-requests", { ...body, ...(scope.companyId ? { companyId: scope.companyId } : {}) }, { params: scope }), t("errors.failedToCreateTheRequest")).then((d) => d.data);
export const listCertificateRequests = (scope = {}, query = {}) => unwrap(apiClient.get("/certificate-requests", { params: { ...scope, ...query } }), t("errors.failedToLoadTheRequests")).then((d) => d.data);
export const getCertificateRequest = (scope = {}, id) => unwrap(apiClient.get(`/certificate-requests/${id}`, { params: scope }), t("errors.failedToLoadTheRequest")).then((d) => d.data);
export const resolveRequestLine = (scope = {}, id, lineId, productId) => unwrap(apiClient.patch(`/certificate-requests/${id}/lines/${lineId}`, { productId }, { params: scope }), t("errors.failedToSaveTheProduct")).then((d) => d.data);
export const generateRequest = (scope = {}, id) => unwrap(apiClient.post(`/certificate-requests/${id}/generate`, {}, { params: scope }), t("errors.failedToStart")).then((d) => d.data);

export const reviewCertificate = (scope = {}, id, body) => unwrap(apiClient.post(`/certificates/${id}/review`, body, { params: scope }), "Failed").then((d) => d.data.certificate);
export const getReviewChecks = (scope = {}, id) => unwrap(apiClient.get(`/certificates/${id}/review-checks`, { params: scope }), t("errors.failedToLoadTheChecks")).then((d) => d.data);
export const reviseCertificate = (scope = {}, id) => unwrap(apiClient.post(`/certificates/${id}/revise`, {}, { params: scope }), t("errors.failedToMakeARevision")).then((d) => d.data.certificate);
export const getCertificateChanges = (scope = {}, id) => unwrap(apiClient.get(`/certificates/${id}/changes`, { params: scope }), t("errors.failedToLoadTheChanges")).then((d) => d.data);

export const getDesignerData = (scope = {}, productId, requestId = null) => unwrap(apiClient.get(`/products/${productId}/designer`, { params: { ...scope, ...(requestId ? { requestId } : {}) } }), t("errors.failedToLoadTheProduct")).then((d) => d.data);
export const saveDesignEstimates = (scope = {}, productId, body) => unwrap(apiClient.put(`/products/${productId}/design-estimates`, body, { params: scope }), t("errors.failedToSave")).then((d) => d.data);
export const getCompositionReview = (scope = {}, productId) => unwrap(apiClient.get(`/products/${productId}/composition-review`, { params: scope }), t("errors.failedToLoad")).then((d) => d.data);
export const decideComposition = (scope = {}, productId, index, chosen, reason) => unwrap(apiClient.post(`/products/${productId}/composition-review/${index}/decide`, { chosen, reason }, { params: scope }), t("errors.failedToSaveTheDecision")).then((d) => d.data);

/** The source document behind a value, opened at its page (the API link from the panel) */
export async function openEvidence(link) {
  const [path, hash] = String(link).replace(/^\/api\/v1/, "").split("#");
  const r = await apiClient.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  window.open(`${url}${hash ? `#${hash}` : ""}`, "_blank", "noopener");
}

// 28 Nov — what the files said and what was estimated (backend harvest / harvestInfer)
export const getProductHarvest = (scope = {}, productId) => unwrap(apiClient.get(`/products/${productId}/harvest`, { params: scope }), t("errors.failedToLoadWhatThe")).then((d) => d.data);
export const decideHarvestConflict = (scope = {}, productId, key, value) => unwrap(apiClient.post(`/products/${productId}/harvest/conflicts/${encodeURIComponent(key)}`, { value }, { params: scope }), t("errors.failedToSaveTheChoice")).then((d) => d.data);
/** «اعتمد كل المستنتج»: { productIds } or { certificateIds } */
export const acceptAllEstimates = (scope = {}, body) => unwrap(apiClient.post("/products/estimates/accept", body, { params: scope }), t("errors.failedToAccept")).then((d) => d.data);
export const reharvestCompany = (scope = {}, companyId) => unwrap(apiClient.post(`/companies/${companyId}/harvest`, {}, { params: scope }), t("errors.failedToStartReadingThe")).then((d) => d.data);
/** One issue date for all a request's certificates ("YYYY-MM-DD", or null = today) — Phase 3 */
export const setRequestIssueDate = (scope = {}, id, issueDate) => unwrap(apiClient.patch(`/certificate-requests/${id}`, { issueDate }, { params: scope }), t("errors.failedToSaveTheDate")).then((d) => d.data);
/** «أضف عبوة جديدة لنفس المنتج»: a pack variant of fromProductId (composition and basis copied), the line linked to it — Phase 4 */
export const addPackVariant = (scope = {}, id, lineId, fromProductId) => unwrap(apiClient.post(`/certificate-requests/${id}/lines/${lineId}/new-pack`, { fromProductId }, { params: scope }), t("errors.failedToAddThePack")).then((d) => d.data);
