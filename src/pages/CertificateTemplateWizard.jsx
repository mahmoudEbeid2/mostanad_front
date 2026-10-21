import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Loader2 } from "lucide-react";
import Spinner from "../ui/Spinner";
import Button from "../ui/Button";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import StatusBadge from "../components/certificates/StatusBadge";
import DocumentFrame from "../components/certificates/DocumentFrame";
import UploadStep from "../components/certificates/wizard/UploadStep";
import FieldsStep from "../components/certificates/wizard/FieldsStep";
import SettingsStep from "../components/certificates/wizard/SettingsStep";
import PrepareStep from "../components/certificates/wizard/PrepareStep";
import ActivateStep from "../components/certificates/wizard/ActivateStep";
import { describeCertificateError } from "../utils/certificateErrors";
import useCompanyScope from "../hooks/useCompanyScope";
import useTaskProgress from "../hooks/useTaskProgress";
import { listCertificateTypes } from "../services/apiCertificateTypes";
import { getTemplate, getVersion, getVersionHtml } from "../services/apiCertificateTemplates";

const STR = {
  newTitle: "New certificate template",
  back: "← Templates",
  steps: { upload: "Upload", fields: "Mark fields", settings: "Settings", prepare: "Prepare & test", activate: "Activate" },
  convertingStep: "converting…",
  stageState: { done: "done", active: "in progress", pending: "not started" },
  // A3 — converting
  converting: "Converting your design",
  convertingHint: "Usually under 10 seconds. You can leave — we’ll keep going.",
  stages: (html) => [
    "File uploaded",
    html ? "HTML design read" : "Converted to HTML (pdf2htmlEX)",
    "Cleaned — scripts and external links removed",
    "Measuring text lines and fonts",
    "Creating thumbnail",
  ],
  previewTitle: "Preview",
  previewHint: "The thumbnail appears when conversion finishes.",
  failedTitle: { NO_PDF_CONTENT: "This file has no PDF content", NO_LIVE_TEXT: "The text was converted to outlines" },
  convertFailed: "Conversion failed",
  uploadNew: "Upload a new file",
  converted: "Converted — this is exactly how the design will print.",
  next: "Next: mark the fields",
  pickCompany: "Pick a company first.",
  lines: (n) => `${n} text lines`,
  saving: "Saving…",
  saved: "All changes saved",
  notSaved: "Not saved",
};

const STEP_ORDER = ["upload", "fields", "settings", "prepare", "activate"];
const FILE_INPUT_ID = "template-file";

function defaultStep(version) {
  if (!version) return "upload";
  if (["uploaded", "converting", "failed"].includes(version.status)) return "upload";
  if (version.status === "draft") return "fields";
  if (["preparing", "ready"].includes(version.status)) return "prepare";
  return "activate";
}

// convert job progress (templateService.convertVersion): 15 converting, 45 sanitizing, 65 analysing, 85 thumbnail
const stageOf = (progress) => (progress >= 85 ? 4 : progress >= 65 ? 3 : progress >= 45 ? 2 : 1);

function ConvertingCard({ task, version }) {
  const progress = Math.round(task.progress || 0);
  const stage = stageOf(progress);
  const stages = STR.stages(version.sourceFormat === "html");
  return (
    <div className="flex flex-wrap gap-5 items-stretch">
      <section className="flex-[3_1_420px] min-w-0 bg-white border border-gray-200 rounded-xl p-7 space-y-5" data-testid="converting">
        <div className="flex items-center gap-4">
          <Spinner />
          <div>
            <h2 className="text-lg font-bold text-gray-900">{STR.converting}</h2>
            <p className="text-sm text-gray-600 mt-1">{STR.convertingHint}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[13px] text-gray-600 mb-2">
            <span aria-live="polite">{stages[stage]}</span>
            <span className="tabular-nums font-semibold text-gray-900">{progress} %</span>
          </div>
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={STR.converting} className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.max(progress, 5)}%` }} />
          </div>
        </div>
        <ol className="space-y-1">
          {stages.map((label, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${active ? "bg-blue-50" : ""}`}>
                <span
                  aria-hidden="true"
                  className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
                    done ? "bg-emerald-700 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`flex-1 text-sm ${active ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
                  {label}
                  <span className="sr-only"> — {done ? STR.stageState.done : active ? STR.stageState.active : STR.stageState.pending}</span>
                </span>
                {active && (
                  <span aria-hidden="true" className="text-xs text-gray-500">
                    …
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <aside className="flex-[2_1_300px] min-w-0">
        <div className="bg-white border border-gray-200 rounded-xl p-[18px] space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{STR.previewTitle}</h3>
          <div className="bg-gray-100 rounded-lg p-[18px] flex justify-center">
            <div aria-hidden="true" className="w-[150px] h-[210px] bg-white shadow p-3 flex flex-col gap-2 animate-pulse">
              <div className="h-3 w-2/5 bg-gray-200 rounded" />
              <div className="h-1.5 w-3/4 bg-gray-200 rounded mx-auto my-1.5" />
              <div className="h-1 bg-gray-200 rounded" />
              <div className="h-1 w-4/5 bg-gray-200 rounded" />
              <div className="h-1 w-3/5 bg-gray-200 rounded" />
              <div className="h-2.5 bg-gray-200 rounded mt-1.5" />
              <div className="h-1 bg-gray-200 rounded" />
              <div className="h-1 bg-gray-200 rounded" />
            </div>
          </div>
          <p className="text-xs text-gray-500">{STR.previewHint}</p>
        </div>
      </aside>
    </div>
  );
}

