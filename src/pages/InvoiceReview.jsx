import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { AlertTriangle, Check } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import StatusBadge from "../components/certificates/StatusBadge";
import InvoiceItemsTable from "../components/certificates/InvoiceItemsTable";
import InvoiceSourceViewer from "../components/certificates/InvoiceSourceViewer";
import PlanPreview from "../components/certificates/PlanPreview";
import BatchView from "../components/certificates/BatchView";
import DataCheckPanel from "../components/certificates/DataCheckPanel";
import useCompanyScope from "../hooks/useCompanyScope";
import useTaskProgress from "../hooks/useTaskProgress";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { getBrands } from "../services/apiBrands";
import { generateCertificates, getGenerationPlan } from "../services/apiCertificatesV2";
import { addInvoiceItem, confirmInvoice, deleteInvoiceItem, enterInvoiceByHand, getInvoice, rematchInvoice, retryInvoice, updateInvoice, updateInvoiceItem } from "../services/apiInvoices";

// /invoices/:id (plan §13.5; mockups B2 = reading, B3 = review & match).
const STR = {
  back: "← Invoices",
  title: (n) => `Invoice ${n}`,
  subtitle: "Check what was read from the invoice, match every line to a product, then generate.",
  // B2 — reading
  reading: "Reading the invoice",
  readingHint: "About 20–40 seconds. Nothing is guessed — anything we can’t read stays empty for you to fill.",
  stages: ["Invoice uploaded", "AI is reading header and lines", "Matching products with your catalogue"],
  canLeave: "You can leave — this page picks up where it is when you come back.",
  stageState: { done: "done", active: "in progress", pending: "not started" },
  progress: "Reading progress",
  skeleton: "Review screen loading…",
  failedTitle: "Couldn’t read this invoice:",
  failedTail: "No certificates were created.",
  tryAgain: "Try again",
  byHand: "Enter it by hand",
  byHandHint: "Type the invoice number and each line from the original on the left — nothing is filled in for you.",
  // B3 — review
  rematch: "Re-run matching",
  rematched: (r) =>
    `Matching done: ${r.matched} matched, ${r.needsMatch} need a product` +
    (r.ai?.suggested ? ` · AI suggests a product for ${r.ai.suggested} — confirm them` : "") +
    (r.ai?.unavailable ? ` · AI matching unavailable (${r.ai.reason})` : ""),
  confirm: "Confirm & continue",
  confirmed: "Invoice confirmed — check the plan, then generate",
  generate: (n) => (n ? `Generate ${n} certificate${n === 1 ? "" : "s"}` : "Generate certificates"),
  generateAgain: "Generate again",
  generateAnyway: "Generate anyway",
  generateAnywayConfirm: (n) => `${n} required value${n === 1 ? " is" : "s are"} still missing or unconfirmed. Generate anyway? They stay empty and are flagged on the certificates.`,
  blockedHint: (n) => `Complete the certificate data check first (${n} open value${n === 1 ? "" : "s"})`,
  confirmAgain: "Generate a new set of certificates? The existing ones stay as they are.",
  batchesTitle: (n) => `Certificates for ${n}`,
  batch: (b, i) => `Run ${i} · ${new Date(b.createdAt).toLocaleString()}`,
  showLines: "Show invoice & lines",
  hideLines: "Hide invoice & lines",
  needsMatch: (n) => (
    <>
      <b>
        {n} line{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} a product match
      </b>{" "}
      before you can confirm. Pick one of the suggestions or search the catalogue.
    </>
  ),
  matchSummary: (m) =>
    `${m.by === "rematch" ? "Matching re-run" : "Matched automatically when the invoice was read"}: ${m.matched} line${m.matched === 1 ? "" : "s"} matched, ${m.needsMatch} need${m.needsMatch === 1 ? "s" : ""} a product` +
    (m.ai?.autoAccepted ? ` · AI matched ${m.ai.autoAccepted}` : "") +
    (m.ai?.suggested ? ` · AI suggests a product for ${m.ai.suggested} — confirm them in the lines below` : ""),
  matchAiOff: (reason) => `AI matching was unavailable (${reason}) — pick the products from the suggestions or the catalogue.`,
  ambiguousDates: "Some dates are ambiguous (amber). Write them unambiguously so they can be formatted on the certificates.",
  ambiguousQuantities: "Some quantities are ambiguous (amber): \"1.250\" could be 1250 or 1.25. Type the number without the separator (1250) or with a decimal part (1.25).",
  readyNote: "Confirmed — editing anything sends it back to review.",
  notEditable: (s) => `This invoice is ${s.replace("_", " ")} and can no longer be edited.`,
  details: "Invoice details",
  detailsHint: "Read by AI · edited fields are marked",
  edited: "edited",
  destination: "Destination country",
  readFromInvoice: "Read from invoice",
  brand: "Brand hint",
  noBrand: "Detect from products",
  warnings: "Notes from the extraction",
  pickCompany: "Pick a company first.",
};

