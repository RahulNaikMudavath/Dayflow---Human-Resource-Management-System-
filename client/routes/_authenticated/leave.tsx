import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, Palmtree, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  LEAVE_ALLOWANCE,
  LEAVE_TYPE_LABEL,
  leaveDayCount,
  processLeaveDecision,
  createLeaveRequestAndNotify,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/dayflow";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { LogoLoader } from "@/components/common/logo-loader";
import {
  EmptyState,
  InitialsAvatar,
  LeaveStatusBadge,
  PageHeader,
} from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Time Off — Dayflow" },
      {
        name: "description",
        content: "Apply for leave and review time-off requests.",
      },
    ],
  }),
  component: LeavePage,
});

function LeavePage() {
  const { data: me } = useCurrentUser();
  if (!me) {
    return <LogoLoader label="Loading leave requests..." />;
  }
  return me.isAdmin ? <AdminLeave me={me} /> : <EmployeeLeave me={me} />;
}

/* --------------------------- Apply dialog ----------------------------- */

function ApplyLeaveDialog({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LeaveType>("paid");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [remarks, setRemarks] = useState("");

  const apply = useMutation({
    mutationFn: async () => {
      if (!start || !end) throw new Error("Pick a start and end date.");
      if (end < start) throw new Error("End date can't be before start date.");
      await createLeaveRequestAndNotify({
        userId,
        leaveType: type,
        startDate: start,
        endDate: end,
        remarks,
      });
    },
    onSuccess: () => {
      toast.success("Leave request sent to HR & Admin notified.");
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      setStart("");
      setEnd("");
      setRemarks("");
    },
    onError: (e) => toast.error(e.message),
  });

  const days = start && end && end >= start ? leaveDayCount(start, end) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="size-4" />
          Apply for leave
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Apply for leave
          </DialogTitle>
          <DialogDescription>
            Your request goes straight to HR for review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
              <SelectTrigger className="rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid leave</SelectItem>
                <SelectItem value="sick">Sick leave</SelectItem>
                <SelectItem value="unpaid">Unpaid leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-xl bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-xl bg-card"
              />
            </div>
          </div>
          {days > 0 && (
            <p className="rounded-xl bg-accent/60 px-4 py-2.5 text-sm font-medium text-accent-foreground">
              {days} working day{days === 1 ? "" : "s"} of{" "}
              {LEAVE_TYPE_LABEL[type].toLowerCase()}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Anything HR should know?"
              className="rounded-xl bg-card"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending}
            className="rounded-xl"
          >
            {apply.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Employee ------------------------------ */

function EmployeeLeave({ me }: { me: CurrentUser }) {
  const yearStart = format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");

  const { data: myLeaves } = useQuery({
    queryKey: ["leave", "mine", "all"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const usedBy = (type: LeaveType) =>
    (myLeaves ?? [])
      .filter(
        (l) =>
          l.leave_type === type &&
          l.status === "approved" &&
          l.start_date >= yearStart,
      )
      .reduce((s, l) => s + leaveDayCount(l.start_date, l.end_date), 0);

  return (
    <div>
      <PageHeader
        title="Time Off"
        description="Know your balance, apply in seconds, track every request."
      >
        <ApplyLeaveDialog userId={me.id} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["paid", "sick", "unpaid"] as LeaveType[]).map((t) => {
          const used = usedBy(t);
          const total = LEAVE_ALLOWANCE[t];
          const pct = Math.min((used / total) * 100, 100);
          return (
            <div
              key={t}
              className="rounded-2xl border border-border bg-card p-5 shadow-lift"
            >
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {LEAVE_TYPE_LABEL[t]}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold text-foreground">
                {Math.max(total - used, 0)}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  / {total} days left
                </span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {used} used this year
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            My requests
          </h2>
        </div>
        {(myLeaves ?? []).length === 0 ? (
          <EmptyState
            icon={Palmtree}
            title="No requests yet"
            description="When you apply for leave, it will show up here with its status."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Dates</th>
                  <th className="px-6 py-3.5">Days</th>
                  <th className="px-6 py-3.5">Remarks</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">HR comment</th>
                </tr>
              </thead>
              <tbody>
                {(myLeaves ?? []).map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-6 py-3 font-semibold text-foreground">
                      {LEAVE_TYPE_LABEL[l.leave_type]}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {format(new Date(l.start_date), "dd MMM")} –{" "}
                      {format(new Date(l.end_date), "dd MMM yyyy")}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {leaveDayCount(l.start_date, l.end_date)}
                    </td>
                    <td className="max-w-48 truncate px-6 py-3 text-muted-foreground">
                      {l.remarks ?? "—"}
                    </td>
                    <td className="px-6 py-3">
                      <LeaveStatusBadge status={l.status} />
                    </td>
                    <td className="max-w-48 truncate px-6 py-3 text-muted-foreground">
                      {l.reviewer_comment ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Admin ------------------------------- */

function AdminLeave({ me }: { me: CurrentUser }) {
  const queryClient = useQueryClient();
  const [review, setReview] = useState<{
    leave: LeaveRequest;
    action: "approved" | "rejected";
  } | null>(null);
  const [comment, setComment] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["leave", "admin", "all"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles(full_name, employee_id, department)")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      status,
      reviewer_comment,
    }: {
      id: string;
      status: LeaveStatus;
      reviewer_comment: string | null;
    }) => {
      const target = (requests ?? []).find((r) => r.id === id);
      if (target) {
        await processLeaveDecision({
          leave: target,
          status,
          reviewer_comment,
          reviewer_id: me.id,
        });
      } else {
        const { error } = await supabase
          .from("leave_requests")
          .update({ status, reviewer_comment, reviewed_by: me.id })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === "approved"
          ? "Leave approved and notification sent to employee."
          : "Leave rejected and notification sent to employee.",
      );
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      setReview(null);
      setComment("");
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const history = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Leave approvals"
        description="Review requests, decide with context, and keep records aligned."
      />

      <Tabs defaultValue="pending">
        <TabsList className="rounded-xl bg-secondary">
          <TabsTrigger value="pending" className="rounded-lg">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-5">
          {pending.length === 0 ? (
            <EmptyState
              icon={Check}
              title="All caught up"
              description="No leave requests are waiting for review right now."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pending.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-lift"
                >
                  <div className="flex items-center gap-3">
                    <InitialsAvatar
                      name={l.profiles?.full_name ?? "?"}
                      className="size-10 text-xs"
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        {l.profiles?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.profiles?.employee_id} · {l.profiles?.department}
                      </p>
                    </div>
                    <span className="ml-auto rounded-full bg-accent/60 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      {LEAVE_TYPE_LABEL[l.leave_type]}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm">
                    <p className="font-semibold text-foreground">
                      {format(new Date(l.start_date), "dd MMM")} –{" "}
                      {format(new Date(l.end_date), "dd MMM yyyy")}
                      <span className="ml-2 font-normal text-muted-foreground">
                        · {leaveDayCount(l.start_date, l.end_date)} working days
                      </span>
                    </p>
                    {l.remarks && (
                      <p className="mt-1 text-muted-foreground">
                        “{l.remarks}”
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        setReview({ leave: l, action: "approved" });
                        setComment("");
                      }}
                    >
                      <Check className="size-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        setReview({ leave: l, action: "rejected" });
                        setComment("");
                      }}
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Dates</th>
                    <th className="px-6 py-3.5">Days</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-border/60 last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar
                            name={l.profiles?.full_name ?? "?"}
                            className="size-8 text-xs"
                          />
                          <span className="font-semibold text-foreground">
                            {l.profiles?.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {LEAVE_TYPE_LABEL[l.leave_type]}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {format(new Date(l.start_date), "dd MMM")} –{" "}
                        {format(new Date(l.end_date), "dd MMM")}
                      </td>
                      <td className="px-6 py-3 text-foreground">
                        {leaveDayCount(l.start_date, l.end_date)}
                      </td>
                      <td className="px-6 py-3">
                        <LeaveStatusBadge status={l.status} />
                      </td>
                      <td className="max-w-48 truncate px-6 py-3 text-muted-foreground">
                        {l.reviewer_comment ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {review?.action === "approved" ? "Approve" : "Reject"} leave
            </DialogTitle>
            <DialogDescription>
              {review?.leave.profiles?.full_name} ·{" "}
              {review ? LEAVE_TYPE_LABEL[review.leave.leave_type] : ""} ·{" "}
              {review
                ? `${format(new Date(review.leave.start_date), "dd MMM")} – ${format(new Date(review.leave.end_date), "dd MMM")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Comment {review?.action === "rejected" && "(recommended)"}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for the employee…"
              className="rounded-xl bg-card"
            />
          </div>
          <DialogFooter>
            <Button
              variant={review?.action === "rejected" ? "destructive" : "default"}
              className="rounded-xl"
              disabled={decide.isPending}
              onClick={() =>
                review &&
                decide.mutate({
                  id: review.leave.id,
                  status: review.action,
                  reviewer_comment: comment || null,
                })
              }
            >
              {decide.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm {review?.action === "approved" ? "approval" : "rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
