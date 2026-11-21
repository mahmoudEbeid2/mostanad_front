import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarContext, isMac } from "./sidebarState";

// The main navigation sidebar's shown / hidden state, for every page (AppLayout).
// Desktop (≥ 1024 px): the person's choice, kept per browser in localStorage.
// Small screens: hidden by default, opened as an overlay; the desktop choice
// never applies there. Ctrl+B (⌘B on a Mac) toggles whichever applies.

const STORAGE_KEY = "mostanad.sidebar.hidden";
const MOBILE_QUERY = "(max-width: 1023px)";

function readHidden() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false; // no storage (private window, blocked): shown
  }
}
function writeHidden(hidden) {
  try {
    window.localStorage.setItem(STORAGE_KEY, hidden ? "true" : "false");
  } catch {
    /* no storage: the choice lasts until the page is reloaded */
  }
}

const mobileNow = () => typeof window !== "undefined" && !!window.matchMedia?.(MOBILE_QUERY).matches;

const isTyping = (el) => !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));



export function SidebarProvider({ children }) {
  const [desktopHidden, setDesktopHidden] = useState(readHidden);
  const [isMobile, setIsMobile] = useState(mobileNow);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef(null); // the <aside>
  const openerRef = useRef(null); // the "Show sidebar" button: focus returns there when the overlay closes
  const location = useLocation();

  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY);
    if (!mq) return undefined;
    const onChange = () => {
      setIsMobile(mq.matches);
      setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const visible = isMobile ? mobileOpen : !desktopHidden;

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggle = useCallback(() => (mobileNow() ? setMobileOpen((open) => !open) : setDesktopHidden((h) => !h)), []);

  useEffect(() => writeHidden(desktopHidden), [desktopHidden]);

  // the overlay closed (button, backdrop, Esc, navigation): focus goes back to the button that opens it
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !mobileOpen) requestAnimationFrame(() => openerRef.current?.focus());
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  // Ctrl+B / ⌘B — not while typing, so it never fights text editing
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.shiftKey) return;
      if (!(isMac() ? e.metaKey : e.ctrlKey) || e.key.toLowerCase() !== "b") return;
      if (isTyping(document.activeElement)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // the overlay: Esc closes it, and focus moves into the sidebar when it opens
  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined;
    requestAnimationFrame(() => sidebarRef.current?.querySelector("button, a[href]")?.focus());
    const onKey = (e) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, mobileOpen, closeMobile]);

  // navigating closes the overlay
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const value = useMemo(() => ({ visible, isMobile, toggle, closeMobile, sidebarRef, openerRef }), [visible, isMobile, toggle, closeMobile]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
