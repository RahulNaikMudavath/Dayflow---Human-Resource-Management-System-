import {
  ATTENDANCE_META,
  LEAVE_STATUS_META,
  type AttendanceStatus,
  type LeaveStatus,
} from "@/lib/dayflow";
import { cn } from "@/lib/utils";

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const meta = ATTENDANCE_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const meta = LEAVE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  );
}
