import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tags, ChevronLeft, ChevronRight, Ruler, Image as ImageIcon } from "lucide-react";
import { getAllLabels } from "../services/apiGeneratedLabels";
import { getCompanies } from "../services/apiCompanies";
import { getProductById } from "../services/apiProducts";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser, hasPermission } from "../utils/permissions";
import UploadResizeModal from "../components/label-detail/UploadResizeModal";
import toast from "react-hot-toast";
import { countryName, fmtDate, has, t } from "../i18n";

const STATUS_CLASSES = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  validated: "bg-green-50 text-green-800 border-green-200",
  failed_validation: "bg-red-50 text-red-800 border-red-200",
  approved: "bg-blue-50 text-blue-800 border-blue-200",
  revoked: "bg-orange-50 text-orange-800 border-orange-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};

const LIMIT = 20;

// a label's country: "XX" (unknown) reads "—" (UI plan, Phase G)
const country = (c) => (c && c !== "XX" ? countryName(c) || c : "—");

// §15 GET /labels — the only way to reach a generated label used to be immediately
// after generating it in the same session. This is the browse-all screen that fixes
// that.
export default function LabelsList() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  // "Upload label to resize": a system user names the company the file belongs to
  const { user } = useAuth();
  const isSystem = !(isCompanyUser(user) || user?.isCompany);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    if (!resizeOpen || !isSystem || companies.length) return;
    getCompanies({ limit: 100 })
      .then((r) => setCompanies(r?.data?.companies || []))
      .catch(() => setCompanies([]));
  }, [resizeOpen, isSystem, companies.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const { labels: rows, total: t } = await getAllLabels({ page, limit: LIMIT });
        if (cancelled) return;
        setLabels(rows);
        setTotal(t);
      } catch (err) {
        if (!cancelled) toast.error(err.message || t("labelsList.failedToLoadLabels"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  // the list gives ids only: the page's products (≤ LIMIT) are read once each, the companies once
  const [names, setNames] = useState({ products: {}, companies: {} });
  useEffect(() => {
    const ids = [...new Set(labels.map((l) => l.productId).filter(Boolean))].filter((id) => !(id in names.products));
    if (!ids.length) return;
    Promise.all(ids.map((id) => getProductById(id).then((r) => [id, r?.data?.product || null]).catch(() => [id, null]))).then((pairs) =>
      setNames((n) => ({ ...n, products: { ...n.products, ...Object.fromEntries(pairs) } }))
    );
  }, [labels]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isSystem) return;
    getCompanies({ limit: 100 })
      .then((r) => setNames((n) => ({ ...n, companies: Object.fromEntries((r?.data?.companies || []).map((c) => [c.id, c.name])) })))
      .catch(() => {});
  }, [isSystem]);
  const companyOf = (l) => (isSystem ? names.companies[l.companyId] : user?.company?.name || user?.name) || names.products[l.productId]?.company?.name || "—";

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Tags className="w-8 h-8 text-blue-600" />{" "}{t("labelsList.myLabels")}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-gray-500">{t("labelsList.everyLabelYouCreatedOr")}</p>
          {hasPermission(user, "update_labels") && (
            <button type="button" onClick={() => setResizeOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50" data-testid="open-resize-upload">
              <Ruler className="w-4 h-4 text-blue-600" />{" "}{t("labelsList.uploadLabelToResize")}</button>
          )}
        </div>
      </div>
      {resizeOpen && <UploadResizeModal onClose={() => setResizeOpen(false)} isSystem={isSystem} companies={companies} />}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 w-16"><span className="sr-only">{t("labelsList.thumbnail")}</span></th>
                <th className="px-4 py-4">{t("labelsList.product")}</th>
                <th className="px-4 py-4">{t("labelsList.company")}</th>
                <th className="px-4 py-4">{t("labelsList.status")}</th>
                <th className="px-4 py-4">{t("labelsList.country")}</th>
                <th className="px-4 py-4">{t("labelsList.language")}</th>
                <th className="px-4 py-4">{t("labelsList.version")}</th>
                <th className="px-4 py-4">{t("labelsList.created")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                  </td>
                </tr>
              ) : labels.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-16 text-center text-gray-400">
                    <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-bold text-gray-700">{t("labelsList.noLabelsYet")}</p>
                    <p className="text-sm mt-1">{t("labelsList.createALabelFromProduct")}</p>
                  </td>
                </tr>
              ) : (
                labels.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/labels/detail/${l.id}`)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      {/* no list thumbnail endpoint yet (BACKEND_API_TODO.md §9): a neutral tile */}
                      <span className="flex h-12 w-10 items-center justify-center rounded border border-gray-200 bg-gray-50" aria-hidden="true"><ImageIcon className="h-4 w-4 text-gray-300" /></span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900" dir="auto">
                      {(() => {
                        const p = names.products[l.productId];
                        if (!l.productId) return "—";
                        if (p === undefined) return <span className="inline-block h-3 w-24 animate-pulse rounded bg-gray-100" />;
                        return p ? [p.name, p.packaging].filter(Boolean).join(" · ") : "—";
                      })()}
                    </td>
                    <td className="px-4 py-3" dir="auto">{companyOf(l)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${STATUS_CLASSES[l.status] || STATUS_CLASSES.draft}`}>
                        {has(`labelsList.statuses.${l.status}`) ? t(`labelsList.statuses.${l.status}`) : l.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">{country(l.country)}</td>
                    <td className="px-4 py-3">{l.language || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">v{l.currentVersion}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(l.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">{t("labelsList.pageOfLabelS", { page, totalPages, total })}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
