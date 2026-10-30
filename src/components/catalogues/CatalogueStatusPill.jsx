import useTaskProgress from "../../hooks/useTaskProgress";
import { catalogueVersionStatus } from "../../utils/catalogueStatus";

// One version's status in the catalogue list (design C0). A running extraction
// shows its % and a small bar; the row reloads the list when the job ends.
const LOOK = {
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-700",
};
const PILLS = {
  pages_ready: ["Choose pages", "amber"],
  segmented: ["Choose pages", "amber"], // read before this flow, not extracted yet
  review: ["Review", "amber"],
  applied: ["Applied", "green"],
  failed: ["Failed", "red"],
  extraction_failed: ["Extraction failed", "red"],
};

export function Pill({ label, tone, percent }) {
  return (
    <span className="inline-flex min-w-24 flex-col gap-1">
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-semibold ${LOOK[tone]}`} data-testid="version-status">
        {label}
      </span>
      {percent !== undefined && (
        <span role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="block h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <span className="block h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
        </span>
      )}
    </span>
  );
}

function Extracting({ version, onDone }) {
  const task = useTaskProgress(version.task?.id || null, { onDone });
  const percent = Math.max(task.progress || 0, version.task?.progress || 0);
  return <Pill label={`Extracting ${percent}%`} tone="blue" percent={percent} />;
}

export default function CatalogueStatusPill({ version, onDone }) {
  const status = catalogueVersionStatus(version);
  if (status === "extracting") return <Extracting version={version} onDone={onDone} />;
  const [label, tone] = PILLS[status] || [status, "gray"];
  return <Pill label={label} tone={tone} />;
}
