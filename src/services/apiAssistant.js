import apiClient from "./apiClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export const getAssistantStatus = async () => (await apiClient.get("/assistant/status")).data.data;
export const listConversations = async () => (await apiClient.get("/assistant/conversations")).data.data;
export const getConversation = async (id) => (await apiClient.get(`/assistant/conversations/${id}`)).data.data.conversation;
export const createConversation = async (companyId) => (await apiClient.post("/assistant/conversations", companyId === undefined ? {} : { companyId })).data.data.conversation;
export const deleteConversation = async (id) => apiClient.delete(`/assistant/conversations/${id}`);
export const loadMoreRows = async (conversationId, messageId, blockId, { all = false } = {}) => (await apiClient.post(`/assistant/conversations/${conversationId}/messages/${messageId}/blocks/${blockId}/more`, {}, { params: all ? { all: "true" } : {} })).data.data;
export const listAssistantSettings = async () => (await apiClient.get("/assistant/settings")).data.data;
export const updateAssistantSetting = async (scopeKey, patch) => (await apiClient.patch(`/assistant/settings/${scopeKey}`, patch)).data.data.setting;

/** An error with the backend's own message (and status). */
export class AssistantError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * POST a message and read the Server-Sent Events: onEvent({ type: status|tool_start|tool_end, … }).
 * Resolves with { userMessageId, message }. signal aborts (the stop button).
 * axios can't stream in the browser, hence fetch.
 */
export const sendAssistantMessage = (conversationId, body, opts) => streamTurn(`/assistant/conversations/${conversationId}/messages`, body, opts);
/** A confirmed action finished: the assistant is told and continues (same stream). */
export const continueAfterAction = (conversationId, actionId, opts) => streamTurn(`/assistant/conversations/${conversationId}/actions/${actionId}/continue`, {}, opts);

// ── files and confirmation cards (C2) ─────────────────────────────────────────
/** Files for a conversation, with upload progress (0–1). → [attachment] */
export async function uploadAttachments(conversationId, files, { companyId, onProgress } = {}) {
  const fd = new FormData();
  if (companyId !== undefined) fd.append("companyId", companyId ?? "all");
  for (const f of files) fd.append("files", f);
  const res = await apiClient.post(`/assistant/conversations/${conversationId}/attachments`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  });
  return res.data.data.attachments;
}
export const approveAction = async (id) => (await apiClient.post(`/assistant/actions/${id}/approve`)).data.data.action;
export const cancelAction = async (id) => (await apiClient.post(`/assistant/actions/${id}/cancel`)).data.data.action;
/** → { action, task } — a running card's job, from its background task */
export const getActionProgress = async (id) => (await apiClient.get(`/assistant/actions/${id}`)).data.data;

async function streamTurn(path, body, { onEvent = () => {}, signal } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json())?.message || message;
    } catch {
      /* not JSON: keep the status line */
    }
    throw new AssistantError(message, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = /^event: (.+)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!event || data === undefined) continue;
      const payload = JSON.parse(data);
      if (event === "message") result = payload;
      else if (event === "error") throw new AssistantError(payload.message, payload.statusCode);
      else onEvent(payload);
    }
  }
  if (!result) throw new AssistantError("The answer was cut off.", 0);
  return result;
}

// ── operation drafts ─────────────────────────────────────────────────────────
/** A conversation's drafts (open and closed), each with its card and AI cost so far. */
export const listDrafts = async (conversationId) => (await apiClient.get(`/assistant/conversations/${conversationId}/drafts`)).data.data.drafts;
/** The form card: values the person typed or chose. → the draft (ready → its card is on it) */
export const submitDraftFields = async (draftId, values) => (await apiClient.post(`/assistant/drafts/${draftId}/fields`, { values })).data.data.draft;
export const cancelDraft = async (draftId) => (await apiClient.post(`/assistant/drafts/${draftId}/cancel`, {})).data.data.draft;
/** "Do this step": the prerequisite's fix operation starts as its own draft. → the new draft */
export const startFixDraft = async (draftId, key) => (await apiClient.post(`/assistant/drafts/${draftId}/fix`, { key })).data.data.draft;
/** Refresh an expired card: the same values checked again now. → the new draft */
export const refreshDraft = async (draftId) => (await apiClient.post(`/assistant/drafts/${draftId}/refresh`, {})).data.data.draft;
