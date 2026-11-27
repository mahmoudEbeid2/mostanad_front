import { useEffect, useState } from "react";
import { Ruler, Download, Save, Eye, AlertTriangle, CheckCircle2, Upload, FileText } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import DesignResize from "./DesignResize";
import UploadResizeModal from "./UploadResizeModal";
import { sizeAr, formFrom } from "./resizeText";
import FitList from "./FitList";
import { getLayoutSizes, getLabelLayout, previewLabelLayout, saveLabelLayout, downloadLayoutPdf, layoutFileUrl } from "../../services/apiLabelLayout";
import { fmtDate, fmtDateTime, t } from "../../i18n";

// Label page → "المقاس": the label at another size.
//   غيّر المقاس (first, the default): the label's ORIGINAL design file (PDF / .ai)
//     at the new sizes — DesignResize: original beside the result, adjust, save
//     one PDF per size. No design file yet → upload it here (it stays with the label).
//   ليبل جديد من النص (بدون التصميم) (secondary, only when opened): the label's
//     text laid out in a plain layout at the new size; nothing is cut — a label
//     that doesn't fit gets no PDF and the report says which part needs how much more.

const PREVIEW_H = 420; // px: both previews share one scale, so their real proportions compare

/** A page at its real proportions: `scale` px per mm, shared by old and new. */
function PagePreview({ title, widthMm, heightMm, src, scale, children }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="text-xs font-semibold text-gray-600">{title}</figcaption>
      <div className="relative bg-white shadow ring-1 ring-gray-300" style={{ width: widthMm * scale, minHeight: heightMm * scale }}>
        {src ? <img src={src} alt={title} style={{ width: widthMm * scale, display: "block" }} /> : <div className="flex h-full items-center justify-center p-4 text-xs text-gray-400">{t("layoutSizeTab.noPreview")}</div>}
      </div>
      {children}
    </figure>
  );
}

