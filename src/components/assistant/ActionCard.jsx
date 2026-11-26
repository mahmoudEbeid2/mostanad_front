import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { approveAction, cancelAction, getActionProgress } from "../../services/apiAssistant";
import SourceBadge from "./SourceBadge";
import { downloadLayoutPdf, layoutFileUrl } from "../../services/apiLabelLayout";
import CertificatesResult from "./CertificatesResult";
import { isAr, tr } from "../../i18n/lang";

// Design E2: a change the assistant proposed. Nothing happens until the person
// presses Run; then "Approved by you · time" and — for a long job — a progress
// card fed by the existing background task. When the job ends the page lets
// the assistant continue (onFinished).

const POLL_MS = 1500;
const time = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const BADGE = {
  pending: [tr("محتاج موافقتك", "Needs your OK"), "bg-amber-50 text-amber-800"],
  running: [tr("شغّال", "Running"), "bg-blue-50 text-blue-700"],
  done: [tr("خلص", "Done"), "bg-green-50 text-green-700"],
  failed: [tr("فشل", "Failed"), "bg-red-50 text-red-700"],
  cancelled: [tr("اتلغى", "Cancelled"), "bg-gray-100 text-gray-600"],
  expired: [tr("انتهى", "Expired"), "bg-gray-100 text-gray-600"],
};
// the card's own texts in the page's language (the backend sends both)
const L = (x, key) => (isAr && x?.[`${key}Ar`]) || x?.[key];

/** A resized label (resize_label / upload_label_and_resize / confirm_label_upload): preview, fit, PDF. */
function LayoutResult({ layout }) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!layout?.previewUrl) return undefined;
    let url = null;
    layoutFileUrl(layout.previewUrl)
      .then((u) => setImg((url = u)))
      .catch(() => setImg(null));
    return () => url && URL.revokeObjectURL(url);
  }, [layout?.previewUrl]);
  const fit = layout.fit || {};
  const lines = [
    fit.scalePct != null ? `Scaled to ${fit.scalePct} %` : null,
    fit.fits === false ? "Doesn't fit — no PDF" : fit.fontPt ? `Fits · ${fit.fontPt} pt${fit.columns > 1 ? ` · ${fit.columns} columns` : ""}` : null,
    fit.smallestTextPt != null ? `Smallest text ${fit.smallestTextPt} pt` : fit.textMeasurable === false ? "Smallest text can't be measured" : null,
  ].filter(Boolean);
  return (
    <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3" data-testid="layout-result">
      {img && <img src={img} alt={`Label at ${layout.size}`} className="w-28 self-start ring-1 ring-gray-200" />}
      <div className="min-w-0 space-y-1 text-[13px]">
        <div className="font-semibold text-gray-900">{layout.size}</div>
        {lines.map((l) => (
          <div key={l} className="text-gray-700">{l}</div>
        ))}
        {[...(fit.overflow || []), ...(fit.warnings || [])].map((w) => (
          <div key={w} className="text-amber-800">⚠ {w}</div>
        ))}
        {layout.hasPdf && (
          <button type="button" onClick={() => downloadLayoutPdf(layout).catch((e) => toast.error(e.message))} className="font-semibold text-blue-600 hover:underline" data-testid="layout-result-pdf">
            Download PDF
          </button>
        )}
      </div>
    </div>
  );
}

function ProgressCard({ task, status }) {
  const pct = Math.max(0, Math.min(100, Number(task?.progress) || (status === "done" ? 100 : 0)));
  const finished = status === "done";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3" data-testid="progress-card" role="status">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{finished ? "✓ Finished" : status === "failed" ? "✕ Failed" : `${task?.message || task?.stage || "Working"}…`}</span>
        <span className="tabular-nums text-gray-500">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${status === "failed" ? "bg-red-500" : "bg-blue-600"} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {task?.stage && !finished && <div className="text-xs text-gray-500">{task.stage}</div>}
    </div>
  );
}

