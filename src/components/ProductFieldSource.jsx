// Where a product value came from (backend product.fieldProvenance, plan.md §15 / A6):
//   tier "I" + estimated → "Estimated" (not printed in the catalogue; a person must
//   confirm it before a certificate uses it), tier "C" → "Catalogue p.N" with the quote.
// Typed values ("manual") and fields without provenance show nothing.
export default function ProductFieldSource({ product, field }) {
  const p = product?.fieldProvenance?.[field];
  if (!p) return null;
  if (p.tier === "I" && p.estimated) {
    const confirmed = !!p.confirmedAt;
    return (
      <span
        title={`${confirmed ? "Estimated, confirmed by a person" : "Estimated — not printed in the catalogue; confirm it before certificates use it"}${p.basis ? `\nBasis: ${p.basis}` : ""}`}
        className={`ml-2 align-middle text-[10px] font-semibold normal-case tracking-normal px-1.5 py-0.5 rounded border ${confirmed ? "bg-gray-50 text-gray-600 border-gray-300" : "bg-amber-50 text-amber-800 border-amber-300"}`}
      >
        {confirmed ? "Estimated · confirmed" : "Estimated"}
      </span>
    );
  }
  if (p.tier === "C") {
    return (
      <span title={p.quote ? `“${p.quote}”` : undefined} className="ml-2 align-middle text-[10px] font-semibold normal-case tracking-normal px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
        Catalogue{p.page ? ` p.${p.page}` : ""}
      </span>
    );
  }
  return null;
}
