import apiClient from "./apiClient";
import { unwrap } from "./apiCertificateTypes";
import { t } from "../i18n";

// Certificate AI layers (backend plan.md §3.3, §9): company AI settings,
// dictionary health + AI label synonyms, template-driven product completeness,
// structured product data, evaluation stats. `scope` = { companyId } for
// system users ({} for a company session).

export const getAiSettings = (scope = {}) => unwrap(apiClient.get("/certificate-ai-settings", { params: scope }), "Couldn't load the AI settings").then((d) => d.data.settings);
export const updateAiSettings = (scope = {}, patch) => unwrap(apiClient.patch("/certificate-ai-settings", patch, { params: scope }), "Couldn't save the AI settings").then((d) => d.data.settings);

export const getAiStats = (scope = {}, days = 90) => unwrap(apiClient.get("/certificate-ai-stats", { params: { ...scope, days } }), "Couldn't load the AI statistics").then((d) => d.data.stats);

export const getDictionaryHealth = (scope = {}) => unwrap(apiClient.get("/certificate-data-dictionary/health", { params: scope }), t("errors.couldntLoadTheDictionaryReport")).then((d) => d.data.health);
export const rebuildDictionary = (scope = {}) => unwrap(apiClient.post("/certificate-data-dictionary/rebuild", {}, { params: scope }), t("errors.couldntRebuildTheDictionary"));
/** One AI call for keys never named → { asked, suggested, ai } */
export const suggestSynonyms = (scope = {}) => unwrap(apiClient.post("/certificate-data-dictionary/synonym-suggestions", {}, { params: scope }), "Couldn't get AI suggestions").then((d) => d.data);
export const decideSynonym = (scope = {}, id, body) => unwrap(apiClient.post(`/certificate-data-dictionary/synonym-suggestions/${id}`, body, { params: scope }), t("errors.couldntSaveTheDecision")).then((d) => d.data);

export const getCompleteness = (scope = {}) => unwrap(apiClient.get("/certificate-product-completeness", { params: scope }), t("errors.couldntLoadProductCompleteness")).then((d) => d.data.completeness);
/** → { definition: { fields, lists }, values, lists, missing } */
export const getProductData = (scope = {}, productId) => unwrap(apiClient.get(`/certificate-products/${productId}/data`, { params: scope }), t("errors.couldntLoadTheCertificateData")).then((d) => d.data);
export const saveProductData = (scope = {}, productId, body) => unwrap(apiClient.patch(`/certificate-products/${productId}/data`, body, { params: scope }), t("errors.couldntSaveTheCertificateData")).then((d) => d.data);

/** P8 — can AI answer right now? → { available, reason: null|"disabled"|"no_key"|"quota", message, since } */
export const getAiStatus = () => unwrap(apiClient.get("/ai-status"), "Couldn't check whether AI is available").then((d) => d.data);