// the label opens UploadStep's file input below (same id) — a new version of this template
function FailureCard({ error }) {
  const code = typeof error === "string" ? error.split(":")[0] : error?.code;
  const human = describeCertificateError(error);
  return (
    <section className="bg-red-50 border border-red-300 rounded-xl p-[18px] space-y-2.5" data-testid="convert-failed">
      <h3 className="text-[15px] font-bold text-red-800">{STR.failedTitle[code] || STR.convertFailed}</h3>
      <p className="text-[13px] text-red-900">{human}</p>
      {typeof error === "string" && human !== error && <p className="text-xs text-red-700 break-words">{error}</p>}
      <label htmlFor={FILE_INPUT_ID} className="inline-flex items-center px-4 py-2.5 rounded-xl border border-red-300 bg-white text-sm font-semibold text-red-800 cursor-pointer hover:bg-red-100">
        {STR.uploadNew}
      </label>
    </section>
  );
}

function SaveState({ state }) {
  return (
    <span role="status" aria-live="polite" className="text-[13px] flex items-center gap-1.5" data-testid="save-state">
      {["saving", "pending"].includes(state) && (
        <>
          <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin text-gray-500" /> {STR.saving}
        </>
      )}
      {state === "saved" && (
        <span className="text-emerald-700 flex items-center gap-1.5">
          <Check aria-hidden="true" className="w-3.5 h-3.5" /> {STR.saved}
        </span>
      )}
      {["invalid", "error"].includes(state) && <span className="text-red-700">{STR.notSaved}</span>}
    </span>
  );
}

