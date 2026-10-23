import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircle, ArrowRight, CopyPlus } from "lucide-react";
import Button from "../../../ui/Button";
import DocumentFrame from "../DocumentFrame";
import FieldMarker from "../FieldMarker";
import FieldPanel from "../FieldPanel";
import GroupPanel from "../GroupPanel";
import GroupOverlay from "../GroupOverlay";
import ProductMatchSelect from "../ProductMatchSelect";
import { confirmFields, enableGroups, getFieldSources, getVersionHtml, mapFields, newVersionFrom, proposeLabels, rebuildDataDictionary, saveFields, suggestFields } from "../../../services/apiCertificateTemplates";
import { cellOptions, slugKey, sourceOptions } from "../../../utils/certificateFieldSources";
import { describeCertificateError } from "../../../utils/certificateErrors";
import { withNextStep } from "../../../utils/aiReason";

// Wizard step 2 — mark fields (plan §13.4). The document is the sanitized
// design; the field list autosaves (800 ms debounce) with PUT …/fields, which
// validates offsets in the server's layout and returns measured suggestions.
// Repeating groups (plan §7.8) are saved in the same request; the server
// answers with what it detected (shape, footer line, capacity) or why it can't.

const STR = {
  hint: "Select the text that changes.",
  hintCtrl: "Ctrl",
  hintTail: "+ select to add several.",
  invalid: "Not saved — fix:",
  failed: "Not saved:",
  back: "Back",
  next: "Next: settings",
  newVersion: "Create a new version to edit",
  aiNone: "No new suggestions.",
  aiDisabled: "AI suggestions are turned off.",
  mapAll: "Map all",
  mapping: "Mapping…",
  mapAllHint: "Fill “Value comes from” for every field still typed by hand: your earlier choices first, then your product data, then AI.",
  sample: "Sample product (optional)",
  sampleHint: "The product this design was made for — mappings are checked against its values.",
  aiUnavailable: (reason) => withNextStep(reason, "Mark and map the fields by hand."),
  mapped: (n) => `${n} field${n === 1 ? "" : "s"} mapped`,
};

let uidSeq = 0;
const nextUid = () => `f${++uidSeq}`;

const toDraft = (f) => ({ ...f, uid: nextUid(), keyEdited: true });
const toPayload = (drafts) =>
  drafts.map((f, i) => ({
    key: f.key,
    label: f.label,
    page: f.page,
    lineId: f.lineId,
    charStart: f.charStart,
    charEnd: f.charEnd,
    sampleValue: f.sampleValue,
    source: f.source,
    format: f.format || null,
    required: f.required !== false,
    align: f.align || "left",
    origin: f.origin || "manual",
    confirmed: f.confirmed !== false,
    sortOrder: i,
    groupKey: f.groupKey || null,
    // AI plan §5: the server reconciles these with the stored suggestion
    mappingOrigin: f.mappingOrigin || "manual",
    mappingSuggestionId: f.mappingSuggestionId || null,
    dataCategory: f.dataCategory || null,
    // A5 (backend plan.md §14.1): the server clamps it; omitted = the category's default
    ...(f.inferencePolicy ? { inferencePolicy: f.inferencePolicy } : {}),
  }));
// what map-fields needs per field (labelContext is what label-proposals saw around the value)
const toMapInput = (drafts) => drafts.map((f) => ({ key: f.key, label: f.label, lineId: f.lineId, sampleValue: f.sampleValue, groupKey: f.groupKey || null, labelContext: f.labelContext || null }));
// a mapping result → the field patch (an unmapped/refused one only explains itself)
const mappingPatch = (f, mp) => {
  if (!mp) return {};
  if (["unmapped", "invalid"].includes(mp.status)) return { mapping: mp, mappedLabel: f.label };
  return {
    source: mp.source,
    format: mp.format || null,
    required: mp.required !== false,
    mappingOrigin: mp.origin,
    mappingSuggestionId: mp.suggestionId || null,
    mappingConfirmed: mp.status !== "pending",
    dataCategory: mp.category || null,
    mapping: mp,
    mappedLabel: f.label,
  };
};
const toGroupPayload = (groups) =>
  groups.map((g, i) => ({
    key: g.key,
    label: g.label,
    mode: g.mode || "repeat",
    source: g.source,
    whenEmpty: g.whenEmpty || "dash",
    required: g.required !== false,
    sampleRows: g.sampleRows ?? null,
    footerY: g.footerY ?? null,
    minPitchRatio: g.minPitchRatio ?? 0.85,
    sortOrder: i,
  }));
