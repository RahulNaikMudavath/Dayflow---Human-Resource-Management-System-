import { format, addDays } from "date-fns";
import { supabase } from "@server/integrations/supabase/client";

export type AppRole = "admin" | "employee";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type LeaveType = "paid" | "sick" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  employee_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  designation: string | null;
  date_of_joining: string | null;
  avatar_url: string | null;
}

export interface AttendanceRow {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  remarks: string | null;
  status: LeaveStatus;
  reviewer_comment: string | null;
  reviewed_by: string | null;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "employee_id" | "department"> | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "leave_approved" | "leave_rejected" | "general";
  read: boolean;
  created_at: string;
}

export interface SalaryStructure {
  id: string;
  user_id: string;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  effective_from: string;
}

export const LEAVE_ALLOWANCE: Record<LeaveType, number> = {
  paid: 12,
  sick: 6,
  unpaid: 30,
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  paid: "Paid leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
};

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; dot: string; badge: string }
> = {
  present: {
    label: "Present",
    dot: "bg-status-present",
    badge: "bg-status-present/10 text-status-present",
  },
  absent: {
    label: "Absent",
    dot: "bg-status-absent",
    badge: "bg-status-absent/10 text-status-absent",
  },
  half_day: {
    label: "Half day",
    dot: "bg-status-half",
    badge: "bg-status-half/25 text-accent-foreground",
  },
  leave: {
    label: "On leave",
    dot: "bg-status-leave",
    badge: "bg-status-leave/10 text-status-leave",
  },
};

export const LEAVE_STATUS_META: Record<
  LeaveStatus,
  { label: string; badge: string }
