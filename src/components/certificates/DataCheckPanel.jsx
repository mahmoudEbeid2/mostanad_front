import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Check, ChevronDown, ChevronRight, FlaskConical, RotateCcw, Sparkles, X } from "lucide-react";
import Spinner from "../../ui/Spinner";
import { addDictionarySynonym, decideDataNeeds, getDataCheck, runDataCheck } from "../../services/apiInvoices";

// "Certificate data check" (backend plan.md §6.2, A2): every value the
// certificates about to be generated need, what code read, what the AI found
// WITH evidence (verified by the server), and what is still missing. Lab
// results (batch data) are typed once per line, whatever the number of
// certificate types that print them. Generation is blocked by the parent while
// `summary.blocking` > 0.
const STR = {
  title: "Certificate data check",
  checking: "Checking what the certificates need…",
  failed: "The data check failed:",
  retry: "Try again",
  summary: (s) => `${s.certificates} certificate${s.certificates === 1 ? "" : "s"} · ${s.values} values · ${s.ready} ready · ${s.needsConfirmation} need confirmation · ${s.missing} missing`,
  allSet: "Every required value is ready.",
  aiFound: (a) => `AI looked for ${a.asked} missing value${a.asked === 1 ? "" : "s"} in the invoice and your product data and found ${a.filled}, each with evidence the server checked word for word.`,
  aiRefused: (n) => `${n} AI answer${n === 1 ? " was" : "s were"} refused because the evidence didn't check out.`,
  aiOff: (reason) => `AI unavailable (${reason}) — fill the missing values by hand.`,
  batchTitle: "Lab results for this shipment",
  batchHint: "These change per batch and aren't stored anywhere. Type each once — every certificate of that line uses it.",
  line: (b) => `Line ${b.lineNo ?? "?"} · ${b.productName || "—"}${b.batchNo ? ` · batch ${b.batchNo}` : ""}`,
  saveLine: "Save",
  showAll: "Show all values",
  showOpen: "Only what needs attention",
  certHeader: (c) => `${c.typeCode || c.typeName || "Certificate"} · ${c.scope === "per_invoice" ? `whole invoice (lines ${c.lineNos.join(", ")})` : `line ${c.lineNos[0]} · ${c.productName || ""}${c.batchNo ? ` · ${c.batchNo}` : ""}`}`,
  open: (n) => `${n} open`,
  accept: "Accept",
  reject: "Reject",
  edit: "Edit",
  override: "Override",
  reset: "Reset",
  save: "Save",
  cancel: "Cancel",
  forLine: "Use for all certificates of this line",
  synonym: "Add as synonym for all products",
  synonymDone: "Synonym added — this key is read for every product from now on.",
  unassigned: (u) => `Line ${u.lineNo}${u.name ? ` (${u.name})` : ""} gets no certificate, so nothing is checked for it.`,
  status: { resolved: "ready", resolved_ai: "AI ✓", provided: "typed", needs_confirmation: "confirm", missing: "missing", not_applicable: "optional, empty" },
  source: {
    manual: "Typed by you",
    static: "Fixed text",
    today: "Issue date",
    template: "Combination",
  },
  aiValue: (c) => `AI ${Math.round((c ?? 0) * 100)}%`,
  placeholder: "Type the value",
};
const OPEN = new Set(["missing", "needs_confirmation"]);
const STATUS_STYLE = {
  resolved: "bg-emerald-50 text-emerald-700",
  resolved_ai: "bg-emerald-50 text-emerald-700",
  provided: "bg-blue-50 text-blue-700",
  needs_confirmation: "bg-amber-50 text-amber-800",
  missing: "bg-red-50 text-red-700",
  not_applicable: "bg-gray-100 text-gray-500",
};

const ROOTS = { product: "Product", item: "Invoice line", invoice: "Invoice", company: "Company", brand: "Brand" };
/** product.specifications.values["pH"] → "Product › Specifications › pH" */
function pathLabel(path) {
  if (!path) return "";
  const [root, ...rest] = String(path).split(/\.(?![^[]*\])/);
  const parts = rest
    .join(".")
    .split(/\.(?![^[]*\])|(?=\[)/)
    .map((s) => s.replace(/^\["(.*)"\]$/, "$1").replace(/^\[(\w+)="(.*)"\]$/, "[$2]").replace(/^\[(\d+)\]$/, (_m, i) => `#${Number(i) + 1}`))
    .filter((s) => s && s !== "values")
    .map((s) => (/^[a-z]/.test(s) ? s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()) : s));
  return [ROOTS[root] || root, ...parts].join(" › ");
}

