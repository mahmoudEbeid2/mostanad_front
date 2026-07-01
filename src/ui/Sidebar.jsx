import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Package, 
  Tags, 
  FileCheck, 
  BookOpen, 
  Users, 
  Building2, 
  User, 
  LogOut 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Roles", path: "/roles", icon: ShieldAlert },
  { name: "Products", path: "/products", icon: Package },
  { name: "Labels", path: "/labels", icon: Tags },
  { name: "Certificates", path: "/certificates", icon: FileCheck },
  { name: "Catalogs", path: "/catalogs", icon: BookOpen },
  { name: "Users", path: "/users", icon: Users },
  { name: "Companies", path: "/companies", icon: Building2 },
];

export default function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0">
      
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Mostanad</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            <link.icon className="w-5 h-5 opacity-75" />
            {link.name}
          </NavLink>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <NavLink
          to="/account"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`
          }
        >
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
            {user?.name?.charAt(0) || "U"}
          </div>
          <span className="truncate">My Account</span>
        </NavLink>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 opacity-75" />
          Logout
        </button>
      </div>

    </aside>
  );
}
