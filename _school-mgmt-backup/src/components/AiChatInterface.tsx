import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, Copy, RotateCcw, Trash2, Loader2, CheckCheck,
  Sparkles, ChevronRight, User, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface AiTool {
  label: string;
  prompt: string;
  icon?: string;
}

export interface AiToolGroup {
  title: string;
  tools: AiTool[];
}

interface Message {
  role: "user" | "assistant";
  text: string;
  id: string;
}

interface Props {
  toolGroups: AiToolGroup[];
  apiPath?: string;
  authToken: string | null;
  themeColor?: string;
  placeholder?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onCopy, onRegenerate, isLast }: {
  msg: Message;
  onCopy: () => void;
  onRegenerate?: () => void;
  isLast: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(msg.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy();
    });
  }

  if (msg.role === "user") {
    return (
      <div className="flex justify-end gap-2 group">
        <div className="max-w-[80%] bg-indigo-600 dark:bg-indigo-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-sm">
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 group">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[85%] space-y-1">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
          <p className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100 leading-relaxed">{msg.text}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {isLast && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ─── Mobile: horizontal scrollable prompt strip ───────────────────────────────

function MobilePromptStrip({ toolGroups, onToolClick }: {
  toolGroups: AiToolGroup[];
  onToolClick: (tool: AiTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const allTools = toolGroups.flatMap((g) => g.tools);

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60">
      {/* Toggle row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          Quick Prompts
          <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal text-slate-400 border-slate-200">
            {allTools.length}
          </Badge>
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* Expanded: grouped chips */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5 max-h-48 overflow-y-auto">
          {toolGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.tools.map((tool) => (
                  <button
                    key={tool.label}
                    onClick={() => { onToolClick(tool); setOpen(false); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/30 dark:hover:text-violet-300 transition-colors active:scale-95"
                  >
                    {tool.icon && <span className="text-sm leading-none">{tool.icon}</span>}
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed: single-line horizontal scroll preview */}
      {!open && (
        <div className="overflow-x-auto pb-2.5 px-3 flex gap-2 scrollbar-none">
          {allTools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => onToolClick(tool)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium whitespace-nowrap hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/30 dark:hover:text-violet-300 transition-colors active:scale-95 flex-shrink-0"
            >
              {tool.icon && <span className="text-sm leading-none">{tool.icon}</span>}
              {tool.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Desktop: vertical sidebar ────────────────────────────────────────────────

function DesktopSidebar({ toolGroups, onToolClick }: {
  toolGroups: AiToolGroup[];
  onToolClick: (tool: AiTool) => void;
}) {
  return (
    <div className="w-56 shrink-0 overflow-y-auto space-y-3 pr-0.5">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Prompts</span>
      </div>
      {toolGroups.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1.5">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.tools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => onToolClick(tool)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 transition-colors group"
              >
                {tool.icon && <span className="text-base shrink-0 leading-none">{tool.icon}</span>}
                <span className="flex-1 leading-tight">{tool.label}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiChatInterface({ toolGroups, apiPath = "/ai/chat", authToken, placeholder }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function buildHistory(msgs: Message[]) {
    return msgs.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
  }

  const sendMessage = useCallback(async (userText: string, historyOverride?: Message[]) => {
    const trimmed = userText.trim();
    if (!trimmed || loading) return;

    const baseHistory = historyOverride ?? messages;
    const userMsg: Message = { role: "user", text: trimmed, id: uid() };
    const newHistory = [...baseHistory, userMsg];
    setMessages(newHistory);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api${apiPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ messages: buildHistory(newHistory) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setMessages(baseHistory);
        return;
      }

      setMessages([...newHistory, { role: "assistant", text: data.text, id: uid() }]);
    } catch {
      setError("Network error. Please check your connection.");
      setMessages(baseHistory);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, authToken, apiPath]);

  const handleRegenerate = useCallback(() => {
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const idx = messages.length - 1 - lastUserIdx;
    const lastUserMsg = messages[idx];
    const historyBefore = messages.slice(0, idx);
    sendMessage(lastUserMsg.text, historyBefore);
  }, [messages, sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleToolClick(tool: AiTool) {
    setInput(tool.prompt);
    textareaRef.current?.focus();
  }

  function handleClear() {
    setMessages([]);
    setError(null);
    setInput("");
  }

  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === "assistant" ? i : acc, -1);

  // ── Chat panel (shared between mobile and desktop) ──
  const ChatPanel = (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">AI Assistant</p>
            <p className="text-[10px] md:text-xs text-slate-400 leading-tight">Powered by Groq</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <Badge variant="outline" className="text-xs text-slate-400 hidden sm:inline-flex">
              {messages.length} msg{messages.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-4">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-3 shadow-sm">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-violet-500" />
            </div>
            <h3 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
              How can I help you?
            </h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-xs">
              <span className="md:hidden">Tap a quick prompt above, or type your question below.</span>
              <span className="hidden md:inline">Choose a quick prompt from the left, or type your own question below.</span>
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isLast={idx === lastAssistantIdx}
            onCopy={() => toast({ title: "Copied to clipboard" })}
            onRegenerate={handleRegenerate}
          />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
            <span className="text-red-500 text-sm font-medium">⚠ {error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 md:px-4 py-2.5 md:py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Type a message…"}
            rows={1}
            className="flex-1 resize-none min-h-[40px] max-h-28 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            style={{ fieldSizing: "content" } as React.CSSProperties}
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="h-10 w-10 p-0 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex-shrink-0 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 pl-1 hidden md:block">
          Shift+Enter for new line · responses may contain errors, always review
        </p>
        <p className="text-[10px] text-slate-400 mt-1 pl-1 md:hidden">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile layout ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:hidden" style={{ height: "calc(100dvh - 8rem)" }}>
        <MobilePromptStrip toolGroups={toolGroups} onToolClick={handleToolClick} />
        <div className="flex-1 flex flex-col min-h-0 pt-2">
          {ChatPanel}
        </div>
      </div>

      {/* ── Desktop layout ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex gap-4 h-[calc(100vh-13rem)] min-h-[500px]">
        <DesktopSidebar toolGroups={toolGroups} onToolClick={handleToolClick} />
        {ChatPanel}
      </div>
    </>
  );
}
