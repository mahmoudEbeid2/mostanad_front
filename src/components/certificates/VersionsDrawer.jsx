import { X } from "lucide-react";

// Every version of a certificate (plan §11, §13.6): view any of them in the
// frame, restore one (forward-only — it becomes a new version).
const STR = {
  title: "Versions",
  current: "current",
  view: "View",
  viewing: "Viewing",
  restore: "Restore",
  confirmRestore: (n) => `Restore version ${n}? Its values become a new version; nothing is deleted.`,
  sources: { generation: "Generated", user_edit: "Edited", restore: "Restored", regenerate_field: "Reset from source", duplicate: "Duplicated" },
  issues: (n) => `${n} issue${n === 1 ? "" : "s"}`,
};

export default function VersionsDrawer({ versions, currentVersion, viewing, canRestore, onView, onRestore, onClose }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-gray-200 shadow-xl flex flex-col" data-testid="versions-drawer">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">
          {STR.title} ({versions.length})
        </h2>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>
      <ol className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {versions.map((v) => {
          const isCurrent = v.versionNumber === currentVersion;
          const isViewing = viewing === v.versionNumber || (viewing === null && isCurrent);
          return (
            <li key={v.versionNumber} className={`px-5 py-3 space-y-1 ${isViewing ? "bg-blue-50" : ""}`} data-version={v.versionNumber}>
              <div className="flex items-center gap-2 text-sm">
                <b>v{v.versionNumber}</b>
                <span className="text-gray-700">{STR.sources[v.changeSource] || v.changeSource}</span>
                {isCurrent && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-semibold">{STR.current}</span>}
                {v.flagCount > 0 && <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[11px] font-semibold">{STR.issues(v.flagCount)}</span>}
                <span className="ml-auto text-xs text-gray-400">{new Date(v.createdAt).toLocaleString()}</span>
              </div>
              {(v.changedBy || v.changeSummary) && (
                <p className="text-xs text-gray-600 break-words">
                  {v.changedBy && <span className="font-medium">{v.changedBy}</span>}
                  {v.changedBy && v.changeSummary ? " · " : ""}
                  {v.changeSummary}
                </p>
              )}
              <div className="flex gap-4 text-sm">
                {isViewing ? (
                  <span className="text-blue-700 font-medium">{STR.viewing}</span>
                ) : (
                  <button type="button" onClick={() => onView(isCurrent ? null : v.versionNumber)} className="text-blue-600 hover:underline">
                    {STR.view}
                  </button>
                )}
                {canRestore && !isCurrent && (
                  <button type="button" onClick={() => window.confirm(STR.confirmRestore(v.versionNumber)) && onRestore(v.versionNumber)} className="text-blue-600 hover:underline">
                    {STR.restore}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
