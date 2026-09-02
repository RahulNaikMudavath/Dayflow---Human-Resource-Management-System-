import { format, addDays } from "date-fns";
import { supabase } from "@server/integrations/supabase/client";
import {
  sendLeaveApprovedEmail,
  sendLeaveDeclinedEmail,
  sendLeaveSubmittedAdminEmail,
} from "./email-service";

export type AppRole = "admin" | "employee";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type LeaveType = "paid" | "sick" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  department: string | null;
  designation: string | null;
  date_of_joining: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRow {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  notes?: string | null;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string | null;
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

export function isUUID(str?: string | null): boolean {
  return Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}

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

    const isLeaveUUID = isUUID(leave.id);
    const isReviewerUUID = isUUID(reviewer_id);
    const isUserUUID = isUUID(leave.user_id);

    // 1. Update leave request status if valid DB record UUID
    if (isLeaveUUID) {
      const updatePayload: any = {
        status,
        reviewer_comment: reviewer_comment ?? null,
      };
      if (isReviewerUUID) {
        updatePayload.reviewed_by = reviewer_id;
      }
      const { error: leaveErr } = await db
        .from("leave_requests")
        .update(updatePayload)
        .eq("id", leave.id);
      if (leaveErr) {
        console.warn("leave_requests update warning:", leaveErr);
      }
    }

    // 2. Fetch employee salary to calculate exact salary deduction if unpaid leave
    const days = leaveDayCount(leave.start_date, leave.end_date);
    let deductionText = "";

    if (status === "approved" && leave.leave_type === "unpaid" && isUserUUID) {
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

    // 3. Dispatch notification to employee if valid user UUID
    if (isUserUUID) {
      const startStr = format(new Date(leave.start_date + "T00:00:00"), "dd MMM");
      const endStr = format(new Date(leave.end_date + "T00:00:00"), "dd MMM");
      const leaveLabel = LEAVE_TYPE_LABEL[leave.leave_type] || "Leave";

      const messageText = status === "approved"
        ? `Your ${leaveLabel} request (${startStr} – ${endStr}, ${days} day(s)) has been approved by HR.${deductionText}${reviewer_comment ? ` Note: "${reviewer_comment}"` : ""}`
        : `Your ${leaveLabel} request (${startStr} – ${endStr}) has been declined by HR.${reviewer_comment ? ` Note: "${reviewer_comment}"` : ""}`;

      try {
        await (db.from("notifications" as any) as any).insert({
          user_id: leave.user_id,
          title: status === "approved" ? "Leave Request Approved" : "Leave Request Declined",
          message: messageText,
          type: status === "approved" ? "leave_approved" : "leave_rejected",
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Notification insert warning:", e);
      }

      // Dispatch Email Alert to Employee
      try {
        const { data: empProfile } = await db
          .from("profiles")
          .select("full_name, email")
          .eq("id", leave.user_id)
          .maybeSingle();

        const empEmail = empProfile?.email || (leave.profiles?.full_name ? `${leave.profiles.full_name.toLowerCase().replace(/\s+/g, ".")}@dayflow.io` : "employee@dayflow.io");
        const empName = empProfile?.full_name || leave.profiles?.full_name || "Employee";

        if (status === "approved") {
          await sendLeaveApprovedEmail({
            employeeEmail: empEmail,
            employeeName: empName,
            leaveType: leaveLabel,
            startDate: leave.start_date,
            endDate: leave.end_date,
            days,
            deductionText,
            reviewerNote: reviewer_comment ?? null,
          });
        } else {
          await sendLeaveDeclinedEmail({
            employeeEmail: empEmail,
            employeeName: empName,
            leaveType: leaveLabel,
            startDate: leave.start_date,
            endDate: leave.end_date,
            reviewerNote: reviewer_comment ?? null,
          });
        }
      } catch (emailErr) {
        console.warn("Email alert dispatch warning:", emailErr);
      }
    }

    // 4. If approved, sync employee attendance to "leave" status for dates in range
    if (status === "approved" && isUserUUID) {
      const cur = new Date(leave.start_date + "T00:00:00");
      const last = new Date(leave.end_date + "T00:00:00");
      let guard = 0;
      while (cur <= last && guard < 400) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) {
          const dStr = format(cur, "yyyy-MM-dd");
          try {
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
          } catch (e) {
            console.warn("Attendance upsert warning:", e);
          }
        }
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    }

    return { success: true };
  });

export function getLocalPendingLeaves(): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("dayflow_local_pending_leaves");
    if (!raw) return [];
    const list: LeaveRequest[] = JSON.parse(raw);
    const map = new Map<string, LeaveRequest>();
    list.forEach((l) => {
      const key = `${l.user_id}_${l.leave_type}_${l.start_date}_${l.end_date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, l);
      } else {
        if (isUUID(l.id) || l.status !== "pending") {
          map.set(key, l);
        }
      }
    });
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export function saveLocalLeaveRequest(leave: LeaveRequest) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalPendingLeaves();
    const filtered = current.filter(
      (l) =>
        l.id !== leave.id &&
        !(
          l.user_id === leave.user_id &&
          l.leave_type === leave.leave_type &&
          l.start_date === leave.start_date &&
          l.end_date === leave.end_date
        )
    );
    filtered.unshift(leave);
    localStorage.setItem("dayflow_local_pending_leaves", JSON.stringify(filtered));
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function removeLocalLeaveRequest(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalPendingLeaves();
    const filtered = current.filter((l) => l.id !== id);
    localStorage.setItem("dayflow_local_pending_leaves", JSON.stringify(filtered));
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function getReviewedDemoLeaves(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("dayflow_reviewed_demo_leaves");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function updateLocalLeaveStatus(id: string, status: LeaveStatus, reviewer_comment?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalPendingLeaves();
    const target = current.find((l) => l.id === id);
    if (target) {
      target.status = status;
      if (reviewer_comment) target.reviewer_comment = reviewer_comment;
      localStorage.setItem("dayflow_local_pending_leaves", JSON.stringify(current));
    }

    const reviewed = getReviewedDemoLeaves();
    if (!reviewed.includes(id)) {
      reviewed.push(id);
      localStorage.setItem("dayflow_reviewed_demo_leaves", JSON.stringify(reviewed));
    }

    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function getLocalNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("dayflow_local_notifications");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotification(notif: {
  user_id: string;
  title: string;
  message: string;
  type?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalNotifications();
    const newNotif: NotificationItem = {
      id: `local_notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: notif.user_id,
      title: notif.title,
      message: notif.message,
      type: (notif.type || "general") as any,
      read: false,
      created_at: new Date().toISOString(),
    };
    current.unshift(newNotif);
    localStorage.setItem("dayflow_local_notifications", JSON.stringify(current));
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function markLocalNotificationsRead(id?: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalNotifications();
    if (id) {
      const target = current.find((n) => n.id === id);
      if (target) target.read = true;
    } else {
      current.forEach((n) => {
        n.read = true;
      });
    }
    localStorage.setItem("dayflow_local_notifications", JSON.stringify(current));
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function getClearedNotificationIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("dayflow_cleared_notification_ids");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addClearedNotificationIds(ids: string[]) {
  if (typeof window === "undefined" || !ids.length) return;
  try {
    const current = getClearedNotificationIds();
    const set = new Set([...current, ...ids]);
    localStorage.setItem("dayflow_cleared_notification_ids", JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export function clearLocalNotifications(id?: string, userId?: string, currentIds: string[] = []) {
  if (typeof window === "undefined") return;
  try {
    const localNotifs = getLocalNotifications();

    if (id) {
      addClearedNotificationIds([id]);
      const filtered = localNotifs.filter((n) => n.id !== id);
      localStorage.setItem("dayflow_local_notifications", JSON.stringify(filtered));
    } else {
      const idsToClear = currentIds.length > 0 ? currentIds : localNotifs.map((n) => n.id);
      addClearedNotificationIds(idsToClear);
      if (userId) {
        const filtered = localNotifs.filter((n) => n.user_id !== userId && n.user_id !== "all");
        localStorage.setItem("dayflow_local_notifications", JSON.stringify(filtered));
      } else {
        localStorage.removeItem("dayflow_local_notifications");
      }
    }
    window.dispatchEvent(new Event("dayflow-leave-updated"));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export async function processLeaveDecision(params: {
  leave: LeaveRequest;
  status: LeaveStatus;
  reviewer_comment?: string | null;
  reviewer_id: string;
}) {
  updateLocalLeaveStatus(params.leave.id, params.status, params.reviewer_comment);

  const leaveLabel = LEAVE_TYPE_LABEL[params.leave.leave_type] || "Leave";
  const empId = params.leave.user_id;

  // Dispatch notification to employee locally
  saveLocalNotification({
    user_id: empId,
    title: params.status === "approved" ? "Leave Request Approved 🌴" : "Leave Request Declined ❌",
    message: params.status === "approved"
      ? `Your ${leaveLabel} request (${params.leave.start_date} to ${params.leave.end_date}) has been approved by HR.`
      : `Your ${leaveLabel} request (${params.leave.start_date} to ${params.leave.end_date}) was declined by HR.`,
    type: params.status === "approved" ? "leave_approved" : "leave_rejected",
  });

  try {
    return await processLeaveDecisionFn({ data: params });
  } catch (err: any) {
    console.warn("processLeaveDecisionFn server warning, applying fallback:", err);
    if (isUUID(params.leave.id)) {
      const updatePayload: any = {
        status: params.status,
        reviewer_comment: params.reviewer_comment ?? null,
      };
      if (isUUID(params.reviewer_id)) {
        updatePayload.reviewed_by = params.reviewer_id;
      }
      await supabase.from("leave_requests").update(updatePayload).eq("id", params.leave.id);
    }
    return { success: true };
  }
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
    const authUser = (context as any)?.user;
    const { leaveType, startDate, endDate, remarks } = params;

    // Use current authenticated user ID to satisfy Supabase RLS policies (auth.uid() = user_id)
    const effectiveUserId = authUser?.id || params.userId;

    const days = leaveDayCount(startDate, endDate);
    if (days === 0) {
      throw new Error("That range only covers weekend days.");
    }

    // 1. Insert leave request record
    let data: any = null;
    const { data: insertedData, error } = await db.from("leave_requests").insert({
      user_id: effectiveUserId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      remarks: remarks || null,
      status: "pending",
    }).select().single();

    if (error) {
      console.warn("createLeaveRequestAndNotify RLS error, attempting fallback:", error);
      if (params.userId && params.userId !== effectiveUserId) {
        const { data: retryData, error: retryError } = await db.from("leave_requests").insert({
          user_id: params.userId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          remarks: remarks || null,
          status: "pending",
        }).select().single();

        if (retryError) {
          throw new Error(`Failed to submit leave request: ${retryError.message}`);
        }
        data = retryData;
      } else {
        throw new Error(`Failed to submit leave request: ${error.message}`);
      }
    } else {
      data = insertedData;
    }

    const leaveLabel = LEAVE_TYPE_LABEL[leaveType] || "Leave";

    // 2. Fetch employee name for notification
    const { data: userProfile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", effectiveUserId)
      .maybeSingle();
    const empName = userProfile?.full_name ?? "An employee";

    // 3. Dispatch confirmation notification to employee
    try {
      await (db.from("notifications" as any) as any).insert({
        user_id: effectiveUserId,
        title: "Leave Request Submitted 🌴",
        message: `Your ${leaveLabel} request (${startDate} to ${endDate}, ${days} day(s)) has been sent to HR for approval.`,
        type: "leave_submitted",
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Failed to insert notification for employee:", e);
    }

    // 4. Dispatch notification to ALL HR Admins via secure RPC
    try {
      await db.rpc("notify_admins" as any, {
        _title: "New Leave Request Pending Review ⏳",
        _message: `${empName} has submitted a ${leaveLabel} request (${startDate} to ${endDate}, ${days} day(s)). Review and confirm approval.`,
        _type: "leave_request_pending",
      });
    } catch (e) {
      console.warn("notify_admins RPC optional warning:", e);
    }

    return data;
  });

export async function createLeaveRequestAndNotify(params: {
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  remarks?: string | null;
}) {
  const days = leaveDayCount(params.startDate, params.endDate);
  const leaveLabel = LEAVE_TYPE_LABEL[params.leaveType] || "Leave";
  const nowIso = new Date().toISOString();

  // Create a local leave object for instant multi-tab sync
  const newLeaveRecord: LeaveRequest = {
    id: `lr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: params.userId,
    leave_type: params.leaveType,
    start_date: params.startDate,
    end_date: params.endDate,
    remarks: params.remarks || null,
    status: "pending",
    reviewer_comment: null,
    reviewed_by: null,
    created_at: nowIso,
    profiles: {
      full_name: params.userId.includes("admin") ? "Aarav Mehta" : "Priya Sharma",
      employee_id: "DF-002",
      department: "Engineering",
    },
  };

  // Save local record for immediate UI display across tabs
  saveLocalLeaveRequest(newLeaveRecord);

  // Dispatch notification for HR Admin locally
  saveLocalNotification({
    user_id: "admin",
    title: "New Leave Request Pending Review ⏳",
    message: `${newLeaveRecord.profiles?.full_name || "An employee"} has submitted a ${leaveLabel} request (${params.startDate} to ${params.endDate}, ${days} day(s)). Review and confirm approval.`,
    type: "leave_request_pending",
  });

  // Dispatch Email Notification Alert to HR Admin
  try {
    const empName = newLeaveRecord.profiles?.full_name || "An employee";
    await sendLeaveSubmittedAdminEmail({
      adminEmail: "admin@dayflow.io",
      employeeName: empName,
      employeeId: newLeaveRecord.profiles?.employee_id ?? null,
      leaveType: leaveLabel,
      startDate: params.startDate,
      endDate: params.endDate,
      days,
      remarks: params.remarks ?? null,
    });
  } catch (emailErr) {
    console.warn("Admin email alert dispatch warning:", emailErr);
  }

  try {
    const res = await createLeaveRequestAndNotifyFn({ data: params });
    if (res && (res as any).id) {
      removeLocalLeaveRequest(newLeaveRecord.id);
      saveLocalLeaveRequest(res as unknown as LeaveRequest);
    }
    return res;
  } catch (err: any) {
    console.warn("createLeaveRequestAndNotifyFn server warning, using synced fallback:", err);
    if (isUUID(params.userId)) {
      try {
        await supabase.from("leave_requests").insert({
          user_id: params.userId,
          leave_type: params.leaveType,
          start_date: params.startDate,
          end_date: params.endDate,
          remarks: params.remarks || null,
          status: "pending",
        });
      } catch (dbErr) {
        console.warn("Direct DB insert warning:", dbErr);
      }
    }
    return newLeaveRecord;
  }
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
  const { error } = await (supabase.rpc as any)("promote_user_to_admin", {
    _target_user_id: userId,
  });
  if (error) {
    throw new Error(error.message || "Failed to promote user to HR Admin.");
  }
}

const EMAIL_CHECK_COOLDOWN_MS = 60000;
const MAX_EMAIL_CHECKS_PER_WINDOW = 3;

interface EmailCheckThrottle {
  count: number;
  windowStart: number;
}

function getClientThrottleState(): EmailCheckThrottle {
  if (typeof window === "undefined") return { count: 0, windowStart: Date.now() };
  try {
    const raw = sessionStorage.getItem("dayflow_email_check_throttle");
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return { count: 0, windowStart: Date.now() };
}

function updateClientThrottleState(state: EmailCheckThrottle) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("dayflow_email_check_throttle", JSON.stringify(state));
  } catch {
    // ignore
  }
}

export async function verifyEmailExists(email: string): Promise<boolean> {
  const now = Date.now();
  const throttle = getClientThrottleState();

  if (now - throttle.windowStart > EMAIL_CHECK_COOLDOWN_MS) {
    throttle.count = 1;
    throttle.windowStart = now;
  } else {
    if (throttle.count >= MAX_EMAIL_CHECKS_PER_WINDOW) {
      const waitSecs = Math.ceil((EMAIL_CHECK_COOLDOWN_MS - (now - throttle.windowStart)) / 1000);
      throw new Error(`Rate Limit Exceeded: Too many verification attempts. Please wait ${waitSecs} seconds before trying again.`);
    }
    throttle.count += 1;
  }

  updateClientThrottleState(throttle);

  const { data, error } = await (supabase.rpc as any)("check_email_exists", {
    _email: email,
    _client_key: typeof window !== "undefined" ? window.location.hostname || "web_client" : "web_client",
  });
  if (error) {
    if (error.message && error.message.includes("Rate limit exceeded")) {
      throw new Error("Rate Limit Exceeded: Too many verification attempts. Please wait 60 seconds before trying again.");
    }
    console.warn("check_email_exists RPC error:", error);
    return false;
  }
  return Boolean(data);
}

export { supabase };
