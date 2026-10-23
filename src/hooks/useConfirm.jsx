import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog";

/**
 * const [confirm, confirmDialog] = useConfirm();
 * if (!(await confirm({ title, message, confirmLabel, tone }))) return;
 * …and render {confirmDialog} once in the component.
 */
export default function useConfirm() {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);
  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest(opts);
      }),
    []
  );
  const close = useCallback((ok) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setRequest(null);
  }, []);
  const onCancel = useCallback(() => close(false), [close]);
  const onConfirm = useCallback(() => close(true), [close]);
  const dialog = request ? <ConfirmDialog {...request} onCancel={onCancel} onConfirm={onConfirm} /> : null;
  return [confirm, dialog];
}
