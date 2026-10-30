import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, FileText, RefreshCw } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import AiAction from "../ui/AiAction";
import CatalogueSteps from "../components/catalogues/CatalogueSteps";
import PageImage from "../components/catalogues/PageImage";
import useCompanyScope from "../hooks/useCompanyScope";
import useTaskProgress from "../hooks/useTaskProgress";
import { useAuth } from "../context/AuthContext";
import { useAiStatus } from "../context/AiStatusContext";
import { hasPermission } from "../utils/permissions";
import { parseRange, formatRange } from "../utils/pageRange";
import { createImageLoader } from "../utils/imageLoader";
import { getCataloguePages, saveCataloguePageSelection, getCataloguePageImage, extractCatalogueVersion, uploadCatalogueVersion } from "../services/apiCatalogues";

// /catalogues/versions/:id/pages (design C1): step 2 of a catalogue upload. The
// upload only counted the pages. A person chooses the ones with products — nothing is
// pre-selected — and only those are read and sent to the AI. The choice is saved per
// catalogue, and the next version can start from it with one click.
const STR = {
  back: "Catalogues",
  title: "Choose the pages to read",
  subtitle: "Click the pages that have products — only those are sent to the AI. Covers, contents and blank pages cost tokens and add nothing.",
  fileMeta: (n, size) => `${n} pages${size ? ` · ${size}` : ""} · nothing goes to the AI until you click Extract`,
  replace: "Replace file",
  replacing: "Uploading the new file…",
  quick: "Quick select",
  samePages: "Same pages as last version",
  all: "All",
  none: "None",
  invert: "Invert",
  show: { all: "All", kept: "Kept", skipped: "Not chosen" },
  pagesLabel: "Pages",
  rangeHint: "e.g. 4–15, 17–20 · click a page to keep or skip it",
  rangeInvalid: (parts) => `Not a page of this file: ${parts.join(", ")}`,
  nothingYet: "No pages chosen yet. Click each page that has products, or type them in “Pages” — e.g. 4–15, 17–20.",
  pageOf: (n, m) => `Page ${n} of ${m}`,
  keep: "Keep this page",
  kept: "Kept",
  thumbLabel: (n, kept) => `Page ${n}, ${kept ? "kept — click to skip" : "not chosen — click to keep"}`,
  preview: (n) => `Preview page ${n}`,
  keptWhy: "Kept — it will be read.",
  skippedWhy: "Not chosen — click the page or Keep if it has products.",
  willRead: (n, m) => `${n} of ${m} pages will be read`,
  tokens: "AI tokens (estimate)",
  cost: "Cost (estimate)",
  allPages: (t) => `all pages: ${t}`,
  less: (p) => (p > 0 ? `${p}% less than reading every page` : "the same as reading every page"),
  chooseFirst: "choose pages to see the estimate",
  noPrice: "no model price set yet",
  basisLedger: (calls) => `from ${calls} earlier catalogue AI call${calls === 1 ? "" : "s"}`,
  basisConstant: "no catalogue extraction yet — a fixed per-page guess",
  notes: [
    "The PDF is split on the server; only the kept pages go to the AI, a few pages at a time.",
    'Every product keeps its page number, so each value shows "Catalogue p.7" as evidence.',
    "Your choice is saved — the next version of this catalogue can start from the same pages.",
  ],
  removed: (pages) => `Pages ${pages} were read before and are out now: their products that nobody reviewed will be dropped. Products already reviewed or linked stay.`,
  extract: (n) => `Extract ${n} page${n === 1 ? "" : "s"} →`,
  chooseToExtract: "Choose pages to extract",
  later: "Save and extract later",
  byHand: "Read the pages, type the products by hand",
  saved: "Pages saved — extract them from the catalogue when you are ready.",
  extracting: "Reading the products…",
  extracted: "Products read — opening the review.",
  extractFailed: "The products weren't read",
  loading: "Loading the pages…",
  failed: "The pages couldn't be loaded",
  retry: "Try again",
  empty: "This file has no pages to choose from.",
  readOnly: "Only a catalogue manager can change the pages or start the extraction.",
  extractedBefore: (pages) => `Last extraction read pages ${pages}.`,
};

const fmtTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.round(n)));
const fmtUsd = (v) => (v === null || v === undefined ? "—" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);
const fmtSize = (b) => (b ? (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`) : "");

/** Re-estimates from the backend's per-page rates while pages are clicked. */
function estimateFor(pages, kept, est) {
  if (!est?.perPage) return null;
  const tokensPer = est.perPage.input + est.perPage.output;
  const sel = kept.size;
  const all = pages.length;
  const cost = (n) => (est.perPage.costUsd === null ? null : n * est.perPage.costUsd);
  return {
    selTokens: sel * tokensPer,
    allTokens: all * tokensPer,
    selCost: cost(sel),
    allCost: cost(all),
    saved: all ? Math.round((100 * (all - sel)) / all) : 0,
  };
}

function Thumb({ page, kept, active, onToggle, onPreview, loader }) {
  return (
    <div className="flex flex-col gap-1.5" data-testid="page-thumb" data-page={page.number} data-kept={kept ? "true" : "false"}>
      <button
        type="button"
        aria-pressed={kept}
        aria-label={STR.thumbLabel(page.number, kept)}
        onClick={onToggle}
        className={`relative block w-full overflow-hidden rounded-lg border-2 bg-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          kept ? "border-blue-600 shadow-sm" : "border-gray-200 hover:border-gray-400"
        } ${active ? "ring-2 ring-amber-400 ring-offset-1" : ""}`}
        style={{ aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : "3 / 4" }}
      >
        <PageImage url={page.thumbnailUrl} loader={loader} lazy className="h-full w-full" />
        <span aria-hidden="true" className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white ${kept ? "bg-blue-600" : "bg-transparent"}`}>
          {kept && <Check className="h-3.5 w-3.5" />}
        </span>
      </button>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold text-gray-700">p.{page.number}</span>
        <button type="button" onClick={onPreview} aria-label={STR.preview(page.number)} className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CataloguePages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { scope } = useCompanyScope();
  const { user } = useAuth();
  const canManage = hasPermission(user, "manage_catalogues");
  const { available: aiAvailable } = useAiStatus();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [kept, setKept] = useState(new Set());
  const [rangeText, setRangeText] = useState("");
  const [rangeInvalid, setRangeInvalid] = useState([]);
  const [filter, setFilter] = useState("all");
  const [current, setCurrent] = useState(1);
  const [busy, setBusy] = useState(null); // "save" | "extract" | "replace"
  const [actionError, setActionError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const byHand = useRef(false);
  const fileInput = useRef(null);

  // one loader for this screen: at most 6 images at a time, each fetched once. Kept across
  // a re-mount (StrictMode): the images it holds are only let go when the screen really closes.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [loader] = useState(() => createImageLoader((url) => getCataloguePageImage(scopeRef.current, url), 6));
  const closing = useRef(null);
  useEffect(() => {
    clearTimeout(closing.current);
    return () => {
      closing.current = setTimeout(() => loader.destroy(), 0);
    };
  }, [loader]);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoadError(null);
    try {
      const d = await getCataloguePages(scope, id);
      setData(d);
      const sel = new Set(d.selection?.pages || []);
      setKept(sel);
      setRangeText(formatRange([...sel]));
      setRangeInvalid([]);
      setCurrent((c) => (c >= 1 && c <= d.pageCount ? c : sel.size ? Math.min(...sel) : 1));
    } catch (err) {
      setLoadError(err.message);
    }
  }, [scope, id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const extractTask = useTaskProgress(jobId, {
    onDone: (task) => {
      if (task.status === "completed") {
        toast.success(STR.extracted);
        navigate(`/catalogues/versions/${id}/review`);
      } else if (byHand.current) navigate(`/catalogues/versions/${id}/review`); // AI off: the pages are read, the products get typed
      else setActionError(task.error || STR.extractFailed);
    },
  });

  const pages = useMemo(() => data?.pages || [], [data]);
  const pageCount = data?.pageCount || 0;

  const apply = useCallback(
    (next) => {
      if (!canManage) return;
      setKept(next);
      setRangeText(formatRange([...next]));
      setRangeInvalid([]);
      setActionError(null);
    },
    [canManage]
  );
  const toggle = useCallback(
    (n) => {
      const next = new Set(kept);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      apply(next);
    },
    [kept, apply]
  );

  const onRangeChange = (text) => {
    if (!canManage) return;
    setRangeText(text);
    const { pages: list, invalid } = parseRange(text, pageCount);
    setRangeInvalid(invalid);
    setKept(new Set(list));
    setActionError(null);
  };

  const visiblePages = pages.filter((p) => (filter === "kept" ? kept.has(p.number) : filter === "skipped" ? !kept.has(p.number) : true));
  const move = useCallback((d) => setCurrent((c) => Math.min(Math.max(1, c + d), pageCount || 1)), [pageCount]);

  // keyboard: ← → move the preview, Space keeps / skips it (not while typing in a field)
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.closest("input, textarea, select, [contenteditable=true]") || (e.key === " " && t.closest("button")))) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === " " && pageCount) {
        e.preventDefault();
        toggle(current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, toggle, current, pageCount]);

  const save = async () => {
    const res = await saveCataloguePageSelection(scope, id, [...kept].sort((a, b) => a - b));
    setData((d) => (d ? { ...d, selection: res.selection, estimate: res.estimate } : d));
    return res;
  };

  const onLater = async () => {
    setBusy("save");
    setActionError(null);
    try {
      await save();
      toast.success(STR.saved);
      navigate("/catalogues");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const onExtract = async ({ handTyped = false } = {}) => {
    setBusy("extract");
    setActionError(null);
    byHand.current = handTyped;
    try {
      await save();
      const res = await extractCatalogueVersion(scope, id, {});
      setJobId(res.jobId);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const onReplace = async (file) => {
    if (!file || !data?.version?.catalogue?.id) return;
    setBusy("replace");
    setActionError(null);
    try {
      const res = await uploadCatalogueVersion(scope, data.version.catalogue.id, { file });
      navigate(`/catalogues/versions/${res.versionId}/pages`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  };

  // ── states ──
  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800" role="alert" data-testid="pages-failed">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> {STR.failed}
        </p>
        <p className="mt-1">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> {STR.retry}
          </Button>
          <Link to="/catalogues" className="self-center font-medium text-blue-700 hover:underline">
            {STR.back}
          </Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-sm text-gray-600" data-testid="pages-loading">
        <Spinner />
        {STR.loading}
      </div>
    );
  }

  const keptCount = kept.size;
  const readBefore = data.version.extraction?.pages || [];
  const removed = readBefore.filter((n) => !kept.has(n));
  const previous = data.previousSelection?.pages || null;
  const est = estimateFor(pages, kept, data.estimate);
  const page = pages.find((p) => p.number === current) || pages[0];
  const isKept = page && kept.has(page.number);
  const extracting = !!jobId && !extractTask.done;
  const locked = !canManage || extracting || busy !== null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/catalogues" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {STR.back}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{STR.subtitle}</p>
        </div>
        <CatalogueSteps current={jobId ? 3 : 2} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-700">PDF</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{data.version.file?.name || `${data.version.catalogue?.manufacturer} · ${data.version.label}`}</div>
          <div className="text-xs text-gray-500">{STR.fileMeta(pageCount, fmtSize(data.version.file?.sizeBytes))}</div>
          {data.version.extraction?.pages && <div className="text-xs text-gray-500">{STR.extractedBefore(formatRange(data.version.extraction.pages))}</div>}
        </div>
        {canManage && (
          <>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onReplace(e.target.files?.[0])} data-testid="replace-file" />
            <Button variant="secondary" className="!py-2 text-sm" onClick={() => fileInput.current?.click()} disabled={locked} isLoading={busy === "replace"}>
              {STR.replace}
            </Button>
          </>
        )}
        {busy === "replace" && (
          <span className="flex w-full items-center gap-2 text-xs text-gray-600">
            <Spinner size="sm" /> {STR.replacing}
          </span>
        )}
      </div>

      {!canManage && <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{STR.readOnly}</p>}

      {pageCount === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-600" data-testid="pages-empty">
          {STR.empty}
        </p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-label="Pages" className="rounded-xl border border-gray-200 bg-white">
            <div className="space-y-3 border-b border-gray-100 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{STR.quick}</span>
                {[
                  ...(previous ? [[STR.samePages, () => apply(new Set(previous)), "quick-same"]] : []),
                  [STR.all, () => apply(new Set(pages.map((p) => p.number))), "quick-all"],
                  [STR.none, () => apply(new Set()), "quick-none"],
                  [STR.invert, () => apply(new Set(pages.filter((p) => !kept.has(p.number)).map((p) => p.number))), "quick-invert"],
                ].map(([label, fn, testId]) => (
                  <button
                    key={testId}
                    type="button"
                    onClick={fn}
                    disabled={locked}
                    data-testid={testId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
                <div role="group" aria-label="Show" className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
                  {[
                    ["all", STR.show.all, pageCount],
                    ["kept", STR.show.kept, keptCount],
                    ["skipped", STR.show.skipped, pageCount - keptCount],
                  ].map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                      data-testid={`filter-${key}`}
                      className={`px-3 py-1.5 font-medium ${filter === key ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      {label} · {n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                {STR.pagesLabel}
                <input
                  value={rangeText}
                  onChange={(e) => onRangeChange(e.target.value)}
                  readOnly={locked}
                  aria-describedby="rangehint"
                  aria-invalid={rangeInvalid.length > 0}
                  data-testid="page-range"
                  className={`min-h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm font-normal ${rangeInvalid.length ? "border-red-400" : "border-gray-300"}`}
                />
                <span id="rangehint" className={`w-full text-xs font-normal ${rangeInvalid.length ? "text-red-700" : "text-gray-500"}`}>
                  {rangeInvalid.length ? STR.rangeInvalid(rangeInvalid) : STR.rangeHint}
                </span>
              </label>
              {keptCount === 0 && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800" data-testid="nothing-chosen">
                  {STR.nothingYet}
                </p>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-4" data-testid="page-grid">
              {visiblePages.map((p) => (
                <Thumb
                  key={p.number}
                  page={p}
                  kept={kept.has(p.number)}
                  active={p.number === current}
                  onToggle={() => {
                    setCurrent(p.number);
                    if (!locked) toggle(p.number);
                  }}
                  onPreview={() => setCurrent(p.number)}
                  loader={loader}
                />
              ))}
            </div>
          </section>

          <aside className="space-y-5 lg:sticky lg:top-4">
            {page && (
              <section aria-label="Page preview" className="rounded-xl border border-gray-200 bg-white p-4" data-testid="page-preview">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => move(-1)} disabled={current <= 1} aria-label="Previous page" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-800" data-testid="preview-page">
                    {STR.pageOf(page.number, pageCount)}
                  </span>
                  <button type="button" onClick={() => move(1)} disabled={current >= pageCount} aria-label="Next page" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={isKept}
                    onClick={() => toggle(page.number)}
                    disabled={locked}
                    data-testid="preview-toggle"
                    className={`ml-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${isKept ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700"}`}
                  >
                    {isKept && <Check className="h-3.5 w-3.5" />} {isKept ? STR.kept : STR.keep}
                  </button>
                </div>
                <div className={`mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${isKept ? "" : "opacity-60"}`} style={{ aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : "3 / 4" }}>
                  <PageImage url={page.previewUrl} loader={loader} alt={STR.pageOf(page.number, pageCount)} className="h-full w-full" />
                </div>
                <p className="mt-3 text-sm text-gray-600" data-testid="preview-reason">
                  {isKept ? STR.keptWhy : STR.skippedWhy}
                </p>
              </section>
            )}

            <section aria-labelledby="sum" className="space-y-4 rounded-xl border border-gray-200 bg-white p-4" data-testid="pages-summary">
              <h2 id="sum" className="text-lg font-semibold text-gray-900">
                {STR.willRead(keptCount, pageCount)}
              </h2>
              <div role="progressbar" aria-label="Pages kept" aria-valuenow={keptCount} aria-valuemin={0} aria-valuemax={pageCount} className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pageCount ? (100 * keptCount) / pageCount : 0}%` }} />
              </div>
              {removed.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="removed-note">
                  {STR.removed(formatRange(removed))}
                </p>
              )}
              {est && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">{STR.tokens}</div>
                    <div className="text-xl font-bold text-gray-900" data-testid="est-tokens">
                      {fmtTokens(est.selTokens)}
                    </div>
                    <div className="text-xs text-gray-500">{STR.allPages(fmtTokens(est.allTokens))}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">{STR.cost}</div>
                    <div className="text-xl font-bold text-gray-900" data-testid="est-cost">
                      {fmtUsd(est.selCost)}
                    </div>
                    <div className="text-xs text-gray-500" data-testid="est-saved">
                      {keptCount === 0 ? STR.chooseFirst : est.selCost === null ? `${STR.less(est.saved)} · ${STR.noPrice}` : STR.less(est.saved)}
                    </div>
                  </div>
                  <p className="col-span-2 text-xs text-gray-500">{data.estimate.basis === "ledger" ? STR.basisLedger(data.estimate.sample?.calls || 0) : STR.basisConstant}</p>
                </div>
              )}
              <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
                {STR.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {actionError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" data-testid="pages-error">
                  {actionError}
                </p>
              )}
              {extracting && (
                <div className="flex items-center gap-2 text-sm text-gray-700" data-testid="extract-progress">
                  <Spinner size="sm" /> {extractTask.message || STR.extracting}
                </div>
              )}
              {canManage && (
                <div className="flex flex-col gap-2">
                  <AiAction className="flex">
                    <Button onClick={() => onExtract()} disabled={keptCount === 0 || rangeInvalid.length > 0 || locked} isLoading={busy === "extract" || extracting} className="w-full" data-testid="extract-pages">
                      {keptCount === 0 ? STR.chooseToExtract : STR.extract(keptCount)}
                    </Button>
                  </AiAction>
                  {!aiAvailable && (
                    <Button variant="secondary" onClick={() => onExtract({ handTyped: true })} disabled={keptCount === 0 || rangeInvalid.length > 0 || locked} className="w-full" data-testid="read-by-hand">
                      {STR.byHand}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={onLater} disabled={keptCount === 0 || rangeInvalid.length > 0 || locked} isLoading={busy === "save"} className="w-full" data-testid="save-later">
                    {STR.later}
                  </Button>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <FileText className="h-3.5 w-3.5" /> {data.version.catalogue?.manufacturer} · {data.version.label}
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