// a prepared version's stored geometry is what detection returned at prepare time
const storedDetection = (groups) => Object.fromEntries(groups.filter((g) => g.geometry).map((g) => [g.key, { ok: true, ...g.geometry }]));

const uniqueKey = (base, taken) => {
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${base}_${n}`;
  return k;
};

export default function FieldsStep({ scope, templateScope, version, onSaved, onNext, onBack, onSaveState }) {
  const navigate = useNavigate();
  const readOnly = version.status !== "draft";
  const [drafts, setDrafts] = useState(() => (version.fields || []).map(toDraft));
  const [groups, setGroups] = useState(() => (version.groups || []).map((g) => ({ ...g, keyEdited: true })));
  const [detection, setDetection] = useState(() => storedDetection(version.groups || []));
  const [enabling, setEnabling] = useState(false);
  const [activeUid, setActiveUid] = useState(null);
  const [frameInfo, setFrameInfo] = useState(null);
  const [catalogue, setCatalogue] = useState(null);
  const [save, setSave] = useState({ state: "saved" });
  const [suggestions, setSuggestions] = useState({});
  const [aiChips, setAiChips] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  // a draft with groups is saved once on open: the save returns the detection (footer line, capacity)
  const dirty = useRef(!readOnly && (version.groups || []).length > 0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // the autosave state is shown in the wizard header (mockup A4)
  useEffect(() => {
    onSaveState?.(readOnly ? null : save.state);
  }, [save.state, readOnly, onSaveState]);

  useEffect(() => {
    getFieldSources(scope)
      .then(setCatalogue)
      .catch((err) => toast.error(err.message));
  }, [scope]);
  // products changed since the list was read → re-read them (AI plan §3.2)
  const [refreshing, setRefreshing] = useState(false);
  const refreshSources = useCallback(async () => {
    setRefreshing(true);
    try {
      await rebuildDataDictionary(scope);
      setCatalogue(await getFieldSources(scope));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [scope]);
  const sources = useMemo(() => ({ dictionary: catalogue?.dictionary || null, onRefresh: catalogue?.dictionary ? refreshSources : null, refreshing }), [catalogue, refreshSources, refreshing]);
  const options = useMemo(() => sourceOptions(catalogue), [catalogue]);
  const cellOptionsFor = useCallback((groupKey) => cellOptions(catalogue, groups.find((g) => g.key === groupKey)?.source), [catalogue, groups]);

  const update = (fn) => {
    dirty.current = true;
    setDrafts(fn);
  };

  // autosave, debounced 800 ms (plan §13.4)
  useEffect(() => {
    if (readOnly || !dirty.current) return undefined;
    setSave({ state: "pending" });
    const t = setTimeout(async () => {
      setSave({ state: "saving" });
      try {
        const res = await saveFields(scope, version.id, toPayload(drafts), toGroupPayload(groups));
        setSuggestions(res.suggestions || {});
        setDetection(res.groupDetection || {});
        setSave({ state: "saved" });
        onSavedRef.current?.(res);
      } catch (err) {
        // a group the engine can't take apart: shown on the group with the fixed-rows way out
        if (err.data?.fallback === "fixed_rows") setDetection(Object.fromEntries((err.data.problems || []).map((p) => [p.key, { ok: false, error: p.code, message: p.message }])));
        setSave({ state: err.code === "INVALID_FIELDS" ? "invalid" : "error", message: describeCertificateError(err), problems: err.data?.problems || [] });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [drafts, groups, readOnly, scope, version.id]);

  // groups: a renamed group takes its cells along; a deleted one releases them
  const changeGroups = (next) => {
    const renamed = new Map();
    groups.forEach((g, i) => {
      if (next[i] && next.length === groups.length && next[i].key !== g.key) renamed.set(g.key, next[i].key);
    });
    const kept = new Set(next.map((g) => g.key));
    dirty.current = true;
    setGroups(next);
    setDrafts((cur) =>
      cur.map((f) => {
        if (!f.groupKey) return f;
        if (renamed.has(f.groupKey)) return { ...f, groupKey: renamed.get(f.groupKey) };
        return kept.has(f.groupKey) ? f : { ...f, groupKey: null, source: { kind: "manual" }, format: null };
      })
    );
  };
  const setFooter = (key, footerY) => changeGroups(groups.map((g) => (g.key === key ? { ...g, footerY } : g)));
  const enable = async () => {
    setEnabling(true);
    try {
      const res = await enableGroups(scope, version.id);
      navigate(`/certificates/templates/${res.templateId}/versions/${res.versionId}?step=upload&task=${res.taskId}`);
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setEnabling(false);
    }
  };

  // drafts are built outside the state updater: StrictMode runs updaters twice
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  // ── mapping (AI plan §5.2): memory → dictionary → one AI call ──────────────
  const [mapBusy, setMapBusy] = useState(false);
  const [sample, setSample] = useState(null); // { id, name, productCode }
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const runMap = useCallback(
    async (keys, list = draftsRef.current) => {
      if (!keys.length) return null;
      setMapBusy(true);
      try {
        const res = await mapFields(scope, version.id, { fields: toMapInput(list), groups: groupsRef.current.map((g) => ({ key: g.key, label: g.label })), keys, sampleProductId: sample?.id || null });
        // a source the user picked by hand while the request ran is never overwritten
        const handPicked = (f) => (f.mappingOrigin || "manual") === "manual" && f.source?.kind !== "manual";
        update((cur) => cur.map((f) => (keys.includes(f.key) && res.mappings[f.key] && !handPicked(f) ? { ...f, ...mappingPatch(f, res.mappings[f.key]) } : f)));
        if (Object.values(res.groups || {}).some((b) => b.source)) {
          dirty.current = true;
          setGroups((cur) => cur.map((g) => (res.groups[g.key]?.source ? { ...g, source: res.groups[g.key].source, binding: res.groups[g.key] } : g)));
          update((cur) => cur.map((f) => (f.groupKey && res.groups[f.groupKey]?.cells?.[f.key] ? { ...f, source: res.groups[f.groupKey].cells[f.key], format: null } : f)));
        }
        if (res.ai?.unavailable) toast(STR.aiUnavailable(res.ai.reason));
        return res;
      } catch (err) {
        toast.error(describeCertificateError(err));
        return null;
      } finally {
        setMapBusy(false);
      }
    },
    [scope, version.id, sample]
  );
  const mapAll = async () => {
    const keys = draftsRef.current.filter((f) => !f.groupKey && (f.mappingOrigin || "manual") === "manual" && f.source?.kind === "manual" && f.dataCategory !== "batch_data").map((f) => f.key);
    const groupKeys = [...new Set(draftsRef.current.filter((f) => f.groupKey && f.source?.kind === "manual").map((f) => f.groupKey))];
    const res = await runMap([...keys, ...groupKeys]);
    if (res) toast.success(STR.mapped(Object.values(res.mappings).filter((m) => !["unmapped", "invalid"].includes(m.status)).length));
  };
  // a new field: label from the layout (code), key from the label, then map it
  const proposeAndMap = useCallback(
    async (added) => {
      let proposals = [];
      try {
        proposals = await proposeLabels(scope, version.id, added.map((f) => ({ lineId: f.lineId, charStart: f.charStart, charEnd: f.charEnd, sampleValue: f.sampleValue })));
      } catch (err) {
        toast.error(describeCertificateError(err));
        return;
      }
      const taken = new Set(draftsRef.current.filter((f) => !added.some((a) => a.uid === f.uid)).map((f) => f.key));
      const patched = new Map();
      added.forEach((a, i) => {
        const cur = draftsRef.current.find((f) => f.uid === a.uid);
        if (!cur) return;
        const p = proposals[i] || {};
        const untouched = cur.label === a.label && !cur.keyEdited; // the user hasn't typed meanwhile
        const label = untouched && p.label ? p.label : cur.label;
        const key = untouched && p.label ? uniqueKey(slugKey(p.label), taken) : cur.key;
        taken.add(key);
        patched.set(a.uid, { label, key, labelContext: p.context || null, ...(p.category === "batch_data" ? { dataCategory: "batch_data" } : {}) });
      });
      const next = draftsRef.current.map((f) => (patched.has(f.uid) ? { ...f, ...patched.get(f.uid) } : f));
      update(() => next);
      draftsRef.current = next;
      await runMap(added.map((a) => next.find((f) => f.uid === a.uid)?.key).filter(Boolean), next);
    },
    [scope, version.id, runMap]
  );
  // plan §5.1 step 4: mapping runs again when a label changes (on blur)
  const remap = (uid) => {
    const f = draftsRef.current.find((x) => x.uid === uid);
    if (f && f.label && f.label !== f.mappedLabel && ((f.mappingOrigin || "manual") !== "manual" || f.source?.kind === "manual")) runMap([f.key]);
  };
  // an AI mapping is confirmed on the server (saved first, so the server holds the suggestion link)
  const confirmMapping = async (key) => {
    try {
      await saveFields(scope, version.id, toPayload(draftsRef.current), toGroupPayload(groupsRef.current));
      await confirmFields(scope, version.id, [key]);
      update((cur) => cur.map((f) => (f.key === key ? { ...f, mappingConfirmed: true, mapping: f.mapping ? { ...f.mapping, status: "accepted" } : f.mapping } : f)));
    } catch (err) {
      toast.error(describeCertificateError(err));
    }
  };

  const make = useCallback(
    (segments) => {
      const cur = draftsRef.current;
      const taken = new Set(cur.map((f) => f.key));
      const added = segments.map((s, i) => {
        const label = `Field ${cur.length + i + 1}`;
        const key = uniqueKey(slugKey(label), taken);
        taken.add(key);
        return { ...s, uid: nextUid(), key, label, source: { kind: "manual" }, format: null, required: true, align: "left", origin: "manual", confirmed: true, keyEdited: false, mappingOrigin: "manual" };
      });
      update((list) => [...list, ...added]);
      setActiveUid(added[added.length - 1]?.uid ?? null);
      draftsRef.current = [...cur, ...added];
      proposeAndMap(added);
    },
    [proposeAndMap]
  );

  const change = (uid, patch) =>
    update((cur) =>
      cur.map((f) => {
        if (f.uid !== uid) return f;
        // a source picked by hand is the person's choice (the server records an AI suggestion as edited)
        const byHand = patch.source && JSON.stringify(patch.source) !== JSON.stringify(f.source);
        return { ...f, ...patch, ...(byHand ? { mappingOrigin: "manual", mappingConfirmed: true, mapping: { origin: "manual" } } : {}) };
      })
    );
  const remove = (uid) => update((cur) => cur.filter((f) => f.uid !== uid));
  const move = (i, d) =>
    update((cur) => {
      const next = cur.slice();
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const confirm = (key) => update((cur) => cur.map((f) => (f.key === key ? { ...f, confirmed: true } : f)));

  const suggest = async () => {
    setAiBusy(true);
    try {
      const res = await suggestFields(scope, version.id);
      const fresh = res.suggestions.filter((s) => !drafts.some((f) => f.lineId === s.lineId && f.charStart < s.charEnd && s.charStart < f.charEnd));
      setAiChips(fresh);
      if (!fresh.length) toast(STR.aiNone);
    } catch (err) {
      if (err.code === "ASSIST_DISABLED") {
        setAiEnabled(false);
        toast(STR.aiDisabled);
      } else toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  };
  const acceptChip = (c) => {
    setAiChips((cur) => cur.filter((x) => x !== c));
    update((cur) => {
      const taken = new Set(cur.map((f) => f.key));
      return [...cur, { ...c, uid: nextUid(), key: uniqueKey(c.key, taken), keyEdited: true }];
    });
  };

  const forkVersion = async () => {
    try {
      const res = await newVersionFrom(scope, version.id);
      navigate(`/certificates/templates/${res.templateId}/versions/${res.versionId}?step=fields`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const activeKey = drafts.find((f) => f.uid === activeUid)?.key;
  const selectByKey = useCallback((key) => setActiveUid((cur) => drafts.find((f) => f.key === key)?.uid ?? cur), [drafts]);

  return (
    <div className="space-y-3">
      {["invalid", "error"].includes(save.state) && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="save-error">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{save.state === "invalid" ? STR.invalid : STR.failed}</p>
            {save.problems?.length ? (
              <ul className="list-disc ml-4">
                {save.problems.map((p, i) => (
                  <li key={i}>
                    <span className="font-mono">{p.key}</span>: {p.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{save.message}</p>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-5 items-start">
        <DocumentFrame
          className="flex-[3_1_520px] min-w-0"
          load={() => getVersionHtml(scope, version.id, "sanitized")}
          reloadKey={version.id}
          minHeight={720}
          onReady={setFrameInfo}
          hint={
            !readOnly && (
              <span className="text-[13px] text-gray-600">
                {STR.hint} <b className="text-gray-900">{STR.hintCtrl}</b> {STR.hintTail}
              </span>
            )
          }
          overlay={(scale) => (
            <>
              <GroupOverlay frameInfo={frameInfo} groups={groups} detection={detection} onFooter={setFooter} disabled={readOnly} scale={scale} />
              <FieldMarker frameInfo={frameInfo} fields={drafts} activeKey={activeKey} onMake={make} onSelect={selectByKey} disabled={readOnly} scale={scale} />
            </>
          )}
        />
        <div className="flex-[2_1_340px] min-w-0 flex flex-col gap-4">
          <FieldPanel
          fields={drafts}
          options={options}
          sources={sources}
          groups={groups}
          cellOptionsFor={cellOptionsFor}
          activeUid={activeUid}
          onActivate={setActiveUid}
          onChange={change}
          onRemove={remove}
          onMove={move}
          onConfirm={readOnly ? null : confirm}
          suggestions={suggestions}
          readOnly={readOnly}
          aiEnabled={aiEnabled}
          aiChips={aiChips}
          aiBusy={aiBusy}
          onSuggest={suggest}
          onAcceptChip={acceptChip}
          onRejectChip={(c) => setAiChips((cur) => cur.filter((x) => x !== c))}
          onConfirmMapping={readOnly ? null : confirmMapping}
          onRemap={readOnly ? null : remap}
          scope={scope}
          toolbar={
            readOnly ? null : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-48" title={STR.sampleHint}>
                  <label htmlFor="mapping-sample-product" className="block text-xs font-semibold text-gray-600 mb-1">
                    {STR.sample}
                  </label>
                  <ProductMatchSelect
                    scope={scope}
                    inputId="mapping-sample-product"
                    ariaLabel={STR.sample}
                    item={{ matchCandidates: [], product: sample }}
                    onChange={(id, opt) => setSample(id ? { id, name: opt?.label, productCode: opt?.code ?? null } : null)}
                  />
                </div>
                <Button variant="secondary" onClick={mapAll} isLoading={mapBusy} disabled={!drafts.length} title={STR.mapAllHint} data-testid="map-all">
                  {mapBusy ? STR.mapping : STR.mapAll}
                </Button>
              </div>
            )
          }
          footer={
            <>
              {onBack ? (
                <button type="button" onClick={onBack} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
                  {STR.back}
                </button>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-2">
                {readOnly && (
                  <Button variant="secondary" onClick={forkVersion}>
                    <CopyPlus className="w-4 h-4" /> {STR.newVersion}
                  </Button>
                )}
                <Button onClick={onNext} disabled={!readOnly && (save.state !== "saved" || !drafts.length)}>
                  {STR.next} <ArrowRight className="w-4 h-4" />
                </Button>
              </span>
            </>
          }
          />
          <GroupPanel
            version={version}
            templateScope={templateScope}
            groups={groups}
            detection={detection}
            catalogue={catalogue}
            fields={drafts}
            onChange={changeGroups}
            onEnable={enable}
            enabling={enabling}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
