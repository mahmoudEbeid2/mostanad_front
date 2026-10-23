import AiAction from "../ui/AiAction";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, Pencil, Scissors, Merge, X } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import StatusBadge from "../components/certificates/StatusBadge";
import PdfPage from "../components/catalogues/PdfPage";
import { openPdf } from "../components/catalogues/openPdf";
import DiffPanel from "../components/catalogues/DiffPanel";
import useCompanyScope from "../hooks/useCompanyScope";
import useTaskProgress from "../hooks/useTaskProgress";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { createCategory } from "../services/apiCategories";
import {
  getCatalogueReview,
  getCatalogueFile,
  editCatalogueBlock,
  acceptCatalogueBlock,
  rejectCatalogueBlock,
  acceptUnflaggedBlocks,
  mergeCatalogueBlocks,
  splitCatalogueBlock,
  extractCatalogueVersion,
  setCatalogueNumberConvention,
  getCatalogueDiff,
  applyCatalogueBlockDiff,
  applyCatalogueVersionDiff,
} from "../services/apiCatalogues";

// /catalogues/versions/:id/review (backend plan.md §15.3 steps 6–7, A6.4): the PDF
// page beside the extracted record; picking a field highlights its quote on the
// page. Accepting a block CREATES a product (catalogue values tier C, estimates
// apart as "Estimated", typed values "manual"); a block matching an existing
// product is left for the re-upload diff. Bulk accept takes only unflagged blocks.
const STR = {
  back: "Catalogue",
  title: "Review",
  counts: (c) => `${c.products} products · ${c.unflagged} ready · ${c.flagged} to check · ${c.existing} already exist · ${c.applied || 0} created · ${c.rejected || 0} rejected`,
  bulk: (n) => `Accept ${n} unflagged`,
  bulkDone: (r) => `${r.created} products created · skipped ${r.skipped.flagged} flagged, ${r.skipped.existing} existing`,
  convention: "This catalogue prints numbers like “200.000”. How should “.” + three digits be read?",
  thousands: "Thousands (200.000 = 200 000)",
  decimal: "Decimal (200.000 = 200)",
  conventionSet: (c) => `“.” + three digits read as ${c.dotGroup3} (confirmed)`,
  filters: { todo: "To review", ready: "Ready", flagged: "Flagged", existing: "Existing", done: "Decided", all: "All" },
  noExtraction: (n) => `${n} block(s) not extracted yet`,
  extract: "Extract them",
  extracting: "Reading the blocks…",
  page: (n) => `Page ${n}`,
  pickBlock: "Pick a block on the left.",
  notExtracted: "Not extracted yet — extract it (top of the list) to see its record.",
  manualEntry: "Not read by AI — type what the page prints (left). Nothing is filled in for you; every value is saved as typed by you.",
  extractionFailed: (e) => `Products weren't read automatically. ${e}`,
  extractionFailedHint: "Enter the products by hand — open a block, type its name and the printed values, then accept — or extract again once AI is available.",
  needName: "Type the product name first",
  accept: "Accept → create product",
  reject: "Reject",
  existing: (m) => (m.productId ? `“${m.name}” already exists (same ${m.by}) — its changes go through the re-upload diff, not here.` : `Several existing products match by ${m.by} — resolve it in the re-upload diff.`),
  catalogue: (p) => `Catalogue · p.${p}`,
  estimated: "Estimated",
  manual: "Typed",
  basis: "Basis",
  empty: "—",
  category: "Category",
  noCategory: "No category",
  proposal: (p) => `Proposed: “${p}”`,
  newCategory: "New category…",
  newCategoryPrompt: "Name of the new category",
  createCategory: "Create",
  split: "Split…",
  splitHint: "Click the first line of the second product.",
  mergeNext: "Merge with next block",
  save: "Save",
  cancel: "Cancel",
  ingredients: "Composition",
  specifications: "Specifications",
  flags: "To check",
  diffBulk: "Apply all changes without conflicts",
  diffSummary: (s) => `Against existing products: ${s.changed} changed (${s.changedFields} fields, ${s.conflicts} conflicts) · ${s.unchanged} unchanged · ${s.new} new · ${s.ambiguous} ambiguous`,
  diffDone: (r) => `${r.applied} products updated/linked · ${r.changedFields} fields written · waiting: ${r.skipped.conflicts} with conflicts, ${r.skipped.flagged} flagged, ${r.skipped.ambiguous} ambiguous`,
  removed: (n) => `${n} product(s) linked to this catalogue are not in this edition — they are kept, never deleted:`,
  applied: "Applied",
  created: "Product created",
  viewProduct: "Open products",
};

