import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, HelpCircle, CircleHelp, AlertOctagon } from "lucide-react";
import { t } from "../i18n";

export const VERDICT_STATUS_CONFIG = {
  PASS: {
    label: t("verdictStatusBadge.fine"),
    icon: CheckCircle2,
    classes: "bg-green-50 text-green-800 border-green-200",
  },
  FAIL: {
    label: t("verdictStatusBadge.mustFix"),
    icon: XCircle,
    classes: "bg-red-50 text-red-800 border-red-200",
  },
  WARN: {
    label: t("verdictStatusBadge.worthALook"),
    icon: AlertTriangle,
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  NOT_APPLICABLE: {
    label: t("verdictStatusBadge.doesNotApplyHere"),
    icon: MinusCircle,
    classes: "bg-gray-50 text-gray-600 border-gray-200",
  },
  UNVERIFIABLE: {
    label: t("verdictStatusBadge.weCouldNotCheckThis"),
    icon: HelpCircle,
    classes: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  NEEDS_CONFIRMATION: {
    label: t("verdictStatusBadge.pleaseConfirm"),
    icon: CircleHelp,
    classes: "bg-orange-50 text-orange-800 border-orange-200",
  },
  NEEDS_REVIEW: {
    label: t("verdictStatusBadge.unusualWorthChecking"),
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
  const config = known || { label: t("verdictStatusBadge.unrecognized", { status: status || "—" }), ...UNKNOWN_STATUS_CONFIG };
  const Icon = config.icon;

  return (
    <span
      title={known ? undefined : t("verdictStatusBadge.thisStatusIsNotHandled")}
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${config.classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" /> {config.label}
    </span>
  );
}
