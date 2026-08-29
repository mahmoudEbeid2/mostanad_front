import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, FileSearch, ShieldCheck, Image as ImageIcon, Check, Pencil, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { getLabelExtraction, postConfirmField } from "../../services/apiGeneratedLabels";
import Button from "../../ui/Button";

// The backend's extractionMeta entries never carry the field's actual value —
// only confidence/snippet/bbox/ambiguous (§14.5.3 metadata about the extraction,
// not the extracted content itself). The real current value always lives in
// labelData, so confirmation must read from there.
function isEmptyValue(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

function formatValue(v) {
  if (isEmptyValue(v)) return "(empty)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function ExtractionTab({ labelId, labelData, currentVersion, onFieldConfirmed }) {
  const [extraction, setExtraction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPath, setEditingPath] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const loadExtraction = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getLabelExtraction(labelId);
      setExtraction(data);
    } catch (err) {
      toast.error(err.message || "Failed to load extraction verification data");
    } finally {
      setIsLoading(false);
    }
  }, [labelId]);

  useEffect(() => {
    loadExtraction();
  }, [loadExtraction]);

  const handleConfirm = async (path, customValue) => {
    const val = customValue !== undefined ? customValue : labelData?.[path];
    if (isEmptyValue(val)) {
      toast.error("There is no value to confirm for this field.");
      return;
    }

    try {
      setIsConfirming(true);
      const result = await postConfirmField(labelId, {
        path,
        value: val,
        expectedVersion: currentVersion,
      });

      toast.success(`Confirmed ${path} as human-verified. Version bumped to v${result.version}.`);
      setEditingPath(null);
      await loadExtraction();
      onFieldConfirmed?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to confirm field");
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meta = extraction?.extractionMeta || {};
  const entries = Object.entries(meta);

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
        <FileSearch className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="font-bold text-gray-700">No Image/PDF Extraction Metadata</p>
        <p className="text-xs text-gray-400 mt-1">
          This label was created purely via direct AI generation or reference synthesis, rather than scanned document OCR extraction.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between flex-wrap gap-4 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-600" /> §14.5 Verification & OCR Ground Truth
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Review extraction confidence scores and visual snippets from the source document. Confirming a field
            records your verification as ground truth — it does not rewrite the original extraction confidence score,
            which is kept for measuring extraction accuracy.
          </p>
        </div>
        {extraction?.sourceFileRef && (
          <span className="text-xs font-mono text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
            Source: {extraction.sourceFileRef}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {entries.map(([path, data]) => {
          const confidence = data.confidence != null ? Math.round(data.confidence * 100) : null;
          const isLow = confidence != null && confidence < 80;
          const isConfirmed = Boolean(data.confirmedByUser);
          const isEditingThis = editingPath === path;
          const fieldValue = labelData?.[path];
          const canConfirm = !isEmptyValue(fieldValue);

          return (
            <div
              key={path}
              className={`bg-white rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isConfirmed
                  ? "border-green-200 bg-green-50/20"
                  : isLow
                  ? "border-amber-300 bg-amber-50/30"
                  : "border-gray-200"
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{path}</span>
                  {confidence != null && (
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isConfirmed
                          ? "bg-green-100 text-green-800 border-green-200"
                          : isLow
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {confidence}% Confidence
                    </span>
                  )}
                  {isConfirmed && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Human Confirmed
                    </span>
                  )}
                  {data.ambiguous && (
                    <span className="text-[10px] font-bold uppercase text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                      Ambiguous
                    </span>
                  )}
                </div>

                {/* Display Value or Edit input */}
                {isEditingThis ? (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="text-xs rounded-lg border border-blue-400 p-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button
                      onClick={() => handleConfirm(path, editValue)}
                      isLoading={isConfirming}
                      disabled={isEmptyValue(editValue)}
                      className="text-xs px-3 py-1.5"
                    >
                      Save & Confirm
                    </Button>
                    <button
                      onClick={() => setEditingPath(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 font-medium">
                    {formatValue(fieldValue)}
                  </p>
                )}

                {/* Snippet / OCR source reference */}
                {data.snippet && (
                  <div className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono">
                    <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                    <span>OCR Snippet: &ldquo;{data.snippet}&rdquo;</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!isConfirmed && !isEditingThis && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingPath(path);
                      setEditValue(isEmptyValue(fieldValue) ? "" : formatValue(fieldValue));
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Correct
                  </button>
                  <Button
                    onClick={() => handleConfirm(path, fieldValue)}
                    isLoading={isConfirming}
                    disabled={!canConfirm}
                    title={canConfirm ? undefined : "No value in the current label to confirm — use Correct to enter one."}
                    className="text-xs px-3 py-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Confirm Field
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
