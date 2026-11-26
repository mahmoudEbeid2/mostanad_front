// Where a certificate value came from (28 Nov, "read every file + infer"):
//   a file  → "من: ADDVET COC ص10" — click opens the file at that page; the printed words on hover
//   an estimate → «مستنتج» — its reasoning and basis on hover; never blocks, accepted with «اعتمد كل المستنتج»
// An estimate is never shown as coming from a document.
import { openEvidence } from "../../services/apiWorkflow";
import { tr } from "../../i18n/lang";

const shortName = (s) => String(s || "").replace(/\.(pdf|png|jpe?g|ai|xlsx|csv)$/i, "").slice(0, 40);

export default function ValueOriginChip({ provenance, flags = [] }) {
  const p = provenance || {};
  // Phase 3: an expiry computed from a real production date + the product's validity — its formula is the evidence
  if (p.kind === "computed") {
    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800" title={p.formula || undefined} data-chip="computed">
        {tr("محسوب", "Computed")}
      </span>
    );
  }
  // PART 3: filled by the AI in experiment mode — test data, never a real value
  if (p.experiment) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800" title="وضع التجربة: بيانات تجريبية من الذكاء الاصطناعي" data-chip="experiment">
        {tr("مستنتج (تجربة)", "Estimated (experiment)")}
      </span>
    );
  }
  if (flags.includes("estimated") || (p.estimated && !p.confirmedAt)) {
    const why = [p.reasoning, p.basis ? `${tr("الأساس", "Basis")}: ${p.basis}` : null].filter(Boolean).join("\n");
    return (
      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700" title={why || undefined} data-chip="estimated">
        {tr("مستنتج", "Estimated")}
      </span>
    );
  }
  if (p.estimated && p.confirmedAt) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600" title={p.basis || undefined} data-chip="estimate-accepted">
        {tr("مستنتج — اتعمد", "Estimate — accepted")}
      </span>
    );
  }
  if (p.source === "harvest" && p.file) {
    const label = `${tr("من", "From")}: ${shortName(p.file)}${p.page ? ` ${tr("ص", "p.")}${p.page}` : ""}`;
    const link = p.fileId ? `/api/v1/evidence-files/${p.fileId}${p.page ? `#page=${p.page}` : ""}` : null;
    return link ? (
      <button type="button" onClick={() => openEvidence(link).catch(() => {})} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:underline" title={p.quote ? `“${p.quote}”` : undefined} data-chip="source">
        {label}
      </button>
    ) : (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800" title={p.quote ? `“${p.quote}”` : undefined} data-chip="source">
        {label}
      </span>
    );
  }
  return null;
}
