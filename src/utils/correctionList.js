import { localizedText } from "./localizedText";
import { fmtDateTime, t } from "../i18n";

const STATUS_LABEL = {
  FAIL: t("correctionList.mustFix"),
  NEEDS_CONFIRMATION: t("correctionList.confirm"),
  NEEDS_REVIEW: t("correctionList.worthALook"),
  WARN: t("correctionList.worthALook"),
};

const WHY_SOURCE_LABEL = {
  regulation: t("correctionList.regulation"),
  your_data: t("correctionList.yourData"),
  structure: t("correctionList.structure"),
  plausibility: t("correctionList.plausibilityUnverified"),
};

function fixLine(v) {
  const r = v.remediation;
  if (!r || r.source === "none" || !r.source) return "No sourced fix available.";
  const parts = [];
  if (r.suggested) parts.push(t("correctionList.suggested", { suggested: r.suggested }));
  else if (r.action) parts.push(t("correctionList.suggestedAction", { action: r.action }));
  if (r.source === "common_practice") parts.push("(Common practice — not a verified source. Check this before you print.)");
  else if (r.source === "reference") parts.push(t("correctionList.fromAnApprovedReferenceCheck"));
  return parts.join(" ") || "No sourced fix available.";
}

// Builds the plain-text correction sheet handed to whoever makes the artwork —
// this is the primary output of the Check a Label screen, not an in-app edit.
export function buildCorrectionListText({ verdicts = [], productName, country, unverifiable = [] } = {}) {
  const findings = verdicts.filter((v) => ["FAIL", "NEEDS_CONFIRMATION", "WARN", "NEEDS_REVIEW"].includes(v.status));

  const lines = [];
  lines.push(t("correctionList.correctionList", { v: productName ? ` — ${productName}` : "" }));
  if (country) lines.push(t("correctionList.targetCountry", { country }));
  lines.push(t("correctionList.generated", { date: fmtDateTime(new Date()) }));
  lines.push("");

  if (findings.length === 0) {
    lines.push("Nothing to fix.");
  } else {
    findings.forEach((v, idx) => {
      const label = v.label?.en || localizedText(v.label) || v.path;
      lines.push(`${idx + 1}. ${label} [${STATUS_LABEL[v.status] || v.status}]`);
      lines.push(`   ${t("correctionList.what", { v: v.message || t("correctionList.seeReport") })}`);
      if (v.triggeredBy) lines.push(`   Why: ${v.triggeredBy}`);
      if (v.observed != null || v.expected != null) {
        lines.push(`   ${t("correctionList.labelSays", { observed: v.observed ?? t("correctionList.empty"), expected: v.expected ?? t("correctionList.empty") })}`);
      }
      lines.push(t("correctionList.fix", { v: fixLine(v) }));
      lines.push(`   ${t("correctionList.sourceType", { v: WHY_SOURCE_LABEL[v.whySource] || v.whySource || "—" })}`);
      if (v.citation) lines.push(`   Citation: "${v.citation}"`);
      lines.push("");
    });
  }

  if (unverifiable.length > 0) {
    lines.push("COULD NOT CHECK:");
    unverifiable.forEach((v) => {
      lines.push(`- ${v.message || v.label?.en || v.path}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadCorrectionList(text, filename = "correction-list.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
