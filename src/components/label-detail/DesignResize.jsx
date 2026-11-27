import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Save, RotateCcw, AlertTriangle, CheckCircle2, Info, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getLayoutSizes, getUploadDesign, previewUploadResize, saveUploadResize, downloadLayoutPdf } from "../../services/apiLabelLayout";
import { fitLinesAr, suggestionsOf, sizeAr, roleAr } from "./resizeText";
import { fmtDateTime, t } from "../../i18n";

// "غيّر المقاس" with the label's ORIGINAL design (backend designResizeService):
// choose one or several sizes (presets or custom), see the result at once beside
// the original at the same real scale (mm rulers), move / resize a block or change
// its text size (never under the minimum — the server holds it), reset, and save:
// one new version per size, each with its PDF when it fits. The words, numbers and
// units are the file's own; nothing is re-typed.

const MAX_SIZES = 8;
const AREA_W = 980; // px available for original + result side by side
const AREA_H = 520;
const RULER = 18; // px

function Ruler({ mm, scale, vertical = false }) {
  const ticks = [];
  for (let v = 0; v <= mm; v += 5) ticks.push(v);
  return (
    <div className="relative text-[9px] text-gray-500 select-none" style={vertical ? { width: RULER, height: mm * scale } : { height: RULER, width: mm * scale }} aria-hidden="true">
      {ticks.map((v) => (
        <div key={v} className="absolute bg-gray-400" style={vertical ? { top: v * scale, right: 0, height: 1, width: v % 10 ? 5 : 10 } : { left: v * scale, bottom: 0, width: 1, height: v % 10 ? 5 : 10 }}>
          {v % 10 === 0 && v > 0 && (
            <span className="absolute" style={vertical ? { right: 11, top: -6 } : { bottom: 9, left: -6 }}>
              {v / 10}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** A page at real proportions with cm rulers (top and left). */
function RuledPage({ title, widthMm, heightMm, scale, src, children, testid }) {
  return (
    <figure className="flex flex-col items-start gap-1" data-testid={testid}>
      <figcaption className="text-xs font-semibold text-gray-600">{title}</figcaption>
      <div className="flex" dir="ltr">
        <div style={{ width: RULER }} />
        <Ruler mm={widthMm} scale={scale} />
      </div>
      <div className="flex" dir="ltr">
        <Ruler mm={heightMm} scale={scale} vertical />
        <div className="relative bg-white shadow ring-1 ring-gray-300" style={{ width: widthMm * scale, height: heightMm * scale }}>
          {src ? <img src={src} alt={title} draggable={false} className="absolute inset-0 h-full w-full" /> : <div className="flex h-full items-center justify-center"><Spinner size="sm" /></div>}
          {children}
        </div>
      </div>
    </figure>
  );
}

/** The result's blocks as boxes: drag to move, the corner to resize; click to select. */
function BlockBoxes({ blocks, scale, selected, onSelect, onChange, edited }) {
  const drag = useRef(null);
  const start = (e, b, mode) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(b.id);
    drag.current = { id: b.id, mode, x: e.clientX, y: e.clientY, rect: [...b.rect], el: e.currentTarget.closest("[data-block]") };
    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      const dx = (ev.clientX - d.x) / scale;
      const dy = (ev.clientY - d.y) / scale;
      const [x0, y0, x1, y1] = d.rect;
      const r = d.mode === "move" ? [x0 + dx, y0 + dy, x1 + dx, y1 + dy] : [x0, y0, Math.max(x0 + 3, x1 + dx), Math.max(y0 + 2, y1 + dy)];
      Object.assign(d.el.style, { left: `${r[0] * scale}px`, top: `${r[1] * scale}px`, width: `${(r[2] - r[0]) * scale}px`, height: `${(r[3] - r[1]) * scale}px` });
      d.next = r;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const d = drag.current;
      drag.current = null;
      if (d?.next) onChange(d.id, { rect: d.next.map((v) => Math.round(v * 10) / 10) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return blocks.map((b) => {
    const [x0, y0, x1, y1] = b.rect;
    const on = selected === b.id;
    return (
      <div
        key={b.id}
        data-block={b.id}
        role="button"
        tabIndex={0}
        aria-label={`${roleAr(b.role)} ${b.id}`}
        onPointerDown={(e) => start(e, b, "move")}
        onKeyDown={(e) => e.key === "Enter" && onSelect(b.id)}
        className={`absolute cursor-move rounded-sm ${on ? "ring-2 ring-blue-600 bg-blue-500/10" : edited[b.id] ? "ring-1 ring-amber-500" : "ring-1 ring-transparent hover:ring-blue-400"}`}
        style={{ left: x0 * scale, top: y0 * scale, width: (x1 - x0) * scale, height: (y1 - y0) * scale }}
      >
        {on && <span onPointerDown={(e) => start(e, b, "resize")} className="absolute -bottom-1.5 -end-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-600" aria-label={t("designResize.resize")} />}
      </div>
    );
  });
}

function Report({ fit, onUseSize }) {
  if (!fit) return null;
  const lines = fitLinesAr(fit);
  const { sizes } = suggestionsOf(fit);
  const icon = { ok: <CheckCircle2 className="w-4 h-4 text-green-600" />, bad: <AlertTriangle className="w-4 h-4 text-red-600" />, warn: <AlertTriangle className="w-4 h-4 text-amber-600" />, info: <Info className="w-4 h-4 text-gray-400" /> };
  return (
    <div className="space-y-1.5 text-sm" data-testid="resize-report">
      {lines.map((l, i) => (
        <p key={i} className={`flex items-start gap-1.5 ${l.kind === "bad" ? "text-red-800" : l.kind === "warn" ? "text-amber-800" : l.kind === "ok" ? "font-semibold text-green-800" : "text-gray-700"}`}>
          <span className="mt-0.5 shrink-0">{icon[l.kind]}</span> {l.text}
        </p>
      ))}
      {sizes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-gray-600">{t("designResize.suggestedSize")}</span>
          {sizes.map((s) => (
            <button key={`${s.widthMm}x${s.heightMm}`} type="button" onClick={() => onUseSize(s)} className="rounded-lg border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100" data-testid="use-suggested-size">
              {sizeAr(s.widthMm, s.heightMm)}
              {s.sameRatio ? t("designResize.sameProportions") : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DesignResize({ uploadId, params = {}, labelName = "label", layouts = [], onSaved }) {
  const [presets, setPresets] = useState(null);
  const [design, setDesign] = useState(null);
  const [error, setError] = useState(null);
  const [sizes, setSizes] = useState([]); // [{ key, widthMm, heightMm }]
  const [active, setActive] = useState(null); // key
  const [custom, setCustom] = useState({ w: "", h: "" });
  const [opts, setOpts] = useState({ minFontPt: 6, bleed: false, cropMarks: false });
  const [overrides, setOverrides] = useState({}); // size key → { blockId: { rect?, fontPt? } }
  const [previews, setPreviews] = useState({}); // size key → { fit, previewDataUrl, size } | { loading } | { error }
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(layouts);

  useEffect(() => setSaved(layouts), [layouts]);
  useEffect(() => {
    let alive = true;
    Promise.all([getLayoutSizes(), getUploadDesign(uploadId, params)])
      .then(([s, d]) => {
        if (!alive) return;
        setPresets(s.presets);
        setDesign(d);
        setOpts((o) => ({ ...o, minFontPt: d.minFontPt || 6 }));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId]);

  const keyOf = (w, h) => `${Math.round(w * 10) / 10}x${Math.round(h * 10) / 10}`;
  const addSize = (w, h) => {
    const key = keyOf(w, h);
    if (!(w >= 20 && h >= 20 && w <= 400 && h <= 400)) return toast.error(t("designResize.theSizeMustBeBetween"));
    setSizes((list) => (list.some((s) => s.key === key) ? list : list.length >= MAX_SIZES ? list : [...list, { key, widthMm: Number(w), heightMm: Number(h) }]));
    setActive(key);
  };
  const removeSize = (key) => {
    setSizes((list) => list.filter((s) => s.key !== key));
    if (active === key) setActive(null);
  };
  const current = sizes.find((s) => s.key === active) || null;
  const body = (s) => ({ sizes: [{ widthMm: s.widthMm, heightMm: s.heightMm }], minFontPt: Number(opts.minFontPt), bleedMm: opts.bleed ? 3 : 0, cropMarks: opts.bleed && opts.cropMarks, overrides: overrides[s.key] || {} });

  // the result of the active size, at once (debounced while dragging / typing)
  const reqId = useRef(0);
  useEffect(() => {
    if (!current) return undefined;
    const id = ++reqId.current;
    setPreviews((p) => ({ ...p, [current.key]: { ...(p[current.key] || {}), loading: true } }));
    const t = setTimeout(() => {
      previewUploadResize(uploadId, body(current), params)
        .then((r) => id === reqId.current && setPreviews((p) => ({ ...p, [current.key]: r.results[0] })))
        .catch((e) => id === reqId.current && setPreviews((p) => ({ ...p, [current.key]: { error: e.message } })));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, opts.minFontPt, opts.bleed, opts.cropMarks, JSON.stringify(current ? overrides[current.key] : null)]);

  const edit = (blockId, change) => {
    if (!current) return;
    setOverrides((o) => ({ ...o, [current.key]: { ...(o[current.key] || {}), [blockId]: { ...((o[current.key] || {})[blockId] || {}), ...change } } }));
  };
  const resetBlock = (blockId) =>
    setOverrides((o) => {
      const mine = { ...(o[current.key] || {}) };
      delete mine[blockId];
      return { ...o, [current.key]: mine };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    const made = [];
    try {
      for (const s of sizes) {
        const { layouts: rows } = await saveUploadResize(uploadId, body(s), params);
        made.push(...rows);
      }
      const ok = made.filter((l) => l.hasPdf).length;
      toast.success(ok === made.length ? t("designResize.savedWithPdf", { count: made.length }) : t("designResize.savedDontFitSoNo", { length: made.length, v: made.length - ok }));
      setSaved((old) => [...made, ...old]);
      onSaved?.(made);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pv = current ? previews[current.key] : null;
  const fit = pv?.fit;
  const scale = useMemo(() => {
    if (!design) return 1;
    const w = design.pageMm.width + (current?.widthMm || 0) + 30;
    const h = Math.max(design.pageMm.height, current?.heightMm || 0);
    return Math.min((AREA_W - 3 * RULER) / w, AREA_H / h, 4);
  }, [design, current]);
  const blockOf = (id) => fit?.blocks?.find((b) => b.id === id);
  const sel = selected && blockOf(selected);
  const selOriginal = selected && design?.blocks?.find((b) => b.id === selected);
  const edited = (current && overrides[current.key]) || {};

  if (error && !design) return <p className="text-sm text-red-600" role="alert">{error}</p>;
  if (!design || !presets) return <Spinner />;
  return (
    <div className="space-y-4" data-testid="design-resize">
      {design.boxNet && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{" "}{t("designResize.thisIsABoxDesign", { sizeAr: sizeAr(design.pageMm.width, design.pageMm.height) })}</p>
      )}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-800">{t("designResize.newSizes")}{" "}<span className="font-normal text-gray-500">{t("designResize.upToOnePdfPer", { MAX_SIZES })}</span></p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const on = sizes.some((s) => s.key === keyOf(p.widthMm, p.heightMm));
            return (
              <button key={p.key} type="button" aria-pressed={on} onClick={() => (on ? removeSize(keyOf(p.widthMm, p.heightMm)) : addSize(p.widthMm, p.heightMm))} className={`rounded-lg border px-3 py-1.5 text-sm ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`} data-testid={`size-${p.key}`}>
                {sizeAr(p.widthMm, p.heightMm)}
              </button>
            );
          })}
          <span className="flex items-center gap-1 text-sm">
            <input type="number" min={2} max={40} step={0.1} placeholder={t("designResize.width")} value={custom.w} onChange={(e) => setCustom({ w: e.target.value, h: design.boxNet && e.target.value ? String(Math.round(((e.target.value * design.pageMm.height) / design.pageMm.width) * 10) / 10) : custom.h })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label={t("designResize.widthInCentimetres")} />
            ×
            <input type="number" min={2} max={40} step={0.1} placeholder={t("designResize.height")} value={custom.h} onChange={(e) => setCustom({ h: e.target.value, w: design.boxNet && e.target.value ? String(Math.round(((e.target.value * design.pageMm.width) / design.pageMm.height) * 10) / 10) : custom.w })} className="w-20 rounded-lg border border-gray-300 px-2 py-1" aria-label={t("designResize.heightInCentimetres")} />{t("designResize.cm")}<button type="button" onClick={() => custom.w && custom.h && addSize(Number(custom.w) * 10, Number(custom.h) * 10)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 hover:bg-gray-50" data-testid="add-custom-size">
              <Plus className="h-3.5 w-3.5" />{" "}{t("designResize.add")}</button>
          </span>
        </div>
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("designResize.sizeShown")}>
            {sizes.map((s) => {
              const r = previews[s.key];
              return (
                <span key={s.key} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${active === s.key ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}>
                  <button type="button" role="tab" aria-selected={active === s.key} onClick={() => setActive(s.key)}>
                    {sizeAr(s.widthMm, s.heightMm)} {r?.fit ? (r.fit.fits ? "✓" : "✕") : ""}
                    {Object.keys(overrides[s.key] || {}).length ? t("designResize.edited") : ""}
                  </button>
                  <button type="button" onClick={() => removeSize(s.key)} aria-label={t("designResize.delete", { sizeAr: sizeAr(s.widthMm, s.heightMm) })}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">{t("designResize.smallestTextSize")}<input type="number" min={design.minFontRule?.pt || 4} max={16} step={0.5} value={opts.minFontPt} onChange={(e) => setOpts({ ...opts, minFontPt: e.target.value })} className="w-16 rounded-lg border border-gray-300 px-2 py-1" aria-label={t("designResize.smallestTextSizeInPoints")} />{" "}{t("designResize.pt")}</label>
          {design.minFontRule && <span className="text-xs text-gray-500">{t("designResize.byTheCountrysRulePt", { pt: design.minFontRule.pt })}</span>}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={opts.bleed} onChange={(e) => setOpts({ ...opts, bleed: e.target.checked })} />{" "}{t("designResize.n3MmBleedForThe")}</label>
          {opts.bleed && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={opts.cropMarks} onChange={(e) => setOpts({ ...opts, cropMarks: e.target.checked })} />{" "}{t("designResize.cropMarks")}</label>
          )}
        </div>
      </div>

      {current && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex flex-wrap items-start gap-6 overflow-x-auto">
            <RuledPage title={t("designResize.original", { sizeAr: sizeAr(design.pageMm.width, design.pageMm.height) })} widthMm={design.pageMm.width} heightMm={design.pageMm.height} scale={scale} src={design.originalDataUrl} testid="original-page" />
            <RuledPage title={`${t("designResize.newSize", { size: sizeAr(current.widthMm, current.heightMm) })}${pv?.loading ? " …" : ""}`} widthMm={current.widthMm} heightMm={current.heightMm} scale={scale} src={pv?.previewDataUrl} testid="result-page">
              {fit?.blocks && fit.engineMode === "smart" && <BlockBoxes blocks={fit.blocks} scale={scale} selected={selected} onSelect={setSelected} onChange={edit} edited={edited} />}
            </RuledPage>
          </div>
          {pv?.error && <p className="text-sm text-red-600" role="alert">{pv.error}</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            <Report fit={fit} onUseSize={(s) => addSize(s.widthMm, s.heightMm)} />
            <div className="space-y-2 text-sm">
              {fit?.engineMode === "smart" ? (
                sel ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2" data-testid="block-editor">
                    <p className="font-semibold text-gray-800">
                      {roleAr(sel.role)} {selOriginal?.text ? `«${selOriginal.text.slice(0, 40)}»` : ""}
                    </p>
                    <p className="text-xs text-gray-500">{t("designResize.dragAPartToMove")}</p>
                    {sel.fontPt != null && (
                      <label className="flex items-center gap-2">{t("designResize.fontSize")}<input
                          type="number"
                          step={0.5}
                          min={Number(opts.minFontPt)}
                          max={Math.max(Number(opts.minFontPt), (selOriginal?.fontPt || sel.fontPt) * 3)}
                          value={edited[sel.id]?.fontPt ?? sel.fontPt}
                          onChange={(e) => edit(sel.id, { fontPt: Math.max(Number(opts.minFontPt), Number(e.target.value)) })}
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1"
                          aria-label={t("designResize.fontSizeInPoints")}
                          data-testid="block-font"
                        />{t("designResize.pt")}{" "}<span className="text-xs text-gray-500">{t("designResize.originalPt", { pt: selOriginal?.fontPt ?? "—" })}</span>
                      </label>
                    )}
                    <div className="flex gap-2">
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => resetBlock(sel.id)} disabled={!edited[sel.id]}>
                        <RotateCcw className="w-3.5 h-3.5" />{" "}{t("designResize.resetThisPart")}</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{t("designResize.clickAnyPartOfThe")}</p>
                )
              ) : (
                fit && <p className="text-xs text-gray-500">{t("designResize.sameProportionsTheWholeDesign")}</p>
              )}
              {Object.keys(edited).length > 0 && (
                <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setOverrides((o) => ({ ...o, [current.key]: {} }))} data-testid="reset-all">
                  <RotateCcw className="w-3.5 h-3.5" />{" "}{t("designResize.undoAllChangesForThis")}</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} isLoading={saving} disabled={!sizes.length || saving} data-testid="design-save">
          <Save className="w-4 h-4" />{" "}{t("designResize.save")}{" "}{sizes.length > 1 ? t("designResize.sizes", { length: sizes.length }) : t("designResize.size")}{" "}{t("designResize.asNewVersion")}
        </Button>
        {!sizes.length && <span className="text-xs text-gray-500">{t("designResize.pickAtLeastOneSize")}</span>}
        {error && <span className="text-sm text-red-600" role="alert">{error}</span>}
      </div>

      {saved.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm" data-testid="design-versions">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-end font-semibold">{t("designResize.version")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("designResize.size")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("designResize.result")}</th>
                <th className="px-3 py-2 text-end font-semibold">{t("designResize.date")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {saved.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">v{v.version}</td>
                  <td className="px-3 py-2">{sizeAr(v.widthMm, v.heightMm)}</td>
                  <td className="px-3 py-2">{v.fit?.fits === false ? <span className="text-red-700">{t("designResize.doesntFit")}</span> : t("designResize.smallestTextPt", { v: v.fit?.smallestTextPt ?? "—" })}</td>
                  <td className="px-3 py-2 text-gray-500">{fmtDateTime(v.createdAt)}</td>
                  <td className="px-3 py-2 text-start">
                    {v.hasPdf && (
                      <button type="button" onClick={() => downloadLayoutPdf(v, labelName).catch((e) => toast.error(e.message))} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
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
