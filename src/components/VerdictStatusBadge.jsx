import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, HelpCircle, CircleHelp, AlertOctagon } from "lucide-react";

// D1 (this is a regulated-output system — presentation carries meaning):
// - UNVERIFIABLE, NEEDS_CONFIRMATION, NEEDS_REVIEW are NOT passes. They mean the
//   system could not check, or could not check confidently. Never green, never
//   folded in with PASS, never given the same color as each other's different
//   flavor of "not sure" (extraction confidence vs. plausibility flag).
// - NOT_APPLICABLE is a neutral state, not a warning.
// - FAIL must always be able to show its citation elsewhere in the UI.
// - An unrecognized status string is a distinct alarm, not a quiet gray badge —
//   a status this UI doesn't know about is a contract drift, not a "nothing to see
//   here." It must never render identically to a genuinely neutral state.
export const VERDICT_STATUS_CONFIG = {
  PASS: {
    label: "Pass",
    icon: CheckCircle2,
    classes: "bg-green-50 text-green-800 border-green-200",
  },
  FAIL: {
    label: "Fail",
    icon: XCircle,
    classes: "bg-red-50 text-red-800 border-red-200",
  },
  WARN: {
    label: "Warning",
    icon: AlertTriangle,
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  NOT_APPLICABLE: {
    label: "Not Applicable",
    icon: MinusCircle,
    classes: "bg-gray-50 text-gray-600 border-gray-200",
  },
  UNVERIFIABLE: {
    label: "Unverifiable — Not Checked",
    icon: HelpCircle,
    classes: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  // §14.5.3: extraction confidence below threshold — "the system doesn't know
  // what this field says," not a judgment about the field's content at all.
  NEEDS_CONFIRMATION: {
    label: "Needs Confirmation",
    icon: CircleHelp,
    classes: "bg-orange-50 text-orange-800 border-orange-200",
  },
  // §14.5.7: scientific plausibility flag — structurally incapable of PASS/FAIL,
  // a question raised about a value that IS present, not a missing/uncertain read.
  NEEDS_REVIEW: {
    label: "Needs Review",
    icon: CircleHelp,
    classes: "bg-purple-50 text-purple-800 border-purple-200",
  },
};

const UNKNOWN_STATUS_CONFIG = {
  icon: AlertOctagon,
  classes: "bg-fuchsia-50 text-fuchsia-900 border-fuchsia-300 ring-1 ring-fuchsia-300",
};

export default function VerdictStatusBadge({ status, className = "" }) {
  const known = VERDICT_STATUS_CONFIG[status];
  const config = known || { label: `Unrecognized status: ${status || "(none)"}`, ...UNKNOWN_STATUS_CONFIG };
  const Icon = config.icon;
  return (
    <span
      title={known ? undefined : "This status isn't handled by the UI yet — treat this verdict as unverified and check manually."}
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${config.classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </span>
  );
}
