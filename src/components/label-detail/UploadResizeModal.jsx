import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, FileText, AlertTriangle, Download, CheckCircle2, Ruler } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { openPdf } from "../catalogues/openPdf";
import FitList from "./FitList";
import DesignResize from "./DesignResize";
import { sizeAr } from "./resizeText";
import { getLayoutSizes, uploadLabelToResize, getLabelUpload, confirmLabelUpload, downloadLayoutPdf, layoutFileUrl } from "../../services/apiLabelLayout";

// Labels list (or a label's page) → "غيّر المقاس": a label the client has as a
// file (PDF, Illustrator .ai, PNG, JPEG), at other sizes. Two ways, per upload:
//   غيّر المقاس مع الحفاظ على التصميم (the default) — the file's own design at the
//     new sizes: the editor (DesignResize) previews each size beside the
//     original, lets the person adjust, and saves one PDF per size. An image can
//     only be scaled whole (proportions kept).
//   ليبل جديد من النص (بدون التصميم) (only when chosen) — the label's text is read
//     by AI and re-typed in a plain layout WITHOUT the original design; every
//     field is shown to check, the empty ones listed (nothing is filled in);
//     after confirming it is laid out at the new size like any label.
// A reference label upload never comes here: this is only for changing a size.

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
  if (failed) return <p className="w-64 text-xs text-gray-500">لا معاينة ({failed}). يمكن تنزيل ملف PDF.</p>;
  return <canvas ref={ref} className="bg-white shadow ring-1 ring-gray-300" aria-label="PDF preview" data-testid="pdf-preview" />;
}

