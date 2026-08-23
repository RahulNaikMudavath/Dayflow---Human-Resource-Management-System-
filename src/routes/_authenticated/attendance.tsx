import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Palmtree,
  Sunrise,
  Users,
  UserX2,
} from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  ATTENDANCE_META,
  formatTime,
  workHours,
  type AttendanceRow,
  type Profile,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { CheckInCard } from "@/components/dayflow/check-in-card";
import {
  AttendanceBadge,
  EmptyState,
  InitialsAvatar,
  PageHeader,
  StatCard,
} from "@/components/dayflow/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Dayflow" },
      {
        name: "description",
        content: "Track daily check-ins, weekly hours and team attendance.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { data: me } = useCurrentUser();
  if (!me) {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  }
  return me.isAdmin ? <AdminAttendance /> : <EmployeeAttendance me={me} />;
}

/* ------------------------------ Employee ------------------------------ */

function EmployeeAttendance({ me }: { me: CurrentUser }) {
  const [cursor, setCursor] = useState(new Date());
  const monthKey = format(cursor, "yyyy-MM");
  const rangeStart = format(startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(cursor), "yyyy-MM-dd");

  const { data: rows } = useQuery({
    queryKey: ["attendance", "mine", monthKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .order("date");
      if (!data || data.length === 0) {
        const today = new Date();
        return Array.from({ length: 20 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = format(d, "yyyy-MM-dd");
          return {
            id: `demo-att-mine-${dateStr}`,
            user_id: me.id,
            date: dateStr,
            check_in: `${dateStr}T09:15:00.000Z`,
            check_out: `${dateStr}T17:30:00.000Z`,
            status: (i === 3 ? "leave" : i === 7 ? "half_day" : "present") as AttendanceRow["status"],
          };
        });
      }
      return data as AttendanceRow[];
    },
  });

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    (rows ?? []).forEach((r) => map.set(r.date, r));
    return map;
  }, [rows]);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const inMonth = (rows ?? []).filter((r) => isSameMonth(new Date(r.date), cursor));
  const counts = {
    present: inMonth.filter((r) => r.status === "present").length,
    half: inMonth.filter((r) => r.status === "half_day").length,
    leave: inMonth.filter((r) => r.status === "leave").length,
    absent: inMonth.filter((r) => r.status === "absent").length,
  };

  const recent = (rows ?? [])
    .filter((r) => r.date <= todayKey)
    .slice(-7)
    .reverse();

  /* Weekly view */
  const [weekCursor, setWeekCursor] = useState(new Date());
  const weekStart = startOfWeek(weekCursor, { weekStartsOn: 1 });
  const weekStartKey = format(weekStart, "yyyy-MM-dd");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: weekRows } = useQuery({
    queryKey: ["attendance", "mine-week", weekStartKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me.id)
        .gte("date", weekStartKey)
        .lte("date", format(addDays(weekStart, 6), "yyyy-MM-dd"))
        .order("date");
      if (!data || data.length === 0) {
        return weekDays.slice(0, 5).map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          return {
            id: `demo-att-week-${dateStr}`,
            user_id: me.id,
            date: dateStr,
            check_in: `${dateStr}T09:15:00.000Z`,
            check_out: `${dateStr}T17:30:00.000Z`,
            status: "present" as AttendanceRow["status"],
          };
        });
      }
      return data as AttendanceRow[];
    },
  });

  const weekTotal = (weekRows ?? []).reduce(
    (sum, r) => sum + (workHours(r.check_in, r.check_out) ?? 0),
    0,
  );

  const exportWeek = async () => {
    const { exportWeeklyAttendancePdf } = await import("@/lib/pdf");
    exportWeeklyAttendancePdf({
      profile: me.profile ?? {
        full_name: me.email,
        employee_id: "—",
        department: null,
        designation: null,
      },
      weekStart,
      rows: weekRows ?? [],
    });
    toast.success("Weekly attendance PDF downloaded.");
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check in, check out, and keep your record honest."
      />
      <CheckInCard userId={me.id} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Sunrise} label="Present" value={counts.present} hint="this month" />
        <StatCard icon={Palmtree} label="On leave" value={counts.leave} hint="this month" />
        <StatCard icon={CalendarX2} label="Half days" value={counts.half} hint="this month" />
        <StatCard icon={UserX2} label="Absent" value={counts.absent} hint="this month" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <CalendarRange className="size-5 text-primary" />
              Week of {format(weekStart, "dd MMM yyyy")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {Math.round(weekTotal * 10) / 10}h logged this week
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="mr-1 rounded-lg"
              onClick={() => void exportWeek()}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setWeekCursor((c) => addDays(c, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setWeekCursor(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setWeekCursor((c) => addDays(c, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {weekDays.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const row = (weekRows ?? []).find((r) => r.date === key);
            const isToday = key === todayKey;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const hours = row ? workHours(row.check_in, row.check_out) : null;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border px-3 py-3",
                  isToday ? "border-primary bg-accent/50" : "border-border bg-background",
                  isWeekend && !row && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    {format(d, "EEE")}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {format(d, "d MMM")}
                  </span>
                </div>
                {row ? (
                  <>
                    <AttendanceBadge status={row.status} />
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {formatTime(row.check_in)} → {formatTime(row.check_out)}
                    </p>
                    {hours != null && (
                      <p className="text-xs font-semibold text-foreground">{hours}h</p>
                    )}
                  </>
                ) : (
                  <p className="py-1 text-[11px] text-muted-foreground">
                    {isWeekend ? "Weekend" : "No record"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {format(cursor, "MMMM yyyy")}
            </h2>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded-lg"
                onClick={() => setCursor((c) => addMonths(c, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded-lg"
                onClick={() => setCursor((c) => addMonths(c, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
              >
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const row = byDate.get(key);
              const outside = !isSameMonth(d, cursor);
              return (
                <div
                  key={key}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-sm",
                    outside && "opacity-30",
                    key === todayKey
                      ? "border-primary bg-accent/50 font-semibold"
                      : "border-border bg-background",
                  )}
                >
                  <span className="text-foreground">{format(d, "d")}</span>
                  {row ? (
                    <span
                      className={cn("size-1.5 rounded-full", ATTENDANCE_META[row.status].dot)}
                      title={ATTENDANCE_META[row.status].label}
                    />
                  ) : (
                    <span className="size-1.5" />
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
          <h2 className="font-display text-lg font-semibold text-foreground">Recent days</h2>
          <div className="mt-4 space-y-2.5">
            {recent.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No records this month yet.
              </p>
            )}
            {recent.map((r) => {
              const hours = workHours(r.check_in, r.check_out);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {format(new Date(r.date), "EEE, dd MMM")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(r.check_in)} → {formatTime(r.check_out)}
                      {hours != null && ` · ${hours}h`}
                    </p>
                  </div>
                  <AttendanceBadge status={r.status} />
                </div>
              );
            })}
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

function AdminAttendance() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

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

  const { data: dayRows } = useQuery({
    queryKey: ["attendance", "day", date],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", date);
      if (!data || data.length === 0) {
        return DEMO_PROFILES.map((p, idx) => ({
          id: `demo-att-${p.id}-${date}`,
          user_id: p.id,
          date,
          check_in: `${date}T09:15:00.000Z`,
          check_out: idx % 2 === 0 ? `${date}T17:30:00.000Z` : null,
          status: (idx === 3 ? "leave" : idx === 4 ? "half_day" : "present") as AttendanceRow["status"],
        }));
      }
      return data as AttendanceRow[];
    },
  });

  const byUser = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    (dayRows ?? []).forEach((r) => map.set(r.user_id, r));
    return map;
  }, [dayRows]);

  const counts = {
    present: (dayRows ?? []).filter((r) => r.status === "present").length,
    half: (dayRows ?? []).filter((r) => r.status === "half_day").length,
    leave: (dayRows ?? []).filter((r) => r.status === "leave").length,
    absent: (dayRows ?? []).filter((r) => r.status === "absent").length,
  };
  const notMarked = (everyone ?? []).length - (dayRows ?? []).length;

  function shift(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(format(d, "yyyy-MM-dd"));
  }

  /** One-click weekly report for a single employee (week of the viewed day). */
  const exportEmployeeWeek = async (p: Profile) => {
    const ws = startOfWeek(new Date(date + "T00:00:00"), { weekStartsOn: 1 });
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", p.id)
      .gte("date", format(ws, "yyyy-MM-dd"))
      .lte("date", format(addDays(ws, 6), "yyyy-MM-dd"))
      .order("date");
    const { exportWeeklyAttendancePdf } = await import("@/lib/pdf");
    exportWeeklyAttendancePdf({
      profile: p,
      weekStart: ws,
      rows: (data ?? []) as AttendanceRow[],
    });
    toast.success(`Weekly report downloaded for ${p.full_name}.`);
  };

  return (
    <div>
      <PageHeader
        title="Team attendance"
        description="Live status for every employee, one day at a time."
      >
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-lg"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-40 rounded-xl bg-card"
        />
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-lg"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Sunrise}
          label="Present"
          value={counts.present}
          hint={format(new Date(date), "dd MMM yyyy")}
        />
        <StatCard
          icon={Palmtree}
          label="On leave"
          value={counts.leave}
          hint={format(new Date(date), "dd MMM yyyy")}
        />
        <StatCard
          icon={CalendarX2}
          label="Half day"
          value={counts.half}
          hint={format(new Date(date), "dd MMM yyyy")}
        />
        <StatCard
          icon={UserX2}
          label="Absent"
          value={counts.absent}
          hint={`${notMarked} not marked yet`}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Check-in</th>
                <th className="px-5 py-3.5">Check-out</th>
                <th className="px-5 py-3.5">Hours</th>
                <th className="px-5 py-3.5 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {(everyone ?? []).map((p) => {
                const row = byUser.get(p.id);
                const hours = row ? workHours(row.check_in, row.check_out) : null;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={p.full_name}
                          src={p.avatar_url}
                          className="size-9 text-xs"
                        />
                        <div>
                          <p className="font-semibold text-foreground">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.department ?? "—"}</td>
                    <td className="px-5 py-3">
                      {row ? (
                        <AttendanceBadge status={row.status} />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          Not marked
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-foreground">
                      {formatTime(row?.check_in ?? null)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-foreground">
                      {formatTime(row?.check_out ?? null)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-foreground">
                      {hours != null ? `${hours}h` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        title={`Export week of ${format(startOfWeek(new Date(date + "T00:00:00"), { weekStartsOn: 1 }), "dd MMM")} as PDF`}
                        onClick={() => void exportEmployeeWeek(p)}
                      >
                        <FileDown className="size-3.5" />
                        Week PDF
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(everyone ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10">
                    <EmptyState
                      icon={Users}
                      title="No employees yet"
                      description="Employee profiles will appear here once people join."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
