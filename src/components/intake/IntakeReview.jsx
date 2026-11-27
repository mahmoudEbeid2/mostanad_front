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
import HarvestProgress from "./HarvestProgress";
import { pickText, t } from "../../i18n";

// The one review card of a drop: every file, what it is, whose, what will happen.
// Every cell can be changed; nothing exists until "نفّذ الكل". Arabic by default.
// Used on "ارفع ملفاتك" and under the assistant's answer (compact).

export const DOC_TYPES = {
  label: t("intakeReview.label"),
  certificate_template: t("intakeReview.certificateTemplate"),
  certificate_filled: t("intakeReview.issuedCertificate"),
  invoice: t("intakeReview.invoice"),
  manufacturing_order: t("intakeReview.manufacturingOrder"),
  catalogue: t("intakeReview.catalogue"),
  product_list: t("intakeReview.productList"),
  other: t("intakeReview.unknown"),
};
const CERT_ACTIONS = { certificate_template: t("intakeReview.makeATemplateFromIt"), certificate_filled: t("intakeReview.keepAsEvidence"), certificate_both: t("intakeReview.templateEvidence"), issued_document: t("intakeReview.keepAsAnIssuedCertificate") };
const QUESTIONS = {
  doc_type: { q: t("intakeReview.isThisALabelOr"), choices: [["label", t("intakeReview.label")], ["certificate_filled", t("intakeReview.certificate")], ["invoice", t("intakeReview.invoice")], ["catalogue", t("intakeReview.catalogue")]] },
  country: { q: t("intakeReview.whichCountryIsThisLabel") },
  product: { q: t("intakeReview.whichProductIsThisPage") },
  certificate_type: { q: t("intakeReview.whatTypeOfCertificate") },
};
const COUNTRIES = [["OM", t("intakeReview.oman")], ["SA", t("intakeReview.saudiArabia")], ["AE", t("intakeReview.uae")], ["EG", t("intakeReview.egypt")], ["JO", t("intakeReview.jordan")], ["IQ", t("intakeReview.iraq")], ["KW", t("intakeReview.kuwait")], ["QA", t("intakeReview.qatar")], ["BH", t("intakeReview.bahrain")], ["PK", t("intakeReview.pakistan")], ["LY", t("intakeReview.libya")], ["YE", t("intakeReview.yemen")], ["SD", t("intakeReview.sudan")], ["LB", t("intakeReview.lebanon")]];
const pct = (c) => (c === null || c === undefined ? "—" : `${Math.round(c * 100)}%`);
const cell = "px-2 py-2 align-top";
const select = "w-full min-w-[8.5rem] max-w-[14rem] rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs";

