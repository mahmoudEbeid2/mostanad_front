import { localizedText } from "./localizedText";

const STATUS_LABEL = {
  FAIL: "MUST FIX",
  NEEDS_CONFIRMATION: "CONFIRM",
  NEEDS_REVIEW: "WORTH A LOOK",
  WARN: "WORTH A LOOK",
};

const WHY_SOURCE_LABEL = {
  regulation: "Regulation",
  your_data: "Your data",
  structure: "Structure",
  plausibility: "Plausibility (unverified)",
};

function fixLine(v) {
  const r = v.remediation;
  if (!r || r.source === "none" || !r.source) return "No sourced fix available.";
  const parts = [];
  if (r.suggested) parts.push(`Suggested: "${r.suggested}"`);
  else if (r.action) parts.push(`Suggested action: ${r.action}`);
  if (r.source === "common_practice") parts.push("(Common practice — not a verified source. Check this before you print.)");
  else if (r.source === "reference") parts.push("(From an approved reference — check it applies here.)");
  return parts.join(" ") || "No sourced fix available.";
}

// Builds the plain-text correction sheet handed to whoever makes the artwork —
// this is the primary output of the Check a Label screen, not an in-app edit.
export function buildCorrectionListText({ verdicts = [], productName, country, unverifiable = [] } = {}) {
  const findings = verdicts.filter((v) => ["FAIL", "NEEDS_CONFIRMATION", "WARN", "NEEDS_REVIEW"].includes(v.status));

  const lines = [];
  lines.push(`CORRECTION LIST${productName ? ` — ${productName}` : ""}`);
  if (country) lines.push(`Target country: ${country}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (findings.length === 0) {
    lines.push("Nothing to fix.");
  } else {
    findings.forEach((v, idx) => {
      const label = v.label?.en || localizedText(v.label) || v.path;
      lines.push(`${idx + 1}. ${label} [${STATUS_LABEL[v.status] || v.status}]`);
      lines.push(`   What: ${v.message || "(see report)"}`);
      if (v.triggeredBy) lines.push(`   Why: ${v.triggeredBy}`);
      if (v.observed != null || v.expected != null) {
        lines.push(`   Label says: "${v.observed ?? "(empty)"}" — Your records say: "${v.expected ?? "(empty)"}"`);
      }
      lines.push(`   Fix: ${fixLine(v)}`);
      lines.push(`   Source type: ${WHY_SOURCE_LABEL[v.whySource] || v.whySource || "unknown"}`);
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
