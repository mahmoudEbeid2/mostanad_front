import { useEffect, useMemo, useRef, useState } from "react";
import AsyncSelect from "react-select/async";
import toast from "react-hot-toast";
import { ArrowRight, Play } from "lucide-react";
import Button from "../../../ui/Button";
import Spinner from "../../../ui/Spinner";
import DocumentFrame from "../DocumentFrame";
import PrepareReport from "../PrepareReport";
import FlagBadges from "../FlagBadges";
import useTaskProgress from "../../../hooks/useTaskProgress";
import { getPrepareDiff, getVersionHtml, getVersionThumbnail, prepareVersion, previewVersion, searchCertificateProducts } from "../../../services/apiCertificateTemplates";
import { getInvoice, listInvoices } from "../../../services/apiInvoices";
import { describeCertificateError } from "../../../utils/certificateErrors";

// Wizard step 4 — prepare & test (plan §13.4; mockup A5). "Prepare" clears the
// fields on the server and runs the gate (§7.6); the test fill renders on the
// server (POST …/preview) from a product, a confirmed invoice's line and/or
// typed values — the owner's "100 %" check before go-live. Nothing here measures or stores geometry (D11).

const STR = {
  title: "Prepare",
  intro: "Prepare clears the marked values out of the design and proves, pixel by pixel, that refilling them reproduces the original.",
  prepare: "Prepare",
  again: "Run again",
  preparing: "Preparing — clearing fields and checking the result…",
  noFields: "Mark at least one field first.",
  backToFields: "Back to fields",
  testTitle: "Test fill",
  testIntro: "Rendered on the server — exactly what the PDF will show.",
  product: "Product",
  productPh: "Search products…",
  item: "Invoice item (optional)",
  itemPh: "Search confirmed invoices…",
  itemHint: "Fills invoice and line values; its matched product is used unless you pick one above.",
  noItems: "No confirmed invoice lines",
  line: (inv, it) => [`${inv} · line ${it.lineNo}`, it.data?.name, it.data?.batchNo].filter(Boolean).join(" · "),
  override: "Value (empty = from source)",
  render: "Render preview",
  sample: "Showing the design refilled with its sample values.",
  replaces: "Activating replaces",
  inSlot: "in this slot.",
  noActive: "no active version",
  next: (n) => `Next: activate v${n}`,
};

