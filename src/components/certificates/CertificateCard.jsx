import { Link } from "react-router-dom";
import AuthImage from "./AuthImage";
import StatusBadge from "./StatusBadge";
import { getCertificateThumbnail } from "../../services/apiCertificatesV2";

// One generated certificate (plan §13.5; mockup B4): thumbnail, type, what it
// covers, status, blocking issues and the next action.
const STR = {
  whole: (n) => `Whole invoice · ${n} product${n === 1 ? "" : "s"}`,
  batch: (b) => `Batch ${b}`,
  issues: (n) => `${n} issue${n === 1 ? "" : "s"}`,
  rendering: "rendering…",
  open: "Open & finalize",
  fix: "Fix issues",
  view: "Open",
  wait: "Please wait",
};

export default function CertificateCard({ scope, cert }) {
  const pending = cert.status === "pending";
  const failed = cert.status === "failed";
  const title = cert.scope === "per_invoice" ? STR.whole(cert.lineNos.length) : cert.product?.name || "—";
  const subtitle = cert.scope === "per_invoice" ? [cert.template?.name, cert.template?.country].filter(Boolean).join(" — ") : cert.batchNo ? STR.batch(cert.batchNo) : "";
  const action = cert.status === "final" ? STR.view : cert.flagCount > 0 ? STR.fix : STR.open;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4" data-testid="certificate-card" data-status={cert.status}>
      <div className="w-24 h-32 shrink-0 rounded border border-gray-100 shadow-sm overflow-hidden bg-gray-50">
        {cert.hasThumbnail ? <AuthImage load={() => getCertificateThumbnail(scope, cert.id)} reloadKey={`${cert.id}:${cert.currentVersion}`} alt={title} className="w-full h-full" /> : <div className={`w-full h-full ${pending ? "animate-pulse bg-gray-100" : ""}`} />}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">{cert.certificateType?.code}</span>
        <h3 className="font-semibold text-gray-900 leading-tight truncate" title={title}>
          {title}
        </h3>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {pending ? <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold">{STR.rendering}</span> : <StatusBadge status={cert.status} />}
          {!failed && cert.flagCount > 0 && <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-xs font-semibold">{STR.issues(cert.flagCount)}</span>}
        </div>
        {failed ? (
          <p className="text-xs text-red-700 break-words line-clamp-3" title={cert.error}>
            {cert.error}
          </p>
        ) : pending ? (
          <p className="text-sm text-blue-600">{STR.wait}</p>
        ) : (
          <Link to={`/certificates/${cert.id}`} className="inline-block text-sm font-medium text-blue-600 hover:underline">
            {action}
          </Link>
        )}
      </div>
    </div>
  );
}
