// The sidebar (UI plan, Phase D): grouped around what the client does — Home, Assistant, Certificates,
// Labels, Products, Uploads, Companies & brands — with the owner's tools under Admin.
// "Urgent orders" is gone: /express goes to Requests filtered by "needs review".
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Package, Tags, FileCheck, Building2, LogOut, Sparkles, ChevronDown, ChevronUp, PanelLeftClose, UploadCloud, Languages, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { useAssistantStatus } from "../context/AssistantStatusContext";
import { useSidebar, SIDEBAR_ID, shortcutLabel } from "../context/sidebarState";
import { LANG, setLang, t } from "../i18n";

// labels: sidebar.nav.<group> and sidebar.nav.<group>_.<link>; `match` = path prefixes that keep a group open
export const NAV = [
  { key: "home", path: "/dashboard", icon: Home, permission: "read_dashboard" },
  {
    key: "certificates",
    icon: Sparkles,
    match: ["/certificates", "/invoices"],
    links: [
      { key: "requests", path: "/certificates/requests", permission: "read_certificates" },
      { key: "certificates", path: "/certificates", permission: "read_certificates", end: true },
      { key: "templates", path: "/certificates/templates", permission: "read_certificate_templates" },
      { key: "numbering", path: "/certificates/numbering", permission: "read_certificate_types" },
    ],
  },
  {
    key: "labels",
    icon: Tags,
    match: ["/labels", "/reference-labels", "/regulatory-documents", "/eda-requirements"],
    links: [
      { key: "myLabels", path: "/labels/browse" },
      { key: "checkLabel", path: "/labels", end: true },
      { key: "createLabel", path: "/labels/generator" },
      { key: "referenceLabels", path: "/reference-labels" },
      { key: "regulations", path: "/regulatory-documents" },
    ],
  },
  {
    key: "products",
    icon: Package,
    permission: "read_products",
    match: ["/products", "/catalogues", "/categories"],
    links: [
      { key: "products", path: "/products", end: true },
      { key: "catalogues", path: "/catalogues" },
      { key: "conflicts", path: "/products/conflicts" },
      { key: "categories", path: "/categories", permission: "read_categories" },
    ],
  },
  { key: "uploads", path: "/uploads", icon: UploadCloud, permission: "read_products" },
  {
    key: "companies",
    icon: Building2,
    match: ["/companies", "/brands"],
    links: [
      { key: "companies", path: "/companies", permission: "read_companies" },
      { key: "brands", path: "/brands" },
    ],
  },
  {
    key: "admin",
    icon: ShieldCheck,
    permission: "read_users",
    match: ["/admin"],
    links: [
      { key: "overview", path: "/admin", end: true },
      { key: "users", path: "/admin/users", permission: "read_users" },
      { key: "roles", path: "/admin/roles", permission: "read_roles" },
      { key: "experiment", path: "/admin/experiment" },
      { key: "aiUsage", path: "/admin/ai-usage" },
      { key: "health", path: "/admin/health" },
      { key: "certificateAi", path: "/admin/certificate-ai", permission: "read_certificate_templates" },
    ],
  },
];

const linkClass = (active, sub) =>
  `flex items-center gap-3 rounded-lg text-sm transition-colors ${sub ? "px-3 py-2" : "px-3 py-2.5 font-medium"} ${
    active ? "bg-blue-50 text-blue-700 font-semibold" : sub ? "text-gray-500 hover:bg-gray-50 hover:text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;

export default function Sidebar() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const { status: assistant } = useAssistantStatus();
  const { visible, isMobile, toggle, sidebarRef } = useSidebar();
  const inGroup = (g) => (g.match || []).some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  const [open, setOpen] = useState(() => Object.fromEntries(NAV.filter((g) => g.links).map((g) => [g.key, inGroup(g)])));
  const allowed = (x) => !x.permission || hasPermission(user, x.permission);

  const renderGroup = (g) => {
    if (!allowed(g)) return null;
    if (!g.links)
      return (
        <NavLink key={g.key} to={g.path} data-testid={`nav-${g.key}`} className={({ isActive }) => linkClass(isActive)}>
          <g.icon className="w-5 h-5 opacity-75" aria-hidden="true" />
          {t(`sidebar.nav.${g.key}`)}
        </NavLink>
      );
    const links = g.links.filter(allowed);
    if (!links.length) return null;
    const isOpen = open[g.key];
    return (
      <div key={g.key} className="flex flex-col">
        <button
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
          aria-expanded={!!isOpen}
          data-testid={`nav-group-${g.key}`}
          className={`justify-between w-full ${linkClass(inGroup(g) && !isOpen)}`}
        >
          <span className="flex items-center gap-3">
            <g.icon className="w-5 h-5 opacity-75" aria-hidden="true" />
            {t(`sidebar.nav.${g.key}`)}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>
        {isOpen && (
          <div className="mt-1 ms-4 ps-4 border-s border-gray-200 flex flex-col space-y-1">
            {links.map((l) => (
              <NavLink key={l.key} to={l.path} end={!!l.end} data-testid={`nav-${g.key}-${l.key}`} className={({ isActive }) => linkClass(isActive, true)}>
                {t(`sidebar.nav.${g.key}_.${l.key}`)}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      id={SIDEBAR_ID}
      ref={sidebarRef}
      aria-label={t("sidebar.mainNavigation")}
      inert={!visible}
      data-testid="sidebar"
      data-state={visible ? "shown" : "hidden"}
      className={`w-64 bg-white border-e border-gray-200 h-screen flex flex-col fixed start-0 top-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${isMobile ? "z-50 shadow-xl" : "z-40"} ${visible ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"}`}
    >
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <FileCheck className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">Dossira</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={t("sidebar.hideSidebar")}
          aria-expanded={visible}
          aria-controls={SIDEBAR_ID}
          title={t("sidebar.hideSidebar2", { shortcutLabel: shortcutLabel() })}
          data-testid="sidebar-hide"
          className="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {renderGroup(NAV[0])}
        {assistant?.enabled && (
          <NavLink to="/assistant" data-testid="nav-assistant" className={({ isActive }) => linkClass(isActive)}>
            <span aria-hidden="true" className="w-5 text-center text-violet-600">✦</span>
            {t("sidebar.assistant")}
          </NavLink>
        )}
        {NAV.slice(1).map(renderGroup)}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <NavLink to="/account" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 uppercase">{user?.name?.charAt(0) || "·"}</div>
          <span className="truncate">{t("sidebar.myAccount")}</span>
        </NavLink>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <LogOut className="w-5 h-5 opacity-75" aria-hidden="true" />
          {t("sidebar.logout")}
        </button>
        <button type="button" onClick={() => setLang(LANG === "en" ? "ar" : "en")} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors" data-testid="lang-toggle">
          <Languages className="w-5 h-5 opacity-75" aria-hidden="true" />
          {LANG === "en" ? "العربية" : "English"}{/* i18n-ignore: each language is named in its own script */}
        </button>
      </div>
    </aside>
  );
}
