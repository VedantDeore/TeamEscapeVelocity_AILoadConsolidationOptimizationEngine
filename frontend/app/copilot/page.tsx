"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Map,
  BarChart3,
  Zap,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Activity,
} from "lucide-react";
import {
  mockChatHistory,
  suggestedPrompts,
  type ChatMessage,
} from "@/lib/mock-data";
import { getChatHistory, sendChatMessage, runConsolidation } from "@/lib/api";

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatHistory);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    getChatHistory()
      .then((data) => {
        if (data?.length) {
          const mapped = data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }));
          setMessages(mapped);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    sendChatMessage(query, "demo")
      .then((data) => {
        const actions: { label: string; type: string }[] = [];
        if (data.actions && Array.isArray(data.actions)) {
          data.actions.forEach((a: any) => {
            actions.push({
              label: a.label || a,
              type: a.type || a.action || "optimize",
            });
          });
        }
        if (actions.length === 0) {
          actions.push(
            { label: "Show on Map", type: "map" },
            { label: "Run Optimization", type: "optimize" },
          );
        }
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content: data.content || data.response || "No response received.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actions,
        };
        setMessages((prev) => [...prev, aiMsg]);
      })
      .catch(() => {
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          content:
            "Sorry, I couldn't reach the AI engine right now. Please check that the backend is running on port 5000 and try again.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  const handleActionClick = (action: { label: string; type: string }) => {
    if (
      action.label.toLowerCase().includes("run") ||
      action.type === "optimize" ||
      action.type === "run_consolidation"
    ) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: `Running ${action.label}...`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      runConsolidation()
        .then((res) => {
          const aiMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: `✅ Consolidation plan successfully generated!\n\n**Total Clusters:** ${
              res.total_clusters || 0
            }\n**Cost Savings:** ₹${
              res.savings?.toLocaleString("en-IN") || 0
            }\n**CO₂ Reduced:** ${res.co2_saved || 0} kg\n\nCheck the Analytics Dashboard for full details.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setMessages((prev) => [...prev, aiMsg]);
        })
        .catch((err) => {
          let errorMessage = "Failed to run consolidation.";
          if (err instanceof Error) errorMessage = err.message;

          const aiMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: "assistant",
            content: `Failed to run consolidation: ${errorMessage}`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          setMessages((prev) => [...prev, aiMsg]);
        })
        .finally(() => {
          setIsTyping(false);
          scrollToBottom();
        });
    } else {
      handleSend(action.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,91,255,0.35)",
            }}
          >
            <Sparkles size={20} color="white" />
          </div>
          <div>
            <h1 className="page-title">AI Co-Pilot</h1>
            <p className="page-subtitle">
              Natural language interface to the optimization engine
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#34d399",
            }}
          />
          <span
            style={{
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            Groq Mixtral-8x7B · Online
          </span>
        </div>
      </div>

      {/* ── Chat Container ── */}
      <div className="chat-container" style={{ margin: "24px 32px" }}>
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-slide-up"
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background:
                    msg.role === "user"
                      ? "var(--bg-secondary)"
                      : "linear-gradient(135deg, #635BFF, #8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border:
                    msg.role === "user"
                      ? "1px solid var(--border-primary)"
                      : "none",
                  boxShadow:
                    msg.role === "assistant"
                      ? "0 2px 8px rgba(99,91,255,0.30)"
                      : "none",
                }}
              >
                {msg.role === "user" ? (
                  <User size={15} color="var(--text-secondary)" />
                ) : (
                  <Bot size={15} color="white" />
                )}
              </div>

              <div style={{ maxWidth: "72%" }}>
                <div className={`chat-bubble ${msg.role}`}>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {msg.content.split("\n").map((line, i) => {
                      const boldLine = line.replace(
                        /\*\*(.*?)\*\*/g,
                        "<strong>$1</strong>",
                      );
                      return (
                        <p
                          key={i}
                          dangerouslySetInnerHTML={{ __html: boldLine }}
                          style={{ margin: "2px 0" }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginTop: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {msg.actions.map((action) => (
                      <button
                        key={action.label}
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleActionClick(action)}
                      >
                        {action.type === "map" ? (
                          <Map size={12} />
                        ) : action.type === "optimize" ? (
                          <Zap size={12} />
                        ) : (
                          <BarChart3 size={12} />
                        )}
                        {action.label}
                      </button>
                    ))}
                    <button className="btn btn-sm btn-ghost">
                      <Copy size={12} />
                    </button>
                    <button className="btn btn-sm btn-ghost">
                      <ThumbsUp size={12} />
                    </button>
                    <button className="btn btn-sm btn-ghost">
                      <ThumbsDown size={12} />
                    </button>
                  </div>
                )}

                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    marginTop: "5px",
                    textAlign: msg.role === "user" ? "right" : "left",
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(99,91,255,0.30)",
                }}
              >
                <Bot size={15} color="white" />
              </div>
              <div
                className="chat-bubble assistant"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--lorri-primary)",
                      animation: `pulse-dot 1.2s ease infinite ${i * 0.18}s`,
                      opacity: 0.7,
                    }}
                  />
                ))}
                <span
                  style={{ fontSize: "12px", color: "var(--text-tertiary)" }}
                >
                  Analyzing...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <input
              className="chat-input"
              placeholder="Ask Lorri anything about your logistics..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={{ opacity: input.trim() ? 1 : 0.45 }}
            >
              {isTyping ? (
                <Loader2 size={16} className="loading-spinner" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>

          {/* Suggested Prompts */}
          <div className="chat-chips">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                className="chat-chip"
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
