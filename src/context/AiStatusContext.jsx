import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAiStatus } from "../services/apiCertificateAi";

// plan.md P8 — one place that knows whether AI can answer. The layout shows a
// banner from it and every AI action is gated through <AiAction>. While the
// status is unknown (loading, or the check itself failed) AI actions stay
// enabled: an action that then fails still explains itself.
const AiStatusContext = createContext({ available: true, message: null, reason: null, refresh: () => {} });
const POLL_MS = 60_000;

export function AiStatusProvider({ children }) {
  const [status, setStatus] = useState(null);
  const refresh = useCallback(() => {
    getAiStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);
  const value = { available: status ? status.available : true, message: status?.message || null, reason: status?.reason || null, refresh };
  return <AiStatusContext.Provider value={value}>{children}</AiStatusContext.Provider>;
}

export const useAiStatus = () => useContext(AiStatusContext);
