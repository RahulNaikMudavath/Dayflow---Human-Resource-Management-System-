import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  LogOut,
  Palmtree,
  Timer,
  UserCheck,
  UserRound,
  Users,
  Wallet,
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
  workHours,
  type AttendanceRow,
  type LeaveRequest,
  type Profile,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { CheckInCard } from "@/components/dayflow/check-in-card";
import { InitialsAvatar, LeaveStatusBadge, StatCard } from "@/components/dayflow/bits";
import { Button } from "@/components/ui/button";
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

function QuickAction({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: typeof UserRound;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-lift transition-colors hover:border-primary/40 hover:bg-accent/50"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  );
}

function DashboardPage() {
  const { data: me } = useCurrentUser();

  if (!me) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return me.isAdmin ? <AdminDashboard me={me} /> : <EmployeeDashboard me={me} />;
}

/* ------------------------------ Employee ------------------------------ */

function EmployeeDashboard({ me }: { me: CurrentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();
  const monthKey = format(startOfMonth(today), "yyyy-MM-dd");

  async function signOut() {
    localStorage.removeItem("dayflow_demo_session");
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const yearStart = format(new Date(today.getFullYear(), 0, 1), "yyyy-MM-dd");

  const { data: monthRows } = useQuery({
    queryKey: ["attendance", "mine", monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", monthKey)
        .order("date");
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: weekRows } = useQuery({
    queryKey: ["attendance", "mine-week", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", format(weekStart, "yyyy-MM-dd"));
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: myLeaves } = useQuery({
    queryKey: ["leave", "mine", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(4);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const { data: approvedLeaves } = useQuery({
    queryKey: ["leave", "mine-approved", yearStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .eq("status", "approved")
        .gte("start_date", yearStart);
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

  const pendingCount = (myLeaves ?? []).filter((l) => l.status === "pending").length;

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

      <CheckInCard userId={me.id} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          to="/profile"
          icon={UserRound}
          label="Profile"
          hint="View & edit your details"
        />
        <QuickAction
          to="/attendance"
          icon={CalendarCheck}
          label="Attendance"
          hint="Check-ins & history"
        />
        <QuickAction
          to="/leave"
          icon={Palmtree}
          label="Leave requests"
          hint="Apply & track time off"
        />
        <button
          type="button"
          onClick={signOut}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-lift transition-colors hover:border-destructive/40 hover:bg-destructive/5"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-destructive/10 group-hover:text-destructive">
            <LogOut className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Log out</span>
            <span className="block text-xs text-muted-foreground">End your session</span>
          </span>
        </button>
      </div>

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
            <h2 className="font-display text-lg font-semibold text-foreground">This week</h2>
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
                    isToday ? "border-primary bg-accent/50" : "border-border bg-background",
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {format(d, "EEE")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{format(d, "d")}</span>
                  {row ? (
                    <span
                      className={cn("size-2 rounded-full", ATTENDANCE_META[row.status].dot)}
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
            <h2 className="font-display text-lg font-semibold text-foreground">Recent time off</h2>
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
            {(myLeaves ?? []).map((l) => (
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

const DEMO_PROFILES: Profile[] = [
  {
    id: "demo-user-id",
    employee_id: "DF-001",
    full_name: "Aarav Mehta",
    email: "admin@dayflow.io",
    phone: "+91 98220 41102",
    address: "Bengaluru, India",
    department: "People Ops",
    designation: "Head of People",
    date_of_joining: "2022-01-01",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-emp-2",
    employee_id: "DF-002",
    full_name: "Priya Sharma",
    email: "priya@dayflow.io",
    phone: "+91 98765 43210",
    address: "Mumbai, India",
    department: "Engineering",
    designation: "Senior Engineer",
    date_of_joining: "2022-03-15",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-emp-3",
    employee_id: "DF-003",
    full_name: "Rahul Verma",
    email: "rahul@dayflow.io",
    phone: "+91 91234 56789",
    address: "Delhi, India",
    department: "Sales",
    designation: "Sales Director",
    date_of_joining: "2023-01-10",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-emp-4",
    employee_id: "DF-004",
    full_name: "Ananya Iyer",
    email: "ananya@dayflow.io",
    phone: "+91 99887 76655",
    address: "Chennai, India",
    department: "Design",
    designation: "Lead UI/UX Designer",
    date_of_joining: "2023-05-20",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-emp-5",
    employee_id: "DF-005",
    full_name: "Rohan Kapoor",
    email: "rohan@dayflow.io",
    phone: "+91 95544 33221",
    address: "Hyderabad, India",
    department: "Marketing",
    designation: "Marketing Specialist",
    date_of_joining: "2023-08-01",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-emp-6",
    employee_id: "DF-006",
    full_name: "Neha Gupta",
    email: "neha@dayflow.io",
    phone: "+91 94433 22110",
    address: "Pune, India",
    department: "Finance",
    designation: "Financial Analyst",
    date_of_joining: "2023-11-15",
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/* -------------------------------- Admin ------------------------------- */

function AdminDashboard({ me }: { me: CurrentUser }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const fourteenAgo = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const { data: everyone = DEMO_PROFILES } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      if (!data || data.length === 0) {
        return DEMO_PROFILES;
      }
      return data as Profile[];
    },
  });

  const { data: todayRows } = useQuery({
    queryKey: ["attendance", "day", today],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", today);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: rangeRows } = useQuery({
    queryKey: ["attendance", "range", fourteenAgo],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("user_id, date, status")
        .gte("date", fourteenAgo);
      return (data ?? []) as Pick<AttendanceRow, "user_id" | "date" | "status">[];
    },
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles(full_name, employee_id, department, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const quickApprove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "approved", reviewed_by: me.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave approved");
      queryClient.invalidateQueries({ queryKey: ["leave"] });
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
  const onLeaveToday = (todayRows ?? []).filter((r) => r.status === "leave").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {greeting()}, {me.profile?.full_name?.split(" ")[0] ?? "there"}.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {format(new Date(), "EEEE, dd MMMM yyyy")} · Here's how the team is doing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total employees"
          value={(everyone ?? []).length}
          hint="active profiles"
        />
        <StatCard
          icon={UserCheck}
          label="Present today"
          value={presentToday}
          hint={`of ${(everyone ?? []).length} checked in`}
        />
        <StatCard
          icon={Palmtree}
          label="On leave today"
          value={onLeaveToday}
          hint="approved time off"
        />
        <StatCard
          icon={Wallet}
          label="Pending approvals"
          value={(pendingLeaves ?? []).length}
          hint="leave requests waiting"
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
          <h2 className="font-display text-lg font-semibold text-foreground">Team by department</h2>
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
                  src={l.profiles?.avatar_url}
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
    </div>
  );
}
