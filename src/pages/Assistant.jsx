import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CloudOff, Paperclip, Settings, Square, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAiStatus } from "../context/AiStatusContext";
import { useAssistantStatus } from "../context/AssistantStatusContext";
import { hasPermission } from "../utils/permissions";
import { parseFrom, entityRoute, pageOf, isArabic } from "../utils/assistantContext";
import { getCompanies } from "../services/apiCompanies";
import { getInvoice } from "../services/apiInvoices";
import { getCertificate } from "../services/apiCertificatesV2";
import { getCatalogueVersion } from "../services/apiCatalogues";
import { getProductById } from "../services/apiProducts";
import { listConversations, getConversation, createConversation, deleteConversation, sendAssistantMessage, continueAfterAction, uploadAttachments, bindAttachments, listDrafts, submitDraftFields, cancelDraft, startFixDraft, refreshDraft } from "../services/apiAssistant";
import ConversationList from "../components/assistant/ConversationList";
import AssistantMessage, { Steps, FileChip } from "../components/assistant/AssistantMessage";
import DraftCard from "../components/assistant/DraftCard";
import AssistantSettings from "../components/assistant/AssistantSettings";
import Spinner from "../ui/Spinner";
import { guessCompanyName, normName } from "../utils/companyGuess";
import { tr } from "../i18n/lang";

// The assistant (design E1): a full page. Read-only in this phase — it reads
// with the signed-in user's own access. Opened from a page (?from=type:id) it
// starts with that page as context, so "this invoice" works.

const MAX_TEXT = 4000;
const MAX_INPUT_PX = 220;

