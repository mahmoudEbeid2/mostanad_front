import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listAssistantSettings, updateAssistantSetting } from "../../services/apiAssistant";
import { t } from "../../i18n";

// System admins: the assistant's switch and limits per company (and for system users).
function Row({ row, onSaved }) {
  const [draft, setDraft] = useState({ messagesPerUserPerHour: row.messagesPerUserPerHour, modelCallsPerDay: row.modelCallsPerDay });
  const [saving, setSaving] = useState(false);
  const save = async (patch) => {
    setSaving(true);
    try {
      onSaved(await updateAssistantSetting(row.scopeKey, patch));
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs" data-testid={`assistant-setting-${row.scopeKey}`}>
      <label className="flex flex-1 items-center gap-2 font-medium">
        <input type="checkbox" checked={row.enabled} disabled={saving} onChange={(e) => save({ enabled: e.target.checked })} />
        {row.name}
      </label>
      <label className="flex items-center gap-1 text-gray-500" title={t("assistantSettings.messagesPerUserPerHour")}>{t("assistantSettings.msgH")}<input type="number" min={1} className="w-14 rounded border border-gray-300 px-1 py-0.5" value={draft.messagesPerUserPerHour} onChange={(e) => setDraft({ ...draft, messagesPerUserPerHour: e.target.value })} onBlur={() => Number(draft.messagesPerUserPerHour) !== row.messagesPerUserPerHour && save({ messagesPerUserPerHour: Number(draft.messagesPerUserPerHour) })} />
      </label>
      <label className="flex items-center gap-1 text-gray-500" title={t("assistantSettings.aiCallsPerDay")}>{t("assistantSettings.callsDay")}<input type="number" min={1} className="w-16 rounded border border-gray-300 px-1 py-0.5" value={draft.modelCallsPerDay} onChange={(e) => setDraft({ ...draft, modelCallsPerDay: e.target.value })} onBlur={() => Number(draft.modelCallsPerDay) !== row.modelCallsPerDay && save({ modelCallsPerDay: Number(draft.modelCallsPerDay) })} />
      </label>
    </li>
  );
}

export default function AssistantSettings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    listAssistantSettings()
      .then(setData)
      .catch((e) => setError(e.response?.data?.message || e.message));
  }, []);
  const saved = (s) =>
    setData((d) => (s.scopeKey === "system" ? { ...d, system: { ...d.system, ...s } } : { ...d, companies: d.companies.map((c) => (c.scopeKey === s.scopeKey ? { ...c, ...s } : c)) }));
  if (error) return <p role="alert" className="p-4 text-xs text-red-700">{error}</p>;
  if (!data) return <p className="p-4 text-xs text-gray-400">{t("assistantSettings.loading")}</p>;
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="mb-2 text-xs text-gray-500">{t("assistantSettings.whoCanUseTheAssistant")}</p>
      <ul className="flex flex-col gap-1.5">
        <Row row={data.system} onSaved={saved} />
        {data.companies.map((c) => (
          <Row key={c.scopeKey} row={c} onSaved={saved} />
        ))}
      </ul>
    </div>
  );
}
