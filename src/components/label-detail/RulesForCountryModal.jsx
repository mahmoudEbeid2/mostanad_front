import { useCallback, useEffect, useState } from "react";
import { X, Upload, Copy, CheckCircle2, AlertTriangle, RefreshCw, FileText, Play } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getCountryRules, uploadRulesForReview, resumeRules, copyRules, approveDocument, getDocument, waitForRulesTask } from "../../services/apiRegulatoryDocuments";
import { t } from "../../i18n";

// "Add rules for <country>" from a label whose check said "no rules for <country>".
// Three ways in — upload the regulation PDF, finish reading a document that stopped,
// or copy another country's approved rules as a starting point — and in every case a
// PERSON approves the rules (they see what they approve) before they are used. Then the
// label is checked again. Nothing here blocks the label: it can be approved with the warning.

function RulesPreview({ documentId }) {
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    getDocument(documentId).then(setDoc).catch(() => setDoc(null));
  }, [documentId]);
  if (!doc) return <Spinner size="sm" />;
  const rules = (doc.rules || []).filter((r) => r.status !== "rejected");
  return (
    <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs" data-testid="rules-preview">
      {rules.slice(0, 40).map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <p className="font-medium text-gray-800">{r.description}</p>
          {r.citation && <p className="mt-0.5 text-gray-500">“{r.citation.slice(0, 160)}”</p>}
        </li>
      ))}
      {rules.length > 40 && <li className="text-gray-500">{t("rulesForCountryModal.andMore", { v: rules.length - 40 })}</li>}
      {!rules.length && <li className="text-gray-500">{t("rulesForCountryModal.noRulesWereFoundIn")}</li>}
    </ul>
  );
}

