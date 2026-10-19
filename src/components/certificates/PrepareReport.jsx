import { Check, AlertTriangle, X } from "lucide-react";
import AuthImage from "./AuthImage";

// The prepare gate report (plan §7.6, §13.4 step 4; mockup A5): a status band,
// one card per gate check (measured value vs limit), the pixel comparison and
// per-field round-trip deltas. Every number was measured on the server (D11);
// the cards only pick maxima/counts out of the stored report.

const STR = {
  passedReady: "Prepare passed — ready to activate",
  passed: "Prepare passed",
  passedHint: "The cleared template refilled with the original values matches the uploaded design.",
  failed: "Prepare failed",
  failedHint: "Fix the fields listed below, then run it again.",
  stale: "The fields changed since this report — prepare again to re-check them.",
  pass: "pass",
  fail: "fail",
  limit: "limit",
  checks: {
    has_fields: "Fields defined",
    offsets: "Fields found at their offsets",
    calibration: "Width calibration (max)",
    round_trip: "Round-trip per field (max)",
    pixel_diff: "Page pixel difference",
    transparent: "Fields in hidden spans",
    overlap: "Overlapping fields",
  },
  failures: "failures",
  pixelTitle: "Pixel comparison",
  original: "Original upload",
  difference: (pct, page, many) => `Difference${many ? ` · page ${page}` : ""} · ${pct} %`,
  field: "Field",
  align: "Align",
  position: "Position Δ",
  width: "Width Δ",
  result: "Result",
  ok: "ok",
  errors: { OFFSET_MISMATCH: "the text at the saved position changed", LINE_NOT_FOUND: "line not found", NOT_PROCESSED: "not processed" },
  overlaps: (k) => `overlaps ${k}`,
  transparent: "inside invisible text",
  calibrationOff: (d) => `calibration Δ ${d} px`,
  ms: (ms) => `${(ms / 1000).toFixed(1)} s`,
};

const px = (n) => (typeof n === "number" ? `${n.toFixed(2)} px` : "—");
const maxOf = (list) => (list.length ? Math.max(...list) : 0);

/** measured value + limit for one gate check, from the report */
function measure(check, report) {
  const entries = Object.values(report.fields || {});
  const ok = entries.filter((e) => e.ok);
  const t = report.thresholds || {};
  switch (check.id) {
    case "has_fields":
      return { value: String(entries.length), limit: "≥ 1" };
    case "offsets":
      return { value: `${ok.length} / ${entries.length}`, limit: `0 ${STR.failures}` };
    case "calibration":
      return { value: px(maxOf(ok.flatMap((e) => (e.calibration ? [e.calibration.dx, e.calibration.dw] : [])))), limit: `≤ ${t.calibrationPx} px` };
    case "round_trip":
      return { value: px(maxOf(ok.flatMap((e) => (e.roundTrip ? [e.roundTrip.dx, e.roundTrip.dw] : [])))), limit: `≤ ${t.roundTripPx} px` };
    case "pixel_diff":
      return { value: report.pixelDiffPct != null ? `${report.pixelDiffPct} %` : "—", limit: `≤ ${t.pixelDiffPct} %` };
    case "transparent":
      return { value: String(ok.filter((e) => e.transparent).length), limit: "0" };
    case "overlap":
      return { value: String(ok.filter((e) => e.overlapsWith?.length).length), limit: "0" };
    default:
      return { value: null, limit: null };
  }
}

