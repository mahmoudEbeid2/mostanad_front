// "اقرا ملفات الشركة تاني" (28 Nov): every file already stored for a company read again (no upload), its
// products filled from them and what no file states estimated — a background job, its progress shown here.
// Files already read are skipped, so pressing it twice costs nothing again.
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { reharvestCompany } from "../../services/apiWorkflow";
import { getTaskStatus } from "../../services/apiProducts";
import { t } from "../../i18n";

const taskOf = (r) => r?.data?.task || r?.data || r?.task || r;

export default function ReharvestButton({ companyId, scope = {}, compact = false }) {
  const [state, setState] = useState(null); // { progress, message } while it runs
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const follow = (taskId) => {
    timer.current = setTimeout(async () => {
      try {
        const it = taskOf(await getTaskStatus(taskId));
        if (it.status === "completed" || it.status === "done") {
          setState(null);
          const r = it.result || {};
          toast.success(`${t("reharvestButton.done", { read: r.read ?? r.files ?? 0, filled: r.filled ?? 0 })}${r.conflicts ? t("reharvestButton.conflicts", { conflicts: r.conflicts }) : ""}${r.inferred?.filled ? t("reharvestButton.estimated", { filled: r.inferred.filled }) : ""}`);
          return;
        }
        if (it.status === "failed") {
          setState(null);
          toast.error(it.error || t("reharvestButton.readingTheFilesFailed"));
          return;
        }
        setState({ progress: it.progress || 0, message: it.message || it.progressMessage || t("reharvestButton.readingTheFiles") });
        follow(taskId);
      } catch (e) {
        setState(null);
        toast.error(e?.response?.data?.message || e.message);
      }
    }, 2000);
  };

  const start = async () => {
    try {
      setState({ progress: 0, message: t("reharvestButton.readingTheFiles") });
      const r = await reharvestCompany(scope, companyId);
      follow(r.taskId);
    } catch (e) {
      setState(null);
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  if (state)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800" data-testid="reharvest-progress" title={state.message}>
        <Loader2 className="h-4 w-4 animate-spin" /> {compact ? `${state.progress}%` : `${state.message} ${state.progress}%`}
      </span>
    );
  return (
    <button type="button" onClick={start} title={t("reharvestButton.readAllTheCompanysFiles")} aria-label={t("reharvestButton.readTheCompanysFilesAgain")} className={compact ? "p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" : "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"} data-testid="reharvest">
      <BookOpenCheck className="h-4 w-4" />
      {!compact && t("reharvestButton.readTheCompanysFilesAgain")}
    </button>
  );
}