/** A chip saying where a value came from; invoice quotes open the passage, highlighted. */
function SourceChip({ need, textContent }) {
  const [open, setOpen] = useState(false);
  const p = need.provenance;
  if (!p) return null;
  if (p.kind === "invoice_text") {
    const ctx = textContent && Number.isInteger(p.start) ? { before: textContent.slice(Math.max(0, p.start - 160), p.start), hit: textContent.slice(p.start, p.end), after: textContent.slice(p.end, p.end + 160) } : null;
    return (
      <span className="block">
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full bg-violet-50 text-violet-800 px-2 py-0.5 text-xs hover:bg-violet-100 text-left" title="Show it in the invoice text">
          Invoice p.{p.page}: “{p.quote}”
        </button>
        {open && ctx && (
          <span className="mt-1 block whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px] text-gray-600" data-testid="evidence-context">
            …{ctx.before}
            <mark className="bg-yellow-200 text-gray-900">{ctx.hit}</mark>
            {ctx.after}…
          </span>
        )}
      </span>
    );
  }
  let text;
  if (p.kind === "path" || p.kind === "product_path") text = pathLabel(p.path) + (p.via === "synonym" ? " (synonym)" : "");
  else if (p.kind === "product_json_text") text = `${pathLabel(p.path)}: “${p.quote}”`;
  else text = STR.source[p.kind] || p.kind;
  return <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">{text}</span>;
}

function NeedRow({ need, editable, canSynonym, textContent, onDecide, onSynonym }) {
  const [editing, setEditing] = useState(need.status === "missing");
  const [draft, setDraft] = useState(need.value ?? "");
  const [forLine, setForLine] = useState(true);
  useEffect(() => {
    setEditing(need.status === "missing");
    setDraft(need.value ?? "");
  }, [need.status, need.value]);
  const ai = ["needs_confirmation", "resolved_ai"].includes(need.status) && need.provenance?.suggestionId;
  const save = () => onDecide([{ needId: need.id, action: "edit", value: draft, ...(forLine && need.category === "batch_data" ? { applyTo: "line" } : {}) }]);
  return (
    <div className={`px-3 py-2.5 space-y-1.5 ${OPEN.has(need.status) && need.required ? "bg-amber-50/40" : ""}`} data-need={need.fieldKey} data-status={need.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-800 min-w-36">
          {need.label}
          {!need.required && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[need.status] || ""}`}>{STR.status[need.status] || need.status}</span>
        {ai && <span className="text-[11px] text-violet-700 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {STR.aiValue(need.provenance.confidence)}</span>}
        {!editing && need.display && <span className="font-mono text-sm text-gray-900">{need.display}</span>}
      </div>
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <SourceChip need={need} textContent={textContent} />
          {need.provenance?.note && <span className="text-xs text-gray-500">{need.provenance.note}</span>}
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && draft.trim() && save()}
                placeholder={STR.placeholder}
                aria-label={need.label}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-56"
              />
              <button type="button" disabled={!draft.trim()} onClick={save} className="text-sm font-medium text-blue-600 hover:underline disabled:text-gray-300">
                {STR.save}
              </button>
              {need.category === "batch_data" && (
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input type="checkbox" checked={forLine} onChange={(e) => setForLine(e.target.checked)} /> {STR.forLine}
                </label>
              )}
              {need.status !== "missing" && (
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">
                  {STR.cancel}
                </button>
              )}
            </>
          ) : (
            <>
              {need.status === "needs_confirmation" && (
                <button type="button" onClick={() => onDecide([{ needId: need.id, action: "accept" }])} className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-700">
                  <Check className="w-3.5 h-3.5" /> {STR.accept}
                </button>
              )}
              {ai && (
                <button type="button" onClick={() => onDecide([{ needId: need.id, action: "reject" }])} className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                  <X className="w-3.5 h-3.5" /> {STR.reject}
                </button>
              )}
              <button type="button" onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
                {need.status === "resolved" ? STR.override : STR.edit}
              </button>
              {need.status === "provided" && (
                <button type="button" onClick={() => onDecide([{ needId: need.id, action: "reset" }])} className="flex items-center gap-1 text-xs text-gray-500 hover:underline">
                  <RotateCcw className="w-3 h-3" /> {STR.reset}
                </button>
              )}
              {canSynonym && need.provenance?.nearMiss && !/\[\d+\]/.test(need.provenance.nearMiss.alternative) && (
                <button type="button" onClick={() => onSynonym(need.provenance.nearMiss)} className="text-xs text-violet-700 hover:underline" title={`${pathLabel(need.provenance.nearMiss.alternative)} = ${pathLabel(need.provenance.nearMiss.canonical)}`}>
                  {STR.synonym}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Lab results: one input per line and label (plan.md §6.2 batch-data form). */
function BatchDataForm({ batchData, editable, onDecide }) {
  const [drafts, setDrafts] = useState({});
  if (!batchData.length) return null;
  const key = (b, f) => `${b.invoiceItemId}|${f.labelKey}`;
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3" data-testid="batch-data-form">
      <div>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600" /> {STR.batchTitle}
        </h3>
        <p className="text-xs text-gray-600">{STR.batchHint}</p>
      </div>
      {batchData.map((b) => {
        const changed = b.fields.filter((f) => (drafts[key(b, f)] ?? "").trim() && drafts[key(b, f)].trim() !== (f.value ?? ""));
        return (
          <div key={b.invoiceItemId} className="rounded-lg bg-white border border-gray-200 p-3 space-y-2" data-batch-line={b.lineNo}>
            <p className="text-sm font-medium text-gray-800">{STR.line(b)}</p>
            <div className="flex flex-wrap items-end gap-3">
              {b.fields.map((f) => (
                <label key={f.labelKey} className="text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    {f.label}
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${STATUS_STYLE[f.status] || ""}`}>{STR.status[f.status] || f.status}</span>
                  </span>
                  <input
                    value={drafts[key(b, f)] ?? f.value ?? ""}
                    disabled={!editable}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key(b, f)]: e.target.value }))}
                    aria-label={`Line ${b.lineNo} · ${f.label}`}
                    className={`mt-0.5 block w-32 border rounded-lg px-2 py-1 text-sm text-gray-900 ${f.status === "missing" && f.required ? "border-red-300" : "border-gray-300"}`}
                  />
                </label>
              ))}
              {editable && (
                <button
                  type="button"
                  disabled={!changed.length}
                  onClick={async () => {
                    await onDecide(changed.flatMap((f) => f.needIds.map((needId) => ({ needId, action: "edit", value: drafts[key(b, f)].trim() }))));
                    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(`${b.invoiceItemId}|`))));
                  }}
                  className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {STR.saveLine}
                </button>
              )}
            </div>
            {b.fields.some((f) => f.status === "needs_confirmation") && <p className="text-xs text-amber-700">An AI value below waits for confirmation — accept it there, or type the value here.</p>}
          </div>
        );
      })}
    </div>
  );
}

