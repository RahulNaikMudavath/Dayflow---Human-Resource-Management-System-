import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfWeek } from "date-fns";
import {
  Bot,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  CalendarCheck,
  Palmtree,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  UserCheck,
  UserX,
  AlertCircle,
  Shield,
  ShieldCheck,
  User,
  IndianRupee,
  Building2,
  Check,
  Search,
  Zap,
  TrendingUp,
  Sparkle,
  MessageSquare,
  ArrowRight,
  Activity,
  CheckCheck,
  Loader2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  supabase,
  LEAVE_ALLOWANCE,
  LEAVE_TYPE_LABEL,
  leaveDayCount,
  processLeaveDecision,
  createLeaveRequestAndNotify,
  workHours,
  formatTime,
  formatINR,
  netPay,
  netPayWithLeaves,
  calculateUnpaidDeduction,
  type AttendanceRow,
  type LeaveRequest,
  type LeaveType,
  type Profile,
  type SalaryStructure,
} from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { InitialsAvatar } from "@/components/common/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  type?:
  | "text"
  | "leave_form"
  | "attendance_summary"
  | "leave_balance"
  | "pending_approvals"
  | "hr_pending_leaves"
  | "employee_info"
  | "payroll_summary"
  | "action_success";
  payload?: any;
}

// Quick action suggestions
const EMPLOYEE_PROMPTS = [
  { label: "⚡ Check In / Out", prompt: "What is my attendance status today?" },
  { label: "🌴 My Leave Balance", prompt: "How many leaves do I have left?" },
  { label: "📅 Apply Time Off", prompt: "Apply paid leave for tomorrow" },
  { label: "⏱️ Hours Logged This Week", prompt: "How many hours did I log this week?" },
  { label: "💰 My Salary Breakdown", prompt: "Show my salary structure and net pay" },
  { label: "📖 Office HR Rules", prompt: "What are the office timing and leave rules?" },
];

const HR_ADMIN_PROMPTS = [
  { label: "⏳ Pending Approvals", prompt: "Show pending leave requests queue" },
  { label: "👥 Team Attendance Today", prompt: "Who is checked in and who is on leave today?" },
  { label: "❌ Who is Absent Today?", prompt: "List all employees absent today" },
  { label: "🔍 Find Employee Profile", prompt: "Lookup employee profile" },
  { label: "📊 Department Breakdown", prompt: "Show department employee count breakdown" },
  { label: "💸 Payroll Summary", prompt: "Show company payroll overview" },
];

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-1" />;

        if (line.includes("──────────")) {
          return <hr key={lineIdx} className="my-1.5 border-border/60" />;
        }

        const parts = line.split(/(\*\*.*?\*\*)/g);
        const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");

        return (
          <p
            key={lineIdx}
            className={cn(isBullet ? "pl-1.5 flex items-start gap-1.5" : "")}
          >
            {parts.map((part, partIdx) => {
              if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                const content = part.slice(2, -2);
                return (
                  <strong key={partIdx} className="font-bold text-foreground">
                    {content}
                  </strong>
                );
              }
              return <span key={partIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function InteractiveLeaveForm({
  initialPayload,
  onSubmit,
}: {
  initialPayload: {
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    remarks: string;
  };
  onSubmit: (data: {
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    remarks: string;
  }) => Promise<void>;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>(initialPayload.leave_type || "paid");
  const [startDate, setStartDate] = useState(initialPayload.start_date);
  const [endDate, setEndDate] = useState(initialPayload.end_date);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const workingDays = leaveDayCount(startDate, endDate);
  const calendarDays = Math.max(
    1,
    Math.round(
      (new Date(endDate + "T00:00:00").getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000
    ) + 1
  );

  const durationLabel = workingDays > 0 ? `${workingDays} working day(s)` : `${calendarDays} day(s)`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please pick valid start and end dates.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ leave_type: leaveType, start_date: startDate, end_date: endDate, remarks });
      setIsSubmitted(true);
    } catch (err) {
      // Keep interactive state on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3.5 rounded-3xl bg-card/95 p-4 border border-border/80 text-card-foreground shadow-lg backdrop-blur-md transition-all"
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
            <Palmtree className="size-4" />
          </div>
          <span className="text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <CalendarCheck className="size-3.5 text-primary" /> Apply for Time Off
          </span>
        </div>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-extrabold text-primary border border-primary/20 shadow-xs flex items-center gap-1">
          <Clock className="size-3" />
          {durationLabel}
        </span>
      </div>

      {/* Leave Type Selection */}
      <div className="space-y-1.5 text-xs">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Leave Category
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "paid", label: "Paid", icon: "🌴", activeClass: "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-emerald-500 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/30 font-bold scale-[1.02]" },
            { id: "sick", label: "Sick", icon: "🤒", activeClass: "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-500 shadow-md shadow-blue-600/20 ring-2 ring-blue-400/30 font-bold scale-[1.02]" },
            { id: "unpaid", label: "LWP", icon: "⚠️", activeClass: "bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-500 shadow-md shadow-amber-600/20 ring-2 ring-amber-400/30 font-bold scale-[1.02]" },
          ].map((t) => {
            const isActive = leaveType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={isSubmitted}
                onClick={() => setLeaveType(t.id as LeaveType)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-2xl py-2 px-1 text-xs font-semibold transition-all duration-200 border cursor-pointer active:scale-95",
                  isActive
                    ? t.activeClass
                    : "bg-muted/60 text-muted-foreground border-border/70 hover:bg-accent hover:text-foreground"
                )}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Start Date</label>
          <div className="relative">
            <Input
              type="date"
              disabled={isSubmitted}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (new Date(e.target.value) > new Date(endDate)) {
                  setEndDate(e.target.value);
                }
              }}
              className="h-9 rounded-2xl bg-background/90 border-border/80 text-xs font-semibold px-3 focus-visible:ring-2 focus-visible:ring-primary/30 shadow-inner"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">End Date</label>
          <div className="relative">
            <Input
              type="date"
              disabled={isSubmitted}
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-2xl bg-background/90 border-border/80 text-xs font-semibold px-3 focus-visible:ring-2 focus-visible:ring-primary/30 shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="space-y-1 text-xs">
        <label className="text-[11px] font-semibold text-muted-foreground">Reason / Remarks</label>
        <Input
          placeholder="e.g. Personal work, medical appointment..."
          disabled={isSubmitted}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="h-9 rounded-2xl bg-background/90 border-border/80 text-xs font-medium px-3 focus-visible:ring-2 focus-visible:ring-primary/30 shadow-inner"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || isSubmitted}
        size="sm"
        className={cn(
          "w-full rounded-2xl gap-2 text-xs font-bold shadow-md h-10 transition-all duration-200 mt-1",
          isSubmitted
            ? "bg-emerald-600 hover:bg-emerald-600 text-white cursor-default shadow-emerald-600/20"
            : "bg-gradient-to-r from-primary via-primary/95 to-amber-600 hover:from-primary/90 hover:to-amber-500 text-primary-foreground hover:shadow-lg hover:scale-[1.01] active:scale-95 cursor-pointer"
        )}
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isSubmitted ? (
          <CheckCircle2 className="size-4 text-white" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        {isSubmitting
          ? "Submitting to HR..."
          : isSubmitted
            ? "Submitted to HR"
            : "Submit Leave Request"}
      </Button>
    </form>
  );
}

