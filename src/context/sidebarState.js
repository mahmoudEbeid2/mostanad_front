import { createContext, useContext } from "react";

// Shared pieces of the sidebar state (SidebarContext.jsx holds the provider).

export const SIDEBAR_ID = "app-sidebar";

export const isMac = () => {
  try {
    return /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || "");
  } catch {
    return false;
  }
};
export const shortcutLabel = () => (isMac() ? "⌘B" : "Ctrl+B");

export const SidebarContext = createContext(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
