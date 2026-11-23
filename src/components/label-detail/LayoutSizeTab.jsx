import { useEffect, useState } from "react";
import { Ruler, Download, Save, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getLayoutSizes, getLabelLayout, previewLabelLayout, saveLabelLayout, downloadLayoutPdf, layoutFileUrl } from "../../services/apiLabelLayout";

// Label page → "Layout & size": the same label content at another page size.
// Pick a preset or a custom w × h (mm or cm), margins and the minimum text size,
// preview old vs new at real proportions with the fit per section, then save it
// as a new layout version and download its PDF. Nothing is cut: a label that
// doesn't fit gets no PDF and the report says which section needs how much more.

const PREVIEW_H = 420; // px: both previews share one scale, so their real proportions compare

export function FitList({ fit }) {
  if (!fit) return null;
  if (fit.mode === "scale") return null;
  return (
    <ul className="space-y-1 text-xs" data-testid="fit-sections">
      {(fit.sections || []).map((s) => (
        <li key={s.key} className={`flex justify-between gap-3 rounded-md px-2 py-1 ${s.status === "overflow" ? "bg-red-50 text-red-800" : s.status === "reduced" ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-700"}`}>
          <span className="font-medium">{s.title || s.key}</span>
          <span>{s.status === "overflow" ? `needs ${s.overflowMm} mm more` : s.status === "reduced" ? `font reduced to ${fit.fontPt} pt${fit.columns > 1 ? ` · ${fit.columns} columns` : ""}` : "fits"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A page at its real proportions: `scale` px per mm, shared by old and new. */
function PagePreview({ title, widthMm, heightMm, src, scale, children }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="text-xs font-semibold text-gray-600">{title}</figcaption>
      <div className="relative bg-white shadow ring-1 ring-gray-300" style={{ width: widthMm * scale, minHeight: heightMm * scale }}>
        {src ? <img src={src} alt={`${title} preview`} style={{ width: widthMm * scale, display: "block" }} /> : <div className="flex h-full items-center justify-center p-4 text-xs text-gray-400">No preview</div>}
      </div>
      {children}
    </figure>
  );
}

export default function LayoutSizeTab({ labelId, labelName }) {
  const [sizes, setSizes] = useState(null);
  const [state, setState] = useState(null); // { label, current, versions }
  const [unit, setUnit] = useState("cm");
  const [form, setForm] = useState({ preset: "100x120", widthMm: 100, heightMm: 120, margin: 4, minFontPt: 6, maxColumns: 2 });
  const [preview, setPreview] = useState(null);
  const [oldImg, setOldImg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    Promise.all([getLayoutSizes(), getLabelLayout(labelId)])
      .then(([s, l]) => {
        setSizes(s);
        setState(l);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelId]);
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
        toast.success(layout.hasPdf ? `Saved as version ${layout.version} (${layout.size})` : `Saved version ${layout.version} — it doesn't fit, so there is no PDF`);
        setPreview(null);
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const download = async (layout) => {
    try {
      await downloadLayoutPdf(layout, labelName);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (error && !sizes) return <p className="text-sm text-red-600">{error}</p>;
  if (!sizes || !state) return <Spinner />;
  const toUnit = (mm) => (unit === "cm" ? mm / 10 : mm);
  const fromUnit = (v) => (unit === "cm" ? Number(v) * 10 : Number(v));
  const newW = preview?.new?.widthMm;
  const newH = preview?.new?.heightMm;
  const old = state.current;
  const tallest = Math.max(newH || 0, old?.heightMm || 0, 1);
  const scale = PREVIEW_H / tallest;

  return (
    <div className="space-y-6" data-testid="layout-size-tab">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Layout & size</h2>
          <span className="text-sm text-gray-500">{old ? `Current: ${old.size} (version ${old.version})` : "No saved size yet"}</span>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Label size">
          {sizes.presets.map((p) => (
            <button key={p.key} type="button" role="radio" aria-checked={form.preset === p.key} onClick={() => setForm({ ...form, preset: p.key, widthMm: p.widthMm, heightMm: p.heightMm })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${form.preset === p.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              {p.label}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={form.preset === "custom"} onClick={() => setForm({ ...form, preset: "custom" })} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${form.preset === "custom" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            Custom
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Width ({unit})</span>
            <input type="number" min={2} step={unit === "cm" ? 0.1 : 1} disabled={form.preset !== "custom"} value={toUnit(form.widthMm)} onChange={(e) => setForm({ ...form, widthMm: fromUnit(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-50" aria-label="Width" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Height ({unit})</span>
            <input type="number" min={2} step={unit === "cm" ? 0.1 : 1} disabled={form.preset !== "custom"} value={toUnit(form.heightMm)} onChange={(e) => setForm({ ...form, heightMm: fromUnit(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 disabled:bg-gray-50" aria-label="Height" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label="Unit">
              <option value="cm">cm</option>
              <option value="mm">mm</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Margins (mm)</span>
            <input type="number" min={0} max={30} step={0.5} value={form.margin} onChange={(e) => setForm({ ...form, margin: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label="Margins" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Min. text (pt)</span>
            <input type="number" min={4} max={16} step={0.5} value={form.minFontPt} onChange={(e) => setForm({ ...form, minFontPt: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" aria-label="Minimum font size" />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Columns allowed</span>
            <select value={form.maxColumns} onChange={(e) => setForm({ ...form, maxColumns: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 bg-white" aria-label="Columns allowed">
              <option value={1}>1</option>
              <option value={2}>up to 2</option>
              <option value={3}>up to 3</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => run("preview")} isLoading={busy === "preview"} disabled={!!busy} data-testid="layout-preview">
            <Eye className="w-4 h-4" /> Preview
          </Button>
          <Button onClick={() => run("save")} isLoading={busy === "save"} disabled={!!busy || !preview} title={preview ? undefined : "Preview first"} data-testid="layout-save">
            <Save className="w-4 h-4" /> Save size as new version
          </Button>
          {old?.hasPdf && (
            <Button variant="secondary" onClick={() => download(old)} data-testid="layout-download">
              <Download className="w-4 h-4" /> Download PDF ({old.size})
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>

      {preview && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5" data-testid="layout-compare">
          <div className="flex flex-wrap items-start justify-center gap-8">
            {old && <PagePreview title={`Now: ${old.size}`} widthMm={old.widthMm} heightMm={old.heightMm} src={oldImg} scale={scale} />}
            <PagePreview title={`New: ${preview.new.size}`} widthMm={newW} heightMm={newH} src={preview.new.previewDataUrl} scale={scale}>
              <div className="w-72 space-y-2">
                {preview.new.fit.fits ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Fits · {preview.new.fit.fontPt} pt{preview.new.fit.columns > 1 ? ` · ${preview.new.fit.columns} columns` : ""} · smallest text {preview.new.fit.smallestTextPt} pt
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm font-semibold text-red-700" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> Doesn't fit even at {preview.new.fit.minFontPt} pt — no PDF would be made. Below the red line is what wouldn't be on the label.
                  </p>
                )}
                {preview.new.fit.minFontRule && <p className="text-xs text-gray-500">Minimum {preview.new.fit.minFontRule.pt} pt from {preview.new.fit.minFontRule.ruleKey}</p>}
                <FitList fit={preview.new.fit} />
                {preview.new.empty?.length > 0 && <p className="text-xs text-gray-500">Not on the label (empty in its data): {preview.new.empty.join(", ")}</p>}
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
                <th className="px-3 py-2 text-left font-semibold">Version</th>
                <th className="px-3 py-2 text-left font-semibold">Size</th>
                <th className="px-3 py-2 text-left font-semibold">Fit</th>
                <th className="px-3 py-2 text-left font-semibold">Saved</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.versions.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">v{v.version}</td>
                  <td className="px-3 py-2">{v.size}</td>
                  <td className="px-3 py-2">{v.fit?.fits === false ? <span className="text-red-700">doesn't fit</span> : `${v.fit?.fontPt} pt${v.fit?.columns > 1 ? ` · ${v.fit.columns} col` : ""}`}</td>
                  <td className="px-3 py-2 text-gray-500">{new Date(v.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    {v.hasPdf && (
                      <button type="button" onClick={() => download(v)} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
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
