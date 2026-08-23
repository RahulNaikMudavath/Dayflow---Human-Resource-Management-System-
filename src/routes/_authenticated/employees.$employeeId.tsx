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

const DEMO_PROFILES: Profile[] = [
  {
    id: "demo-user-id",
    employee_id: "DF-001",
    full_name: "Pranav Hiremath",
    email: "pranavhiremath7777@gmail.com",
    phone: "+91 98220 41102",
    address: "Bengaluru, India",
    department: "People Ops",
    designation: "Head of HR & Operations",
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
      if (!data) {
        return DEMO_PROFILES.find((p) => p.id === employeeId) ?? null;
      }
      return data as Profile | null;
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
      if (!data || data.length === 0) {
        const today = new Date();
        return Array.from({ length: 5 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          return {
            id: `demo-att-${i}`,
            user_id: employeeId,
            date: dateStr,
            check_in: `${dateStr}T09:15:00.000Z`,
            check_out: `${dateStr}T17:30:00.000Z`,
            status: (i === 2 ? "leave" : i === 4 ? "half_day" : "present") as AttendanceRow["status"],
          };
        });
      }
      return data as AttendanceRow[];
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
      if (!data || data.length === 0) {
        return [
          {
            id: "demo-leave-1",
            user_id: employeeId,
            leave_type: "paid" as const,
            start_date: "2026-08-10",
            end_date: "2026-08-12",
            remarks: "Family vacation",
            status: "approved" as const,
            reviewer_comment: "Approved by HR",
            reviewed_by: "demo-user-id",
            created_at: "2026-08-01T10:00:00.000Z",
          },
          {
            id: "demo-leave-2",
            user_id: employeeId,
            leave_type: "sick" as const,
            start_date: "2026-07-05",
            end_date: "2026-07-05",
            remarks: "Fever",
            status: "approved" as const,
            reviewer_comment: "Take care",
            reviewed_by: "demo-user-id",
            created_at: "2026-07-04T08:00:00.000Z",
          },
        ];
      }
      return data as LeaveRequest[];
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
      if (!data) {
        return {
          id: `demo-sal-${employeeId}`,
          user_id: employeeId,
          basic: 65000,
          hra: 26000,
          allowances: 14000,
          deductions: 8500,
          effective_from: "2024-01-01",
        } as SalaryStructure;
      }
      return data as SalaryStructure | null;
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
