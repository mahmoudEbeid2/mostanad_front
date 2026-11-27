// UI plan, Phase A §4: the main screens rendered in English show no Arabic, and in Arabic no English —
// data aside. The API answers empty here, so whatever text appears is the interface's own.
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { Component } from "react";

vi.mock("../services/apiClient", () => {
  // an empty answer whatever the screen reads: unknown fields are empty lists (length 0, map → [])
  const blank = () => new Proxy([], { get: (t, k) => (k in t || typeof k === "symbol" ? t[k] : k in Number.prototype ? () => "0" : k === "total" || k === "count" ? 0 : blank()) });
  const empty = () => Promise.resolve({ data: { success: true, data: blank() } });
  const client = { get: vi.fn(empty), post: vi.fn(empty), put: vi.fn(empty), patch: vi.fn(empty), delete: vi.fn(empty), interceptors: { request: { use() {} }, response: { use() {} } }, defaults: { headers: {} } };
  return { default: client };
});
vi.mock("socket.io-client", () => ({ io: () => ({ on() {}, off() {}, emit() {}, disconnect() {} }), default: () => ({ on() {}, off() {}, emit() {}, disconnect() {} }) }));
vi.mock("../context/AuthContext", async () => {
  const { createElement } = await import("react");
  const user = { id: "u1", name: "Test Admin", type: "system", isSystem: true, role: { name: "Admin", permissions: ["create_categories","create_certificate_templates","create_certificate_types","create_certificates","create_companies","create_eda_requirements","create_invoices","create_plans","create_products","create_roles","create_subscriptions","create_templates","create_users","delete_categories","delete_certificate_types","delete_certificates","delete_companies","delete_eda_requirements","delete_plans","delete_products","delete_roles","delete_subscriptions","delete_templates","delete_users","manage_assistant_settings","manage_catalogues","publish_global_reference","read_ai_costs","read_categories","read_certificate_templates","read_certificate_types","read_certificates","read_companies","read_dashboard","read_eda_requirements","read_invoices","read_labels","read_plans","read_products","read_roles","read_subscriptions","read_templates","read_users","update_categories","update_certificate_templates","update_certificate_types","update_certificates","update_companies","update_eda_requirements","update_invoices","update_labels","update_plans","update_products","update_roles","update_subscriptions","update_templates","update_users"] }, permissions: ["*"] };
  return {
    AuthProvider: ({ children }) => createElement("div", null, children),
    useAuth: () => ({ user, isAuthenticated: true, loading: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }),
  };
});

// Node's own (flag-less, empty) localStorage would shadow jsdom's: a plain one in memory
const store = new Map();
const memoryStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });

globalThis.EventSource = class {
  close() {}
  addEventListener() {}
};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

const crashes = [];
class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    crashes.push(`${this.props.name}: ${error.message}`);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

// screens: [route path, module, route pattern]
const SCREENS = [
  ["/dashboard", "../pages/Dashboard", "/dashboard"],
  ["/intake", "../pages/Intake", "/intake"],
  ["/certificates/requests", "../pages/CertificateRequests", "/certificates/requests"],
  ["/certificates/requests/new", "../pages/CertificateRequest", "/certificates/requests/new"],
  ["/certificates", "../pages/CertificatesList", "/certificates"],
  ["/certificates/templates", "../pages/CertificateTemplates", "/certificates/templates"],
  ["/certificates/numbering", "../pages/CertificateTypes", "/certificates/numbering"],
  ["/invoices", "../pages/Invoices", "/invoices"],
  ["/products", "../pages/Products", "/products"],
  ["/labels/browse", "../pages/LabelsList", "/labels/browse"],
  ["/labels", "../pages/Labels", "/labels"],
  ["/labels/generator", "../pages/LabelGenerator", "/labels/generator"],
  ["/companies", "../pages/Companies", "/companies"],
  ["/users", "../pages/Users", "/users"],
  ["/roles", "../pages/Roles", "/roles"],
  ["/brands", "../pages/Brands", "/brands"],
  ["/account", "../pages/Account", "/account"],
  ["/admin/experiment", "../pages/AdminExperiment", "/admin/experiment"],
  ["/certificate-ai", "../pages/CertificateAi", "/certificate-ai"],
  ["/express/items", "../pages/ExpressReview", "/express/items"],
  ["/admin", "../pages/Placeholders", "/admin"],
  ["/catalogues", "../pages/Catalogues", "/catalogues"],
  ["/reference-labels", "../pages/ReferenceLabels", "/reference-labels"],
];
const pages = import.meta.glob("../pages/*.jsx");
const AR = /[؀-ۿ]/;
// what may stay Latin on an Arabic screen: technical identifiers and the English switch
const LATIN_OK = new Set(["PDF", "ZIP", "COA", "COC", "HC", "FSC", "COO", "AI", "MB", "pH", "GTIN", "TSV", "CSV", "HTML", "Ctrl", "K", "Enter", "Shift", "Dossira", "English", "EDA", "SFDA", "ID", "URL", "v", "ms", "px", "Excel", "Word", "Illustrator", "PNG", "JPEG", "JPG", "WebP", "AI", "DOCX", "ATS", "IU", "Test", "Admin", "U", "T", "Vitamin", "E", "LTR", "RTL", "Global", "AKS", "LIVATOMIC", "HEMOZEX", "mL", "ai", "SAMPLE", "NOT", "VALID"]);