const byId = (list) => Object.fromEntries((list || []).map((d) => [d.id, d]));

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
  const [files, setFiles] = useState([]); // { key, name, sizeBytes, mimeType, progress, file, attachment?, error?, bad? }
  // a send that is waiting on the person: { kind: "failed" | "company", text } (see send)
  const [held, setHeld] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [drafts, setDrafts] = useState({}); // id → operation draft (the cards that collect an operation)
  const [liveDraftIds, setLiveDraftIds] = useState([]); // drafts touched by the answer that is streaming
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // the message box grows with what is typed (up to MAX_INPUT_PX, then it scrolls)
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, MAX_INPUT_PX)}px`;
    box.style.overflowY = box.scrollHeight > MAX_INPUT_PX ? "auto" : "hidden";
  }, [text, showSettings]);

  const refreshList = useCallback(() => listConversations().then((d) => setConversations(d.conversations || [])).catch((e) => setError(errorOf(e))), []);

  useEffect(() => {
    if (status?.enabled) refreshList();
  }, [status?.enabled, refreshList]);

  // every company: the picker must not drop any. Reloaded after a confirmed card ran (create_company)
  const loadCompanies = useCallback(() => {
    if (!isSystem) return;
    getCompanies({ limit: 1000, sort: "name" })
      .then((r) => setCompanies(r?.data?.companies || []))
      .catch(() => setCompanies([]));
  }, [isSystem]);
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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

  // typing anywhere on the page goes into the message box (unless another field has focus)
  useEffect(() => {
    const onKey = (e) => {
      const box = inputRef.current;
      if (!box || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const el = document.activeElement;
      if (el === box || (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)))) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      e.preventDefault();
      setText((t) => (t + e.key).slice(0, MAX_TEXT));
      box.focus();
      requestAnimationFrame(() => box.setSelectionRange(box.value.length, box.value.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const newConversation = () => {
    abortRef.current?.abort();
    setConversation(null);
    setMessages([]);
    setDrafts({});
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
      setDrafts(byId(c.drafts));
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
      setFiles((fs) => [...fs, { key, name: file.name, sizeBytes: file.size, mimeType: file.type, progress: 0, file, error: bad, bad: !!bad }]);
      if (bad) continue;
      upload(conv.id, key, file);
    }
  };
  // one file: in "All companies" it is kept in the conversation and gets its company when the message is sent
  const upload = (conversationId, key, file, companyId = isSystem ? scope : undefined) => {
    setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, progress: 0, error: null } : x)));
    return uploadAttachments(conversationId, [file], { companyId, onProgress: (p) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, progress: p } : x))) })
      .then(([attachment]) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, progress: 1, attachment } : x))))
      .catch((e) => setFiles((fs) => fs.map((x) => (x.key === key ? { ...x, error: errorOf(e) } : x))));
  };
  const retryFailed = (companyId) => {
    if (!conversation) return;
    files.filter((f) => f.error && !f.bad && f.file).forEach((f) => upload(conversation.id, f.key, f.file, companyId));
  };
  // a company was picked: files that failed to attach are tried again, in that company
  useEffect(() => {
    if (isSystem && scope !== "all") retryFailed(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const uploading = files.some((f) => !f.error && !f.attachment);
  const failedFiles = files.filter((f) => f.error);

  /**
   * Never sends past a file the person may think is attached: while one is
   * uploading the send waits (and says so); a failed one is named and the person
   * retries, removes it or sends without it; files attached in "All companies"
   * first get their company (chips), then the message goes in that company.
   */
  const send = (raw, { skipFailed = false, companyId = null, fromComposer = raw === undefined, unbound: sendUnbound = false } = {}) => {
    const body = String(raw ?? text).trim();
    // files alone can be sent (27 Nov QA): the server words such a message itself
    const withFiles = files.length > 0;
    if ((!body && !withFiles) || busy) return;
    if (uploading) {
      setHeld({ kind: "uploading", text: body, fromComposer });
      return;
    }
    if (failedFiles.length && !skipFailed) {
      setHeld({ kind: "failed", text: body, fromComposer });
      return;
    }
    const ready = files.filter((f) => f.attachment).map((f) => f.attachment);
    const unbound = ready.filter((a) => !a.companyId);
    const msgCompany = companyId || (isSystem ? scope : null);
    if (isSystem && unbound.length && (!msgCompany || msgCompany === "all") && !sendUnbound) {
      // the message or the files name exactly one known company ("لـ ADDVET"): it is that one, no question (27 Nov QA)
      const said = companies.filter((c) => normName(c.name).length >= 3 && normName(body).includes(normName(c.name)));
      const guess = guessCompanyName(files.map((f) => f.name || f.attachment?.name), body);
      const fromFiles = guess ? companies.filter((c) => normName(c.name) === normName(guess)) : [];
      const sure = said.length === 1 ? said[0] : !said.length && fromFiles.length === 1 ? fromFiles[0] : null;
      if (sure) {
        sendForCompany(sure.id, { text: body, fromComposer, skipFailed });
        return;
      }
      setHeld({ kind: "company", text: body, fromComposer, skipFailed });
      return;
    }
    setHeld(null);
    if (fromComposer) setText("");
    setFiles([]);
    runTurn({ id: `local-${Date.now()}`, role: "user", text: body, attachments: ready }, (conv, opts) =>
      sendAssistantMessage(conv.id, { text: body, page: pageOf(context), attachmentIds: ready.map((a) => a.id), ...(isSystem ? { companyId: sendUnbound ? null : msgCompany } : {}) }, opts)
    );
  };
  // "which company are these files for?" → bind them, switch the conversation to it, send
  const sendForCompany = async (companyId, payload = null) => {
    const ready = files.filter((f) => f.attachment).map((f) => f.attachment);
    try {
      const bound = await bindAttachments(conversation.id, ready.map((a) => a.id), companyId);
      setFiles((fs) => fs.map((f) => (f.attachment ? { ...f, attachment: bound.find((b) => b.id === f.attachment.id) || f.attachment } : f)));
      setScope(companyId);
      const { text: body, fromComposer, skipFailed } = payload || held || {};
      setHeld(null);
      // the bound attachments are read from state on the next render
      setTimeout(() => sendRef.current?.(body, { companyId, fromComposer, skipFailed }), 0);
    } catch (e) {
      setError(errorOf(e));
    }
  };
  // "شركة جديدة: X" / "خلّي السيستم يحدد": the files go unbound; the drop's card creates or finds the company
  const sendUnboundWith = (note = null) => {
    const { text: body, fromComposer, skipFailed } = held || {};
    setHeld(null);
    send(note ? `${body}
