import { Link } from "react-router-dom";

// "What Generate will produce" (plan §13.5; mockup B3): one row per template
// version, then every line/type that no active template covers, with a link
// to create the missing template.
const STR = {
  title: "Plan preview",
  perProduct: (n) => `${n} certificate${n === 1 ? "" : "s"} · one per product`,
  perInvoice: (n, lines) => `${n} certificate${n === 1 ? "" : "s"} · whole invoice (${lines} line${lines === 1 ? "" : "s"})`,
  nothing: "No active template applies to any line yet.",
  gap: (g, country) => (
    <>
      Line {g.lineNo}
      {g.name ? ` (${g.name})` : ""} has no {g.typeCode} template
      {g.brandName || country ? (
        <>
          {" "}
          for <b>{[g.brandName, country].filter(Boolean).join(" · ")}</b>
        </>
      ) : null}
    </>
  ),
  unassigned: (u) => `Line ${u.lineNo}${u.name ? ` (${u.name})` : ""} gets no certificate at all.`,
  create: "Create template",
};

export default function PlanPreview({ plan }) {
  if (!plan) return null;
  return (
    <div className="space-y-2" data-testid="plan-preview">
      <h3 className="font-semibold text-gray-900">{STR.title}</h3>
      {plan.summary.length === 0 && <p className="text-sm text-gray-500">{STR.nothing}</p>}
      {plan.summary.map((s) => (
        <div key={s.templateVersionId} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">{s.typeCode}</span>
          <span className="text-gray-900">{s.scope === "per_invoice" ? STR.perInvoice(s.count, s.lines) : STR.perProduct(s.count)}</span>
          <span className="ml-auto text-gray-500 text-xs">
            {s.templateName}
            {s.versionNumber ? ` v${s.versionNumber}` : ""}
          </span>
        </div>
      ))}
      {plan.gaps.map((g) => (
        <div key={`${g.invoiceItemId}:${g.certificateTypeId}:${g.scope}`} className="flex items-center gap-3 rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <span>{STR.gap(g, g.country)}</span>
          <Link to={`/certificates/templates/new?certificateTypeId=${g.certificateTypeId}`} className="ml-auto font-semibold text-red-700 hover:underline whitespace-nowrap">
            {STR.create}
          </Link>
        </div>
      ))}
      {plan.unassigned.map((u) => (
        <p key={u.invoiceItemId} className="text-sm text-red-700">
          {STR.unassigned(u)}
        </p>
      ))}
    </div>
  );
}
