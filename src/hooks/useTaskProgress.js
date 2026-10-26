import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import apiClient from "../services/apiClient";

// Background task progress (plan §13.2): polls GET /background-tasks/:id every
// 2 s, and uses the socket `job_status` event only as a hint for progress and
// an early re-poll. Stops on a terminal state. The task row is the truth.
const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";
const TERMINAL = new Set(["completed", "failed"]);

export default function useTaskProgress(taskId, { intervalMs = 2000, onDone } = {}) {
  const [state, setState] = useState({ status: taskId ? "pending" : null, progress: 0, message: "", error: null, result: null });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!taskId) return undefined;
    let stopped = false;
    let timer = null;
    setState({ status: "pending", progress: 0, message: "", error: null, result: null });

    const finish = (task) => {
      stopped = true;
      clearTimeout(timer);
      setState((s) => ({ ...s, status: task.status, error: task.error || null, result: task.result || null, progress: task.status === "completed" ? 100 : s.progress }));
      onDoneRef.current?.(task);
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const { data } = await apiClient.get(`/background-tasks/${taskId}`);
        const task = data?.data;
        if (task && TERMINAL.has(task.status)) return finish(task);
        if (task) setState((s) => ({ ...s, status: task.status }));
      } catch (err) {
        if (err.response?.status === 404) return finish({ status: "failed", error: "Task not found" });
      }
      if (!stopped) timer = setTimeout(poll, intervalMs);
    };

    const socket = io(BACKEND_URL);
    socket.on("connect", () => socket.emit("join_job", taskId));
    socket.on("job_status", (data) => {
      if (data?.jobId !== taskId || stopped) return;
      // a job with named stages (e.g. "Prepare certificates") also says which one runs
      if (typeof data.progress === "number") setState((s) => ({ ...s, progress: data.progress, message: data.message || s.message, ...(data.stage ? { stage: data.stage } : {}), ...(data.stages ? { stages: data.stages } : {}) }));
      if (TERMINAL.has(data.status)) {
        clearTimeout(timer);
        poll();
      }
    });

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [taskId, intervalMs]);

  return { ...state, done: TERMINAL.has(state.status) };
}
