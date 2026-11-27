// PART 3 (28 Nov): «وضع التجربة — قفل قواعد الحماية» on the dashboard, for the owner / super-admin only (the
// backend refuses anyone else). On → a dialog that says what it means and asks for the company's name (or
// «كل الشركات») typed; off → one click. Everything made while it is on is a watermarked sample, for good.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FlaskConical } from "lucide-react";
import apiClient from "../services/apiClient";
import { getCompanies } from "../services/apiCompanies";
import { t } from "../i18n";

const ALL = t("experimentCard.allCompanies");

export default function ExperimentCard() {
  const [s, setS] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [scope, setScope] = useState("company");
  const [companyId, setCompanyId] = useState(() => {
    try {
      return localStorage.getItem("certificates.companyId") || "";
    } catch {
      return "";
    }
  });
  const [dialog, setDialog] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const load = (cid = companyId) =>
    apiClient
      .get("/experiment-mode", { params: cid ? { companyId: cid } : {} })
      .then((r) => setS(r.data.data))
      .catch(() => setS(null));
  useEffect(() => {
    load();
    getCompanies({ limit: 500 })
      .then((r) => setCompanies(r?.data?.companies || r?.companies || r?.data || []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s?.canToggle) return null;
  const company = companies.find((c) => c.id === companyId);
  const isOn = scope === "global" ? !!s.global?.on : !!s.company?.on;
  const send = async (on) => {
    setBusy(true);
    try {
      const r = await apiClient.post("/experiment-mode", { scope, companyId: scope === "company" ? companyId : null, on, confirm: typed });
      setS(r.data.data);
      setDialog(false);
      setTyped("");
      window.dispatchEvent(new Event("experiment-mode-changed"));
      toast.success(on ? t("experimentCard.experimentModeSwitchedOn") : t("experimentCard.experimentModeSwitchedOffNew"));
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const need = scope === "global" ? ALL : company?.name || "";
  return (
    <section className={`space-y-3 rounded-2xl border-2 p-5 ${isOn ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`} data-testid="experiment-card">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <FlaskConical className="h-5 w-5 text-red-600" />{" "}{t("experimentCard.experimentModeProtectionRulesOff")}</h2>
      <p className="text-sm text-gray-600">{t("experimentCard.whileItsOnAiFills")}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={scope === "company"} onChange={() => setScope("company")} />{" "}{t("experimentCard.oneCompany")}</label>
        {scope === "company" && (
          <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); load(e.target.value); }} className="rounded-lg border border-gray-300 px-2 py-1">
            <option value="">{t("experimentCard.pickACompany")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {(s.companiesOn || []).some((x) => x.id === c.id) ? t("experimentCard.experiment") : ""}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={scope === "global"} onChange={() => setScope("global")} /> {ALL}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${isOn ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"}`}>{isOn ? t("experimentCard.on") : t("experimentCard.off")}</span>
        {isOn ? (
          <button type="button" onClick={() => send(false)} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50" data-testid="experiment-off">{t("experimentCard.switchItOff")}</button>
        ) : (
          <button type="button" onClick={() => setDialog(true)} disabled={busy || (scope === "company" && !companyId)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40" data-testid="experiment-on">{t("experimentCard.switchItOn")}</button>
        )}
        {(s.companiesOn || []).length > 0 && <span className="text-xs text-gray-600">{t("experimentCard.onFor")}{" "}{s.companiesOn.map((c) => c.name).join(t("common.listSep"))}</span>}
      </div>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-red-700">{t("experimentCard.switchOnExperimentMode")}{" "}{scope === "global" ? t("experimentCard.for", { ALL }) : t("experimentCard.for2", { name: company?.name })}</h3>
            <ul className="list-disc space-y-1 pe-5 text-sm text-gray-700">
              <li>{t("experimentCard.aiWillFillEveryPlace")}</li>
              <li>{t("experimentCard.everyCertificateWillCarrySample")}</li>
              <li>{t("experimentCard.theseCertificatesCanNeverBe")}</li>
              {scope === "global" && <li>{t("experimentCard.itWillApplyToEvery")}</li>}
            </ul>
            <label className="block text-sm">
              {t("experimentCard.typeToConfirm1")}<b>{need}</b>{t("experimentCard.typeToConfirm2")}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5" data-testid="experiment-confirm" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDialog(false); setTyped(""); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">{t("experimentCard.cancel")}</button>
              <button type="button" onClick={() => send(true)} disabled={busy || typed.trim().toLowerCase() !== need.trim().toLowerCase()} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">{t("experimentCard.switchOnExperimentMode2")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
