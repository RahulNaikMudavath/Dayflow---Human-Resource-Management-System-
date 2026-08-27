import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Check,
  Clock,
  Palmtree,
  Sparkles,
  Timer,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  supabase,
  ATTENDANCE_META,
  LEAVE_ALLOWANCE,
  LEAVE_TYPE_LABEL,
  leaveDayCount,
  processLeaveDecision,
  formatTime,
  workHours,
  formatHours,
  formatWorkDuration,
  type AttendanceRow,
  type LeaveRequest,
  type Profile,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { LogoLoader } from "@/components/common/logo-loader";
import { CheckInCard } from "@/components/features/attendance/check-in-card";
import {
  InitialsAvatar,
  LeaveStatusBadge,
  StatCard,
} from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dayflow" },
      { name: "description", content: "Your Dayflow workspace at a glance." },
    ],
  }),
  component: DashboardPage,
});

const CHART_FILLS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { data: me } = useCurrentUser();

  if (!me) {
    return <LogoLoader label="Preparing your workspace..." />;
  }

  return me.isAdmin ? <AdminDashboard me={me} /> : <EmployeeDashboard me={me} />;
}

/* ------------------------------ Employee ------------------------------ */

function EmployeeDashboard({ me }: { me: CurrentUser }) {
  const today = new Date();
  const monthKey = format(startOfMonth(today), "yyyy-MM-dd");
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const yearStart = format(new Date(today.getFullYear(), 0, 1), "yyyy-MM-dd");

  const { data: monthRows } = useQuery({
    queryKey: ["attendance", "mine", monthKey],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", monthKey)
        .order("date")
        .limit(60);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: weekRows } = useQuery({
    queryKey: ["attendance", "mine-week", format(weekStart, "yyyy-MM-dd")],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .limit(14);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: myLeaves } = useQuery({
    queryKey: ["leave", "mine", "recent"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const { data: approvedLeaves } = useQuery({
    queryKey: ["leave", "mine-approved", yearStart],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .eq("status", "approved")
        .gte("start_date", yearStart)
        .limit(100);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const presentThisMonth = (monthRows ?? []).filter(
    (r) => r.status === "present" || r.status === "half_day",
  ).length;

  const hoursThisWeek = (weekRows ?? []).reduce(
    (sum, r) => sum + (workHours(r.check_in, r.check_out) ?? 0),
    0,
  );

  const paidUsed = (approvedLeaves ?? [])
    .filter((l) => l.leave_type === "paid")
    .reduce((s, l) => s + leaveDayCount(l.start_date, l.end_date), 0);

  const pendingCount = (myLeaves ?? []).filter(
    (l) => l.status === "pending",
  ).length;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {greeting()}, {me.profile?.full_name?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {format(today, "EEEE, dd MMMM yyyy")} · {me.profile?.designation} ·{" "}
          {me.profile?.department}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/20 to-card p-5 shadow-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shrink-0">
              <Sparkles className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Nova Employee Assistant
                </h3>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase border border-primary/30">
                  Employee Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Track attendance, check-in, request leave, or ask questions using natural language or voice!
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              const btn = document.querySelector('button[title*="Nova AI"]') as HTMLButtonElement;
              btn?.click();
            }}
            className="rounded-xl gap-2 font-semibold shadow-sm shrink-0"
          >
            <Bot className="size-4" />
            Ask Nova AI
          </Button>
        </div>
      </div>

      <CheckInCard userId={me.id} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="Present this month"
          value={presentThisMonth}
          hint="days checked in"
        />
        <StatCard
          icon={Timer}
          label="Hours this week"
          value={`${Math.round(hoursThisWeek * 10) / 10}h`}
          hint="logged so far"
        />
        <StatCard
          icon={Palmtree}
          label="Paid leave left"
          value={`${Math.max(LEAVE_ALLOWANCE.paid - paidUsed, 0)}d`}
          hint={`of ${LEAVE_ALLOWANCE.paid} days this year`}
        />
        <StatCard
          icon={Clock}
          label="Pending requests"
          value={pendingCount}
          hint="awaiting HR review"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              This week
            </h2>
            <Link
              to="/attendance"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Full attendance <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const row = (weekRows ?? []).find((r) => r.date === key);
              const isToday = key === format(today, "yyyy-MM-dd");
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border px-1 py-3",
                    isToday
                      ? "border-primary bg-accent/50"
                      : "border-border bg-background",
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {format(d, "EEE")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {format(d, "d")}
                  </span>
                  {row ? (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        ATTENDANCE_META[row.status].dot,
                      )}
                      title={ATTENDANCE_META[row.status].label}
                    />
                  ) : (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        isWeekend ? "bg-border" : "bg-muted-foreground/30",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {Object.values(ATTENDANCE_META).map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className={cn("size-2 rounded-full", m.dot)} />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Recent time off
            </h2>
            <Link
              to="/leave"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              All requests <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {(myLeaves ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No leave requests yet.
              </p>
            )}
            {(myLeaves ?? []).slice(0, 5).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {LEAVE_TYPE_LABEL[l.leave_type]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(l.start_date), "dd MMM")} –{" "}
                    {format(new Date(l.end_date), "dd MMM")} ·{" "}
                    {leaveDayCount(l.start_date, l.end_date)}d
                  </p>
                </div>
                <LeaveStatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Admin ------------------------------- */

function AdminDashboard({ me }: { me: CurrentUser }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const fourteenAgo = format(subDays(new Date(), 13), "yyyy-MM-dd");
  const [statModal, setStatModal] = useState<
    "total_employees" | "present_today" | "on_leave_today" | "pending_approvals" | null
  >(null);

  const { data: everyone } = useQuery({
    queryKey: ["profiles", "all"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name")
        .limit(100);
      return (data ?? []) as Profile[];
    },
  });

  const { data: todayRows } = useQuery({
    queryKey: ["attendance", "day", today],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .limit(200);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: rangeRows } = useQuery({
    queryKey: ["attendance", "range", fourteenAgo],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("user_id, date, status")
        .gte("date", fourteenAgo)
        .limit(1000);
      return (data ?? []) as Pick<AttendanceRow, "user_id" | "date" | "status">[];
    },
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["leave", "pending"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles(full_name, employee_id, department)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const quickApprove = useMutation({
    mutationFn: async (id: string) => {
      const target = (pendingLeaves ?? []).find((l) => l.id === id);
      if (target) {
        await processLeaveDecision({
          leave: target,
          status: "approved",
          reviewer_comment: "Approved from dashboard",
          reviewer_id: me.id,
        });
      } else {
        const { error } = await supabase
          .from("leave_requests")
          .update({ status: "approved", reviewed_by: me.id })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Leave approved and notification sent to employee");
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const quickDecline = useMutation({
    mutationFn: async (id: string) => {
      const target = (pendingLeaves ?? []).find((l) => l.id === id);
      if (target) {
        await processLeaveDecision({
          leave: target,
          status: "rejected",
          reviewer_comment: "Declined from dashboard",
          reviewer_id: me.id,
        });
      } else {
        const { error } = await supabase
          .from("leave_requests")
          .update({ status: "rejected", reviewed_by: me.id })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Leave request declined");
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const trend = useMemo(() => {
    const days: {
      label: string;
      present: number;
      leave: number;
      absent: number;
    }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const key = format(d, "yyyy-MM-dd");
      const rows = (rangeRows ?? []).filter((r) => r.date === key);
      days.push({
        label: format(d, "dd MMM"),
        present: rows.filter((r) => r.status === "present").length,
        leave: rows.filter((r) => r.status === "leave").length,
        absent:
          rows.filter((r) => r.status === "absent").length +
          rows.filter((r) => r.status === "half_day").length,
      });
    }
    return days;
  }, [rangeRows]);

  const deptData = useMemo(() => {
    const map = new Map<string, number>();
    (everyone ?? []).forEach((p) => {
      const dept = p.department ?? "Other";
      map.set(dept, (map.get(dept) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [everyone]);

  const presentToday = (todayRows ?? []).filter(
    (r) => r.status === "present" || r.status === "half_day",
  ).length;
  const onLeaveToday = (todayRows ?? []).filter(
    (r) => r.status === "leave",
  ).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {greeting()}, {me.profile?.full_name?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {format(new Date(), "EEEE, dd MMMM yyyy")} · Here's how the team is
          doing.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-amber-900/10 to-card p-5 shadow-lift">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-600 text-amber-50 shadow-md shrink-0">
              <Bot className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Nova HR Command Center
                </h3>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase border border-amber-500/30">
                  HR Admin Mode
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Review pending team leave approvals, inspect absent lists, audit department counts, or query payroll records!
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              const btn = document.querySelector('button[title*="Nova HR"]') as HTMLButtonElement;
              btn?.click();
            }}
            className="rounded-xl gap-2 font-semibold shadow-sm shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Bot className="size-4" />
            Launch HR Command
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total employees"
          value={(everyone ?? []).length}
          hint="click to view active team directory"
          onClick={() => setStatModal("total_employees")}
        />
        <StatCard
          icon={UserCheck}
          label="Present today"
          value={presentToday}
          hint={`of ${(everyone ?? []).length} checked in · click for live details`}
          onClick={() => setStatModal("present_today")}
        />
        <StatCard
          icon={Palmtree}
          label="On leave today"
          value={onLeaveToday}
          hint="approved time off · click to view"
          onClick={() => setStatModal("on_leave_today")}
        />
        <StatCard
          icon={Wallet}
          label="Pending approvals"
          value={(pendingLeaves ?? []).length}
          hint="leave requests waiting · click to review"
          onClick={() => setStatModal("pending_approvals")}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Attendance — last two weeks
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="present"
                  stackId="1"
                  stroke="var(--status-present)"
                  fill="var(--status-present)"
                  fillOpacity={0.3}
                  name="Present"
                />
                <Area
                  type="monotone"
                  dataKey="leave"
                  stackId="1"
                  stroke="var(--status-leave)"
                  fill="var(--status-leave)"
                  fillOpacity={0.3}
                  name="On leave"
                />
                <Area
                  type="monotone"
                  dataKey="absent"
                  stackId="1"
                  stroke="var(--status-absent)"
                  fill="var(--status-absent)"
                  fillOpacity={0.3}
                  name="Absent / half-day"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Team by department
          </h2>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deptData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={CHART_FILLS[i % CHART_FILLS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {deptData.map((d, i) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: CHART_FILLS[i % CHART_FILLS.length] }}
                />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Pending leave approvals
          </h2>
          <Link
            to="/leave"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Review all <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {(pendingLeaves ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All caught up — nothing waiting for review.
            </p>
          )}
          {(pendingLeaves ?? []).slice(0, 4).map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  name={l.profiles?.full_name ?? "?"}
                  className="size-9 text-xs"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {l.profiles?.full_name} · {LEAVE_TYPE_LABEL[l.leave_type]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(l.start_date), "dd MMM")} –{" "}
                    {format(new Date(l.end_date), "dd MMM")} ·{" "}
                    {leaveDayCount(l.start_date, l.end_date)} working days
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={quickApprove.isPending}
                onClick={() => quickApprove.mutate(l.id)}
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 1. Total Employees Modal */}
      <Dialog open={statModal === "total_employees"} onOpenChange={(o) => !o && setStatModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Users className="size-5 text-primary" />
              Total Employees Directory ({(everyone ?? []).length})
            </DialogTitle>
            <DialogDescription>
              Complete list of active employees registered in Dayflow.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {(everyone ?? []).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={p.full_name} className="size-10 text-sm" />
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {p.full_name}
                      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {p.employee_id}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.designation ?? "Team Member"} · {p.department ?? "General"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/employees/$employeeId"
                    params={{ employeeId: p.id }}
                    onClick={() => setStatModal(null)}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent transition-colors"
                  >
                    View Profile <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Present Today Modal */}
      <Dialog open={statModal === "present_today"} onOpenChange={(o) => !o && setStatModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <UserCheck className="size-5 text-emerald-500" />
              Checked-in Employees Today ({presentToday})
            </DialogTitle>
            <DialogDescription>
              Live details of employees who checked in today ({format(new Date(), "EEEE, dd MMMM yyyy")}).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {presentToday === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No employees have checked in today yet.
              </p>
            ) : (
              (todayRows ?? [])
                .filter((r) => r.status === "present" || r.status === "half_day")
                .map((r) => {
                  const emp = (everyone ?? []).find((p) => p.id === r.user_id);
                  const durationStr = formatWorkDuration(r.check_in, r.check_out);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={emp?.full_name ?? "Employee"} className="size-10 text-sm" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {emp?.full_name ?? "Employee"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp?.department ?? "Team Member"} · ID: {emp?.employee_id ?? "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span>In: {formatTime(r.check_in)}</span>
                          <span>→</span>
                          <span>Out: {r.check_out ? formatTime(r.check_out) : "Working"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!r.check_out ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Currently Working
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-accent px-2.5 py-0.5 rounded-full">
                              Checked out ({durationStr ? `${durationStr} logged` : "Completed"})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. On Leave Today Modal */}
      <Dialog open={statModal === "on_leave_today"} onOpenChange={(o) => !o && setStatModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Palmtree className="size-5 text-amber-500" />
              Employees On Leave Today ({onLeaveToday})
            </DialogTitle>
            <DialogDescription>
              Team members currently on approved time off today ({format(new Date(), "EEEE, dd MMMM yyyy")}).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {onLeaveToday === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No employees are on leave today. Full team strength!
              </p>
            ) : (
              (todayRows ?? [])
                .filter((r) => r.status === "leave")
                .map((r) => {
                  const emp = (everyone ?? []).find((p) => p.id === r.user_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={emp?.full_name ?? "Employee"} className="size-10 text-sm" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {emp?.full_name ?? "Employee"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp?.department ?? "Department"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        Approved Time Off
                      </span>
                    </div>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Pending Approvals Modal */}
      <Dialog open={statModal === "pending_approvals"} onOpenChange={(o) => !o && setStatModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Wallet className="size-5 text-primary" />
              Pending Leave Approvals ({(pendingLeaves ?? []).length})
            </DialogTitle>
            <DialogDescription>
              Leave requests waiting for HR review and decision.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {(pendingLeaves ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                All caught up! No pending leave requests.
              </p>
            ) : (
              (pendingLeaves ?? []).map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={l.profiles?.full_name ?? "?"} className="size-10 text-sm shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {l.profiles?.full_name} · {LEAVE_TYPE_LABEL[l.leave_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(l.start_date), "dd MMM yyyy")} – {format(new Date(l.end_date), "dd MMM yyyy")} · {leaveDayCount(l.start_date, l.end_date)} working day(s)
                      </p>
                      {l.remarks && (
                        <p className="mt-1 text-xs italic text-muted-foreground/80 bg-accent/40 px-2 py-1 rounded-md">
                          "{l.remarks}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-red-500/30 text-red-600 hover:bg-red-500/10 cursor-pointer"
                      disabled={quickDecline.isPending || quickApprove.isPending}
                      onClick={() => quickDecline.mutate(l.id)}
                    >
                      <XCircle className="size-3.5 mr-1" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      disabled={quickApprove.isPending || quickDecline.isPending}
                      onClick={() => quickApprove.mutate(l.id)}
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
