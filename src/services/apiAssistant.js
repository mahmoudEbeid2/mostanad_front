import apiClient from "./apiClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export const getAssistantStatus = async () => (await apiClient.get("/assistant/status")).data.data;
export const listConversations = async () => (await apiClient.get("/assistant/conversations")).data.data;
export const getConversation = async (id) => (await apiClient.get(`/assistant/conversations/${id}`)).data.data.conversation;
export const createConversation = async (companyId) => (await apiClient.post("/assistant/conversations", companyId === undefined ? {} : { companyId })).data.data.conversation;
export const deleteConversation = async (id) => apiClient.delete(`/assistant/conversations/${id}`);
export const loadMoreRows = async (conversationId, messageId, blockId, { all = false } = {}) => (await apiClient.post(`/assistant/conversations/${conversationId}/messages/${messageId}/blocks/${blockId}/more`, null, { params: all ? { all: "true" } : {} })).data.data;
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
export async function sendAssistantMessage(conversationId, body, { onEvent = () => {}, signal } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/assistant/conversations/${conversationId}/messages`, {
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
