import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2, CopyPlus, FileText, ShieldCheck } from "lucide-react";
import Button from "../../../ui/Button";
import { activateVersion, confirmFields, newVersionFrom } from "../../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../../utils/certificateErrors";

// Wizard step 5 — activate (plan §8.4, §13.4, D10). Lists exactly what
// changes; refuses while any field is unconfirmed (the server enforces it too).

const STR = {
  title: "Activate this version",
  becomes: (n, t) => `Version ${n} becomes the design used for every new “${t}” certificate.`,
  supersedes: (n) => `Version ${n} (active now) will be superseded. Certificates already generated keep the exact design they used.`,
  unconfirmedTitle: "These fields were suggested, or their “Value comes from” was suggested by AI. Confirm each one before activating:",
  aiMapping: "AI mapping",
  confirmAll: "Confirm all",
  replaces: "Activating replaces",
  inSlot: "in this slot.",
  noActive: "no active version",
  activate: (n) => `Activate v${n}`,
  activated: "Version activated",
  isActive: "This version is active.",
  isSuperseded: "This version was replaced by a newer one. It stays readable; certificates that used it are unaffected.",
  notReady: "Prepare this version and pass the gate first.",
  generate: "Generate certificates from an invoice",
  backToList: "Back to templates",
  newVersion: "New version from this one",
};

export default function ActivateStep({ scope, template, version, onChanged, goStep }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  // D10 + AI plan §5.1: a suggested field, or an AI mapping nobody confirmed yet
  const unconfirmed = (version.fields || []).filter((f) => !f.confirmed || f.mappingConfirmed === false);
  const current = template.versions?.find((v) => v.id === template.activeVersionId);

  const confirmAll = async () => {
    try {
      await confirmFields(scope, version.id, unconfirmed.map((f) => f.key));
      onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    }
  };
  const activate = async () => {
    setBusy(true);
    try {
      await activateVersion(scope, version.id);
      toast.success(STR.activated);
      onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setBusy(false);
    }
  };
  const fork = async () => {
    try {
      const res = await newVersionFrom(scope, version.id);
      navigate(`/certificates/templates/${res.templateId}/versions/${res.versionId}?step=fields`);
    } catch (err) {
      toast.error(describeCertificateError(err));
    }
  };

  if (version.status === "active" || version.status === "superseded") {
    return (
      <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6 space-y-4" data-testid="activate-done">
        <p className="flex items-center gap-2 font-semibold text-gray-900">
          <CheckCircle2 className={`w-5 h-5 ${version.status === "active" ? "text-emerald-600" : "text-gray-400"}`} />
          {version.status === "active" ? STR.isActive : STR.isSuperseded}
        </p>
        <div className="flex flex-wrap gap-2">
          {version.status === "active" && (
            <Link to="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
              <FileText className="w-4 h-4" /> {STR.generate}
            </Link>
          )}
          <Button variant="secondary" onClick={fork}>
            <CopyPlus className="w-4 h-4" /> {STR.newVersion}
          </Button>
          <Link to="/certificates/templates" className="inline-flex items-center px-4 py-2.5 rounded-xl text-gray-700 hover:bg-gray-100">
            {STR.backToList}
          </Link>
        </div>
      </div>
    );
  }

  if (version.status !== "ready") {
    return (
      <div className="text-sm text-gray-600">
        {STR.notReady}{" "}
        <button type="button" className="text-blue-600 underline" onClick={() => goStep("prepare")}>
          Prepare & test
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-blue-600" /> {STR.title}
      </h3>
      <ul className="text-sm text-gray-700 list-disc ml-5 space-y-1">
        <li>{STR.becomes(version.versionNumber, template.name)}</li>
        {current && current.id !== version.id && <li>{STR.supersedes(current.versionNumber)}</li>}
      </ul>
      {unconfirmed.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 space-y-2" data-testid="unconfirmed">
          <p>{STR.unconfirmedTitle}</p>
          <ul className="list-disc ml-5">
            {unconfirmed.map((f) => (
              <li key={f.key}>
                {f.label} — <span className="font-mono">{f.sampleValue}</span>
                {f.mappingConfirmed === false && <span className="ml-1 text-xs text-amber-800">({STR.aiMapping})</span>}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={confirmAll}>
            {STR.confirmAll}
          </Button>
        </div>
      )}
      <p className="text-xs text-gray-600">
        {STR.replaces} <b>{current && current.id !== version.id ? `v${current.versionNumber}` : STR.noActive}</b> {STR.inSlot}
      </p>
      <Button onClick={activate} isLoading={busy} disabled={unconfirmed.length > 0} className="!bg-emerald-700 hover:!bg-emerald-800 !shadow-none">
        {STR.activate(version.versionNumber)}
      </Button>
    </div>
  );
}
