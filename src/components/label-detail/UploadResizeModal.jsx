import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, FileText, AlertTriangle, Download, CheckCircle2, Ruler } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { openPdf } from "../catalogues/openPdf";
import { FitList } from "./LayoutSizeTab";
import { getLayoutSizes, uploadLabelToResize, getLabelUpload, confirmLabelUpload, downloadLayoutPdf, layoutFileUrl } from "../../services/apiLabelLayout";

// Labels list → "Upload label to resize": a label the client already has as a
// file (PDF, PNG, JPEG), at another size. Two ways, chosen per upload:
//   Keep the original design, just scale (the default) — the file on the new
//     page, proportions kept; the scale, the smallest text after scaling and a
//     warning below the minimum. "Stretch to fill" only with its warning.
//   Rebuild (only when chosen) — the label's text is read by AI and re-typed in
//     a plain layout WITHOUT the original design; every field is shown to check,
//     the empty ones listed (nothing is filled in); after "Confirm" it is laid
//     out at the new size like any label.

const FIELD_LABEL = (f) => f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const shown = (v) => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => x?.translations?.en ?? (x?.name || x)).map((x) => [x, ""].join("")).join("\n");
  if (typeof v === "object") return v.list ? v.list.join(", ") : v.translations?.en ?? "";
  return String(v);
};
const ingredientsText = (v) => (Array.isArray(v) ? v.map((i) => [i?.translations?.en, i?.amount, i?.unit].filter(Boolean).join(" ")).join("\n") : "");

