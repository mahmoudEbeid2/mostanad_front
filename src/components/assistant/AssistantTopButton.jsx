import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAssistantStatus } from "../../context/AssistantStatusContext";
import { fromOf } from "../../utils/assistantContext";

/** ✦ in the top bar (and Ctrl/Cmd+K): opens /assistant with the current page as context. */
export default function AssistantTopButton() {
  const { status } = useAssistantStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const enabled = !!status?.enabled;
  const onAssistant = location.pathname.startsWith("/assistant");

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!onAssistant) {
          const from = fromOf(location.pathname, location.search);
          navigate(from ? `/assistant?from=${from}` : "/assistant");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onAssistant, location.pathname, location.search, navigate]);

  if (!enabled || onAssistant) return null;
  const from = fromOf(location.pathname, location.search);
  return (
    <button
      type="button"
      data-testid="assistant-button"
      title="Assistant (Ctrl+K)"
      aria-label="Open the assistant"
      onClick={() => navigate(from ? `/assistant?from=${from}` : "/assistant")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-violet-600 shadow-sm hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <span aria-hidden="true" className="text-lg leading-none">✦</span>
    </button>
  );
}