> = {
  pending: {
    label: "Pending",
    badge: "bg-status-half/25 text-accent-foreground",
  },
  approved: {
    label: "Approved",
    badge: "bg-status-present/10 text-status-present",
  },
  rejected: {
    label: "Rejected",
    badge: "bg-status-absent/10 text-status-absent",
  },
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const AVATAR_COMBOS = [
  "bg-chart-1 text-primary-foreground",
  "bg-chart-2 text-primary-foreground",
  "bg-chart-4 text-primary-foreground",
  "bg-sidebar text-sidebar-foreground",
  "bg-chart-3 text-accent-foreground",
];

export function avatarTone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COMBOS[h % AVATAR_COMBOS.length];
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function workHours(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return null;
  const hrs = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 36e5;
  return Math.round(hrs * 10) / 10;
}

export function formatHours(hrs: number | null | undefined) {
  if (hrs === null || hrs === undefined || hrs <= 0) return null;
  const totalMinutes = Math.round(hrs * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}min`;
  }
  if (minutes === 0) {
    return hours === 1 ? "1hour" : `${hours}hours`;
  }
  return `${hours}hours ${minutes}min`;
}

export function formatWorkDuration(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return null;
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return "0min";
  const hrs = diffMs / 36e5;
  return formatHours(hrs);
}

export function leaveDayCount(start: string, end: string) {
  let count = 0;
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  let guard = 0;
  while (d <= last && guard < 400) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return count;
}

export function netPay(s: Pick<SalaryStructure, "basic" | "hra" | "allowances" | "deductions">) {
  return s.basic + s.hra + s.allowances - s.deductions;
}

export function calculateUnpaidDeduction(
  s: Pick<SalaryStructure, "basic" | "hra" | "allowances">,
  unpaidDays: number
) {
  if (unpaidDays <= 0) return 0;
  const gross = s.basic + s.hra + s.allowances;
  const dailyRate = gross / 30;
  return Math.round(unpaidDays * dailyRate);
}

export function netPayWithLeaves(
  s: Pick<SalaryStructure, "basic" | "hra" | "allowances" | "deductions">,
  unpaidDays: number = 0
) {
  const gross = s.basic + s.hra + s.allowances;
  const unpaidDeduction = calculateUnpaidDeduction(s, unpaidDays);
  return Math.max(gross - s.deductions - unpaidDeduction, 0);
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@server/integrations/supabase/auth-middleware";

export const processLeaveDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      leave: LeaveRequest;
      status: LeaveStatus;
      reviewer_comment?: string | null;
      reviewer_id: string;
    }) => data
  )
  .handler(async ({ context, data }) => {
    const db = (context as any)?.supabase ?? supabase;
    const { leave, status, reviewer_comment, reviewer_id } = data;

    // 1. Update leave request status
    const { error: leaveErr } = await db
      .from("leave_requests")
      .update({
        status,
        reviewer_comment: reviewer_comment ?? null,
        reviewed_by: reviewer_id,
      })
      .eq("id", leave.id);
    if (leaveErr) throw leaveErr;

    // 2. Fetch employee salary to calculate exact salary deduction if unpaid leave
    const days = leaveDayCount(leave.start_date, leave.end_date);
    let deductionText = "";

    if (status === "approved" && leave.leave_type === "unpaid") {
      const { data: salary } = await db
        .from("salary_structures")
        .select("*")
        .eq("user_id", leave.user_id)
        .maybeSingle();

      if (salary) {
        const deductionAmount = calculateUnpaidDeduction(salary as SalaryStructure, days);
        deductionText = ` Salary Deduction of ${formatINR(deductionAmount)} (${days} day(s) Unpaid Leave) will be reflected in your monthly payroll.`;
      } else {
        deductionText = ` A salary deduction of ${days} day(s) LWP will be reflected in your monthly payroll.`;
      }
    }

    // 3. Dispatch notification to employee
    const startStr = format(new Date(leave.start_date + "T00:00:00"), "dd MMM");
    const endStr = format(new Date(leave.end_date + "T00:00:00"), "dd MMM");
    const leaveLabel = LEAVE_TYPE_LABEL[leave.leave_type] || "Leave";

    const messageText = status === "approved"
      ? `Your ${leaveLabel} request (${startStr} – ${endStr}, ${days} day(s)) has been approved by HR.${deductionText}${reviewer_comment ? ` Note: "${reviewer_comment}"` : ""}`
      : `Your ${leaveLabel} request (${startStr} – ${endStr}) has been declined by HR.${reviewer_comment ? ` Note: "${reviewer_comment}"` : ""}`;

    await (db.from("notifications" as any) as any).insert({
      user_id: leave.user_id,
      title: status === "approved" ? "Leave Request Approved" : "Leave Request Declined",
      message: messageText,
      type: status === "approved" ? "leave_approved" : "leave_rejected",
      read: false,
      created_at: new Date().toISOString(),
    });

    // 4. If approved, sync employee attendance to "leave" status for dates in range
    if (status === "approved") {
      const cur = new Date(leave.start_date + "T00:00:00");
      const last = new Date(leave.end_date + "T00:00:00");
      let guard = 0;
      while (cur <= last && guard < 400) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) {
          const dStr = format(cur, "yyyy-MM-dd");
          await (db.from("attendance" as any) as any).upsert(
            {
              user_id: leave.user_id,
              date: dStr,
              status: "leave",
              check_in: null,
              check_out: null,
            },
            { onConflict: "user_id,date" }
          );
        }
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    }
  });

export async function processLeaveDecision(params: {
  leave: LeaveRequest;
  status: LeaveStatus;
  reviewer_comment?: string | null;
  reviewer_id: string;
}) {
  return processLeaveDecisionFn({ data: params });
}

export const createLeaveRequestAndNotifyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      userId: string;
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      remarks?: string | null;
    }) => data
  )
  .handler(async ({ context, data: params }) => {
    const db = (context as any)?.supabase ?? supabase;
    const { userId, leaveType, startDate, endDate, remarks } = params;

    const days = leaveDayCount(startDate, endDate);
    if (days === 0) {
      throw new Error("That range only covers weekend days.");
    }

    // 1. Insert leave request record
    const { data, error } = await db.from("leave_requests").insert({
      user_id: userId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      remarks: remarks || null,
      status: "pending",
    }).select().single();

    if (error) throw error;

    const leaveLabel = LEAVE_TYPE_LABEL[leaveType] || "Leave";

    // 2. Fetch employee name for notification
    const { data: userProfile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const empName = userProfile?.full_name ?? "An employee";

    // 3. Dispatch confirmation notification to employee
    await (db.from("notifications" as any) as any).insert({
      user_id: userId,
      title: "Leave Request Submitted 🌴",
      message: `Your ${leaveLabel} request (${startDate} to ${endDate}, ${days} day(s)) has been sent to HR for approval.`,
      type: "leave_submitted",
      read: false,
      created_at: new Date().toISOString(),
    });

    // 4. Dispatch notification to ALL HR Admins via secure RPC
    await db.rpc("notify_admins" as any, {
      _title: "New Leave Request Pending Review ⏳",
      _message: `${empName} has submitted a ${leaveLabel} request (${startDate} to ${endDate}, ${days} day(s)). Review and confirm approval.`,
      _type: "leave_request_pending",
    });

    return data;
  });

export async function createLeaveRequestAndNotify(params: {
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  remarks?: string | null;
}) {
  return createLeaveRequestAndNotifyFn({ data: params });
}

export async function checkAndDispatchLeaveReminders(userId: string) {
  if (!userId) return;
  try {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

    const { data: leaves } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (!leaves || leaves.length === 0) return;

    for (const leave of leaves) {
      const isEndingTomorrow = leave.end_date === tomorrowStr;
      const isLastDayToday = leave.end_date === todayStr;

      if (isEndingTomorrow || isLastDayToday) {
        const formattedEnd = format(new Date(leave.end_date + "T00:00:00"), "dd MMM yyyy");
        const msgSnippet = `(${formattedEnd})`;

        // Check if reminder was already created to avoid duplication
        const { data: existing } = await (supabase.from("notifications" as any) as any)
          .select("id")
          .eq("user_id", userId)
          .like("message", `%${msgSnippet}%`)
          .maybeSingle();

        if (!existing) {
          const msg = isEndingTomorrow
            ? `You have only 1 day left of your leave! Your leave completes tomorrow (${formattedEnd}). Please prepare to check in on your next working day.`
            : `Today is the final day of your leave (${formattedEnd}). Please remember to check in for work tomorrow!`;

          await (supabase.from("notifications" as any) as any).insert({
            user_id: userId,
            title: "Leave Ending Soon ⏳",
            message: msg,
            type: "general",
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error("Error dispatching leave reminders:", err);
  }
}

export async function promoteUserToAdmin(userId: string) {
  const { error } = await supabase.rpc("promote_user_to_admin" as any, {
    _target_user_id: userId,
  });
  if (error) {
    throw new Error(error.message || "Failed to promote user to HR Admin.");
  }
}

export async function verifyEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_email_exists" as any, {
    _email: email,
  });
  if (error) {
    console.warn("check_email_exists RPC error:", error);
    return false;
  }
  return Boolean(data);
}

export { supabase };
