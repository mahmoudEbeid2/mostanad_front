import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tags, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllLabels } from "../services/apiGeneratedLabels";
import toast from "react-hot-toast";

const STATUS_CLASSES = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  validated: "bg-green-50 text-green-800 border-green-200",
  failed_validation: "bg-red-50 text-red-800 border-red-200",
  approved: "bg-blue-50 text-blue-800 border-blue-200",
  revoked: "bg-orange-50 text-orange-800 border-orange-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};

const LIMIT = 20;

// §15 GET /labels — the only way to reach a generated label used to be immediately
// after generating it in the same session. This is the browse-all screen that fixes
// that.
export default function LabelsList() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

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
        if (!cancelled) toast.error(err.message || "Failed to load labels");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Tags className="w-8 h-8 text-blue-600" /> Generated Labels
        </h1>
        <p className="text-gray-500 mt-2">Every label produced by the AI Label Writer or scanned via label verification.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Language</th>
                <th className="px-6 py-4">Version</th>
                <th className="px-6 py-4">Risk Score</th>
                <th className="px-6 py-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                  </td>
                </tr>
              ) : labels.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-gray-400">
                    <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No labels yet</p>
                  </td>
                </tr>
              ) : (
                labels.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/labels/detail/${l.id}`)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_CLASSES[l.status] || STATUS_CLASSES.draft}`}>
                        {l.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">{l.country}</td>
                    <td className="px-6 py-4">{l.language}</td>
                    <td className="px-6 py-4 font-mono text-xs">v{l.currentVersion}</td>
                    <td className="px-6 py-4">{l.riskScore}</td>
                    <td className="px-6 py-4 text-xs text-gray-500">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {totalPages} · {total} label(s)</span>
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