export default function CertificateTemplateWizard() {
  const { templateId, versionId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const scopeState = useCompanyScope();
  const { scope, companyId } = scopeState;

  const [types, setTypes] = useState(null);
  const [template, setTemplate] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(!!templateId);
  const [saveState, setSaveState] = useState(null); // step 2 autosave state, shown in the header
  const taskId = params.get("task");
  const task = useTaskProgress(taskId);

  const loadTypes = useCallback(async () => {
    if (!scope) return;
    try {
      setTypes(await listCertificateTypes(scope));
    } catch (err) {
      toast.error(err.message);
    }
  }, [scope]);

  // loads overlap (a new version id + its convert task finishing): only the
  // newest may set state, or a slow older response puts back a stale
  // "converting" (or the previous version) after the task is already done
  const loadSeq = useRef(0);
  const loadVersion = useCallback(async () => {
    if (!scope || !templateId) return;
    const seq = ++loadSeq.current;
    try {
      const t = await getTemplate(scope, templateId);
      if (seq !== loadSeq.current) return;
      setTemplate(t);
      if (!versionId) {
        if (t.versions[0]) navigate(`/certificates/templates/${t.id}/versions/${t.versions[0].id}`, { replace: true });
        return;
      }
      const v = await getVersion(scope, versionId);
      if (seq === loadSeq.current) setVersion(v);
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [scope, templateId, versionId, navigate]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);
  useEffect(() => {
    loadVersion();
  }, [loadVersion]);

  // reload once the convert task finishes; poll the version while it converts without a task id
  useEffect(() => {
    if (task.done) loadVersion();
  }, [task.done, loadVersion]);
  useEffect(() => {
    if (taskId || version?.status !== "converting") return undefined;
    const t = setTimeout(loadVersion, 2000);
    return () => clearTimeout(t);
  }, [taskId, version, loadVersion]);

  const step = params.get("step") || defaultStep(version);
  const goStep = (s) => {
    const next = new URLSearchParams(params);
    next.set("step", s);
    next.delete("task");
    setParams(next);
  };

  const onUploaded = ({ templateId: tid, versionId: vid, taskId: tk }) => navigate(`/certificates/templates/${tid}/versions/${vid}?step=upload&task=${tk}`);

  if (!scope) {
    return (
      <div className="space-y-4">
        <RoleBanner scope={scopeState} />
        <CompanyPicker scope={scopeState} />
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const reached = version ? STEP_ORDER.indexOf(defaultStep(version)) : 0;
  const converting = version && ["uploaded", "converting"].includes(version.status);
  // fields / settings / prepare open once the design is converted; activate once prepared
  const stepEnabled = (s) =>
    s === "upload" ||
    (!!version && !converting && version.status !== "failed" && (s !== "activate" || ["ready", "active", "superseded"].includes(version.status)));
  const fieldsEditable = step === "fields" && version?.status === "draft";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/certificates/templates" className="text-[13px] font-medium text-blue-600 hover:underline">
            {STR.back}
          </Link>
          <h1 className="mt-1.5 text-[22px] font-bold text-gray-900">
            {template ? template.name : STR.newTitle}
            {version && <span className="ml-1 text-base font-medium text-gray-500">· v{version.versionNumber}</span>}
          </h1>
        </div>
        {version && (
          <div className="flex items-center gap-3">
            <StatusBadge status={version.status} />
            {fieldsEditable && saveState && <SaveState state={saveState} />}
          </div>
        )}
      </div>

      <RoleBanner scope={scopeState} />

      <ol aria-label="Steps" className="flex flex-wrap gap-2">
        {STEP_ORDER.map((s, i) => {
          const enabled = stepEnabled(s);
          const current = s === step;
          const done = i < reached && !current;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!enabled}
                aria-current={current ? "step" : undefined}
                onClick={() => goStep(s)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border ${
                  current ? "border-blue-600 bg-blue-600 text-white" : done ? "border-emerald-50 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {done && <Check aria-hidden="true" className="w-3.5 h-3.5" />}
                {i + 1} {STR.steps[s]}
                {done && <span className="sr-only"> — {STR.stageState.done}</span>}
                {s === "upload" && converting && ` · ${STR.convertingStep}`}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <div className="space-y-5">
          {converting && <ConvertingCard task={task} version={version} />}
          {version?.status === "failed" && <FailureCard error={version.error} />}
          {version && !converting && version.status !== "failed" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-emerald-700 flex items-center gap-2">
                  <Check className="w-4 h-4" /> {STR.converted} <span className="text-gray-500">({STR.lines(version.lines?.length || 0)})</span>
                </p>
                <Button onClick={() => goStep("fields")}>{STR.next}</Button>
              </div>
              <DocumentFrame load={() => getVersionHtml(scope, version.id, "sanitized")} reloadKey={version.id} minHeight={640} />
            </div>
          ) : (
            !converting && (
              <UploadStep
                scope={scope}
                scopeState={scopeState}
                companyId={companyId}
                types={types}
                onTypesChanged={loadTypes}
                onUploaded={onUploaded}
                existingTemplate={template}
                initialTypeId={params.get("certificateTypeId")}
                inputId={FILE_INPUT_ID}
              />
            )
          )}
        </div>
      )}

      {step === "fields" && version && stepEnabled("fields") && (
        <FieldsStep key={version.id} scope={scope} templateScope={template?.scope} version={version} onSaved={loadVersion} onNext={() => goStep("settings")} onBack={() => goStep("upload")} onSaveState={setSaveState} />
      )}
      {step === "settings" && version && template && stepEnabled("settings") && (
        <SettingsStep key={template.updatedAt} scope={scope} companyId={companyId} template={template} version={version} types={types} onSaved={loadVersion} onNext={() => goStep("prepare")} />
      )}
      {step === "prepare" && version && stepEnabled("prepare") && <PrepareStep scope={scope} template={template} version={version} onChanged={loadVersion} goStep={goStep} />}
      {step === "activate" && version && template && stepEnabled("activate") && (
        <ActivateStep scope={scope} template={template} version={version} onChanged={loadVersion} goStep={goStep} />
      )}
    </div>
  );
}
