import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import io from "socket.io-client";
import Button from "../ui/Button";
import { getTaskStatus } from "../services/apiProducts";

export default function Processing() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const type = searchParams.get("type") || "processing";
  
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("Initializing background task...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!jobId) return;

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socketUrl = API_URL.replace("/api/v1", "");
    const socket = io(socketUrl);

    socket.on("connect", async () => {
      console.log("Connected to status socket, joining job:", jobId);
      socket.emit("join_job", jobId);

      // Fetch initial status in case it already finished
      try {
        const res = await getTaskStatus(jobId);
        if (res.status === "success" && res.data) {
          setStatus(res.data.status);
          if (res.data.status === "completed" || res.data.status === "failed") {
            socket.disconnect();
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial status", err);
      }
    });

    socket.on("job_status", (data) => {
      if (data.jobId === jobId) {
        setStatus(data.status);
        if (data.message) setMessage(data.message);
        if (data.progress) setProgress(data.progress);
        if (data.error) setError(data.error);
        
        // If completed or failed, we can stop listening
        if (data.status === "completed" || data.status === "failed") {
          socket.disconnect();
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  const handleReturn = () => {
    if (type === "eda_requirement") {
      navigate("/eda-requirements");
    } else if (type === "label_verification") {
      navigate("/labels");
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 sm:p-12 text-center relative">
        
        {status === "pending" || status === "processing" ? (
          <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-white rounded-full p-4 shadow-sm border border-blue-50">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Processing Document
            </h2>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              {message}
            </p>
            
            <div className="w-full max-w-md bg-gray-100 rounded-full h-2 mb-2 overflow-hidden relative">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out absolute left-0 top-0" 
                style={{ width: `${progress}%` }}
              ></div>
              {/* Indeterminate loader effect if progress is 0 or stuck */}
              {(progress === 0 || status === "processing") && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
              )}
            </div>
            {progress > 0 && (
              <p className="text-xs font-semibold text-gray-400 mt-2">{progress}% Complete</p>
            )}
          </div>
        ) : status === "completed" ? (
          <div className="flex flex-col items-center justify-center animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 border border-green-100">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Complete!</h2>
            <p className="text-gray-500 mb-8">
              The document has been successfully processed and analyzed.
            </p>
            <div className="flex gap-4">
              <Button onClick={handleReturn} className="px-8">
                View Results
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Processing Failed</h2>
            <p className="text-red-600 font-medium mb-2">
              {error || "An unexpected error occurred during processing."}
            </p>
            <p className="text-gray-500 mb-8 text-sm">
              Please try uploading the document again or contact support if the issue persists.
            </p>
            <Button onClick={handleReturn} variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
