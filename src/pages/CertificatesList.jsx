import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FileCheck, AlertTriangle, RefreshCw, Archive, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import RoleBanner from "../components/certificates/RoleBanner";
import CertificateCard from "../components/certificates/CertificateCard";
import useCompanyScope from "../hooks/useCompanyScope";
import { listCertificateTypes } from "../services/apiCertificateTypes";
import { listCertificates } from "../services/apiCertificatesV2";
import { fmtDate, strings, t } from "../i18n";

// /certificates (plan §13.1): every generated certificate of the company, filterable. UI plan, Phase G: the
// cards are grouped by the request (invoice) they belong to, and drafts can be picked for a bulk archive /
// delete (POST /certificates/bulk — BACKEND_API_TODO.md §7; until it exists the buttons say "coming soon").

/** the page's certificates, by request, in the order they came (newest first) */
function byRequest(certificates) {
  const groups = new Map();
  for (const c of certificates) {
    const key = c.invoiceId && !c.withoutInvoice ? c.invoiceId : "";
    if (!groups.has(key)) groups.set(key, { key, invoiceNumber: c.invoiceNumber, createdAt: c.createdAt, items: [] });
    groups.get(key).items.push(c);
  }
  return [...groups.values()];
}

const STR = strings("certificatesList");
const PAGE_SIZE = 20;

export default function CertificatesList() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const [params, setParams] = useSearchParams();
  const f = { q: params.get("q") || "", status: params.get("status") || "", certificateTypeId: params.get("certificateTypeId") || "", flagged: params.get("flagged") === "true", invoiceId: params.get("invoiceId") || "", batchId: params.get("batchId") || "" };
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(f.q);
  const [types, setTypes] = useState([]);
  const [data, setData] = useState({ certificates: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const toggle = (ids, on) =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on ?? !next.has(id)) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const filtered = !!(f.q || f.status || f.certificateTypeId || f.flagged || f.invoiceId || f.batchId);

  const setParam = useCallback(
    (key, value) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  useEffect(() => {
    if (search === f.q) return undefined;
    const t = setTimeout(() => setParam("q", search.trim()), 350);
    return () => clearTimeout(t);
  }, [search, f.q, setParam]);

  const query = JSON.stringify({ ...f, page });
  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    setLoadError(null);
    try {
      const q = JSON.parse(query);
      const [list, t] = await Promise.all([
        listCertificates(scope, {
          q: q.q || undefined,
          status: q.status || undefined,
          certificateTypeId: q.certificateTypeId || undefined,
          flagged: q.flagged ? "true" : undefined,
          invoiceId: q.invoiceId || undefined,
          batchId: q.batchId || undefined, // the certificates a chat card or "Make certificates" just made
          page: q.page,
          limit: PAGE_SIZE,
        }),
        listCertificateTypes(scope, { includeInactive: true }),
      ]);
      setData(list);
      setTypes(t);
    } catch (err) {
      setLoadError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, query]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        <div className="flex items-start gap-2">
          {/* the client's workflow: a request from names / products, its matrix of certificates */}
          <Link to={`/certificates/requests/new${scopeState?.companyId ? `?companyId=${scopeState.companyId}` : ""}`} className="inline-flex items-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700" data-testid="new-request">{t("certificatesList.newCertificateRequest")}</Link>
        </div>
      </div>

      <RoleBanner scope={scopeState} />

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={STR.search} aria-label={STR.search} className="border border-gray-300 rounded-lg px-3 py-2 w-72 max-w-full" />
            <select aria-label={STR.allTypes} value={f.certificateTypeId} onChange={(e) => setParam("certificateTypeId", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="">{STR.allTypes}</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <select aria-label={STR.anyStatus} value={f.status} onChange={(e) => setParam("status", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="">{STR.anyStatus}</option>
              {Object.entries(STR.statuses).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" checked={f.flagged} onChange={(e) => setParam("flagged", e.target.checked ? "true" : "")} /> {STR.flagged}
            </label>
          </div>

          {loading ? (
            <div className="p-10 flex justify-center">
              <Spinner />
            </div>
          ) : loadError ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t("certificatesList.loadError")} {loadError}
              <button type="button" onClick={load} className="ms-auto inline-flex items-center gap-1 font-semibold underline">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("certificatesList.retry")}
              </button>
            </div>
          ) : data.certificates.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
              <FileCheck className="w-10 h-10 mx-auto text-gray-300" />
              <p className="text-sm text-gray-600">{filtered ? STR.noMatch : STR.empty}</p>
              {!filtered && (
                <Link to="/invoices" className="text-blue-600 hover:underline text-sm font-medium">
                  {STR.goInvoices}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {selected.size > 0 && (
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm" data-testid="bulk-bar">
                  <span className="font-semibold text-blue-900">{t("certificatesList.selected", { count: selected.size })}</span>
                  <button type="button" disabled title={t("certificatesList.bulkSoon")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-500 opacity-60">
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" /> {t("certificatesList.archive")}
                  </button>
                  <button type="button" disabled title={t("certificatesList.bulkSoon")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-500 opacity-60">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("certificatesList.delete")}
                  </button>
                  <span className="text-xs text-blue-900">{t("certificatesList.bulkSoon")}</span>
                  <button type="button" onClick={() => setSelected(new Set())} className="ms-auto text-xs font-semibold text-blue-700 underline">{t("certificatesList.clear")}</button>
                </div>
              )}
              {byRequest(data.certificates).map((g) => {
                const drafts = g.items.filter((c) => c.status === "draft").map((c) => c.id);
                const allOn = drafts.length > 0 && drafts.every((id) => selected.has(id));
                return (
                  <section key={g.key || "none"} className="space-y-3" data-testid="certificate-group">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-200 pb-2">
                      <h2 className="font-semibold text-gray-900">
                        {g.key ? (g.invoiceNumber ? t("certificatesList.requestNo", { no: g.invoiceNumber }) : t("certificatesList.byRequest", { date: fmtDate(g.createdAt) })) : t("certificatesList.noRequest")}
                      </h2>
                      <span className="text-xs text-gray-500">
                        {t("certificatesList.count", { count: g.items.length })}
                        {drafts.length > 0 && ` · ${t("certificatesList.drafts", { count: drafts.length })}`}
                      </span>
                      {g.key && <Link to={`/certificates/requests/${g.key}`} className="text-sm font-medium text-teal-700 hover:underline">{t("certificatesList.openRequest")}</Link>}
                      {drafts.length > 0 && (
                        <label className="ms-auto inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <input type="checkbox" checked={allOn} onChange={() => toggle(drafts, !allOn)} /> {t("certificatesList.selectDrafts")}
                        </label>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {g.items.map((c) => (
                        <CertificateCard key={c.id} scope={scope} cert={c} select={c.status === "draft" ? { checked: selected.has(c.id), onChange: () => toggle([c.id]) } : undefined} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {pages > 1 && (
            <div className="flex justify-center items-center gap-3 text-sm">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                {STR.prev}
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button variant="secondary" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
                {STR.next}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