const textOf = (root) => {
  // one entry per text node, so neighbouring chips don't run together
  const parts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.trim()) parts.push(n.nodeValue);
  root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach((el) => {
    for (const a of ["placeholder", "title", "aria-label", "alt"]) if (el.getAttribute(a)) parts.push(el.getAttribute(a));
  });
  return parts.join(" \n ");
};

async function renderIn(lang) {
  vi.resetModules();
  localStorage.setItem("lang", lang);
  const { MemoryRouter, Routes, Route } = await import("react-router-dom");
  const results = [];
  for (const [path, mod, pattern] of SCREENS) {
    const loader = pages[`${mod}.jsx`];
    if (!loader) continue;
    const Page = (await loader()).default;
    let container;
    await act(async () => {
      ({ container } = render(
        <Boundary name={path}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={pattern} element={<Page />} />
            </Routes>
          </MemoryRouter>
        </Boundary>,
      ));
      await new Promise((r) => setTimeout(r, 50));
    });
    results.push([path, textOf(container)]);
    if (process.env.I18N_DEBUG) console.log(path, JSON.stringify(textOf(container).slice(0, process.env.I18N_DEBUG === "full" ? 5000 : 120)));
    cleanup();
  }
  // the sidebar, once
  const Sidebar = (await import("../ui/Sidebar")).default;
  const { SidebarProvider } = await import("../context/SidebarContext");
  let container;
  await act(async () => {
    ({ container } = render(
      <Boundary>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <SidebarProvider>
            <Sidebar />
          </SidebarProvider>
        </MemoryRouter>
      </Boundary>,
    ));
  });
  results.push(["(sidebar)", textOf(container)]);
  cleanup();
  return results;
}

afterEach(() => cleanup());

describe("UI language", () => {
  it("English screens show no Arabic", async () => {
    const results = await renderIn("en");
    const bad = [];
    for (const [path, text] of results) {
      // the language switch names Arabic in Arabic: the one Arabic word allowed
      const lines = text.replace(/العربية/g, "").split("\n").filter((l) => AR.test(l));
      if (lines.length) bad.push(`${path}: ${lines.map((l) => l.trim().slice(0, 80)).join(" | ")}`);
    }
    expect(bad).toEqual([]);
    expect(crashes).toEqual([]);
    expect(results.filter(([, t]) => t.trim().length > 0).length).toBeGreaterThan(10);
  });

  it("Arabic screens show no English", async () => {
    const results = await renderIn("ar");
    const bad = [];
    for (const [path, text] of results) {
      // snake_case identifiers (permission slugs) are technical, not words
      const words = (text.match(/[A-Za-z][A-Za-z'_]+/g) || []).filter((w) => !LATIN_OK.has(w) && !w.includes("_") && !/^[A-Z]{2}$/.test(w));
      // a country code beside its name, a file extension, the watermark printed on samples: technical
      if (words.length) bad.push(`${path}: ${[...new Set(words)].slice(0, 15).join(", ")}`);
    }
    expect(bad).toEqual([]);
    expect(document.documentElement.dir).toBe("rtl");
  });
});
