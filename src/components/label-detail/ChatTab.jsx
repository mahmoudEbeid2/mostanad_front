import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Bot, User, ShieldAlert, FileText, CheckCircle2, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getChat, postChat } from "../../services/apiGeneratedLabels";
import Button from "../../ui/Button";

export default function ChatTab({ labelId, currentVersion, onLabelUpdated, initialMessage = "" }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeConflict, setActiveConflict] = useState(null);
  const [staleError, setStaleError] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const history = await getChat(labelId);
      setMessages(history || []);
    } catch (err) {
      toast.error(err.message || "Failed to load chat history");
    } finally {
      setIsLoading(false);
    }
  }, [labelId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (initialMessage) setInputMessage(initialMessage);
  }, [initialMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConflict, isSending, staleError]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputMessage]);

  const handleSendMessage = async (overrideAcknowledged = false, textToSend = null) => {
    const text = textToSend || (overrideAcknowledged ? activeConflict?.originalMessage : inputMessage.trim());
    if (!text && !overrideAcknowledged) return;

    try {
      setIsSending(true);
      setStaleError(null);
      
      if (!overrideAcknowledged) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text, createdAt: new Date().toISOString() },
        ]);
        if (!textToSend) setInputMessage("");
      }

      setActiveConflict(null);

      const result = await postChat(labelId, {
        message: text,
        expectedVersion: currentVersion,
        overrideAcknowledged: overrideAcknowledged ? true : undefined,
      });

      if (result.intent === "question" || result.intent === "explain_validation" || (!result.status && result.answer)) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.answer,
            intent: result.intent,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else if (result.status === "applied") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.answer || "",
            status: "applied",
            patch: result.appliedPatch,
            resultVersion: result.resultVersion,
            overrideAcknowledged: result.overrideAcknowledged,
            createdAt: new Date().toISOString(),
          },
        ]);
        toast.success(`Label updated to v${result.resultVersion}`);
        onLabelUpdated?.();
      }
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 409 && errData?.data?.status === "conflict") {
        setActiveConflict({
          ...errData.data,
          originalMessage: text,
        });
      } else if (err.response?.status === 409) {
        setStaleError({ originalMessage: text });
      } else {
        toast.error(errData?.message || err.message || "Failed to process chat message");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleConflictOption = (option) => {
    if (option === "revert") {
      setActiveConflict(null);
    } else if (option === "override") {
      handleSendMessage(true);
    } else if (option === "edit") {
      setInputMessage(activeConflict?.originalMessage || "");
      setActiveConflict(null);
    }
  };
  
  const handlePromptClick = (prompt) => {
    handleSendMessage(false, prompt);
  };

  const getPatchDiffHtml = (patchList) => {
    if (!patchList || !patchList.length) return null;
    return (
      <div className="mt-3 space-y-2">
        {patchList.map((op, i) => (
          <div key={i} className="bg-white rounded p-2 text-xs border border-gray-200">
            <div className="font-mono font-semibold text-gray-700 mb-1">{op.path}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-50 text-red-800 p-1.5 rounded border border-red-100">
                <span className="block text-[10px] text-red-500 uppercase font-bold mb-0.5">Before</span>
                {JSON.stringify(op.oldValue) || "empty"}
              </div>
              <div className="bg-green-50 text-green-800 p-1.5 rounded border border-green-100">
                <span className="block text-[10px] text-green-500 uppercase font-bold mb-0.5">After</span>
                {JSON.stringify(op.value)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-gray-900 text-sm">Regulatory AI Editor & Assistant</span>
          <span className="text-xs text-gray-400 font-mono">v{currentVersion}</span>
        </div>
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors"
          title="Refresh chat history"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto mb-4 text-blue-200" />
            <p className="text-sm font-medium text-gray-900 mb-6">What would you like to do?</p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              <button onClick={() => handlePromptClick("Why is this failing?")} className="px-4 py-2 text-sm text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-xl border border-gray-200 transition-colors">
                "Why is this failing?"
              </button>
              <button onClick={() => handlePromptClick("Add cattle and sheep")} className="px-4 py-2 text-sm text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-xl border border-gray-200 transition-colors">
                "Add cattle and sheep"
              </button>
              <button onClick={() => handlePromptClick("What is still missing?")} className="px-4 py-2 text-sm text-left bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-xl border border-gray-200 transition-colors">
                "What is still missing?"
              </button>
            </div>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          
          if (isUser) {
             return (
              <div key={idx} className="flex gap-3 justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-blue-600 text-white rounded-br-none">
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <div className="text-[10px] text-blue-100 mt-1 text-right">
                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              </div>
             );
          }
          
          return (
            <div key={idx} className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-gray-100 text-gray-900 rounded-bl-none space-y-2 border border-gray-200">
                {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}

                {m.status === "applied" && (
                  <div className="bg-white rounded-xl p-4 border-2 border-green-200">
                    <div className="flex items-center gap-2 font-bold text-green-700 mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Applied edit (v{m.resultVersion})</span>
                    </div>
                    {m.overrideAcknowledged && (
                      <p className="text-orange-700 text-xs font-semibold flex items-center gap-1 mb-2 bg-orange-50 p-1.5 rounded">
                        <AlertTriangle className="w-3.5 h-3.5" /> Override recorded
                      </p>
                    )}
                    {getPatchDiffHtml(m.patch)}
                  </div>
                )}

                <div className="text-[10px] text-gray-400 mt-1 text-right">
                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
           <div className="flex gap-3 justify-start opacity-70">
             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
               <Bot className="w-4 h-4" />
             </div>
             <div className="rounded-2xl px-4 py-3 text-sm bg-gray-100 text-gray-600 rounded-bl-none border border-gray-200">
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Checking rules and trying the change...</span>
               </div>
             </div>
           </div>
        )}

        {staleError && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5 text-sm text-orange-900 space-y-3 shadow-sm">
             <div className="flex items-center gap-2 font-bold text-orange-800">
              <RefreshCw className="w-5 h-5 flex-shrink-0" />
              <span>Someone else changed the label</span>
            </div>
            <p>Your edit was not applied because a newer version of the label exists.</p>
            <Button onClick={() => { setInputMessage(staleError.originalMessage); setStaleError(null); onLabelUpdated?.(); }}>
               Reload latest version
            </Button>
          </div>
        )}

        {activeConflict && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 text-sm text-rose-950 space-y-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-800 text-base border-b border-rose-200 pb-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>This change was not applied</span>
            </div>

            {activeConflict.wouldViolate?.length > 0 && (
              <div className="space-y-3">
                {activeConflict.wouldViolate.map((violation, idx) => (
                  <div key={`${violation.ruleKey || idx}-${violation.path || idx}`} className="bg-white rounded-xl p-4 border border-rose-200 text-sm space-y-2">
                    {violation.message && <p className="text-gray-900 font-medium">{violation.message}</p>}
                    {violation.citation && (
                      <div className="flex items-start gap-2 text-gray-600 italic bg-gray-50 p-2.5 rounded-lg border border-gray-200 text-xs">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span>&ldquo;{violation.citation}&rdquo;</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleConflictOption("revert")}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 w-full text-center transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={() => handleConflictOption("edit")}
                className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold hover:bg-blue-100 w-full text-center transition-colors"
              >
                Fix the blocker first {activeConflict.wouldViolate?.[0]?.path ? `— ${activeConflict.wouldViolate[0].path.split(".").pop()}` : ""}
              </button>

              <button
                onClick={() => handleConflictOption("override")}
                className="px-4 py-2.5 rounded-xl border-2 border-rose-500 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 w-full text-center transition-colors mt-2"
              >
                Apply anyway and record my override
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(false);
          }}
          className="flex items-end gap-3"
        >
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(false);
              }
            }}
            disabled={isSending}
            placeholder="Type an edit instruction or question... (Shift+Enter for a new line)"
            rows={1}
            className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm leading-normal resize-none overflow-y-auto max-h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
          <Button type="submit" disabled={!inputMessage.trim() || isSending} isLoading={isSending}>
            <Send className="w-4 h-4" /> Send
          </Button>
        </form>
      </div>
    </div>
  );
}