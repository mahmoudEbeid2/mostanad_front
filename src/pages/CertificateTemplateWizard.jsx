import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Check } from "lucide-react";
import Spinner from "../ui/Spinner";
import Button from "../ui/Button";
import CompanyPicker from "../components/certificates/CompanyPicker";
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
  newTitle: "Upload a certificate template",
  back: "Templates",
  steps: { upload: "Upload", fields: "Mark fields", settings: "Settings", prepare: "Prepare & test", activate: "Activate" },
  converting: "Converting the design…",
  convertFailed: "Conversion failed",
  tryAgain: "Upload a corrected file below as a new version.",
  converted: "Converted — this is exactly how the design will print.",
  next: "Next: mark the fields",
  version: "Version",
  pickCompany: "Pick a company first.",
  lines: (n) => `${n} text lines`,
};

const STEP_ORDER = ["upload", "fields", "settings", "prepare", "activate"];

function defaultStep(version) {
  if (!version) return "upload";
  if (["uploaded", "converting", "failed"].includes(version.status)) return "upload";
  if (version.status === "draft") return "fields";
  if (["preparing", "ready"].includes(version.status)) return "prepare";
  return "activate";
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

  const loadVersion = useCallback(async () => {
    if (!scope || !templateId) return;
    try {
      const t = await getTemplate(scope, templateId);
      setTemplate(t);
      if (!versionId) {
        if (t.versions[0]) navigate(`/certificates/templates/${t.id}/versions/${t.versions[0].id}`, { replace: true });
        return;
      }
      setVersion(await getVersion(scope, versionId));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/certificates/templates" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {STR.back}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {template ? template.name : STR.newTitle}
            {version && (
              <span className="text-base font-normal text-gray-500">
                {STR.version} {version.versionNumber}
              </span>
            )}
            {version && <StatusBadge status={version.status} />}
          </h1>
        </div>
        {!templateId && <CompanyPicker scope={scopeState} />}
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEP_ORDER.map((s, i) => {
          const enabled = stepEnabled(s);
          const current = s === step;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => goStep(s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${current ? "border-blue-600 bg-blue-600 text-white" : i < reached ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-600"} disabled:opacity-40`}
              >
                {i < reached && !current ? <Check className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
                {STR.steps[s]}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <div className="space-y-6">
          {converting && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
              <Spinner size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{task.message || STR.converting}</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded">
                  <div className="h-1.5 bg-blue-600 rounded transition-all" style={{ width: `${Math.max(5, task.progress || 0)}%` }} />
                </div>
              </div>
            </div>
          )}
          {version?.status === "failed" && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
              <p className="font-semibold">{STR.convertFailed}</p>
              <p>{describeCertificateError(version.error)}</p>
              <p className="text-red-700 mt-1">{STR.tryAgain}</p>
            </div>
          )}
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
                companyId={companyId}
                types={types}
                onTypesChanged={loadTypes}
                onUploaded={onUploaded}
                existingTemplate={template}
                initialTypeId={params.get("certificateTypeId")}
              />
            )
          )}
        </div>
      )}

      {step === "fields" && version && stepEnabled("fields") && (
        <FieldsStep key={version.id} scope={scope} version={version} onSaved={loadVersion} onNext={() => goStep("settings")} />
      )}
      {step === "settings" && version && template && stepEnabled("settings") && (
        <SettingsStep key={template.updatedAt} scope={scope} companyId={companyId} template={template} version={version} types={types} onSaved={loadVersion} onNext={() => goStep("prepare")} />
      )}
      {step === "prepare" && version && stepEnabled("prepare") && <PrepareStep scope={scope} version={version} onChanged={loadVersion} goStep={goStep} />}
      {step === "activate" && version && template && stepEnabled("activate") && (
        <ActivateStep scope={scope} template={template} version={version} onChanged={loadVersion} goStep={goStep} />
      )}
    </div>
  );
}
