import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Square,
  X,
  RotateCcw,
  Flame,
  Calendar,
  Wallet,
  HeartPulse,
  ClipboardCheck,
  CalendarPlus,
  Minimize2,
  Maximize2,
  ArrowLeftRight,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const EMPLOYEE_SUGGESTIONS = [
  { icon: Calendar, label: "Summarize leave balance" },
  { icon: Flame, label: "Burnout risk check" },
  { icon: Wallet, label: "Salary breakdown" },
  { icon: HeartPulse, label: "Leave policies" },
];

const ADMIN_SUGGESTIONS = [
  { icon: ClipboardCheck, label: "Pending leave approvals" },
  { icon: Calendar, label: "Who's away today?" },
  { icon: Wallet, label: "Monthly payroll burn" },
  { icon: Flame, label: "Attendance anomalies" },
];

export function FloatingChatbot() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.isAdmin ?? false;
  const navigate = useNavigate();
  const suggestions = isAdmin ? ADMIN_SUGGESTIONS : EMPLOYEE_SUGGESTIONS;

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [side, setSide] = useState<"right" | "left">("right");

  const storageKey = me?.id ? `dayflow_floating_chat_${me.id}` : "dayflow_floating_chat_guest";

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as ChatMessage[];
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync when user profile loads
  useEffect(() => {
    if (typeof window === "undefined" || !me?.id) return;
    try {
      const saved = localStorage.getItem(`dayflow_floating_chat_${me.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [me?.id]);

  // Persist messages
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isLoading, isOpen]);

  const updateAssistant = useCallback((messageId: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content } : m)),
    );
  }, []);

  const onSubmit = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "demo-token";

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
      const history = [...messages, userMsg];
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = (await res.text().catch(() => "")).trim();
          throw new Error(errText || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          updateAssistant(assistantId, acc);
        }

        if (!acc.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          toast.error("The assistant returned an empty response.");
        }
      } catch (err) {
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId || m.content.trim().length > 0),
        );
        if ((err as Error).name !== "AbortError") {
          toast.error("Assistant couldn't respond.", {
            description: (err as Error).message.slice(0, 100),
          });
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const onStop = () => {
    abortRef.current?.abort();
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
    toast.success("Chat history cleared.");
  };

  const lastMessage = messages[messages.length - 1];
  const showTyping = isLoading && lastMessage?.role === "assistant" && !lastMessage.content;

  const positionClasses =
    side === "right"
      ? "right-4 sm:right-6 bottom-4 sm:bottom-6"
      : "left-4 sm:left-6 bottom-4 sm:bottom-6";

  return (
    <div className={cn("fixed z-50 flex flex-col items-end", positionClasses)}>
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "mb-3 flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-4",
            isExpanded
              ? "w-[calc(100vw-2rem)] sm:w-[540px] h-[calc(100vh-6rem)] max-h-[700px]"
              : "w-[calc(100vw-2rem)] sm:w-[400px] h-[520px] max-h-[80vh]",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Dayflow AI Assistant
                  </h3>
                  <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[11px] text-muted-foreground">Ask anything about HR & work</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSide((s) => (s === "right" ? "left" : "right"))}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title={`Dock to ${side === "right" ? "left" : "right"}`}
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded((e) => !e)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title={isExpanded ? "Collapse size" : "Expand size"}
              >
                {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Clear chat history"
              >
                <RotateCcw className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                title="Close chat"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Chat Messages */}
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <Bot className="size-6" />
              </span>
              <p className="font-display text-base font-semibold text-foreground">
                How can I help you today?
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                Ask about leave policies, attendance records, payroll, or HR workflow.
              </p>

              <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => void onSubmit(s.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm text-left"
                  >
                    <s.icon className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m, i) => {
                  if (m.role === "assistant" && !m.content) return null;
                  let userText = "";
                  if (m.role === "assistant") {
                    for (let j = i - 1; j >= 0; j--) {
                      const prev = messages[j];
                      if (prev?.role === "user") {
                        userText = prev.content;
                        break;
                      }
                    }
                  }
                  return (
                    <FloatingChatBubble
                      key={m.id}
                      role={m.role}
                      content={m.content}
                      userText={userText}
                    />
                  );
                })}
                {showTyping && <TypingIndicator />}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
            className="border-t border-border bg-card/60 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Dayflow AI..."
                disabled={isLoading}
                className="h-10 flex-1 rounded-xl border-border bg-background text-xs shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSubmit();
                  }
                }}
              />
              {isLoading ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onStop}
                  className="size-10 rounded-xl shrink-0"
                >
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  size="icon"
                  className="size-10 rounded-xl shrink-0 shadow-sm"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  void navigate({ to: "/assistant" });
                }}
                className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <MessageSquare className="size-3" />
                Open full workspace
              </button>
              <span className="text-[10px] text-muted-foreground/60">Powered by Dayflow AI</span>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle AI Floating Chatbot"
        className={cn(
          "group relative flex size-14 items-center justify-center rounded-full bg-gradient-to-r from-primary via-primary/90 to-chart-3 text-primary-foreground shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          isOpen && "rotate-90 bg-muted text-foreground border border-border shadow-md",
        )}
      >
        {isOpen ? (
          <X className="size-6 transition-transform" />
        ) : (
          <>
            <Sparkles className="size-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
              <span className="size-2 rounded-full bg-emerald-200 animate-ping" />
            </span>
          </>
        )}
        {!isOpen && (
          <span
            className={cn(
              "absolute right-16 hidden whitespace-nowrap rounded-xl border border-border/80 bg-popover/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-popover-foreground shadow-md group-hover:block transition-all",
              side === "left" && "right-auto left-16",
            )}
          >
            Ask Dayflow AI ✨
          </span>
        )}
      </button>
    </div>
  );
}

function FloatingChatBubble({
  role,
  content,
  userText,
}: {
  role: "user" | "assistant";
  content: string;
  userText: string;
}) {
  const isUser = role === "user";
  const parsed = isUser ? { text: content, actions: [] as ActionId[] } : parseAssistant(content);
  if (!isUser && parsed.actions.length === 0 && content.length > 0) {
    parsed.actions = inferActions(userText, parsed.text);
  }

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-background text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{parsed.text}</p>
        ) : (
          <>
            <Markdown text={parsed.text} />
            {parsed.actions.length > 0 && <ActionButtons actions={parsed.actions} />}
          </>
        )}
      </div>
    </div>
  );
}

type ActionId = "apply_leave" | "view_payroll" | "review_leaves" | "view_attendance";

const ACTION_IDS: readonly string[] = [
  "apply_leave",
  "view_payroll",
  "review_leaves",
  "view_attendance",
];

const ACTION_CONFIG: Record<
  ActionId,
  { label: string; icon: typeof CalendarPlus; adminOnly?: boolean }
> = {
  apply_leave: { label: "Apply leave", icon: CalendarPlus },
  view_payroll: { label: "View payroll", icon: Wallet },
  review_leaves: { label: "Review requests", icon: ClipboardCheck, adminOnly: true },
  view_attendance: { label: "Attendance", icon: Calendar },
};

function inferActions(userText: string, assistantText: string): ActionId[] {
  const u = userText.toLowerCase();
  const a = assistantText.toLowerCase();
  const both = `${u}\n${a}`;
  const out: ActionId[] = [];

  const applyIntent =
    /(apply|request|take|taking|book|submit|want|need)[\w\s,'-]*(leave|time off|day off|vacation)/.test(
      u,
    ) ||
    /(leave|time off)[\w\s,'-]*(apply|request|take|book)/.test(u) ||
    /["“]apply for leave["”]? button|apply for leave["”]? below|use the ["“]?apply/.test(a);
  if (applyIntent) out.push("apply_leave");

  if (/\b(salary|payslip|payroll|net pay|ctc|deductions?)\b/.test(both)) {
    out.push("view_payroll");
  }

  if (
    /(pending|approv\w*|review)[\w\s,'-]*(request|leave)|(\brequests?\b)[\w\s,'-]*(pending|approv\w*|review)/.test(
      u,
    )
  ) {
    out.push("review_leaves");
  }

  if (
    /\b(attendance|absent|absences|check[- ]?in|who('s| is| are)? (away|off|on leave|absent)|present today)\b/.test(
      both,
    )
  ) {
    out.push("view_attendance");
  }

  return out.slice(0, 2);
}

function parseAssistant(content: string): { text: string; actions: ActionId[] } {
  const idx = content.search(/\[actions:/i);
  if (idx === -1) return { text: content, actions: [] };
  const text = content.slice(0, idx).trimEnd();
  const match = content.slice(idx).match(/\[actions:\s*([\w\s,]*?)\s*\]/i);
  if (!match) return { text, actions: [] };
  const actions = (match[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ActionId => ACTION_IDS.includes(s));
  return { text, actions };
}

function ActionButtons({ actions }: { actions: ActionId[] }) {
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.isAdmin ?? false;

  const visible = actions.filter((a) =>
    a === "review_leaves" ? isAdmin : a === "apply_leave" ? !isAdmin : true,
  );
  if (visible.length === 0) return null;

  const go = (a: ActionId) => {
    if (a === "apply_leave") {
      toast.success("Opening leave form...");
      void navigate({ to: "/leave", search: { apply: true } });
    } else if (a === "review_leaves") {
      void navigate({ to: "/leave", search: {} });
    } else if (a === "view_attendance") {
      void navigate({ to: "/attendance" });
    } else {
      void navigate({ to: "/payroll" });
    }
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
      {visible.map((a) => {
        const cfg = ACTION_CONFIG[a];
        return (
          <button
            key={a}
            onClick={() => go(a)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-xs transition-transform hover:scale-105"
          >
            <cfg.icon className="size-3" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-2">
              <span className="text-primary font-bold">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.trim().slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
            </div>
          );
        }
        return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Bot className="size-3.5" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-background px-3 py-2">
        <span className="size-1.5 rounded-full bg-primary animate-bounce" />
        <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
        <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
