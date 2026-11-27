import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReviewBar from "../components/certificates/ReviewBar";
import EstimatesBar from "../components/certificates/EstimatesBar";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import StatusBadge from "../components/certificates/StatusBadge";
import DocumentFrame from "../components/certificates/DocumentFrame";
import CertificateValuesForm from "../components/certificates/CertificateValuesForm";
import VersionsDrawer from "../components/certificates/VersionsDrawer";
import useCompanyScope from "../hooks/useCompanyScope";
import useConfirm from "../hooks/useConfirm";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { sourceOptions } from "../utils/certificateFieldSources";
import { getFieldSources } from "../services/apiCertificateTemplates";
import {
  downloadCertificatePdf,
  duplicateCertificate,
  editCertificateValues,
  exportCertificatePdf,
  finalizeCertificate,
  getCertificate,
  getCertificateHtml,
  listCertificateVersions,
  resetCertificateField,
  restoreCertificateVersion,
  waitForTask,
} from "../services/apiCertificatesV2";
import useFollowEntityCompany from "../hooks/useFollowEntityCompany";
import { fmtDateTime, fmtTime, strings, t } from "../i18n";

// /certificates/:id (plan §11, §13.6; mockup B5). The frame always shows a
// SERVER render; typing only patches the field span's text for instant,
// ephemeral feedback (no layout compensation) until the save re-renders.

const STR = {
  ...strings("certificateEditor"),
  issuesLeft: (n) => t("certificateEditor.issuesLeft", { count: n }),
  finalNote: (d) => t("certificateEditor.finalNote", { date: fmtDateTime(d) }),
  saved: (d) => t("certificateEditor.saved", { time: fmtTime(d) }),
};

// 28 Nov (owner), COA: a test with no result is taken off the certificate — said in one line; it comes back
// once its result is given (a test the product type doesn't have isn't listed: no result brings it back)
function removedLine(values, fields) {
  const label = new Map((fields || []).map((f) => [f.key, f.label]));
  const names = Object.entries(values || {})
    .filter(([, v]) => (v?.flags || []).includes("row_removed") && !v.removedWith && v.provenance?.rule !== "not_applicable_oral")
    .map(([k]) => String(label.get(k) || k).replace(/\s*(result|النتيجة|نتيجة)\s*$/i, "").trim());
  return names.length ? t("certificateEditor.removedRows", { list: [...new Set(names)].join(t("common.listSep")) }) : null;
}

