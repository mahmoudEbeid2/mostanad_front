// Admin → Experiment mode (UI plan, Phase E: the card left the dashboard). The card itself decides who may
// switch it (owner / super-admin, from the server); the red banner stays on every page while it is on.
import ExperimentCard from "../components/ExperimentCard";
import { strings } from "../i18n";

const STR = strings("adminExperiment");

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
