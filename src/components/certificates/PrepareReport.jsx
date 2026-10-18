import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import AuthImage from "./AuthImage";

// The prepare gate report (plan §7.6, §13.4 step 4): pass/fail per check,
// round-trip pixel diff + diff image per page, per-field calibration and
// round-trip deltas. Every number was measured on the server (D11).

const STR = {
  passed: "All checks passed — the cleared template refills to the original design.",
  failed: "The gate failed. Fix the fields listed below, then prepare again.",
  stale: "The fields changed since this report — prepare again to re-check them.",
  pixel: (p, pct) => `Page ${p}: ${pct} % of pixels differ after refilling the samples`,
  diffTitle: "Difference image (red = changed pixels)",
  field: "Field",
  calibration: "Calibration Δx / Δw (px)",
  roundTrip: "Round-trip Δx / Δw (px)",
  status: "Status",
  ok: "OK",
  errors: { OFFSET_MISMATCH: "the text at the saved position changed", LINE_NOT_FOUND: "line not found", NOT_PROCESSED: "not processed" },
  overlaps: (k) => `overlaps ${k}`,
  transparent: "inside invisible text",
  ms: (ms) => `${(ms / 1000).toFixed(1)} s`,
};

const fmt = (n) => (typeof n === "number" ? n.toFixed(3) : "—");

export default function PrepareReport({ report, stale, loadDiff, reloadKey }) {
  if (!report) return null;
  const limit = report.thresholds?.calibrationPx ?? 0.5;
  return (
    <div className="space-y-4" data-testid="prepare-report">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${report.passed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
        {report.passed ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <XCircle className="w-5 h-5 mt-0.5" />}
        <div className="text-sm">
          <p className="font-semibold">{report.passed ? STR.passed : STR.failed}</p>
          {report.ms?.total && <p className="text-xs opacity-70">{STR.ms(report.ms.total)}</p>}
        </div>
      </div>
      {stale && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4" /> {STR.stale}
        </div>
      )}

      <ul className="grid sm:grid-cols-2 gap-2">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm bg-white border border-gray-200 rounded-lg p-2.5">
            {c.passed ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />}
            <span>
              {c.label}
              {!c.passed && c.failing?.length > 0 && <span className="block text-xs text-red-700">{c.failing.join(", ")}</span>}
            </span>
          </li>
        ))}
      </ul>

      {report.pages?.map((p) => (
        <div key={p.page} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-sm text-gray-700">{STR.pixel(p.page, p.pixelDiffPct)}</p>
          {loadDiff && (
            <details>
              <summary className="text-xs text-blue-600 cursor-pointer">{STR.diffTitle}</summary>
              <AuthImage load={() => loadDiff(p.page)} reloadKey={`${reloadKey}:${p.page}`} alt={STR.diffTitle} className="mt-2 w-full max-h-[600px] border border-gray-100" />
            </details>
          )}
        </div>
      ))}

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">{STR.field}</th>
              <th className="text-right px-3 py-2">{STR.calibration}</th>
              <th className="text-right px-3 py-2">{STR.roundTrip}</th>
              <th className="text-left px-3 py-2">{STR.status}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.fields || {}).map(([key, e]) => {
              const problems = [];
              if (!e.ok) problems.push(STR.errors[e.error] || e.error);
              if (e.transparent) problems.push(STR.transparent);
              if (e.overlapsWith?.length) problems.push(STR.overlaps(e.overlapsWith.join(", ")));
              const bad = (d) => d && (d.dx > limit || d.dw > limit);
              return (
                <tr key={key} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{key}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${bad(e.calibration) ? "text-red-700" : ""}`}>
                    {fmt(e.calibration?.dx)} / {fmt(e.calibration?.dw)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${bad(e.roundTrip) ? "text-red-700" : ""}`}>
                    {fmt(e.roundTrip?.dx)} / {fmt(e.roundTrip?.dw)}
                  </td>
                  <td className={`px-3 py-2 text-xs ${problems.length ? "text-red-700" : "text-emerald-700"}`}>{problems.length ? problems.join("; ") : STR.ok}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