export default function PrepareStep({ scope, template, version, onChanged, goStep }) {
  const [taskId, setTaskId] = useState(null);
  const [starting, setStarting] = useState(false);
  const task = useTaskProgress(taskId, { onDone: () => onChanged?.() });
  const prepared = ["ready", "active", "superseded"].includes(version.status);
  const preparing = version.status === "preparing" || (taskId && !task.done);
  const draft = version.status === "draft";

  // a reload while the job runs has no task id: poll the version
  useEffect(() => {
    if (taskId || version.status !== "preparing") return undefined;
    const t = setTimeout(() => onChanged?.(), 2000);
    return () => clearTimeout(t);
  }, [taskId, version, onChanged]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await prepareVersion(scope, version.id);
      setTaskId(res.taskId);
      onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setStarting(false);
    }
  };

  const actions = draft && (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" className="!py-2" onClick={() => goStep("fields")}>
        {STR.backToFields}
      </Button>
      <Button className="!py-2" onClick={start} isLoading={starting} disabled={!version.fields?.length} title={version.fields?.length ? "" : STR.noFields}>
        <Play className="w-4 h-4" /> {version.prepareReport ? STR.again : STR.prepare}
      </Button>
    </div>
  );
  const showReport = !preparing && version.prepareReport;

  return (
    <div className="flex flex-wrap gap-5 items-start">
      <section className="flex-[3_1_520px] min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {preparing ? (
          <div className="p-5 flex items-center gap-4">
            <Spinner size="sm" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800" aria-live="polite">
                {task.message || STR.preparing}
              </p>
              <div role="progressbar" aria-label={STR.title} aria-valuenow={task.progress || 0} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.max(5, task.progress || 0)}%` }} />
              </div>
            </div>
          </div>
        ) : showReport ? (
          <PrepareReport
            report={version.prepareReport}
            stale={version.prepareReportStale}
            ready={version.status === "ready"}
            fields={version.fields}
            loadDiff={(page) => getPrepareDiff(scope, version.id, page)}
            loadOriginal={version.thumbnailFileId ? () => getVersionThumbnail(scope, version.id) : null}
            reloadKey={version.updatedAt}
            actions={actions}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-4 px-5 py-[18px]">
            <div className="flex-1 min-w-52">
              <h2 className="text-base font-bold text-gray-900">{STR.title}</h2>
              <p className="text-[13px] text-gray-600 mt-0.5">{STR.intro}</p>
            </div>
            {actions}
          </div>
        )}
        {version.error && draft && !preparing && <div className="mx-5 mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{version.error}</div>}
      </section>

      {prepared && <TestFill scope={scope} template={template} version={version} goStep={goStep} />}
    </div>
  );
}

// confirmed by a person; invoices still in review (or failed) can change
const CONFIRMED = ["ready", "generating", "generated", "partially_failed"];

function TestFill({ scope, template, version, goStep }) {
  const [product, setProduct] = useState(null);
  const [item, setItem] = useState(null);
  const lines = useRef(new Map()); // invoiceId → its lines, fetched once per test fill
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const loadProducts = (search) =>
    searchCertificateProducts(scope, search, 20)
      .then((products) => products.map((p) => ({ value: p.id, label: p.productCode ? `${p.name} (${p.productCode})` : p.name })))
      .catch(() => []);

  // grouped by invoice: "INV-… · line 2 · name · batch"; ignored lines can't make a certificate
  const loadItems = async (search) => {
    try {
      const { invoices } = await listInvoices(scope, { q: search || undefined, limit: 8 });
      const groups = await Promise.all(
        invoices
          .filter((inv) => CONFIRMED.includes(inv.status))
          .map(async (inv) => {
            if (!lines.current.has(inv.id)) lines.current.set(inv.id, (await getInvoice(scope, inv.id)).items || []);
            const no = inv.header?.invoiceNumber || inv.id.slice(0, 8);
            const options = lines.current.get(inv.id).filter((it) => it.matchStatus !== "ignored").map((it) => ({ value: it.id, label: STR.line(no, it) }));
            return { label: no, options };
          })
      );
      return groups.filter((g) => g.options.length);
    } catch {
      return [];
    }
  };

  const render = async () => {
    setBusy(true);
    try {
      const overrides = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
      setResult(await previewVersion(scope, version.id, { productId: product?.value || null, invoiceItemId: item?.value || null, values: overrides }));
      setRenderKey((k) => k + 1);
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setBusy(false);
    }
  };

  const load = useMemo(
    () => (result ? () => Promise.resolve(result.html) : () => getVersionHtml(scope, version.id, "sample")),
    [result, scope, version.id]
  );
  const current = template?.versions?.find((v) => v.id === template.activeVersionId && v.id !== version.id);

  return (
    <aside aria-labelledby="test-fill-title" className="flex-[2_1_320px] min-w-0 bg-white border border-gray-200 rounded-xl flex flex-col" data-testid="test-fill">
      <div className="p-4 border-b border-gray-200">
        <h2 id="test-fill-title" className="text-[15px] font-semibold text-gray-900">
          {STR.testTitle}
        </h2>
        <p className="text-[13px] text-gray-500 mt-1">{STR.testIntro}</p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
          {STR.product}
          <AsyncSelect cacheOptions defaultOptions loadOptions={loadProducts} value={product} onChange={setProduct} isClearable placeholder={STR.productPh} aria-label={STR.product} className="font-normal text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600" data-testid="test-invoice-item">
          {STR.item}
          <AsyncSelect
            cacheOptions
            defaultOptions
            loadOptions={loadItems}
            value={item}
            onChange={setItem}
            isClearable
            placeholder={STR.itemPh}
            noOptionsMessage={() => STR.noItems}
            aria-label={STR.item}
            aria-describedby="test-item-hint"
            className="font-normal text-sm"
          />
          <span id="test-item-hint" className="font-normal text-gray-500">
            {STR.itemHint}
          </span>
        </label>
        <div className="flex flex-col gap-3 max-h-[360px] overflow-auto pr-1">
          {version.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
              <span className="flex items-center justify-between gap-2">
                <span>
                  {f.label} <span className="font-mono font-normal text-gray-400">{f.key}</span>
                </span>
                <FlagBadges flags={result?.flags?.[f.key]} />
              </span>
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                placeholder={result?.values?.[f.key]?.value || STR.override}
                className="min-h-10 border border-gray-300 rounded-lg px-3 text-sm font-normal text-gray-900"
                data-testid={`test-${f.key}`}
              />
            </label>
          ))}
        </div>
        <Button className="w-full" onClick={render} isLoading={busy}>
          {STR.render}
        </Button>
        <div className="space-y-1.5">
          {!result && <p className="text-xs text-gray-500">{STR.sample}</p>}
          <DocumentFrame load={load} reloadKey={`${version.id}:${renderKey}`} minHeight={420} />
        </div>
      </div>
      {version.status === "ready" && (
        <div className="mt-auto p-4 border-t border-gray-200 flex flex-col gap-2.5">
          <p className="text-xs text-gray-600">
            {STR.replaces} <b>{current ? `v${current.versionNumber}` : STR.noActive}</b> {STR.inSlot}
          </p>
          <Button className="w-full" onClick={() => goStep("activate")}>
            {STR.next(version.versionNumber)} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
