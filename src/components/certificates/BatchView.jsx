import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { CheckCircle2, Download } from "lucide-react";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import CertificateCard from "./CertificateCard";
import useTaskProgress from "../../hooks/useTaskProgress";
import { downloadBatchZip, exportBatchZip, getBatch, waitForTask } from "../../services/apiCertificatesV2";

// One generation run (plan §10.2, §13.5; mockup B4): progress, counts, the
// certificate cards and the lines/types no active template covered.
const STR = {
  running: "Filling and rendering certificates…",
  queued: "Waiting for the renderer…",
  done: "All certificates are rendered",
  partial: "Finished — some certificates failed",
  failed: "Generation failed",
  of: (d, n) => `${d} of ${n}`,
  ready: "ready",
  attention: "needs attention",
  rendering: "rendering",
  failedCount: "failed",
  gap: (g, country) => (
    <>
      <b>
        Line {g.lineNo}
        {g.name ? ` (${g.name})` : ""}
      </b>{" "}
      got no {g.typeCode} certificate — there’s no active {g.typeCode} template
      {g.brandName ? ` for ${g.brandName}` : ""}
      {country ? ` in ${country}` : ""}.
    </>
  ),
  create: "Create the template",
  zip: "Download all (ZIP)",
  progress: "Certificates rendered",
};
const RUNNING = new Set(["queued", "running"]);

export default function BatchView({ scope, batchId, taskId, onFinished, canExport = false }) {
  const [batch, setBatch] = useState(null);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState(null);
  const countryName = useMemo(() => {
    const list = countryList();
    return (code) => (code ? list.getLabel(code) || code : null);
  }, []);

  const load = useCallback(async () => {
    try {
      setBatch(await getBatch(scope, batchId));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [scope, batchId]);

  useEffect(() => {
    load();
  }, [load]);

  const running = !batch || RUNNING.has(batch.status);
  const task = useTaskProgress(running ? taskId : null);
  // poll while running (the socket only hints; the batch row is the truth)
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running, load]);

  const finishedStatus = batch && !RUNNING.has(batch.status) ? batch.status : null;
  useEffect(() => {
    if (finishedStatus) onFinished?.(finishedStatus);
  }, [finishedStatus, onFinished]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!batch)
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );

  const live = batch.live;
  const done = live.rendered + live.failed;
  const attention = batch.certificates.filter((c) => c.status !== "failed" && c.status !== "pending" && c.flagCount > 0).length;
  const heading = batch.status === "running" ? STR.running : batch.status === "queued" ? STR.queued : batch.status === "done" ? STR.done : batch.status === "failed" ? STR.failed : STR.partial;
  const gaps = batch.plan?.gaps || [];
  const downloadZip = async () => {
    setZipping(true);
    try {
      const { taskId: t } = await exportBatchZip(scope, batchId);
      await waitForTask(t);
      await downloadBatchZip(scope, batchId);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="batch-view" data-status={batch.status}>
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          {running ? <Spinner /> : <CheckCircle2 aria-hidden="true" className={`w-6 h-6 ${live.failed ? "text-orange-500" : "text-emerald-600"}`} />}
          {/* the heading changes only with the batch status — announced once per change */}
          <h2 className="font-semibold text-gray-900" aria-live="polite">
            {heading}
          </h2>
          <span className="ml-auto font-semibold text-gray-900">{STR.of(done, live.planned)}</span>
          {canExport && !running && live.rendered > 0 && (
            <Button variant="secondary" className="!py-2 text-sm" isLoading={zipping} onClick={downloadZip}>
              <Download className="w-4 h-4" /> {STR.zip}
            </Button>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={STR.progress}
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={live.planned}
          aria-valuetext={STR.of(done, live.planned)}
          className="h-2 bg-gray-100 rounded-full overflow-hidden"
        >
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${live.planned ? Math.max((100 * done) / live.planned, running ? 4 : 0) : 0}%` }} />
        </div>
        <p className="text-sm text-gray-600 flex flex-wrap gap-x-5 gap-y-1">
          <span>
            <b className="text-emerald-700">{live.rendered - attention}</b> {STR.ready}
          </span>
          <span>
            <b className="text-amber-700">{attention}</b> {STR.attention}
          </span>
          <span>
            <b className="text-blue-700">{live.pending}</b> {STR.rendering}
          </span>
          <span>
            <b className="text-red-700">{live.failed}</b> {STR.failedCount}
          </span>
          {running && task.message && <span className="text-gray-400">{task.message}</span>}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {batch.certificates.map((c) => (
          <CertificateCard key={c.id} scope={scope} cert={c} />
        ))}
      </div>

      {gaps.map((g) => (
        <div key={`${g.invoiceItemId}:${g.certificateTypeId}:${g.scope}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{STR.gap(g, countryName(g.country))}</span>
          <Link to={`/certificates/templates/new?certificateTypeId=${g.certificateTypeId}`} className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50">
            {STR.create}
          </Link>
        </div>
      ))}
    </div>
  );
}
