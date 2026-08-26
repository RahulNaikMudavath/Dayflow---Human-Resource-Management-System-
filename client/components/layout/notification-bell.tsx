import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Check, CheckCircle2, XCircle, Info } from "lucide-react";
import { supabase, type NotificationItem } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", me?.id],
    enabled: Boolean(me?.id),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!me?.id) return [];
      const { data } = await (supabase.from("notifications" as any) as any)
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as NotificationItem[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      if (id) {
        await (supabase.from("notifications" as any) as any)
          .update({ read: true })
          .eq("id", id);
      } else if (me?.id) {
        await (supabase.from("notifications" as any) as any)
          .update({ read: true })
          .eq("user_id", me.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  if (!me) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 rounded-2xl border border-border bg-card p-0 shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markRead.mutate(undefined)}
            >
              <Check className="mr-1 size-3" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
          {(notifications ?? []).length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            (notifications ?? []).map((n) => {
              const isApproved = n.type === "leave_approved";
              const isRejected = n.type === "leave_rejected";
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50",
                    !n.read && "bg-accent/30"
                  )}
                >
                  <span className="mt-0.5 flex shrink-0">
                    {isApproved ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : isRejected ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <Info className="size-4 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {format(new Date(n.created_at), "dd MMM, hh:mm a")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
