import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FileCheck } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import CertificateCard from "../components/certificates/CertificateCard";
import useCompanyScope from "../hooks/useCompanyScope";
import { listCertificateTypes } from "../services/apiCertificateTypes";
import { listCertificates } from "../services/apiCertificatesV2";

// /certificates (plan §13.1): every generated certificate of the company, filterable.
const STR = {
  title: "Generated certificates",
  subtitle: "Every certificate made from an invoice. Open one to fix issues, export or finalize it.",
  search: "Search product, batch or invoice no.",
  allTypes: "All types",
  anyStatus: "Any status",
  statuses: { draft: "Draft", final: "Final", failed: "Failed", pending: "Rendering" },
  flagged: "Only with issues",
  empty: "No certificates yet. Upload an invoice to generate them.",
  goInvoices: "Go to invoices",
  noMatch: "No certificate matches these filters.",
  pickCompany: "Pick a company to see its certificates.",
  prev: "Previous",
  next: "Next",
};
const PAGE_SIZE = 20;

export default function CertificatesList() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const [params, setParams] = useSearchParams();
  const f = { q: params.get("q") || "", status: params.get("status") || "", certificateTypeId: params.get("certificateTypeId") || "", flagged: params.get("flagged") === "true", invoiceId: params.get("invoiceId") || "" };
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(f.q);
  const [types, setTypes] = useState([]);
  const [data, setData] = useState({ certificates: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const filtered = !!(f.q || f.status || f.certificateTypeId || f.flagged || f.invoiceId);

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
    try {
      const q = JSON.parse(query);
      const [list, t] = await Promise.all([
        listCertificates(scope, {
          q: q.q || undefined,
          status: q.status || undefined,
          certificateTypeId: q.certificateTypeId || undefined,
          flagged: q.flagged ? "true" : undefined,
          invoiceId: q.invoiceId || undefined,
          page: q.page,
          limit: PAGE_SIZE,
        }),
        listCertificateTypes(scope, { includeInactive: true }),
      ]);
      setData(list);
      setTypes(t);
    } catch (err) {
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
        <CompanyPicker scope={scopeState} />
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.certificates.map((c) => (
                <CertificateCard key={c.id} scope={scope} cert={c} />
              ))}
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
