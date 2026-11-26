import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import ActionCard from "./ActionCard";
import SourceBadge from "./SourceBadge";
import { isAr } from "../../i18n/lang";

const L = (x, key) => (isAr && x?.[`${key}Ar`]) || x?.[key];

// An operation the assistant is collecting (a draft): what is filled and where each value came
// from, what is still missing, the steps that must happen first, and one form for what only the
// person can answer. When the draft is ready its confirmation card is shown here; nothing runs
// until Run is pressed.

const STATUS = {
  collecting: ["Collecting", "bg-amber-50 text-amber-800"],
  ready: ["Ready for your OK", "bg-blue-50 text-blue-700"],
  confirmed: ["Running", "bg-blue-50 text-blue-700"],
  executed: ["Done", "bg-green-50 text-green-700"],
  cancelled: ["Cancelled", "bg-gray-100 text-gray-600"],
  expired: ["Expired", "bg-gray-100 text-gray-600"],
};

const input = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200";

/** One input of the form card, by the field's type. */
function FieldInput({ field, value, onChange }) {
  if (field.type === "choice") {
    const picked = field.multiple ? value || [] : value;
    const toggle = (v) => {
      if (!field.multiple) return onChange(JSON.stringify(picked) === JSON.stringify(v) ? undefined : v);
      const has = picked.some((x) => JSON.stringify(x) === JSON.stringify(v));
      onChange(has ? picked.filter((x) => JSON.stringify(x) !== JSON.stringify(v)) : [...picked, v]);
    };
    const isOn = (v) => (field.multiple ? picked.some((x) => JSON.stringify(x) === JSON.stringify(v)) : JSON.stringify(picked) === JSON.stringify(v));
    // a long list (countries) is a select, not a wall of buttons
    if (!field.multiple && (field.options || []).length > 8) {
      return (
        <select aria-label={field.label} value={picked === undefined ? "" : JSON.stringify(picked)} onChange={(e) => onChange(e.target.value ? JSON.parse(e.target.value) : undefined)} dir="auto" className={input}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={JSON.stringify(o.value)} value={JSON.stringify(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={field.label}>
        {(field.options || []).map((o) => (
          <button key={JSON.stringify(o.value)} type="button" aria-pressed={isOn(o.value)} onClick={() => toggle(o.value)} data-testid="draft-choice" dir="auto" className={`min-h-8 rounded-xl border px-3 text-xs font-semibold ${isOn(o.value) ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
            {o.label}
          </button>
        ))}
        {!(field.options || []).length && <span className="text-xs text-gray-500">Tell the assistant in the chat.</span>}
      </div>
    );
  }
  if (field.type === "ingredients" || field.type === "changes") {
    const [a, b, la, lb] = field.type === "ingredients" ? ["name", "concentration", "Ingredient", "Concentration"] : ["field", "value", "Field", "New value"];
    const rows = value?.length ? value : [{ [a]: "", [b]: "" }];
    const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    return (
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            {field.fieldOptions?.length ? (
              // the fields this operation may change, labelled in Arabic and English — never free text
              <select aria-label={`${la} ${i + 1}`} value={r[a] || ""} onChange={(e) => set(i, a, e.target.value)} dir="auto" className={input}>
                <option value="">{la}…</option>
                {field.fieldOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input aria-label={`${la} ${i + 1}`} placeholder={la} value={r[a] || ""} onChange={(e) => set(i, a, e.target.value)} dir="auto" className={input} />
            )}
            <input aria-label={`${lb} ${i + 1}`} placeholder={lb} value={r[b] || ""} onChange={(e) => set(i, b, e.target.value)} dir="auto" className={input} />
            {rows.length > 1 && (
              <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => onChange([...rows, { [a]: "", [b]: "" }])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
          <Plus className="h-3 w-3" /> Add a row
        </button>
      </div>
    );
  }
  if (field.type === "list") return <textarea aria-label={field.label} rows={3} placeholder="One per line" value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} dir="auto" className={input} />;
  if (field.type === "boolean") return <input type="checkbox" aria-label={field.label} checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />;
  if (field.type === "text" || field.type === "number") return <input aria-label={field.label} type={field.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)} dir="auto" className={input} />;
  return <span className="text-xs text-gray-500">Tell the assistant in the chat.</span>;
}

/** What the form sends: empty rows and blank text left out. */
function cleaned(field, v) {
  if (v === undefined || v === null || v === "") return undefined;
  if (field.type === "ingredients" || field.type === "changes") {
    const rows = v.filter((r) => Object.values(r).some((x) => String(x || "").trim())).map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, String(x || "").trim()]).filter(([, x]) => x)));
    return rows.length ? rows : undefined;
  }
  if (field.type === "list") {
    const items = v.map((x) => x.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  return typeof v === "string" ? v.trim() || undefined : v;
}

const LINE_ACTIONS = [
  ["match", "ربط بالمنتج / Match"],
  ["create", "منتج جديد / New product"],
  ["ignore", "تجاهل / Ignore"],
];

/** match_invoice_lines: change what happens to each line before pressing the one button. */
function LinesEditor({ draft, onSubmit }) {
  const lines = draft.fields.find((f) => f.name === "lines")?.value || [];
  const [rows, setRows] = useState(null);
  if (!lines.length) return null;
  const cur = rows || lines;
  const save = async () => {
    try {
      await onSubmit(draft.id, { lines: cur });
      setRows(null);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };
  return (
    <details className="rounded-lg border border-gray-200 px-3 py-2 text-[13px]" data-testid="lines-editor">
      <summary className="cursor-pointer font-semibold text-gray-700">تعديل السطور / Change lines</summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {cur.map((r, i) => (
          <label key={r.lineNo} className="flex items-center gap-2">
            <span className="w-16 flex-none text-gray-500">#{r.lineNo}</span>
            <select value={r.action} onChange={(e) => setRows(cur.map((x, j) => (j === i ? { ...x, action: e.target.value } : x)))} className={input} aria-label={`Line ${r.lineNo}`}>
              {LINE_ACTIONS.filter(([k]) => k !== "match" || r.productId).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
        {rows && (
          <button type="button" onClick={save} className="min-h-8 w-fit rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white">
            حفظ / Save
          </button>
        )}
      </div>
    </details>
  );
}

export default function DraftCard({ draft, onSubmit, onCancel, onStep, onRefresh, onActionFinished, onActionDecided }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [statusLabel, statusClass] = STATUS[draft.status] || STATUS.collecting;
  const open = draft.status === "collecting" || draft.status === "ready";
  const filled = draft.fields.filter((f) => f.value !== undefined && f.value !== null);
  const ask = draft.status === "collecting" ? draft.ask || [] : [];
  const toFind = draft.status === "collecting" ? draft.toFind || [] : [];

  const submit = async (e) => {
    e.preventDefault();
    const out = Object.fromEntries(ask.map((f) => [f.name, cleaned(f, values[f.name])]).filter(([, v]) => v !== undefined));
    // a row with a value but no field (or a field the operation doesn't have) is said, never dropped silently
    const halfRow = ask.find((f) => f.type === "changes" && (values[f.name] || []).some((r) => String(r.value || "").trim() && (!r.field || (f.fieldOptions && !f.fieldOptions.some((o) => o.value === r.field)))));
    if (halfRow) return toast.error("اختر الحقل لكل قيمة / Pick the field for each value");
    if (!Object.keys(out).length) return toast.error("املأ حقلاً واحداً على الأقل / Fill in at least one field");
    setBusy(true);
    try {
      await onSubmit(draft.id, out);
      setValues({});
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label={`Operation: ${draft.title}`} data-testid="draft-card" data-status={draft.status} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass}`}>{statusLabel}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold" dir="auto">{L(draft, "title")}</span>
        {draft.companyName && <span className="truncate text-xs text-gray-500">{draft.companyName}</span>}
        {open && (
          <button type="button" onClick={() => onCancel(draft.id)} data-testid="draft-cancel" className="text-xs font-semibold text-gray-500 hover:text-gray-900 hover:underline">
            Cancel
          </button>
        )}
      </div>

      {/* while its card waits for Run, the card lists the values (with their sources) */}
      {filled.length > 0 && !(draft.status === "ready" && draft.action?.status === "pending") && (
        <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[13px]" data-testid="draft-filled">
          {filled.map((f) => (
            <div key={f.name} className="contents">
              <dt className="text-gray-500">{L(f, "label")}</dt>
              <dd className="m-0 flex min-w-0 flex-col gap-0.5">
                <span className="flex items-start gap-1.5">
                  <span className="min-w-0 break-words" dir="auto">{f.display ?? String(f.value)}</span>
                  <SourceBadge source={f.source} evidence={f.evidence} />
                </span>
                {f.error && <span className="text-xs text-red-700">{f.error}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(draft.blockedBy || []).length > 0 && draft.status === "collecting" && (
        <div className="flex flex-col gap-1.5" data-testid="draft-blocked">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">First</div>
          {draft.blockedBy.map((b) => (
            <div key={b.key} className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="min-w-0 text-[13px]">
                <div className="font-semibold text-amber-900">{b.label}</div>
                <div className="text-amber-800" dir="auto">{b.detail}</div>
              </div>
              {b.fix?.length > 0 ? (
                <button type="button" onClick={() => onStep(draft.id, b.key)} data-testid="draft-step" className="min-h-8 flex-none rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                  Do this step
                </button>
              ) : (
                <span className="flex-none text-xs text-amber-800">On its page</span>
              )}
            </div>
          ))}
        </div>
      )}

      {toFind.length > 0 && <div className="text-xs text-gray-500">The assistant is looking up: {toFind.map((f) => f.label).join(", ")}</div>}

      {ask.length > 0 && (
        <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-lg border border-blue-200 bg-blue-50/40 px-3 py-3" data-testid="draft-form">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-800">Needed from you</div>
          {ask.map((f) => (
            <div key={f.name} role="group" aria-labelledby={`draft-${draft.id}-${f.name}`} className="flex flex-col gap-1 text-[13px]">
              <span id={`draft-${draft.id}-${f.name}`} className="font-semibold text-gray-800">{L(f, "label")}</span>
              <FieldInput field={f} value={values[f.name]} onChange={(v) => setValues((x) => ({ ...x, [f.name]: v }))} />
              {f.error && <span className="text-xs text-red-700">{f.error}</span>}
            </div>
          ))}
          <button type="submit" disabled={busy} data-testid="draft-submit" className="min-h-9 w-fit rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {draft.error && draft.status === "collecting" && (
        <div role="alert" dir="auto" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {draft.error}
        </div>
      )}
      {draft.status === "expired" && (
        <div className="flex items-center justify-between gap-3 text-[13px] text-gray-600" data-testid="draft-expired">
          <span dir="auto">{draft.error || "Expired"}</span>
          {onRefresh && (
            <button type="button" onClick={() => onRefresh(draft.id)} data-testid="draft-refresh" className="min-h-8 flex-none rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50">
              تحديث / Refresh
            </button>
          )}
        </div>
      )}

      {/* an expired draft's card can't run: no buttons, only Refresh above */}
      {draft.action && draft.status !== "expired" && <ActionCard key={draft.action.id} action={draft.action} onFinished={onActionFinished} onDecided={onActionDecided} />}
      {draft.tool === "match_invoice_lines" && draft.status === "ready" && draft.action?.status === "pending" && <LinesEditor draft={draft} onSubmit={onSubmit} />}
      {draft.costUsd !== null && draft.costUsd !== undefined && draft.aiCalls > 0 && (
        <div className="text-[11px] text-gray-500">
          {draft.aiCalls} AI call{draft.aiCalls === 1 ? "" : "s"} · ${draft.costUsd.toFixed(4)}
        </div>
      )}
    </div>
  );
}
