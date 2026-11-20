import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { entityRoute, isArabic } from "../../utils/assistantContext";

// One message of the assistant page (E1): user bubble, or the steps the
// assistant took + its answer (markdown: entity links, tables with Copy / CSV).

function EntityLink({ href, children }) {
  const hit = /^entity:([a-z_]+)\/([0-9a-fA-F-]{36})$/.exec(href || "");
  const to = hit && entityRoute(hit[1], hit[2]);
  if (!to) return <span>{children}</span>; // the server already turned other links into text; never render one
  return (
    <Link to={to} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
      {children}
    </Link>
  );
}

const cellText = (el) => el.innerText.replace(/\s+/g, " ").trim();
const tableRows = (table) => [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map(cellText));
const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");

function AnswerTable({ children }) {
  const ref = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tableRows(ref.current).map((r) => r.join("\t")).join("\n"));
      toast.success("Table copied");
    } catch (e) {
      toast.error(`Couldn't copy: ${e.message}`);
    }
  };
  const download = () => {
    const blob = new Blob(["﻿" + csv(tableRows(ref.current))], { type: "text/csv;charset=utf-8" }); // BOM: Excel reads Arabic as UTF-8
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `assistant-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="my-2" data-testid="answer-table">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table ref={ref} className="w-full border-collapse text-[13px] [&_td]:border-b [&_td]:border-gray-100 [&_td]:px-3.5 [&_td]:py-3 [&_th]:border-b [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-600 [&_th]:whitespace-nowrap [&_th]:text-start">
          {children}
        </table>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <button type="button" onClick={copy} data-testid="copy-table" className="min-h-8 rounded-xl border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Copy table</button>
        <button type="button" onClick={download} data-testid="download-csv" className="min-h-8 rounded-xl border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Download CSV</button>
      </div>
    </div>
  );
}

/** "✓ Read the invoice · INV-1" — expands to its args and a short result. */
export function StepChip({ step }) {
  const [open, setOpen] = useState(false);
  const failed = step.ok === false;
  const mark = step.running ? null : failed ? "✕" : "✓";
  return (
    <div className="inline-flex max-w-full flex-col">
      <button
        type="button"
        data-testid="step-chip"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${failed ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-100 text-gray-700"}`}
      >
        {step.running ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <span aria-hidden="true">{mark}</span>}
        <span className="truncate">
          {step.label || step.name}
          {step.summary ? ` · ${step.summary}` : ""}
        </span>
      </button>
      {open && (
        <pre dir="ltr" className="mt-1 max-h-48 max-w-xl overflow-auto whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-700">
          {`${step.name}(${JSON.stringify(step.args || {}, null, 2)})`}
          {step.summary ? `\n→ ${step.summary}` : ""}
          {step.error && step.error !== step.summary ? `\n${step.error}` : ""}
          {step.ms !== undefined ? `\n${step.ms} ms` : ""}
        </pre>
      )}
    </div>
  );
}

export function Steps({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="steps">
      {steps.map((s, i) => (
        <StepChip key={i} step={s} />
      ))}
    </div>
  );
}

export default function AssistantMessage({ m, onChoose, latest }) {
  if (m.role === "user") {
    return (
      <div dir="auto" className={`max-w-[85%] self-end whitespace-pre-wrap rounded-[14px_14px_4px_14px] bg-blue-600 px-3 py-2 text-sm leading-relaxed text-white ${isArabic(m.text) ? "font-arabic" : ""}`}>
        {m.text}
      </div>
    );
  }
  const choices = latest ? (m.toolCalls || []).findLast((c) => c.choices?.length)?.choices : null;
  return (
    <>
      <Steps steps={m.toolCalls} />
      {m.text && (
        <div dir="auto" data-testid="assistant-answer" className={`self-stretch text-sm leading-relaxed text-gray-900 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5 ${isArabic(m.text) ? "font-arabic" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(u) => u} components={{ a: EntityLink, table: AnswerTable }}>
            {m.text}
          </ReactMarkdown>
        </div>
      )}
      {choices && (
        <div className="flex flex-wrap gap-1.5" data-testid="choices">
          {choices.map((c) => (
            <button key={c.id} type="button" onClick={() => onChoose(c)} className="min-h-8 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100" dir="auto">
              {c.name}
              {c.productCode ? ` · ${c.productCode}` : ""}
              {c.company ? ` · ${c.company}` : ""}
            </button>
          ))}
        </div>
      )}
      {m.error && (
        <div role="alert" dir="auto" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {m.error}
        </div>
      )}
    </>
  );
}