export default function RulesForCountryModal({ country, onClose, onRecheck }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // what is running, for its button
  const [progress, setProgress] = useState(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [open, setOpen] = useState(null); // a document whose rules are shown

  const load = useCallback(() => getCountryRules(country).then(setState).catch((e) => setError(e.message)), [country]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (what, fn) => {
    setBusy(what);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };
  const follow = async (taskId) => waitForRulesTask(taskId, { onProgress: (it) => setProgress(it?.message || (it?.status === "processing" ? t("rulesForCountryModal.readingTheDocument") : null)) });

  const upload = () =>
    run("upload", async () => {
      const { taskId } = await uploadRulesForReview({ file, country: state.country, title: title.trim() || undefined });
      await follow(taskId);
      setFile(null);
      toast.success(t("rulesForCountryModal.rulesReadCheckThemAnd"));
    });
  const resume = (id) => run(`resume-${id}`, async () => follow((await resumeRules(id)).taskId));
  const copy = () =>
    run("copy", async () => {
      const out = await copyRules(copyFrom, state.country);
      toast.success(t("rulesForCountryModal.copiedRulesFromCheckThem", { reduce: out.documents.reduce((n, d) => n + d.rules, 0), copyFrom }));
      setOpen(out.documents[0]?.id || null);
    });
  const approve = (id) =>
    run(`approve-${id}`, async () => {
      await approveDocument(id);
      toast.success(t("rulesForCountryModal.sRulesAreNowIn", { country: state.country }));
    });
  const recheck = () => run("recheck", async () => onRecheck?.());

  const docs = state?.documents || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("rulesForCountryModal.rulesFor", { country })}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t("rulesForCountryModal.rulesFor2")}{" "}{state?.country || country}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("rulesForCountryModal.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-6 py-5 text-sm">
          {!state && !error && <Spinner />}
          {state && (
            <p className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${state.rulesInForce ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} data-testid="rules-in-force">
              {state.rulesInForce ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {state.rulesInForce ? t("rulesForCountryModal.rulesInForceFor", { rulesInForce: state.rulesInForce, country: state.country }) : t("rulesForCountryModal.noRulesInForceFor", { country: state.country })}
            </p>
          )}

          {docs.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-gray-800">{t("rulesForCountryModal.documentsFor")}{" "}{state.country}</p>
              {docs.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-200 p-3" data-testid="rules-document">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{d.title || d.authority || t("rulesForCountryModal.regulation")}</span>
                    {d.copied && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{t("rulesForCountryModal.copied")}</span>}
                    <span className="text-xs text-gray-500">{d.rules}{" "}{t("rulesForCountryModal.rules")}</span>
                    <span className="flex-1" />
                    {d.status === "approved" && <span className="text-xs font-semibold text-green-700">{t("rulesForCountryModal.inForce")}</span>}
                    {d.stuck && (
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" isLoading={busy === `resume-${d.id}`} disabled={!!busy} onClick={() => resume(d.id)}>
                        <Play className="h-3.5 w-3.5" />{" "}{t("rulesForCountryModal.finishReadingItsRules")}</Button>
                    )}
                    {d.awaitingApproval && (
                      <>
                        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setOpen(open === d.id ? null : d.id)}>
                          {open === d.id ? t("rulesForCountryModal.hideRules") : t("rulesForCountryModal.seeTheRules")}
                        </button>
                        <Button className="!px-2 !py-1 text-xs" isLoading={busy === `approve-${d.id}`} disabled={!!busy} onClick={() => approve(d.id)} data-testid="approve-rules">
                          <CheckCircle2 className="h-3.5 w-3.5" />{" "}{t("rulesForCountryModal.approveTheseRules")}</Button>
                      </>
                    )}
                  </div>
                  {d.stuck && <p className="mt-1 text-xs text-amber-800">{t("rulesForCountryModal.readingThisDocumentStoppedBefore")}</p>}
                  {open === d.id && <RulesPreview documentId={d.id} />}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <p className="font-semibold text-gray-800">{t("rulesForCountryModal.uploadTheRegulationPdf")}</p>
            <p className="text-xs text-gray-500">{t("rulesForCountryModal.itsRulesAreReadAnd")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="h-4 w-4" /> {file ? file.name : t("rulesForCountryModal.chooseThePdf")}
                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label={t("rulesForCountryModal.regulationPdf")} />
              </label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("rulesForCountryModal.titleOptional")} className="min-w-40 flex-1 rounded-lg border border-gray-300 px-2 py-1.5" aria-label={t("rulesForCountryModal.title")} />
              <Button onClick={upload} disabled={!file || !!busy} isLoading={busy === "upload"} data-testid="upload-rules">{t("rulesForCountryModal.readItsRules")}</Button>
            </div>
          </div>

          {state?.copyFrom?.length > 0 && (
            <div className="space-y-2 rounded-xl border border-gray-200 p-3">
              <p className="font-semibold text-gray-800">{t("rulesForCountryModal.orStartFromAnotherCountrys")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5" aria-label={t("rulesForCountryModal.copyFrom")}>
                  <option value="">{t("rulesForCountryModal.chooseACountry")}</option>
                  {state.copyFrom.map((c) => (
                    <option key={c.country} value={c.country}>
                      {c.country} ({c.rules}{" "}{t("rulesForCountryModal.rules2")}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={copy} disabled={!copyFrom || !!busy} isLoading={busy === "copy"} data-testid="copy-rules">
                  <Copy className="h-4 w-4" />{" "}{t("rulesForCountryModal.copyAsAStartingPoint")}</Button>
              </div>
              <p className="text-xs text-gray-500">{t("rulesForCountryModal.copyNote", { country: state.country, from: copyFrom || t("rulesForCountryModal.theOtherCountry") })}</p>
            </div>
          )}

          {progress && (
            <p className="flex items-center gap-2 text-gray-700" role="status">
              <Spinner size="sm" /> {progress}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-red-600" role="alert">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
        </div>
        <div className="flex justify-start gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button onClick={recheck} disabled={!state?.rulesInForce || !!busy} isLoading={busy === "recheck"} data-testid="recheck-label">
            <RefreshCw className="h-4 w-4" />{" "}{t("rulesForCountryModal.checkTheLabelAgain")}</Button>
          <Button variant="secondary" onClick={onClose}>{t("rulesForCountryModal.close")}</Button>
        </div>
      </div>
    </div>
  );
}
