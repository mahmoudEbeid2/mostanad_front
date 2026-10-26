import AiAction from "../../ui/AiAction";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, Globe, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import Spinner from "../../ui/Spinner";
import { addDictionarySynonym, decideDataNeeds, getDataCheck, runDataCheck, webLookup } from "../../services/apiInvoices";
import { withNextStep } from "../../utils/aiReason";
import ResultsGrid from "./ResultsGrid";

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
  nothingYet: "Nothing to check yet — no line is matched to a product with an active template.",
  aiFound: (a) => `AI looked for ${a.asked} missing value${a.asked === 1 ? "" : "s"} in the invoice and your product data and found ${a.filled}, each with evidence the server checked word for word.`,
  aiRefused: (n) => `${n} AI answer${n === 1 ? " was" : "s were"} refused because the evidence didn't check out.`,
  aiOff: (reason) => withNextStep(reason, "Fill the missing values by hand."),
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
  status: { resolved: "ready", resolved_ai: "AI ✓", provided: "typed", needs_confirmation: "confirm", missing: "missing", not_applicable: "optional, empty", inferred: "inferred — confirm", web_found: "from web — confirm", catalogue_found: "from catalogue — confirm", reused: "from the product's profile" },
  // A6 (backend plan.md §15.5): the product's own catalogue page, and estimated product values
  catalogueBadge: (p) => `Catalogue p.${p.page}${p.section ? ` · ${p.section.toLowerCase()}` : ""}`,
  catalogueOpen: "Open the page",
  estimatedBadge: "Estimated",
  estimatedHint: "This product value was estimated, not printed in a source — confirm it before it goes on a certificate.",
  confirmOnProduct: "Confirm on the product",
  confirmHint: "Sign for this estimate on the product, so the next invoice uses it without asking",
  // A5 (backend plan.md §14)
  inferredBadge: "Inferred from product data",
  webBadge: "From web",
  derivation: { quoted: "written in the product", unit_conversion: "unit conversion", select_from_list: "picked from a list", join_list: "joined from a list", normalize_case: "letter case" },
  saveToProduct: "Save to product",
  saveHint: "Write the confirmed value into the product, so the next invoice doesn't need to look it up",
  webLookup: (n) => `Look up ${n} missing product fact${n === 1 ? "" : "s"} on the web`,
  webHint: "Only product facts (never lab results, batches, dates or quantities). Every value comes with a link and a quote the server checked on the page.",
  webDone: (w) => (w.unavailable ? withNextStep(w.reason, "Type the missing values by hand.") : `Web lookup: ${w.found} found${w.fromCache ? ` (${w.fromCache} from earlier lookups)` : ""}${w.rejected ? `, ${w.rejected} refused (the cited page didn't check out)` : ""}`),
  inferNote: (i) => `${i.inferred} value${i.inferred === 1 ? "" : "s"} inferred from your product data${i.rejected ? ` (${i.rejected} refused — not provable from the product)` : ""}.`,
  source: {
    manual: "Typed by you",
    static: "Fixed text",
    today: "Issue date",
    template: "Combination",
  },
  aiValue: (c) => `AI ${Math.round((c ?? 0) * 100)}%`,
  placeholder: "Type the value",
};
const OPEN = new Set(["missing", "needs_confirmation", "inferred", "web_found", "catalogue_found"]);
const AWAITING = new Set(["needs_confirmation", "inferred", "web_found", "catalogue_found"]);
// "reused" names where code took it from (item 3 profile, item 4 batch result, the specification)
const statusLabel = (need) => {
  if (need.status !== "reused") return STR.status[need.status] || need.status;
  const p = need.provenance || {};
  if (p.kind === "batch_result") return p.source === "supplier_coa" ? `supplier COA p.${p.page ?? "?"} · batch ${p.batchNo}` : `from batch ${p.batchNo}${p.fromInvoiceNumber ? ` (invoice ${p.fromInvoiceNumber})` : ""}`;
  if (p.kind === "spec_instead") return "prints the specification";
  return STR.status.reused;
};

const STATUS_STYLE = {
  reused: "bg-emerald-50 text-emerald-800",
  resolved: "bg-emerald-50 text-emerald-700",
  resolved_ai: "bg-emerald-50 text-emerald-700",
  provided: "bg-blue-50 text-blue-700",
  needs_confirmation: "bg-amber-50 text-amber-800",
  inferred: "bg-sky-50 text-sky-800",
  web_found: "bg-indigo-50 text-indigo-800",
  catalogue_found: "bg-teal-50 text-teal-800",
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
  const p = need.provenance;
  if (!p) return null;
  // fill automatically (backend item 3): a value from the product's certificate profile shows where it first came from
  if (p.kind === "profile") {
    return (
      <span className="block space-y-0.5" data-testid="from-profile">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 text-xs font-medium" title="Proven or confirmed on an earlier invoice — no AI was asked">
          <Check className="w-3 h-3" /> Product profile{p.confirmedByUserId ? " · confirmed" : ""}{p.estimated ? " · was an estimate" : ""}
        </span>
        {p.from && <SourceChip need={{ provenance: p.from }} textContent={null} />}
      </span>
    );
  }
  return (
    <span className="block space-y-0.5">
      {p.estimated && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-800 px-2 py-0.5 text-xs font-semibold" data-testid="estimate" title={p.estimateBasis || ""}>
          <AlertTriangle className="w-3 h-3" /> Estimated{p.estimateBasis ? `: ${p.estimateBasis}` : ""}
        </span>
      )}
      {p.filled === "direct" && <span className="text-[11px] text-emerald-700">filled directly — quoted verbatim</span>}
      <EvidenceChip need={need} textContent={textContent} />
    </span>
  );
}

