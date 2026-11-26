// "اقرا ملفات الشركة تاني" (28 Nov): every file already stored for a company read again (no upload), its
// products filled from them and what no file states estimated — a background job, its progress shown here.
// Files already read are skipped, so pressing it twice costs nothing again.
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { reharvestCompany } from "../../services/apiWorkflow";
import { getTaskStatus } from "../../services/apiProducts";

const taskOf = (r) => r?.data?.task || r?.data || r?.task || r;

export default function ReharvestButton({ companyId, scope = {}, compact = false }) {
  const [state, setState] = useState(null); // { progress, message } while it runs
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const follow = (taskId) => {
    timer.current = setTimeout(async () => {
      try {
        const t = taskOf(await getTaskStatus(taskId));
        if (t.status === "completed" || t.status === "done") {
          setState(null);
          const r = t.result || {};
          toast.success(`قريت ${r.read ?? r.files ?? 0} ملف — ملّيت ${r.filled ?? 0} قيمة${r.conflicts ? ` — ${r.conflicts} تعارضات` : ""}${r.inferred?.filled ? ` — اتستنتج ${r.inferred.filled}` : ""}`);
          return;
        }
        if (t.status === "failed") {
          setState(null);
          toast.error(t.error || "قراية الملفات فشلت");
          return;
        }
        setState({ progress: t.progress || 0, message: t.message || t.progressMessage || "بقرا الملفات…" });
        follow(taskId);
      } catch (e) {
        setState(null);
        toast.error(e?.response?.data?.message || e.message);
      }
    }, 2000);
  };

  const start = async () => {
    try {
      setState({ progress: 0, message: "بقرا الملفات…" });
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
    <button type="button" onClick={start} title="اقرا كل ملفات الشركة تاني واملا منتجاتها" aria-label="اقرا ملفات الشركة تاني" className={compact ? "p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" : "inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"} data-testid="reharvest">
      <BookOpenCheck className="h-4 w-4" />
      {!compact && "اقرا ملفات الشركة تاني"}
    </button>
  );
}
