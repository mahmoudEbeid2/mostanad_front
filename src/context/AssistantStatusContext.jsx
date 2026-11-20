import { createContext, useContext, useEffect, useState } from "react";
import { getAssistantStatus } from "../services/apiAssistant";

// Whether the assistant is switched on for the signed-in user, read once per
// session: the sidebar item, the top-bar button and /assistant all use it.
const AssistantStatusContext = createContext({ status: null, loaded: false });

export function AssistantStatusProvider({ children }) {
  const [state, setState] = useState({ status: null, loaded: false });
  useEffect(() => {
    getAssistantStatus()
      .then((status) => setState({ status, loaded: true }))
      .catch(() => setState({ status: null, loaded: true }));
  }, []);
  return <AssistantStatusContext.Provider value={state}>{children}</AssistantStatusContext.Provider>;
}

export const useAssistantStatus = () => useContext(AssistantStatusContext);
