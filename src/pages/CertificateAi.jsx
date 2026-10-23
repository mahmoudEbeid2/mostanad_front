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
import { decideSynonym, getAiSettings, getAiStats, getCompleteness, getDictionaryHealth, rebuildDictionary, suggestSynonyms, updateAiSettings } from "../services/apiCertificateAi";

// /certificate-ai — the certificate AI layers in one place (backend plan.md §8, §9; A4):
//   Quality   — evaluation dashboard: acceptance/edit rates, calibration, calls per template/invoice, cost
//   Products  — template-driven completeness + structured data entry
//   Dictionary — health report (low coverage, type conflicts, near duplicates → synonym), AI label synonyms
//   Settings  — the company's AI switches and auto-accept threshold
const TABS = [
  { key: "quality", label: "Quality" },
  { key: "products", label: "Product data" },
  { key: "dictionary", label: "Dictionary health" },
  { key: "settings", label: "Settings" },
];
const KIND = { field_map: "Template field mapping", group_binding: "Repeating groups", invoice_gap: "Invoice gap filling", product_match: "Product matching", dictionary_synonym: "Dictionary synonyms", field_label: "Field labels" };
const RUN = { INVOICE_EXTRACT: "Invoice reading", CERT_FIELD_MAP: "Field mapping", CERT_INVOICE_GAPS: "Gap filling", CERT_PRODUCT_MATCH: "Product matching", CERT_DICTIONARY: "Dictionary synonyms", CERT_ASSIST: "Suggest fields" };
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

