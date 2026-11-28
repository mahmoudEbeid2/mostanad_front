// The header above every page (UI plan, Phase G): the ONE company switcher every page follows, and who you
// work as — "System admin" once, as a small badge beside the picker, instead of a banner on every page.
import CompanyPicker from "../components/certificates/CompanyPicker";
import useCompanyScope from "../hooks/useCompanyScope";
import { t } from "../i18n";

export default function GlobalHeader() {
  const scope = useCompanyScope();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-end gap-2.5" data-testid="global-header">
      <span
        data-testid="role-badge"
        title={scope.isCompany ? t("roleBanner.companyNote", { name: scope.companyName }) : t("roleBanner.systemNote")}
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${scope.isCompany ? "bg-emerald-700" : "bg-indigo-700"}`}
      >
        {scope.isCompany ? t("roleBanner.company") : t("roleBanner.system")}
      </span>
      <CompanyPicker scope={scope} inHeader />
    </div>
  );
}
