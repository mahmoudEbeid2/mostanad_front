import { AlertTriangle, Check, Circle, Minus, X } from "lucide-react";
import Spinner from "../../ui/Spinner";

// "Prepare certificates" (backend item 5): the job's named stages — matching →
// product data → batch results → supplier COAs — with live progress, then only
// what still needs the person: values to confirm (Confirm all in the data check
// below) and lab results still missing (the results grid).
const STR = {
  title: "Prepare certificates",
  running: "Preparing…",
  failed: "Preparing stopped:",
  status: { done: "done", skipped: "nothing to do", failed: "failed", running: "running", pending: "waiting" },
  toConfirm: (p) => `${p.toConfirm.length} value${p.toConfirm.length === 1 ? "" : "s"} to confirm${p.estimated ? ` (${p.estimated} estimated)` : ""} — use “Confirm all” in the data check below.`,
  labResults: (n) => `${n} lab result${n === 1 ? "" : "s"} still missing — fill ${n === 1 ? "it" : "them"} in the results grid below (or upload the supplier COA).`,
  other: (n) => `${n} other required value${n === 1 ? "" : "s"} missing — see the data check below.`,
  unmatched: (n) => `${n} line${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} a product.`,
  ready: "Nothing required is missing — you can generate.",
  cost: (c) => `AI for this invoice so far: ${c.attempts} call${c.attempts === 1 ? "" : "s"} · $${Number(c.costUsd || 0).toFixed(4)}`,
  close: "Close",
};

const ICON = {
  done: <Check className="w-4 h-4 text-emerald-600" />,
  skipped: <Minus className="w-4 h-4 text-gray-400" />,
  failed: <X className="w-4 h-4 text-red-600" />,
  running: <Spinner size="sm" />,
  pending: <Circle className="w-3.5 h-3.5 text-gray-300" />,
};

/** props: stages [{ key, label }], task (useTaskProgress state), onClose */
export default function PreparePanel({ stages, task, onClose }) {
  const result = task.status === "completed" ? task.result : null;
  const live = task.stages || stages;
  const statusOf = (s, i) => {
    const done = result?.stages?.find((x) => x.key === s.key);
    if (done) return done.status;
    const fromSocket = live.find((x) => x.key === s.key)?.status;
    if (fromSocket && fromSocket !== "pending") return fromSocket;
    const current = stages.findIndex((x) => x.key === task.stage);
    return current === i ? "running" : current > i ? "done" : "pending";
  };
  const p = result?.prepared;
  return (
    <section className="bg-white border border-violet-200 rounded-xl p-5 space-y-3" data-testid="prepare-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{STR.title}</h2>
        {!task.done && (
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <Spinner size="sm" /> {task.message || STR.running} {task.progress ? `· ${task.progress}%` : ""}
          </span>
        )}
        {task.done && (
          <button type="button" onClick={onClose} className="text-xs text-blue-600 hover:underline">
            {STR.close}
          </button>
        )}
      </div>
      <ol className="space-y-1.5">
        {stages.map((s, i) => {
          const st = task.status === "failed" && !result ? "failed" : statusOf(s, i);
          const r = result?.stages?.find((x) => x.key === s.key);
          return (
            <li key={s.key} className="flex items-start gap-2 text-sm" data-stage={s.key} data-status={st}>
              <span className="mt-0.5 w-4 flex justify-center">{ICON[st] || ICON.pending}</span>
              <span className="text-gray-800">
                {s.label} <span className="text-xs text-gray-500">· {STR.status[st] || st}</span>
                {r?.detail && <span className="block text-xs text-gray-600">{r.detail}</span>}
                {r?.error && <span className="block text-xs text-red-700">{r.error}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {task.status === "failed" && (
        <p className="text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {STR.failed} {task.error}
        </p>
      )}
      {p && (
        <div className={`rounded-lg px-3 py-2 text-sm space-y-1 ${p.canGenerate ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="prepare-summary">
          {p.canGenerate ? <p className="font-semibold">{STR.ready}</p> : null}
          {p.toConfirm.length > 0 && <p>{STR.toConfirm(p)}</p>}
          {p.missingLabResults > 0 && <p>{STR.labResults(p.missingLabResults)}</p>}
          {p.missingOther > 0 && <p>{STR.other(p.missingOther)}</p>}
          {p.unmatchedLines > 0 && <p>{STR.unmatched(p.unmatchedLines)}</p>}
        </div>
      )}
      {result?.cost && <p className="text-xs text-gray-500">{STR.cost(result.cost)}</p>}
    </section>
  );
}
