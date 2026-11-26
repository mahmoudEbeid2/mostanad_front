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
  Tag,
  Scale,
  PanelLeftClose,
  UploadCloud,
  Zap,
  Languages
} from "lucide-react";
import { LANG, setLang, tr } from "../i18n/lang";

const label = (l) => (LANG === "en" ? l.en || l.name : l.ar || l.name);
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { useAssistantStatus } from "../context/AssistantStatusContext";
import { useSidebar, SIDEBAR_ID, shortcutLabel } from "../context/sidebarState";

const navLinks = [
  { name: "Dashboard", ar: "الرئيسية", path: "/dashboard", icon: LayoutDashboard, permission: "read_dashboard" },
  { name: "ارفع ملفاتك", en: "Upload files", path: "/intake", icon: UploadCloud, permission: "read_products" },
  // 26 Nov: what urgent orders from the chat made (companies, products, templates, certificates, evidence) — to check
  { name: "الطلبات السريعة", en: "Urgent orders", path: "/express", icon: Zap, permission: "read_products" },
  { name: "Roles", ar: "الأدوار", path: "/roles", icon: ShieldAlert, permission: "read_roles" },
  { name: "Users", ar: "المستخدمين", path: "/users", icon: Users, permission: "read_users" },
  { name: "Companies", ar: "الشركات", path: "/companies", icon: Building2, permission: "read_companies" },
  { name: "Brands", ar: "البراندات", path: "/brands", icon: Tag },
  { name: "Categories", ar: "الفئات", path: "/categories", icon: FolderTree, permission: "read_categories" },
  { 
    name: "Products", ar: "المنتجات", 
    icon: Package,
    permission: "read_products",
    subLinks: [
      { name: "Product List", ar: "قائمة المنتجات", path: "/products" },
      { name: "Catalogues", ar: "الكتالوجات", path: "/catalogues" }
    ]
  },
  { 
    name: "Regulatory & EDA", ar: "اللوائح والتسجيل", 
    icon: Scale,
    subLinks: [
      { name: "Regulations & Rules", ar: "اللوائح والقواعد", path: "/regulatory-documents" },
      { name: "Legacy EDA Requirements", ar: "متطلبات EDA القديمة", path: "/eda-requirements" }
    ]
  },
  { 
    name: "Labels", ar: "الليبلات", 
    icon: Tags,
    subLinks: [
      { name: "My Labels", ar: "ليبلاتي", path: "/labels/browse" },
      { name: "Check a Label", ar: "افحص ليبل", path: "/labels" },
      { name: "Create a Label", ar: "اعمل ليبل", path: "/labels/generator" },
      { name: "Reference Labels", ar: "ليبلات مرجعية", path: "/reference-labels" }
    ]
  },
  {
    // Certificates V2 (CERTIFICATES_V2_PLAN.md §13.1)
    name: "Certificates", ar: "الشهادات",
    icon: Sparkles,
    subLinks: [
      { name: "Templates", ar: "القوالب", path: "/certificates/templates", permission: "read_certificate_templates" },
      { name: "Types", ar: "أنواع الشهادات", path: "/certificates/types", permission: "read_certificate_types" },
      { name: "Invoices", ar: "الفواتير", path: "/invoices", permission: "read_invoices" },
      { name: "Generated certificates", ar: "الشهادات المتعملة", path: "/certificates", permission: "read_certificates" },
      { name: "New request", ar: "طلب شهادات جديد", path: "/certificates/requests/new", permission: "create_certificates" },
      { name: "AI", ar: "الذكاء الاصطناعي", path: "/certificate-ai", permission: "read_certificate_templates" },
    ]
  },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const { status: assistant } = useAssistantStatus();
  const { visible, isMobile, toggle, sidebarRef } = useSidebar();
  const [openDropdowns, setOpenDropdowns] = useState({
    Products: location.pathname.startsWith("/products") || location.pathname.startsWith("/catalogues"),
    "Regulatory & EDA": location.pathname.startsWith("/regulatory") || location.pathname.startsWith("/eda"),
    Labels: location.pathname.startsWith("/labels") || location.pathname.startsWith("/reference-labels"),
    Certificates: location.pathname.startsWith("/certificates") || location.pathname.startsWith("/invoices") || location.pathname.startsWith("/certificate-ai")
  });

  const toggleDropdown = (name) => {
    setOpenDropdowns(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside
      id={SIDEBAR_ID}
      ref={sidebarRef}
      aria-label="Main navigation"
      inert={!visible}
      data-testid="sidebar"
      data-state={visible ? "shown" : "hidden"}
      className={`w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${isMobile ? "z-50 shadow-xl" : "z-40"} ${visible ? "translate-x-0" : "-translate-x-full"}`}
    >
      
      {/* Logo */}
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Dossira</span>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide sidebar"
          aria-expanded={visible}
          aria-controls={SIDEBAR_ID}
          title={`Hide sidebar (${shortcutLabel()})`}
          data-testid="sidebar-hide"
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {assistant?.enabled && (
          <NavLink
            to="/assistant"
            data-testid="nav-assistant"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`
            }
          >
            <span aria-hidden="true" className="w-5 text-center text-violet-600">✦</span>
            Assistant
          </NavLink>
        )}
        {navLinks.map((link) => {
          if (link.permission && !hasPermission(user, link.permission)) {
            return null;
          }

          if (link.subLinks) {
            const subLinks = link.subLinks.filter(sub => !sub.permission || hasPermission(user, sub.permission));
            if (subLinks.length === 0) return null;
            const isOpen = openDropdowns[link.name];
            const isActive = subLinks.some(sub => location.pathname === sub.path);
            return (
              <div key={label(link)} className="flex flex-col">
                <button
                  onClick={() => toggleDropdown(link.name)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full ${
                    isActive && !isOpen ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className="w-5 h-5 opacity-75" />
                    {label(link)}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {isOpen && (
                  <div className="mt-1 ml-4 pl-4 border-l border-gray-200 flex flex-col space-y-1">
                    {subLinks.map(sub => (
                      <NavLink
                        key={label(sub)}
                        to={sub.path}
                        end={sub.path === "/products" || sub.path === "/regulatory-documents" || sub.path === "/certificates"}
                        className={({ isActive: subActive }) =>
                          `block px-3 py-2 rounded-lg text-sm transition-colors ${
                            subActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                          }`
                        }
                      >
                        {label(sub)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={label(link)}
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
              {label(link)}
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
          <span className="truncate">{tr("حسابي", "My Account")}</span>
        </NavLink>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 opacity-75" />
          {tr("تسجيل الخروج", "Logout")}
        </button>
        <button
          type="button"
          onClick={() => setLang(LANG === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          data-testid="lang-toggle"
        >
          <Languages className="w-5 h-5 opacity-75" />
          {LANG === "en" ? "العربية" : "English"}
        </button>
      </div>
    </aside>
  );
}
