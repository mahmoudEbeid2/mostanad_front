import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, FileText, UploadCloud, X } from "lucide-react";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import CompanyPicker from "../certificates/CompanyPicker";
import CatalogueSteps from "./CatalogueSteps";
import { getBrands } from "../../services/apiBrands";
import { uploadCatalogue } from "../../services/apiCatalogues";

// Step 1 of a catalogue upload (design C0): drop zone, details, the upload with its
// real % and a Cancel, then the quick check of the PDF (the request's answer: the
// server opens the file and counts its pages). Nothing is read by AI here.
const MAX_BYTES = 60 * 1024 * 1024;
const STR = {
  title: "Upload a catalogue",
  subtitle: "The file is kept as the source. Nothing changes in your products until you review and apply.",
  drop: "Drop the catalogue PDF here",
  browse: "or browse your files",
  dropHint: "PDF with selectable text · up to 60 MB · one file",
  notPdf: "That isn't a PDF — choose a .pdf file.",
  tooBig: (mb) => `This file is ${mb} MB — the limit is 60 MB.`,
  oneFile: "Drop one file at a time.",
  ready: "ready to upload",
  change: "Change file",
  details: "Details",
  detailsHint: "company is required, the rest is optional",
  brand: "Brand",
  noBrand: "No brand",
  edition: "Edition",
  editionHint: "e.g. 2025–2026",
  manufacturer: "Manufacturer",
  manufacturerHint: "defaults to the brand",
  upload: "Upload",
  needFile: "Choose a PDF first.",
  needCompany: "Pick the company first.",
  noAi: "No AI is used until you choose pages and click Extract.",
  cancel: "Cancel upload",
  uploading: "Uploading…",
  keepOpen: "Keep this tab open until the upload finishes.",
  checking: "Checking the PDF…",
  checkingHint: "A few seconds — only the pages are counted.",
  stageUpload: "Upload the file",
  stageCheck: "Check the PDF",
  ofMb: (a, b, left) => `${a} of ${b} MB${left ? ` · about ${left} left` : ""}`,
  uploaded: (mb) => `${mb} MB uploaded`,
  afterUpload: "after the upload",
  counting: "counting pages…",
  opensFine: (n) => `${n} pages · opens fine, not password-protected`,
  done: (n) => `Uploaded — ${n} pages`,
  next: "Next: click the pages that have products.",
  choose: "Choose pages →",
  chooseWaiting: "Available as soon as the upload is checked.",
  chooseHint: "Thumbnails load as you scroll. You can also come back later from Catalogues.",
  failedCheck: "The file couldn't be opened",
  failedUpload: "The upload didn't finish",
  stopped: (name) => `stopped at “${name}”`,
  another: "Upload another file",
  retry: "Try again",
  whatNext: "What happens after the upload",
  steps: [
    ["Check the file", "seconds. The pages are counted. Nothing is read by AI."],
    ["Choose pages", "you. Click the pages that have products; skip covers and blank pages to save AI cost."],
    ["Extract", "Only the chosen pages are read and sent to the AI."],
    ["Review & apply", "You confirm every product before it changes."],
  ],
};

const mb = (bytes) => (bytes / 1e6).toFixed(1);
const fmtLeft = (s) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.max(1, Math.round(s))} s`);

function checkFile(file) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return STR.notPdf;
  if (file.size > MAX_BYTES) return STR.tooBig(mb(file.size));
  return null;
}

function StageRow({ state, title, detail, percent }) {
  return (
    <li className="flex items-center gap-3 text-sm" data-testid="upload-stage" data-state={state}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-emerald-100 text-emerald-700" : state === "running" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
        {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : state === "running" ? <Spinner size="sm" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${state === "waiting" ? "text-gray-500" : "text-gray-900"}`}>{title}</span>
        <span className="block text-xs text-gray-500">{detail}</span>
      </span>
      {percent !== undefined && <span className="text-xs font-semibold text-gray-700">{percent}%</span>}
    </li>
  );
}

