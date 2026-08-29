import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Bot, User, ShieldAlert, FileText, CheckCircle2, AlertTriangle, RefreshCw, CornerDownRight } from "lucide-react";
import toast from "react-hot-toast";
import { getChat, postChat } from "../../services/apiGeneratedLabels";
import Button from "../../ui/Button";

export default function ChatTab({ labelId, currentVersion, onLabelUpdated }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeConflict, setActiveConflict] = useState(null); // { proposedPatch, wouldViolate, options, originalMessage }
  const messagesEndRef = useRef(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConflict]);

  const handleSendMessage = async (overrideAcknowledged = false) => {
    const text = overrideAcknowledged ? activeConflict?.originalMessage : inputMessage.trim();
    if (!text && !overrideAcknowledged) return;

    try {
      setIsSending(true);
      if (!overrideAcknowledged) {
        // Optimistically add user message to list
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text, createdAt: new Date().toISOString() },
        ]);
        setInputMessage("");
      }

      setActiveConflict(null);

      const result = await postChat(labelId, {
        message: text,
        expectedVersion: currentVersion,
        overrideAcknowledged: overrideAcknowledged ? true : undefined,
      });

      // Handle 3 distinct outcomes:
      if (result.intent === "question" || result.intent === "explain_validation" || (!result.status && result.answer)) {
        // Outcome 1: Informational answer (No version bump)
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
        // Outcome 2: Applied patch (Version bumped, label and validation report refreshed)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.answer || `Applied edit. Version updated to v${result.resultVersion}.`,
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
        // Outcome 3: Regulatory Conflict (Change was NOT applied)
        setActiveConflict({
          ...errData.data,
          originalMessage: text,
        });
      } else if (err.response?.status === 409) {
        toast.error(errData?.message || "Version conflict: another user changed this label. Reloading...");
        onLabelUpdated?.();
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
      toast("Cancelled proposed edit.", { icon: "ℹ️" });
    } else if (option === "override") {
      handleSendMessage(true);
    } else if (option === "edit") {
      setInputMessage(activeConflict?.originalMessage || "");
      setActiveConflict(null);
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-16 text-gray-400">
            <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Ask a question or request an edit</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Examples: &ldquo;Why is this label failing validation?&rdquo;, &ldquo;Add beef cattle to target species&rdquo;, or &ldquo;What fields are still missing?&rdquo;
            </p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div key={idx} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                isUser
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-900 rounded-bl-none space-y-2 border border-gray-200"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>

                {m.status === "applied" && (
                  <div className="bg-white/80 rounded-xl p-3 border border-green-200 text-xs text-green-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Patch Applied (Version bumped to v{m.resultVersion})</span>
                    </div>
                    {m.overrideAcknowledged && (
                      <p className="text-orange-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Applied over a regulatory conflict
                      </p>
                    )}
                  </div>
                )}

                <div className={`text-[10px] ${isUser ? "text-blue-100" : "text-gray-400"} mt-1 text-right`}>
                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Active Conflict Notification (Outcome 3) */}
        {activeConflict && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 text-sm text-rose-950 space-y-3 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>Regulatory Conflict: The proposed change was NOT applied</span>
            </div>

            {activeConflict.wouldViolate && (
              <div className="bg-white rounded-xl p-4 border border-rose-200 text-xs space-y-2">
                <p className="font-bold text-gray-900">
                  Violated Rule: {activeConflict.wouldViolate.ruleKey} · {activeConflict.wouldViolate.ruleName || "Regulatory requirement"}
                </p>
                {activeConflict.wouldViolate.citation && (
                  <div className="flex items-start gap-2 text-gray-700 italic bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                    <span>&ldquo;{activeConflict.wouldViolate.citation}&rdquo;</span>
                  </div>
                )}
                {activeConflict.wouldViolate.sourceDocumentId && (
                  <p className="text-gray-500 font-mono text-[10px]">Source Document: {activeConflict.wouldViolate.sourceDocumentId}</p>
                )}
              </div>
            )}

            <p className="text-xs text-gray-700">
              Applying this change will cause regulatory non-compliance. How would you like to proceed?
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => handleConflictOption("revert")}
                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
              >
                1. Revert (Cancel Edit)
              </button>
              <button
                onClick={() => handleConflictOption("edit")}
                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
              >
                2. Adjust Query & Re-prompt
              </button>
              <button
                onClick={() => handleConflictOption("override")}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-sm"
              >
                3. Force Override & Apply Anyway
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(false);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            placeholder="Type an edit instruction or question (e.g. 'Add beef cattle to target species')..."
            className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          />
          <Button type="submit" disabled={!inputMessage.trim() || isSending} isLoading={isSending}>
            <Send className="w-4 h-4" /> Send
          </Button>
        </form>
      </div>
    </div>
  );
}
