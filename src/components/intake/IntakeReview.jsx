import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, FileText, Loader2, Sparkles, XCircle } from "lucide-react";
import { getIntake, decideIntakeItem, executeIntake } from "../../services/apiIntake";
import { getCompanies } from "../../services/apiCompanies";
import { getBrands } from "../../services/apiBrands";
import { getProducts } from "../../services/apiProducts";
import { useAuth } from "../../context/AuthContext";
import { isCompanyUser } from "../../utils/permissions";
import ExpressPanel from "./ExpressPanel";

// The one review card of a drop: every file, what it is, whose, what will happen.
// Every cell can be changed; nothing exists until "نفّذ الكل". Arabic by default.
// Used on "ارفع ملفاتك" and under the assistant's answer (compact).

export const DOC_TYPES = {
  label: "ليبل",
  certificate_template: "قالب شهادة",
  certificate_filled: "شهادة صادرة",
  invoice: "فاتورة",
  manufacturing_order: "أمر تصنيع",
  catalogue: "كتالوج",
  product_list: "قائمة منتجات",
  other: "مش معروف",
};
const CERT_ACTIONS = { certificate_template: "يتعمل منها قالب", certificate_filled: "تتحفظ كإثبات", certificate_both: "قالب + إثبات", issued_document: "تتحفظ كشهادة صادرة" };
const QUESTIONS = {
  doc_type: { q: "ده ليبل ولا شهادة؟", choices: [["label", "ليبل"], ["certificate_filled", "شهادة"], ["invoice", "فاتورة"], ["catalogue", "كتالوج"]] },
  country: { q: "الليبل ده لأنهي دولة؟" },
  product: { q: "الصفحة دي لأنهي منتج؟" },
  certificate_type: { q: "نوع الشهادة إيه؟" },
};
const COUNTRIES = [["OM", "عُمان"], ["SA", "السعودية"], ["AE", "الإمارات"], ["EG", "مصر"], ["JO", "الأردن"], ["IQ", "العراق"], ["KW", "الكويت"], ["QA", "قطر"], ["BH", "البحرين"], ["PK", "باكستان"], ["LY", "ليبيا"], ["YE", "اليمن"], ["SD", "السودان"], ["LB", "لبنان"]];
const pct = (c) => (c === null || c === undefined ? "—" : `${Math.round(c * 100)}%`);
const cell = "px-2 py-2 align-top";
const select = "w-full min-w-[8.5rem] max-w-[14rem] rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs";

