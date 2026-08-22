import { supabase } from "@/integrations/supabase/client";

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

export { supabase };
