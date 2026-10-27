import { useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import { Wrench, X } from "lucide-react";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import useTaskProgress from "../../hooks/useTaskProgress";
import { getRepairPlan, startRepair } from "../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../utils/certificateErrors";

// "Fix this template" (backend item 2): one checklist of what the scan found —
// the constituent rows as one repeating list, unnamed fields, fixed text that
// changes per product or batch, and fixed RESULT text the owner decides row by
// row (never decided for them). Apply → a new version: re-converted when a list
// is added, the ticked changes applied, prepare re-run. The gate is shown on
// that version before anyone activates it.

const STR = {
  title: "Fix this template",
  scanning: "Reading the design…",
  intro: "Tick what to change. Nothing changes on this version: a new version is made, prepared, and you activate it after checking the gate.",
  group: "Constituents as one list",
  groupHint: (n, keys) => `Prints each product's own active ingredients (name ← ingredient, amount ← concentration) instead of ${n} fixed rows. Replaces the fields ${keys}.`,
  unnamed: "Unnamed fields",
  fixed: "Fixed text that changes per product or batch",
  fixedHint: "Each becomes a field with the suggested source. You can change any source afterwards in “Mark fields”.",
  results: "Fixed results — decide each row",
  resultsHint: "Printed the same on every certificate today. Nothing here changes unless you pick it.",
  choices: { keep_fixed: "Keep fixed", lab_result_field: "Lab-result field", show_specification: "Show the specification" },
  choiceHint: { keep_fixed: "printed as it is now", lab_result_field: "filled per batch (supplier COA / results grid)", show_specification: "prints the row's specification" },
  spec: "spec",
  ambiguous: (opts) => `Day/month order unclear — set it in Mark fields (${opts.join(" or ")}).`,
  decideAll: (n) => `Decide ${n} more result row${n === 1 ? "" : "s"} to continue`,
  apply: (n) => `Apply ${n} change${n === 1 ? "" : "s"} as a new version`,
  reconvert: "The design is converted again with a vector background (needed for the list).",
  working: "Making the new version",
  cancel: "Close",
  nothing: "Nothing to fix was found on this version.",
  origin: { memory: "remembered", rule: "rule", dictionary: "your data", specification: "specification", none: "no source" },
};

const sourceText = (s) => {
  if (!s) return "—";
  if (s.kind === "manual") return "typed / per batch";
  if (s.kind === "today") return "today's date";
  if (s.kind === "static") return `fixed “${s.text}”`;
  if (s.kind === "template") return s.template.replace(/\{\{\s*item\.batchNo\s*\}\}/, "‹batch no›");
  const root = { product: "Product", item: "Invoice line", invoice: "Invoice", company: "Company", brand: "Brand" }[s.kind] || s.kind;
  return `${root} › ${s.path.replace(/^specifications\.values\.?/, "spec ").replace(/[[\]"]/g, "")}`;
};

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
    </section>
  );
}

