import AiAction from "../ui/AiAction";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import CertificateDataFields from "../components/certificates/CertificateDataFields";
import useCompanyScope from "../hooks/useCompanyScope";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { addDictionarySynonym } from "../services/apiInvoices";
import { decideSynonym, getAiSettings, getAiStats, getAiStatus, getCompleteness, getDictionaryHealth, rebuildDictionary, suggestSynonyms, updateAiSettings } from "../services/apiCertificateAi";
import { withNextStep } from "../utils/aiReason";
import { fmtDateTime, fmtNum, fmtTime, t } from "../i18n";

// /certificate-ai — the certificate AI layers in one place (backend plan.md §8, §9; A4):
//   Quality   — evaluation dashboard: acceptance/edit rates, calibration, calls per template/invoice, cost
//   Products  — template-driven completeness + structured data entry
//   Dictionary — health report (low coverage, type conflicts, near duplicates → synonym), AI label synonyms
//   Settings  — the company's AI switches and auto-accept threshold
const TABS = [
  { key: "quality", label: t("certificateAi.quality") },
  { key: "products", label: t("certificateAi.productData") },
  { key: "dictionary", label: t("certificateAi.dictionaryHealth") },
  { key: "settings", label: t("certificateAi.settings") },
];
const KIND = { field_map: t("certificateAi.templateFieldMapping"), group_binding: t("certificateAi.repeatingGroups"), invoice_gap: t("certificateAi.invoiceGapFilling"), product_match: t("certificateAi.productMatching"), dictionary_synonym: t("certificateAi.dictionarySynonyms"), field_label: t("certificateAi.fieldLabels") };
const RUN = { INVOICE_EXTRACT: t("certificateAi.invoiceReading"), CERT_FIELD_MAP: t("certificateAi.fieldMapping"), CERT_INVOICE_GAPS: t("certificateAi.gapFilling"), CERT_PRODUCT_MATCH: t("certificateAi.productMatching"), CERT_DICTIONARY: t("certificateAi.dictionarySynonyms"), CERT_ASSIST: t("certificateAi.suggestFields") };
const pct = (r) => (r === null || r === undefined ? "—" : `${Math.round(r * 100)} %`);
const usd = (n) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

function Tile({ label, value, note }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-gray-400">{note}</p>}
    </div>
  );
}