/** phase: idle | uploading | checking | ready | failed. onUploaded: the list should reload · onActivity(row | null): the running upload, for the list */
export default function CatalogueUpload({ scopeState, onUploaded, onActivity }) {
  const { companyId, companyName } = scopeState;
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ manufacturer: "", brandId: "", label: "" });
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [sent, setSent] = useState({ loaded: 0, total: 0, left: null });
  const [failure, setFailure] = useState(null); // { message, stage: "upload" | "check" }
  const [result, setResult] = useState(null);
  const input = useRef(null);
  const aborter = useRef(null);
  const reachedCheck = useRef(false);

  useEffect(() => {
    if (!companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  useEffect(() => () => aborter.current?.abort(), []);

  const pick = (picked) => {
    if (!picked) return;
    const problem = checkFile(picked);
    setFileError(problem);
    setFile(problem ? null : picked);
    setFailure(null);
    setPhase("idle");
    if (input.current) input.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length > 1) return setFileError(STR.oneFile);
    pick(files?.[0]);
  };

  const start = async () => {
    if (!file || !companyId) return;
    const controller = new AbortController();
    aborter.current = controller;
    reachedCheck.current = false;
    setFailure(null);
    setSent({ loaded: 0, total: file.size, left: null });
    setPhase("uploading");
    onActivity?.({ name: file.name, percent: 0 });
    try {
      const res = await uploadCatalogue(
        { companyId, file, ...form },
        {
          signal: controller.signal,
          onProgress: ({ loaded, total, rate }) => {
            const size = total || file.size;
            setSent({ loaded, total: size, left: rate ? (size - loaded) / rate : null });
            onActivity?.({ name: file.name, percent: Math.round((90 * loaded) / size) });
            if (loaded >= size) {
              reachedCheck.current = true;
              setPhase("checking");
            }
          },
        }
      );
      setResult(res);
      setPhase("ready");
      onUploaded();
    } catch (err) {
      if (err.cancelled) return setPhase("idle");
      setFailure({ message: err.message, stage: reachedCheck.current ? "check" : "upload" });
      setPhase("failed");
    } finally {
      onActivity?.(null);
      aborter.current = null;
    }
  };

  const reset = () => {
    setFile(null);
    setFailure(null);
    setResult(null);
    setPhase("idle");
  };

  const busy = phase === "uploading" || phase === "checking";
  const overall = phase === "ready" ? 100 : phase === "checking" ? 95 : sent.total ? Math.round((90 * sent.loaded) / sent.total) : 0;
  const uploadPercent = sent.total ? Math.round((100 * sent.loaded) / sent.total) : 0;
  const summary = [companyName, form.label && `edition ${form.label}`].filter(Boolean).join(" · ");
  const field = "min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{STR.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{STR.subtitle}</p>
        </div>
        <CatalogueSteps current={phase === "ready" ? 2 : 1} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <form
          className="flex min-w-0 flex-[3_1_560px] flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5"
          data-testid="catalogue-upload"
          data-phase={phase}
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="file-input" />

          {phase === "failed" ? (
            <div className="flex flex-col gap-3" data-testid="upload-failed">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {failure.stage === "check" ? STR.failedCheck : STR.failedUpload}
                </p>
                <p className="mt-1" data-testid="upload-error">
                  {failure.message}
                </p>
              </div>
              <p className="text-xs text-gray-500" data-testid="upload-failed-stage">
                {file?.name} · {mb(file?.size || 0)} MB · {STR.stopped(failure.stage === "check" ? STR.stageCheck : STR.stageUpload)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={reset} data-testid="upload-another">
                  {STR.another}
                </Button>
                <Button type="button" onClick={start} data-testid="upload-retry">
                  {STR.retry}
                </Button>
              </div>
            </div>
          ) : !file ? (
            <div>
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                aria-describedby="drophint"
                data-testid="drop-zone"
                className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${dragging ? "border-blue-600 bg-blue-50" : "border-blue-300 bg-blue-50/40 hover:border-blue-600 hover:bg-blue-50"}`}
              >
                <UploadCloud className="mb-1 h-8 w-8 text-blue-600" aria-hidden="true" />
                <span className="font-semibold text-gray-900">{STR.drop}</span>
                <span className="text-sm text-blue-700">{STR.browse}</span>
                <span id="drophint" className="mt-1 text-xs text-gray-500">
                  {STR.dropHint}
                </span>
              </button>
              {fileError && (
                <p className="mt-2 text-sm text-red-700" role="alert" data-testid="file-error">
                  {fileError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5" data-testid="file-card">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-700">PDF</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {mb(file.size)} MB · {phase === "idle" ? STR.ready : summary}
                </div>
              </div>
              {phase === "idle" && (
                <button type="button" onClick={() => input.current?.click()} className="text-sm font-medium text-blue-600 hover:underline" data-testid="change-file">
                  {STR.change}
                </button>
              )}
              {phase === "uploading" && (
                <button type="button" onClick={() => aborter.current?.abort()} className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline" data-testid="cancel-upload">
                  <X className="h-4 w-4" aria-hidden="true" /> {STR.cancel}
                </button>
              )}
            </div>
          )}

          {phase === "idle" && (
            <>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold text-gray-900">
                  {STR.details} <span className="font-normal text-gray-500">· {STR.detailsHint}</span>
                </legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <CompanyPicker scope={scopeState} variant="field" yours={false} labelClassName="text-sm font-semibold text-gray-800" />
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
                    <span>{STR.brand}</span>
                    <select className={field} value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                      <option value="">{STR.noBrand}</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
                    <span>
                      {STR.edition} <span className="font-normal text-gray-500">· {STR.editionHint}</span>
                    </span>
                    <input className={field} value={form.label} maxLength={80} onChange={(e) => setForm({ ...form, label: e.target.value })} data-testid="field-edition" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
                    <span>
                      {STR.manufacturer} <span className="font-normal text-gray-500">· {STR.manufacturerHint}</span>
                    </span>
                    <input className={field} value={form.manufacturer} maxLength={120} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} data-testid="field-manufacturer" />
                  </label>
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!file || !companyId} data-testid="upload-submit">
                  {STR.upload}
                </Button>
                <span className="text-sm text-gray-500">{!file ? STR.needFile : !companyId ? STR.needCompany : STR.noAi}</span>
              </div>
            </>
          )}

          {(busy || phase === "ready") && (
            <div className="flex flex-col gap-4" data-testid="upload-progress">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-gray-900" aria-live="polite" data-testid="upload-title">
                    {phase === "ready" ? STR.done(result.pageCount) : phase === "checking" ? STR.checking : STR.uploading}
                  </span>
                  <span className="text-sm font-semibold text-gray-700" data-testid="upload-overall">
                    {overall}%
                  </span>
                </div>
                <div role="progressbar" aria-label="Upload" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full transition-all ${phase === "ready" ? "bg-emerald-600" : "bg-blue-600"}`} style={{ width: `${overall}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{phase === "ready" ? STR.next : phase === "checking" ? STR.checkingHint : STR.keepOpen}</p>
              </div>
              <ol className="flex flex-col gap-3">
                <StageRow
                  state={phase === "uploading" ? "running" : "done"}
                  title={STR.stageUpload}
                  detail={phase === "uploading" ? STR.ofMb(mb(sent.loaded), mb(sent.total), sent.left !== null ? fmtLeft(sent.left) : null) : STR.uploaded(mb(sent.total))}
                  percent={phase === "uploading" ? uploadPercent : undefined}
                />
                <StageRow state={phase === "ready" ? "done" : phase === "checking" ? "running" : "waiting"} title={STR.stageCheck} detail={phase === "ready" ? STR.opensFine(result.pageCount) : phase === "checking" ? STR.counting : STR.afterUpload} />
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={phase !== "ready"} onClick={() => navigate(`/catalogues/versions/${result.versionId}/pages`)} data-testid="choose-pages-next">
                  {STR.choose}
                </Button>
                <span className="text-sm text-gray-500">{phase === "ready" ? STR.chooseHint : STR.chooseWaiting}</span>
              </div>
            </div>
          )}
        </form>

        <aside className="min-w-0 flex-[2_1_320px] rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" /> {STR.whatNext}
          </h3>
          <ol className="mt-3 flex flex-col gap-3 text-sm text-gray-600">
            {STR.steps.map(([title, text], i) => (
              <li key={title} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">{i + 1}</span>
                <span>
                  <span className="font-semibold text-gray-800">{title}</span> — {text}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
