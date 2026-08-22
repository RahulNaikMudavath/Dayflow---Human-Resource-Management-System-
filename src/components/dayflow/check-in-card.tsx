import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, LogIn, LogOut, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { supabase, formatTime, workHours, type AttendanceRow } from "@/lib/dayflow";
import { Button } from "@/components/ui/button";

export function CheckInCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: todayRow } = useQuery({
    queryKey: ["attendance", "today", userId, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      return (data as AttendanceRow | null) ?? null;
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").insert({
        user_id: userId,
        date: today,
        check_in: new Date().toISOString(),
        status: "present",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked in — have a great day!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      if (!todayRow) return;
      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", todayRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checked out. See you tomorrow!");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = checkIn.isPending || checkOut.isPending;
  const hours = todayRow ? workHours(todayRow.check_in, todayRow.check_out) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-lift">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sidebar-primary/15 blur-2xl" />
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
            <Sunrise className="size-3.5 text-sidebar-primary" />
            {format(now, "EEEE, dd MMMM yyyy")}
          </div>
          <p className="mt-2 font-display text-5xl font-semibold tracking-tight tabular-nums">
            {format(now, "hh:mm")}
            <span className="ml-1 text-2xl text-sidebar-foreground/60">{format(now, "ss a")}</span>
          </p>
          <p className="mt-2 text-sm text-sidebar-foreground/70">
            {!todayRow && "You haven't checked in yet today."}
            {todayRow && !todayRow.check_out && (
              <>In at {formatTime(todayRow.check_in)} — you're on the clock.</>
            )}
            {todayRow?.check_out && (
              <>
                {formatTime(todayRow.check_in)} → {formatTime(todayRow.check_out)}
                {hours != null && ` · ${hours}h logged`}
              </>
            )}
          </p>
        </div>
        <div>
          {!todayRow ? (
            <Button
              size="lg"
              onClick={() => checkIn.mutate()}
              disabled={busy}
              className="h-12 rounded-xl bg-sidebar-primary px-6 text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Check in
            </Button>
          ) : !todayRow.check_out ? (
            <Button
              size="lg"
              variant="outline"
              onClick={() => checkOut.mutate()}
              disabled={busy}
              className="h-12 rounded-xl border-sidebar-border bg-transparent px-6 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Check out
            </Button>
          ) : (
            <span className="inline-flex items-center rounded-xl bg-sidebar-accent px-4 py-2.5 text-sm font-semibold text-sidebar-accent-foreground">
              Day complete
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
