import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "../../ui/Button";

// One block of a newer catalogue version against the existing product it matches
// (backend plan.md §15.4, A6.5): old → new per field, conflicts (a person's or a
// pre-catalogue value) never ticked by default. Apply = the ticked fields only.
const STR = {
  against: (p, by) => `Updates existing product “${p.name}”${p.productCode ? ` (${p.productCode})` : ""} — matched by ${by}`,
  unchanged: "No changes — applying links the product to this edition.",
  conflict: "Conflict",
  old: "Now",
  next: "Catalogue",
  apply: (n) => (n ? `Apply ${n} field${n > 1 ? "s" : ""}` : "Link without changes"),
  declined: (fs) => `Declined earlier, not proposed again: ${fs.join(", ")}`,
  ambiguous: "Several products match this block — pick the one it describes:",
  taken: "The matching product is already linked to another block of this edition.",
  pick: "Choose a product",
  applyTo: "Apply to this product",
  estimated: "Estimated",
};

const showValue = (field, v) => {
  if (v === null || v === undefined) return "—";
  if (field === "activeIngredients" && Array.isArray(v)) return v.map((i) => `${i.name}  ${i.amountRaw ?? i.concentration ?? "—"}`).join("\n");
  if (field === "specifications") return Object.entries(v?.values || {}).map(([k, x]) => `${k}: ${x}`).join("\n");
  if (Array.isArray(v)) return v.join("\n");
  return String(v);
};

export default function DiffPanel({ item, canManage, busy, onApply }) {
  const [ticked, setTicked] = useState(() => new Set());
  const [productId, setProductId] = useState("");
  useEffect(() => {
    setTicked(new Set((item?.changes || []).filter((c) => !c.conflict).map((c) => c.field)));
    setProductId("");
  }, [item]);
  if (!item) return null;

  if (item.kind === "ambiguous") {
    const m = item.match || {};
    return (
      <div className="border border-orange-200 bg-orange-50/60 rounded-lg p-3 space-y-2 text-sm">
        {m.takenByBlockId ? (
          <p className="text-orange-900">{STR.taken}</p>
        ) : (
          <>
            <p className="text-orange-900">{STR.ambiguous}</p>
            <select className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!canManage}>
              <option value="">{STR.pick}</option>
              {(m.candidates || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.productCode ? ` (${c.productCode})` : ""}
                </option>
              ))}
            </select>
            {canManage && (
              <Button variant="secondary" disabled={!productId || busy} onClick={() => onApply({ productId })}>
                {STR.applyTo}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  const changes = item.changes || [];
  const toggle = (f) =>
    setTicked((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2">
      <p className="text-xs text-blue-900">{STR.against(item.product, item.matchedBy)}</p>
      {!changes.length && <p className="text-sm text-gray-700">{STR.unchanged}</p>}
      {changes.map((c) => (
        <label key={c.field} className={`block rounded-md border p-2 bg-white ${c.conflict ? "border-orange-300" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            {canManage && <input type="checkbox" checked={ticked.has(c.field)} onChange={() => toggle(c.field)} />}
            <span className="text-xs font-semibold text-gray-700">{c.field}</span>
            {c.conflict && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                <AlertTriangle className="w-3 h-3" /> {STR.conflict}
              </span>
            )}
            {c.estimated && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">{STR.estimated}</span>}
            <span className="text-[11px] text-gray-500 ml-auto">{c.reason}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
            <div>
              <p className="text-gray-500">{STR.old}</p>
              <pre className="whitespace-pre-wrap font-sans text-gray-800 line-through decoration-gray-400">{showValue(c.field, c.old)}</pre>
            </div>
            <div>
              <p className="text-gray-500">
                {STR.next}
                {c.page ? ` · p.${c.page}` : ""}
              </p>
              <pre className="whitespace-pre-wrap font-sans text-gray-900" title={c.quote ? `“${c.quote}”` : undefined}>
                {showValue(c.field, c.new)}
              </pre>
            </div>
          </div>
        </label>
      ))}
      {item.declined?.length > 0 && <p className="text-[11px] text-gray-500">{STR.declined(item.declined)}</p>}
      {canManage && (
        <Button disabled={busy} onClick={() => onApply({ fields: [...ticked] })}>
          {STR.apply(ticked.size)}
        </Button>
      )}
    </div>
  );
}
