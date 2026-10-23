import { useEffect, useId, useRef } from "react";
import Button from "./Button";

/**
 * An in-page confirmation (replaces window.confirm, which blocks the page and
 * can't be styled). Esc or the backdrop cancels; focus starts on the safe
 * choice for a destructive action and returns to where it was on close.
 */
export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "primary", onConfirm, onCancel }) {
  const titleId = useId();
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    (tone === "danger" ? cancelRef : confirmRef).current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onCancel, tone]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4" data-testid="confirm-dialog">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        {message && <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} onClick={onConfirm} className={tone === "danger" ? "bg-red-600 hover:bg-red-700 shadow-red-500/20" : ""} data-testid="confirm-dialog-ok">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
