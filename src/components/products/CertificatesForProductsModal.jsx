import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, FileCheck2, AlertTriangle, Download } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { listCertificateTypes } from "../../services/apiCertificateTypes";
import { waitForTask, downloadBatchZip, exportBatchZip } from "../../services/apiCertificatesV2";
import { certificatesForProducts } from "../../services/apiProductImports";
import CertificateSetup from "./CertificateSetup";
import { t } from "../../i18n";

// Products page → select products → "Make certificates": certificates for several
// products at once, no invoice. Choose the types, optionally the batch facts per product
// (only what you type is used — a missing one stays a marked blank on the draft), see what
// will be made and what has no template, then make them: drafts, reviewed before final.

const FACTS = [
  ["batchNo", t("certificatesForProductsModal.batchNo")],
  ["productionDate", t("certificatesForProductsModal.productionDate")],
  ["expiryDate", t("certificatesForProductsModal.expiryDate")],
];

export default function CertificatesForProductsModal({ products, onClose }) {
  const navigate = useNavigate();
  const companyIds = [...new Set(products.map((p) => p.companyId))];
  const companyId = companyIds.length === 1 ? companyIds[0] : null;
  const scope = { companyId };
  const [types, setTypes] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [batch, setBatch] = useState({}); // productId → { batchNo, … }
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const loadTypes = () => listCertificateTypes(scope).then(setTypes).catch((e) => setError(e.message));
  useEffect(() => {
    if (!companyId) return;
    loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const body = (dryRun) => ({ companyId, certificateTypeIds: chosen, dryRun, products: products.map((p) => ({ productId: p.id, batch: batch[p.id] || {} })) });
  useEffect(() => {
    setPlan(null);
    if (!chosen.length) return;
    certificatesForProducts(body(true)).then(setPlan).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen.join("|")]);

  const make = async () => {
    setBusy("make");
    setError(null);
    try {
      const out = await certificatesForProducts(body(false));
      await waitForTask(out.taskId, { timeoutMs: 300_000 });
      setDone(out);
      toast.success(t("certificatesForProductsModal.certificateDraftsAreReady"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // the ZIP is built by a background export first (as on the batch page)
  const downloadAll = async () => {
    setBusy("zip");
    try {
      const { taskId } = await exportBatchZip(scope, done.batchId);
      await waitForTask(taskId, { timeoutMs: 300_000 });
      await downloadBatchZip(scope, done.batchId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("certificatesForProductsModal.makeCertificates")}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FileCheck2 className="h-5 w-5 text-teal-600" /> {t("certificatesForProductsModal.title", { count: products.length })}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("certificatesForProductsModal.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm">
          {!companyId && <p className="text-red-700">{t("certificatesForProductsModal.chooseProductsOfOneCompany")}</p>}
          {companyId && !types && !error && <Spinner />}
          {types && !done && (
            <>
              <div>
                <p className="mb-2 font-semibold text-gray-800">{t("certificatesForProductsModal.certificates")}</p>
                <div className="flex flex-wrap gap-2">
                  {types.map((t) => {
                    const on = chosen.includes(t.id);
                    return (
                      <button key={t.id} type="button" aria-pressed={on} onClick={() => setChosen(on ? chosen.filter((x) => x !== t.id) : [...chosen, t.id])} className={`rounded-lg border px-3 py-1.5 ${on ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                        {t.code} <span className="text-xs text-gray-500">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* nothing set up, or a chosen type with no template: set it up right here */}
              {(!types.length || plan?.missing?.length > 0) && (
                <CertificateSetup companyId={companyId} types={types} missingTypes={[...new Set((plan?.missing || []).map((m) => m.type))]} onChanged={loadTypes} />
              )}
              <div>
                <p className="mb-1 font-semibold text-gray-800">{t("certificatesForProductsModal.batchFactsOptional")}</p>
                <p className="mb-2 text-xs text-gray-500">{t("certificatesForProductsModal.onlyWhatYouTypeIs")}</p>
                <table className="w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 text-start font-semibold">{t("certificatesForProductsModal.product")}</th>
                      {FACTS.map(([, l]) => (
                        <th key={l} className="py-1 text-start font-semibold">
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1 pe-2 font-medium text-gray-800">{p.name}</td>
                        {FACTS.map(([k, l]) => (
                          <td key={k} className="py-1 pe-2">
                            <input value={batch[p.id]?.[k] || ""} onChange={(e) => setBatch({ ...batch, [p.id]: { ...(batch[p.id] || {}), [k]: e.target.value } })} className="w-full rounded border border-gray-300 px-1.5 py-1" aria-label={t("certificatesForProductsModal.of", { l, name: p.name })} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan && (
                <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3" data-testid="certs-plan">
                  <p className="font-semibold text-gray-800">{t("certificatesForProductsModal.willBeMade", { count: plan.planned.length })}</p>
                  <ul className="text-xs text-gray-700">
                    {plan.planned.map((e, i) => (
                      <li key={i}>
                        {e.type} — {e.products.join(", ")}
                        {e.scope === "per_invoice" && e.products.length > 1 ? t("certificatesForProductsModal.oneCertificateForAll") : ""}
                      </li>
                    ))}
                  </ul>
                  {plan.notReady?.length > 0 && (
                    <div className="space-y-0.5 text-xs text-red-800" data-testid="plan-not-ready">
                      {plan.notReady.map((n) => (
                        <p key={n.versionId} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n.type}: {n.message}{" "}
                          <a href={n.link} className="font-semibold text-blue-700 hover:underline">{t("certificatesForProductsModal.markThem")}</a>
                        </p>
                      ))}
                    </div>
                  )}
                  {plan.missing.length > 0 && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("certificatesForProductsModal.noActiveTemplate")} {plan.missing.map((m) => t("certificatesForProductsModal.for", { type: m.type, product: m.product })).join(t("common.listSep"))}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {done && (
            <div className="space-y-3" data-testid="certs-done">
              <p className="font-semibold text-green-800">{t("certificatesForProductsModal.made", { count: done.planned.length })}</p>
              {done.missing.length > 0 && <p className="text-xs text-amber-800">{t("certificatesForProductsModal.notMadeNoActiveTemplate")} {done.missing.map((m) => `${m.type} · ${m.product}`).join(t("common.listSep"))}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate(`/certificates?batchId=${done.batchId}${companyId ? `&companyId=${companyId}` : ""}`)}>{t("certificatesForProductsModal.openTheDrafts")}</Button>
                <Button variant="secondary" isLoading={busy === "zip"} disabled={!!busy} onClick={downloadAll}>
                  <Download className="h-4 w-4" /> {t("certificatesForProductsModal.downloadAllZip")}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-red-600" role="alert">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
        </div>
        {!done && (
          <div className="flex justify-start gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
            <Button onClick={make} isLoading={busy === "make"} disabled={!plan?.planned.length || plan?.notReady?.length > 0 || !!busy} data-testid="make-certificates">
              {t("certificatesForProductsModal.make", { count: plan?.planned.length || 0 })}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {t("certificatesForProductsModal.cancel")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
