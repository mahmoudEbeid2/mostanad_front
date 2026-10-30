import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FileText } from "lucide-react";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import useCompanyScope from "../hooks/useCompanyScope";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { listCatalogues } from "../services/apiCatalogues";
import CatalogueUpload from "../components/catalogues/CatalogueUpload";
import CatalogueStatusPill, { Pill } from "../components/catalogues/CatalogueStatusPill";

// /catalogues (backend plan.md §15.2): a company's manufacturer catalogues, kept
// as source documents. A system user with manage_catalogues uploads one FOR a
// company. The legacy "Catalog Upload" page
// keeps working until this flow replaces it (§15.8). Upload is step 1 of 4 (design
// C0): once the file is checked a person chooses which pages the AI reads.
const STR = {
  title: "Catalogues",
  subtitle: "Manufacturer catalogues kept as source documents — every product value can be traced to its page.",
  pickCompany: "Pick a company to see its catalogues.",
  empty: "No catalogue yet for this company.",
  cols: ["Edition", "Uploaded", "Pages", "Blocks", "Status", ""],
  open: "Open",
  choosePages: "Choose pages",
  uploading: "Uploading",
};

// not extracted yet → the next step is choosing its pages
const needsPages = (v) => ["pages_ready", "segmented"].includes(v.status) && !v.pageSelection?.extractedAt;

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function Catalogues() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const { user } = useAuth();
  const canManage = hasPermission(user, "manage_catalogues");
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null); // the upload running on this page

  const load = useCallback(async () => {
    if (!scope) return;
    try {
      setCatalogues(await listCatalogues(scope));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        {!(scope && canManage) && <CompanyPicker scope={scopeState} />}
      </div>

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : (
        <>
          {canManage && <CatalogueUpload scopeState={scopeState} onUploaded={load} onActivity={setActivity} />}
          {activity && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" data-testid="upload-row">
              <span className="truncate font-medium text-gray-900">{activity.name}</span>
              <Pill label={`${STR.uploading} ${activity.percent}%`} tone="blue" percent={activity.percent} />
            </div>
          )}
          {loading ? (
            <div className="p-10 flex justify-center">
              <Spinner />
            </div>
          ) : catalogues.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-600 bg-white border border-gray-200 rounded-xl">{STR.empty}</p>
          ) : (
            catalogues.map((c) => (
              <section key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="catalogue">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">{c.manufacturer}</h2>
                  {c.brand && <span className="text-xs text-gray-500">{c.brand.name}</span>}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      {STR.cols.map((h, i) => (
                        <th key={i} className="px-4 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {c.versions.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{v.label}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtDate(v.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-700">{v.pages || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{v._count?.blocks || "—"}</td>
                        <td className="px-4 py-3">
                          <CatalogueStatusPill version={v} onDone={load} />
                          {v.error && <p className="text-xs text-red-700 mt-1">{v.error}</p>}
                          {(v.warnings || []).map((w, i) => (
                            <p key={i} className="text-xs text-amber-800 mt-1">
                              {w.message}
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                          {needsPages(v) && (
                            <Link to={`/catalogues/versions/${v.id}/pages`} className="font-medium text-blue-600 hover:underline" data-testid="choose-pages">
                              {STR.choosePages}
                            </Link>
                          )}
                          <Link to={`/catalogues/versions/${v.id}`} className="font-medium text-blue-600 hover:underline">
                            {STR.open}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
