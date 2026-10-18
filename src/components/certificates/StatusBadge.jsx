// One badge for every Certificates V2 lifecycle (plan §4): template versions,
// invoices, batches and certificates.
const STYLES = {
  // template version
  uploaded: "bg-gray-100 text-gray-700",
  converting: "bg-blue-50 text-blue-700",
  draft: "bg-amber-50 text-amber-800",
  preparing: "bg-blue-50 text-blue-700",
  ready: "bg-emerald-50 text-emerald-700",
  active: "bg-emerald-600 text-white",
  superseded: "bg-gray-100 text-gray-500",
  failed: "bg-red-50 text-red-700",
  // invoice
  extracting: "bg-blue-50 text-blue-700",
  review: "bg-amber-50 text-amber-800",
  generating: "bg-blue-50 text-blue-700",
  generated: "bg-emerald-50 text-emerald-700",
  partially_failed: "bg-orange-50 text-orange-800",
  // batch
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  // certificate
  final: "bg-emerald-600 text-white",
  // task
  pending: "bg-gray-100 text-gray-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-gray-100 text-gray-500",
};

const LABELS = { partially_failed: "partially failed" };

export default function StatusBadge({ status, className = "" }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STYLES[status] || "bg-gray-100 text-gray-700"} ${className}`}>
      {LABELS[status] || status}
    </span>
  );
}
