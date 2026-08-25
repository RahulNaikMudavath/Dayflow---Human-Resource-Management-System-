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
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Palmtree,
  Sunrise,
  Users,
  UserX2,
} from "lucide-react";
import {
  supabase,
  ATTENDANCE_META,
  formatTime,
  workHours,
  formatWorkDuration,
  type AttendanceRow,
  type Profile,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { LogoLoader } from "@/components/common/logo-loader";
import { CheckInCard } from "@/components/features/attendance/check-in-card";
import {
  AttendanceBadge,
  EmptyState,
  InitialsAvatar,
  PageHeader,
  StatCard,
} from "@/components/common/bits";
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
    return <LogoLoader label="Loading attendance logs..." />;
  }
  return me.isAdmin ? <AdminAttendance /> : <EmployeeAttendance me={me} />;
}

/* ------------------------------ Employee ------------------------------ */

function EmployeeAttendance({ me }: { me: CurrentUser }) {
  const [cursor, setCursor] = useState(new Date());
  const monthKey = format(cursor, "yyyy-MM");
  const rangeStart = format(
    startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    "yyyy-MM-dd",
  );
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
      return (data ?? []) as AttendanceRow[];
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
          <h2 className="font-display text-lg font-semibold text-foreground">
            Recent days
          </h2>
          <div className="mt-4 space-y-2.5">
            {recent.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No records this month yet.
              </p>
            )}
            {recent.map((r) => {
              const duration = formatWorkDuration(r.check_in, r.check_out);
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
                      {duration != null && ` · ${duration}`}
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

/* -------------------------------- Admin ------------------------------- */

function AdminAttendance() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: everyone } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      return (data ?? []) as Profile[];
    },
  });

  const { data: dayRows } = useQuery({
    queryKey: ["attendance", "day", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", date);
      return (data ?? []) as AttendanceRow[];
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
        <StatCard icon={Sunrise} label="Present" value={counts.present} hint={format(new Date(date), "dd MMM yyyy")} />
        <StatCard icon={Palmtree} label="On leave" value={counts.leave} hint={format(new Date(date), "dd MMM yyyy")} />
        <StatCard icon={CalendarX2} label="Half day" value={counts.half} hint={format(new Date(date), "dd MMM yyyy")} />
        <StatCard icon={UserX2} label="Absent" value={counts.absent} hint={`${notMarked} not marked yet`} />
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
              </tr>
            </thead>
            <tbody>
              {(everyone ?? []).map((p) => {
                const row = byUser.get(p.id);
                const duration = row ? formatWorkDuration(row.check_in, row.check_out) : null;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={p.full_name} className="size-9 text-xs" />
                        <div>
                          <p className="font-semibold text-foreground">
                            {p.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.employee_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {p.department ?? "—"}
                    </td>
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
                      {duration ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {(everyone ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10">
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
