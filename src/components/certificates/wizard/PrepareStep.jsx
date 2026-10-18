import { useEffect, useMemo, useState } from "react";
import AsyncSelect from "react-select/async";
import toast from "react-hot-toast";
import { FlaskConical, Play } from "lucide-react";
import Button from "../../../ui/Button";
import Spinner from "../../../ui/Spinner";
import DocumentFrame from "../DocumentFrame";
import PrepareReport from "../PrepareReport";
import FlagBadges from "../FlagBadges";
import useTaskProgress from "../../../hooks/useTaskProgress";
import { getPrepareDiff, getVersionHtml, prepareVersion, previewVersion, searchCertificateProducts } from "../../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../../utils/certificateErrors";

// Wizard step 4 — prepare & test (plan §13.4). "Prepare" clears the fields on
// the server and runs the gate (§7.6); the test fill renders on the server
// (POST …/preview) from a product and/or typed values — the owner's "100 %"
// check before go-live. Nothing here measures or stores geometry (D11).

const STR = {
  intro: "Prepare clears the marked values out of the design and proves, pixel by pixel, that refilling them reproduces the original.",
  prepare: "Prepare",
  again: "Prepare again",
  preparing: "Preparing — clearing fields and checking the result…",
  noFields: "Mark at least one field first.",
  testTitle: "Test fill",
  testIntro: "Pick a product and/or type values; the server renders exactly what a certificate would look like.",
  product: "Product (optional)",
  productPh: "Search products…",
  override: "Value (empty = from source)",
  render: "Render preview",
  sample: "Showing the design refilled with its sample values.",
  flags: "Flags",
  next: "Next: activate",
  backToFields: "Back to fields",
};

export default function PrepareStep({ scope, version, onChanged, goStep }) {
  const [taskId, setTaskId] = useState(null);
  const [starting, setStarting] = useState(false);
  const task = useTaskProgress(taskId, { onDone: () => onChanged?.() });
  const prepared = ["ready", "active", "superseded"].includes(version.status);
  const preparing = version.status === "preparing" || (taskId && !task.done);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 max-w-2xl">{STR.intro}</p>
        <div className="flex gap-2">
          {version.status === "draft" && (
            <>
              <Button variant="secondary" onClick={() => goStep("fields")}>
                {STR.backToFields}
              </Button>
              <Button onClick={start} isLoading={starting} disabled={!version.fields?.length} title={version.fields?.length ? "" : STR.noFields}>
                <Play className="w-4 h-4" /> {version.prepareReport ? STR.again : STR.prepare}
              </Button>
            </>
          )}
          {prepared && version.status === "ready" && <Button onClick={() => goStep("activate")}>{STR.next}</Button>}
        </div>
      </div>

      {preparing && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
          <Spinner size="sm" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{task.message || STR.preparing}</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded">
              <div className="h-1.5 bg-blue-600 rounded transition-all" style={{ width: `${Math.max(5, task.progress || 0)}%` }} />
            </div>
          </div>
        </div>
      )}
      {version.error && version.status === "draft" && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{version.error}</div>}

      {!preparing && version.prepareReport && (
        <PrepareReport report={version.prepareReport} stale={version.prepareReportStale} loadDiff={(page) => getPrepareDiff(scope, version.id, page)} reloadKey={version.updatedAt} />
      )}

      {prepared && <TestFill scope={scope} version={version} />}
    </div>
  );
}

function TestFill({ scope, version }) {
  const [product, setProduct] = useState(null);
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const loadProducts = (search) =>
    searchCertificateProducts(scope, search, 20)
      .then((products) => products.map((p) => ({ value: p.id, label: p.productCode ? `${p.name} (${p.productCode})` : p.name })))
      .catch(() => []);

  const render = async () => {
    setBusy(true);
    try {
      const overrides = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
      setResult(await previewVersion(scope, version.id, { productId: product?.value || null, values: overrides }));
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

  return (
    <section className="space-y-3" data-testid="test-fill">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <FlaskConical className="w-4 h-4" /> {STR.testTitle}
      </h3>
      <p className="text-sm text-gray-600">{STR.testIntro}</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-2">
          {!result && <p className="text-xs text-gray-500">{STR.sample}</p>}
          <DocumentFrame load={load} reloadKey={`${version.id}:${renderKey}`} minHeight={640} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{STR.product}</span>
            <AsyncSelect className="mt-1" cacheOptions defaultOptions loadOptions={loadProducts} value={product} onChange={setProduct} isClearable placeholder={STR.productPh} />
          </label>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {version.fields.map((f) => (
              <div key={f.key} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-700">{f.label}</span>
                  <FlagBadges flags={result?.flags?.[f.key]} />
                </div>
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  placeholder={result?.values?.[f.key]?.value || STR.override}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5"
                  data-testid={`test-${f.key}`}
                />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={render} isLoading={busy}>
            {STR.render}
          </Button>
        </div>
      </div>
    </section>
  );
}
