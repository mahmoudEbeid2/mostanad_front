import { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getSourceDiff, updateFromSource } from "../../services/apiProducts";

// "Update from source": the copy and its original side by side, field by field.
// Only the fields the person ticks take the original's value — never automatic.

const fieldLabel = (f) => f.replace(/Id$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const show = (v) => {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return <span className="text-gray-400">—</span>;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? [x.name, x.concentration].filter(Boolean).join(" ") : x)).join(", ");
  if (typeof v === "object") return v.values ? Object.entries(v.values).map(([k, x]) => `${k}: ${x}`).join(" · ") : JSON.stringify(v);
  return String(v);
};

export default function SourceDiffModal({ productId, onClose, onDone }) {
  const [diff, setDiff] = useState(null);
  const [ticked, setTicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSame, setShowSame] = useState(false);

  useEffect(() => {
    getSourceDiff(productId).then(setDiff).catch((e) => setError(e.message));
  }, [productId]);

  const rows = diff ? diff.fields.filter((f) => showSame || !f.same) : [];
  const toggle = (field) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(field)) n.delete(field);
      else n.add(field);
      return n;
    });
  const apply = async () => {
    setBusy(true);
    try {
      const out = await updateFromSource(productId, [...ticked]);
      toast.success(`${out.updated.length} field${out.updated.length === 1 ? "" : "s"} updated from the original`);
      onDone?.(out);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Update from source">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-teal-600" />
            Update from the original
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {!diff && !error && <Spinner />}
          {diff && (
            <>
              <p className="text-sm text-gray-600">
                <b>{diff.copy.name}</b> was copied from <b>{diff.source.name}</b>
                {diff.source.brand?.name ? ` · ${diff.source.brand.name}` : ""}. {diff.changed ? `${diff.changed} field${diff.changed === 1 ? " differs" : "s differ"} now.` : "Every field is the same as the original."} Tick the fields that should take the original's value.
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={showSame} onChange={(e) => setShowSame(e.target.checked)} />
                Show the fields that are the same too
              </label>
              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm" data-testid="source-diff">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 w-10" />
                        <th className="px-3 py-2 text-left font-semibold">Field</th>
                        <th className="px-3 py-2 text-left font-semibold">Original ({diff.source.name})</th>
                        <th className="px-3 py-2 text-left font-semibold">This copy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((f) => (
                        <tr key={f.field} className={f.same ? "text-gray-400" : ""}>
                          <td className="px-3 py-2 align-top">
                            <input type="checkbox" disabled={f.same} checked={ticked.has(f.field)} onChange={() => toggle(f.field)} aria-label={`Take the original's ${fieldLabel(f.field)}`} />
                          </td>
                          <td className="px-3 py-2 align-top font-medium">{fieldLabel(f.field)}</td>
                          <td className="px-3 py-2 align-top">{show(f.source)}</td>
                          <td className="px-3 py-2 align-top">{show(f.copy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-500">The registration number is never taken from the original.</p>
            </>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button onClick={apply} disabled={!ticked.size} isLoading={busy} data-testid="apply-from-source">
            Update {ticked.size || ""} field{ticked.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
