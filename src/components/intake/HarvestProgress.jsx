// The drop's AI read of every file (28 Nov), on its card: each file with its own stage — uploading /
// reading / verifying / done / failed (with the reason) — live over Server-Sent Events, and polled every
// 5 s when the stream drops. Then what it filled ("قريت 14 ملف — ملّيت 212 قيمة — …"); a file that wasn't
// read says why, with «إعادة قراءة». Nothing waits on this: the certificates are made anyway.
import { keyAr } from "../certificates/ProductHarvestSection";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpenCheck, Loader2, AlertTriangle, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import apiClient from "../../services/apiClient";
import { followHarvest } from "../../services/apiIntake";
import { isAr, t } from "../../i18n";

const STAGE_AR = { waiting: t("harvestProgress.waiting"), uploading: t("harvestProgress.uploading"), reading: t("harvestProgress.reading"), verifying: t("harvestProgress.reviewing"), read: t("harvestProgress.read"), failed: t("harvestProgress.notRead"), skipped: t("harvestProgress.skipped") };
const running = (h) => ["queued", "running"].includes(h?.status);

// the backend's line is Arabic only ("قريت 5 ملف — …", BACKEND_STRINGS_TODO.md): other languages build it from the counts
const summaryLine = (sum) =>
  sum && sum.files != null
    ? [
        t("harvestProgress.readN", { count: sum.files }),
        sum.filled ? t("harvestProgress.filledNew", { count: sum.filled }) : t("harvestProgress.nothingNew"),
        sum.conflicts ? t("harvestProgress.conflictsBelow", { count: sum.conflicts }) : t("harvestProgress.noConflicts"),
        ...(sum.batchMissing ? [t("harvestProgress.batchMissing", { count: sum.batchMissing })] : []),
      ].join(" — ")
    : null;

export default function HarvestProgress({ batchId, initial, line = null, onDone }) {
  const [h, setH] = useState(initial || null);
  const [busy, setBusy] = useState(false);
  const poll = useRef(null);

  useEffect(() => setH(initial || null), [initial]);
  useEffect(() => {
    if (!batchId || !running(h)) return undefined;
    const ac = new AbortController();
    const startPolling = () => {
      clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const r = await apiClient.get(`/intake/batches/${batchId}/harvest`);
          const v = r.data.data;
          setH(v);
          if (!running(v)) {
            clearInterval(poll.current);
            onDone?.();
          }
        } catch {
          /* the next tick tries again */
        }
      }, 5000);
    };
    followHarvest(batchId, { onProgress: (v) => v && setH(v), signal: ac.signal })
      .then((last) => {
        if (running(last)) startPolling(); // the stream ended while still reading: poll instead
        else if (last) onDone?.();
      })
      .catch(() => !ac.signal.aborted && startPolling());
    return () => {
      ac.abort();
      clearInterval(poll.current);
    };
    // a new stream only when the drop or its state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, h?.status]);

  const retry = async () => {
    setBusy(true);
    try {
      const r = await apiClient.post(`/intake/batches/${batchId}/harvest/retry`);
      setH(r.data.data);
      toast.success(t("harvestProgress.readingTheFilesThatWerent"));
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!h || h.status === "off") return null;
  const files = h.files || [];
  const failed = files.filter((f) => ["failed", "skipped"].includes(f.status));
  const isRunning = running(h);
  return (
    <div className="space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950" data-testid="harvest-progress" data-status={h.status}>
      <p className="flex items-center gap-1.5 font-semibold">
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenCheck className="h-3.5 w-3.5" />}
        {isRunning ? t("harvestProgress.readingTheFiles", { done: h.done, total: h.total }) : (isAr && (line || h.ar)) || summaryLine(h.summary) || t("harvestProgress.readN", { count: files.filter((f) => f.status === "read").length })}
      </p>
      {isRunning && h.total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.max(4, Math.round((100 * h.done) / h.total))}%` }} />
        </div>
      )}
      {files.length > 0 && (isRunning || failed.length > 0) && (
        <ul className="space-y-0.5" data-testid="harvest-files">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-1.5">
              {f.status === "read" ? <CheckCircle2 className="h-3 w-3 text-emerald-700" /> : ["failed", "skipped"].includes(f.status) ? <XCircle className="h-3 w-3 text-red-600" /> : <Loader2 className={`h-3 w-3 ${f.status === "waiting" ? "" : "animate-spin"} text-gray-500`} />}
              <span className="min-w-0 truncate">{f.name}</span>
              <span className={`shrink-0 ${["failed", "skipped"].includes(f.status) ? "text-red-700" : "text-gray-600"}`}>— {STAGE_AR[f.status] || f.status}</span>
              {f.error && ["failed", "skipped"].includes(f.status) && <span className="truncate text-gray-500" title={f.error}>({f.error})</span>}
            </li>
          ))}
        </ul>
      )}
      {!isRunning && h.review > 0 && <p className="text-amber-900">{h.review}{" "}{t("harvestProgress.aValueTheReviewDoubted")}</p>}
      {/* 27 Nov QA: the conflicts themselves, not only their count — each value with its file and page */}
      {!isRunning && (h.summary?.conflictList || []).length > 0 && (
        <details className="text-amber-950" data-testid="harvest-conflicts">
          <summary className="cursor-pointer font-semibold">{t("harvestProgress.conflictsOneFileSaysOne", { length: h.summary.conflictList.length })}</summary>
          <ul className="mt-1 space-y-0.5">
            {h.summary.conflictList.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.product}</span> · {isAr ? c.fieldAr : keyAr(c.field)}:{" "}
                {c.values.map((v, j) => (
                  <span key={j} dir="auto">
                    {j > 0 && " ↔ "}«{v.value}»{v.file ? ` (${v.file}${v.page ? t("harvestProgress.p", { page: v.page }) : ""})` : ""}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!isRunning && failed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{failed.length}{" "}{t("harvestProgress.aFileWasntReadThe")}</span>
          <button type="button" onClick={retry} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" data-testid="harvest-retry">
            <RotateCcw className="h-3.5 w-3.5" />{" "}{t("harvestProgress.readAgain")}</button>
        </div>
      )}
    </div>
  );
}
