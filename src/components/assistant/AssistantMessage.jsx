import { useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Pencil, RotateCcw } from "lucide-react";
import { entityRoute, isArabic } from "../../utils/assistantContext";
import TableBlock from "./TableBlock";
import ActionCard from "./ActionCard";

const size = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const KIND = { "application/pdf": "PDF", "image/png": "PNG", "image/jpeg": "JPG", "image/webp": "WEBP" };

/** A file chip: type, name, size (E2). */
export function FileChip({ file, children }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700" data-testid="file-chip">
      <span className="font-mono text-[10px] font-bold text-red-700">{KIND[file.mimeType] || "FILE"}</span>
      <span className="truncate" dir="auto">{file.name}</span>
      {file.sizeBytes ? <span className="text-gray-500">· {size(file.sizeBytes)}</span> : null}
      {children}
    </span>
  );
}

// One message of the assistant page (E1): user bubble, or the steps the
// assistant took + its answer (markdown with entity links) + the tables its tools
// returned (TableBlock: rows from the system, never typed by the model).

function EntityLink({ href, children }) {
  const hit = /^entity:([a-z_]+)\/([0-9a-fA-F-]{36})$/.exec(href || "");
  const to = hit && entityRoute(hit[1], hit[2]);
  if (!to) return <span>{children}</span>; // the server already turned other links into text; never render one
  return (
    <Link to={to} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
      {children}
    </Link>
  );
}

/** "✓ Read the invoice · INV-1" — expands to its args and a short result. */
export function StepChip({ step }) {
  const [open, setOpen] = useState(false);
  const failed = step.ok === false;
  const mark = step.running ? null : failed ? "✕" : "✓";
  return (
    <div className="inline-flex max-w-full flex-col">
      <button
        type="button"
        data-testid="step-chip"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${failed ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-100 text-gray-700"}`}
      >
        {step.running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <span aria-hidden="true">{mark}</span>}
        <span className="truncate">
          {step.label || step.name}
          {step.summary ? ` · ${step.summary}` : ""}
        </span>
      </button>
      {open && (
        <pre dir="ltr" className="mt-1 max-h-48 max-w-xl overflow-auto whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700">
          {`${step.name}(${JSON.stringify(step.args || {}, null, 2)})`}
          {step.summary ? `\n→ ${step.summary}` : ""}
          {step.error && step.error !== step.summary ? `\n${step.error}` : ""}
          {step.ms !== undefined ? `\n${step.ms} ms` : ""}
        </pre>
      )}
    </div>
  );
}

export function Steps({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="steps">
      {steps.map((s, i) => (
        <StepChip key={i} step={s} />
      ))}
    </div>
  );
}

/** Your message: Edit (change it, then send) or Resend (the same text) — either replaces everything after it. */
function UserMessage({ m, canEdit, onResend }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const startEdit = () => {
    setDraft(m.text);
    setEditing(true);
  };
  const submit = () => {
    if (!draft.trim()) return;
    setEditing(false);
    onResend?.(m, draft);
  };
  return (
    <div className="group flex max-w-[85%] flex-col items-end gap-1.5 self-end" data-testid="user-message">
      {(m.attachments || []).length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {m.attachments.map((a) => (
            <FileChip key={a.id || a.name} file={a} />
          ))}
        </div>
      )}
      {editing ? (
        <form
          className="flex w-[min(560px,80vw)] flex-col gap-2 rounded-[14px] border border-blue-300 bg-white p-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            autoFocus
            data-testid="edit-input"
            aria-label="Edit message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(8, Math.max(2, draft.split("\n").length))}
            dir="auto"
            maxLength={4000}
            className={`w-full resize-none border-0 bg-transparent text-sm outline-none ${isArabic(draft) ? "font-arabic" : ""}`}
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setEditing(false)} className="min-h-8 rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" data-testid="edit-send" disabled={!draft.trim() || !canEdit} className="min-h-8 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
              Send
            </button>
          </div>
        </form>
      ) : (
        <div dir="auto" className={`whitespace-pre-wrap rounded-[14px_14px_4px_14px] bg-blue-600 px-3 py-2 text-sm leading-relaxed text-white ${isArabic(m.text) ? "font-arabic" : ""}`}>
          {m.text}
        </div>
      )}
      {canEdit && !editing && (
        <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={startEdit} data-testid="edit-message" title="Edit and send again" aria-label="Edit message" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onResend?.(m)} data-testid="resend-message" title="Send again" aria-label="Send again" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssistantMessage({ m, onChoose, latest, conversationId, onActionFinished, canEdit = false, onResend }) {
  if (m.role === "event") {
    // what the assistant was told when a confirmed action finished — a quiet line, not a bubble
    const ok = m.text.startsWith("[action finished]");
    return <div className="self-center text-xs text-gray-500" data-testid="event-line">{ok ? "✓ The action finished" : "✕ The action didn't finish"}</div>;
  }
  if (m.role === "user") return <UserMessage m={m} canEdit={canEdit} onResend={onResend} />;
  const choices = latest ? (m.toolCalls || []).findLast((c) => c.choices?.length)?.choices : null;
  return (
    <>
      <Steps steps={m.toolCalls} />
      {m.text && (
        <div dir="auto" data-testid="assistant-answer" className={`self-stretch text-sm leading-relaxed text-gray-900 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5 ${isArabic(m.text) ? "font-arabic" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(u) => u} components={{ a: EntityLink }}>
            {m.text}
          </ReactMarkdown>
        </div>
      )}
      {(m.blocks || []).map((b) => (
        <TableBlock key={b.id} block={b} conversationId={conversationId} messageId={m.id} />
      ))}
      {(m.actions || []).map((a) => (
        <ActionCard key={a.id} action={a} onFinished={onActionFinished} />
      ))}
      {choices && (
        <div className="flex flex-wrap gap-1.5" data-testid="choices">
          {choices.map((c) => (
            <button key={c.id} type="button" onClick={() => onChoose(c)} className="min-h-8 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100" dir="auto">
              {c.name}
              {c.productCode ? ` · ${c.productCode}` : ""}
              {c.company ? ` · ${c.company}` : ""}
            </button>
          ))}
        </div>
      )}
      {m.error && (
        <div role="alert" dir="auto" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {m.error}
        </div>
      )}
    </>
  );
}
