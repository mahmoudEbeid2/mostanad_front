import { useEffect } from "react";
import io from "socket.io-client";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function NotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const socket = io(BACKEND_URL);
    
    socket.on("connect", () => {
      // Connect to the company room to receive broadcasted job status updates
      const companyId = user.companyId || (user.role === "company" ? user.id : null);
      if (companyId) {
        socket.emit("join_company", companyId);
      }
    });

    socket.on("job_status", (data) => {
      // Avoid duplicating notifications if the user is currently watching the BulkProcessing page
      if (window.location.pathname === '/processing-bulk') return;
      
      if (data.status === "completed") {
        toast.success(`Background Task Finished: ${data.message || 'Processing complete'}`, {
          duration: 6000,
          position: "bottom-right",
        });
      } else if (data.status === "failed") {
        toast.error(`Background Task Failed: ${data.error || 'AI extraction failed'}`, {
          duration: 8000,
          position: "bottom-right",
        });
      }
    });

    return () => socket.disconnect();
  }, [user]);

  return null;
}
