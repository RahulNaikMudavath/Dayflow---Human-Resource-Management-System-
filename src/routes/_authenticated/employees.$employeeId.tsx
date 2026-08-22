import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import {
  supabase,
  formatINR,
  formatTime,
  leaveDayCount,
  netPay,
  workHours,
  LEAVE_TYPE_LABEL,
  type AttendanceRow,
  type LeaveRequest,
  type Profile,
  type SalaryStructure,
} from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  AttendanceBadge,
  EmptyState,
  InitialsAvatar,
  LeaveStatusBadge,
} from "@/components/dayflow/bits";
import { ProfileEditDialog } from "@/components/dayflow/profile-edit-dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({
    meta: [
      { title: "Employee — Dayflow" },
      { name: "description", content: "Employee profile, attendance and pay." },
    ],
  }),
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams();
  const { data: me } = useCurrentUser();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();
      return (data as Profile | null) ?? null;
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance", "user", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", employeeId)
        .order("date", { ascending: false })
        .limit(8);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: leaves } = useQuery({
    queryKey: ["leave", "user", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as LeaveRequest[];
    },
  });

  const { data: salary } = useQuery({
    queryKey: ["payroll", "user", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", employeeId)
        .maybeSingle();
      return (data as SalaryStructure | null) ?? null;
    },
  });

  if (isLoading || !me) {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
  }

  if (me.id !== employeeId && !me.isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="HR access only"
        description="You can only view your own profile."
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Employee not found"
        description="This profile doesn't exist or was removed."
      />
    );
  }

  const info = [
    { icon: Mail, label: "Email", value: profile.email ?? "—" },
    { icon: Phone, label: "Phone", value: profile.phone ?? "—" },
    { icon: MapPin, label: "Address", value: profile.address ?? "—" },
    { icon: Briefcase, label: "Department", value: profile.department ?? "—" },
    {
      icon: CalendarDays,
      label: "Joined",
      value: profile.date_of_joining
        ? format(new Date(profile.date_of_joining), "dd MMM yyyy")
        : "—",
    },
  ];

  return (
    <div>
      <Link
        to="/employees"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to people
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
        <div className="flex flex-wrap items-center gap-5">
          <InitialsAvatar
            name={profile.full_name}
            src={profile.avatar_url}
            className="size-16 rounded-2xl text-xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {profile.full_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.designation ?? "—"} · {profile.department ?? "—"} ·{" "}
              <span className="font-mono">{profile.employee_id}</span>
            </p>
          </div>
          <ProfileEditDialog
            profile={profile}
            canEditAll={me.isAdmin}
            trigger={
              <Button variant="outline" className="rounded-xl">
                <Pencil className="size-4" />
                Edit profile
              </Button>
            }
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {info.map((i) => (
            <div key={i.label} className="rounded-xl bg-background px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <i.icon className="size-3.5" />
                {i.label}
              </p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{i.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
          <h2 className="font-display text-lg font-semibold text-foreground">Recent attendance</h2>
          <div className="mt-4 space-y-2.5">
            {(attendance ?? []).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No attendance records yet.
              </p>
            )}
            {(attendance ?? []).map((r) => {
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

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            <h2 className="font-display text-lg font-semibold text-foreground">Leave history</h2>
            <div className="mt-4 space-y-2.5">
              {(leaves ?? []).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No leave requests yet.
                </p>
              )}
              {(leaves ?? []).map((l) => (
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

          <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-lift">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
              <Wallet className="size-3.5 text-sidebar-primary" />
              Net monthly pay
            </div>
            {salary ? (
              <>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                  {formatINR(netPay(salary))}
                </p>
                <p className="mt-1 text-sm text-sidebar-foreground/70">
                  Basic {formatINR(salary.basic)} · HRA {formatINR(salary.hra)} · Allowances{" "}
                  {formatINR(salary.allowances)} · Deductions −{formatINR(salary.deductions)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-sidebar-foreground/70">
                No salary structure set yet — add one from Payroll.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
