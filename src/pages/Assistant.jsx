import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CloudOff, Paperclip, Settings, Square, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAiStatus } from "../context/AiStatusContext";
import { useAssistantStatus } from "../context/AssistantStatusContext";
import { hasPermission } from "../utils/permissions";
import { parseFrom, entityRoute, pageOf } from "../utils/assistantContext";
import { getCompanies } from "../services/apiCompanies";
import { getInvoice } from "../services/apiInvoices";
import { getCertificate } from "../services/apiCertificatesV2";
import { getCatalogueVersion } from "../services/apiCatalogues";
import { getProductById } from "../services/apiProducts";
import { listConversations, getConversation, createConversation, deleteConversation, sendAssistantMessage, continueAfterAction, uploadAttachments } from "../services/apiAssistant";
import ConversationList from "../components/assistant/ConversationList";
import AssistantMessage, { Steps, FileChip } from "../components/assistant/AssistantMessage";
import AssistantSettings from "../components/assistant/AssistantSettings";
import Spinner from "../ui/Spinner";

// The assistant (design E1): a full page. Read-only in this phase — it reads
// with the signed-in user's own access. Opened from a page (?from=type:id) it
// starts with that page as context, so "this invoice" works.

const errorOf = (e) => e?.response?.data?.message || e?.message || "Something went wrong";

/** A short name for the page the assistant was opened from: "invoice ZYIV25001". */
async function contextLabel({ type, id }) {
  try {
    if (type === "invoice") return `invoice ${(await getInvoice({}, id)).header?.invoiceNumber || ""}`.trim();
    if (type === "certificate") {
      const c = await getCertificate({}, id);
      return `certificate ${[c.certificateType?.code, c.product?.name].filter(Boolean).join(" ")}`.trim();
    }
    if (type === "catalogue") return `catalogue ${(await getCatalogueVersion({}, id)).label || ""}`.trim();
    if (type === "product") return `product ${(await getProductById(id))?.data?.product?.name || ""}`.trim();
  } catch {
    /* no access or gone: the type alone still tells the user what the context is */
  }
  return type;
}

function suggestionsFor(ctx, { isSystem, canCosts }) {
  if (ctx?.type === "invoice") return ["What's still missing on this invoice?", "Which certificates of this invoice are flagged?", "Which lines aren't matched to a product?"];
  if (ctx?.type === "product") return ["What does this product contain?", "Which data is missing on this product?", "Which certificates were made for this product?"];
  if (ctx?.type === "certificate") return ["Where does each value of this certificate come from?", "Which fields of this certificate are flagged?"];
  return [
    "Which products are missing a pH specification?",
    "What's still missing on my last invoice?",
    isSystem ? "How many certificates were generated this week per company?" : "How many certificates were generated this week?",
    ...(canCosts ? ["AI cost this month"] : []),
  ];
}