/** A single-series meter: the share as a bar (one hue), the number as text beside it. */
function Meter({ value }) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-28 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
        <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, value * 100)}%` }} />
      </span>
      <span className="tabular-nums text-gray-800">{pct(value)}</span>
    </span>
  );
}

const Th = ({ children, right }) => <th className={`px-3 py-2 font-semibold ${right ? "text-end" : "text-start"}`}>{children}</th>;
const Td = ({ children, right, className = "" }) => <td className={`px-3 py-2 ${right ? "text-end tabular-nums" : ""} ${className}`}>{children}</td>;
const Table = ({ head, children, testId }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
    <table className="w-full text-sm" data-testid={testId}>
      <thead className="bg-gray-50 text-xs text-gray-500">
        <tr>{head}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  </div>
);

function Quality({ scope }) {
  const [days, setDays] = useState(90);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setStats(null);
    getAiStats(scope, days)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [scope, days]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <Spinner />;
  const calls = stats.runs.reduce((a, r) => a + r.calls, 0); // requests that reached the provider
  const notSent = stats.runs.reduce((a, r) => a + (r.notSent || 0), 0);
  const decided = stats.kinds.reduce((a, k) => a + k.accepted + k.autoAccepted + k.edited + k.rejected, 0);
  const kept = stats.kinds.reduce((a, k) => a + k.accepted + k.autoAccepted, 0);
  const pending = stats.kinds.reduce((a, k) => a + k.pending, 0);
  const tplWeeks = stats.weekly.filter((w) => w.per === "template");
  const invWeeks = stats.weekly.filter((w) => w.per === "invoice");
  const maxPer = Math.max(1, ...stats.weekly.map((w) => w.callsPerEntity || 0));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="ai-days" className="text-gray-600">{t("certificateAi.period")}</label>
        <select id="ai-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>{t("certificateAi.lastDays", { d })}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-testid="ai-tiles">
        <Tile label={t("certificateAi.aiCalls")} value={calls} note={notSent ? t("certificateAi.notSentAiOffOr", { notSent }) : t("certificateAi.requestsSentToTheAi")} />
        <Tile label={t("certificateAi.answersKeptByPeople")} value={pct(decided ? kept / decided : null)} note={t("certificateAi.decided", { decided })} />
        <Tile label={t("certificateAi.waitingForAPerson")} value={pending} />
        <Tile label={t("certificateAi.estimatedCost")} value={usd(stats.cost.totalUsd)} note={stats.cost.unpricedAttempts ? t("certificateAi.callsWithoutAPriceNot", { unpricedAttempts: stats.cost.unpricedAttempts }) : t("certificateAi.pricedPerCallAtEach")} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.suggestionsByLayer")}</h2>
        <Table testId="ai-kinds" head={<><Th>{t("certificateAi.layer")}</Th><Th right>{t("certificateAi.total")}</Th><Th>{t("certificateAi.keptAcceptedAuto")}</Th><Th>{t("certificateAi.edited")}</Th><Th right>{t("certificateAi.rejected")}</Th><Th right>{t("certificateAi.refusedByCode")}</Th><Th right>{t("certificateAi.pending")}</Th><Th right>{t("certificateAi.avgConfidence")}</Th></>}>
          {stats.kinds.length === 0 && (
            <tr>
              <Td className="text-gray-500">{t("certificateAi.noAiSuggestionsInThis")}</Td>
            </tr>
          )}
          {stats.kinds.map((k) => (
            <tr key={k.kind}>
              <Td>{KIND[k.kind] || k.kind}</Td>
              <Td right>{k.total}</Td>
              <Td><Meter value={k.acceptanceRate} /></Td>
              <Td><Meter value={k.editRate} /></Td>
              <Td right>{k.rejected}</Td>
              <Td right>{k.refusedByCode}</Td>
              <Td right>{k.pending}</Td>
              <Td right>{k.avgConfidence ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.calibration")}</h2>
        <p className="text-xs text-gray-500">{t("certificateAi.howOftenPeopleKeptAn")}</p>
        <Table testId="ai-calibration" head={<><Th>{t("certificateAi.aiConfidence")}</Th><Th right>{t("certificateAi.decided2")}</Th><Th>{t("certificateAi.kept")}</Th></>}>
          {stats.calibration.map((b) => (
            <tr key={b.bucket}>
              <Td>{b.bucket}</Td>
              <Td right>{b.decided}</Td>
              <Td><Meter value={b.correctRate} /></Td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.aiCallsPerTemplateAnd")}</h2>
        <p className="text-xs text-gray-500">{t("certificateAi.shouldFallOverTimeAs")}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {[[t("certificateAi.perTemplate"), tplWeeks], [t("certificateAi.perInvoice"), invWeeks]].map(([title, rows]) => (
            <Table key={title} head={<><Th>{title}{" "}{t("certificateAi.weekOf")}</Th><Th right>{t("certificateAi.calls")}</Th><Th right>{t("certificateAi.items")}</Th><Th>{t("certificateAi.callsEach")}</Th></>}>
              {rows.length === 0 && (
                <tr>
                  <Td className="text-gray-500">{t("certificateAi.noCalls")}</Td>
                </tr>
              )}
              {rows.map((w) => (
                <tr key={w.week}>
                  <Td>{w.week}</Td>
                  <Td right>{w.calls}</Td>
                  <Td right>{w.entities}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-24 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                        <span className="block h-full rounded-full bg-blue-600" style={{ width: `${((w.callsPerEntity || 0) / maxPer) * 100}%` }} />
                      </span>
                      <span className="tabular-nums">{w.callsPerEntity ?? "—"}</span>
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.callsAndCostByModel")}</h2>
        <Table testId="ai-runs" head={<><Th>{t("certificateAi.task")}</Th><Th right>{t("certificateAi.calls")}</Th><Th right>{t("certificateAi.failed")}</Th><Th right>{t("certificateAi.turnedOff")}</Th><Th right>{t("certificateAi.inputTokens")}</Th><Th right>{t("certificateAi.outputThinking")}</Th><Th right>{t("certificateAi.avgTime")}</Th><Th right>{t("certificateAi.estCost")}</Th></>}>
          {stats.runs.map((r) => (
            <tr key={r.kind}>
              <Td>{RUN[r.kind] || r.kind}</Td>
              <Td right>{r.calls}</Td>
              <Td right>{r.failed || 0}</Td>
              <Td right>{r.disabled || 0}</Td>
              <Td right>{fmtNum(r.inputTokens)}</Td>
              <Td right>{fmtNum(r.outputTokens + r.thinkingTokens)}</Td>
              <Td right>{r.avgMs ? t("certificateAi.s", { toFixed: (r.avgMs / 1000).toFixed(1) }) : "—"}</Td>
              <Td right>{usd(r.costUsd)}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-[11px] text-gray-400">{t("certificateAi.costIsAnEstimateFrom")}</p>
      </section>
    </div>
  );
}

function Products({ scope }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => getCompleteness(scope).then(setData).catch((e) => setError(e.message)), [scope]);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile label={t("certificateAi.products")} value={data.totals.products} />
        <Tile label={t("certificateAi.completeForCertificates")} value={data.totals.complete} />
        <Tile label={t("certificateAi.missingSomething")} value={data.totals.incomplete} />
        <Tile label={t("certificateAi.valuesTemplatesRead")} value={data.totals.needs} />
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.whatYourActiveTemplatesNeed")}</h2>
        <Table testId="completeness-needs" head={<><Th>{t("certificateAi.value")}</Th><Th>{t("certificateAi.usedBy")}</Th><Th right>{t("certificateAi.productsMissingIt")}</Th><Th>{t("certificateAi.examples")}</Th></>}>
          {data.needs.length === 0 && (
            <tr>
              <Td className="text-gray-500">{t("certificateAi.noActiveTemplateReadsProduct")}</Td>
            </tr>
          )}
          {data.needs.map((n) => (
            <tr key={n.path}>
              <Td>
                {n.label}
                {n.kind === "list" && n.expected?.length > 0 && <span className="block text-[11px] text-gray-500">{t("certificateAi.needs")}{" "}{n.expected.join(", ")}</span>}
              </Td>
              <Td className="text-gray-600">{n.templates.join(", ")}</Td>
              <Td right className={n.missingCount ? "text-amber-800 font-semibold" : "text-emerald-700"}>{n.missingCount}</Td>
              <Td className="text-xs">
                {n.missing.slice(0, 4).map((p) => (
                  <Link key={p.id} to={`/products?edit=${p.id}`} className="me-2 text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                ))}
                {n.missingCount > 4 && <span className="text-gray-400">+{n.missingCount - 4}</span>}
              </Td>
            </tr>
          ))}
        </Table>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.productsToComplete")}</h2>
        <div className="space-y-2" data-testid="completeness-products">
          {data.products.length === 0 && <p className="text-sm text-emerald-700">{t("certificateAi.everyProductHasWhatThe")}</p>}
          {data.products.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white">
              <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-start text-sm">
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-amber-800">{p.missing.length}{" "}{t("certificateAi.missing")}</span>
                <span className="ms-auto text-xs text-gray-500 truncate max-w-[50%]">{p.missing.join(" · ")}</span>
              </button>
              {open === p.id && (
                <div className="border-t border-gray-100 p-4">
                  <CertificateDataFields scope={scope} productId={p.id} onSaved={load} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dictionary({ scope, canEdit }) {
  const [h, setH] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [edits, setEdits] = useState({});
  const load = useCallback(() => getDictionaryHealth(scope).then(setH).catch((e) => setError(e.message)), [scope]);
  useEffect(() => {
    load();
  }, [load]);
  const act = (name, fn, ok) => async () => {
    setBusy(name);
    try {
      const out = await fn();
      if (ok) toast.success(typeof ok === "function" ? ok(out) : ok);
    } catch (e) {
      toast.error(e.message);
    }
    setBusy(null);
    load();
  };
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!h) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-600">
          {h.dictionary.entries}{" "}{t("certificateAi.keysFromProductsBuilt", { productCount: h.dictionary.productCount, toLocaleString: fmtDateTime(h.dictionary.builtAt) })}</span>
        {canEdit && (
          <>
            <button type="button" disabled={!!busy} onClick={act("rebuild", () => rebuildDictionary(scope), t("certificateAi.dictionaryRebuilt"))} className={"text-blue-600 hover:underline"}>{t("certificateAi.rebuildNow")}</button>
            <AiAction><button type="button" disabled={!!busy} onClick={act("ai", () => suggestSynonyms(scope), (o) => (o.ai.unavailable ? withNextStep(o.ai.reason, t("certificateAi.addSynonymsByHand")) : t("certificateAi.suggestionSForKeyS", { suggested: o.suggested, asked: o.asked })))} className={"flex items-center gap-1 text-violet-700 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"}>
              <Sparkles className="w-3.5 h-3.5" /> {busy === "ai" ? t("certificateAi.asking") : t("certificateAi.suggestNamesForUnclearKeys")}
            </button></AiAction>
          </>
        )}
      </div>

      {h.synonymSuggestions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-gray-900">{t("certificateAi.aiNameSuggestionsNothingApplies")}</h2>
          <Table testId="synonym-suggestions" head={<><Th>{t("certificateAi.key")}</Th><Th>{t("certificateAi.suggestedNames")}</Th><Th>{t("certificateAi.why")}</Th><Th></Th></>}>
            {h.synonymSuggestions.map((s) => (
              <tr key={s.id}>
                <Td className="font-mono text-xs">{s.path.replace(/^product\./, "")}</Td>
                <Td>
                  <input value={edits[s.id] ?? s.synonyms.join(", ")} onChange={(e) => setEdits((x) => ({ ...x, [s.id]: e.target.value }))} disabled={!canEdit} aria-label={t("certificateAi.namesFor", { path: s.path })} className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                </Td>
                <Td className="text-xs text-gray-500">{s.rationale}</Td>
                <Td>
                  {canEdit && (
                    <span className="flex gap-2 text-xs">
                      <button type="button" onClick={act(s.id, () => decideSynonym(scope, s.id, { decision: "accept", synonyms: (edits[s.id] ?? s.synonyms.join(", ")).split(",").map((x) => x.trim()).filter(Boolean) }), t("certificateAi.namesAdded"))} className={"text-emerald-700 font-semibold hover:underline"}>{t("certificateAi.accept")}</button>
                      <button type="button" onClick={act(s.id, () => decideSynonym(scope, s.id, { decision: "reject" }))} className="text-red-600 hover:underline">{t("certificateAi.reject")}</button>
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">{t("certificateAi.keysThatLookLikeThe")}</h2>
        <p className="text-xs text-gray-500">{t("certificateAi.addingASynonymMakesCertificates")}</p>
        <Table testId="near-duplicates" head={<><Th>{t("certificateAi.key")}</Th><Th>{t("certificateAi.looksLike")}</Th><Th>{t("certificateAi.why")}</Th><Th></Th></>}>
          {h.nearDuplicates.length === 0 && (
            <tr>
              <Td className="text-gray-500">{t("certificateAi.noneFound")}</Td>
            </tr>
          )}
          {h.nearDuplicates.map((d) => (
            <tr key={`${d.canonical.path}|${d.alternative.path}`}>
              <Td>
                {d.canonical.label} <span className="text-xs text-gray-400">{pct(d.canonical.coverage)}</span>
              </Td>
              <Td>
                {d.alternative.label} <span className="text-xs text-gray-400">{pct(d.alternative.coverage)}</span>
              </Td>
              <Td className="text-xs text-gray-500">{d.reason}</Td>
              <Td className="text-xs">
                {d.alreadySynonym ? (
                  <span className="text-emerald-700">{t("certificateAi.synonym")}</span>
                ) : canEdit ? (
                  <button type="button" onClick={act(d.alternative.path, () => addDictionarySynonym(scope, d.action), t("certificateAi.synonymAdded"))} className={"text-blue-600 hover:underline"}>{t("certificateAi.addAsSynonym")}</button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-gray-900">{t("certificateAi.valuesStoredAsDifferentTypes")}</h2>
          <Table head={<><Th>{t("certificateAi.key")}</Th><Th>{t("certificateAi.typesSeen")}</Th></>}>
            {h.typeConflicts.length === 0 && (
              <tr>
                <Td className="text-gray-500">{t("certificateAi.none")}</Td>
              </tr>
            )}
            {h.typeConflicts.map((t) => (
              <tr key={t.path}>
                <Td>{t.label}</Td>
                <Td className="text-xs">{Object.entries(t.types).map(([k, v]) => `${k} ×${v}`).join(" · ")}</Td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-gray-900">{t("certificateAi.rareKeysUnder25Of")}</h2>
          <Table head={<><Th>{t("certificateAi.key")}</Th><Th right>{t("certificateAi.products")}</Th><Th>{t("certificateAi.templateNeedsIt")}</Th></>}>
            {h.lowCoverage.length === 0 && (
              <tr>
                <Td className="text-gray-500">{t("certificateAi.none")}</Td>
              </tr>
            )}
            {h.lowCoverage.map((e) => (
              <tr key={e.path}>
                <Td>{e.label}</Td>
                <Td right>{pct(e.coverage)}</Td>
                <Td>{e.neededByTemplates ? t("certificateAi.yes") : ""}</Td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
      {h.variants.length > 0 && (
        <p className="text-xs text-gray-500">{t("certificateAi.spellingsReadAsOneKey", { join: h.variants.map((v) => v.spellings.join(" / ")).join(" · ") })}</p>
      )}
    </div>
  );
}

const SWITCHES = [
  { key: "enabled", label: t("certificateAi.useAiForCertificates"), hint: t("certificateAi.offEverythingStillWorksBy") },
  { key: "allowInvoiceGapFill", label: t("certificateAi.findMissingValuesInInvoices"), hint: t("certificateAi.everyValueComesWithEvidence") },
  { key: "allowAiMatching", label: t("certificateAi.suggestProductMatches"), hint: t("certificateAi.onlyAmongTheCandidatesCode") },
  { key: "allowSynonyms", label: t("certificateAi.suggestNamesForUnclearProduct"), hint: t("certificateAi.appliedOnlyAfterYouAccept") },
  { key: "autoAccept", label: t("certificateAi.acceptConfidentAiAnswersAutomatically"), hint: t("certificateAi.offAPersonConfirmsEvery") },
  { key: "allowProductInference", label: t("certificateAi.inferMissingProductFactsFrom"), hint: t("certificateAi.quotedOrConvertedValuesAre") },
  { key: "allowWebLookup", label: t("certificateAi.lookUpMissingProductFacts"), hint: t("certificateAi.eachValueNeedsALink") },
  { key: "fillVerifiedDirectly", label: t("certificateAi.fillValuesProvenByA"), hint: t("certificateAi.theProductsDataTheInvoice") },
  { key: "rememberProductValues", label: t("certificateAi.keepACertificateProfilePer"), hint: t("certificateAi.provenAndConfirmedValuesAre") },
];
const LIMITS = [
  { key: "webLookupMaxProductsPerCheck", label: t("certificateAi.webLookupsPerCheckProducts"), min: 0, max: 100 },
  { key: "webLookupDailyLimit", label: t("certificateAi.webLookupsPerDayCompany"), min: 0, max: 1000 },
];

// Read-only: which model each AI task runs on (backend config AI_MODEL_DEFAULT /
// AI_MODEL_FALLBACK / AI_MODEL_<TASK>), its price, and any model the API has
// paused after repeated overloads.
const TASK_LABEL = (task) => task.toLowerCase().split("_").map((w, i) => (i ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
const price = (p) => (p ? t("certificateAi.inOutPer1mTokens", { inputPerMillion: p.inputPerMillion, outputPerMillion: p.outputPerMillion }) : t("certificateAi.priceNotSet"));
function AiModels() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getAiStatus()
      .then((d) => setM(d.models || null))
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!m) return null;
  return (
    <section className="max-w-3xl space-y-3" data-testid="ai-models">
      <h2 className="text-sm font-semibold text-gray-900">{t("certificateAi.aiModels")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label={t("certificateAi.defaultModelEveryTask")} value={<span className="text-base font-mono">{m.default.modelId}</span>} note={price(m.default.price)} />
        <Tile label={t("certificateAi.fallbackOnlyWhileTheDefault")} value={<span className="text-base font-mono">{m.fallback?.modelId || t("certificateAi.off")}</span>} note={m.fallback ? price(m.fallback.price) : t("certificateAi.noFallbackConfigured")} />
      </div>
      {m.paused?.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">{t("certificateAi.pausedAfterRepeatedOverloads")}{" "}{m.paused.map((p) => `${p.model} (until ${fmtTime(p.pausedUntil)})`).join(", ")}{t("certificateAi.callsGoToTheFallback")}</p>
      )}
      <Table testId="ai-models-tasks" head={<><Th>{t("certificateAi.task")}</Th><Th>{t("certificateAi.model")}</Th></>}>
        {m.tasks.map((it) => (
          <tr key={it.task}>
            <Td>{TASK_LABEL(it.task)}</Td>
            <Td className="font-mono text-xs">
              {it.modelId}
              {it.overridden && <span className="ms-2 rounded bg-blue-50 px-1.5 py-0.5 font-sans text-[11px] text-blue-700">{t("certificateAi.ownSetting")}</span>}
            </Td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-gray-500">{t("certificateAi.setOnTheServerNot", { maxAttempts: m.retry.maxAttempts, round: Math.round(m.retry.totalTimeMs / 1000), breakerThreshold: m.retry.breakerThreshold, round2: Math.round(m.retry.breakerPauseMs / 1000) })}</p>
    </section>
  );
}

function Settings({ scope, canEdit }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getAiSettings(scope).then(setS).catch((e) => setError(e.message));
  }, [scope]);
  const save = async (patch) => {
    try {
      setS(await updateAiSettings(scope, patch));
      toast.success(t("certificateAi.saved"));
    } catch (e) {
      toast.error(e.message);
    }
  };
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!s) return <Spinner />;
  return (
    <div className="max-w-xl space-y-3" data-testid="ai-settings">
      {SWITCHES.map((w) => (
        <label key={w.key} className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 ${w.key !== "enabled" && !s.enabled ? "opacity-50" : ""}`}>
          <input type="checkbox" className="mt-1" checked={!!s[w.key]} disabled={!canEdit || (w.key !== "enabled" && !s.enabled)} onChange={(e) => save({ [w.key]: e.target.checked })} />
          <span>
            <span className="block text-sm font-medium text-gray-900">{w.label}</span>
            <span className="block text-xs text-gray-500">{w.hint}</span>
          </span>
        </label>
      ))}
      <label className="block rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
        <span className="block font-medium text-gray-900">{t("certificateAi.alsoTrustTheseWebDomains")}</span>
        <span className="block text-xs text-gray-500">{t("certificateAi.manufacturerSitesAndOfficialRegistries")}</span>
        <textarea rows={3} defaultValue={(s.webDomainAllowList || []).join("\n")} key={(s.webDomainAllowList || []).join()} disabled={!canEdit || !s.allowWebLookup} onBlur={(e) => { const list = e.target.value.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean); if (list.join() !== (s.webDomainAllowList || []).join()) save({ webDomainAllowList: list }); }} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1 font-mono text-xs" aria-label={t("certificateAi.trustedWebDomains")} />
      </label>
      {LIMITS.map((l) => (
        <label key={l.key} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-gray-900">{l.label}</span>
          <input type="number" min={l.min} max={l.max} step={1} defaultValue={s[l.key]} key={s[l.key]} disabled={!canEdit || !s.allowWebLookup} onBlur={(e) => Number(e.target.value) !== s[l.key] && save({ [l.key]: Number(e.target.value) })} className="w-24 border border-gray-300 rounded-lg px-2 py-1" />
          <span className="text-xs text-gray-500">
            {l.min} – {l.max}
          </span>
        </label>
      ))}
      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
        <span className="font-medium text-gray-900">{t("certificateAi.autoAcceptThreshold")}</span>
        <input type="number" min={0.5} max={1} step={0.01} defaultValue={s.autoAcceptThreshold} key={s.autoAcceptThreshold} disabled={!canEdit || !s.autoAccept} onBlur={(e) => Number(e.target.value) !== s.autoAcceptThreshold && save({ autoAcceptThreshold: Number(e.target.value) })} className="w-24 border border-gray-300 rounded-lg px-2 py-1" />
        <span className="text-xs text-gray-500">0.50 – 1.00</span>
      </label>
    </div>
  );
}

export default function CertificateAi() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const { user } = useAuth();
  const canEdit = hasPermission(user, "update_certificate_templates");
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem("certificateAi.tab") || "quality";
    } catch {
      return "quality";
    }
  });
  const pick = (k) => {
    setTab(k);
    try {
      localStorage.setItem("certificateAi.tab", k);
    } catch {
      /* a remembered tab is a convenience only */
    }
  };
  const key = useMemo(() => JSON.stringify(scope || {}), [scope]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("certificateAi.certificateAi")}</h1>
          <p className="text-sm text-gray-500">{t("certificateAi.howTheAiLayersAre")}</p>
        </div>
        <CompanyPicker scope={scopeState} />
      </div>
      <RoleBanner scope={scopeState} />
      {!scope ? (
        <p className="text-sm text-gray-500">{t("certificateAi.pickACompanyFirst")}</p>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => pick(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div key={key}>
            {tab === "quality" && <Quality scope={scope} />}
            {tab === "products" && <Products scope={scope} />}
            {tab === "dictionary" && <Dictionary scope={scope} canEdit={canEdit} />}
            {tab === "settings" && (
              <div className="space-y-8">
                <Settings scope={scope} canEdit={canEdit} />
                <AiModels />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
