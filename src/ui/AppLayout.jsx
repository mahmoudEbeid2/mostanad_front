import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationManager from "./NotificationManager";

export default function AppLayout() {
  return (
    <div className="flex bg-gray-50 min-h-screen text-gray-900 font-sans">
      <NotificationManager />
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