export default function ActionCard({ action: initial, onFinished, onDecided }) {
  const [action, setAction] = useState(initial);
  const [task, setTask] = useState(null);
  const [busy, setBusy] = useState(false);
  const reported = useRef(["done", "failed"].includes(initial.status)); // only a change seen here continues the chat
  const p = action.preview || {};
  // a draft's card lists every value with its source; the tool's own details add only what isn't one of them
  const shown = new Set((p.fields || []).flatMap((f) => [f.label, f.name].map((x) => String(x).toLowerCase())));
  const details = (p.details || []).filter((d) => !shown.has(String(d.label).toLowerCase()));
  const [label, badgeClass] = BADGE[action.status] || BADGE.pending;

  const finished = (a) => {
    if (reported.current || !["done", "failed"].includes(a.status)) return;
    reported.current = true;
    onFinished?.(a);
  };

  useEffect(() => {
    if (action.status !== "running" || !action.taskId) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const out = await getActionProgress(action.id);
        if (!alive) return;
        setTask(out.task);
        setAction(out.action);
        finished(out.action);
      } catch {
        /* the next tick tries again */
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.id, action.status, action.taskId]);

  const decide = async (run) => {
    setBusy(true);
    try {
      const a = run ? await approveAction(action.id) : await cancelAction(action.id);
      setAction(a);
      if (a.status === "failed") toast.error(a.error || "The action failed");
      finished(a);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
      if (e.response?.status === 410) setAction((x) => ({ ...x, status: "expired" }));
    } finally {
      setBusy(false);
      onDecided?.(action.id); // its draft moved on (confirmed, executed, back to collecting, expired)
    }
  };

  return (
    <>
      <div role="group" aria-label="Action to confirm" data-testid="action-card" data-status={action.status} className={`flex flex-col gap-2.5 rounded-xl border bg-white px-4 py-3.5 ${action.status === "pending" ? "border-2 border-amber-300" : "border-gray-200"}`}>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass}`}>{label}</span>
          <span className="text-sm font-bold" dir="auto">{L(p, "title") || action.tool}</span>
        </div>
        {p.summary && <p className="m-0 text-[13px] text-gray-600">{p.summary}</p>}
        {(p.fields || []).length > 0 && (
          <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 border-b border-gray-100 pb-2 text-[13px]" data-testid="action-fields">
            {p.fields.map((f) => (
              <div key={f.name} className="contents">
                <dt className="text-gray-500">{L(f, "label")}</dt>
                <dd className="m-0 flex items-start gap-1.5">
                  <span className="min-w-0 break-words" dir="auto">{f.value}</span>
                  <SourceBadge source={f.source} evidence={f.evidence} />
                </dd>
              </div>
            ))}
          </dl>
        )}
        <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[13px]">
          {details.map((d, i) => (
            <div key={i} className="contents">
              <dt className="text-gray-500">{L(d, "label")}</dt>
              <dd className="m-0 break-words" dir="auto">{d.value}</dd>
            </div>
          ))}
          {p.aiCalls && (
            <>
              <dt className="text-gray-500">{tr("استخدام الذكاء الاصطناعي", "AI use")}</dt>
              <dd className="m-0">{p.aiCalls}</dd>
            </>
          )}
          {(p.missing || []).length > 0 && (
            <>
              <dt className="text-gray-500">{tr("ناقص", "Missing")}</dt>
              <dd className="m-0">{(isAr && p.missingAr ? p.missingAr : p.missing).join(" · ")}</dd>
            </>
          )}
        </dl>
        {/* a result outside its specification (27 Nov QA): red, before anything is written */}
        {(p.warnings || []).length > 0 && (
          <ul className="m-0 list-none space-y-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-800" data-testid="action-warnings" dir="auto">
            {p.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}
        {action.status === "pending" ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => decide(true)} data-testid="action-run" className="min-h-11 rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50">
              {L(p, "runLabel") || tr("نفّذ", "Run")}
            </button>
            <button type="button" disabled={busy} onClick={() => decide(false)} data-testid="action-cancel" className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {tr("إلغاء", "Cancel")}
            </button>
          </div>
        ) : (
          <div className="text-[13px] font-medium text-gray-600" data-testid="action-decision">
            {action.status === "cancelled" ? `${tr("اتلغى", "Cancelled")} · ${time(action.decidedAt)}` : action.status === "expired" ? tr("انتهى — اطلبه تاني", "Expired — ask again for a new one") : `✓ ${tr("وافقت عليه", "Approved by you")} · ${time(action.decidedAt)}`}
          </div>
        )}
        {action.status === "failed" && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{action.error}</div>}
        {action.status === "done" && action.result?.labelLayout && <LayoutResult layout={action.result.labelLayout} />}
        {["done", "running"].includes(action.status) && action.result?.certificates?.length > 0 ? (
          <CertificatesResult certificates={action.result.certificates} link={action.result.link} companyId={action.companyId} />
        ) : (
          action.status === "done" &&
          action.result?.link && (
            <Link to={action.result.link} className="text-[13px] font-semibold text-blue-600 hover:underline">
              {tr("افتح ←", "Open →")}
            </Link>
          )
        )}
      </div>
      {action.taskId && ["running", "done", "failed"].includes(action.status) && <ProgressCard task={task} status={action.status} />}
    </>
  );
}
