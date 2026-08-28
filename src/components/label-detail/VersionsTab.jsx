import { useState, useEffect, useCallback } from "react";
import { History, GitCompareArrows, RotateCcw, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { getLabelVersions, getVersionsDiff, postRestore } from "../../services/apiGeneratedLabels";
import Button from "../../ui/Button";
import DiffView from "./DiffView";

const CHANGE_SOURCE_LABEL = {
  ai_generation: "AI generation",
  ai_chat_edit: "AI chat edit",
  manual_edit: "Manual edit",
  restore: "Restored",
};

// §13: append-only, forward-only. Restoring version K creates a NEW version N+1
// with K's content — it never deletes or rewinds history. Every action in this
// tab says so explicitly so nobody thinks a restore discards later work.
export default function VersionsTab({ labelId, currentVersion, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState([]); // up to 2 version numbers, for diff
  const [diff, setDiff] = useState(null);
  const [isDiffing, setIsDiffing] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await getLabelVersions(labelId);
      setVersions([...rows].sort((a, b) => b.versionNumber - a.versionNumber));
    } catch (err) {
      toast.error(err.message || "Failed to load version history");
    } finally {
      setIsLoading(false);
    }
  }, [labelId]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (versionNumber) => {
    setDiff(null);
    setSelected((prev) => {
      if (prev.includes(versionNumber)) return prev.filter((v) => v !== versionNumber);
      if (prev.length >= 2) return [prev[1], versionNumber];
      return [...prev, versionNumber];
    });
  };

  const runDiff = async () => {
    if (selected.length !== 2) return;
    const [a, b] = [...selected].sort((x, y) => x - y);
    try {
      setIsDiffing(true);
      const d = await getVersionsDiff(labelId, a, b);
      setDiff({ a, b, entries: d });
    } catch (err) {
      toast.error(err.message || "Failed to diff versions");
    } finally {
      setIsDiffing(false);
    }
  };

  const doRestore = async (versionNumber) => {
    try {
      setRestoringVersion(versionNumber);
      const result = await postRestore(labelId, versionNumber);
      toast.success(
        `Created version ${result.version.versionNumber} with the content of version ${versionNumber}. Nothing was deleted — this is a new version, not a rollback.`
      );
      setConfirmRestore(null);
      await load();
      onRestored?.(result);
    } catch (err) {
      toast.error(err.message || "Failed to restore version");
    } finally {
      setRestoringVersion(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <History className="w-4 h-4" /> Select two versions to compare, or restore an older one forward.
        </p>
        <Button variant="secondary" onClick={runDiff} disabled={selected.length !== 2} isLoading={isDiffing}>
          <GitCompareArrows className="w-4 h-4" /> Compare selected
        </Button>
      </div>

      <div className="space-y-3">
        {versions.map((v) => {
          const isCurrent = v.versionNumber === currentVersion;
          return (
            <div key={v.versionNumber} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4">
              <input
                type="checkbox"
                checked={selected.includes(v.versionNumber)}
                onChange={() => toggleSelect(v.versionNumber)}
                className="mt-1.5 w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">v{v.versionNumber}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
                    {CHANGE_SOURCE_LABEL[v.changeSource] || v.changeSource}
                  </span>
                  {v.restoredFrom != null && (
                    <span className="text-[10px] text-gray-500">(content copied forward from v{v.restoredFrom})</span>
                  )}
                  {v.overrideAcknowledged && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Applied over a rule conflict
                    </span>
                  )}
                </div>
                {v.changeSummary && <p className="text-sm text-gray-700 mt-1">{v.changeSummary}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(v.createdAt).toLocaleString()}</p>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => setConfirmRestore(v.versionNumber)}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 flex-shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore forward
                </button>
              )}
            </div>
          );
        })}
      </div>

      {diff && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <h4 className="font-bold text-gray-900 mb-3">Differences: v{diff.a} → v{diff.b}</h4>
          <DiffView diff={diff.entries} />
        </div>
      )}

      {confirmRestore != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-blue-600" /> Restore version {confirmRestore}?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a <strong>new version (v{currentVersion + 1})</strong> containing the content of
              version {confirmRestore}. Version history is append-only — nothing between now and version{" "}
              {confirmRestore} is deleted or lost, it just won't be the current content anymore. Validation will
              re-run automatically, since rules may have changed since version {confirmRestore}.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmRestore(null)} disabled={restoringVersion != null}>
                Cancel
              </Button>
              <Button onClick={() => doRestore(confirmRestore)} isLoading={restoringVersion === confirmRestore}>
                Restore forward
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
