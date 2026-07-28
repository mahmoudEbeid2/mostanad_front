import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Package, 
  Tags, 
  FileCheck, 
  Users, 
  Building2, 
  LogOut,
  FolderTree,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, permission: "read_dashboard" },
  { name: "Roles", path: "/roles", icon: ShieldAlert, permission: "read_roles" },
  { name: "Users", path: "/users", icon: Users, permission: "read_users" },
  { name: "Companies", path: "/companies", icon: Building2, permission: "read_companies" },
  { name: "Brands", path: "/brands", icon: Tag }, // Anyone can view brands right now
  { name: "Categories", path: "/categories", icon: FolderTree, permission: "read_categories" },
  { 
    name: "Products", 
    icon: Package,
    permission: "read_products",
    subLinks: [
      { name: "Product List", path: "/products" },
      { name: "Catalog Upload", path: "/products/catalog-upload" }
    ]
  },
  { 
    name: "Labels & EDA", 
    icon: Tags,
    subLinks: [
      { name: "Manage Labels", path: "/labels" },
      { name: "EDA Requirements", path: "/eda-requirements" },
      { name: "AI Reference Labels", path: "/reference-labels" }
    ]
  },
  { 
    name: "Templates", 
    icon: FileCheck,
    permission: "read_templates",
    subLinks: [
      { name: "Templates List", path: "/templates" },
      { name: "Template Editor", path: "/templates/editor" },
      { name: "AI Generator", path: "/templates/ai" }
    ]
  },
  { 
    name: "Certificates", 
    icon: Sparkles,
    permission: "read_certificates",
    subLinks: [
      { name: "Generator", path: "/certificates/generate" }
    ]
  },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState({
    Products: location.pathname.startsWith("/products"),
    Templates: location.pathname.startsWith("/templates"),
    Certificates: location.pathname.startsWith("/certificates")
  });

  const toggleDropdown = (name) => {
    setOpenDropdowns(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-40">
      
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Mostanad</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navLinks.map((link) => {
          const assignedSlugs = user?.role?.permissions?.map(p => typeof p === 'string' ? p : p?.permission?.slug).filter(Boolean) || [];
          
          if (link.permission && !assignedSlugs.includes(link.permission)) {
            return null; // Hide link if user lacks permission
          }

          if (link.subLinks) {
            const isOpen = openDropdowns[link.name];
            const isActive = link.subLinks.some(sub => location.pathname === sub.path);
            return (
              <div key={link.name} className="flex flex-col">
                <button
                  onClick={() => toggleDropdown(link.name)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                    isActive && !isOpen ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className="w-5 h-5 opacity-75" />
                    {link.name}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {isOpen && (
                  <div className="mt-1 ml-4 pl-4 border-l border-gray-200 flex flex-col space-y-1">
                    {link.subLinks.map(sub => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        end={sub.path === "/products"} // so exact match for /products
                        className={({ isActive: subActive }) =>
                          `block px-3 py-2 rounded-lg text-sm transition-colors ${
                            subActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
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
          );
        })}
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
