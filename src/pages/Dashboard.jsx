import { useAuth } from "../context/AuthContext";
import { LogOut, LayoutDashboard, Shield, User, Mail, ShieldAlert } from "lucide-react";
import Button from "../ui/Button";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 pb-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4 sm:mb-0">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <LayoutDashboard className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
              <p className="text-sm text-gray-400">Manage your workspace and view your stats</p>
            </div>
          </div>
          <Button variant="secondary" onClick={logout} className="text-sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </header>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* User Profile Card */}
          <div className="lg:col-span-1 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-800">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-blue-500/20">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-1">
                  <Shield className="w-3 h-3" />
                  {user?.role?.name || "User"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-gray-800 rounded-lg text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Username</p>
                  <p className="text-gray-200">{user?.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-gray-800 rounded-lg text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Email Address</p>
                  <p className="text-gray-200">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions Card */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Active Permissions</h2>
            </div>
            
            <div className="flex-1 bg-gray-950/50 rounded-xl p-5 border border-gray-800">
              <div className="flex flex-wrap gap-2.5">
                {user?.role?.permissions?.length > 0 ? (
                  user.role.permissions.map(perm => (
                    <span 
                      key={perm} 
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 hover:text-white transition-colors cursor-default"
                    >
                      {perm}
                    </span>
                  ))
                ) : (
                  <div className="w-full flex flex-col items-center justify-center text-center py-8 text-gray-500">
                    <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                    <p>No special permissions assigned to your account.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
