import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { isArabic } from "../../utils/assistantContext";
import { fmtDate, fmtTime, t } from "../../i18n";

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const when = (d, today) => (sameDay(d, today) ? fmtTime(d) : fmtDate(d));

/** Left column of /assistant: the user's own conversations, Today / Earlier, with search. */
export default function ConversationList({ conversations, activeId, isSystem, onOpen, onNew, onDelete }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const today = new Date();
    const term = q.trim().toLowerCase();
    const rows = conversations.filter((c) => !term || (c.title || "").toLowerCase().includes(term) || (c.companyName || "").toLowerCase().includes(term));
    return [
      ["Today", rows.filter((c) => sameDay(new Date(c.updatedAt), today))],
      ["Earlier", rows.filter((c) => !sameDay(new Date(c.updatedAt), today))],
    ].filter(([, list]) => list.length);
  }, [conversations, q]);
  const today = new Date();

  return (
    <section aria-label={t("conversationList.conversations")} className="flex w-70 flex-none flex-col border-e border-gray-200 bg-white">
      <div className="flex flex-col gap-2.5 border-b border-gray-100 p-4">
        <button type="button" onClick={onNew} data-testid="new-conversation" className="min-h-11 w-full rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700">{t("conversationList.newConversation")}</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("conversationList.searchConversations")} aria-label={t("conversationList.searchConversations")} className="min-h-[38px] w-full rounded-lg border border-gray-300 px-3 text-[13px] focus:border-blue-500 focus:outline-none" />
      </div>
      <div className="flex-1 overflow-y-auto p-2" data-testid="assistant-history">
        {groups.length === 0 && <p className="p-4 text-center text-xs text-gray-400">{q ? t("conversationList.noConversationMatches") : t("conversationList.noConversationsYet")}</p>}
        {groups.map(([label, list]) => (
          <div key={label}>
            <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 first:pt-2">{label}</div>
            {list.map((c) => (
              <div key={c.id} className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <button type="button" onClick={() => onOpen(c.id)} aria-current={c.id === activeId ? "page" : undefined} className="min-w-0 flex-1 px-2.5 py-2 text-start">
                  <div dir="auto" className={`truncate text-[13px] font-medium text-gray-900 ${isArabic(c.title) ? "font-arabic text-end" : ""}`}>{c.title || t("conversationList.newConversation2")}</div>
                  <div className="text-[11px] text-gray-500">
                    {c.companyName || (isSystem ? t("conversationList.allCompanies") : "")}
                    {c.companyName || isSystem ? " · " : ""}
                    {when(new Date(c.updatedAt), today)}
                  </div>
                </button>
                <button type="button" title={t("conversationList.deleteConversation")} aria-label={t("conversationList.deleteConversation")} onClick={() => onDelete(c.id)} className="me-1 rounded p-1.5 text-gray-400 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
