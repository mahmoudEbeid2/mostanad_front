// Overview — the main page for everyone (was Admin → Overview, UI plan Phase E): the numbers that were on the dashboard — users, companies, products,
// AI tasks with the failed ones one click away. Revenue and subscriptions stay hidden until billing exists.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardStats } from "../services/apiDashboard";
import { 
  Users, Building2, Package, AlertCircle, Zap, Clock, Loader2, CheckCircle, AlertOctagon
} from "lucide-react";
import toast from "react-hot-toast";
import { fmtNum, t } from "../i18n";

export default function AdminOverview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = user?.role?.permissions?.includes("read_dashboard");

  useEffect(() => {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await getDashboardStats();
        if (res.status === "success") {
          setData(res.data);
        }
      } catch (error) {
        toast.error(t("dashboard.failedToLoadDashboardStatistics"));
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      // the overview's numbers need the dashboard permission; everyone else is sent on to their work
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("placeholders.adminOverview")}</h1>
          <p className="text-gray-500 mt-1">{t("adminOverview.subtitle")}</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <AlertCircle className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
          <p className="font-semibold text-gray-800">{t("adminOverview.noStats")}</p>
          <Link to="/work-queue" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{t("adminOverview.openWorkQueue")}</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <span className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("placeholders.adminOverview")}</h1>
        <p className="text-gray-500 mt-1">{t("adminOverview.subtitle")}</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title={t("dashboard.totalUsers")} value={data?.stats?.users} icon={Users} color="blue" />
        <StatCard title={t("dashboard.companies")} value={data?.stats?.companies} icon={Building2} color="indigo" />
        <StatCard title={t("dashboard.products")} value={data?.stats?.products} icon={Package} color="emerald" />
      </div>

      {/* Secondary Stats & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Background Tasks Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t("dashboard.aiTasksProcessing")}</h2>
                <p className="text-sm text-gray-500">{t("dashboard.realTimeStatusOfBackground")}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-gray-900">{fmtNum(data?.tasks?.total || 0)}</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t("dashboard.totalTasks")}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TaskBox label={t("dashboard.pending")} count={data?.tasks?.byStatus?.pending || 0} color="text-amber-600" bg="bg-amber-50" icon={Clock} border="border-amber-100" />
            <TaskBox label={t("dashboard.processing")} count={data?.tasks?.byStatus?.processing || 0} color="text-blue-600" bg="bg-blue-50" icon={Loader2} border="border-blue-100" />
            <TaskBox label={t("dashboard.completed")} count={data?.tasks?.byStatus?.completed || 0} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle} border="border-emerald-100" />
            <TaskBox label={t("dashboard.failed")} count={data?.tasks?.byStatus?.failed || 0} color="text-red-600" bg="bg-red-50" icon={AlertOctagon} border="border-red-100" />
          </div>
          
          {/* Progress Bar for completion rate */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-gray-700">{t("dashboard.overallCompletionRate")}</span>
              <span className="text-sm font-black text-emerald-600">
                {data?.tasks?.total ? Math.round(((data?.tasks?.byStatus?.completed || 0) / data.tasks.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" 
                style={{ width: `${data?.tasks?.total ? ((data?.tasks?.byStatus?.completed || 0) / data.tasks.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* failed tasks: listed with their reason on System health */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-500" aria-hidden="true" />
            {t("adminOverview.failedTasks")}
          </h2>
          <p className="text-4xl font-extrabold text-red-600">{fmtNum(data?.tasks?.byStatus?.failed || 0)}</p>
          <p className="text-sm text-gray-500">{t("adminOverview.failedHint")}</p>
          <Link to="/admin/health" className="mt-auto self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">{t("adminOverview.seeFailed")}</Link>
          <Link to="/admin/ai-usage" className="self-start text-sm font-medium text-blue-700 hover:underline">{t("adminOverview.aiCost")}</Link>
        </div>
      </div>

    </div>
  );
}

// Subcomponents
function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
      <div className={`mb-4 self-start p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-extrabold text-gray-900">{fmtNum(value || 0)}</h3>
    </div>
  );
}

function TaskBox({ label, count, color, bg, icon: Icon, border }) {
  return (
    <div className={`${bg} rounded-2xl p-5 flex flex-col items-center text-center border ${border} relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300`}>
      <div className={`absolute -end-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
         {Icon && <Icon className="w-20 h-20" />}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className={`w-8 h-8 rounded-full bg-white/60 flex items-center justify-center ${color} shadow-sm backdrop-blur-sm`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        <span className={`text-3xl font-black ${color} tracking-tight`}>{fmtNum(count)}</span>
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}
