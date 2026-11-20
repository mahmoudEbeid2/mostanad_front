import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAssistantStatus } from "../../context/AssistantStatusContext";
import { fromOf } from "../../utils/assistantContext";

// Design E0: the floating ✦ button, bottom-right on every page (not on
// /assistant). It navigates to the assistant with this page as context, as
// Ctrl/Cmd+K does. It never covers the page: hidden while a modal or overlay
// is open, lifted above anything else fixed in the bottom-right corner (e.g.
// the label chat button).

const GAP = 28; // px from the corner, as in E0
const ZONE_W = 140;
const ZONE_H = 120;

/** → { hidden, lift } from what is on the page right now. */
function measure(self) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let hidden = !!document.querySelector('[role="dialog"]:not([data-assistant-page]), [aria-modal="true"]');
  let lift = 0;
  if (!hidden) {
    for (const el of document.querySelectorAll('[class*="fixed"], [class*="sticky"], [data-bottom-action]')) {
      if (self && (el === self || self.contains(el) || el.contains(self))) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width >= vw * 0.8 && r.height >= vh * 0.8) {
        hidden = true; // a full-screen overlay: a modal
        break;
      }
      if (r.right > vw - ZONE_W && r.bottom > vh - ZONE_H && r.left < vw && el.closest("aside") === null) lift = Math.max(lift, vh - r.top + 12 - GAP);
    }
  }
  return { hidden, lift };
}

export default function AssistantFab() {
  const { status } = useAssistantStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [state, setState] = useState({ hidden: false, lift: 0 });
  const enabled = !!status?.enabled;
  const onAssistant = location.pathname.startsWith("/assistant");

  const open = useCallback(() => {
    const from = fromOf(location.pathname, location.search);
    navigate(from ? `/assistant?from=${from}` : "/assistant");
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !onAssistant) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onAssistant, open]);

  // watch the page for modals and bottom toolbars (throttled to one check per frame)
  useEffect(() => {
    if (!enabled || onAssistant) return undefined;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure(ref.current);
        setState((s) => (s.hidden === next.hidden && s.lift === next.lift ? s : next));
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "role", "aria-modal"] });
    window.addEventListener("resize", check);
    check();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [enabled, onAssistant, location.pathname]);

  if (!enabled || onAssistant || state.hidden) return null;
  return (
    <div ref={ref} className="group fixed z-40 flex items-center gap-2.5 print:hidden" style={{ right: GAP, bottom: GAP + state.lift }} data-testid="assistant-fab">
      <span role="tooltip" id="assistant-fab-tip" className="pointer-events-none whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        Ask Dossira · Ctrl K
      </span>
      <button
        type="button"
        onClick={open}
        aria-label="Open the assistant"
        aria-describedby="assistant-fab-tip"
        data-testid="assistant-button"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
      </button>
    </div>
  );
}
