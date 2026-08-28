import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, HelpCircle } from "lucide-react";

// D1 (this is a regulated-output system — presentation carries meaning):
// - UNVERIFIABLE is NOT a pass. It means the system could not check. Never green,
//   never folded in with PASS.
// - NOT_APPLICABLE is a neutral state, not a warning.
// - FAIL must always be able to show its citation elsewhere in the UI.
// - Never soften or hide a failure to make a screen look cleaner.
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
};

export default function VerdictStatusBadge({ status, className = "" }) {
  const config = VERDICT_STATUS_CONFIG[status] || {
    label: status || "Unknown",
    icon: HelpCircle,
    classes: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${config.classes} ${className}`}>
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </span>
  );
}
