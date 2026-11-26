// The drop's AI read of every file (28 Nov), on its card: "بقرا الملفات… 8/14" while it runs (live, over
// Server-Sent Events), then what it filled — "قريت 14 ملف — ملّيت 212 قيمة — 3 تعارضات — 6 خانات باتش ناقصة" —
// the values it wasn't sure of (kept for review, never filled) and a file it couldn't read.
import { useEffect, useState } from "react";
import { BookOpenCheck, Loader2, AlertTriangle } from "lucide-react";
import { followHarvest } from "../../services/apiIntake";

export default function HarvestProgress({ batchId, initial, line = null, onDone }) {
  const [h, setH] = useState(initial || null);
  const running = ["queued", "running"].includes(h?.status);

  useEffect(() => setH(initial || null), [initial]);
  useEffect(() => {
    if (!batchId || !["queued", "running"].includes(initial?.status)) return undefined;
    const ac = new AbortController();
    followHarvest(batchId, { onProgress: (v) => v && setH(v), signal: ac.signal })
      .then((last) => last?.status === "done" && onDone?.())
      .catch(() => {});
    return () => ac.abort();
    // a new stream only when the drop or its state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, initial?.status]);

  if (!h || h.status === "off") return null;
  const failed = (h.files || []).filter((f) => f.status === "failed");
  return (
    <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950" data-testid="harvest-progress" data-status={h.status}>
      <p className="flex items-center gap-1.5 font-semibold">
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
        {running ? `بقرا الملفات… ${h.done}/${h.total}` : line || h.ar || `قريت ${(h.files || []).filter((f) => f.status === "read").length} ملف`}
      </p>
      {running && h.total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round((100 * h.done) / h.total)}%` }} />
        </div>
      )}
      {!running && h.review > 0 && <p className="text-amber-900">{h.review} قيمة المراجعة شكّت فيها — متحفظة «محتاجة مراجعة» ومش متملية.</p>}
      {failed.length > 0 && (
        <p className="flex items-start gap-1 text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          معرفناش نقرا: {failed.map((f) => f.name).join("، ")} — الباقي اتقرا عادي.
        </p>
      )}
    </div>
  );
}