function CertificateGroup({ cert, showAll, ...rowProps }) {
  const open = cert.needs.filter((n) => OPEN.has(n.status) && n.required).length;
  const [expanded, setExpanded] = useState(open > 0);
  const rows = cert.needs.filter((n) => showAll || OPEN.has(n.status) || n.status === "resolved_ai" || n.status === "provided");
  if (!showAll && !rows.length) return null;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden" data-cert={cert.planKey}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 text-left text-sm">
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="font-medium text-gray-800">{STR.certHeader(cert)}</span>
        {open > 0 && <span className="ml-auto rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">{STR.open(open)}</span>}
      </button>
      {expanded && (
        <div className="divide-y divide-gray-100">
          {rows.map((n) => (
            <NeedRow key={n.id} need={n} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * props: scope, invoiceId, refreshKey (re-run after review edits), editable,
 * canSynonym (update_certificate_templates), textContent (for evidence context), onChange(check)
 */
export default function DataCheckPanel({ scope, invoiceId, refreshKey, editable, canSynonym, textContent, onChange }) {
  const [check, setCheck] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const apply = useCallback(
    (c) => {
      setCheck((prev) => ({ ...c, ai: c.ai ?? prev?.ai }));
      onChange?.(c);
    },
    [onChange]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      apply(editable ? await runDataCheck(scope, invoiceId) : await getDataCheck(scope, invoiceId));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [scope, invoiceId, editable, apply]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const decide = async (decisions) => {
    try {
      apply(await decideDataNeeds(scope, invoiceId, decisions));
    } catch (err) {
      toast.error(err.message);
    }
  };
  const synonym = async (nm) => {
    try {
      await addDictionarySynonym(scope, nm);
      toast.success(STR.synonymDone);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = check?.summary;
  const ai = check?.ai;
  const rowProps = useMemo(() => ({ editable, canSynonym, textContent }), [editable, canSynonym, textContent]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="data-check">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{STR.title}</h2>
        {loading && (
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <Spinner size="sm" /> {STR.checking}
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {STR.failed} {error}
          <button type="button" onClick={load} className="text-blue-600 hover:underline">
            {STR.retry}
          </button>
        </p>
      )}
      {s && (
        <>
          <div className={`rounded-lg px-3 py-2 text-sm ${s.blocking ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`} data-testid="data-check-summary">
            {STR.summary(s)}
            {!s.blocking && <span className="ml-2 font-semibold">{STR.allSet}</span>}
          </div>
          {ai?.unavailable && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">{STR.aiOff(ai.reason)}</p>}
          {ai?.used && (
            <p className="text-xs text-gray-600 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
              <span>
                {STR.aiFound(ai)} {ai.rejected ? STR.aiRefused(ai.rejected) : ""}
              </span>
            </p>
          )}
          <BatchDataForm batchData={check.batchData || []} editable={editable} onDecide={decide} />
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs text-blue-600 hover:underline">
              {showAll ? STR.showOpen : STR.showAll}
            </button>
          </div>
          <div className="space-y-2">
            {check.certificates.map((c) => (
              <CertificateGroup key={c.planKey} cert={c} showAll={showAll} {...rowProps} onDecide={decide} onSynonym={synonym} />
            ))}
          </div>
          {(check.unassigned || []).map((u) => (
            <p key={u.invoiceItemId} className="text-xs text-gray-500">
              {STR.unassigned(u)}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
