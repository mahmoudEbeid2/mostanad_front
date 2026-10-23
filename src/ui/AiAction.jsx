import { cloneElement } from "react";
import { useAiStatus } from "../context/AiStatusContext";

export const AI_OFF_TOOLTIP = (message) => (message ? `AI unavailable. ${message}` : "AI unavailable right now — do this by hand.");

/**
 * P8 — wraps one AI-triggering control. While AI is unavailable the control is
 * disabled and the reason shows as a tooltip. The tooltip sits on a wrapper
 * because a disabled button gets no pointer events (no hover, no title).
 */
export default function AiAction({ children, className = "inline-flex" }) {
  const { available, message } = useAiStatus();
  if (available) return children;
  const tip = AI_OFF_TOOLTIP(message);
  return (
    <span className={className} title={tip} tabIndex={0} aria-label={tip} data-testid="ai-action-off">
      {cloneElement(children, { disabled: true, "aria-disabled": true })}
    </span>
  );
}