function NewBanner({ n }) {
  const parts = [
    n.companies.length && t("intakeReview.company", { join: n.companies.map((c) => c.name).join(t("common.listSep")) }),
    n.brands.length && t("intakeReview.brand", { join: n.brands.map((b) => b.name).join(t("common.listSep")) }),
    n.products.length && t("intakeReview.products", { length: n.products.length }),
    n.certificateTypes.length && t("intakeReview.certificateTypes", { join: n.certificateTypes.join(t("common.listSep")) }),
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" data-testid="intake-new">
      <Sparkles className="ms-1 inline h-4 w-4" />{" "}{t("intakeReview.willMake", { join: parts.join(t("common.listSep")) })}</p>
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
        toast.error(t("intakeReview.theCardChangedItWas"));
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
  // Express: the product blocks show what is sure; the table only carries the questions to answer here
  // (a page's product is asked in the one-question panel above)
  const rows = express && status === "review" && !showAll ? allRows.filter((i) => asks(i) && i.question !== "product") : allRows;
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
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [i.id]: !o[i.id] }))} aria-label={t("intakeReview.showThePages")} className="mt-0.5">
                  {open[i.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              ) : (
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900" dir="ltr" title={i.name}>
                  {i.name}
                </p>
                {i.pages && <p className="text-[11px] text-gray-500">{isBundle ? t("intakeReview.certificatesOnePerPage", { length: parts.length }) : t("intakeReview.pages", { pages: i.pages })}</p>}
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
              <select className={select} value={i.docType || "other"} onChange={(e) => change(i, { docType: e.target.value })} aria-label={t("intakeReview.typeOf", { name: i.name })}>
                {Object.entries(DOC_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              DOC_TYPES[i.docType] || "—"
            )}
            {i.certCode && <span className="me-1 rounded bg-gray-100 px-1 text-[11px] font-semibold text-gray-700">{i.certCode}</span>}
          </td>
          <td className={cell}>
            {editable && isSystem && !skipped ? (
              <select
                className={select}
                value={i.company?.id || (i.company?.name ? `new:${i.company.name}` : "")}
                onChange={(e) => change(i, { company: e.target.value.startsWith("new:") ? { name: e.target.value.slice(4) } : e.target.value ? { id: e.target.value } : null })}
                aria-label={t("intakeReview.companyOf", { name: i.name })}
              >
                {i.company?.isNew && <option value={`new:${i.company.name}`}>{t("intakeReview.new")}{" "}{i.company.name}</option>}
                {!i.company && <option value="">—</option>}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{i.company ? `${i.company.isNew && editable ? t("intakeReview.new5") : ""}${i.company.name}` : "—"}</span>
            )}
          </td>
          <td className={cell}>
            {editable && !skipped ? (
              <select
                className={select}
                value={i.brand?.id || (i.brand?.name ? `new:${i.brand.name}` : "")}
                onChange={(e) => change(i, { brand: e.target.value.startsWith("new:") ? { name: e.target.value.slice(4) } : e.target.value ? { id: e.target.value } : null })}
                aria-label={t("intakeReview.brandOf", { name: i.name })}
              >
                <option value="">{t("intakeReview.noBrand")}</option>
                {i.brand?.isNew && <option value={`new:${i.brand.name}`}>{t("intakeReview.new2")}{" "}{i.brand.name}</option>}
                {brandList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{i.brand ? `${i.brand.isNew && editable ? t("intakeReview.new6") : ""}${i.brand.name}` : "—"}</span>
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
                    <button type="button" className="ms-1 text-gray-400 hover:text-gray-700" onClick={() => change(i, { products: i.products.filter((_, j) => j !== k) })} aria-label={t("intakeReview.remove", { name: p.name })}>
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
                <select className="max-w-[8rem] rounded-md border border-dashed border-gray-300 bg-white px-1 py-0.5 text-[11px]" value="" onChange={(e) => e.target.value && change(i, { products: [...i.products.map((p) => (p.id ? { id: p.id } : { name: p.name, volume: p.volume })), { id: e.target.value }] })} aria-label={t("intakeReview.addAProductTo", { name: i.name })}>
                  <option value="">{t("intakeReview.existingProduct")}</option>
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
              <select className={select} value={i.country || ""} onChange={(e) => change(i, { country: e.target.value || null })} aria-label={t("intakeReview.countryOf", { name: i.name })}>
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
              <select className={select} value={i.action} onChange={(e) => change(i, { action: e.target.value })} aria-label={t("intakeReview.whatHappensTo", { name: i.name })}>
                {Object.entries(CERT_ACTIONS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs">{pickText(i.actionText) || "—"}</span>
            )}
            {i.result?.link && (
              <Link to={i.result.link} className="mt-1 block text-[11px] text-blue-700 hover:underline">{t("intakeReview.open")}</Link>
            )}
            {i.status === "failed" && <span className="mt-1 block text-[11px] text-red-700">{i.error}</span>}
            {editable && (
              <label className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                <input type="checkbox" checked={i.action === "skip"} onChange={(e) => change(i, { skip: e.target.checked })} />{" "}{t("intakeReview.leaveIt")}</label>
            )}
          </td>
          <td className={`${cell} text-xs`}>
            <span className={i.confidence !== null && i.confidence < 0.7 ? "font-semibold text-amber-700" : "text-gray-600"} title={(i.evidence || []).map((e) => e.says).join(" · ")}>
              {pct(i.confidence)}
            </span>
            {i.status === "done" && <CheckCircle2 className="me-1 inline h-3.5 w-3.5 text-green-600" />}
            {i.status === "failed" && <XCircle className="me-1 inline h-3.5 w-3.5 text-red-600" />}
          </td>
        </tr>
        {isBundle && open[i.id] && parts.map((p) => <Row key={p.id} i={p} depth={1} />)}
      </>
    );
  };

  return (
    <div className={`space-y-3 ${compact ? "text-sm" : ""}`} data-testid="intake-review" data-status={status}>
      {["uploading", "classifying"].includes(status) && (
        <p className="flex items-center gap-2 text-sm text-gray-700" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />{" "}{t("intakeReview.recognisingTheFiles")}{" "}{view.task?.message ? <span dir="ltr" className="text-xs text-gray-500">{view.task.message}</span> : null}
        </p>
      )}
      {status === "review" && express && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900" data-testid="express-intro">{t("intakeReview.expressRequestOneButtonFiles")}{view.express?.requestedTypes?.length ? ` — ${view.express.requestedTypes.join(t("common.listSep"))}` : ""}{t("intakeReview.everythingMadeIsMarkedNeeds")}</p>
      )}
      {status === "review" && (
        <>
          <NewBanner n={view.newEntities} />
          {unsure > 0 && <p className="text-xs text-amber-800">{unsure}{" "}{t("intakeReview.filesNeedALookFrom")}</p>}
        </>
      )}
      {status === "review" && <PageQuestions items={view.items} products={products} onAnswer={change} />}
      {express && status === "review" && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs text-blue-700 hover:underline" data-testid="express-show-all">
          {showAll ? t("intakeReview.showOnlyTheQuestions") : t("intakeReview.showAllFiles", { length: allRows.length })}
        </button>
      )}
      {/* Express: one block per product (its certificates and pages), the sure ones folded — not 25 rows to scroll (26 Nov) */}
      {express && status === "review" && !showAll && <ByProduct items={view.items} />}
      {status !== "classifying" && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[64rem] text-end text-xs" data-testid="intake-table">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-600">
              <tr>
                {[t("intakeReview.file"), t("intakeReview.whatItIs"), t("intakeReview.company2"), t("intakeReview.brand2"), t("intakeReview.products2"), t("intakeReview.country"), t("intakeReview.whatHappens"), t("intakeReview.confidence")].map((h) => (
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
          <p className="text-xs text-gray-500">{t("intakeReview.nothingHappensBeforeYouPress")}</p>
          <button type="button" onClick={run} disabled={busy} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50" data-testid="intake-run">
            {busy ? "…" : express ? t("intakeReview.makeTheCertificates") : t("intakeReview.doItAll")}
          </button>
        </div>
      )}
      {status === "executing" && (
        <div className="space-y-1" role="status">
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" />{" "}{t("intakeReview.sortingTheFiles")}{" "}{view.task?.progress ? `${view.task.progress}%` : ""}
          </p>
          <div className="h-1.5 rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${view.task?.progress || 5}%` }} />
          </div>
        </div>
      )}
      {view.harvest && <HarvestProgress batchId={view.batch?.id} initial={view.harvest} line={view.express?.harvestLine} onDone={load} />}
      {express && status === "done" && <ExpressPanel ex={view.express} batchId={view.batch?.id} onChanged={load} />}
      {status === "done" && view.summary && (
        <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900" data-testid="intake-summary">
          <p className="font-semibold">{pickText(view.summary.text)}</p>
          {view.summary.needs?.length > 0 && (
            <ul className="list-disc space-y-0.5 pe-5 text-xs text-gray-800">
              {view.summary.needs.slice(0, 12).map((n, k) => (
                <li key={k}>{n.link ? <Link to={n.link} className="text-blue-700 hover:underline">{pickText(n)}</Link> : pickText(n)}</li>
              ))}
              {view.summary.needs.length > 12 && <li>{t("intakeReview.andMore", { v: view.summary.needs.length - 12 })}</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pages whose product isn't sure (none printed, or the same name on two pages): ONE short
 * question instead of silent guesses. The suggestion comes from the same page of the drop's
 * other files ("page 3 of ADDVET OMAN COC is OLIGOVET"); nothing is applied until pressed.
 */
function PageQuestions({ items, products, onAnswer }) {
  const unsure = items.filter((i) => i.question === "product" && i.parentId);
  if (!unsure.length) return null;
  const withSuggestion = unsure.filter((i) => i.suggested?.name);
  const known = (i) => (products[i.company?.id] || []).find((p) => p.name.toUpperCase() === String(i.suggested?.name || "").toUpperCase());
  const accept = (i, name) => {
    const p = (products[i.company?.id] || []).find((x) => x.name.toUpperCase() === name.toUpperCase());
    return onAnswer(i, { products: [p ? { id: p.id } : { name }] });
  };
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950" data-testid="page-questions">
      <p className="font-semibold">
        {unsure.length}{" "}{t("intakeReview.pagesWereNotSureOf")}{withSuggestion.length > 1 && (
          <button type="button" className="ms-2 rounded-md bg-amber-700 px-2 py-0.5 font-semibold text-white hover:bg-amber-800" onClick={() => withSuggestion.reduce((p, i) => p.then(() => accept(i, i.suggested.name)), Promise.resolve())} data-testid="accept-suggestions">{t("intakeReview.acceptTheSuggestions", { length: withSuggestion.length })}</button>
        )}
      </p>
      <ul className="space-y-1">
        {unsure.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-700">{i.name.replace(/ — .*$/, "")}{" "}{t("intakeReview.page")}{" "}{i.pages}</span>
            {i.products?.[0]?.name && <span className="text-gray-500">{t("intakeReview.says", { name: i.products[0].name })}</span>}
            {i.suggested?.name && (
              <button type="button" onClick={() => accept(i, i.suggested.name)} className="rounded-full border border-amber-500 bg-white px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-100" title={i.suggested.says}>
                {i.suggested.name}
                {known(i) ? "" : t("intakeReview.new3")}
              </button>
            )}
            <select aria-label={t("intakeReview.product")} defaultValue="" onChange={(e) => e.target.value && accept(i, e.target.value)} className="rounded border border-amber-300 bg-white px-1 py-0.5">
              <option value="">{t("intakeReview.anotherProduct")}</option>
              {(products[i.company?.id] || []).map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Express review grouped by product: product → the files / pages that concern it; a product with nothing unsure is folded. */
function ByProduct({ items }) {
  const parents = new Set(items.filter((i) => items.some((x) => x.parentId === i.id)).map((i) => i.id));
  const leaves = items.filter((i) => !parents.has(i.id) && !["duplicate", "skip"].includes(i.action));
  const unsure = (i) => !!i.question || (i.confidence !== null && i.confidence < 0.7);
  const groups = new Map();
  for (const i of leaves) {
    const names = (i.products || []).map((p) => p.name).filter(Boolean);
    for (const n of names.length ? names : ["__none"]) {
      if (!groups.has(n)) groups.set(n, []);
      groups.get(n).push(i);
    }
  }
  const what = (i) => [i.certCode || DOC_TYPES[i.docType] || i.docType, i.pages && i.parentId ? t("intakeReview.p", { pages: i.pages }) : null].filter(Boolean).join(" · ");
  const list = [...groups.entries()].sort(([a, x], [b, y]) => Number(y.some(unsure)) - Number(x.some(unsure)) || (a === "__none") - (b === "__none") || a.localeCompare(b));
  return (
    <div className="space-y-1.5" data-testid="express-by-product">
      {list.map(([name, its]) => {
        const open = its.some(unsure);
        const isNew = its.some((i) => i.products?.some((p) => p.name === name && p.isNew));
        return (
          <details key={name} open={open} className={`rounded-lg border bg-white px-3 py-1.5 text-xs ${open ? "border-amber-300" : "border-gray-200"}`}>
            <summary className="cursor-pointer font-semibold text-gray-900">
              {name === "__none" ? t("intakeReview.filesWithNoProduct") : name}
              {isNew && <span className="ms-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">{t("intakeReview.new4")}</span>}
              <span className="ms-2 font-normal text-gray-500">{[...new Set(its.map((i) => i.certCode || DOC_TYPES[i.docType]))].filter(Boolean).join(t("common.listSep"))}</span>
              {open && <span className="ms-2 text-amber-800">{t("intakeReview.needsALook")}</span>}
            </summary>
            <ul className="mt-1 space-y-0.5 pe-3">
              {its.map((i) => (
                <li key={i.id} className={unsure(i) ? "text-amber-900" : "text-gray-600"}>
                  {what(i)} — {i.name.replace(/ — .*$/, "")}
                  {i.country ? ` · ${i.country}` : ""}
                  {unsure(i) && i.question ? ` · ${i.question === "product" ? t("intakeReview.whichProduct") : i.question === "country" ? t("intakeReview.whichCountry") : t("intakeReview.whatIsIt")}` : ""}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