export default function Assistant() {
  const { user } = useAuth();
  const ai = useAiStatus();
  const { status, loaded } = useAssistantStatus();
  const [params, setParams] = useSearchParams();
  const from = useMemo(() => parseFrom(params.get("from")), [params]);
  const isSystem = !!status?.isSystem;
  const canManage = isSystem && hasPermission(user, "manage_assistant_settings");

  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [scope, setScope] = useState("all");
  const [context, setContext] = useState(null); // { type, id, label } — sent with every message until removed
  const [fromLabel, setFromLabel] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null); // { status, steps } while an answer streams
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [files, setFiles] = useState([]); // { key, name, sizeBytes, mimeType, progress, attachment?, error? }
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const refreshList = useCallback(() => listConversations().then((d) => setConversations(d.conversations || [])).catch((e) => setError(errorOf(e))), []);

  useEffect(() => {
    if (status?.enabled) refreshList();
  }, [status?.enabled, refreshList]);

  useEffect(() => {
    if (!isSystem) return;
    getCompanies({ limit: 1000, sort: "name" }) // every company: the picker must not drop any
      .then((r) => setCompanies(r?.data?.companies || []))
      .catch(() => setCompanies([]));
  }, [isSystem]);

  // opened from a page: that page is the context of a new conversation
  useEffect(() => {
    setFromLabel(null);
    if (!from) {
      setContext(null);
      return;
    }
    setContext({ ...from, label: from.type });
    let alive = true;
    contextLabel(from).then((label) => {
      if (!alive) return;
      setFromLabel(label);
      setContext((c) => (c && c.id === from.id ? { ...c, label } : c));
    });
    return () => {
      alive = false;
    };
  }, [from]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" }); // returns a Promise in newer browsers: never return it as the cleanup
  }, [messages, live]);

  const newConversation = () => {
    abortRef.current?.abort();
    setConversation(null);
    setMessages([]);
    setError(null);
    setShowSettings(false);
    setContext(from ? { ...from, label: fromLabel || from.type } : null);
    inputRef.current?.focus();
  };

  const openConversation = async (id) => {
    setError(null);
    setShowSettings(false);
    try {
      const c = await getConversation(id);
      setConversation(c);
      setMessages(c.messages);
      if (isSystem) setScope(c.companyId || "all");
      const last = [...c.messages].reverse().find((m) => m.role === "user" && m.page?.entityType);
      setContext(last ? { type: last.page.entityType === "catalogue_version" ? "catalogue" : last.page.entityType, id: last.page.entityId, label: last.page.entityType.replace("_", " ") } : null);
    } catch (e) {
      setError(errorOf(e));
    }
  };

  const removeConversation = async (id) => {
    try {
      await deleteConversation(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (conversation?.id === id) newConversation();
    } catch (e) {
      setError(errorOf(e));
    }
  };

  const ensureConversation = async () => {
    if (conversation) return conversation;
    const conv = await createConversation(isSystem ? scope : undefined);
    setConversation(conv);
    return conv;
  };

  // ── files: uploaded as soon as they are picked or dropped, one request each (its own progress) ──
  const ACCEPT = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const MAX_BYTES = 60 * 1024 * 1024;
  const addFiles = async (list) => {
    const picked = [...list];
    if (!picked.length) return;
    setError(null);
    let conv;
    try {
      conv = await ensureConversation();
    } catch (e) {
      setError(errorOf(e));
      return;
    }
    for (const file of picked) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const bad = !ACCEPT.includes(file.type) ? "Attach a PDF, PNG, JPEG or WebP file" : file.size > MAX_BYTES ? "Files are limited to 60 MB" : null;
      setFiles((fs) => [...fs, { key, name: file.name, sizeBytes: file.size, mimeType: file.type, progress: 0, error: bad }]);
      if (bad) continue;
      uploadAttachments(conv.id, [file], { companyId: isSystem ? scope : undefined, onProgress: (p) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, progress: p } : x))) })
        .then(([attachment]) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, progress: 1, attachment } : x))))
        .catch((e) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, error: errorOf(e) } : x))));
    }
  };
  const uploading = files.some((f) => !f.error && !f.attachment);

  const send = (raw) => {
    const body = String(raw ?? text).trim();
    if (!body || busy || uploading) return;
    const ready = files.filter((f) => f.attachment).map((f) => f.attachment);
    if (raw === undefined) setText("");
    setFiles([]);
    runTurn({ id: `local-${Date.now()}`, role: "user", text: body, attachments: ready }, (conv, opts) =>
      sendAssistantMessage(conv.id, { text: body, page: pageOf(context), attachmentIds: ready.map((a) => a.id), ...(isSystem ? { companyId: scope } : {}) }, opts)
    );
  };

  /** A confirmed action finished: the assistant is told and continues. */
  const onActionFinished = (action) => {
    if (!conversation) return;
    runTurn({ id: `event-${action.id}`, role: "event", text: action.status === "done" ? "[action finished]" : "[action failed]" }, (conv, opts) => continueAfterAction(conv.id, action.id, opts));
  };

  const runTurn = async (localMessage, start) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setMessages((ms) => [...ms, localMessage]);
    setLive({ status: "Thinking…", steps: [] });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const conv = await ensureConversation();
      const out = await start(conv, {
        signal: ac.signal,
        onEvent: (e) =>
          setLive((l) => {
            if (!l) return l;
            if (e.type === "status") return { ...l, status: e.text };
            if (e.type === "action") return { ...l, status: "Preparing a card for you to confirm…" };
            if (e.type === "tool_start") return { status: `${e.label}…`, steps: [...l.steps, { name: e.tool, label: e.label, args: e.args, running: true }] };
            if (e.type === "tool_end") {
              const steps = [...l.steps];
              const i = steps.findLastIndex((s) => s.name === e.name && s.running);
              if (i >= 0) steps[i] = { ...e, running: false };
              else steps.push(e);
              return { status: "Reading the results…", steps };
            }
            return l;
          }),
      });
      setMessages((ms) => [...ms, out.message]);
      if (localMessage.role === "user") setConversation((c) => (c ? { ...c, title: c.title || localMessage.text.slice(0, 80) } : c));
      refreshList();
    } catch (e) {
      if (e.name === "AbortError") setMessages((ms) => [...ms, { id: `stop-${Date.now()}`, role: "assistant", text: "", error: "Stopped." }]);
      else {
        setError(errorOf(e));
        if (e.status === 429 || /quota/i.test(e.message || "")) ai.refresh?.();
      }
    } finally {
      setBusy(false);
      setLive(null);
      abortRef.current = null;
    }
  };

  const removeContext = () => {
    setContext(null);
    if (params.get("from") && !conversation) {
      params.delete("from");
      setParams(params, { replace: true });
    }
  };

  if (!loaded) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!status?.enabled) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600" data-testid="assistant-off">
        The assistant isn't switched on for your company yet. A system administrator can enable it.
      </div>
    );
  }

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const title = conversation?.title || "New conversation";
  return (
    <div className="flex h-full min-h-0" data-testid="assistant-page">
      <ConversationList conversations={conversations} activeId={conversation?.id} isSystem={isSystem} onOpen={openConversation} onNew={newConversation} onDelete={removeConversation} />

      <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 flex-none items-center gap-3 border-b border-gray-200 bg-white px-6">
          {from && (
            <>
              <Link to={entityRoute(from.type, from.id)} data-testid="back-link" className="whitespace-nowrap text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline">
                ← Back to {fromLabel || from.type}
              </Link>
              <span aria-hidden="true" className="h-5 w-px bg-gray-200" />
            </>
          )}
          <h1 dir="auto" className="m-0 min-w-0 flex-1 truncate text-base font-bold" data-testid="conversation-title">{title}</h1>
          {isSystem ? (
            <label className="flex items-center gap-1.5 text-[13px] text-gray-600">
              Company
              <select data-testid="assistant-scope" value={scope} disabled={busy} onChange={(e) => setScope(e.target.value)} className="min-h-[34px] rounded-lg border border-gray-300 bg-white px-2 text-[13px] font-semibold text-gray-900">
                <option value="all">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-[13px] text-gray-600" data-testid="assistant-company">
              Company: <b className="text-gray-900">{status.company?.name}</b>
            </span>
          )}
          {canManage && (
            <button type="button" title="Assistant settings" aria-label="Assistant settings" onClick={() => setShowSettings((v) => !v)} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 ${showSettings ? "bg-gray-100" : ""}`}>
              <Settings className="h-4 w-4" />
            </button>
          )}
        </header>

        {showSettings ? (
          <AssistantSettings />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-[820px] flex-col gap-4 p-6" data-testid="assistant-messages">
              {!ai.available && (
                <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span><b>AI unavailable.</b> {ai.message}</span>
                </div>
              )}
              {messages.length === 0 && !busy && (
                <p className="mt-10 text-center text-sm text-gray-500">
                  Ask about products, invoices, certificates, labels or reports.
                  <br />
                  <span className="font-arabic" dir="rtl">اسأل عن المنتجات أو الفواتير أو الشهادات أو التقارير.</span>
                </p>
              )}
              {messages.map((m) => (
                <AssistantMessage key={m.id} m={m} conversationId={conversation?.id} onActionFinished={onActionFinished} latest={m === latestAssistant && !busy} onChoose={(c) => send(`I mean ${c.name}${c.productCode ? ` (${c.productCode})` : ""}`)} />
              ))}
              {live && (
                <div className="flex flex-col gap-2" data-testid="assistant-live">
                  <Steps steps={live.steps} />
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" aria-hidden="true" /> {live.status}
                  </div>
                </div>
              )}
              {error && (
                <div role="alert" dir="auto" data-testid="assistant-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>
        )}

        {!showSettings && (
          <div className="flex-none border-t border-gray-200 bg-white">
            <div className="mx-auto flex max-w-[820px] flex-col gap-2 px-6 pb-3.5 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {context && (
                  <span data-testid="context-chip" className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    <span aria-hidden="true">📄</span> Opened from: {context.label}
                    <button type="button" aria-label="Remove page context" onClick={removeContext} className="ms-0.5 cursor-pointer">×</button>
                  </span>
                )}
                {messages.length === 0 &&
                  suggestionsFor(context, { isSystem, canCosts: hasPermission(user, "read_ai_costs") }).map((s) => (
                    <button key={s} type="button" disabled={busy} onClick={() => send(s)} data-testid="suggestion" className="inline-flex cursor-pointer items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200">
                      {s}
                    </button>
                  ))}
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5" data-testid="pending-files">
                  {files.map((f) => (
                    <FileChip key={f.key} file={f}>
                      {f.error ? <span className="text-red-700">· {f.error}</span> : !f.attachment ? <span className="tabular-nums text-blue-700" data-testid="upload-progress">· {Math.round(f.progress * 100)}%</span> : null}
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))} className="ms-0.5 text-gray-500 hover:text-gray-900">
                        <X className="h-3 w-3" />
                      </button>
                    </FileChip>
                  ))}
                </div>
              )}
              <form
                data-testid="composer"
                className={`flex items-end gap-2 rounded-xl border bg-white p-2 focus-within:border-blue-500 ${dragging ? "border-dashed border-blue-400 bg-blue-50/40" : "border-gray-300"}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                onDragOver={(e) => {
                  if (![...e.dataTransfer.types].includes("Files")) return;
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  if (!e.dataTransfer.files?.length) return;
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" data-testid="file-input" onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }} />
                <button type="button" aria-label="Attach files" title="Attach invoice, catalogue, label, template or lab report" onClick={() => fileInputRef.current?.click()} data-testid="attach" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600">
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  ref={inputRef}
                  data-testid="assistant-input"
                  aria-label="Message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  dir="auto"
                  maxLength={4000}
                  placeholder="Ask, or drop a file here — invoice, catalogue, label, lab report…"
                  className="flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} data-testid="assistant-stop" aria-label="Stop" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-gray-800 text-white hover:bg-gray-700">
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="submit" data-testid="assistant-send" aria-label="Send" disabled={!text.trim() || uploading} className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                )}
              </form>
              <div className="text-[11px] text-gray-500">Every change asks you first. PDF, PNG, JPEG, WebP · up to 60 MB. The assistant never fills lab results, batch numbers or dates on its own.</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
