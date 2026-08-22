import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarCheck,
  CheckCheck,
  IndianRupee,
  Megaphone,
  Palmtree,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<string, LucideIcon> = {
  leave: Palmtree,
  payroll: IndianRupee,
  attendance: CalendarCheck,
  general: Megaphone,
};

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", me?.id],
    enabled: !!me?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as AppNotification[];
    },
  });

  // Realtime: new activity pings the bell instantly with a toast.
  useEffect(() => {
    if (!me?.id) return;
    // Unique topic per subscription: reusing the same topic across
    // StrictMode remounts collides with the previous channel registry entry.
    const topic = `notifications:${me.id}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${me.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, queryClient]);

  const unread = (notifications ?? []).filter((n) => !n.read_at);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  function openNotification(n: AppNotification) {
    if (!n.read_at) markRead([n.id]);
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className={cn(
            "relative flex size-9 items-center justify-center rounded-lg transition-colors",
            dark
              ? "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              : "border border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          <Bell className="size-4.5" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-88 rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-base font-semibold text-foreground">Notifications</p>
          {unread.length > 0 && (
            <button
              onClick={() => markRead(unread.map((n) => n.id))}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {(notifications ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nothing yet — activity across Dayflow will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(notifications ?? []).map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Megaphone;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                        !n.read_at && "bg-accent/30",
                      )}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {n.title}
                          </span>
                          {!n.read_at && (
                            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {timeAgo(n.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