function NewBanner({ n }) {
  const parts = [
    n.companies.length && `شركة ${n.companies.map((c) => c.name).join("، ")}`,
    n.brands.length && `براند ${n.brands.map((b) => b.name).join("، ")}`,
    n.products.length && `${n.products.length} منتجات`,
    n.certificateTypes.length && `أنواع شهادات ${n.certificateTypes.join("، ")}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" data-testid="intake-new">
      <Sparkles className="ml-1 inline h-4 w-4" /> هيتعمل: {parts.join("، ")}
    </p>
  );
}

export default function IntakeReview({ batchId, compact = false, onDone }) {
  const { user } = useAuth();
  const isSystem = !(isCompanyUser(user) || user?.isCompany);
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({}); // bundle id → its parts shown
  const [allProducts, setAllProducts] = useState({}); // row id → every product chip shown
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState({}); // companyId → brands
  const [products, setProducts] = useState({}); // companyId → products
  const [showAll, setShowAll] = useState(false); // express: every row, not only the ones with a question

  const load = useCallback(() => getIntake(batchId).then(setView).catch((e) => setError(e?.response?.data?.message || e.message)), [batchId]);
  useEffect(() => {
    load();
  }, [load]);
  const status = view?.batch?.status;
  const express = view?.batch?.mode === "express";
  // an Express order keeps going after filing: templates, then the certificate drafts
  const expressRunning = express && status === "done" && view?.express?.stage !== "done";
  useEffect(() => {
    if (!["uploading", "classifying", "executing"].includes(status) && !expressRunning) return undefined;
    const t = setInterval(load, expressRunning ? 3000 : 1500);
    return () => clearInterval(t);
  }, [status, expressRunning, load]);
  useEffect(() => {
    if (status === "done") onDone?.(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => {
    if (isSystem && status === "review" && !companies.length) getCompanies({ limit: 1000, sort: "name" }).then((r) => setCompanies(r?.data?.companies || [])).catch(() => {});
  }, [isSystem, status, companies.length]);
  // the brands and products of each company on the card, for the dropdowns
  const companyIds = useMemo(() => [...new Set((view?.items || []).map((i) => i.company?.id).filter(Boolean))], [view]);
  useEffect(() => {
    if (status !== "review") return;
    for (const id of companyIds) {
      if (!brands[id]) getBrands(id).then((r) => setBrands((b) => ({ ...b, [id]: r?.data?.brands || [] }))).catch(() => {});
      if (!products[id]) getProducts({ companyId: id, limit: 1000, sort: "name" }).then((r) => setProducts((p) => ({ ...p, [id]: r?.data?.products || [] }))).catch(() => {});
    }
  }, [companyIds, status, brands, products]);

  const change = async (item, body) => {
    try {
      const updated = await decideIntakeItem(item.id, body);
      setView((v) => ({ ...v, items: v.items.map((i) => (i.id === item.id ? updated : i)) }));
      load(); // what's new at the top follows the change
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      await executeIntake(batchId, Object.fromEntries(view.items.map((i) => [i.id, i.revision])));
      await load();
    } catch (e) {
      if (e?.response?.data?.code === "STALE_CARD") {
        toast.error("الكارت اتغير — اتحدث، راجعه تاني");
        await load();
      } else toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!view) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;
  const allRows = view.items.filter((i) => !i.parentId || view.items.find((p) => p.id === i.parentId)?.action !== "bundle" && view.items.find((p) => p.id === i.parentId)?.action !== "bundle_template");
  // Express asks only what it must: the sure rows are filed as proposed (shown on request)
  const asks = (i) => i.question || (i.confidence !== null && i.confidence < 0.7);
  const rows = express && status === "review" && !showAll ? allRows.filter(asks) : allRows;
  const partsOf = (id) => view.items.filter((i) => i.parentId === id);
  const editable = status === "review";
  const unsure = view.items.filter((i) => i.question || (i.confidence !== null && i.confidence < 0.7)).length;

  const Row = ({ i, depth = 0 }) => {
    const unsureRow = i.question || (i.confidence !== null && i.confidence < 0.7);
    const parts = partsOf(i.id);
    const isBundle = parts.length > 0 && ["bundle", "bundle_template"].includes(i.action);
    const brandList = brands[i.company?.id] || [];
    const productList = products[i.company?.id] || [];
    const skipped = ["duplicate", "skip"].includes(i.action);
    return (
      <>
        <tr className={`border-t border-gray-100 ${unsureRow && editable ? "bg-amber-50" : ""} ${skipped ? "text-gray-400" : ""}`} data-testid="intake-row" data-action={i.action}>
          <td className={cell}>
            <div className="flex items-start gap-1.5" style={{ paddingInlineStart: depth * 16 }}>
              {isBundle ? (
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [i.id]: !o[i.id] }))} aria-label="اعرض الصفحات" className="mt-0.5">
                  {open[i.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              ) : (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900" dir="ltr" title={i.name}>
                  {i.name}
                </p>
                {i.pages && <p className="text-[11px] text-gray-500">{isBundle ? `${parts.length} شهادة — شهادة لكل صفحة` : `صفحات ${i.pages}`}</p>}
                {unsureRow && editable && i.question && QUESTIONS[i.question] && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-amber-900" data-testid="intake-question">
                    <AlertTriangle className="h-3.5 w-3.5" /> {QUESTIONS[i.question].q}
                    {(QUESTIONS[i.question].choices || []).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => change(i, { docType: v })} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-100">
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className={cell}>
            {editable && !skipped ? (
              <select className={select} value={i.docType || "other"} onChange={(e) => change(i, { docType: e.target.value })} aria-label={`نوع ${i.name}`}>
                {Object.entries(DOC_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              DOC_TYPES[i.docType] || "—"
            )}
            {i.certCode && <span className="mr-1 rounded bg-gray-100 px-1 text-[11px] font-semibold text-gray-700">{i.certCode}</span>}
          </td>
          <td className={cell}>
            {editable && isSystem && !skipped ? (
              <select
                className={select}
                value={i.company?.id || (i.company?.name ? `new:${i.company.name}` : "")}
                onChange={(e) => change(i, { company: e.target.value.startsWith("new:") ? { name: e.target.value.slice(4) } : e.target.value ? { id: e.target.value } : null })}
                aria-label={`شركة ${i.name}`}
              >
                {i.company?.isNew && <option value={`new:${i.company.name}`}>جديدة: {i.company.name}</option>}
                {!i.company && <option value="">—</option>}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{i.company ? `${i.company.isNew && editable ? "جديدة: " : ""}${i.company.name}` : "—"}</span>
            )}
          </td>
          <td className={cell}>
            {editable && !skipped ? (
              <select
                className={select}
                value={i.brand?.id || (i.brand?.name ? `new:${i.brand.name}` : "")}
                onChange={(e) => change(i, { brand: e.target.value.startsWith("new:") ? { name: e.target.value.slice(4) } : e.target.value ? { id: e.target.value } : null })}
                aria-label={`براند ${i.name}`}
              >
                <option value="">من غير براند</option>
                {i.brand?.isNew && <option value={`new:${i.brand.name}`}>جديد: {i.brand.name}</option>}
                {brandList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{i.brand ? `${i.brand.isNew && editable ? "جديد: " : ""}${i.brand.name}` : "—"}</span>
            )}
          </td>
          <td className={`${cell} min-w-[15rem]`}>
            <div className="flex flex-wrap gap-1">
              {(i.products.length > 3 && !allProducts[i.id] ? i.products.slice(0, 3) : i.products).map((p, k) => (
                <span key={`${p.id || p.name}-${k}`} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${p.isNew && editable ? "bg-blue-50 text-blue-800" : "bg-gray-100 text-gray-800"}`} dir="ltr">
                  {p.isNew && editable ? "+ " : ""}
                  {p.name}
                  {p.volume ? ` ${p.volume}` : ""}
                  {editable && !skipped && (
                    <button type="button" className="ml-1 text-gray-400 hover:text-gray-700" onClick={() => change(i, { products: i.products.filter((_, j) => j !== k) })} aria-label={`شيل ${p.name}`}>
                      ×
                    </button>
                  )}
                </span>
              ))}
              {i.products.length > 3 && !allProducts[i.id] && (
                <button type="button" onClick={() => setAllProducts((a) => ({ ...a, [i.id]: true }))} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-200">
                  +{i.products.length - 3}
                </button>
              )}
              {editable && !skipped && productList.length > 0 && (
                <select className="max-w-[8rem] rounded-md border border-dashed border-gray-300 bg-white px-1 py-0.5 text-[11px]" value="" onChange={(e) => e.target.value && change(i, { products: [...i.products.map((p) => (p.id ? { id: p.id } : { name: p.name, volume: p.volume })), { id: e.target.value }] })} aria-label={`ضيف منتج لـ ${i.name}`}>
                  <option value="">+ منتج موجود</option>
                  {productList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {!i.products.length && !editable && "—"}
            </div>
          </td>
          <td className={cell}>
            {editable && !skipped && ["label", "certificate_template", "certificate_filled"].includes(i.docType) ? (
              <select className={select} value={i.country || ""} onChange={(e) => change(i, { country: e.target.value || null })} aria-label={`دولة ${i.name}`}>
                <option value="">—</option>
                {COUNTRIES.map(([c, l]) => (
                  <option key={c} value={c}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              i.country || "—"
            )}
          </td>
          <td className={cell}>
            {editable && !skipped && i.docType?.startsWith("certificate") && !isBundle ? (
              <select className={select} value={i.action} onChange={(e) => change(i, { action: e.target.value })} aria-label={`اللي هيحصل لـ ${i.name}`}>
                {Object.entries(CERT_ACTIONS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs">{i.actionText?.ar || "—"}</span>
            )}
            {i.result?.link && (
              <Link to={i.result.link} className="mt-1 block text-[11px] text-blue-700 hover:underline">
                افتح
              </Link>
            )}
            {i.status === "failed" && <span className="mt-1 block text-[11px] text-red-700">{i.error}</span>}
            {editable && (
              <label className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                <input type="checkbox" checked={i.action === "skip"} onChange={(e) => change(i, { skip: e.target.checked })} /> سيبه
              </label>
            )}
          </td>
          <td className={`${cell} text-xs`}>
            <span className={i.confidence !== null && i.confidence < 0.7 ? "font-semibold text-amber-700" : "text-gray-600"} title={(i.evidence || []).map((e) => e.says).join(" · ")}>
              {pct(i.confidence)}
            </span>
            {i.status === "done" && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-green-600" />}
            {i.status === "failed" && <XCircle className="mr-1 inline h-3.5 w-3.5 text-red-600" />}
          </td>
        </tr>
        {isBundle && open[i.id] && parts.map((p) => <Row key={p.id} i={p} depth={1} />)}
      </>
    );
  };

  return (
    <div dir="rtl" className={`space-y-3 ${compact ? "text-sm" : ""}`} data-testid="intake-review" data-status={status}>
      {["uploading", "classifying"].includes(status) && (
        <p className="flex items-center gap-2 text-sm text-gray-700" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> بنتعرف على الملفات… {view.task?.message ? <span dir="ltr" className="text-xs text-gray-500">{view.task.message}</span> : null}
        </p>
      )}
      {status === "review" && express && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900" data-testid="express-intro">
          طلب سريع: بزرار واحد هنسجّل الملفات ونطلّع الشهادات (مسودات){view.express?.requestedTypes?.length ? ` — ${view.express.requestedTypes.join("، ")}` : ""}. كل اللي هيتعمل هيتعلّم «محتاج مراجعة».
        </p>
      )}
      {status === "review" && (
        <>
          <NewBanner n={view.newEntities} />
          {unsure > 0 && <p className="text-xs text-amber-800">{unsure} ملف محتاجين نظرة منك (متعلّمين بالأصفر).</p>}
        </>
      )}
      {express && status === "review" && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs text-blue-700 hover:underline" data-testid="express-show-all">
          {showAll ? "اعرض الأسئلة بس" : `اعرض كل الملفات (${allRows.length})`}
        </button>
      )}
      {status !== "classifying" && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[64rem] text-right text-xs" data-testid="intake-table">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-600">
              <tr>
                {["الملف", "ده إيه", "الشركة", "البراند", "المنتجات", "الدولة", "اللي هيحصل", "الثقة"].map((h) => (
                  <th key={h} className="px-2 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <Row key={i.id} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {status === "review" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">مفيش حاجة هتتعمل قبل ما تدوس الزرار.</p>
          <button type="button" onClick={run} disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50" data-testid="intake-run">
            {busy ? "…" : express ? "طلّع الشهادات" : "نفّذ الكل"}
          </button>
        </div>
      )}
      {status === "executing" && (
        <div className="space-y-1" role="status">
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" /> بنرتب الملفات… {view.task?.progress ? `${view.task.progress}%` : ""}
          </p>
          <div className="h-1.5 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${view.task?.progress || 5}%` }} />
          </div>
        </div>
      )}
      {express && status === "done" && <ExpressPanel ex={view.express} batchId={view.batch?.id} onChanged={load} />}
      {status === "done" && view.summary && (
        <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900" data-testid="intake-summary">
          <p className="font-semibold">{view.summary.text?.ar}</p>
          {view.summary.needs?.length > 0 && (
            <ul className="list-disc space-y-0.5 pr-5 text-xs text-gray-800">
              {view.summary.needs.slice(0, 12).map((n, k) => (
                <li key={k}>{n.link ? <Link to={n.link} className="text-blue-700 hover:underline">{n.ar}</Link> : n.ar}</li>
              ))}
              {view.summary.needs.length > 12 && <li>و{view.summary.needs.length - 12} كمان…</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