export default function RepairWizard({ scope, version, onClose, onDone }) {
  const titleId = useId();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [ticks, setTicks] = useState({});
  const [choices, setChoices] = useState({});
  const [started, setStarted] = useState(null);
  const [busy, setBusy] = useState(false);
  const task = useTaskProgress(started?.taskId, {
    onDone: (t) => {
      if (t.status === "completed") {
        toast.success(t.result?.passed ? `v${started.versionNumber} is ready — check the gate, then activate it` : `v${started.versionNumber} was made, but the gate did not pass — see its report`);
        onDone?.(started);
      } else toast.error(describeCertificateError(t.error) || "The repair failed");
    },
  });

  useEffect(() => {
    let live = true;
    getRepairPlan(scope, version.id)
      .then((p) => {
        if (!live) return;
        setPlan(p);
        setTicks(Object.fromEntries(p.items.filter((i) => i.kind !== "fixed_result").map((i) => [i.id, i.default !== false])));
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [scope, version.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && !started && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, started, onClose]);

  const items = plan?.items || [];
  const of = (kind) => items.filter((i) => i.kind === kind);
  const results = of("fixed_result");
  const undecided = results.filter((r) => !choices[r.id]).length;
  const decisions = [
    ...items.filter((i) => i.kind !== "fixed_result" && ticks[i.id]).map((i) => ({ id: i.id, apply: true })),
    ...results.filter((r) => choices[r.id]).map((r) => ({ id: r.id, choice: choices[r.id] })),
  ];
  const changes = decisions.filter((d) => d.apply || d.choice !== "keep_fixed").length;
  const groupTicked = of("constituent_group").some((g) => ticks[g.id]);

  const apply = async () => {
    setBusy(true);
    try {
      setStarted(await startRepair(scope, version.id, decisions));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const tick = (id) => (e) => setTicks((t) => ({ ...t, [id]: e.target.checked }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl" data-testid="repair-wizard">
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" aria-hidden="true" /> {STR.title} <span className="text-sm font-normal text-gray-500">· v{version.versionNumber}</span>
          </h2>
          {!started && (
            <button type="button" onClick={onClose} aria-label={STR.cancel} className="p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
          {!plan && !error && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Spinner size="sm" /> {STR.scanning}
            </div>
          )}
          {started && (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm font-semibold text-gray-900">
                {STR.working} v{started.versionNumber}
              </p>
              <div role="progressbar" aria-valuenow={Math.round(task.progress || 0)} aria-valuemin={0} aria-valuemax={100} aria-label={STR.working} className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.max(task.progress || 0, 5)}%` }} />
              </div>
              <p className="text-xs text-gray-600">{task.message || "Queued…"}</p>
            </div>
          )}
          {plan && !started && (
            <>
              <p className="text-sm text-gray-600">{STR.intro}</p>
              {!items.length && <p className="text-sm text-gray-700">{STR.nothing}</p>}
              {of("constituent_group").map((g) => (
                <Section key={g.id} title={STR.group}>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="w-4 h-4 mt-0.5" checked={!!ticks[g.id]} onChange={tick(g.id)} data-testid="repair-group" />
                    <span>
                      <span className="font-medium">{g.label}</span>
                      <span className="block text-xs text-gray-600">{STR.groupHint(g.rows.length, g.removes.join(", "))}</span>
                      <span className="block text-xs text-gray-500">Today: {g.rows.map((r) => `${r.name} ${r.amount}`).join(" · ")}</span>
                    </span>
                  </label>
                </Section>
              ))}
              {of("unnamed_field").length > 0 && (
                <Section title={STR.unnamed}>
                  <ul className="space-y-1">
                    {of("unnamed_field").map((u) => (
                      <li key={u.id} className="text-sm text-gray-700">
                        <code className="text-xs bg-gray-100 rounded px-1">{u.fieldKey}</code> prints “{u.sampleValue}”: {u.identifiedAs}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {of("fixed_to_field").length > 0 && (
                <Section title={STR.fixed} hint={STR.fixedHint}>
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {of("fixed_to_field").map((f) => (
                      <li key={f.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                        <input type="checkbox" className="w-4 h-4 mt-0.5" checked={!!ticks[f.id]} onChange={tick(f.id)} aria-label={`Make “${f.label}” a field`} />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{f.label}</span> <span className="text-gray-500">“{f.field.sampleValue}”</span>
                          <span className="block text-xs text-gray-600">
                            → {sourceText(f.suggestion?.source)}
                            {f.suggestion?.format?.date ? ` · ${f.suggestion.format.date}` : ""}
                            {f.suggestion?.isLabResult ? " · per batch" : ""}
                            <span className="ml-1 text-gray-400">({STR.origin[f.suggestion?.origin] || f.suggestion?.origin})</span>
                          </span>
                          {f.suggestion?.ambiguousDate && <span className="block text-xs text-amber-800">{STR.ambiguous(f.suggestion.ambiguousDate)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {results.length > 0 && (
                <Section title={STR.results} hint={STR.resultsHint}>
                  <ul className="space-y-2">
                    {results.map((r) => (
                      <li key={r.id} className="border border-gray-200 rounded-lg px-3 py-2">
                        <p className="text-sm">
                          <span className="font-medium text-gray-900">{r.rowLabel}</span> <span className="text-gray-700">“{r.text}”</span>
                          {r.spec && (
                            <span className="text-xs text-gray-500">
                              {" "}
                              · {STR.spec} “{r.spec.text}”
                            </span>
                          )}
                        </p>
                        <fieldset className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <legend className="sr-only">What to do with “{r.text}” in the {r.rowLabel} row</legend>
                          {r.choices.map((c) => (
                            <label key={c} className="flex items-center gap-1.5 text-xs text-gray-700" title={STR.choiceHint[c]}>
                              <input type="radio" name={r.id} value={c} checked={choices[r.id] === c} onChange={() => setChoices((x) => ({ ...x, [r.id]: c }))} />
                              {STR.choices[c]}
                            </label>
                          ))}
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        {plan && !started && (
          <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 max-w-md">{plan.needsSvg && groupTicked ? STR.reconvert : ""}</p>
            <div className="flex items-center gap-2">
              {undecided > 0 && <span className="text-xs text-amber-800">{STR.decideAll(undecided)}</span>}
              <Button variant="secondary" onClick={onClose}>
                {STR.cancel}
              </Button>
              <Button onClick={apply} isLoading={busy} disabled={!changes || undecided > 0} data-testid="repair-apply">
                {STR.apply(changes)}
              </Button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