(${note})` : body, { fromComposer, skipFailed, unbound: true });
  };
  const sendRef = useRef(null);
  sendRef.current = send;
  // the send went through, or the reason it waited is gone: drop the notice
  useEffect(() => {
    if (held?.kind === "uploading" && !uploading) send(held.text, { fromComposer: held.fromComposer });
    if (held?.kind === "failed" && !failedFiles.length) setHeld(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, failedFiles.length]);

  /**
   * Edit (new text) or resend (same text) one of your messages: it and everything after it are
   * replaced by the new turn. The server keeps its files and page.
   */
  const resendFrom = (m, raw = m.text) => {
    const body = String(raw).trim();
    if (!body || busy || !conversation || String(m.id).startsWith("local-")) return;
    runTurn(
      { id: `local-${Date.now()}`, role: "user", text: body, attachments: m.attachments || [] },
      (conv, opts) => sendAssistantMessage(conv.id, { text: body, editOf: m.id, ...(isSystem ? { companyId: scope } : {}) }, opts),
      { replaceFrom: m.id }
    );
  };

  // ── operation drafts ──
  const putDraft = (d) => setDrafts((x) => ({ ...x, [d.id]: d }));
  const refreshDrafts = (conversationId = conversation?.id) => {
    if (!conversationId) return;
    listDrafts(conversationId)
      .then((list) => setDrafts(byId(list)))
      .catch(() => {
        /* the cards keep what they showed; the next answer refreshes them */
      });
  };
  const onDraftSubmit = async (id, values) => putDraft(await submitDraftFields(id, values));
  const onDraftCancel = async (id) => {
    try {
      putDraft(await cancelDraft(id));
    } catch (e) {
      setError(errorOf(e));
    }
  };
  // "Do this step" starts the fix operation's draft directly; Refresh rebuilds an expired card
  const onDraftStep = async (id, key) => {
    try {
      putDraft(await startFixDraft(id, key));
    } catch (e) {
      setError(errorOf(e));
    }
  };
  const onDraftRefresh = async (id) => {
    try {
      putDraft(await refreshDraft(id));
      refreshDrafts();
    } catch (e) {
      setError(errorOf(e));
    }
  };
  const draftProps = { onSubmit: onDraftSubmit, onCancel: onDraftCancel, onStep: onDraftStep, onRefresh: onDraftRefresh, onActionDecided: () => refreshDrafts() };

  /** A confirmed action finished: the assistant is told and continues. */
  const onActionFinished = (action) => {
    loadCompanies(); // a company made by the card shows in the header and the chips right away
    if (!conversation) return;
    runTurn({ id: `event-${action.id}`, role: "event", text: action.status === "done" ? "[action finished]" : "[action failed]" }, (conv, opts) => continueAfterAction(conv.id, action.id, opts));
  };

  const runTurn = async (localMessage, start, { replaceFrom = null } = {}) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    setMessages((ms) => {
      const cut = replaceFrom ? ms.findIndex((x) => x.id === replaceFrom) : -1;
      return [...(cut >= 0 ? ms.slice(0, cut) : ms), localMessage];
    });
    setLive({ status: "Thinking…", steps: [] });
    setLiveDraftIds([]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const conv = await ensureConversation();
      const out = await start(conv, {
        signal: ac.signal,
        onEvent: (e) => {
          if (e.type === "draft") {
            putDraft(e.draft);
            setLiveDraftIds((ids) => (ids.includes(e.draft.id) ? ids : [...ids, e.draft.id]));
          }
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
          });
        },
      });
      // the stored id: what edit / resend point at
      setMessages((ms) => [...ms.map((x) => (x.id === localMessage.id && out.userMessageId ? { ...x, id: out.userMessageId } : x)), out.message]);
      if (localMessage.role === "user") setConversation((c) => (c ? { ...c, title: c.title || localMessage.text.slice(0, 80) } : c));
      refreshList();
      refreshDrafts(conv.id);
    } catch (e) {
      if (e.name === "AbortError") setMessages((ms) => [...ms, { id: `stop-${Date.now()}`, role: "assistant", text: "", error: "Stopped." }]);
      else {
        setError(errorOf(e));
        if (e.status === 429 || /quota/i.test(e.message || "")) ai.refresh?.();
      }
      // an edit that failed may or may not have replaced the old turn: show what the server has
      if (replaceFrom && conversation) getConversation(conversation.id).then((c) => setMessages(c.messages)).catch(() => {
        /* the error above is already shown; opening the conversation again reloads it */
      });
    } finally {
      setBusy(false);
      setLive(null);
      abortRef.current = null;
      // ready for the next question, unless the person moved on to another field
      if (!document.activeElement || document.activeElement === document.body) inputRef.current?.focus();
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
  // each draft's card sits under the last answer that worked on it
  const draftHome = {};
  messages.forEach((m) => (m.toolCalls || []).forEach((c) => c.draftId && (draftHome[c.draftId] = m.id)));
  const draftsOf = (m) => Object.entries(draftHome).filter(([, mid]) => mid === m.id).map(([id]) => drafts[id]).filter(Boolean);
  const openDrafts = Object.values(drafts).filter((d) => d.status === "collecting" || d.status === "ready");
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
              {openDrafts.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5" data-testid="open-drafts">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">In progress</div>
                  {openDrafts.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-[13px]" data-testid="open-draft">
                      <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
                      <span className="text-xs text-gray-500">{d.status === "ready" ? "waiting for your OK" : d.blockedBy.length ? "a step first" : `${d.missing.length} to fill`}</span>
                      <button type="button" disabled={busy} onClick={() => send(`Continue: ${d.title}`)} data-testid="draft-resume" className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">
                        Resume
                      </button>
                      <button type="button" onClick={() => onDraftCancel(d.id)} className="text-xs font-semibold text-gray-500 hover:text-gray-900 hover:underline">
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {messages.map((m) => (
                <AssistantMessage key={m.id} m={m} conversationId={conversation?.id} onActionFinished={onActionFinished} latest={m === latestAssistant && !busy} canEdit={!busy && !String(m.id).startsWith("local-")} onResend={resendFrom} onChoose={(c) => send(c.say || `I mean ${c.name}${c.pack ? ` ${c.pack}` : ""}${c.productCode ? ` (${c.productCode})` : ""}`)} drafts={draftsOf(m)} draftProps={{ ...draftProps, onActionFinished }} />
              ))}
              {Object.values(drafts)
                .filter((d) => !draftHome[d.id] && !liveDraftIds.includes(d.id) && d.status !== "cancelled" && d.status !== "expired")
                .map((d) => (
                  <DraftCard key={d.id} draft={d} {...draftProps} onActionFinished={onActionFinished} />
                ))}
              {live && (
                <div className="flex flex-col gap-2" data-testid="assistant-live">
                  <Steps steps={live.steps} />
                  {liveDraftIds.filter((id) => !draftHome[id] && drafts[id]).map((id) => (
                    <DraftCard key={id} draft={drafts[id]} {...draftProps} onActionFinished={onActionFinished} />
                  ))}
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
                      {f.error ? (
                        <span className="text-red-700" data-testid="file-error">
                          · {f.error}
                          {!f.bad && f.file && (
                            <button type="button" onClick={() => conversation && upload(conversation.id, f.key, f.file)} className="ms-1 underline">
                              Retry
                            </button>
                          )}
                        </span>
                      ) : !f.attachment ? (
                        <span className="tabular-nums text-blue-700" data-testid="upload-progress">· {Math.round(f.progress * 100)}%</span>
                      ) : !f.attachment.companyId && isSystem ? (
                        <span className="text-amber-700" data-testid="file-needs-company">· company asked on send</span>
                      ) : null}
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))} className="ms-0.5 text-gray-500 hover:text-gray-900">
                        <X className="h-3 w-3" />
                      </button>
                    </FileChip>
                  ))}
                </div>
              )}
              {held && (
                <div role="status" dir="auto" data-testid="send-held" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {held.kind === "uploading" && <span>Waiting for the files to finish uploading — the message is sent as soon as they are attached.</span>}
                  {held.kind === "failed" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {failedFiles.map((f) => f.name).join(", ")} {failedFiles.length === 1 ? "isn't" : "aren't"} attached. Retry or remove {failedFiles.length === 1 ? "it" : "them"}, or send without {failedFiles.length === 1 ? "it" : "them"}.
                      </span>
                      <button type="button" data-testid="send-without-failed" onClick={() => send(held.text, { skipFailed: true, fromComposer: held.fromComposer })} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-semibold hover:bg-amber-100">
                        Send without {failedFiles.length === 1 ? "it" : "them"}
                      </button>
                      <button type="button" onClick={() => setHeld(null)} className="text-xs underline">
                        Cancel
                      </button>
                    </div>
                  )}
                  {held.kind === "company" && (
                    <div className="flex flex-col gap-2" data-testid="pick-company">
                      <span dir="rtl">الملفات دي لأنهي شركة؟</span>
                      <div className="flex flex-wrap gap-1.5" dir="rtl">
                        {(() => {
                          const guess = guessCompanyName(files.map((f) => f.name || f.attachment?.name), held.text);
                          const known = guess && companies.find((c) => normName(c.name) === normName(guess));
                          if (known) return (
                            <button type="button" onClick={() => sendForCompany(known.id)} className="rounded-full border border-blue-500 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800" data-testid="pick-detected">
                              {known.name} (من الملفات)
                            </button>
                          );
                          return guess ? (
                            <button type="button" onClick={() => sendUnboundWith(`شركة جديدة: ${guess}`)} className="rounded-full border border-emerald-400 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800" data-testid="pick-new-company">
                              شركة جديدة: {guess}
                            </button>
                          ) : null;
                        })()}
                        <button type="button" onClick={() => sendUnboundWith()} className="rounded-full border border-violet-300 bg-white px-2.5 py-0.5 text-xs font-medium text-violet-800 hover:bg-violet-50" data-testid="pick-let-system">
                          خلّي السيستم يحدد
                        </button>
                        {companies.slice(0, 12).map((c) => (
                          <button key={c.id} type="button" onClick={() => sendForCompany(c.id)} className="rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                            {c.name}
                          </button>
                        ))}
                        {companies.length > 12 && (
                          <select aria-label="Company for the files" defaultValue="" onChange={(e) => e.target.value && sendForCompany(e.target.value)} className="rounded-full border border-blue-300 bg-white px-2 py-0.5 text-xs">
                            <option value="">More companies…</option>
                            {companies.slice(12).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button type="button" onClick={() => setHeld(null)} className="text-xs underline">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
                    if (e.key === "Escape" && text) {
                      e.preventDefault();
                      setText("");
                    }
                  }}
                  onPaste={(e) => {
                    // a pasted screenshot or file is attached, like a dropped one
                    const pasted = [...(e.clipboardData?.files || [])];
                    if (!pasted.length) return;
                    e.preventDefault();
                    addFiles(pasted);
                  }}
                  rows={1}
                  dir="auto"
                  maxLength={MAX_TEXT}
                  placeholder={tr("اسأل، أو ارمي أو الزق ملف — فاتورة، كتالوج، ليبل، تقرير معمل…", "Ask, or drop or paste a file — invoice, catalogue, label, lab report…")}
                  className={`max-h-[220px] min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-relaxed outline-none placeholder:text-gray-400 ${isArabic(text) ? "font-arabic" : ""}`}
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} data-testid="assistant-stop" aria-label="Stop" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-gray-800 text-white hover:bg-gray-700">
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button type="submit" data-testid="assistant-send" aria-label="Send" disabled={(!text.trim() && !files.length) || uploading} className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                )}
              </form>
              <div className="flex items-start justify-between gap-3 text-[11px] text-gray-500">
                <span>Every change asks you first. PDF, PNG, JPEG, WebP · up to 60 MB. The assistant never fills lab results, batch numbers or dates on its own.</span>
                <span className="flex-none whitespace-nowrap" data-testid="composer-hint">
                  {text.length > MAX_TEXT - 500 ? (
                    <b className={text.length >= MAX_TEXT ? "text-red-700" : "text-amber-700"} data-testid="char-count">{text.length} / {MAX_TEXT}</b>
                  ) : (
                    <>
                      <kbd className="font-sans font-semibold">Enter</kbd> to send · <kbd className="font-sans font-semibold">Shift+Enter</kbd> new line
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
