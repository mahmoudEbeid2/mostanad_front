// "Certificates to make" on the review page (mockup D2): a chip per usable type with what it
// would make for this invoice, on or off. Once certificates exist the choice is only shown.
const STR = {
  title: "Certificates to make",
  certificates: (n) => `${n} certificate${n === 1 ? "" : "s"}`,
  forInvoice: (n) => `${n} for the invoice`,
  allTypes: "All types",
  hint: "Chosen at upload · change it any time before Generate",
  lastOne: "Pick at least one certificate",
  locked: (codes) => (codes ? codes.join(" + ") : "All types"),
};

const countText = (t) => (t.scopes.length === 1 && t.scopes[0] === "per_invoice" ? STR.forInvoice(t.count) : STR.certificates(t.count));

/** planTypes: plan.types. onChange(ids | null); disabled while it saves or for a person who can't edit. */
export default function CertificateTypeChips({ planTypes, disabled, onChange, raised = false }) {
  if (!planTypes?.length) return null;
  const on = planTypes.filter((t) => t.selected);
  const toggle = (t) => onChange(planTypes.filter((x) => (x.certificateTypeId === t.certificateTypeId ? !x.selected : x.selected)).map((x) => x.certificateTypeId));
  return (
    <section aria-labelledby="types-bar" className={`bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-2.5 ${raised ? "relative z-50" : ""}`} data-testid="type-chips">
      <h2 id="types-bar" className="text-sm font-semibold text-gray-900 mr-1.5">
        {STR.title}
      </h2>
      {planTypes.map((t) => {
        const last = t.selected && on.length === 1;
        return (
          <button
            key={t.certificateTypeId}
            type="button"
            role="checkbox"
            aria-checked={t.selected}
            disabled={disabled || last}
            title={last ? STR.lastOne : t.typeName || undefined}
            onClick={() => toggle(t)}
            data-testid="type-chip"
            data-code={t.typeCode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold disabled:cursor-not-allowed ${t.selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            {t.selected ? "✓" : "+"} {t.typeCode} <span className="font-normal opacity-80">· {countText(t)}</span>
          </button>
        );
      })}
      <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-sm font-semibold text-blue-600 hover:underline ml-1 disabled:opacity-50 disabled:no-underline" data-testid="all-types">
        {STR.allTypes}
      </button>
      <span className="text-xs text-gray-500 ml-auto">{STR.hint}</span>
    </section>
  );
}

/** After generation: the choice, read-only. codes: the chosen types' codes, null = all types. */
export function CertificateTypesLocked({ codes }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-2.5 text-sm" data-testid="type-chips-locked">
      <h2 className="font-semibold text-gray-900 mr-1.5">{STR.title}</h2>
      <span className="text-gray-700">{STR.locked(codes)}</span>
    </section>
  );
}
