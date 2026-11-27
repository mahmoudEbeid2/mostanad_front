// PART 3 (28 Nov): experiment mode is impossible to miss — a red bar on every screen while it is on for
// the company in view (or for all companies, with who turned it on). What is made meanwhile is a sample.
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import apiClient from "../services/apiClient";
import { t } from "../i18n";

const selectedCompany = () => {
  try {
    return localStorage.getItem("certificates.companyId") || "";
  } catch {
    return "";
  }
};

export function useExperimentStatus() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      const companyId = selectedCompany();
      apiClient
        .get("/experiment-mode", { params: companyId ? { companyId } : {} })
        .then((r) => alive && setS(r.data.data))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    window.addEventListener("experiment-mode-changed", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", load);
      window.removeEventListener("experiment-mode-changed", load);
    };
  }, []);
  return s;
}

export default function ExperimentBanner({ compact = false }) {
  const s = useExperimentStatus();
  if (!s?.banner) return null;
  const who = s.global?.on ? `${t("experimentBanner.allCompanies")}${s.global.byName ? t("experimentBanner.switchedOnBy", { byName: s.global.byName }) : ""}` : s.company?.on ? `${t("experimentBanner.forCompany", { name: s.company.name })}${s.company.byName ? t("experimentBanner.switchedOnBy", { byName: s.company.byName }) : ""}` : "";
  return (
    <div role="alert" data-testid="experiment-banner" className={`flex items-center gap-2 rounded-xl border-2 border-red-500 bg-red-600 font-bold text-white ${compact ? "px-3 py-1.5 text-xs" : "mb-4 px-4 py-2.5 text-sm"}`}>
      <FlaskConical className="h-4 w-4 shrink-0" />
      <span>{s.banner}</span>
      {who && <span className="font-normal opacity-90">({who})</span>}
    </div>
  );
}
