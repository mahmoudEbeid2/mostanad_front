// The requests list (UI plan, 27 Nov: "/certificates/requests" showed "Validation error in params: id:
// Invalid UUID"; a request could only be found again through a chat link). One row per request: company,
// products, each certificate type's progress (final of made), its status, when it last changed.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import useCompanyScope from "../hooks/useCompanyScope";
import { listCertificateRequests } from "../services/apiWorkflow";
import { pick, LANG } from "../i18n/lang";

const STR = pick({
  en: {
    title: "Requests",
    subtitle: "Every certificate request: what it covers and how far each certificate type is.",
    newRequest: "New request",
    pickCompany: "Pick a company to see its requests.",
    empty: "No requests yet.",
    emptyHint: "Start one with “New request”, or drop files in the assistant.",
    request: "Request",
    company: "Company",
    products: "Products",
    progress: "Progress",
    status: "Status",
    updated: "Updated",
    more: (n) => `+${n} more`,
    finalOf: (f, t) => `${f}/${t} final`,
    none: "none yet",
    failed: (n) => `${n} failed`,
    statuses: { new: "New", in_progress: "In progress", ready: "Ready" },
    prev: "Previous",
    next: "Next",
    page: (p, n) => `Page ${p} of ${n}`,
  },
  ar: {
    title: "الطلبات",
    subtitle: "كل طلبات الشهادات: كل طلب فيه إيه، وكل نوع شهادة وصل لفين.",
    newRequest: "طلب جديد",
    pickCompany: "اختار شركة عشان تشوف طلباتها.",
    empty: "مفيش طلبات لسه.",
    emptyHint: "ابدأ طلب من «طلب جديد»، أو ارمي الملفات في المساعد.",
    request: "الطلب",
    company: "الشركة",
    products: "المنتجات",
    progress: "التقدّم",
    status: "الحالة",
    updated: "آخر تعديل",
    more: (n) => `+${n} كمان`,
    finalOf: (f, t) => `${f}/${t} نهائية`,
    none: "لسه مفيش",
    failed: (n) => `${n} فشلت`,
    statuses: { new: "جديد", in_progress: "شغّال", ready: "جاهز" },
    prev: "السابق",
    next: "التالي",
    page: (p, n) => `صفحة ${p} من ${n}`,
  },
});
const STATUS_STYLE = { new: "bg-gray-100 text-gray-700", in_progress: "bg-amber-50 text-amber-800", ready: "bg-green-50 text-green-800" };
const PAGE_SIZE = 25;
// Western digits in both languages, DD/MM/YYYY (UI plan, Phase A §6)
const fmtDate = (d) => new Intl.DateTimeFormat(`${LANG === "ar" ? "ar-EG" : "en-GB"}-u-nu-latn`, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

export default function CertificateRequests() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") || 1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      setData(await listCertificateRequests(scope, { page, pageSize: PAGE_SIZE }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, page]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  const goPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6" data-testid="requests-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{STR.subtitle}</p>
        </div>
        <div className="flex items-start gap-2">
          <Link to={`/certificates/requests/new${scopeState?.companyId ? `?companyId=${scopeState.companyId}` : ""}`} className="inline-flex items-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700" data-testid="requests-new">
            {STR.newRequest}
          </Link>
          <CompanyPicker scope={scopeState} />
        </div>
      </div>

      <RoleBanner scope={scopeState} />

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !data.items.length ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center" data-testid="requests-empty">
          <ClipboardList className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 font-semibold text-gray-800">{STR.empty}</p>
          <p className="mt-1 text-sm text-gray-500">{STR.emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm" data-testid="requests-table">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                {[STR.request, STR.company, STR.products, STR.progress, STR.status, STR.updated].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((r) => (
                <tr key={r.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link to={`/certificates/requests/${r.id}`} className="font-semibold text-blue-700 hover:underline" data-testid="request-link">
                      {fmtDate(r.createdAt)} · {r.id.slice(0, 8)}
                    </Link>
                    {r.consignee && (
                      <div className="mt-0.5 max-w-[14rem] truncate text-xs text-gray-500" dir="auto">
                        {r.consignee}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800" dir="auto">
                    {r.company?.name || "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-700" dir="auto">
                    {r.products.slice(0, 3).map((p) => (p.pack ? `${p.name} ${p.pack}` : p.name)).join(" · ")}
                    {r.products.length > 3 && <span className="text-gray-500"> {STR.more(r.products.length - 3)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.codes.map((code) => {
                        const t = r.types[code] || { total: 0, final: 0, failed: 0 };
                        const pct = t.total ? Math.round((100 * t.final) / t.total) : 0;
                        return (
                          <span key={code} className="inline-flex min-w-[7.5rem] flex-col rounded-lg border border-gray-200 px-2 py-1 text-xs" data-type={code}>
                            <span className="flex justify-between gap-2">
                              <span className="font-semibold text-gray-800">{code}</span>
                              <span className="text-gray-500">{t.total ? STR.finalOf(t.final, t.total) : STR.none}</span>
                            </span>
                            <span className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                              <span className="block h-full bg-green-500" style={{ width: `${pct}%` }} />
                            </span>
                            {t.failed > 0 && <span className="mt-0.5 text-red-700">{STR.failed(t.failed)}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.new}`}>{STR.statuses[r.status] || r.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <Button variant="secondary" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            {STR.prev}
          </Button>
          <span>{STR.page(page, pages)}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => goPage(page + 1)}>
            {STR.next}
          </Button>
        </div>
      )}
    </div>
  );
}