export default function PrepareReport({ report, stale, ready, fields = [], loadDiff, loadOriginal, reloadKey, actions }) {
  if (!report) return null;
  const calLimit = report.thresholds?.calibrationPx ?? 0.5;
  const rtLimit = report.thresholds?.roundTripPx ?? 0.5;
  const alignOf = Object.fromEntries(fields.map((f) => [f.key, f.align || "left"]));
  const pages = report.pages || [];
  return (
    <div data-testid="prepare-report">
      <div className={`flex flex-wrap items-center gap-4 px-5 py-[18px] border-b ${report.passed ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${report.passed ? "bg-emerald-700" : "bg-red-700"}`}>
          {report.passed ? <Check className="w-5 h-5 text-white" strokeWidth={2.5} /> : <X className="w-5 h-5 text-white" strokeWidth={2.5} />}
        </span>
        <div className="flex-1 min-w-52">
          <h2 className={`text-base font-bold ${report.passed ? "text-emerald-900" : "text-red-900"}`}>{report.passed ? (ready ? STR.passedReady : STR.passed) : STR.failed}</h2>
          <p className={`text-[13px] mt-0.5 ${report.passed ? "text-emerald-700" : "text-red-700"}`}>
            {report.passed ? STR.passedHint : STR.failedHint}
            {report.ms?.total ? <span className="opacity-70"> · {STR.ms(report.ms.total)}</span> : null}
          </p>
        </div>
        {actions}
      </div>

      {stale && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {STR.stale}
        </div>
      )}

      <div className="p-5 grid gap-3 grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {report.checks.map((c) => {
          const m = measure(c, report);
          return (
            <div key={c.id} className="border border-gray-200 rounded-[10px] px-3.5 py-3" data-check={c.id}>
              <div className="text-xs text-gray-600">{STR.checks[c.id] || c.label}</div>
              {m.value !== null && (
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold tabular-nums text-gray-900">{m.value}</span>
                  <span className="text-xs text-gray-500">
                    {STR.limit} {m.limit}
                  </span>
                </div>
              )}
              <div className={`text-xs font-semibold mt-0.5 ${c.passed ? "text-emerald-700" : "text-red-700"}`}>{c.passed ? `✓ ${STR.pass}` : `✗ ${STR.fail}`}</div>
              {!c.passed && c.failing?.length > 0 && <div className="text-xs text-red-700 mt-0.5 break-words">{c.failing.join(", ")}</div>}
            </div>
          );
        })}
      </div>

      {pages.length > 0 && (loadDiff || loadOriginal) && (
        <div className="px-5 pb-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{STR.pixelTitle}</h3>
          <div className="flex flex-wrap justify-center gap-5 bg-gray-100 rounded-[10px] p-[18px]">
            {loadOriginal && (
              <figure className="text-center">
                <AuthImage load={loadOriginal} reloadKey={`${reloadKey}:orig`} alt={STR.original} className="h-56 w-40 bg-white shadow" />
                <figcaption className="text-xs text-gray-600 mt-2">{STR.original}</figcaption>
              </figure>
            )}
            {loadDiff &&
              pages.map((p) => (
                <figure key={p.page} className="text-center">
                  <AuthImage load={() => loadDiff(p.page)} reloadKey={`${reloadKey}:${p.page}`} alt={STR.difference(p.pixelDiffPct, p.page, pages.length > 1)} className="h-56 w-40 shadow" />
                  <figcaption className="text-xs text-gray-600 mt-2">{STR.difference(p.pixelDiffPct, p.page, pages.length > 1)}</figcaption>
                </figure>
              ))}
          </div>
        </div>
      )}

      <div className="px-5 pb-5 overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead className="text-xs text-gray-500 text-left">
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-3 font-semibold">{STR.field}</th>
              <th className="py-2 pr-3 font-semibold">{STR.align}</th>
              <th className="py-2 pr-3 font-semibold">{STR.position}</th>
              <th className="py-2 pr-3 font-semibold">{STR.width}</th>
              <th className="py-2 font-semibold">{STR.result}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.fields || {}).map(([key, e]) => {
              const problems = [];
              if (!e.ok) problems.push(STR.errors[e.error] || e.error);
              if (e.transparent) problems.push(STR.transparent);
              if (e.overlapsWith?.length) problems.push(STR.overlaps(e.overlapsWith.join(", ")));
              if (e.calibration && (e.calibration.dx > calLimit || e.calibration.dw > calLimit)) problems.push(STR.calibrationOff(Math.max(e.calibration.dx, e.calibration.dw).toFixed(2)));
              const rtBad = e.roundTrip && (e.roundTrip.dx > rtLimit || e.roundTrip.dw > rtLimit);
              return (
                <tr key={key} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{key}</td>
                  <td className="py-2 pr-3 text-gray-700">{alignOf[key] || "—"}</td>
                  <td className={`py-2 pr-3 tabular-nums ${rtBad ? "text-red-700" : ""}`}>{px(e.roundTrip?.dx)}</td>
                  <td className={`py-2 pr-3 tabular-nums ${rtBad ? "text-red-700" : ""}`}>{px(e.roundTrip?.dw)}</td>
                  <td className="py-2">
                    {problems.length || rtBad ? (
                      <span className="text-xs text-red-700">{problems.join("; ") || STR.fail}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{STR.ok}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
