import { Outlet, useLocation } from "react-router-dom";
import { PanelLeftOpen } from "lucide-react";
import Sidebar from "./Sidebar";
import NotificationManager from "./NotificationManager";
import AiBanner from "./AiBanner";
import { AiStatusProvider } from "../context/AiStatusContext";
import { AssistantStatusProvider } from "../context/AssistantStatusContext";
import { SidebarProvider } from "../context/SidebarContext";
import { useSidebar, SIDEBAR_ID, shortcutLabel } from "../context/sidebarState";
import AssistantFab from "../components/assistant/AssistantFab";

export default function AppLayout() {
  return (
    <AiStatusProvider>
      <AssistantStatusProvider>
        <SidebarProvider>
          <Shell />
        </SidebarProvider>
      </AssistantStatusProvider>
    </AiStatusProvider>
  );
}

// the content takes the sidebar's width when it is hidden; a 56 px gutter keeps room for the button that brings it back
const MOTION = "transition-[margin] duration-200 ease-out motion-reduce:transition-none";

function Shell() {
  const { visible, isMobile, toggle, closeMobile, openerRef } = useSidebar();
  // the assistant (design E1) is a full-bleed page: its own columns, no padding
  const fullBleed = useLocation().pathname.startsWith("/assistant");
  const offset = !isMobile && visible ? "ml-64" : "ml-14";
  return (
    <div className="flex bg-gray-50 min-h-screen text-gray-900 font-sans">
      <NotificationManager />
      <Sidebar />
      {isMobile && visible && <div aria-hidden="true" data-testid="sidebar-backdrop" onClick={closeMobile} className="fixed inset-0 z-40 bg-gray-900/40" />}
      {!visible && (
        <button
          ref={openerRef}
          type="button"
          onClick={toggle}
          aria-label="Show sidebar"
          aria-expanded={false}
          aria-controls={SIDEBAR_ID}
          title={`Show sidebar (${shortcutLabel()})`}
          data-testid="sidebar-show"
          className="fixed left-2.5 top-3 z-40 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      )}
      {fullBleed ? (
        <main className={`flex-1 ${offset} ${MOTION} h-screen min-w-0 overflow-hidden`}>
          <Outlet />
        </main>
      ) : (
        <main className={`flex-1 ${offset} ${MOTION} p-8 overflow-y-auto h-screen min-w-0`}>
          <div className="max-w-6xl mx-auto">
            <AiBanner />
            <Outlet />
          </div>
        </main>
      )}
      <AssistantFab />
    </div>
  );
}