const FIELDS = [
  ["name", "Name"],
  ["productCode", "Code"],
  ["physicalForm", "Form"],
  ["packaging", "Packaging"],
  ["description", "Description"],
  ["indications", "Indications"],
  ["targetSpecies", "Target species", true],
  ["dosage", "Dosage"],
  ["mixingInstructions", "Mixing"],
  ["withdrawalPeriod", "Withdrawal period"],
  ["contraindications", "Contraindications"],
  ["userSafety", "User safety", true],
  ["storage", "Storage"],
  ["appearance", "Appearance"],
  ["registrationNumber", "Registration no."],
  ["origin", "Origin"],
  ["producer", "Producer"],
];

const asText = (v) => (Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v));
const present = (v) => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");

/** manual > catalogue (C) > estimate (I) — the same order the backend applies on accept */
function fieldValue(ex, field) {
  if (ex.manual?.[field]) return { value: ex.manual[field].value, tier: "manual" };
  if (present(ex.record?.[field])) return { value: ex.record[field], tier: "C" };
  if (ex.estimated?.[field]) return { value: ex.estimated[field].value, tier: "I", basis: ex.estimated[field].basis };
  return null;
}

const bucket = (b) => {
  if (b.kind !== "product") return "context";
  if (b.status !== "pending") return "done";
  if (b.match) return "existing";
  if (!b.extracted) return "flagged";
  return b.extracted.flags?.length ? "flagged" : "ready";
};

