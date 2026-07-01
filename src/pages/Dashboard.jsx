import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getDashboardStats } from "../services/apiDashboard";
import { 
  Users, Building2, Package, CreditCard, AlertCircle, CheckCircle2, 
  Activity, ArrowUpRight, DollarSign, ListTodo, Zap, Clock, Loader2, CheckCircle, AlertOctagon
} from "lucide-react";
import toast from "react-hot-toast";

export default function Dashboard() {
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
        toast.error("Failed to load dashboard statistics");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">
          You do not have the required permissions to view the dashboard statistics. 
          Please contact your system administrator.
        </p>
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user?.name}. Here is what's happening today.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={data?.stats?.users} icon={Users} color="blue" />
        <StatCard title="Companies" value={data?.stats?.companies} icon={Building2} color="indigo" />
        <StatCard title="Products" value={data?.stats?.products} icon={Package} color="emerald" />
        <StatCard title="Monthly Revenue" value={`$${data?.stats?.totalMonthlyRevenue || 0}`} icon={DollarSign} color="amber" />
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
                <h2 className="text-xl font-bold text-gray-900">AI Tasks Processing</h2>
                <p className="text-sm text-gray-500">Real-time status of background AI jobs</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-gray-900">{data?.tasks?.total || 0}</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Tasks</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TaskBox label="Pending" count={data?.tasks?.byStatus?.pending || 0} color="text-amber-600" bg="bg-amber-50" icon={Clock} border="border-amber-100" />
            <TaskBox label="Processing" count={data?.tasks?.byStatus?.processing || 0} color="text-blue-600" bg="bg-blue-50" icon={Loader2} border="border-blue-100" />
            <TaskBox label="Completed" count={data?.tasks?.byStatus?.completed || 0} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle} border="border-emerald-100" />
            <TaskBox label="Failed" count={data?.tasks?.byStatus?.failed || 0} color="text-red-600" bg="bg-red-50" icon={AlertOctagon} border="border-red-100" />
          </div>
          
          {/* Progress Bar for completion rate */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-gray-700">Overall Completion Rate</span>
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

        {/* System Plans */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
           <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              Subscriptions
            </h2>
          </div>
          <div className="flex flex-col gap-4 justify-center items-center h-full pb-8">
            <div className="w-24 h-24 rounded-full border-8 border-indigo-100 flex items-center justify-center relative">
              <span className="text-3xl font-extrabold text-indigo-600">{data?.stats?.activeSubscriptions}</span>
            </div>
            <p className="text-gray-500 font-medium">Active Subscriptions</p>
            <p className="text-sm text-gray-400">Out of {data?.stats?.plans} available plans</p>
          </div>
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
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" /> +12%
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-extrabold text-gray-900">{value || 0}</h3>
      </div>
    </div>
  );
}

function TaskBox({ label, count, color, bg, icon: Icon, border }) {
  return (
    <div className={`${bg} rounded-2xl p-5 flex flex-col items-center text-center border ${border} relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300`}>
      <div className={`absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
         {Icon && <Icon className="w-20 h-20" />}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className={`w-8 h-8 rounded-full bg-white/60 flex items-center justify-center ${color} shadow-sm backdrop-blur-sm`}>
          {Icon && <Icon className="w-4 h-4" />}
        </div>
        <span className={`text-3xl font-black ${color} tracking-tight`}>{count}</span>
        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
}
