import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import io from "socket.io-client";
import Button from "../ui/Button";
import toast from "react-hot-toast";
import { retryReferenceLabelTask } from "../services/apiReferenceLabels";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function BulkProcessing() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Expecting location.state.tasks = [{ taskId, fileName }, ...]
  const [tasks, setTasks] = useState(location.state?.tasks || []);
  
  useEffect(() => {
    if (!tasks || tasks.length === 0) {
      navigate("/labels");
      return;
    }

    const socket = io(BACKEND_URL);

    socket.on("connect", () => {
      console.log("Connected to status socket for bulk processing");
      // Join all task rooms
      tasks.forEach(task => {
        socket.emit("join_job", task.taskId);
      });
    });

    socket.on("job_status", (data) => {
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.taskId === data.jobId) {
          return {
            ...task,
            status: data.status,
            progress: data.progress || task.progress || 0,
            message: data.message || task.message || "",
            error: data.error || task.error || ""
          };
        }
        return task;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [tasks.length, navigate]);

  const handleRetry = async (taskId) => {
    try {
      setTasks(prev => prev.map(t => 
        t.taskId === taskId ? { ...t, status: "pending", error: "", message: "Retrying..." } : t
      ));
      await retryReferenceLabelTask(taskId);
      toast.success("Task queued for retry");
    } catch (error) {
      toast.error(error.message || "Failed to retry task");
      setTasks(prev => prev.map(t => 
        t.taskId === taskId ? { ...t, status: "failed", error: error.message || "Retry failed" } : t
      ));
    }
  };

  const allCompleted = tasks.every(t => t.status === "completed" || t.status === "failed");

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8">
        
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Processing Documents</h2>
          <p className="text-gray-500">
            {allCompleted 
              ? "All documents have finished processing."
              : `Processing ${tasks.length} documents. Please wait...`}
          </p>
        </div>

        <div className="space-y-4 mb-10">
          {tasks.map((task, idx) => (
            <div key={task.taskId || idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              
              {/* Icon Status */}
              <div className="shrink-0">
                {task.status === "completed" ? (
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                ) : task.status === "failed" ? (
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin relative" />
                  </div>
                )}
              </div>

              {/* Details & Progress */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-gray-900 truncate pr-4">
                    {task.fileName || "Unknown File"}
                  </h4>
                  <span className="text-xs font-bold text-gray-500 shrink-0">
                    {task.status === "completed" ? "100%" : task.status === "failed" ? "Failed" : `${task.progress || 0}%`}
                  </span>
                </div>
                
                <p className="text-xs text-gray-500 truncate mb-2">
                  {task.error || task.message || (task.status === "pending" ? "Waiting to start..." : "Processing...")}
                </p>

                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ease-out ${task.status === 'failed' ? 'bg-red-500' : task.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'}`}
                    style={{ width: task.status === 'completed' ? '100%' : `${task.progress || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Action Buttons */}
              {task.status === "failed" && (
                <div className="shrink-0 ml-4">
                  <Button variant="secondary" size="sm" onClick={() => handleRetry(task.taskId)} className="flex items-center gap-1 text-sm border-gray-300">
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </Button>
                </div>
              )}

            </div>
          ))}
        </div>

        {allCompleted && (
          <div className="flex justify-center animate-in fade-in zoom-in">
            <Button onClick={() => navigate("/labels")} className="px-8 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" /> Return to Labels
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
