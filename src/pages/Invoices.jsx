import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import StatusBadge from "../components/certificates/StatusBadge";
import InvoiceUploadPanel from "../components/certificates/InvoiceUploadPanel";
import useCompanyScope from "../hooks/useCompanyScope";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { listInvoices } from "../services/apiInvoices";

// /invoices and /invoices/new (plan §13.1, §13.5; mockup B1): upload panel on
// top, the company's recent invoices below.
const STR = {
  title: "Invoices",
  subtitle: "Upload a shipment invoice — we read the products and make every certificate it needs.",
  systemBadge: "System admin",
  systemNote: "Products are matched only inside the company you pick.",
  companyBadge: "Company account",
  companyNote: "Only your invoices, products and templates are used.",
  pickCompany: "Pick a company to upload and see its invoices.",
  recent: "Recent invoices",
  search: "Search invoice no. or customer",
  empty: "No invoices yet. Upload one above to generate its certificates.",
  noMatch: "No invoice matches this search.",
  cols: ["Invoice", "Customer", "Country", "Lines", "Certificates", "Status", ""],
  action: { uploaded: "View progress", extracting: "View progress", review: "Review", ready: "Review", failed: "See error" },
  open: "Open",
  prev: "Previous",
  next: "Next",
};

const PAGE_SIZE = 20;

const certificatesCell = (inv) => {
  const c = inv.certificateCounts;
  if (!c?.total) return "—";
  return c.final ? `${c.total} · ${c.final} final` : String(c.total);
};

export default function Invoices() {
  const scopeState = useCompanyScope();
  const { scope, companyId, isCompany } = scopeState;
  const { user } = useAuth();
  const canUpload = hasPermission(user, "create_invoices");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(q);
  const [data, setData] = useState({ invoices: [], total: 0 });
  const [loading, setLoading] = useState(true);

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

  // debounced search → ?q=
  useEffect(() => {
    if (search === q) return undefined;
    const t = setTimeout(() => setParam("q", search.trim()), 350);
    return () => clearTimeout(t);
  }, [search, q, setParam]);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      setData(await listInvoices(scope, { q: q || undefined, page, limit: PAGE_SIZE }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, q, page]);

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

      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        <span className="rounded-full bg-indigo-600 text-white text-xs font-semibold px-2.5 py-0.5">{isCompany ? STR.companyBadge : STR.systemBadge}</span>
        {isCompany ? STR.companyNote : STR.systemNote}
      </div>

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : (
        <>
          {canUpload && <InvoiceUploadPanel scope={scope} companyId={companyId} />}

          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{STR.recent}</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={STR.search}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 max-w-full"
              />
            </div>
            {loading ? (
              <div className="p-10 flex justify-center">
                <Spinner />
              </div>
            ) : data.invoices.length === 0 ? (
              <p className="p-10 text-center text-sm text-gray-600">{q ? STR.noMatch : STR.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="invoices-table">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      {STR.cols.map((h, i) => (
                        <th key={i} className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">{inv.header?.invoiceNumber || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{inv.header?.customerName || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{inv.country || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{inv._count?.items || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{certificatesCell(inv)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/invoices/${inv.id}`} className="font-medium text-blue-600 hover:underline whitespace-nowrap">
                            {STR.action[inv.status] || STR.open}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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
