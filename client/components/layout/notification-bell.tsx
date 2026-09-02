import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Check, CheckCircle2, XCircle, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  isUUID,
  getLocalNotifications,
  getClearedNotificationIds,
  markLocalNotificationsRead,
  clearLocalNotifications,
  type NotificationItem,
} from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", me?.id, me?.isAdmin],
    enabled: Boolean(me?.id),
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!me?.id) return [];
      let dbNotifs: NotificationItem[] = [];

      if (isUUID(me.id)) {
        try {
          const { data } = await (supabase.from("notifications" as any) as any)
            .select("*")
            .eq("user_id", me.id)
            .order("created_at", { ascending: false });
          if (data) dbNotifs = data as NotificationItem[];
        } catch (e) {
          console.warn("Notifications DB fetch warning:", e);
        }
      }

      // Read local notifications store
      const localNotifs = getLocalNotifications();
      const filteredLocal = localNotifs.filter((n) => {
        if (me.isAdmin) return true;
        return n.user_id === me.id || n.user_id === "all";
      });

      const existingIds = new Set(dbNotifs.map((n) => n.id));
      const mergedLocal = filteredLocal.filter((n) => !existingIds.has(n.id));

      const clearedIds = new Set(getClearedNotificationIds());
      const combined = [...mergedLocal, ...dbNotifs].filter((n) => !clearedIds.has(n.id));
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      markLocalNotificationsRead(id);
      if (id && isUUID(id)) {
        await (supabase.from("notifications" as any) as any)
          .update({ read: true })
          .eq("id", id);
      } else if (me?.id && isUUID(me.id)) {
        await (supabase.from("notifications" as any) as any)
          .update({ read: true })
          .eq("user_id", me.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearNotifications = useMutation({
    mutationFn: async (id?: string) => {
      const activeIds = (notifications ?? []).map((n) => n.id);
      clearLocalNotifications(id, me?.id, activeIds);
      if (id && isUUID(id)) {
        await (supabase.from("notifications" as any) as any)
          .delete()
          .eq("id", id);
      } else if (!id && me?.id && isUUID(me.id)) {
        await (supabase.from("notifications" as any) as any)
          .delete()
          .eq("user_id", me.id);
      }
    },
    onSuccess: (_, id) => {
      toast.success(id ? "Notification cleared" : "All notifications cleared");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const hasNotifications = (notifications ?? []).length > 0;

  if (!me) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative flex size-9 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer shrink-0"
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
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => markRead.mutate(undefined)}
                title="Mark all as read"
              >
                <Check className="mr-1 size-3" />
                Read all
              </Button>
            )}
            {hasNotifications && (
              <Button
                variant="ghost"
                size="sm"
                disabled={clearNotifications.isPending}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={() => clearNotifications.mutate(undefined)}
                title="Clear all notifications"
              >
                <Trash2 className="mr-1 size-3" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
          {!hasNotifications ? (
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
                    "group relative flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50",
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
                  <div className="min-w-0 flex-1 pr-6">
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
                  <button
                    type="button"
                    title="Clear notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotifications.mutate(n.id);
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity rounded-md hover:bg-background/80"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