const HEADER_FIELDS = [
  { key: "invoiceNumber", label: "Invoice number" },
  { key: "invoiceDate", label: "Invoice date", date: true },
  { key: "customerName", label: "Customer" },
];
const EDITABLE = new Set(["review", "ready"]);
const BATCH_STATES = new Set(["generating", "generated", "partially_failed"]);
const IN_PROGRESS = new Set(["uploaded", "extracting"]);
const CHECKABLE = new Set(["review", "ready", "generated", "partially_failed"]);
const headerText = (h, f) => (f.date ? h?.[f.key]?.raw ?? "" : h?.[f.key] ?? "");

function HeaderField({ field, invoice, editable, onSave }) {
  const shown = headerText(invoice.header, field);
  const extracted = headerText(invoice.headerExtracted, field);
  const [draft, setDraft] = useState(null);
  const cancelled = useRef(false);
  const edited = shown !== extracted;
  const ambiguous = field.date && shown && !invoice.header?.[field.key]?.iso;
  const commit = () => {
    const next = (draft ?? shown).trim();
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false; // Esc reverts
      return;
    }
    if (next !== shown) onSave(field.key, next || null);
  };
  return (
    <label className="block text-sm" data-field={field.key}>
      <span className="flex items-center gap-2 text-gray-700 font-medium">
        {field.label}
        {edited && (
          <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold" title={`Read from the invoice as "${extracted}"`}>
            {STR.edited}
          </span>
        )}
      </span>
      <input
        value={draft ?? shown}
        disabled={!editable}
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white disabled:bg-gray-50 ${ambiguous ? "border-amber-400" : "border-gray-300"}`}
      />
    </label>
  );
}

function ReadingCard({ task, source }) {
  const stage = task.progress >= 70 ? 2 : 1; // 0 done; 1 = AI reading; 2 = matching
  const kind = source?.mimeType === "application/pdf" ? "PDF" : "Image";
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5" data-testid="extracting">
      <div className="flex items-start gap-4">
        <Spinner />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{STR.reading}</h2>
          <p className="text-sm text-gray-500">{STR.readingHint}</p>
        </div>
      </div>
      <ol className="space-y-2" aria-live="polite">
        {STR.stages.map((label, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-blue-50" : ""}`}>
              <span
                aria-hidden="true"
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  done ? "bg-emerald-600 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              <span className={`text-sm ${active ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                {label}
                <span className="sr-only"> — {done ? STR.stageState.done : active ? STR.stageState.active : STR.stageState.pending}</span>
              </span>
              {i === 0 && source && (
                <span className="ml-auto text-xs text-gray-500">
                  {kind} · {(source.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </span>
              )}
              {active && task.message && <span className="ml-auto text-xs text-gray-500">{task.message}</span>}
            </li>
          );
        })}
      </ol>
      <div role="progressbar" aria-label={STR.progress} aria-valuenow={task.progress || 0} aria-valuemin={0} aria-valuemax={100} className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(task.progress || 0, 8)}%` }} />
      </div>
      {/* mockup B2: the shape of the review screen while it loads */}
      <div className="border-t border-gray-100 pt-4 space-y-3" aria-hidden="true">
        <p className="text-xs font-semibold text-gray-500">{STR.skeleton}</p>
        <div className="grid grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-200 animate-pulse" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
      <p className="text-sm text-gray-500">{STR.canLeave}</p>
    </section>
  );
}

export default function InvoiceReview() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const scopeState = useCompanyScope();
  const { scope, companyId } = scopeState;
  const { user } = useAuth();
  const canUpdate = hasPermission(user, "update_invoices");
  const canGenerate = hasPermission(user, "create_certificates");
  const canForce = hasPermission(user, "update_certificates");
  const canSynonym = hasPermission(user, "update_certificate_templates");
  const [check, setCheck] = useState(null);
  const [plan, setPlan] = useState(null);
  const [showLines, setShowLines] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(null); // "rematch" | "confirm" | "retry"
  const countries = useMemo(() => countryList().getData(), []);

  const load = useCallback(async () => {
    if (!scope) return;
    try {
      setInvoice(await getInvoice(scope, id));
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [scope, id]);

  useEffect(() => {
    load();
  }, [load]);

  // the plan preview follows every review edit (it is computed on the server)
  const planKey = invoice && EDITABLE.has(invoice.status) ? `${invoice.updatedAt}:${(invoice.items || []).map((i) => `${i.id}${i.productId}${i.matchStatus}`).join()}` : null;
  useEffect(() => {
    if (!planKey) return;
    getGenerationPlan(scope, id)
      .then(setPlan)
      .catch(() => setPlan(null));
  }, [planKey, scope, id]);

  useEffect(() => {
    if (!companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  // Reading progress: the upload passes ?task=; without it the invoice itself is polled.
  const extracting = !!invoice && IN_PROGRESS.has(invoice.status);
  const taskId = extracting ? params.get("task") : null;
  const task = useTaskProgress(taskId, { onDone: load });
  useEffect(() => {
    if (!extracting || taskId) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [extracting, taskId, load]);

  const editable = !!invoice && canUpdate && EDITABLE.has(invoice.status);
  const run = async (fn, okMessage) => {
    try {
      const out = await fn();
      if (okMessage) toast.success(typeof okMessage === "function" ? okMessage(out) : okMessage);
    } catch (err) {
      toast.error(err.message);
    }
    await load();
  };
  const withBusy = (name, fn) => async () => {
    setBusy(name);
    await fn();
    setBusy(null);
  };

  const saveHeader = (key, value) => run(() => updateInvoice(scope, id, { header: { [key]: value } }));
  const saveMeta = (body) => run(() => updateInvoice(scope, id, body));
  const saveCell = (item, key, value) => run(() => updateInvoiceItem(scope, id, item.id, { data: { [key]: value } }));
  const match = (item, productId, extra = {}) => run(() => updateInvoiceItem(scope, id, item.id, { productId, ...extra }));
  const ignore = (item, ignored) => run(() => updateInvoiceItem(scope, id, item.id, { ignored }));
  const remove = (item) => run(() => deleteInvoiceItem(scope, id, item.id));
  const add = () => run(() => addInvoiceItem(scope, id, { data: {} }));
  const rematch = withBusy("rematch", () => run(() => rematchInvoice(scope, id), STR.rematched));
  const confirm = withBusy("confirm", () => run(() => confirmInvoice(scope, id), STR.confirmed));
  const blocking = check?.summary?.blocking || 0;
  const startGenerate = (force) => async () => {
    if (force && !window.confirm(STR.generateAnywayConfirm(blocking))) return;
    if (!force && BATCH_STATES.has(invoice.status) && !window.confirm(STR.confirmAgain)) return;
    try {
      const out = await generateCertificates(scope, id, { force });
      navigate(`/invoices/${id}?batch=${out.batchId}&task=${out.taskId}`, { replace: true });
      setShowLines(false);
    } catch (err) {
      toast.error(err.message);
    }
    await load();
  };
  const generate = withBusy("generate", startGenerate(false));
  const generateAnyway = withBusy("generate", startGenerate(true));
  const retry = withBusy("retry", async () => {
    try {
      const { taskId: next } = await retryInvoice(scope, id);
      navigate(`/invoices/${id}?task=${next}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
    await load();
  });
  const byHand = withBusy("byHand", async () => {
    try {
      await enterInvoiceByHand(scope, id);
      navigate(`/invoices/${id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
    await load();
  });

  if (!scope)
    return (
      <div className="space-y-4">
        <RoleBanner scope={scopeState} />
        <CompanyPicker scope={scopeState} />
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      </div>
    );
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!invoice)
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );

  const needsMatch = invoice.counts?.needs_match || 0;
  const items = invoice.items || [];
  const failed = invoice.status === "failed";
  const ambiguous =
    items.some((it) => it.matchStatus !== "ignored" && ["productionDate", "expiryDate"].some((k) => it.data?.[k]?.raw && !it.data[k].iso)) ||
    (invoice.header?.invoiceDate?.raw && !invoice.header.invoiceDate.iso);
  const ambiguousQty = items.some((it) => it.matchStatus !== "ignored" && it.data?.quantityAmbiguous === true);
  const warnings = invoice.extraction?.warnings || [];
  const title = invoice.header?.invoiceNumber ? STR.title(invoice.header.invoiceNumber) : invoice.source?.originalName || STR.title("");
  const batches = invoice.batches || [];
  const inBatches = BATCH_STATES.has(invoice.status) && batches.length > 0;
  const batchId = params.get("batch") && batches.some((b) => b.id === params.get("batch")) ? params.get("batch") : batches[0]?.id;
  const planned = plan?.entries?.length || 0;
  // the data check re-runs after any review edit (code only, plus the AI for gaps it hasn't asked about)
  const checkKey = `${invoice.status}:${planKey}:${items.map((i) => JSON.stringify(i.data)).join("|")}:${JSON.stringify(invoice.header)}`;
  const viewer = <InvoiceSourceViewer scope={scope} invoiceId={invoice.id} mimeType={invoice.source?.mimeType} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/invoices" className="text-sm text-blue-600 hover:underline">
            {STR.back}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mt-1">
            {inBatches ? STR.batchesTitle(invoice.header?.invoiceNumber || "") : title} <StatusBadge status={invoice.status} />
          </h1>
          {EDITABLE.has(invoice.status) && <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <CompanyPicker scope={scopeState} />
          {editable && (
            <Button variant="secondary" isLoading={busy === "rematch"} onClick={rematch}>
              {STR.rematch}
            </Button>
          )}
          {editable && invoice.status === "review" && (
            <Button isLoading={busy === "confirm"} disabled={needsMatch > 0} onClick={confirm}>
              {STR.confirm}
            </Button>
          )}
          {canGenerate && invoice.status === "ready" && (
            <Button isLoading={busy === "generate"} disabled={!planned || blocking > 0} title={blocking ? STR.blockedHint(blocking) : undefined} onClick={generate}>
              {STR.generate(planned)}
            </Button>
          )}
          {canGenerate && ["generated", "partially_failed"].includes(invoice.status) && (
            <Button variant="secondary" isLoading={busy === "generate"} disabled={blocking > 0} title={blocking ? STR.blockedHint(blocking) : undefined} onClick={generate}>
              {STR.generateAgain}
            </Button>
          )}
          {canGenerate && canForce && blocking > 0 && (invoice.status === "ready" || ["generated", "partially_failed"].includes(invoice.status)) && (
            <Button variant="ghost" isLoading={busy === "generate"} disabled={!planned} onClick={generateAnyway} data-testid="generate-anyway">
              {STR.generateAnyway}
            </Button>
          )}
        </div>
      </div>

      <RoleBanner scope={scopeState} />

      {(extracting || failed) && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
          {viewer}
          {extracting ? (
            <ReadingCard task={task} source={invoice.source} />
          ) : (
            <section className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3" data-testid="extraction-failed">
              <p className="text-sm text-red-800 flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  <b>{STR.failedTitle}</b> “{invoice.error}” {STR.failedTail}
                </span>
              </p>
              {canUpdate && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" isLoading={busy === "retry"} onClick={retry}>
                      {STR.tryAgain}
                    </Button>
                    <Button variant="secondary" isLoading={busy === "byHand"} onClick={byHand} data-testid="enter-by-hand">
                      {STR.byHand}
                    </Button>
                  </div>
                  <p className="text-xs text-red-800">{STR.byHandHint}</p>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {inBatches && (
        <div className="space-y-4">
          {batches.length > 1 && (
            <select
              value={batchId}
              onChange={(e) => navigate(`/invoices/${id}?batch=${e.target.value}`, { replace: true })}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
            >
              {batches.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {STR.batch(b, batches.length - i)}
                </option>
              ))}
            </select>
          )}
          <BatchView key={batchId} scope={scope} batchId={batchId} taskId={params.get("batch") === batchId ? params.get("task") : null} onFinished={load} canExport={hasPermission(user, "export_certificates")} />
          <button type="button" onClick={() => setShowLines((v) => !v)} className="text-sm text-blue-600 hover:underline">
            {showLines ? STR.hideLines : STR.showLines}
          </button>
        </div>
      )}

      {!extracting && !failed && (!inBatches || showLines) && (
        <>
          {invoice.status === "review" && needsMatch > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="needs-match-banner">
              <AlertTriangle className="w-5 h-5 shrink-0" /> <span>{STR.needsMatch(needsMatch)}</span>
            </div>
          )}
          {/* post-A4: what matching did when the invoice was read (no "Re-run matching" needed) */}
          {EDITABLE.has(invoice.status) && invoice.matchSummary && (
            <div className="text-sm text-gray-700" data-testid="match-summary">
              <p>{STR.matchSummary(invoice.matchSummary)}</p>
              {invoice.matchSummary.ai?.unavailable && <p className="text-xs text-amber-800">{STR.matchAiOff(invoice.matchSummary.ai.reason)}</p>}
            </div>
          )}
          {ambiguous && <p className="text-sm text-amber-700">{STR.ambiguousDates}</p>}
          {ambiguousQty && <p className="text-sm text-amber-700">{STR.ambiguousQuantities}</p>}
          {invoice.status === "ready" && <p className="text-sm text-emerald-700">{STR.readyNote}</p>}
          {!EDITABLE.has(invoice.status) && !inBatches && <p className="text-sm text-gray-600">{STR.notEditable(invoice.status)}</p>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
            {viewer}
            <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">{STR.details}</h2>
                <span className="text-xs text-gray-500">{STR.detailsHint}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {HEADER_FIELDS.map((f) => (
                  <HeaderField key={f.key} field={f} invoice={invoice} editable={editable} onSave={saveHeader} />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">{STR.destination}</span>
                  <select
                    value={invoice.country || ""}
                    disabled={!editable}
                    onChange={(e) => saveMeta({ country: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-50"
                  >
                    <option value="">{STR.readFromInvoice}</option>
                    {countries.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label} ({c.value})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">{STR.brand}</span>
                  <select
                    value={invoice.brandId || ""}
                    disabled={!editable}
                    onChange={(e) => saveMeta({ brandId: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-50"
                  >
                    <option value="">{STR.noBrand}</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {EDITABLE.has(invoice.status) && <PlanPreview plan={plan} />}
              {warnings.length > 0 && (
                <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">
                  <p className="font-semibold mb-1">{STR.warnings}</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {CHECKABLE.has(invoice.status) && (
            <DataCheckPanel scope={scope} invoiceId={invoice.id} refreshKey={checkKey} editable={canUpdate} canSynonym={canSynonym} textContent={invoice.textContent} onChange={setCheck} />
          )}

          <InvoiceItemsTable scope={scope} items={items} editable={editable} onSaveCell={saveCell} onMatch={match} onIgnore={ignore} onDelete={remove} onAdd={add} />
        </>
      )}
    </div>
  );
}
