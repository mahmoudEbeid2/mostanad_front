import { CloudOff } from "lucide-react";
import { useAiStatus } from "../context/AiStatusContext";

/** P8 — shown on every page while AI can't answer; nothing blocks, everything is done by hand. */
export default function AiBanner() {
  const { available, message } = useAiStatus();
  if (available) return null;
  return (
    <div role="status" data-testid="ai-unavailable-banner" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <CloudOff className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <p>
        <b>AI unavailable.</b> {message} AI buttons are switched off until it's back.
      </p>
    </div>
  );
}