function InteractiveLeaveReviewer({
  req,
  onDecision,
  onBack,
}: {
  req: LeaveRequest;
  onDecision: (leaveId: string, status: "approved" | "rejected", comment?: string) => Promise<void>;
  onBack: () => void;
}) {
  const [comment, setComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const days = leaveDayCount(req.start_date, req.end_date);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onDecision(req.id, "approved", comment || "Approved by HR Director via Nova AI");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onDecision(req.id, "rejected", comment || "Declined by HR Director via Nova AI");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3.5 rounded-3xl bg-card/95 p-4 border border-amber-500/40 text-card-foreground shadow-xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-200">
      {/* Header with Back button */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowRight className="size-3.5 rotate-180" /> Back to Queue
        </button>
        <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold uppercase border border-amber-500/30">
          Leave Inspection
        </span>
      </div>

      {/* Employee Profile Summary */}
      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
        <InitialsAvatar name={req.profiles?.full_name ?? "?"} className="size-10 text-xs font-bold" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground truncate">{req.profiles?.full_name}</h4>
            <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border">
              ID: {req.profiles?.employee_id ?? "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {(req.profiles as any)?.designation ?? "Employee"} · {req.profiles?.department ?? "General"}
          </p>
        </div>
      </div>

      {/* Leave Request Specification Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl bg-background/80 p-2.5 border border-border/60">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Leave Type</span>
          <span className="font-bold text-foreground flex items-center gap-1">
            <Palmtree className="size-3.5 text-amber-500" />
            {LEAVE_TYPE_LABEL[req.leave_type]}
          </span>
        </div>
        <div className="rounded-2xl bg-background/80 p-2.5 border border-border/60">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Duration</span>
          <span className="font-bold text-foreground flex items-center gap-1">
            <Clock className="size-3.5 text-primary" />
            {days} working day(s)
          </span>
        </div>
      </div>

      {/* Date Range & Submitted Remarks */}
      <div className="rounded-2xl bg-background/90 p-3 border border-border/70 text-xs space-y-2">
        <div className="flex justify-between items-center text-muted-foreground">
          <span className="flex items-center gap-1 font-medium">
            <CalendarCheck className="size-3.5 text-primary" /> Date Period
          </span>
          <span className="font-mono font-bold text-foreground">
            {req.start_date} → {req.end_date}
          </span>
        </div>
        {req.remarks && (
          <div className="pt-1.5 border-t border-border/40 text-muted-foreground">
            <span className="text-[10px] font-bold uppercase block text-muted-foreground/80 mb-0.5">Employee Remarks</span>
            <p className="italic text-foreground text-xs bg-muted/40 p-2 rounded-xl border border-border/40">
              "{req.remarks}"
            </p>
          </div>
        )}
      </div>

      {/* Reviewer Optional Comment */}
      <div className="space-y-1 text-xs">
        <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          Reviewer Comment <span className="text-[10px] font-normal text-muted-foreground/70">(Optional)</span>
        </label>
        <Input
          placeholder="e.g. Approved after reviewing team coverage..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-9 rounded-2xl bg-background/90 border-border/80 text-xs font-medium px-3 focus-visible:ring-2 focus-visible:ring-amber-500/30 shadow-inner"
        />
      </div>

      {/* Action Confirmation Buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          disabled={isApproving || isRejecting}
          onClick={handleApprove}
          className="flex-1 rounded-2xl h-10 text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer"
        >
          {isApproving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Check className="size-4 mr-1.5" />}
          Confirm Approval
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isApproving || isRejecting}
          onClick={handleReject}
          className="flex-1 rounded-2xl h-10 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 active:scale-98 transition-all cursor-pointer"
        >
          {isRejecting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <X className="size-4 mr-1.5" />}
          Decline Request
        </Button>
      </div>
    </div>
  );
}

function PendingLeavesView({
  payload,
  onDecision,
}: {
  payload: LeaveRequest[];
  onDecision: (leaveId: string, status: "approved" | "rejected", comment?: string) => Promise<void>;
}) {
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [quickComments, setQuickComments] = useState<Record<string, string>>({});
  const [activeDeclineId, setActiveDeclineId] = useState<string | null>(null);

  if (selectedReq) {
    return (
      <InteractiveLeaveReviewer
        req={selectedReq}
        onDecision={async (id, status, comment) => {
          await onDecision(id, status, comment);
          setSelectedReq(null);
        }}
        onBack={() => setSelectedReq(null)}
      />
    );
  }

  return (
    <div className="mt-3 space-y-3 w-full">
      {payload.map((req: LeaveRequest) => {
        const days = leaveDayCount(req.start_date, req.end_date);
        const isDecliningThis = activeDeclineId === req.id;
        const currentComment = quickComments[req.id] ?? "";

        return (
          <div
            key={req.id}
            className="rounded-2xl border border-amber-500/30 bg-background/95 p-3.5 text-xs space-y-3 shadow-md hover:border-amber-500/60 transition-all"
          >
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-2.5">
                <InitialsAvatar
                  name={req.profiles?.full_name ?? "?"}
                  className="size-8 text-xs font-bold border border-amber-500/20"
                />
                <div>
                  <p className="font-bold text-foreground text-xs">{req.profiles?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(req.profiles as any)?.designation ?? "Employee"} · {req.profiles?.department ?? "General"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold uppercase border border-amber-500/30 shadow-2xs">
                {LEAVE_TYPE_LABEL[req.leave_type]}
              </span>
            </div>

            <div className="rounded-xl bg-muted/60 p-2.5 text-muted-foreground text-[11px] space-y-1">
              <div className="flex justify-between items-center text-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <CalendarCheck className="size-3.5 text-primary" /> {req.start_date} → {req.end_date}
                </span>
                <span className="text-[10px] bg-background px-2 py-0.5 rounded-full border border-border/60">
                  {days} working day(s)
                </span>
              </div>
              {req.remarks && <p className="italic text-foreground/90 text-xs pt-1 border-t border-border/40">“{req.remarks}”</p>}
            </div>

            {/* Quick Decline Reason Input Box */}
            {isDecliningThis && (
              <div className="space-y-2 pt-1.5 border-t border-destructive/30 animate-in fade-in duration-150">
                <label className="text-[11px] font-semibold text-destructive flex items-center justify-between">
                  <span>Rejection Reason (Optional)</span>
                  <span className="text-[10px] opacity-75 font-normal">Mention comment for employee</span>
                </label>
                <Input
                  placeholder="Reason for declining request (optional)..."
                  value={currentComment}
                  onChange={(e) =>
                    setQuickComments((prev) => ({ ...prev, [req.id]: e.target.value }))
                  }
                  className="h-8 rounded-xl bg-background border-destructive/40 text-xs px-2.5 focus-visible:ring-1 focus-visible:ring-destructive/40"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl h-7.5 text-[11px] font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                    onClick={() => {
                      onDecision(req.id, "rejected", currentComment);
                      setActiveDeclineId(null);
                    }}
                  >
                    <X className="size-3.5 mr-1" /> Confirm Decline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl h-7.5 text-[11px] cursor-pointer"
                    onClick={() => setActiveDeclineId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!isDecliningThis && (
              <div className="flex gap-2 pt-0.5">
                <Button
                  size="sm"
                  onClick={() => setSelectedReq(req)}
                  className="flex-1 rounded-xl h-8 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-sm transition-all cursor-pointer"
                >
                  <Search className="size-3.5 mr-1" /> Review & Inspect Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl size-8 p-0 text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30 cursor-pointer"
                  onClick={() => onDecision(req.id, "approved")}
                  title="Quick Approve"
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl size-8 p-0 text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
                  onClick={() => setActiveDeclineId(req.id)}
                  title="Decline with Reason Comment"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LeaveBalanceCard({ payload }: { payload: any }) {
  const categories: {
    key: LeaveType;
    label: string;
    icon: string;
    total: number;
    barGradient: string;
    badgeBg: string;
  }[] = [
    {
      key: "paid",
      label: "Paid Leave",
      icon: "🌴",
      total: LEAVE_ALLOWANCE.paid,
      barGradient: "from-emerald-500 to-teal-400",
      badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
    {
      key: "sick",
      label: "Sick Leave",
      icon: "🤒",
      total: LEAVE_ALLOWANCE.sick,
      barGradient: "from-blue-500 to-indigo-400",
      badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    {
      key: "unpaid",
      label: "Unpaid Leave (LWP)",
      icon: "⚠️",
      total: LEAVE_ALLOWANCE.unpaid,
      barGradient: "from-amber-500 to-orange-400",
      badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
  ];

  return (
    <div className="mt-3 space-y-3 rounded-3xl bg-card/95 p-4 border border-border/80 text-card-foreground shadow-lg backdrop-blur-md transition-all">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
            <Palmtree className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Annual Leave Allowance</h4>
            <p className="text-[10px] text-muted-foreground">Year {new Date().getFullYear()} Balance Overview</p>
          </div>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground border border-border/60">
          3 Categories
        </span>
      </div>

      <div className="space-y-2.5 pt-0.5">
        {categories.map((cat) => {
          const remaining = payload[cat.key] ?? 0;
          const used = payload[`${cat.key}Used`] ?? Math.max(cat.total - remaining, 0);
          const remainingPct = Math.min(Math.max((remaining / cat.total) * 100, 0), 100);

          return (
            <div
              key={cat.key}
              className="rounded-2xl bg-background/80 p-3 border border-border/60 space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm shrink-0">{cat.icon}</span>
                  <span className="text-xs font-bold text-foreground truncate">{cat.label}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-extrabold border shadow-2xs shrink-0",
                    cat.badgeBg
                  )}
                >
                  {remaining} / {cat.total} days remaining
                </span>
              </div>

              {/* Progress Bar showing remaining balance */}
              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80 p-0.5">
                  <div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                      remaining > 0 ? cat.barGradient : "bg-muted-foreground/30"
                    )}
                    style={{ width: `${remainingPct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium px-0.5">
                  <span>Used: {used} day(s)</span>
                  <span>Available: {remaining} day(s)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AiAssistantWidget({
  embedded = false,
  defaultOpen = false,
}: {
  embedded?: boolean;
  defaultOpen?: boolean;
}) {
  const { data: me } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const isAdmin = !!me?.isAdmin;

  // ---------------- Data Queries ----------------
  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance", "today", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me!.id)
        .eq("date", todayKey)
        .maybeSingle();
      return data as AttendanceRow | null;
    },
  });

  const { data: myLeaves } = useQuery({
    queryKey: ["leave", "mine", "all"],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const { data: mySalary } = useQuery({
    queryKey: ["salary", "mine", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", me!.id)
        .maybeSingle();
      return data as SalaryStructure | null;
    },
  });

  // HR Admin Queries
  const { data: allProfiles } = useQuery({
    queryKey: ["profiles", "all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return (data ?? []) as Profile[];
    },
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["leave", "pending"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, profiles(full_name, employee_id, department)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as LeaveRequest[];
    },
  });

  const { data: todayTeamAttendance } = useQuery({
    queryKey: ["attendance", "team-today"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", todayKey);
      return (data ?? []) as AttendanceRow[];
    },
  });

  const { data: allSalaries } = useQuery({
    queryKey: ["salary", "admin-all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("salary_structures").select("*");
      return (data ?? []) as SalaryStructure[];
    },
  });

  // ---------------- Initial Welcome Message ----------------
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (me && messages.length === 0) {
      const firstName = me.profile?.full_name?.split(" ")[0] ?? "there";

      if (isAdmin) {
        setMessages([
          {
            id: "welcome_admin",
            sender: "bot",
            text: `Welcome back, HR Director **${firstName}**! 🛡️\n\nI am **Nova HR Command**, your AI operational agent. Here are your quick actions for today:`,
            timestamp: format(new Date(), "HH:mm"),
            type: "text",
          },
        ]);
      } else {
        setMessages([
          {
            id: "welcome_employee",
            sender: "bot",
            text: `Hello **${firstName}**! 👋\n\nI am **Nova**, your Personal Dayflow AI Assistant. I can help you check in, manage leaves, track working hours, and view your salary breakdown!`,
            timestamp: format(new Date(), "HH:mm"),
            type: "text",
          },
        ]);
      }
    }
  }, [me, isAdmin, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleClearChat = () => {
    const firstName = me?.profile?.full_name?.split(" ")[0] ?? "there";
    setMessages([
      {
        id: Date.now().toString(),
        sender: "bot",
        text: isAdmin
          ? `Welcome back, HR Director **${firstName}**! 🛡️\n\nChat history cleared. How can I assist you with HR operations today?`
          : `Hello **${firstName}**! 👋\n\nChat history cleared. How can I help you track attendance or leaves today?`,
        timestamp: format(new Date(), "HH:mm"),
        type: "text",
      },
    ]);
    toast.success("Chat history cleared");
  };

  const deleteSingleMessage = (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    toast.success("Message removed");
  };

  // Speech Recognition Setup
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSend(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast.error("Could not recognize speech. Please try typing.");
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info("Listening... speak your request.");
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const speakText = (text: string) => {
    if (!speechEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = text.replace(/[*_#`]/g, "");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = isAdmin ? 0.95 : 1.0;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---------------- AI Processing Core Engine ----------------
  const processQuery = async (queryText: string) => {
    const q = queryText.toLowerCase().trim();

    // Check-in
    if (q.includes("check in") || q.includes("clock in") || q.includes("mark present")) {
      if (todayAttendance?.check_in && !todayAttendance?.check_out) {
        return {
          text: `You are already checked in today at **${formatTime(todayAttendance.check_in)}**! Need to clock out?`,
          type: "text" as const,
        };
      }
      try {
        const now = new Date().toISOString();
        if (todayAttendance) {
          await supabase
            .from("attendance")
            .update({ check_in: now, status: "present" })
            .eq("id", todayAttendance.id);
        } else {
          await supabase.from("attendance").insert({
            id: `att_${me!.id}_${todayKey}`,
            user_id: me!.id,
            date: todayKey,
            status: "present",
            check_in: now,
            check_out: null,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["attendance"] });
        return {
          text: `🎉 **Check-In Confirmed!** You clocked in at **${format(new Date(), "hh:mm a")}** today (${format(new Date(), "dd MMM yyyy")}).`,
          type: "action_success" as const,
        };
      } catch (err: any) {
        return { text: `Failed to check in: ${err.message}`, type: "text" as const };
      }
    }

    // Check-out
    if (q.includes("check out") || q.includes("clock out")) {
      if (!todayAttendance?.check_in) {
        return {
          text: `You haven't checked in yet today! Click below or ask me to check you in first.`,
          type: "text" as const,
        };
      }
      if (todayAttendance.check_out) {
        return {
          text: `You already checked out today at **${formatTime(todayAttendance.check_out)}**!`,
          type: "text" as const,
        };
      }
      try {
        const now = new Date().toISOString();
        await supabase
          .from("attendance")
          .update({ check_out: now })
          .eq("id", todayAttendance.id);

        await queryClient.invalidateQueries({ queryKey: ["attendance"] });
        const hrs = workHours(todayAttendance.check_in, now) ?? 0;

        return {
          text: `✅ **Checked Out!** Recorded at **${format(new Date(), "hh:mm a")}**.\nLogged duration today: **${hrs} hours**. Great work!`,
          type: "action_success" as const,
        };
      } catch (err: any) {
        return { text: `Failed to check out: ${err.message}`, type: "text" as const };
      }
    }

    // ---------------- HR ADMIN SPECIFIC ----------------
    if (isAdmin) {
      // Leave Approval & Pending Requests
      if (
        q.includes("approve") ||
        q.includes("accept leave") ||
        q.includes("grant leave") ||
        q.includes("pending") ||
        q.includes("approval") ||
        q.includes("leave requests")
      ) {
        const queue = pendingLeaves ?? [];
        if (queue.length === 0) {
          return {
            text: `🎉 **All caught up!** There are currently 0 pending leave requests awaiting approval.`,
            type: "text" as const,
          };
        }

        // Explicit Batch approval command: e.g. "approve all" or "batch approve"
        if (
          (q.includes("approve all") || q.includes("approve everyone") || q.includes("batch approve")) &&
          !q.includes("show") &&
          !q.includes("view")
        ) {
          let approvedCount = 0;
          for (const req of queue) {
            await processLeaveDecision({
              leave: req,
              status: "approved",
              reviewer_comment: "Approved via Nova HR AI batch command",
              reviewer_id: me!.id,
            });
            approvedCount++;
          }
          await queryClient.invalidateQueries({ queryKey: ["leave"] });
          await queryClient.invalidateQueries({ queryKey: ["attendance"] });
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          await queryClient.invalidateQueries({ queryKey: ["payroll"] });

          return {
            text: `🎉 **Approved All Leaves!** Successfully approved ${approvedCount} pending leave request(s). Employee notifications & payroll updates dispatched.`,
            type: "action_success" as const,
          };
        }

        // Explicit Employee-specific approval command: e.g. "approve rahul leave" or "approve leave for John"
        if (q.startsWith("approve") || q.startsWith("accept") || q.startsWith("grant")) {
          const empMatch = queue.find((req) => {
            const name = req.profiles?.full_name?.toLowerCase() ?? "";
            const first = name.split(" ")[0];
            return first && q.includes(first);
          });

          if (empMatch) {
            await processLeaveDecision({
              leave: empMatch,
              status: "approved",
              reviewer_comment: "Approved via Nova HR AI command",
              reviewer_id: me!.id,
            });
            await queryClient.invalidateQueries({ queryKey: ["leave"] });
            await queryClient.invalidateQueries({ queryKey: ["attendance"] });
            await queryClient.invalidateQueries({ queryKey: ["notifications"] });
            await queryClient.invalidateQueries({ queryKey: ["payroll"] });

            return {
              text: `✅ **Leave Approved!** Request for **${empMatch.profiles?.full_name}** (${empMatch.start_date} to ${empMatch.end_date}) has been approved. Attendance & payroll records updated.`,
              type: "action_success" as const,
            };
          }
        }

        // Standard response: Display interactive pending queue cards
        return {
          text: `📋 **Pending Leave Queue (${queue.length} requests)**: Click **Approve** on any card below or type *"approve all"* to clear the entire queue:`,
          type: "pending_approvals" as const,
          payload: queue,
        };
      }

      // Who is absent today
      if (q.includes("absent today") || q.includes("missing check-in") || q.includes("who missed")) {
        const checkedInIds = new Set((todayTeamAttendance ?? []).map((a) => a.user_id));
        const absent = (allProfiles ?? []).filter((p) => !checkedInIds.has(p.id));

        if (absent.length === 0) {
          return {
            text: `🌟 **100% Attendance Today!** All active employees have checked in or have registered records.`,
            type: "text" as const,
          };
        }

        let msg = `⚠️ **Employees Missing Check-In Today (${absent.length} people)**:\n`;
        absent.forEach((p) => {
          msg += `• **${p.full_name}** (${p.department ?? "General"}) — Employee ID: ${p.employee_id}\n`;
        });
        return { text: msg, type: "text" as const };
      }

      // Team status today
      if (q.includes("team status") || q.includes("who is on leave") || q.includes("attendance today")) {
        const onLeave = (todayTeamAttendance ?? []).filter((a) => a.status === "leave");
        const presentCount = (todayTeamAttendance ?? []).filter((a) => a.status === "present" || a.status === "half_day").length;
        const totalCount = (allProfiles ?? []).length;

        let msg = `📊 **HR Management Attendance Overview (${format(new Date(), "dd MMM yyyy")})**:\n• Total Workforce: **${totalCount} employees**\n• Checked In: **${presentCount}**\n• On Leave: **${onLeave.length}**`;

        if (onLeave.length > 0) {
          msg += `\n\nEmployees Currently On Approved Leave:\n`;
          onLeave.forEach((row) => {
            const emp = (allProfiles ?? []).find((p) => p.id === row.user_id);
            msg += `• **${emp?.full_name ?? "Employee"}** (${emp?.department ?? "Team"})\n`;
          });
        }
        return { text: msg, type: "text" as const };
      }

      // Department Count Breakdown
      if (q.includes("department") || q.includes("headcount") || q.includes("team size")) {
        const map = new Map<string, number>();
        (allProfiles ?? []).forEach((p) => {
          const dept = p.department ?? "General";
          map.set(dept, (map.get(dept) ?? 0) + 1);
        });

        let msg = `🏢 **Workforce Distribution by Department**:\n`;
        map.forEach((count, dept) => {
          msg += `• **${dept}**: ${count} employee(s)\n`;
        });
        return { text: msg, type: "text" as const };
      }

      // Company Payroll Overview
      if (q.includes("payroll") || q.includes("company salary") || q.includes("total payout")) {
        const totalOutflow = (allSalaries ?? []).reduce((sum, s) => sum + netPay(s), 0);
        return {
          text: `💸 **HR Payroll Control Summary**:\n• Active Salary Profiles: **${(allSalaries ?? []).length}**\n• Total Monthly Payout: **${formatINR(totalOutflow)}**`,
          type: "payroll_summary" as const,
          payload: { totalOutflow, count: (allSalaries ?? []).length },
        };
      }

      // Employee Lookup
      if (q.includes("employee") || q.includes("who is") || q.includes("find") || q.includes("profile")) {
        const term = q.replace(/(employee|who is|search profile|find|details|profile|of)/gi, "").trim();
        if (term && allProfiles) {
          const matched = allProfiles.filter(
            (p) =>
              p.full_name.toLowerCase().includes(term) ||
              p.employee_id.toLowerCase().includes(term) ||
              (p.department && p.department.toLowerCase().includes(term))
          );

          if (matched.length > 0 && matched[0]) {
            const emp = matched[0];
            const empSal = (allSalaries ?? []).find((s) => s.user_id === emp.id);

            return {
              text: `Here is the full profile record for **${emp.full_name}**:`,
              type: "employee_info" as const,
              payload: { ...emp, salary: empSal },
            };
          }
        }
      }
    }

    // ---------------- EMPLOYEE SPECIFIC ----------------
    // Personal Attendance & Hours
    if (q.includes("my status") || q.includes("hours") || q.includes("logged") || q.includes("my attendance")) {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
      const { data: weekRows } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", me!.id)
        .gte("date", weekStart);

      const totalHrs = ((weekRows ?? []) as AttendanceRow[]).reduce(
        (sum: number, r: AttendanceRow) => sum + (workHours(r.check_in, r.check_out) ?? 0),
        0
      );

      return {
        text: `⏱️ **Your Work Hours & Status**:\n• Status Today: **${todayAttendance?.check_in ? (todayAttendance.check_out ? "Checked Out" : "Checked In & Active") : "Not Checked In"}**\n• Hours Logged This Week: **${Math.round(totalHrs * 10) / 10} hours** (Goal: 40 hrs)`,
        type: "attendance_summary" as const,
        payload: {
          checkIn: todayAttendance?.check_in,
          checkOut: todayAttendance?.check_out,
          status: todayAttendance?.status ?? "not_checked_in",
          hrs: totalHrs,
        },
      };
    }

    // Personal Leave Balance
    if (q.includes("leave balance") || q.includes("how many leaves") || q.includes("my leaves") || q.includes("vacation")) {
      const yearStart = format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");
      const approved = (myLeaves ?? []).filter(
        (l) => l.status === "approved" && l.start_date >= yearStart
      );
      const paidUsed = approved
        .filter((l) => l.leave_type === "paid")
        .reduce((s, l) => s + leaveDayCount(l.start_date, l.end_date), 0);
      const sickUsed = approved
        .filter((l) => l.leave_type === "sick")
        .reduce((s, l) => s + leaveDayCount(l.start_date, l.end_date), 0);
      const unpaidUsed = approved
        .filter((l) => l.leave_type === "unpaid")
        .reduce((s, l) => s + leaveDayCount(l.start_date, l.end_date), 0);

      const balances = {
        paid: Math.max(LEAVE_ALLOWANCE.paid - paidUsed, 0),
        sick: Math.max(LEAVE_ALLOWANCE.sick - sickUsed, 0),
        unpaid: Math.max(LEAVE_ALLOWANCE.unpaid - unpaidUsed, 0),
        paidUsed,
        sickUsed,
        unpaidUsed,
      };

      return {
        text: `🌴 **Your Annual Leave Allowance (${new Date().getFullYear()})**:`,
        type: "leave_balance" as const,
        payload: balances,
      };
    }

    // Leave Application Form
    if (q.includes("apply") || q.includes("request leave") || q.includes("take leave") || q.includes("time off")) {
      let type: LeaveType = "paid";
      if (q.includes("sick")) type = "sick";
      if (q.includes("unpaid")) type = "unpaid";

      let startDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
      let endDate = startDate;

      if (q.includes("today")) {
        startDate = todayKey;
        endDate = todayKey;
      }

      return {
        text: `I've prepared your leave application. Review the dates and submit to your HR Manager:`,
        type: "leave_form" as const,
        payload: {
          leave_type: type,
          start_date: startDate,
          end_date: endDate,
          remarks: "Requested via Nova AI Assistant",
        },
      };
    }

    // Personal Salary
    if (q.includes("my salary") || q.includes("my pay") || q.includes("payslip")) {
      if (!mySalary) {
        return {
          text: `Your salary structure has not been configured yet. Please reach out to HR People Ops.`,
          type: "text" as const,
        };
      }

      const approvedUnpaid = (myLeaves ?? [])
        .filter((l) => l.status === "approved" && l.leave_type === "unpaid")
        .reduce((sum, l) => sum + leaveDayCount(l.start_date, l.end_date), 0);

      const lwpDeduction = calculateUnpaidDeduction(mySalary, approvedUnpaid);
      const net = netPayWithLeaves(mySalary, approvedUnpaid);

      let txt = `💰 **Your Monthly Salary Slip**:\n• Basic Pay: **${formatINR(mySalary.basic)}**\n• House Rent Allowance (HRA): **${formatINR(mySalary.hra)}**\n• Special Allowances: **${formatINR(mySalary.allowances)}**\n• Statutory Deductions: **-${formatINR(mySalary.deductions)}**`;
      if (approvedUnpaid > 0) {
        txt += `\n• **Unpaid Leave Deduction (${approvedUnpaid} LWP days): -${formatINR(lwpDeduction)}**`;
      }
      txt += `\n───────────────────\n• **Monthly Net Take-Home: ${formatINR(net)}**`;

      return {
        text: txt,
        type: "text" as const,
      };
    }

    // Policy Q&A
    if (q.includes("policy") || q.includes("timing") || q.includes("rule") || q.includes("holiday")) {
      return {
        text: `📖 **Dayflow HR Quick Guide**:\n\n• **Standard Shift**: 9:00 AM – 6:00 PM (Monday to Friday)\n• **Annual Leave Allowance**: 12 Paid Leaves, 6 Sick Leaves, 30 Unpaid Leaves\n• **Attendance Rule**: Mark check-in within 15 mins of arrival. Under 4 hours is logged as half-day.\n• **Salary Disbursement**: Credited on the last working day of every calendar month.`,
        type: "text" as const,
      };
    }

    // Security Notice for non-admin
    if (!isAdmin && (q.includes("approve") || q.includes("all employees") || q.includes("company payroll"))) {
      return {
        text: `🔒 **Security Notice**: Administrative functions like reviewing company-wide payroll or approving leave requests require HR Manager credentials.`,
        type: "text" as const,
      };
    }

    // Fallback
    return {
      text: isAdmin
        ? `I am ready for HR Command! Ask me to:\n1. **Show pending leave approvals**\n2. **Audit today's team attendance & absent list**\n3. **Lookup employee profile & salary details**\n4. **View company payroll summary**`
        : `I am your Personal Dayflow Assistant! Ask me to:\n1. **Check in or check out** for today\n2. **Check your leave balance**\n3. **Apply for time off / leave**\n4. **View your logged work hours & salary breakdown**`,
      type: "text" as const,
    };
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: format(new Date(), "HH:mm"),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    setTimeout(async () => {
      const response = await processQuery(textToSend);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: response.text,
        timestamp: format(new Date(), "HH:mm"),
        type: response.type,
        payload: response.payload,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsThinking(false);

      if (speechEnabled) {
        speakText(response.text);
      }
    }, 400);
  };

  const submitLeaveRequest = async (payload: any) => {
    try {
      const days = leaveDayCount(payload.start_date, payload.end_date);
      await createLeaveRequestAndNotify({
        userId: me!.id,
        leaveType: payload.leave_type,
        startDate: payload.start_date,
        endDate: payload.end_date,
        remarks: payload.remarks,
      });

      await queryClient.invalidateQueries({ queryKey: ["leave"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

      toast.success("🎉 Leave Request Submitted! HR & Admins have been notified.");

      const botMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "bot",
        text: `🎉 **Request Sent to HR!** Your ${LEAVE_TYPE_LABEL[payload.leave_type as LeaveType]} (${payload.start_date} to ${payload.end_date}, ${days} day(s)) has been submitted. Check notifications for status updates!`,
        timestamp: format(new Date(), "HH:mm"),
        type: "action_success",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleDecision = async (
    leaveId: string,
    status: "approved" | "rejected",
    comment?: string
  ) => {
    try {
      const target = (pendingLeaves ?? []).find((l) => l.id === leaveId);
      const revComment =
        comment && comment.trim() !== ""
          ? comment.trim()
          : status === "approved"
            ? "Approved by HR Director via Nova AI"
            : "Declined by HR Director via Nova AI";

      if (target) {
        await processLeaveDecision({
          leave: target,
          status,
          reviewer_comment: revComment,
          reviewer_id: me!.id,
        });
      } else {
        await supabase
          .from("leave_requests")
          .update({
            status,
            reviewer_comment: revComment,
            reviewed_by: me!.id,
          })
          .eq("id", leaveId);
      }

      await queryClient.invalidateQueries({ queryKey: ["leave"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll"] });

      const empName = target?.profiles?.full_name ?? "Employee";
      const leaveType = target ? LEAVE_TYPE_LABEL[target.leave_type] : "Leave";

      if (status === "approved") {
        toast.success(`Leave Approved: ${empName}`, {
          description: `${leaveType} approved. Note: "${revComment}"`,
          icon: "✅",
          duration: 5000,
        });
      } else {
        toast.error(`Leave Request Declined: ${empName}`, {
          description: `${leaveType} declined. Reason: "${revComment}"`,
          icon: "❌",
          duration: 5000,
        });
      }

      const botMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: "bot",
        text:
          status === "approved"
            ? `✅ Leave request for **${empName}** (${leaveType}) has been **APPROVED**.\n💬 **HR Note**: "${revComment}"\nAttendance and payroll records updated.`
            : `❌ Leave request for **${empName}** (${leaveType}) has been **DECLINED**.\n💬 **HR Rejection Comment**: "${revComment}"`,
        timestamp: format(new Date(), "HH:mm"),
        type: "action_success",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (embedded) {
    return (
      <div className="flex h-[560px] w-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-background shadow-2xl backdrop-blur-2xl">
        {renderChatHeader()}
        {renderChatBody()}
        {renderChatFooter()}
      </div>
    );
  }

  return (
    <>
      {/* Premium Floating Launch Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full p-1.5 pr-4.5 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group backdrop-blur-xl border",
            isAdmin
              ? "border-amber-500/40 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-amber-100 shadow-amber-950/40 hover:border-amber-400"
              : "border-primary/40 bg-gradient-to-r from-primary/95 via-primary to-accent/90 text-primary-foreground shadow-primary/30 hover:border-primary-foreground/40"
          )}
          title={isAdmin ? "Launch Nova HR Command (Ctrl+K)" : "Ask Nova AI Assistant (Ctrl+K)"}
        >
          <div
            className={cn(
              "relative flex size-10 items-center justify-center rounded-full shadow-inner transition-transform group-hover:rotate-12",
              isAdmin
                ? "bg-gradient-to-tr from-amber-500 to-amber-300 text-amber-950"
                : "bg-gradient-to-tr from-white/30 to-white/10 text-primary-foreground"
            )}
          >
            {isAdmin ? (
              <ShieldCheck className="size-5 text-amber-950" />
            ) : (
              <Sparkles className="size-5 text-white animate-pulse" />
            )}
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-background animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-background" />
          </div>
          <div className="text-left">
            <p className="font-display text-sm font-semibold tracking-tight leading-none">
              {isAdmin ? "HR Command AI" : "Ask Nova AI"}
            </p>
            <p className="mt-1 text-[10px] opacity-75 font-mono">
              Press Ctrl+K
            </p>
          </div>
        </button>
      )}

      {/* Floating Drawer Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-3xl border border-amber-500/30 bg-card text-foreground shadow-2xl transition-all duration-300 backdrop-blur-2xl animate-in fade-in zoom-in-95 ring-1 ring-amber-500/20",
            isExpanded
              ? "h-[92vh] w-[92vw] max-w-4xl"
              : "h-[640px] w-[92vw] max-w-md sm:w-[430px]"
          )}
        >
          {renderChatHeader()}
          {renderChatBody()}
          {renderChatFooter()}
        </div>
      )}
    </>
  );

  function renderChatHeader() {
    return (
      <div className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-amber-50 px-4 py-3 backdrop-blur-xl transition-all shadow-xs shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar Icon */}
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-amber-950 ring-2 ring-amber-400/40 shadow-md shadow-amber-950/40 transition-all">
            {isAdmin ? <Shield className="size-5" /> : <Bot className="size-5" />}
            <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center">
              <span className="absolute size-full rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </span>
          </div>

          {/* Titles & Mode Badge */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-sm font-bold tracking-tight text-amber-50 whitespace-nowrap flex items-center gap-1.5">
                {isAdmin ? "Nova HR Command" : "Nova Employee Assistant"}
                <Sparkles className="size-3.5 text-amber-400 fill-amber-400/30 animate-pulse shrink-0" />
              </h3>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase shrink-0 shadow-2xs border bg-amber-400/20 text-amber-300 border-amber-400/40">
                {isAdmin ? "HR Director" : "Employee Mode"}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80 font-medium truncate flex items-center gap-1.5 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {isAdmin ? "Operations & Payroll Intelligence" : "Attendance & Leave Agent"}
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl opacity-80 hover:opacity-100 text-amber-200 hover:text-red-300 hover:bg-amber-800/50 transition-all cursor-pointer"
            onClick={handleClearChat}
            title="Clear Chat History"
          >
            <RotateCcw className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl opacity-80 hover:opacity-100 text-amber-200 hover:text-amber-50 hover:bg-amber-800/50 transition-all cursor-pointer"
            onClick={() => setSpeechEnabled(!speechEnabled)}
            title={speechEnabled ? "Mute Voice Response" : "Enable Voice Response"}
          >
            {speechEnabled ? <Volume2 className="size-4 text-emerald-400" /> : <VolumeX className="size-4" />}
          </Button>

          {!embedded && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl opacity-80 hover:opacity-100 text-amber-200 hover:text-amber-50 hover:bg-amber-800/50 transition-all cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Minimize Window" : "Expand Window"}
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl opacity-80 hover:opacity-100 text-amber-200 hover:text-red-300 hover:bg-amber-800/50 transition-all cursor-pointer"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
              >
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderChatBody() {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto no-scrollbar p-4 scroll-smooth">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "group/msg flex flex-col max-w-[88%] gap-1 animate-in fade-in duration-300 relative",
              m.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className="flex items-center gap-1.5 w-full">
              {m.sender === "user" && (
                <button
                  type="button"
                  onClick={() => deleteSingleMessage(m.id)}
                  title="Delete message"
                  className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/20 hover:text-destructive text-muted-foreground shrink-0 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}

              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition-all flex-1",
                  m.sender === "user"
                    ? isAdmin
                      ? "bg-gradient-to-r from-amber-600 to-amber-700 text-amber-50 rounded-br-xs shadow-amber-950/20"
                      : "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-br-xs shadow-primary/20"
                    : "bg-card/90 text-card-foreground border border-border/80 rounded-bl-xs backdrop-blur-md"
                )}
              >
                <FormattedText text={m.text} />

                {/* Action Success Card */}
                {m.type === "action_success" && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    <span>Action executed successfully!</span>
                  </div>
                )}

                {/* Leave Form Payload */}
                {m.type === "leave_form" && m.payload && (
                  <InteractiveLeaveForm
                    initialPayload={m.payload}
                    onSubmit={(data) => submitLeaveRequest(data)}
                  />
                )}

                {/* Leave Balance Payload */}
                {m.type === "leave_balance" && m.payload && (
                  <LeaveBalanceCard payload={m.payload} />
                )}

                {/* Attendance Summary Payload */}
                {m.type === "attendance_summary" && m.payload && (
                  <div className="mt-3 rounded-2xl bg-background/90 p-3.5 border border-border/80 text-foreground space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Today Status</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                          m.payload.status === "present"
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {m.payload.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-muted/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Check In</span>
                        <span className="font-bold text-foreground">{m.payload.check_in ?? "—"}</span>
                      </div>
                      <div className="rounded-xl bg-muted/60 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Check Out</span>
                        <span className="font-bold text-foreground">{m.payload.check_out ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* HR Pending Leaves Payload */}
                {(m.type === "pending_approvals" || m.type === "hr_pending_leaves") && m.payload && (
                  <PendingLeavesView
                    payload={m.payload}
                    onDecision={handleDecision}
                  />
                )}

                {/* Employee Info Payload */}
                {m.type === "employee_info" && m.payload && (
                  <div className="mt-3 rounded-2xl bg-background/90 p-3.5 border border-border/80 text-foreground space-y-2 shadow-sm">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={m.payload.full_name} className="size-10 text-sm" />
                      <div>
                        <p className="font-bold text-sm text-foreground">{m.payload.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.payload.designation} · {m.payload.department}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <span className="text-muted-foreground text-[10px]">Employee ID</span>
                        <p className="font-semibold">{m.payload.employee_id}</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <span className="text-muted-foreground text-[10px]">Email</span>
                        <p className="font-semibold truncate">{m.payload.email ?? "N/A"}</p>
                      </div>
                    </div>
                    {m.payload.salary && (
                      <div className="rounded-xl bg-accent/30 p-2.5 text-xs flex justify-between items-center font-medium">
                        <span>Monthly Net Pay</span>
                        <span className="font-bold text-foreground">{formatINR(netPay(m.payload.salary))}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Payroll Summary Payload */}
                {m.type === "payroll_summary" && m.payload && (
                  <div className="mt-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-background p-4 border border-amber-500/30 text-amber-100 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-amber-200">Total Monthly Outflow</span>
                      <span className="font-display text-xl font-bold text-amber-400">{formatINR(m.payload.totalOutflow)}</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80">Across {m.payload.count} configured employee salary profiles</p>
                  </div>
                )}
              </div>

              {m.sender === "bot" && (
                <button
                  type="button"
                  onClick={() => deleteSingleMessage(m.id)}
                  title="Delete message"
                  className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/20 hover:text-destructive text-muted-foreground shrink-0 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground px-1">{m.timestamp}</span>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs p-3 rounded-2xl bg-card/60 border border-border/50 w-fit">
            <div className="flex items-center gap-1">
              <span className={cn("size-2 rounded-full animate-bounce", isAdmin ? "bg-amber-500" : "bg-primary")} style={{ animationDelay: "0ms" }} />
              <span className={cn("size-2 rounded-full animate-bounce", isAdmin ? "bg-amber-500" : "bg-primary")} style={{ animationDelay: "150ms" }} />
              <span className={cn("size-2 rounded-full animate-bounce", isAdmin ? "bg-amber-500" : "bg-primary")} style={{ animationDelay: "300ms" }} />
            </div>
            <span className="font-medium text-xs">{isAdmin ? "Nova HR Command is evaluating..." : "Nova is formulating a response..."}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    );
  }

  function renderChatFooter() {
    const activePrompts = isAdmin ? HR_ADMIN_PROMPTS : EMPLOYEE_PROMPTS;

    return (
      <div className="border-t border-border/80 bg-card/95 p-3.5 space-y-3 backdrop-blur-xl">
        {/* Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {activePrompts.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSend(p.prompt)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-xs",
                isAdmin
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25"
                  : "border-border/80 bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input & Voice Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            className={cn(
              "size-10 rounded-2xl shrink-0 transition-all",
              isListening && "animate-pulse ring-4 ring-destructive/30"
            )}
            onClick={toggleListening}
            title={isListening ? "Stop voice listening" : "Voice input command"}
          >
            {isListening ? <MicOff className="size-4 animate-spin" /> : <Mic className="size-4 text-muted-foreground" />}
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              isAdmin
                ? "Ask pending approvals, team attendance, absent list..."
                : "Type check-in, leave balance, request leave..."
            }
            className="rounded-2xl bg-background/90 text-xs sm:text-sm focus-visible:ring-primary h-10 shadow-inner"
          />

          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={cn(
              "size-10 rounded-2xl shrink-0 text-primary-foreground shadow-md transition-transform active:scale-95",
              isAdmin
                ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
                : "bg-gradient-to-r from-primary to-accent hover:opacity-90"
            )}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    );
  }
}