// designOnly (a label's page): the label's design file is added to that label — the
// label exists, so there is no "new label from the text" here, and its company is fixed.
export default function UploadResizeModal({ onClose, isSystem, companies = [], labelId = null, labelName = null, designOnly = false, onDone }) {
  const navigate = useNavigate();
  const [sizes, setSizes] = useState(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("smart");
  const [preset, setPreset] = useState("100x120");
  const [custom, setCustom] = useState({ w: 10, h: 12 });
  const [country, setCountry] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [upload, setUpload] = useState(null); // GET /label-uploads/:id
  const [layout, setLayout] = useState(null); // the result (an image scaled, or rebuild after confirm)
  const [edits, setEdits] = useState({});
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const drop = useRef(null);
  const params = isSystem ? { companyId } : {};

  useEffect(() => {
    getLayoutSizes().then(setSizes).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (isSystem && !companyId && companies[0]) setCompanyId(companies[0].id);
  }, [isSystem, companies, companyId]);
  // a rebuild is read in the background: poll until it is ready for review
  useEffect(() => {
    if (!upload || upload.upload.status !== "extracting") return undefined;
    const t = setInterval(() => getLabelUpload(upload.upload.id, params).then(setUpload).catch(() => {}), 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isImage = !!file && ["image/png", "image/jpeg"].includes(file.type);
  const needsSize = mode === "rebuild" || isImage; // the design editor picks its sizes itself
  const size = preset === "custom" ? { widthMm: Number(custom.w) * 10, heightMm: Number(custom.h) * 10 } : { preset };
  const pick = (f) => {
    if (!f) return;
    const ok = ["application/pdf", "image/png", "image/jpeg"].includes(f.type) || /\.ai$/i.test(f.name);
    if (!ok) return setError("ارفع ملف PDF أو Illustrator (.ai) أو صورة PNG/JPEG");
    if (f.size > 40 * 1024 * 1024) return setError("الملف أكبر من 40 ميجا");
    setError(null);
    setFile(f);
  };
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await uploadLabelToResize({
        file,
        mode,
        layout: needsSize ? size : {},
        // the design only: the editor previews and saves the sizes
        ...(mode === "smart" && !isImage ? { sizes: [] } : {}),
        labelId: mode === "smart" ? labelId : null,
        country: country || null,
        companyId: isSystem ? companyId : null,
      });
      if (out.layout) setLayout(out.layout);
      setUpload(await getLabelUpload(out.upload.id, params));
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
      toast.success("رُتّب الليبل على المقاس الجديد");
      setUpload(await getLabelUpload(upload.upload.id, params));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const status = upload?.upload.status;
  const reviewing = mode === "rebuild" && status === "review" && !layout;
  const editing = upload && upload.upload.mode === "smart" && upload.upload.mimeType === "application/pdf";
  const name = labelName || file?.name?.replace(/\.[^.]+$/, "") || "label";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="غيّر المقاس">
      <div dir="rtl" className={`bg-white rounded-2xl shadow-xl w-full ${editing ? "max-w-6xl" : "max-w-3xl"} flex flex-col max-h-[94vh]`}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-blue-600" /> غيّر المقاس{labelName ? ` · ${labelName}` : ""}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
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
                    <FileText className="w-4 h-4" /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} ميجا
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">اسحب ملف الليبل هنا (PDF أو Illustrator ‎.ai أو صورة)، أو</p>
                )}
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Upload className="w-4 h-4" /> اختر ملفًا
                  <input type="file" accept="application/pdf,.ai,image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="ملف الليبل" />
                </label>
              </div>

              {!designOnly && (
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-gray-700">الطريقة</legend>
                <label className={`rounded-xl border px-3 py-2 text-sm ${mode === "smart" ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                  <input type="radio" name="mode" className="ml-2" checked={mode === "smart"} onChange={() => setMode("smart")} data-testid="mode-smart" />
                  <b>غيّر المقاس مع الحفاظ على التصميم</b> <span className="text-xs text-blue-700">الأساسي</span>
                  <span className="block text-xs text-gray-500 mt-1">نفس الرسومات والألوان والخطوط والكلمات. تشوف النتيجة جنب الأصل قبل الحفظ، وتقدر تعدّل مكان أي جزء.</span>
                  {isImage && <span className="mt-1 block text-xs text-amber-800">هذه صورة: تُكبَّر أو تُصغَّر كلها بنفس نسبها.</span>}
                </label>
                <label className={`rounded-xl border px-3 py-2 text-sm ${mode === "rebuild" ? "border-amber-600 bg-amber-50" : "border-gray-200"}`}>
                  <input type="radio" name="mode" className="ml-2" checked={mode === "rebuild"} onChange={() => setMode("rebuild")} data-testid="mode-rebuild" />
                  <b>ليبل جديد من النص (بدون التصميم)</b>
                  <span className="block text-xs text-gray-500 mt-1">يُقرأ النص من الملف، تراجع كل الحقول، ثم يُكتب في ليبل بسيط بالمقاس الجديد.</span>
                  {mode === "rebuild" && <span className="mt-1 block text-xs font-medium text-amber-800">لا يُحفظ التصميم الأصلي: لا رسومات ولا ألوان ولا شعار — النص فقط.</span>}
                </label>
              </fieldset>
              )}
              {designOnly && isImage && <p className="text-xs text-amber-800">هذه صورة: تُكبَّر أو تُصغَّر كلها بنفس نسبها. لتغيير النسب ارفع ملف PDF أو ‎.ai.</p>}

              {needsSize && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-700">المقاس الجديد</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.presets.map((p) => (
                      <button key={p.key} type="button" onClick={() => setPreset(p.key)} aria-pressed={preset === p.key} className={`rounded-lg border px-3 py-1.5 text-sm ${preset === p.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}>
                        {sizeAr(p.widthMm, p.heightMm)}
                      </button>
                    ))}
                    <button type="button" onClick={() => setPreset("custom")} aria-pressed={preset === "custom"} className={`rounded-lg border px-3 py-1.5 text-sm ${preset === "custom" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"}`}>
                      مقاس آخر
                    </button>
                    {preset === "custom" && (
                      <span className="flex items-center gap-1 text-sm">
                        <input type="number" min={2} step={0.1} value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label="العرض بالسنتيمتر" /> ×
                        <input type="number" min={2} step={0.1} value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label="الطول بالسنتيمتر" /> سم
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {isSystem && !designOnly && (
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">الشركة</span>
                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label="الشركة">
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-600 mb-1">البلد (اختياري، لأصغر حجم نص تسمح به قواعده)</span>
                  <input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="مثال: EG" className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label="البلد" dir="ltr" />
                </label>
              </div>
            </>
          )}

          {editing && <DesignResize uploadId={upload.upload.id} params={params} labelName={name} layouts={upload.layouts || []} onSaved={onDone} />}

          {upload && status === "extracting" && (
            <p className="flex items-center gap-2 text-sm text-gray-700" role="status">
              <Spinner size="sm" /> جارٍ قراءة الليبل… {upload.task?.message || ""}
            </p>
          )}
          {upload && status === "failed" && <p className="text-sm text-red-600" role="alert">{upload.upload.error}</p>}

          {reviewing && upload.label && (
            <div className="space-y-3" data-testid="rebuild-review">
              <p className="text-sm text-gray-700">راجع ما قُرئ من الملف وصحّح أي خطأ. الحقول الفارغة تبقى فارغة إلا إذا كتبتها — لم يُملأ شيء من عندنا.</p>
              <div className="grid gap-3" dir="ltr">
                {upload.label.fields.map((f) => {
                  const value = edits[f.field] ?? (f.field === "activeIngredients" ? ingredientsText(f.value) : shown(f.value));
                  const multi = ["activeIngredients", "warnings", "userSafety", "indications", "directionOfUse", "aimOfUse", "contraindications"].includes(f.field);
                  return (
                    <label key={f.field} className="block text-sm">
                      <span className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
                        {FIELD_LABEL(f.field)}
                        {!f.read && !edits[f.field] && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">ليس في الملف</span>}
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
              {layout.hasPdf && pdfUrl ? <PdfPreview url={pdfUrl} /> : pngUrl ? <img src={pngUrl} alt="معاينة" className="w-64 bg-white shadow ring-1 ring-gray-300" /> : <Spinner />}
              <div className="min-w-60 flex-1 space-y-2 text-sm">
                <p className="font-semibold text-gray-900">{sizeAr(layout.widthMm, layout.heightMm)}</p>
                {layout.mode === "scale" ? (
                  <>
                    {layout.fit.scalePct !== null && <p>بنفس النسب: {layout.fit.scalePct}%</p>}
                    <p>أصغر نص: {layout.fit.textMeasurable ? `${layout.fit.smallestTextPt} نقطة` : "لا يمكن قياسه (صورة)"}</p>
                    {layout.fit.belowMinimum && <p className="text-amber-800">⚠ أصغر نص أقل من الحد الأدنى {layout.fit.minFontPt} نقطة — مقاس أكبر يبقيه مقروءًا.</p>}
                  </>
                ) : layout.fit.fits ? (
                  <p className="flex items-center gap-1.5 font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> يتّسع · خط {layout.fit.fontPt} نقطة · أصغر نص {layout.fit.smallestTextPt} نقطة
                  </p>
                ) : (
                  <p className="font-semibold text-red-700">لا يتّسع — لم يُعمل PDF. اختر مقاسًا أكبر.</p>
                )}
                {layout.mode !== "scale" && <FitList fit={layout.fit} />}
              </div>
            </div>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
              <AlertTriangle className="w-4 h-4" /> {error}
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-start gap-3 rounded-b-2xl">
          {!upload && (
            <Button onClick={start} disabled={!file || busy || (isSystem && !companyId)} isLoading={busy} data-testid="resize-start">
              {mode === "rebuild" ? "اقرأ الليبل" : isImage ? "غيّر المقاس" : "متابعة"}
            </Button>
          )}
          {reviewing && (
            <Button onClick={confirm} isLoading={busy} data-testid="resize-confirm">
              تأكيد الحقول وترتيب الليبل
            </Button>
          )}
          {layout?.hasPdf && (
            <Button onClick={() => downloadLayoutPdf(layout, name).catch((e) => toast.error(e.message))} data-testid="resize-download">
              <Download className="w-4 h-4" /> تنزيل PDF
            </Button>
          )}
          {layout?.labelId && (
            <Button variant="secondary" onClick={() => navigate(`/labels/detail/${layout.labelId}?tab=layout`)}>
              افتح الليبل
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {layout || editing ? "إغلاق" : "إلغاء"}
          </Button>
        </div>
      </div>
    </div>
  );
}
