import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationManager from "./NotificationManager";
import AiBanner from "./AiBanner";
import { AiStatusProvider } from "../context/AiStatusContext";
import { AssistantStatusProvider } from "../context/AssistantStatusContext";
import AssistantFab from "../components/assistant/AssistantFab";

export default function AppLayout() {
  // the assistant (design E1) is a full-bleed page: its own columns, no padding
  const fullBleed = useLocation().pathname.startsWith("/assistant");
  return (
    <AiStatusProvider>
      <AssistantStatusProvider>
        <div className="flex bg-gray-50 min-h-screen text-gray-900 font-sans">
          <NotificationManager />
          <Sidebar />
          {fullBleed ? (
            <main className="flex-1 ml-64 h-screen min-w-0 overflow-hidden">
              <Outlet />
            </main>
          ) : (
            <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
              <div className="max-w-6xl mx-auto">
                <AiBanner />
                <Outlet />
              </div>
            </main>
          )}
          <AssistantFab />
        </div>
      </AssistantStatusProvider>
    </AiStatusProvider>
  );
}