/** First page of a PDF (blob URL or ArrayBuffer) drawn at `widthPx`. */
function PdfPreview({ url, widthPx = 260 }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const buf = await (await fetch(url)).arrayBuffer();
      const doc = await openPdf(buf);
      const page = await doc.getPage(1);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (widthPx / vp0.width) * (window.devicePixelRatio || 1) });
      const c = ref.current;
      if (!alive || !c) return;
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${widthPx}px`;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      if (alive) c.dataset.rendered = "true";
    })().catch((e) => alive && setFailed(e.message || "The preview couldn't be drawn"));
    return () => {
      alive = false;
    };
  }, [url, widthPx]);
  if (failed) return <p className="w-64 text-xs text-gray-500">No preview ({failed}). The PDF can still be downloaded.</p>;
  return <canvas ref={ref} className="bg-white shadow ring-1 ring-gray-300" aria-label="PDF preview" data-testid="pdf-preview" />;
}

export default function UploadResizeModal({ onClose, isSystem, companies = [] }) {
  const navigate = useNavigate();
  const [sizes, setSizes] = useState(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("scale");
  const [preset, setPreset] = useState("100x120");
  const [custom, setCustom] = useState({ w: 10, h: 12 });
  const [stretch, setStretch] = useState(false);
  const [country, setCountry] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [upload, setUpload] = useState(null); // GET /label-uploads/:id
  const [layout, setLayout] = useState(null); // the result (scale, or rebuild after confirm)
  const [edits, setEdits] = useState({});
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const drop = useRef(null);

  useEffect(() => {
    getLayoutSizes().then(setSizes).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (isSystem && !companyId && companies[0]) setCompanyId(companies[0].id);
  }, [isSystem, companies, companyId]);
  // a rebuild is read in the background: poll until it is ready for review
  useEffect(() => {
    if (!upload || upload.upload.status !== "extracting") return undefined;
    const t = setInterval(() => getLabelUpload(upload.upload.id, isSystem ? { companyId } : {}).then(setUpload).catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [upload, isSystem, companyId]);
  useEffect(() => {
    if (!layout) return undefined;
    let alive = true;
    const urls = [];
    // a URL that arrives after this effect was cleaned up is revoked, never shown
    const keep = (set) => (u) => {
      urls.push(u);
      if (alive) set(u);
      else URL.revokeObjectURL(u);
    };
    if (layout.hasPdf) layoutFileUrl(layout.pdfUrl).then(keep(setPdfUrl)).catch((e) => setError(e.message));
    if (layout.previewUrl) layoutFileUrl(layout.previewUrl).then(keep(setPngUrl)).catch(() => {});
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [layout]);

  const size = preset === "custom" ? { widthMm: Number(custom.w) * 10, heightMm: Number(custom.h) * 10 } : { preset };
  const pick = (f) => {
    if (!f) return;
    if (!["application/pdf", "image/png", "image/jpeg"].includes(f.type)) return setError("Upload a PDF, PNG or JPEG label");
    setError(null);
    setFile(f);
  };
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await uploadLabelToResize({ file, mode, layout: size, stretch: mode === "scale" && stretch, country: country || null, companyId: isSystem ? companyId : null });
      if (out.layout) setLayout(out.layout);
      setUpload(await getLabelUpload(out.upload.id, isSystem ? { companyId } : {}));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await confirmLabelUpload(upload.upload.id, { fields: edits, layout: size });
      setLayout(out.layout);
      toast.success("Laid out at the new size");
      setUpload(await getLabelUpload(upload.upload.id, isSystem ? { companyId } : {}));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const status = upload?.upload.status;
  const reviewing = mode === "rebuild" && status === "review" && !layout;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Upload label to resize">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-600" /> Upload label to resize
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {!sizes && <Spinner />}
          {sizes && !upload && (
            <>
              <div
                ref={drop}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  pick(e.dataTransfer.files?.[0]);
                }}
                className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center"
                data-testid="resize-dropzone"
              >
                {file ? (
                  <p className="flex items-center justify-center gap-2 text-sm text-gray-800">
                    <FileText className="w-4 h-4" /> {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Drop the label here (PDF, PNG or JPEG), or</p>
                )}
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload className="w-4 h-4" /> Choose a file
                  <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Label file" />
                </label>
              </div>

              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-gray-700">How</legend>
                <label className={`rounded-xl border px-3 py-2 text-sm ${mode === "scale" ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                  <input type="radio" name="mode" className="mr-2" checked={mode === "scale"} onChange={() => setMode("scale")} />
                  <b>Keep the original design, just scale</b> <span className="text-xs text-blue-700">default</span>
                  <span className="block text-xs text-gray-500 mt-1">The file placed on the new page, proportions kept — the artwork, colours and logo stay as they are; text gets smaller or larger with it.</span>
                </label>
                <label className={`rounded-xl border px-3 py-2 text-sm ${mode === "rebuild" ? "border-amber-600 bg-amber-50" : "border-gray-200"}`}>
                  <input type="radio" name="mode" className="mr-2" checked={mode === "rebuild"} onChange={() => setMode("rebuild")} />
                  <b>Rebuild: re-type the text</b>
                  <span className="block text-xs text-gray-500 mt-1">The text is read by AI (about 1 call), you check every field, then it is laid out in a plain layout to fit the new size.</span>
                  {mode === "rebuild" && <span className="mt-1 block text-xs font-medium text-amber-800">The original design is not kept: no artwork, colours or logo. Only the text.</span>}
                </label>
              </fieldset>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">New size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.presets.map((p) => (
                    <button key={p.key} type="button" onClick={() => setPreset(p.key)} aria-pressed={preset === p.key} className={`rounded-lg border px-3 py-1.5 text-sm ${preset === p.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}>
                      {p.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPreset("custom")} aria-pressed={preset === "custom"} className={`rounded-lg border px-3 py-1.5 text-sm ${preset === "custom" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}>
                    Custom
                  </button>
                  {preset === "custom" && (
                    <span className="flex items-center gap-1 text-sm">
                      <input type="number" min={2} step={0.1} value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label="Width in cm" /> ×
                      <input type="number" min={2} step={0.1} value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label="Height in cm" /> cm
                    </span>
                  )}
                </div>
              </div>

              {mode === "scale" && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={stretch} onChange={(e) => setStretch(e.target.checked)} />
                  <span>
                    Stretch to fill the page
                    {stretch && <span className="block text-xs text-red-700">This distorts the text (wider or taller than designed). Use only if you have checked it is still legible.</span>}
                  </span>
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {isSystem && (
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">Company</span>
                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label="Company">
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-600 mb-1">Country (optional, for its minimum text size rule)</span>
                  <input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="e.g. EG" className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label="Country" />
                </label>
              </div>
            </>
          )}

          {upload && status === "extracting" && (
            <p className="flex items-center gap-2 text-sm text-gray-700" role="status">
              <Spinner size="sm" /> Reading the label… {upload.task?.message || ""}
            </p>
          )}
          {upload && status === "failed" && <p className="text-sm text-red-600" role="alert">{upload.upload.error}</p>}

          {reviewing && upload.label && (
            <div className="space-y-3" data-testid="rebuild-review">
              <p className="text-sm text-gray-700">Check what was read from the file. Correct anything that's wrong; empty fields stay empty unless you type them. Nothing was filled in by the AI.</p>
              <div className="grid gap-3">
                {upload.label.fields.map((f) => {
                  const value = edits[f.field] ?? (f.field === "activeIngredients" ? ingredientsText(f.value) : shown(f.value));
                  const multi = ["activeIngredients", "warnings", "userSafety", "indications", "directionOfUse", "aimOfUse", "contraindications"].includes(f.field);
                  return (
                    <label key={f.field} className="block text-sm">
                      <span className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                        {FIELD_LABEL(f.field)}
                        {!f.read && !edits[f.field] && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">not on the file</span>}
                      </span>
                      {multi ? (
                        <textarea rows={Math.min(5, Math.max(2, value.split("\n").length))} value={value} onChange={(e) => setEdits({ ...edits, [f.field]: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" />
                      ) : (
                        <input value={value} onChange={(e) => setEdits({ ...edits, [f.field]: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {layout && (
            <div className="flex flex-wrap items-start gap-6" data-testid="resize-result">
              {layout.hasPdf && pdfUrl ? <PdfPreview url={pdfUrl} /> : pngUrl ? <img src={pngUrl} alt="Layout preview" className="w-64 bg-white shadow ring-1 ring-gray-300" /> : <Spinner />}
              <div className="min-w-60 flex-1 space-y-2 text-sm">
                <p className="font-semibold text-gray-900">{layout.size}</p>
                {layout.mode === "scale" ? (
                  <>
                    {layout.fit.scalePct !== null && <p>Scaled to {layout.fit.scalePct} %{layout.fit.stretch ? " (stretched)" : ""}</p>}
                    <p>Smallest text: {layout.fit.textMeasurable ? `${layout.fit.smallestTextPt} pt` : "can't be measured"}</p>
                  </>
                ) : layout.fit.fits ? (
                  <p className="flex items-center gap-1.5 font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Fits · {layout.fit.fontPt} pt · smallest text {layout.fit.smallestTextPt} pt
                  </p>
                ) : (
                  <p className="font-semibold text-red-700">Doesn't fit — no PDF. Choose a larger size.</p>
                )}
                <FitList fit={layout.fit} />
                {(layout.fit.warnings || []).map((w) => (
                  <p key={w} className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                  </p>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>
            {layout ? "Close" : "Cancel"}
          </Button>
          {!upload && (
            <Button onClick={start} disabled={!file || busy || (isSystem && !companyId)} isLoading={busy} data-testid="resize-start">
              {mode === "rebuild" ? "Read the label" : "Scale"}
            </Button>
          )}
          {reviewing && (
            <Button onClick={confirm} isLoading={busy} data-testid="resize-confirm">
              Confirm fields and lay out
            </Button>
          )}
          {layout?.hasPdf && (
            <Button onClick={() => downloadLayoutPdf(layout, file?.name?.replace(/\.[^.]+$/, "") || "label").catch((e) => toast.error(e.message))} data-testid="resize-download">
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          )}
          {layout?.labelId && (
            <Button variant="secondary" onClick={() => navigate(`/labels/detail/${layout.labelId}?tab=layout`)}>
              Open the label
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