export default function CertificateEditor() {
  const { id } = useParams();
  const [confirm, confirmDialog] = useConfirm();
  const navigate = useNavigate();
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  // a link from another company's page opens here: switch to the certificate's company (Phase 6)
  useFollowEntityCompany(scopeState, "certificate", id);
  const { user } = useAuth();
  const canEdit = hasPermission(user, "update_certificates");
  const canExport = hasPermission(user, "export_certificates");
  const [cert, setCert] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [versions, setVersions] = useState([]);
  const [options, setOptions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saveState, setSaveState] = useState({ state: "idle", at: null });
  const [conflict, setConflict] = useState(null); // { currentVersion, changes }
  const [viewing, setViewing] = useState(null); // version number, null = current
  const [showVersions, setShowVersions] = useState(false);
  const [busy, setBusy] = useState(null);
  const docRef = useRef(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    if (!scope) return;
    try {
      const [c, v] = await Promise.all([getCertificate(scope, id), listCertificateVersions(scope, id)]);
      setCert(c);
      setVersions(v);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, [scope, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!scope) return;
    getFieldSources(scope)
      .then((c) => setOptions(sourceOptions(c)))
      .catch(() => setOptions([])); // chips fall back to the raw source
  }, [scope]);

  // a pending certificate becomes a draft when the batch renders it
  useEffect(() => {
    if (cert?.status !== "pending") return undefined;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [cert?.status, load]);

  const editable = !!cert && canEdit && cert.status === "draft" && viewing === null && !conflict;
  const fields = useMemo(() => [...(cert?.fields || [])].sort((a, b) => (a.page || 1) - (b.page || 1) || (a.sortOrder || 0) - (b.sortOrder || 0)), [cert?.fields]);

  // instant, ephemeral feedback in the frame (plan §13.6) — text only; a
  // group's rows change the layout, so they wait for the server render
  const paint = useCallback((key, value) => {
    if (typeof value !== "string") return;
    docRef.current?.querySelectorAll(`[data-field="${CSS.escape(key)}"]`).forEach((el) => {
      el.textContent = value;
    });
  }, []);

  const onChange = (key, value) => {
    setDrafts((d) => ({ ...d, [key]: value }));
    setSaveState((s) => ({ ...s, state: "dirty" }));
    paint(key, value);
  };
  const onRevert = (key) => {
    setDrafts((d) => {
      const { [key]: _drop, ...rest } = d;
      return rest;
    });
    paint(key, cert?.values?.[key]?.value ?? "");
  };

  const save = useCallback(
    async ({ expectedVersion, changes } = {}) => {
      const sent = changes || { ...draftsRef.current };
      if (!cert || savingRef.current || !Object.keys(sent).length) return;
      savingRef.current = true;
      setSaveState((s) => ({ ...s, state: "saving" }));
      try {
        await editCertificateValues(scope, id, expectedVersion ?? cert.currentVersion, sent);
        // keep anything typed while the request was in flight
        setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k, v]) => sent[k] !== v)));
        setConflict(null);
        setSaveState({ state: "saved", at: new Date() });
        await load();
      } catch (err) {
        if (err.code === "VERSION_CONFLICT") setConflict({ currentVersion: err.data?.currentVersion, changes: sent });
        else toast.error(err.message);
        setSaveState((s) => ({ ...s, state: "error" }));
      } finally {
        savingRef.current = false;
      }
    },
    [cert, scope, id, load]
  );

  // autosave after 1 s idle (plan §13.6)
  useEffect(() => {
    if (!editable || !Object.keys(drafts).length) return undefined;
    const t = setTimeout(() => save(), 1000);
    return () => clearTimeout(t);
  }, [drafts, editable, save]);

  // Ctrl/⌘+S saves now
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editable) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, save]);

  const act = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const resetField = (key) =>
    act("reset", async () => {
      await resetCertificateField(scope, id, key, cert.currentVersion);
      onRevert(key);
      toast.success(STR.reset(key));
      await load();
    });
  const restore = (n) =>
    act("restore", async () => {
      await restoreCertificateVersion(scope, id, n, cert.currentVersion);
      setViewing(null);
      setDrafts({});
      toast.success(STR.restored(n));
      await load();
    });
  const exportPdf = () =>
    act("export", async () => {
      if (cert.status !== "final") {
        const { taskId } = await exportCertificatePdf(scope, id);
        await waitForTask(taskId);
      }
      await downloadCertificatePdf(scope, id);
      await load();
    });
  const finalize = async () => {
    if (!(await confirm(STR.confirmFinalize))) return;
    await act("finalize", async () => {
      await finalizeCertificate(scope, id, cert.currentVersion);
      toast.success(STR.finalized);
      await load();
    });
  };
  const duplicate = () =>
    act("duplicate", async () => {
      const { certificateId } = await duplicateCertificate(scope, id);
      toast.success(STR.duplicated);
      navigate(`/certificates/${certificateId}`);
    });

  if (!scope)
    return (
      <div className="space-y-4">
        <RoleBanner scope={scopeState} />
        <CompanyPicker scope={scopeState} />
      </div>
    );
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!cert)
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );

  const final = cert.status === "final";
  const dirty = Object.keys(drafts).length > 0;
  const blocking = Object.entries(cert.flags || {})
    .filter(([, f]) => f.some((x) => ["missing", "overflow", "missing_span", "sample_value", "unconfirmed"].includes(x) || x.startsWith("glyph:")))
    .map(([k]) => fields.find((f) => f.key === k)?.label || cert.groups?.find((g) => g.key === k)?.label || k);
  const title = `${cert.certificateType?.code || ""} · ${cert.scope === "per_invoice" ? STR.whole : cert.product?.name || "—"}`;
  const saveText =
    saveState.state === "saving" ? STR.saving : saveState.state === "dirty" || dirty ? STR.dirty : saveState.state === "error" ? STR.failed : saveState.at ? STR.saved(saveState.at) : "";

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            {cert.withoutInvoice ? (
              <span data-testid="without-invoice">{t("certificateEditor.noInvoice")}</span>
            ) : (
              <Link to={`/invoices/${cert.invoiceId}?batch=${cert.batchId}`} className="text-blue-600 hover:underline">
                {cert.invoiceNumber || t("certificateEditor.invoice")}
              </Link>
            )}
            {cert.batchNo ? ` / ${STR.batch} ${cert.batchNo}` : ""}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mt-1" data-testid="editor-title">
            {title} <StatusBadge status={cert.status} />
            {cert.currentVersion > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">v{cert.currentVersion}</span>}
          </h1>
        </div>
        <div className="flex items-start gap-3">
          <CompanyPicker scope={scopeState} />
          {versions.length > 0 && (
            <Button variant="secondary" onClick={() => setShowVersions(true)}>
              {STR.versions(versions.length)}
            </Button>
          )}
          {canExport && ["draft", "final"].includes(cert.status) && (
            <Button variant="secondary" isLoading={busy === "export"} disabled={dirty} onClick={exportPdf}>
              {final ? STR.downloadPdf : STR.exportPdf}
            </Button>
          )}
          {final && canEdit && (
            <Button isLoading={busy === "duplicate"} onClick={duplicate}>
              {STR.duplicate}
            </Button>
          )}
          {cert.status === "draft" && canEdit && (
            <div className="flex flex-col items-end">
              <Button isLoading={busy === "finalize"} disabled={blocking.length > 0 || dirty || viewing !== null} onClick={finalize} title={blocking.length ? blocking.join(", ") : undefined}>
                {STR.finalize}
              </Button>
              {blocking.length > 0 ? (
                <span className="text-xs text-red-600 mt-1 max-w-xs text-end" dir="auto" title={blocking.join(", ")} data-testid="issues-left">
                  {STR.issuesLeft(blocking.length)}: {blocking.slice(0, 6).join(t("common.listSep"))}{blocking.length > 6 ? "…" : ""}
                </span>
              ) : dirty ? (
                <span className="text-xs text-gray-500 mt-1">{STR.unsavedLeft}</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <RoleBanner scope={scopeState} />
      {cert.isExperimentSample && (
        <p className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-2 text-sm font-bold text-red-800" data-testid="experiment-sample">{t("certificateEditor.aSampleFromExperimentMode")}</p>
      )}
      {["draft", "final"].includes(cert.status) && canEdit && <ReviewBar scope={scope} cert={cert} fields={fields} onChanged={load} />}
      {/* an experiment sample's AI values are test data — never accepted (QA 28 Nov) */}
      {cert.status === "draft" && canEdit && !cert.isExperimentSample && <EstimatesBar scope={scope} values={cert.values} certificateIds={[cert.id]} onAccepted={load} />}
      {removedLine(cert.values, fields) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900" data-testid="removed-rows">
          {removedLine(cert.values, fields)}
        </p>
      )}

      {cert.status === "pending" && <p className="text-sm text-blue-700">{STR.pending}</p>}
      {cert.status === "failed" && (
        <p className="text-sm text-red-700">
          <b>{STR.failedCert}</b> {cert.error}
        </p>
      )}
      {final && <p className="text-sm text-emerald-700">{STR.finalNote(cert.finalizedAt)}</p>}

      {conflict && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2" role="alertdialog" data-testid="conflict">
          <p className="font-semibold text-amber-900">{STR.conflictTitle}</p>
          <p className="text-sm text-amber-900">{STR.conflictText(conflict.currentVersion)}</p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                setConflict(null);
                setDrafts({});
                setSaveState({ state: "idle", at: null });
                await load();
              }}
            >
              {STR.reload}
            </Button>
            <Button onClick={() => save({ expectedVersion: conflict.currentVersion, changes: conflict.changes })}>{STR.overwrite}</Button>
          </div>
        </div>
      )}

      {cert.currentVersion > 0 && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 text-sm">
              {viewing !== null ? (
                <span className="text-amber-800">
                  {STR.viewingOld(viewing)}{" "}
                  <button type="button" className="ms-2 text-blue-600 hover:underline" onClick={() => setViewing(null)}>
                    {STR.backToCurrent}
                  </button>
                </span>
              ) : (
                <span className="text-gray-600">{STR.rendered}</span>
              )}
              <span className={`text-xs ${saveState.state === "error" ? "text-red-600" : saveState.state === "saved" && !dirty ? "text-emerald-700" : "text-gray-500"}`} data-testid="save-state">
                {saveText}
              </span>
            </div>
            <DocumentFrame
              load={() => getCertificateHtml(scope, id, viewing || undefined)}
              reloadKey={`${id}:${cert.currentVersion}:${viewing}`}
              onReady={({ doc }) => {
                docRef.current = doc;
                if (viewing === null) Object.entries(draftsRef.current).forEach(([k, v]) => paint(k, v));
                // what still blocks finalize, outlined on the certificate itself (an empty field gets a visible box)
                for (const [k, f] of Object.entries(cert.flags || {})) {
                  if (!f.some((x) => ["missing", "overflow", "missing_span", "sample_value", "unconfirmed"].includes(x) || x.startsWith("glyph:"))) continue;
                  doc.querySelectorAll(`[data-field="${CSS.escape(k)}"]`).forEach((el) => {
                    el.style.outline = "2px solid #dc2626";
                    el.style.background = "rgba(220,38,38,0.08)";
                    if (!el.textContent.trim()) Object.assign(el.style, { display: "inline-block", minWidth: "48px", minHeight: "1em" });
                  });
                }
              }}
              minHeight={640}
              title={t("certificateEditor.certificate")}
            />
          </section>
          <CertificateValuesForm
            fields={fields}
            groups={cert.groups || []}
            values={viewing === null ? cert.values : versions.find((v) => v.versionNumber === viewing)?.values || cert.values}
            drafts={viewing === null ? drafts : {}}
            catalogueOptions={options}
            fallbackFonts={cert.fallbackFonts}
            editable={editable}
            onChange={onChange}
            onRevert={onRevert}
            onReset={resetField}
            versions={versions}
          />
        </div>
      )}

      {showVersions && (
        <VersionsDrawer
          versions={versions}
          currentVersion={cert.currentVersion}
          viewing={viewing}
          canRestore={canEdit && cert.status === "draft" && !dirty}
          onView={setViewing}
          onRestore={restore}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
