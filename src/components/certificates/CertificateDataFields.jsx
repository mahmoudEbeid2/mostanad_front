import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import Spinner from "../../ui/Spinner";
import { getProductData, saveProductData } from "../../services/apiCertificateAi";

// Structured product data entry (backend plan.md §9, A4): fixed inputs for
// exactly the values the company's active certificate templates read from a
// product — a pH spec, the constituents as a list of name + amount — instead
// of free JSON. Saving writes only these; every other key is kept.
const STR = {
  title: "Certificate data",
  hint: "The values your active certificate templates print for this product.",
  none: "No active certificate template reads product data yet.",
  missing: (n) => `${n} value${n === 1 ? "" : "s"} missing`,
  complete: "Complete",
  usedBy: (t) => `Used by ${t.join(", ")}`,
  addRow: "Add row",
  expected: (v) => `Templates expect: ${v.join(", ")}`,
  save: "Save certificate data",
  saved: "Certificate data saved",
};

export default function CertificateDataFields({ scope, productId, onSaved }) {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [lists, setLists] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    getProductData(scope, productId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setValues(d.values);
        setLists(d.lists);
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [scope, productId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data)
    return (
      <div className="py-4 flex justify-center">
        <Spinner size="sm" />
      </div>
    );
  const def = data.definition;
  if (!def.fields.length && !def.lists.length) return <p className="text-sm text-gray-500">{STR.none}</p>;

  const save = async () => {
    setBusy(true);
    try {
      const d = await saveProductData(scope, productId, { values, lists });
      setData(d);
      setValues(d.values);
      setLists(d.lists);
      toast.success(STR.saved);
      onSaved?.(d);
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };
  const setRow = (path, i, key, v) => setLists((l) => ({ ...l, [path]: l[path].map((r, j) => (j === i ? { ...r, [key]: v } : r)) }));

  return (
    <div className="space-y-4" data-testid="certificate-data">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">{STR.title}</h3>
          <p className="text-xs text-gray-500">{STR.hint}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${data.missing.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`} title={data.missing.join("\n")}>
          {data.missing.length ? STR.missing(data.missing.length) : STR.complete}
        </span>
      </div>
      {def.fields.map((f) => (
        <label key={f.path} className="block text-sm">
          <span className="font-medium text-gray-700">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </span>
          <input
            value={values[f.path] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.path]: e.target.value }))}
            className={`mt-1 w-full px-3 py-2 border rounded-lg ${f.required && !(values[f.path] ?? "").trim() ? "border-amber-300 bg-amber-50/40" : "border-gray-300"}`}
          />
          <span className="text-[11px] text-gray-400">{STR.usedBy(f.templates)}</span>
        </label>
      ))}
      {def.lists.map((l) => (
        <div key={l.path} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{l.label}</span>
            <button type="button" onClick={() => setLists((x) => ({ ...x, [l.path]: [...(x[l.path] || []), Object.fromEntries(l.children.map((c) => [c, ""]))] }))} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
              <Plus className="w-3.5 h-3.5" /> {STR.addRow}
            </button>
          </div>
          {l.expected.length > 0 && <p className="text-[11px] text-gray-500">{STR.expected(l.expected)}</p>}
          {(lists[l.path] || []).map((row, i) => (
            <div key={i} className="flex gap-2">
              {l.children.map((c) => (
                <input key={c} value={row[c] ?? ""} placeholder={c} aria-label={`${l.label} ${i + 1} · ${c}`} onChange={(e) => setRow(l.path, i, c, e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
              ))}
              <button type="button" aria-label="Remove row" onClick={() => setLists((x) => ({ ...x, [l.path]: x[l.path].filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <span className="text-[11px] text-gray-400">{STR.usedBy(l.templates)}</span>
        </div>
      ))}
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm font-semibold hover:bg-teal-700 disabled:opacity-60">
        {busy ? "…" : STR.save}
      </button>
    </div>
  );
}