const Th = ({ children, right }) => <th className={`px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}>{children}</th>;
const Td = ({ children, right, className = "" }) => <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
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
  const calls = stats.runs.reduce((a, r) => a + r.calls, 0);
  const decided = stats.kinds.reduce((a, k) => a + k.accepted + k.autoAccepted + k.edited + k.rejected, 0);
  const kept = stats.kinds.reduce((a, k) => a + k.accepted + k.autoAccepted, 0);
  const pending = stats.kinds.reduce((a, k) => a + k.pending, 0);
  const tplWeeks = stats.weekly.filter((w) => w.per === "template");
  const invWeeks = stats.weekly.filter((w) => w.per === "invoice");
  const maxPer = Math.max(1, ...stats.weekly.map((w) => w.callsPerEntity || 0));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="ai-days" className="text-gray-600">
          Period
        </label>
        <select id="ai-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-testid="ai-tiles">
        <Tile label="AI calls" value={calls} />
        <Tile label="Answers kept by people" value={pct(decided ? kept / decided : null)} note={`${decided} decided`} />
        <Tile label="Waiting for a person" value={pending} />
        <Tile label="Estimated cost" value={usd(stats.cost.totalUsd)} note={`$${stats.cost.prices.inputPerM}/M in · $${stats.cost.prices.outputPerM}/M out`} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Suggestions by layer</h2>
        <Table testId="ai-kinds" head={<><Th>Layer</Th><Th right>Total</Th><Th>Kept (accepted + auto)</Th><Th>Edited</Th><Th right>Rejected</Th><Th right>Refused by code</Th><Th right>Pending</Th><Th right>Avg confidence</Th></>}>
          {stats.kinds.length === 0 && (
            <tr>
              <Td className="text-gray-500">No AI suggestions in this period.</Td>
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
        <h2 className="font-semibold text-gray-900">Calibration</h2>
        <p className="text-xs text-gray-500">How often people kept an answer, by the confidence the AI gave it. A well-calibrated model keeps more of its confident answers.</p>
        <Table testId="ai-calibration" head={<><Th>AI confidence</Th><Th right>Decided</Th><Th>Kept</Th></>}>
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
        <h2 className="font-semibold text-gray-900">AI calls per template and per invoice</h2>
        <p className="text-xs text-gray-500">Should fall over time as mapping memory and product aliases grow.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {[["Per template", tplWeeks], ["Per invoice", invWeeks]].map(([title, rows]) => (
            <Table key={title} head={<><Th>{title} · week of</Th><Th right>Calls</Th><Th right>Items</Th><Th>Calls each</Th></>}>
              {rows.length === 0 && (
                <tr>
                  <Td className="text-gray-500">No calls.</Td>
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
        <h2 className="font-semibold text-gray-900">Calls and cost by model task</h2>
        <Table testId="ai-runs" head={<><Th>Task</Th><Th right>Calls</Th><Th right>Failed</Th><Th right>Turned off</Th><Th right>Input tokens</Th><Th right>Output + thinking</Th><Th right>Avg time</Th><Th right>Est. cost</Th></>}>
          {stats.runs.map((r) => (
            <tr key={r.kind}>
              <Td>{RUN[r.kind] || r.kind}</Td>
              <Td right>{r.calls}</Td>
              <Td right>{r.failed || 0}</Td>
              <Td right>{r.disabled || 0}</Td>
              <Td right>{r.inputTokens.toLocaleString()}</Td>
              <Td right>{(r.outputTokens + r.thinkingTokens).toLocaleString()}</Td>
              <Td right>{r.avgMs ? `${(r.avgMs / 1000).toFixed(1)} s` : "—"}</Td>
              <Td right>{usd(r.costUsd)}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-[11px] text-gray-400">Cost is an estimate from the tokens Google reported, at the prices shown above (set CERT_AI_PRICE_* on the server to match your plan).</p>
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
        <Tile label="Products" value={data.totals.products} />
        <Tile label="Complete for certificates" value={data.totals.complete} />
        <Tile label="Missing something" value={data.totals.incomplete} />
        <Tile label="Values templates read" value={data.totals.needs} />
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">What your active templates need</h2>
        <Table testId="completeness-needs" head={<><Th>Value</Th><Th>Used by</Th><Th right>Products missing it</Th><Th>Examples</Th></>}>
          {data.needs.length === 0 && (
            <tr>
              <Td className="text-gray-500">No active template reads product data yet.</Td>
            </tr>
          )}
          {data.needs.map((n) => (
            <tr key={n.path}>
              <Td>
                {n.label}
                {n.kind === "list" && n.expected?.length > 0 && <span className="block text-[11px] text-gray-500">needs: {n.expected.join(", ")}</span>}
              </Td>
              <Td className="text-gray-600">{n.templates.join(", ")}</Td>
              <Td right className={n.missingCount ? "text-amber-800 font-semibold" : "text-emerald-700"}>{n.missingCount}</Td>
              <Td className="text-xs">
                {n.missing.slice(0, 4).map((p) => (
                  <Link key={p.id} to={`/products?edit=${p.id}`} className="mr-2 text-blue-600 hover:underline">
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
        <h2 className="font-semibold text-gray-900">Products to complete</h2>
        <div className="space-y-2" data-testid="completeness-products">
          {data.products.length === 0 && <p className="text-sm text-emerald-700">Every product has what the templates need.</p>}
          {data.products.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white">
              <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-amber-800">{p.missing.length} missing</span>
                <span className="ml-auto text-xs text-gray-500 truncate max-w-[50%]">{p.missing.join(" · ")}</span>
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
          {h.dictionary.entries} keys from {h.dictionary.productCount} products · built {new Date(h.dictionary.builtAt).toLocaleString()}
        </span>
        {canEdit && (
          <>
            <button type="button" disabled={!!busy} onClick={act("rebuild", () => rebuildDictionary(scope), "Dictionary rebuilt")} className="text-blue-600 hover:underline">
              Rebuild now
            </button>
            <AiAction><button type="button" disabled={!!busy} onClick={act("ai", () => suggestSynonyms(scope), (o) => (o.ai.unavailable ? `AI unavailable: ${o.ai.reason}` : `${o.suggested} suggestion(s) for ${o.asked} key(s)`))} className="flex items-center gap-1 text-violet-700 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed">
              <Sparkles className="w-3.5 h-3.5" /> {busy === "ai" ? "Asking…" : "Suggest names for unclear keys (AI)"}
            </button></AiAction>
          </>
        )}
      </div>

      {h.synonymSuggestions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-gray-900">AI name suggestions — nothing applies until you accept it</h2>
          <Table testId="synonym-suggestions" head={<><Th>Key</Th><Th>Suggested names</Th><Th>Why</Th><Th></Th></>}>
            {h.synonymSuggestions.map((s) => (
              <tr key={s.id}>
                <Td className="font-mono text-xs">{s.path.replace(/^product\./, "")}</Td>
                <Td>
                  <input value={edits[s.id] ?? s.synonyms.join(", ")} onChange={(e) => setEdits((x) => ({ ...x, [s.id]: e.target.value }))} disabled={!canEdit} aria-label={`Names for ${s.path}`} className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm" />
                </Td>
                <Td className="text-xs text-gray-500">{s.rationale}</Td>
                <Td>
                  {canEdit && (
                    <span className="flex gap-2 text-xs">
                      <button type="button" onClick={act(s.id, () => decideSynonym(scope, s.id, { decision: "accept", synonyms: (edits[s.id] ?? s.synonyms.join(", ")).split(",").map((x) => x.trim()).filter(Boolean) }), "Names added")} className="text-emerald-700 font-semibold hover:underline">
                        Accept
                      </button>
                      <button type="button" onClick={act(s.id, () => decideSynonym(scope, s.id, { decision: "reject" }))} className="text-red-600 hover:underline">
                        Reject
                      </button>
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-900">Keys that look like the same value</h2>
        <p className="text-xs text-gray-500">Adding a synonym makes certificates read the other key when a product lacks the first. Product data is never changed.</p>
        <Table testId="near-duplicates" head={<><Th>Key</Th><Th>Looks like</Th><Th>Why</Th><Th></Th></>}>
          {h.nearDuplicates.length === 0 && (
            <tr>
              <Td className="text-gray-500">None found.</Td>
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
                  <span className="text-emerald-700">synonym ✓</span>
                ) : canEdit ? (
                  <button type="button" onClick={act(d.alternative.path, () => addDictionarySynonym(scope, d.action), "Synonym added")} className="text-blue-600 hover:underline">
                    Add as synonym
                  </button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold text-gray-900">Values stored as different types</h2>
          <Table head={<><Th>Key</Th><Th>Types seen</Th></>}>
            {h.typeConflicts.length === 0 && (
              <tr>
                <Td className="text-gray-500">None.</Td>
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
          <h2 className="font-semibold text-gray-900">Rare keys (under 25 % of products)</h2>
          <Table head={<><Th>Key</Th><Th right>Products</Th><Th>Template needs it</Th></>}>
            {h.lowCoverage.length === 0 && (
              <tr>
                <Td className="text-gray-500">None.</Td>
              </tr>
            )}
            {h.lowCoverage.map((e) => (
              <tr key={e.path}>
                <Td>{e.label}</Td>
                <Td right>{pct(e.coverage)}</Td>
                <Td>{e.neededByTemplates ? "yes" : ""}</Td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
      {h.variants.length > 0 && (
        <p className="text-xs text-gray-500">
          Spellings read as one key automatically: {h.variants.map((v) => v.spellings.join(" / ")).join(" · ")}
        </p>
      )}
    </div>
  );
}

const SWITCHES = [
  { key: "enabled", label: "Use AI for certificates", hint: "Off: everything still works by hand." },
  { key: "allowInvoiceGapFill", label: "Find missing values in invoices", hint: "Every value comes with evidence the server checks word for word." },
  { key: "allowAiMatching", label: "Suggest product matches", hint: "Only among the candidates code found." },
  { key: "allowSynonyms", label: "Suggest names for unclear product keys", hint: "Applied only after you accept each one." },
  { key: "autoAccept", label: "Accept confident AI answers automatically", hint: "Off: a person confirms every AI answer." },
  { key: "allowProductInference", label: "Infer missing product facts from the product's own data", hint: "Quoted or converted from what the product record says — always confirmed by a person. Never lab results, batches, dates or quantities." },
  { key: "allowWebLookup", label: "Look up missing product facts on the web (on request)", hint: "Each value needs a link and a quote the server checks on the page, about the same product. Always confirmed by a person." },
];

function Settings({ scope, canEdit }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getAiSettings(scope).then(setS).catch((e) => setError(e.message));
  }, [scope]);
  const save = async (patch) => {
    try {
      setS(await updateAiSettings(scope, patch));
      toast.success("Saved");
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
        <span className="block font-medium text-gray-900">Also trust these web domains</span>
        <span className="block text-xs text-gray-500">Manufacturer sites and official registries are trusted already; distributors get a warning; everything else is refused unless listed here. One domain per line.</span>
        <textarea rows={3} defaultValue={(s.webDomainAllowList || []).join("\n")} key={(s.webDomainAllowList || []).join()} disabled={!canEdit || !s.allowWebLookup} onBlur={(e) => { const list = e.target.value.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean); if (list.join() !== (s.webDomainAllowList || []).join()) save({ webDomainAllowList: list }); }} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1 font-mono text-xs" aria-label="Trusted web domains" />
      </label>
      <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
        <span className="font-medium text-gray-900">Auto-accept threshold</span>
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
          <h1 className="text-2xl font-bold text-gray-900">Certificate AI</h1>
          <p className="text-sm text-gray-500">How the AI layers are doing, what your products still need, and the switches.</p>
        </div>
        <CompanyPicker scope={scopeState} />
      </div>
      <RoleBanner scope={scopeState} />
      {!scope ? (
        <p className="text-sm text-gray-500">Pick a company first.</p>
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
            {tab === "settings" && <Settings scope={scope} canEdit={canEdit} />}
          </div>
        </>
      )}
    </div>
  );
}
