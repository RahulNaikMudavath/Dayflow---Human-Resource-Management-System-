import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { IndianRupee, Loader2, Pencil, Plus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  formatINR,
  netPay,
  calculateUnpaidDeduction,
  netPayWithLeaves,
  leaveDayCount,
  type Profile,
  type SalaryStructure,
  type LeaveRequest,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { LogoLoader } from "@/components/common/logo-loader";
import {
  EmptyState,
  InitialsAvatar,
  PageHeader,
  StatCard,
} from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Dayflow" },
      {
        name: "description",
        content: "Salary structures, net pay and payroll control.",
      },
    ],
  }),
  component: PayrollPage,
});

type SalaryWithProfile = SalaryStructure & {
  profiles?: Pick<
    Profile,
    "full_name" | "employee_id" | "department" | "designation"
  > | null;
};

function PayrollPage() {
  const { data: me } = useCurrentUser();
  if (!me) {
    return <LogoLoader label="Loading payroll data..." />;
  }
  return me.isAdmin ? <AdminPayroll me={me} /> : <EmployeePayroll me={me} />;
}

/* ------------------------------ Employee ------------------------------ */

function EmployeePayroll({ me }: { me: CurrentUser }) {
  const { data: salary, isLoading } = useQuery({
    queryKey: ["payroll", "mine", me.id],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", me.id)
        .maybeSingle();
      return (data as SalaryStructure | null) ?? null;
    },
  });

  const { data: approvedLeaves } = useQuery({
    queryKey: ["leave", "mine", "approved"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .eq("status", "approved");
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const unpaidLeaveDays = useMemo(() => {
    return (approvedLeaves ?? [])
      .filter((l) => l.leave_type === "unpaid")
      .reduce((sum, l) => sum + leaveDayCount(l.start_date, l.end_date), 0);
  }, [approvedLeaves]);

  if (isLoading) {
    return <LogoLoader label="Calculating salary breakdown..." />;
  }

  if (!salary) {
    return (
      <div>
        <PageHeader
          title="Payroll"
          description="Your salary structure, always visible."
        />
        <EmptyState
          icon={Wallet}
          title="Salary not configured yet"
          description="HR hasn't set up your salary structure. Check back soon or reach out to People Ops."
        />
      </div>
    );
  }

  const gross = salary.basic + salary.hra + salary.allowances;
  const leaveDeduction = calculateUnpaidDeduction(salary, unpaidLeaveDays);
  const totalDeductions = salary.deductions + leaveDeduction;
  const net = netPayWithLeaves(salary, unpaidLeaveDays);

  const rows = [
    { label: "Basic", value: salary.basic, tone: "bg-chart-1" },
    { label: "House rent allowance", value: salary.hra, tone: "bg-chart-2" },
    { label: "Allowances", value: salary.allowances, tone: "bg-chart-3" },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll & Salary Slip"
        description="Your transparent salary breakdown, updated automatically with approved leave deductions."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="relative overflow-hidden rounded-2xl bg-sidebar p-8 text-sidebar-foreground shadow-lift lg:col-span-2">
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-sidebar-primary/15 blur-2xl" />
          <p className="text-xs font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
            Net monthly pay
          </p>
          <p className="mt-3 font-display text-5xl font-semibold tracking-tight">
            {formatINR(net)}
          </p>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            Gross {formatINR(gross)} − total deductions {formatINR(totalDeductions)}
          </p>
          {unpaidLeaveDays > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
              <p className="font-semibold">⚠️ Unpaid Leave Deduction Applied</p>
              <p className="mt-0.5 opacity-90">
                {unpaidLeaveDays} day(s) approved LWP = −{formatINR(leaveDeduction)} deducted.
              </p>
            </div>
          )}
          <div className="mt-6 rounded-xl bg-sidebar-accent/60 px-4 py-3 text-sm">
            <p className="text-sidebar-foreground/70">Annual gross</p>
            <p className="font-display text-xl font-semibold">
              {formatINR(gross * 12)}
            </p>
          </div>
          <p className="mt-4 text-xs text-sidebar-foreground/50">
            Effective from {format(new Date(salary.effective_from), "dd MMM yyyy")}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:col-span-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Monthly breakdown
          </h2>
          <div className="mt-5 space-y-4">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatINR(r.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${r.tone}`}
                    style={{
                      width: `${gross ? Math.max((r.value / gross) * 100, 2) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Statutory Deductions (PF, tax)
                </span>
                <span className="font-semibold text-status-absent tabular-nums">
                  − {formatINR(salary.deductions)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-status-absent"
                  style={{
                    width: `${gross ? Math.max((salary.deductions / gross) * 100, 2) : 0}%`,
                  }}
                />
              </div>
            </div>

            {unpaidLeaveDays > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-destructive">
                    Unpaid Leave Deduction ({unpaidLeaveDays} LWP days)
                  </span>
                  <span className="font-semibold text-destructive tabular-nums">
                    − {formatINR(leaveDeduction)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Calculated based on daily rate (Gross / 30 × {unpaidLeaveDays} days)
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between rounded-xl bg-accent/50 px-4 py-3">
            <span className="text-sm font-semibold text-accent-foreground">
              Take-home / Net Pay
            </span>
            <span className="font-display text-xl font-semibold text-accent-foreground tabular-nums">
              {formatINR(net)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Admin ------------------------------- */

function AdminPayroll({ me }: { me: CurrentUser }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SalaryWithProfile | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: salaries } = useQuery({
    queryKey: ["payroll", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_structures")
        .select("*, profiles(full_name, employee_id, department, designation)")
        .order("basic", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as SalaryWithProfile[];
    },
  });

  const { data: everyone } = useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name")
        .limit(100);
      return (data ?? []) as Profile[];
    },
  });

  const { data: allApprovedLeaves } = useQuery({
    queryKey: ["leave", "admin", "approved-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "approved")
        .limit(500);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const getUnpaidDaysForUser = (userId: string) => {
    return (allApprovedLeaves ?? [])
      .filter((l) => l.user_id === userId && l.leave_type === "unpaid")
      .reduce((sum, l) => sum + leaveDayCount(l.start_date, l.end_date), 0);
  };

  const missing = useMemo(() => {
    const covered = new Set((salaries ?? []).map((s) => s.user_id));
    return (everyone ?? []).filter((p) => !covered.has(p.id));
  }, [salaries, everyone]);

  const totalNet = (salaries ?? []).reduce(
    (s, r) => s + netPayWithLeaves(r, getUnpaidDaysForUser(r.user_id)),
    0
  );
  const avgNet = (salaries ?? []).length
    ? Math.round(totalNet / (salaries ?? []).length)
    : 0;

  return (
    <div>
      <PageHeader
        title="Payroll & Salary Control"
        description="Review team salary structures and live leave deductions."
      >
        <Button
          className="rounded-xl"
          onClick={() => setCreating(true)}
          disabled={missing.length === 0}
        >
          <Plus className="size-4" />
          Add structure
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Total Net Payout"
          value={formatINR(totalNet)}
          hint="net across team after leave deductions"
        />
        <StatCard
          icon={IndianRupee}
          label="Average net pay"
          value={formatINR(avgNet)}
          hint="per employee"
        />
        <StatCard
          icon={Users}
          label="Structures set"
          value={(salaries ?? []).length}
          hint={`${missing.length} employee${missing.length === 1 ? "" : "s"} pending`}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-6 py-3.5 text-right">Basic</th>
                <th className="px-6 py-3.5 text-right">HRA</th>
                <th className="px-6 py-3.5 text-right">Allowances</th>
                <th className="px-6 py-3.5 text-right">Fixed Deductions</th>
                <th className="px-6 py-3.5 text-right">LWP Deduction</th>
                <th className="px-6 py-3.5 text-right">Net pay</th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {(salaries ?? []).map((s) => {
                const unpaidDays = getUnpaidDaysForUser(s.user_id);
                const lwpDeduction = calculateUnpaidDeduction(s, unpaidDays);
                const empNet = netPayWithLeaves(s, unpaidDays);

                return (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={s.profiles?.full_name ?? "?"}
                          className="size-9 text-xs"
                        />
                        <div>
                          <p className="font-semibold text-foreground">
                            {s.profiles?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.profiles?.employee_id} · {s.profiles?.designation}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-foreground tabular-nums">
                      {formatINR(s.basic)}
                    </td>
                    <td className="px-6 py-3 text-right text-foreground tabular-nums">
                      {formatINR(s.hra)}
                    </td>
                    <td className="px-6 py-3 text-right text-foreground tabular-nums">
                      {formatINR(s.allowances)}
                    </td>
                    <td className="px-6 py-3 text-right text-status-absent tabular-nums">
                      −{formatINR(s.deductions)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-destructive tabular-nums">
                      {unpaidDays > 0 ? (
                        <span>−{formatINR(lwpDeduction)} <span className="text-[10px] text-muted-foreground">({unpaidDays}d)</span></span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-foreground tabular-nums">
                      {formatINR(empNet)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setEditing(s)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SalaryDialog
        me={me}
        salary={editing}
        missing={creating ? missing : []}
        open={!!editing || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["payroll"] });
          setEditing(null);
          setCreating(false);
        }}
      />
    </div>
  );
}

function SalaryDialog({
  me,
  salary,
  missing,
  open,
  onClose,
  onSaved,
}: {
  me: CurrentUser;
  salary: SalaryWithProfile | null;
  missing: Profile[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [basic, setBasic] = useState("0");
  const [hra, setHra] = useState("0");
  const [allowances, setAllowances] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Populate fields when a salary row is opened for editing.
  if (salary && loadedFor !== salary.id) {
    setLoadedFor(salary.id);
    setBasic(String(salary.basic));
    setHra(String(salary.hra));
    setAllowances(String(salary.allowances));
    setDeductions(String(salary.deductions));
  }
  if (!salary && loadedFor !== "create") {
    setLoadedFor("create");
    setUserId("");
    setBasic("0");
    setHra("0");
    setAllowances("0");
    setDeductions("0");
  }

  const net =
    (Number(basic) || 0) +
    (Number(hra) || 0) +
    (Number(allowances) || 0) -
    (Number(deductions) || 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        basic: Number(basic) || 0,
        hra: Number(hra) || 0,
        allowances: Number(allowances) || 0,
        deductions: Number(deductions) || 0,
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      };
      if (salary) {
        const { error } = await supabase
          .from("salary_structures")
          .update(payload)
          .eq("id", salary.id);
        if (error) throw error;
      } else {
        if (!userId) throw new Error("Pick an employee first.");
        const { error } = await supabase
          .from("salary_structures")
          .insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(salary ? "Salary updated." : "Salary structure created.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="rounded-xl bg-card"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {salary
              ? `Edit salary — ${salary.profiles?.full_name ?? ""}`
              : "New salary structure"}
          </DialogTitle>
          <DialogDescription>
            Monthly amounts in INR. Net pay updates live.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!salary && (
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="rounded-xl bg-card">
                  <SelectValue placeholder="Pick an employee" />
                </SelectTrigger>
                <SelectContent>
                  {missing.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} ({p.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {field("Basic", basic, setBasic)}
            {field("HRA", hra, setHra)}
            {field("Allowances", allowances, setAllowances)}
            {field("Deductions", deductions, setDeductions)}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-accent/50 px-4 py-3">
            <span className="text-sm font-semibold text-accent-foreground">
              Net monthly pay
            </span>
            <span className="font-display text-xl font-semibold text-accent-foreground tabular-nums">
              {formatINR(net)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-xl"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Save structure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
