import { useState } from "react";
import { X, AlertTriangle, ShieldAlert, CheckCircle2, FileText, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { patchLabel } from "../../services/apiGeneratedLabels";
import Button from "../../ui/Button";

export default function EditFieldModal({
  isOpen,
  field,
  currentValue,
  labelId,
  expectedVersion,
  onClose,
  onSuccess,
}) {
  if (!isOpen || !field) return null;

  // Initialize draft based on field type
  const [draft, setDraft] = useState(() => {
    if (field.type === "localized") {
      return {
        en: currentValue?.translations?.en || "",
        ar: currentValue?.translations?.ar || "",
      };
    }
    if (field.type === "boolean") {
      return currentValue === true;
    }
    if (field.type === "targetSpecies") {
      return (currentValue?.list || []).join(", ");
    }
    if (typeof currentValue === "object" && currentValue !== null) {
      return JSON.stringify(currentValue, null, 2);
    }
    return currentValue ?? "";
  });

  const [rationale, setRationale] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conflict, setConflict] = useState(null);

  const buildValue = () => {
    if (field.type === "localized") {
      return {
        translations: {
          en: draft.en.trim(),
          ar: draft.ar.trim(),
        },
      };
    }
    if (field.type === "boolean") {
      return Boolean(draft);
    }
    if (field.type === "targetSpecies") {
      return {
        list: draft.split(",").map((s) => s.trim()).filter(Boolean),
        source: currentValue?.source || "manual_edit",
      };
    }
    if (typeof draft === "string" && (draft.startsWith("{") || draft.startsWith("["))) {
      try {
        return JSON.parse(draft);
      } catch {
        return draft;
      }
    }
    return draft;
  };

  const handleSave = async (override = false) => {
    try {
      setIsLoading(true);
      setConflict(null);
      const value = buildValue();
      const payload = {
        changes: [{ path: field.path, op: "replace", value }],
        rationale: rationale.trim() || undefined,
        expectedVersion,
        overrideAcknowledged: override ? true : undefined,
      };

      const result = await patchLabel(labelId, payload);
      toast.success(`Updated ${field.label}. Version is now v${result.resultVersion}.`);
      onSuccess(result);
      onClose();
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 409 && errData?.data?.status === "conflict") {
        setConflict(errData.data);
      } else if (err.response?.status === 409) {
        toast.error(errData?.message || "Version conflict: another user updated this label. Please reload.");
      } else {
        toast.error(errData?.message || err.message || "Failed to update field");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Edit {field.label}</h3>
            <p className="text-xs text-gray-500 font-mono">Path: {field.path} · Expected Version: v{expectedVersion}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {field.type === "localized" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">English (LTR)</label>
                <textarea
                  value={draft.en}
                  onChange={(e) => setDraft({ ...draft, en: e.target.value })}
                  rows={3}
                  className="w-full text-sm rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="English text..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Arabic (RTL)</label>
                <textarea
                  value={draft.ar}
                  onChange={(e) => setDraft({ ...draft, ar: e.target.value })}
                  rows={3}
                  dir="rtl"
                  className="w-full text-sm rounded-xl border border-gray-300 p-3 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="النص بالعربية..."
                />
              </div>
            </div>
          ) : field.type === "boolean" ? (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bool-field"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="bool-field" className="text-sm font-semibold text-gray-800">
                {field.label} is enabled / true
              </label>
            </div>
          ) : field.type === "targetSpecies" ? (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Species (comma-separated)</label>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full text-sm rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="cattle, sheep, goats"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Value</label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full text-sm rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Rationale (Optional Audit Note)</label>
            <input
              type="text"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Corrected typo in active ingredient translation per registration dossier"
              className="w-full text-xs rounded-xl border border-gray-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {conflict && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Regulatory Conflict: This edit violates a compliance rule</span>
              </div>

              {conflict.wouldViolate?.length > 0 && (
                <div className="space-y-2">
                  {conflict.wouldViolate.map((violation, idx) => (
                    <div key={`${violation.ruleKey || idx}-${violation.path || idx}`} className="bg-white/80 rounded-lg p-3 border border-rose-200 space-y-1">
                      <p className="font-semibold text-gray-900">
                        Rule {violation.ruleKey || "(unknown)"}{violation.path ? ` — ${violation.path}` : ""}
                      </p>
                      {violation.message && (
                        <p className="text-gray-800">{violation.message}</p>
                      )}
                      {violation.citation && (
                        <div className="flex items-start gap-1.5 text-gray-700 italic">
                          <FileText className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>&ldquo;{violation.citation}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-gray-700">
                The edit was <strong>not applied</strong> to protect compliance integrity. You can adjust your input or force an explicit override with an audit trail.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConflict(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold"
                >
                  Adjust Value
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-bold"
                >
                  Force Override & Save
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          {!conflict && (
            <Button onClick={() => handleSave(false)} isLoading={isLoading}>
              Save Changes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