function SourceChip({ v, page }) {
  if (!v) return null;
  if (v.tier === "C") return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{STR.catalogue(page)}</span>;
  if (v.tier === "I")
    return (
      <span title={`${STR.basis}: ${v.basis || ""}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
        {STR.estimated}
      </span>
    );
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300">{STR.manual}</span>;
}

function FieldRow({ field, label, list, ex, block, active, onPick, onSave, editable }) {
  const v = fieldValue(ex, field);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const hasQuote = !!block.highlights?.[field];
  const flag = (ex.flags || []).find((f) => f.field === field);
  return (
    <div className={`px-3 py-2 rounded-lg border ${active ? "border-amber-400 bg-amber-50/60" : flag ? "border-orange-200 bg-orange-50/40" : "border-transparent hover:bg-gray-50"} ${hasQuote ? "cursor-pointer" : ""}`} onClick={() => hasQuote && onPick(field)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="flex items-center gap-1.5">
          <SourceChip v={v} page={block.page} />
          {editable && !editing && (
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                setDraft(asText(v?.value));
                setEditing(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
          <textarea className="w-full text-sm border border-gray-300 rounded-md p-2" rows={list ? 3 : 2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={list ? "One per line" : ""} />
          <div className="flex gap-2">
            <button type="button" className="text-xs font-semibold text-blue-600" onClick={() => onSave(field, list ? draft.split("\n").map((s) => s.trim()).filter(Boolean) : draft.trim() || null).then(() => setEditing(false))}>
              {STR.save}
            </button>
            <button type="button" className="text-xs text-gray-500" onClick={() => setEditing(false)}>
              {STR.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-900 whitespace-pre-wrap mt-0.5">{v ? asText(v.value) : <span className="text-gray-400">{STR.empty}</span>}</div>
      )}
      {flag && <p className="text-xs text-orange-700 mt-1">{flag.message}</p>}
    </div>
  );
}

export default function CatalogueReview() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const linkedBlock = searchParams.get("block");
  const { scope } = useCompanyScope();
  const { user } = useAuth();
  const canManage = hasPermission(user, "manage_catalogues");
  const [data, setData] = useState(null);
  const [diff, setDiff] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [selected, setSelected] = useState(linkedBlock);
  const [activeField, setActiveField] = useState(null);
  const [filter, setFilter] = useState(linkedBlock ? "all" : "todo");
  const [busy, setBusy] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [newCat, setNewCat] = useState(null);
  const [jobId, setJobId] = useState(null);

  const load = useCallback(() => {
    if (!scope) return Promise.resolve();
    return Promise.all([getCatalogueReview(scope, id), getCatalogueDiff(scope, id)])
      .then(([review, d]) => {
        setData(review);
        setDiff(d);
      })
      .catch((err) => toast.error(err.message));
  }, [scope, id]);
  useEffect(() => {
    load();
  }, [load]);
  const task = useTaskProgress(jobId, {
    onDone: (t) => {
      if (t.status === "failed") toast.error(t.error || "Extraction failed");
      setJobId(null);
      load();
    },
  });

  useEffect(() => {
    if (!scope) return undefined;
    let alive = true;
    let doc = null;
    getCatalogueFile(scope, id)
      .then(openPdf)
      .then((d) => {
        doc = d;
        if (alive) setPdf(d);
        else d.destroy();
      })
      .catch((err) => toast.error(`The catalogue PDF could not be opened: ${err.message}`));
    return () => {
      alive = false;
      doc?.destroy();
    };
  }, [scope, id]);

  const blocks = useMemo(() => (data?.blocks || []).filter((b) => b.kind === "product"), [data]);
  const shown = blocks.filter((b) => {
    const k = bucket(b);
    return filter === "all" || (filter === "todo" ? k !== "done" : k === filter);
  });
  const block = blocks.find((b) => b.id === selected) || null;
  useEffect(() => {
    if (!selected && shown.length) setSelected(shown[0].id);
  }, [selected, shown]);
  useEffect(() => {
    setActiveField(null);
    setSplitting(false);
    setNewCat(null);
  }, [selected]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast.success(typeof okMsg === "function" ? okMsg(r) : okMsg);
      await load();
      return r;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );
  }
  const { version, counts, categories } = data;
  const notExtracted = blocks.filter((b) => b.status === "pending" && !b.extracted);
  const needsConvention = counts.ambiguous > 0 && !version.numberConvention;
  const ambiguousMsg = blocks.flatMap((b) => b.extracted?.flags || []).find((f) => f.code === "ambiguous_number")?.message;
  const pending = block?.status === "pending";
  // P8: a block the AI didn't read is entered by hand — the same fields, empty, nothing filled in
  const manualOnly = !!block && !block.extracted && pending && canManage;
  const ex = block?.extracted || (manualOnly ? { record: {}, quotes: {}, estimated: {}, flags: [], manual: {} } : null);
  const editable = canManage && pending && !!ex;
  const typedName = ex?.manual?.name?.value || ex?.record?.name;
  const next = block ? data.blocks.find((b) => b.seq === block.seq + 1) : null;

  const boxes = [];
  if (block?.bbox) boxes.push({ ...block.bbox, tone: "block" });
  for (const [field, list] of Object.entries(block?.highlights || {})) for (const h of list) boxes.push({ ...h, tone: field === activeField ? "active" : "field" });
  const activeBox = activeField ? block?.highlights?.[activeField]?.[0] : null;

  const saveField = (field, value) => run(() => editCatalogueBlock(scope, block.id, { values: { [field]: value } }));
  const catValue = block?.categoryId || "";
  const diffItem = block ? diff?.items?.find((i) => i.blockId === block.id) : null;
  const ds = diff?.summary;

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/catalogues/versions/${id}`} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {STR.back}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {STR.title} · {version.catalogue?.manufacturer} · {version.label} <StatusBadge status={version.status} />
          </h1>
          {canManage && counts.unflagged > 0 && (
            <Button isLoading={busy} onClick={() => run(() => acceptUnflaggedBlocks(scope, id), STR.bulkDone)}>
              <CheckCheck className="w-4 h-4" /> {STR.bulk(counts.unflagged)}
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{STR.counts(counts)}</p>
      </div>

      {version.error && notExtracted.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-900">
          <p className="font-medium">{STR.extractionFailed(version.error)}</p>
          <p className="text-xs mt-1">{STR.extractionFailedHint}</p>
        </div>
      )}

      {needsConvention && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-[16rem]">
            <p className="text-sm font-medium text-amber-900">{STR.convention}</p>
            {ambiguousMsg && <p className="text-xs text-amber-800 mt-0.5">{ambiguousMsg}</p>}
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => run(() => setCatalogueNumberConvention(scope, id, "thousands"))}>
                {STR.thousands}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(() => setCatalogueNumberConvention(scope, id, "decimal"))}>
                {STR.decimal}
              </Button>
            </div>
          )}
        </div>
      )}
      {version.numberConvention?.dotGroup3 && <p className="text-xs text-gray-500">{STR.conventionSet(version.numberConvention)}</p>}

      {ds && ds.changed + ds.unchanged + ds.ambiguous > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-blue-900 flex-1 min-w-[16rem]">{STR.diffSummary(ds)}</p>
          {canManage && ds.changed + ds.unchanged > 0 && (
            <Button variant="secondary" disabled={busy} onClick={() => run(() => applyCatalogueVersionDiff(scope, id), STR.diffDone)}>
              {STR.diffBulk}
            </Button>
          )}
        </div>
      )}
      {diff?.removed?.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-700">
          <p>{STR.removed(diff.removed.length)}</p>
          <ul className="list-disc pl-5 mt-1">
            {diff.removed.map((p) => (
              <li key={p.productId}>
                {p.name}
                {p.productCode ? ` (${p.productCode})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_minmax(0,26rem)]">
        {/* block list */}
        <aside className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100">
            {Object.entries(STR.filters).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`text-xs px-2 py-1 rounded-md ${filter === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>
          {notExtracted.length > 0 && canManage && (
            <div className="p-2 border-b border-gray-100 text-xs text-gray-600 flex items-center justify-between gap-2">
              <span>{jobId ? `${STR.extracting} ${task.progress || 0}%` : STR.noExtraction(notExtracted.length)}</span>
              {!jobId && (
                <AiAction><button type="button" className="font-semibold text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed" onClick={() => run(() => extractCatalogueVersion(scope, id, { blockIds: notExtracted.map((b) => b.id) })).then((r) => r && setJobId(r.jobId))}>
                  {STR.extract}
                </button></AiAction>
              )}
            </div>
          )}
          <ul className="overflow-y-auto flex-1">
            {shown.map((b) => {
              const k = bucket(b);
              const dot = { ready: "bg-emerald-500", flagged: "bg-orange-500", existing: "bg-gray-400", done: b.status === "applied" ? "bg-blue-500" : "bg-red-400" }[k];
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => setSelected(b.id)} className={`w-full text-left px-3 py-2 border-b border-gray-50 flex items-center gap-2 ${b.id === selected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{b.extracted?.manual?.name?.value || b.extracted?.record?.name || b.title || STR.page(b.page)}</span>
                      <span className="block text-[11px] text-gray-500">
                        {STR.page(b.page)}
                        {b.extracted?.record?.productCode ? ` · ${b.extracted.record.productCode}` : ""}
                        {b.extracted?.flags?.length ? ` · ${b.extracted.flags.length} to check` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* the printed page */}
        <section className="bg-gray-100 border border-gray-200 rounded-xl p-3 overflow-y-auto max-h-[80vh]" data-pdf-scroll>
          {block && pdf ? <PdfPage pdf={pdf} page={block.page} boxes={boxes} scrollTo={activeBox || block.bbox} /> : <div className="p-10 flex justify-center">{block ? <Spinner /> : <p className="text-sm text-gray-500">{STR.pickBlock}</p>}</div>}
        </section>

        {/* the record */}
        <section className="bg-white border border-gray-200 rounded-xl p-3 overflow-y-auto max-h-[80vh] space-y-3">
          {!block ? (
            <p className="text-sm text-gray-500">{STR.pickBlock}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{STR.page(block.page)}</span>
                <StatusBadge status={block.status} />
              </div>
              {block.match && pending && (diffItem ? <DiffPanel item={diffItem} canManage={canManage} busy={busy} onApply={(body) => run(() => applyCatalogueBlockDiff(scope, block.id, body), STR.applied)} /> : <p className="text-xs bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-700">{STR.existing(block.match)}</p>)}
              {block.status === "applied" && block.productId && (
                <p className="text-xs bg-blue-50 border border-blue-200 rounded-md p-2 text-blue-800">
                  {STR.created} · <Link to="/products" className="underline">{STR.viewProduct}</Link>
                </p>
              )}

              {canManage && pending && (
                <div className="flex flex-wrap gap-2">
                  <Button isLoading={busy} disabled={!ex || !typedName || !!block.match} title={ex && !typedName ? STR.needName : undefined} onClick={() => run(() => acceptCatalogueBlock(scope, block.id), STR.created)}>
                    <Check className="w-4 h-4" /> {STR.accept}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => run(() => rejectCatalogueBlock(scope, block.id))}>
                    <X className="w-4 h-4" /> {STR.reject}
                  </Button>
                  <Button variant="ghost" disabled={busy || !!block.productId} onClick={() => setSplitting((s) => !s)}>
                    <Scissors className="w-4 h-4" /> {STR.split}
                  </Button>
                  {next && next.page === block.page && next.status === "pending" && !next.productId && (
                    <Button variant="ghost" disabled={busy || !!block.productId} onClick={() => run(() => mergeCatalogueBlocks(scope, id, [block.id, next.id]))}>
                      <Merge className="w-4 h-4" /> {STR.mergeNext}
                    </Button>
                  )}
                </div>
              )}

              {splitting && (
                <div className="border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600 p-2 border-b border-gray-100">{STR.splitHint}</p>
                  <ol className="max-h-64 overflow-y-auto text-xs">
                    {(block.lines || []).map((t, i) => (
                      <li key={i}>
                        <button type="button" disabled={i === 0 || busy} onClick={() => run(() => splitCatalogueBlock(scope, block.id, i)).then(() => setSplitting(false))} className="w-full text-left px-2 py-1 hover:bg-blue-50 disabled:opacity-40 font-mono truncate">
                          {i}. {t.replace(/\t/g, "  ")}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {!ex ? (
                <p className="text-sm text-gray-500">{STR.notExtracted}</p>
              ) : (
                <>
                  {(manualOnly || ex.manualOnly) && <p className="text-xs bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-900">{STR.manualEntry}</p>}
                  {(ex.flags || []).filter((f) => !f.field || !FIELDS.some(([k]) => k === f.field)).length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-orange-800 mb-1">{STR.flags}</p>
                      <ul className="text-xs text-orange-800 list-disc pl-4 space-y-0.5">
                        {ex.flags
                          .filter((f) => !f.field || !FIELDS.some(([k]) => k === f.field))
                          .map((f, i) => (
                            <li key={i}>{f.message}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{STR.category}</label>
                    {ex.category?.proposal && <span className="text-xs text-gray-500 ml-2">{STR.proposal(ex.category.proposal)}</span>}
                    <div className="flex gap-2 mt-1">
                      <select
                        disabled={!editable || busy}
                        value={newCat !== null ? "__new" : catValue}
                        onChange={(e) => {
                          if (e.target.value === "__new") return setNewCat(ex.category?.proposal || "");
                          setNewCat(null);
                          run(() => editCatalogueBlock(scope, block.id, { categoryId: e.target.value || null }));
                        }}
                        className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                      >
                        <option value="">{STR.noCategory}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="__new">{STR.newCategory}</option>
                      </select>
                    </div>
                    {newCat !== null && (
                      <div className="flex gap-2 mt-2">
                        <input className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5" placeholder={STR.newCategoryPrompt} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                        <Button
                          variant="secondary"
                          disabled={!newCat.trim() || busy}
                          onClick={() =>
                            run(async () => {
                              const res = await createCategory({ name: newCat.trim() });
                              const cat = res?.data?.category || res?.data || res;
                              if (!cat?.id) throw new Error("The category was not created");
                              setNewCat(null);
                              return editCatalogueBlock(scope, block.id, { categoryId: cat.id });
                            })
                          }
                        >
                          {STR.createCategory}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    {FIELDS.map(([field, label, list]) => (
                      <FieldRow key={`${block.id}-${field}`} field={field} label={label} list={list} ex={ex} block={block} active={activeField === field} onPick={(f) => setActiveField((cur) => (cur === f ? null : f))} onSave={saveField} editable={editable} />
                    ))}
                  </div>

                  <div className={`rounded-lg border p-2 ${activeField === "activeIngredients" ? "border-amber-400 bg-amber-50/60" : "border-gray-200"} cursor-pointer`} onClick={() => setActiveField((c) => (c === "activeIngredients" ? null : "activeIngredients"))}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{STR.ingredients}</span>
                      {ex.record?.activeIngredients?.length > 0 && <SourceChip v={{ tier: "C" }} page={block.page} />}
                    </div>
                    {ex.record?.compositionBasis && <p className="text-xs text-gray-500 mt-1">{ex.record.compositionBasis}</p>}
                    <table className="w-full text-sm mt-1">
                      <tbody>
                        {(ex.record?.activeIngredients || []).map((i, k) => (
                          <tr key={k} className="border-t border-gray-100">
                            <td className="py-1 pr-2 text-gray-900">{i.name}</td>
                            <td className="py-1 pr-2 font-mono text-gray-900 whitespace-nowrap">{i.amountRaw || <span className="text-gray-400">{STR.empty}</span>}</td>
                            <td className="py-1 text-xs text-gray-500 whitespace-nowrap">{i.amount != null ? `${i.amount.toLocaleString()} ${i.unit || ""}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(ex.flags || [])
                      .filter((f) => f.field === "activeIngredients")
                      .map((f, i) => (
                        <p key={i} className="text-xs text-orange-700 mt-1">
                          {f.message}
                        </p>
                      ))}
                  </div>

                  {ex.record?.specifications?.length > 0 && (
                    <div className={`rounded-lg border p-2 cursor-pointer ${activeField === "specifications" ? "border-amber-400 bg-amber-50/60" : "border-gray-200"}`} onClick={() => setActiveField((c) => (c === "specifications" ? null : "specifications"))}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{STR.specifications}</span>
                        <SourceChip v={{ tier: "C" }} page={block.page} />
                      </div>
                      <table className="w-full text-sm mt-1">
                        <tbody>
                          {ex.record.specifications.map((s, k) => (
                            <tr key={k} className="border-t border-gray-100">
                              <td className="py-1 pr-2">{s.item}</td>
                              <td className="py-1 font-mono">{s.specRaw}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
