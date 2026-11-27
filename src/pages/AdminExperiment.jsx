// Admin → Experiment mode (UI plan, Phase E: the card left the dashboard). The card itself decides who may
// switch it (owner / super-admin, from the server); the red banner stays on every page while it is on.
import ExperimentCard from "../components/ExperimentCard";
import { pick } from "../i18n/lang";

const STR = pick({
  en: {
    title: "Experiment mode",
    subtitle: "Turn the protection rules off for one company while testing. Only the owner or a super-admin can switch it; while it's on, a red banner shows on every page.",
    noAccess: "If nothing shows below, your account can't switch experiment mode.",
  },
  ar: {
    title: "وضع التجربة",
    subtitle: "قفل قواعد الحماية لشركة واحدة وقت التجربة. صاحب الحساب أو السوبر أدمن بس يقدر يشغّله؛ وهو شغّال بيظهر شريط أحمر في كل الصفحات.",
    noAccess: "لو مفيش حاجة ظاهرة تحت، حسابك مايقدرش يشغّل وضع التجربة.",
  },
});

export default function AdminExperiment() {
  return (
    <div className="max-w-3xl space-y-4" data-testid="admin-experiment">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{STR.subtitle}</p>
      </div>
      <ExperimentCard />
      <p className="text-xs text-gray-400">{STR.noAccess}</p>
    </div>
  );
}