/** "ليبل جديد من النص (بدون التصميم)": the label's text re-laid out, no artwork. */
function TextLayout({ labelId, labelName, sizes, state, reload }) {
  const [unit, setUnit] = useState("cm");
  const [form, setForm] = useState(() => formFrom(state.current, sizes.presets));
  const [preview, setPreview] = useState(null);
  const [oldImg, setOldImg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  // a new saved version moves the form to it
  useEffect(() => setForm(formFrom(state.current, sizes.presets)), [state.current?.id, sizes.presets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state?.current?.previewUrl) return undefined;
    let url = null;
    layoutFileUrl(state.current.previewUrl)
      .then((u) => setOldImg((url = u)))
      .catch(() => setOldImg(null));
    return () => url && URL.revokeObjectURL(url);
  }, [state?.current?.previewUrl]);

  const body = () => ({
    ...(form.preset !== "custom" ? { preset: form.preset } : { widthMm: Number(form.widthMm), heightMm: Number(form.heightMm) }),
    marginsMm: { top: Number(form.margin), right: Number(form.margin), bottom: Number(form.margin), left: Number(form.margin) },
    minFontPt: Number(form.minFontPt),
    maxColumns: Number(form.maxColumns),
  });
  const run = async (what) => {
    setBusy(what);
    setError(null);
    try {
      if (what === "preview") setPreview(await previewLabelLayout(labelId, body()));
      else {
        const { layout } = await saveLabelLayout(labelId, body());
        toast.success(layout.hasPdf ? t("layoutSizeTab.versionSaved", { version: layout.version, sizeAr: sizeAr(layout.widthMm, layout.heightMm) }) : t("layoutSizeTab.versionSavedItDoesntFit", { version: layout.version }));
        setPreview(null);
        await reload();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const download = (layout) => downloadLayoutPdf(layout, labelName).catch((e) => toast.error(e.message));

  const toUnit = (mm) => (unit === "cm" ? mm / 10 : mm);
  const fromUnit = (v) => (unit === "cm" ? Number(v) * 10 : Number(v));
  const old = state.current;
  const newW = preview?.new?.widthMm;
  const newH = preview?.new?.heightMm;
  const scale = PREVIEW_H / Math.max(newH || 0, old?.heightMm || 0, 1);
  const unitAr = unit === "cm" ? t("layoutSizeTab.cm") : t("layoutSizeTab.mm");

  return (
    <div className="space-y-5" data-testid="text-layout">
      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{" "}{t("layoutSizeTab.hereTheLabelsTextIs")}</p>
      <p className="text-sm text-gray-600" data-testid="text-layout-current">
        {old ? t("layoutSizeTab.savedSizeVersion", { sizeAr: sizeAr(old.widthMm, old.heightMm), version: old.version }) : t("layoutSizeTab.noSizeSavedYet")}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("layoutSizeTab.labelSize")}>
        {sizes.presets.map((p) => (
          <button key={p.key} type="button" role="radio" aria-checked={form.preset === p.key} onClick={() => setForm({ ...form, preset: p.key, widthMm: p.widthMm, heightMm: p.heightMm })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${form.preset === p.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            {sizeAr(p.widthMm, p.heightMm)}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={form.preset === "custom"} onClick={() => setForm({ ...form, preset: "custom" })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${form.preset === "custom" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{t("layoutSizeTab.anotherSize")}</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.width", { unitAr })}</span>
          <input type="number" min={2} step={unit === "cm" ? 0.1 : 1} disabled={form.preset !== "custom"} value={toUnit(form.widthMm)} onChange={(e) => setForm({ ...form, widthMm: fromUnit(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-50" aria-label={t("layoutSizeTab.width2")} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.height", { unitAr })}</span>
          <input type="number" min={2} step={unit === "cm" ? 0.1 : 1} disabled={form.preset !== "custom"} value={toUnit(form.heightMm)} onChange={(e) => setForm({ ...form, heightMm: fromUnit(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-50" aria-label={t("layoutSizeTab.height2")} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.unit")}</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label={t("layoutSizeTab.unit")}>
            <option value="cm">{t("layoutSizeTab.cm")}</option>
            <option value="mm">{t("layoutSizeTab.mm")}</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.marginsMm")}</span>
          <input type="number" min={0} max={30} step={0.5} value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label={t("layoutSizeTab.margins")} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.smallestTextPt")}</span>
          <input type="number" min={4} max={16} step={0.5} value={form.minFontPt} onChange={(e) => setForm({ ...form, minFontPt: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label={t("layoutSizeTab.smallestTextSize")} />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">{t("layoutSizeTab.columnsAllowed")}</span>
          <select value={form.maxColumns} onChange={(e) => setForm({ ...form, maxColumns: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label={t("layoutSizeTab.columnsAllowed")}>
            <option value={1}>1</option>
            <option value={2}>{t("layoutSizeTab.upTo2")}</option>
            <option value={3}>{t("layoutSizeTab.upTo3")}</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("preview")} isLoading={busy === "preview"} disabled={!!busy} data-testid="layout-preview">
          <Eye className="w-4 h-4" />{" "}{t("layoutSizeTab.preview")}</Button>
        <Button onClick={() => run("save")} isLoading={busy === "save"} disabled={!!busy || !preview} title={preview ? undefined : t("layoutSizeTab.showThePreviewFirst")} data-testid="layout-save">
          <Save className="w-4 h-4" />{" "}{t("layoutSizeTab.saveTheSizeAsA")}</Button>
        {old?.hasPdf && (
          <Button variant="secondary" onClick={() => download(old)} data-testid="layout-download">
            <Download className="w-4 h-4" />{" "}{t("layoutSizeTab.downloadPdf", { sizeAr: sizeAr(old.widthMm, old.heightMm) })}</Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {preview && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5" data-testid="layout-compare">
          <div className="flex flex-wrap items-start justify-center gap-8">
            {old && <PagePreview title={t("layoutSizeTab.current", { sizeAr: sizeAr(old.widthMm, old.heightMm) })} widthMm={old.widthMm} heightMm={old.heightMm} src={oldImg} scale={scale} />}
            <PagePreview title={t("layoutSizeTab.new", { sizeAr: sizeAr(newW, newH) })} widthMm={newW} heightMm={newH} src={preview.new.previewDataUrl} scale={scale}>
              <div className="w-72 space-y-2">
                {preview.new.fit.fits ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" />{" "}{t("layoutSizeTab.fitsFontPt", { fontPt: preview.new.fit.fontPt })}{preview.new.fit.columns > 1 ? t("layoutSizeTab.columns", { columns: preview.new.fit.columns }) : ""}{" "}{t("layoutSizeTab.smallestTextPt2", { smallestTextPt: preview.new.fit.smallestTextPt })}</p>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm font-semibold text-red-700" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{" "}{t("layoutSizeTab.doesntFitEvenAtPt", { minFontPt: preview.new.fit.minFontPt })}</p>
                )}
                {preview.new.fit.minFontRule && <p className="text-xs text-gray-500">{t("layoutSizeTab.theMinimumIsPtBy", { pt: preview.new.fit.minFontRule.pt })}</p>}
                <FitList fit={preview.new.fit} />
                {preview.new.empty?.length > 0 && <p className="text-xs text-gray-500">{t("layoutSizeTab.notOnTheLabelEmpty")}{" "}{preview.new.empty.join(t("common.listSep"))}</p>}
              </div>
            </PagePreview>
          </div>
        </div>
      )}

      {state.versions.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm" data-testid="layout-versions">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-end font-semibold">{t("layoutSizeTab.version")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("layoutSizeTab.size")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("layoutSizeTab.result")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("layoutSizeTab.date")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.versions.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">v{v.version}</td>
                  <td className="px-3 py-2">{sizeAr(v.widthMm, v.heightMm)}</td>
                  <td className="px-3 py-2">{v.fit?.fits === false ? <span className="text-red-700">{t("layoutSizeTab.doesntFit")}</span> : `${t("layoutSizeTab.pt", { pt: v.fit?.fontPt })}${v.fit?.columns > 1 ? t("layoutSizeTab.columns", { columns: v.fit.columns }) : ""}`}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtDateTime(v.createdAt)}</td>
                  <td className="px-3 py-2 text-start">
                    {v.hasPdf && (
                      <button type="button" onClick={() => download(v)} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                        <Download className="w-3.5 h-3.5" />{" "}PDF</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LayoutSizeTab({ labelId, labelName, companyId = null, isSystem = false }) {
  const [sizes, setSizes] = useState(null);
  const [state, setState] = useState(null); // { label, current, versions, designs }
  const [design, setDesign] = useState(null); // the chosen design's uploadId
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const params = isSystem && companyId ? { companyId } : {};

  const load = () =>
    Promise.all([getLayoutSizes(), getLabelLayout(labelId)])
      .then(([s, l]) => {
        setSizes(s);
        setState(l);
        setDesign((d) => (l.designs?.some((x) => x.uploadId === d) ? d : l.designs?.[0]?.uploadId || null));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelId]);

  if (error && !sizes) return <p className="text-sm text-red-600">{error}</p>;
  if (!sizes || !state) return <Spinner />;
  const designs = state.designs || [];
  const chosen = designs.find((d) => d.uploadId === design);

  return (
    <div className="space-y-6" data-testid="layout-size-tab">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">{t("layoutSizeTab.resize")}</h2>
          <span className="text-sm text-gray-500">{t("layoutSizeTab.theSameOriginalDesignIn")}</span>
          <span className="flex-1" />
          <Button variant="secondary" onClick={() => setUploading(true)} data-testid="upload-design">
            <Upload className="w-4 h-4" /> {designs.length ? t("layoutSizeTab.uploadAnotherDesignFile") : t("layoutSizeTab.uploadTheDesignFile")}
          </Button>
        </div>
        {designs.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-gray-500" />{" "}{t("layoutSizeTab.designFile")}<select value={design || ""} onChange={(e) => setDesign(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1" aria-label={t("layoutSizeTab.designFile")}>
              {designs.map((d) => (
                <option key={d.uploadId} value={d.uploadId}>
                  {d.originalName || t("layoutSizeTab.design")} · {fmtDate(d.createdAt)}
                </option>
              ))}
            </select>
          </label>
        )}
        {chosen ? (
          <DesignResize key={chosen.uploadId} uploadId={chosen.uploadId} params={params} labelName={labelName} layouts={chosen.layouts} onSaved={load} />
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600" data-testid="no-design">{t("layoutSizeTab.toResizeWhileKeepingThe")}</p>
        )}
      </div>

      <details className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="text-layout-section">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">{t("layoutSizeTab.aNewLabelFromThe")}</summary>
        <div className="mt-4">
          <TextLayout labelId={labelId} labelName={labelName} sizes={sizes} state={state} reload={load} />
        </div>
      </details>

      {uploading && (
        <UploadResizeModal
          labelId={labelId}
          labelName={labelName}
          isSystem={isSystem}
          companies={companyId ? [{ id: companyId, name: labelName }] : []}
          designOnly
          onDone={load}
          onClose={() => {
            setUploading(false);
            load();
          }}
        />
      )}
    </div>
  );
}
