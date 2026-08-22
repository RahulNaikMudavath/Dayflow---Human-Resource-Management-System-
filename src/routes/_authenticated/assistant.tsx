import { useRef, useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Flame,
  Calendar,
  Wallet,
  HeartPulse,
  Square,
  CalendarPlus,
  ClipboardCheck,
  Trash2,
  Plus,
  CheckCircle2,
  RotateCcw,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/dayflow/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — Dayflow" },
      {
        name: "description",
        content: "Ask Dayflow's AI HR assistant about attendance, leave, payroll, and wellness.",
      },
      { property: "og:title", content: "AI Assistant — Dayflow" },
      {
        property: "og:description",
        content: "Ask Dayflow's AI HR assistant about attendance, leave, payroll, and wellness.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

const EMPLOYEE_SUGGESTIONS = [
  { icon: Calendar, label: "Summarize my leave balance" },
  { icon: Flame, label: "Check my burnout risk" },
  { icon: Wallet, label: "Explain my salary breakdown" },
  { icon: HeartPulse, label: "What are our leave policies?" },
];

const ADMIN_SUGGESTIONS = [
  { icon: ClipboardCheck, label: "Show pending leave approvals" },
  { icon: Calendar, label: "Who's away today?" },
  { icon: Wallet, label: "Summarize this month's payroll burn" },
  { icon: Flame, label: "Flag attendance anomalies this week" },
];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AiTask {
  id: string;
  title: string;
  status: "active" | "completed";
  createdAt: string;
  messages: ChatMessage[];
}

function AssistantPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.isAdmin ?? false;
  const suggestions = isAdmin ? ADMIN_SUGGESTIONS : EMPLOYEE_SUGGESTIONS;
  const storageKey = me?.id ? `dayflow_ai_tasks_${me.id}` : "dayflow_ai_tasks_guest";

  const [tasks, setTasks] = useState<AiTask[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as AiTask[];
      }
    } catch {
      // fallback
    }
    const defaultTask: AiTask = {
      id: crypto.randomUUID(),
      title: "General HR Inquiry",
      status: "active",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    return [defaultTask];
  });

  const [activeTaskId, setActiveTaskId] = useState<string>(() => tasks[0]?.id ?? "");
  const [taskFilter, setTaskFilter] = useState<"active" | "completed">("active");

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync tasks when user profile resolves
  useEffect(() => {
    if (typeof window === "undefined" || !me?.id) return;
    try {
      const saved = localStorage.getItem(`dayflow_ai_tasks_${me.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
          setActiveTaskId((current) =>
            parsed.some((t: AiTask) => t.id === current) ? current : parsed[0].id,
          );
        }
      }
    } catch {
      // ignore
    }
  }, [me?.id]);

  // Persist tasks to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (tasks.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(tasks));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
  }, [tasks, storageKey]);

  const currentTask = tasks.find((t) => t.id === activeTaskId) ||
    tasks[0] || {
      id: "default",
      title: "HR Inquiry",
      status: "active",
      createdAt: new Date().toISOString(),
      messages: [],
    };

  const messages = currentTask.messages;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const createNewTask = (titleOverride?: string) => {
    const newTask: AiTask = {
      id: crypto.randomUUID(),
      title: titleOverride || `HR Task ${tasks.length + 1}`,
      status: "active",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    setTaskFilter("active");
    toast.success(`Started new task: "${newTask.title}"`);
    return newTask.id;
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextStatus = t.status === "active" ? "completed" : "active";
        toast.success(
          nextStatus === "completed"
            ? `Task "${t.title}" marked as completed!`
            : `Task "${t.title}" reopened as active.`,
        );
        return { ...t, status: nextStatus };
      }),
    );
  };

  const deleteTask = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    const remaining = tasks.filter((t) => t.id !== taskId);
    if (remaining.length === 0) {
      const freshTask: AiTask = {
        id: crypto.randomUUID(),
        title: "General HR Inquiry",
        status: "active",
        createdAt: new Date().toISOString(),
        messages: [],
      };
      setTasks([freshTask]);
      setActiveTaskId(freshTask.id);
    } else {
      setTasks(remaining);
      if (activeTaskId === taskId && remaining[0]) {
        setActiveTaskId(remaining[0].id);
      }
    }
    toast.success(`Deleted task: "${target?.title || ""}"`);
  };

  const updateAssistant = useCallback(
    (targetTaskId: string, messageId: string, content: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== targetTaskId) return t;
          return {
            ...t,
            messages: t.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
          };
        }),
      );
    },
    [],
  );

  const onSubmit = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "demo-token";

      const targetTaskId = currentTask.id;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
      const history = [...messages, userMsg];
      const assistantId = crypto.randomUUID();

      // Auto-title task if default or generic
      const shouldAutoTitle =
        currentTask.messages.length === 0 &&
        (currentTask.title.startsWith("General HR") || currentTask.title.startsWith("HR Task"));
      const newTitle = shouldAutoTitle
        ? text.slice(0, 32).trim() + (text.length > 32 ? "..." : "")
        : currentTask.title;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== targetTaskId) return t;
          return {
            ...t,
            title: newTitle,
            messages: [...t.messages, userMsg, { id: assistantId, role: "assistant", content: "" }],
          };
        }),
      );

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
          updateAssistant(targetTaskId, assistantId, acc);
        }

        if (!acc.trim()) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === targetTaskId
                ? { ...t, messages: t.messages.filter((m) => m.id !== assistantId) }
                : t,
            ),
          );
          toast.error("The assistant returned an empty response. Please try again.");
        }
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== targetTaskId) return t;
            return {
              ...t,
              messages: t.messages.filter(
                (m) => m.id !== assistantId || m.content.trim().length > 0,
              ),
            };
          }),
        );
        if ((err as Error).name !== "AbortError") {
          toast.error("The assistant couldn't respond. Please try again.", {
            description: (err as Error).message.slice(0, 120),
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

  const activeTasks = tasks.filter((t) => t.status === "active");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const filteredTasks = taskFilter === "active" ? activeTasks : completedTasks;

  const lastMessage = messages[messages.length - 1];
  const showTyping = isLoading && lastMessage?.role === "assistant" && !lastMessage.content;
  const isCurrentCompleted = currentTask.status === "completed";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-6rem)]">
      <PageHeader
        title="Dayflow Assistant"
        description={
          isAdmin
            ? "Task-focused workforce insights, pending approvals, and payroll burn."
            : "Task-focused HR copilot for attendance, leave, payroll, and wellness."
        }
      >
        <Button
          onClick={() => createNewTask()}
          size="sm"
          className="rounded-full gap-1.5 shadow-sm font-semibold"
        >
          <Plus className="size-4" />
          New Task
        </Button>
      </PageHeader>

      {/* Task Selector & Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 rounded-full bg-muted p-1">
          <button
            onClick={() => {
              setTaskFilter("active");
              if (activeTasks[0] && !activeTasks.some((t) => t.id === activeTaskId)) {
                setActiveTaskId(activeTasks[0].id);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              taskFilter === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="size-3.5" />
            Active Tasks ({activeTasks.length})
          </button>
          <button
            onClick={() => {
              setTaskFilter("completed");
              if (completedTasks[0] && !completedTasks.some((t) => t.id === activeTaskId)) {
                setActiveTaskId(completedTasks[0].id);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              taskFilter === "completed"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CheckSquare className="size-3.5 text-emerald-500" />
            Completed ({completedTasks.length})
          </button>
        </div>

        {/* Task Horizontal Pills */}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {filteredTasks.map((t) => {
            const isActive = t.id === currentTask.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTaskId(t.id)}
                className={cn(
                  "flex max-w-48 shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    t.status === "completed" ? "bg-emerald-500" : "bg-primary animate-pulse",
                  )}
                />
                <span className="truncate">{t.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Task Chat Window */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
        {/* Active Task Header Bar */}
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
              {currentTask.title}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border",
                isCurrentCompleted
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-primary/30 bg-primary/10 text-primary",
              )}
            >
              {isCurrentCompleted ? (
                <>
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Completed
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  Active Task
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleTaskStatus(currentTask.id)}
              className={cn(
                "h-8 rounded-xl text-xs gap-1.5 font-medium transition-all",
                isCurrentCompleted
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                  : "border-border hover:border-emerald-500/40 hover:text-emerald-600",
              )}
            >
              {isCurrentCompleted ? (
                <>
                  <RotateCcw className="size-3.5" />
                  Reopen Task
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Mark Completed
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteTask(currentTask.id)}
              className="size-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete task"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-3 text-primary-foreground shadow-elegant">
              <Sparkles className="size-8" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">
              {isAdmin ? "Workforce Copilot Task Workspace" : "HR Task Workspace"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This chat session is dedicated to <strong>{currentTask.title}</strong>. It will remain
              active until you click <strong>Mark Completed</strong>.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setInput(s.label)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-accent"
                >
                  <s.icon className="size-4 text-primary" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-4 py-6 md:px-6">
            <div className="space-y-6">
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
                  <ChatBubble key={m.id} role={m.role} content={m.content} userText={userText} />
                );
              })}
              {showTyping ? <TypingIndicator /> : null}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input Form or Completed Banner */}
        {isCurrentCompleted ? (
          <div className="border-t border-border bg-emerald-500/5 p-4 text-center md:p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>This task has been completed and saved to history.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleTaskStatus(currentTask.id)}
                className="rounded-xl border-emerald-500/30 bg-background text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold"
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Reopen Task
              </Button>
              <Button
                size="sm"
                onClick={() => createNewTask()}
                className="rounded-xl text-xs font-semibold"
              >
                <Plus className="mr-1.5 size-3.5" />
                New Task
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="border-t border-border bg-card p-4 md:p-5">
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask about ${currentTask.title.toLowerCase()}...`}
                  disabled={isLoading}
                  className="min-h-12 rounded-2xl border-border bg-background pr-12 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSubmit();
                    }
                  }}
                />
              </div>
              {isLoading ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onStop}
                  className="h-12 rounded-2xl px-5"
                >
                  <span className="flex items-center gap-2">
                    <Square className="size-4" />
                    Stop
                  </span>
                </Button>
              ) : (
                <Button type="submit" disabled={!input.trim()} className="h-12 rounded-2xl px-5">
                  <span className="flex items-center gap-2">
                    <Send className="size-4" />
                    Send
                  </span>
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ChatBubble({
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
    <div
      data-testid={isUser ? "user-message" : "assistant-response"}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
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
            {parsed.actions.length > 0 ? <ActionButtons actions={parsed.actions} /> : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Quick action buttons ------------------------ */

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
  apply_leave: { label: "Apply for leave", icon: CalendarPlus },
  view_payroll: { label: "View payroll", icon: Wallet },
  review_leaves: { label: "Review requests", icon: ClipboardCheck, adminOnly: true },
  view_attendance: { label: "Open attendance", icon: Calendar },
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
    /["“]apply for leave["”] button|apply for leave["”]? below|use the ["“]?apply/.test(a);
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
      toast.success("Opening the leave form — your request goes to HR for approval.");
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
    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
      {visible.map((a) => {
        const cfg = ACTION_CONFIG[a];
        return (
          <button
            key={a}
            data-testid={`action-${a}`}
            onClick={() => go(a)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] hover:shadow-elegant"
          >
            <cfg.icon className="size-3.5" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed marker:text-primary">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        h1: ({ children }) => (
          <p className="mt-2 mb-1 font-display text-base font-semibold">{children}</p>
        ),
        h2: ({ children }) => (
          <p className="mt-2 mb-1 font-display text-base font-semibold">{children}</p>
        ),
        h3: ({ children }) => <p className="mt-2 mb-1 text-sm font-semibold">{children}</p>,
        code: ({ children }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Bot className="size-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