function EvidenceChip({ need, textContent }) {
  const [open, setOpen] = useState(false);
  const p = need.provenance;
  if (p.tier === "C") {
    return (
      <span className="block space-y-0.5" data-testid="tier-c">
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 px-2 py-0.5 text-xs font-medium hover:bg-teal-100 text-left">
          <BookOpen className="w-3 h-3" /> {STR.catalogueBadge(p)}: “{String(p.quote || "").replace(/\s+/g, " ").slice(0, 80)}{String(p.quote || "").length > 80 ? "…" : ""}”
        </button>
        {open && (
          <span className="mt-1 block rounded-lg border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-700" data-testid="catalogue-quote">
            <mark className="bg-yellow-200 text-gray-900 whitespace-pre-wrap font-mono">{String(p.quote || "").replace(/\t/g, "   ")}</mark>
            {p.catalogueVersionId && (
              <Link to={`/catalogues/versions/${p.catalogueVersionId}?block=${p.blockId}`} className="mt-1 block text-blue-600 hover:underline">
                {STR.catalogueOpen}
              </Link>
            )}
          </span>
        )}
      </span>
    );
  }
  if (p.tier === "I" && p.kind === "product_estimate") {
    return (
      <span className="block space-y-0.5" data-testid="estimated">
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-800 px-2 py-0.5 text-xs font-semibold" title={STR.estimatedHint}>
          <AlertTriangle className="w-3 h-3" /> {STR.estimatedBadge} · {pathLabel(`product.${p.path}`)}
        </span>
        {p.basis && <span className="block text-[11px] text-gray-500">{p.basis}</span>}
      </span>
    );
  }
  if (p.tier === "I") {
    return (
      <span className="block space-y-0.5" data-testid="tier-i">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-800 px-2 py-0.5 text-xs font-medium">
          <Lightbulb className="w-3 h-3" /> {STR.inferredBadge} · {STR.derivation[p.derivationKind || p.derivation] || p.derivation}
        </span>
        {(p.evidence || []).map((e, i) => (
          <span key={i} className="block text-[11px] text-gray-600">
            {pathLabel(e.path)}
            {e.quote ? `: “${e.quote}”` : ""}
          </span>
        ))}
        {p.reasoning && <span className="block text-[11px] text-gray-400">{p.reasoning}</span>}
      </span>
    );
  }
  if (p.tier === "W") {
    return (
      <span className="block space-y-0.5" data-testid="tier-w">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-800 px-2 py-0.5 text-xs font-medium">
          <Globe className="w-3 h-3" /> {STR.webBadge} · {p.sourceType?.replace("_", " ")}
        </span>
        {(p.citations || []).map((c, i) => (
          <span key={i} className="block text-[11px] text-gray-600">
            <a href={c.finalUrl || c.url} target="_blank" rel="noreferrer noopener" className="text-blue-600 hover:underline break-all">
              {c.host || c.finalUrl || c.url}
            </a>
            : “{c.quote}”
          </span>
        ))}
        {p.warning && (
          <span className="flex items-center gap-1 text-[11px] text-amber-800">
            <AlertTriangle className="w-3 h-3" /> {p.warning}
          </span>
        )}
      </span>
    );
  }
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
  const [saveToProduct, setSaveToProduct] = useState(false);
  const tiered = ["inferred", "web_found", "catalogue_found"].includes(need.status);
  const estimate = need.provenance?.kind === "product_estimate";
  const byCode = estimate || (need.provenance?.tier === "C" && need.provenance.via === "code"); // no model, no confidence
  useEffect(() => {
    setEditing(need.status === "missing");
    setDraft(need.value ?? "");
  }, [need.status, need.value]);
  const ai = !byCode && ((["needs_confirmation", "resolved_ai", "inferred", "web_found", "catalogue_found"].includes(need.status) && need.provenance?.suggestionId) || (tiered && need.provenance?.tier));
  const save = () => onDecide([{ needId: need.id, action: "edit", value: draft, ...(forLine && need.category === "batch_data" ? { applyTo: "line" } : {}) }]);
  return (
    <div className={`px-3 py-2.5 space-y-1.5 ${OPEN.has(need.status) && need.required ? "bg-amber-50/40" : ""}`} data-need={need.fieldKey} data-status={need.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-800 min-w-36">
          {need.label}
          {!need.required && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[need.status] || ""}`}>{statusLabel(need)}</span>
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
              {AWAITING.has(need.status) && (
                <button type="button" onClick={() => onDecide([{ needId: need.id, action: "accept", ...(tiered && saveToProduct ? { saveToProduct: true } : {}) }])} className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-700">
                  <Check className="w-3.5 h-3.5" /> {STR.accept}
                </button>
              )}
              {tiered && need.category !== "batch_data" && (
                <label className="flex items-center gap-1 text-xs text-gray-600" title={estimate ? STR.confirmHint : STR.saveHint}>
                  <input type="checkbox" checked={saveToProduct} onChange={(e) => setSaveToProduct(e.target.checked)} /> {estimate ? STR.confirmOnProduct : STR.saveToProduct}
                </label>
              )}
              {(ai || (byCode && AWAITING.has(need.status))) && (
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
export default function DataCheckPanel({ scope, invoiceId, refreshKey, editable, canSynonym, textContent, onChange, focus = false, onUnfocus }) {
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

  // after the results grid / a supplier COA wrote values: the stored check, recomputed by code (no AI)
  const reloadCode = useCallback(async () => {
    try {
      apply(await getDataCheck(scope, invoiceId));
    } catch (err) {
      toast.error(err.message);
    }
  }, [scope, invoiceId, apply]);

  const decide = async (decisions) => {
    try {
      apply(await decideDataNeeds(scope, invoiceId, decisions));
    } catch (err) {
      toast.error(err.message);
    }
  };
  const [webBusy, setWebBusy] = useState(false);
  const [webResult, setWebResult] = useState(null);
  const lookup = async () => {
    setWebBusy(true);
    try {
      const c = await webLookup(scope, invoiceId);
      apply(c);
      setWebResult(c.ai?.web || null);
    } catch (err) {
      toast.error(err.message);
    }
    setWebBusy(false);
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
          {/* no certificate planned = nothing was checked: neutral, never the green "all ready" */}
          {!s.certificates ? (
            <div className="rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 border border-gray-200" data-testid="data-check-summary">
              {STR.nothingYet}
            </div>
          ) : (
            <div className={`rounded-lg px-3 py-2 text-sm ${s.blocking ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`} data-testid="data-check-summary">
              {STR.summary(s)}
              {!s.blocking && <span className="ml-2 font-semibold">{STR.allSet}</span>}
            </div>
          )}
          {editable && s.needsConfirmation > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2" data-testid="confirm-all-bar">
              <span className="text-xs text-orange-900">
                {s.needsConfirmation} value{s.needsConfirmation === 1 ? "" : "s"} wait{s.needsConfirmation === 1 ? "s" : ""} for you{s.estimated ? ` (${s.estimated} estimated)` : ""}. Confirmed values are kept on the product — the next invoice won't ask again.
              </span>
              <button type="button" onClick={() => decide([{ action: "confirm_all" }])} className="ml-auto rounded-lg bg-orange-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-orange-700" data-testid="confirm-all">
                Confirm all {s.needsConfirmation}
              </button>
            </div>
          )}
          {s.reused > 0 && <p className="text-xs text-emerald-700">{s.reused} value{s.reused === 1 ? "" : "s"} from the products' profiles (no AI asked).</p>}
          {ai?.unavailable && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">{STR.aiOff(ai.reason)}</p>}
          {ai?.used && (
            <p className="text-xs text-gray-600 flex items-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
              <span>
                {STR.aiFound(ai)} {ai.rejected ? STR.aiRefused(ai.rejected) : ""}
              </span>
            </p>
          )}
          {ai?.inference?.used && <p className="text-xs text-gray-600">{STR.inferNote(ai.inference)}</p>}
          {editable && check.tiers?.web && check.tiers.webEligible > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2">
              <AiAction><button type="button" disabled={webBusy} onClick={lookup} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="web-lookup">
                {webBusy ? <Spinner size="sm" /> : <Globe className="w-3.5 h-3.5" />} {STR.webLookup(check.tiers.webEligible)}
              </button></AiAction>
              <span className="text-[11px] text-gray-600">{STR.webHint}</span>
            </div>
          )}
          {webResult && <p className={`text-xs ${webResult.unavailable ? "text-amber-800" : "text-gray-600"}`}>{STR.webDone(webResult)}</p>}
          {(check.warnings || []).length > 0 && (
            <ul className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 space-y-0.5" data-testid="data-check-warnings">
              {check.warnings.map((w) => (
                <li key={`${w.code}-${w.invoiceItemId}`} className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {w.message}
                </li>
              ))}
            </ul>
          )}
          {/* item 4: lab results are entered per batch in one grid (it rechecks the invoice by code on save) */}
          <ResultsGrid scope={scope} invoiceId={invoiceId} editable={editable} refreshKey={check.computedAt} onSaved={reloadCode} />
          {/* after "Prepare certificates": only what still needs the person (Confirm all above, the grid) */}
          {focus ? (
            <div className="flex justify-end">
              <button type="button" onClick={onUnfocus} className="text-xs text-blue-600 hover:underline" data-testid="show-every-value">
                {STR.showAll}
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
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
