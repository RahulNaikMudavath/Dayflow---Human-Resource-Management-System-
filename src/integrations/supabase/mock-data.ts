import type { Profile, AttendanceRow, LeaveRequest, SalaryStructure, NotificationItem } from "@/lib/dayflow";

const nowIso = new Date().toISOString();

export const INITIAL_PROFILES: Record<string, Profile & { created_at?: string; updated_at?: string }> = {
  "a0000000-0000-4000-8000-000000000001": {
    id: "a0000000-0000-4000-8000-000000000001",
    employee_id: "DF-001",
    full_name: "Aarav Mehta",
    email: "admin@dayflow.io",
    phone: "+91 98220 41102",
    address: "HSR Layout, Bengaluru",
    department: "People Ops",
    designation: "Head of People",
    date_of_joining: "2021-04-12",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000002": {
    id: "a0000000-0000-4000-8000-000000000002",
    employee_id: "DF-002",
    full_name: "Priya Sharma",
    email: "priya@dayflow.io",
    phone: "+91 98450 12231",
    address: "Indiranagar, Bengaluru",
    department: "Engineering",
    designation: "Senior Frontend Engineer",
    date_of_joining: "2022-01-10",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000003": {
    id: "a0000000-0000-4000-8000-000000000003",
    employee_id: "DF-003",
    full_name: "Rahul Verma",
    email: "rahul@dayflow.io",
    phone: "+91 99301 88762",
    address: "Koramangala, Bengaluru",
    department: "Design",
    designation: "Product Designer",
    date_of_joining: "2022-06-20",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000004": {
    id: "a0000000-0000-4000-8000-000000000004",
    employee_id: "DF-004",
    full_name: "Sneha Iyer",
    email: "sneha@dayflow.io",
    phone: "+91 90040 55618",
    address: "Whitefield, Bengaluru",
    department: "Engineering",
    designation: "Backend Engineer",
    date_of_joining: "2023-02-01",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000005": {
    id: "a0000000-0000-4000-8000-000000000005",
    employee_id: "DF-005",
    full_name: "Arjun Nair",
    email: "arjun@dayflow.io",
    phone: "+91 98200 77144",
    address: "JP Nagar, Bengaluru",
    department: "Sales",
    designation: "Sales Lead",
    date_of_joining: "2021-11-15",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000006": {
    id: "a0000000-0000-4000-8000-000000000006",
    employee_id: "DF-006",
    full_name: "Kavya Reddy",
    email: "kavya@dayflow.io",
    phone: "+91 97002 31455",
    address: "Hitech City, Hyderabad",
    department: "Marketing",
    designation: "Marketing Manager",
    date_of_joining: "2023-07-03",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000007": {
    id: "a0000000-0000-4000-8000-000000000007",
    employee_id: "DF-007",
    full_name: "Vikram Singh",
    email: "vikram@dayflow.io",
    phone: "+91 98110 20987",
    address: "Saket, New Delhi",
    department: "Finance",
    designation: "Finance Analyst",
    date_of_joining: "2024-01-22",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  "a0000000-0000-4000-8000-000000000008": {
    id: "a0000000-0000-4000-8000-000000000008",
    employee_id: "DF-008",
    full_name: "Ananya Das",
    email: "ananya@dayflow.io",
    phone: "+91 98301 66420",
    address: "Salt Lake, Kolkata",
    department: "People Ops",
    designation: "HR Associate",
    date_of_joining: "2024-09-09",
    avatar_url: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
};

export const INITIAL_USER_ROLES: Array<{ id: string; user_id: string; role: "admin" | "employee" }> = [
  { id: "r1", user_id: "a0000000-0000-4000-8000-000000000001", role: "admin" },
  { id: "r2", user_id: "a0000000-0000-4000-8000-000000000002", role: "employee" },
  { id: "r3", user_id: "a0000000-0000-4000-8000-000000000003", role: "employee" },
  { id: "r4", user_id: "a0000000-0000-4000-8000-000000000004", role: "employee" },
  { id: "r5", user_id: "a0000000-0000-4000-8000-000000000005", role: "employee" },
  { id: "r6", user_id: "a0000000-0000-4000-8000-000000000006", role: "employee" },
  { id: "r7", user_id: "a0000000-0000-4000-8000-000000000007", role: "employee" },
  { id: "r8", user_id: "a0000000-0000-4000-8000-000000000008", role: "employee" },
];

export const INITIAL_SALARY: Record<string, SalaryStructure & { updated_at?: string }> = {
  "a0000000-0000-4000-8000-000000000001": { id: "s1", user_id: "a0000000-0000-4000-8000-000000000001", basic: 120000, hra: 48000, allowances: 32000, deductions: 22000, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000002": { id: "s2", user_id: "a0000000-0000-4000-8000-000000000002", basic: 85000, hra: 34000, allowances: 21000, deductions: 14000, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000003": { id: "s3", user_id: "a0000000-0000-4000-8000-000000000003", basic: 70000, hra: 28000, allowances: 18000, deductions: 12000, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000004": { id: "s4", user_id: "a0000000-0000-4000-8000-000000000004", basic: 80000, hra: 32000, allowances: 20000, deductions: 13500, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000005": { id: "s5", user_id: "a0000000-0000-4000-8000-000000000005", basic: 65000, hra: 26000, allowances: 22000, deductions: 11000, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000006": { id: "s6", user_id: "a0000000-0000-4000-8000-000000000006", basic: 68000, hra: 27200, allowances: 19000, deductions: 11500, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000007": { id: "s7", user_id: "a0000000-0000-4000-8000-000000000007", basic: 60000, hra: 24000, allowances: 15000, deductions: 10000, effective_from: "2025-04-01" },
  "a0000000-0000-4000-8000-000000000008": { id: "s8", user_id: "a0000000-0000-4000-8000-000000000008", basic: 45000, hra: 18000, allowances: 12000, deductions: 8000, effective_from: "2025-04-01" },
};

function generateAttendance(): AttendanceRow[] {
  const rows: AttendanceRow[] = [];
  const users = Object.keys(INITIAL_PROFILES);
  const now = new Date();
  
  for (let i = 21; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    if (isWeekend) continue;
    const dateStr = d.toISOString().split("T")[0] ?? "";

    users.forEach((userId, idx) => {
      const mod = (i + idx) % 7;
      let status: AttendanceRow["status"] = "present";
      if (mod === 0 && idx === 1) status = "leave";
      else if (mod === 3 && idx === 3) status = "half_day";
      else if (mod === 5 && idx === 2) status = "absent";

      const checkIn = status === "absent" ? null : `${dateStr}T09:${10 + (idx % 20)}:00Z`;
      const checkOut = status === "absent" ? null : status === "half_day" ? `${dateStr}T13:30:00Z` : `${dateStr}T18:${15 + (idx % 30)}:00Z`;

      rows.push({
        id: `att_${userId}_${dateStr}`,
        user_id: userId,
        date: dateStr,
        check_in: checkIn,
        check_out: checkOut,
        status,
      });
    });
  }

  return rows;
}

export const INITIAL_ATTENDANCE = generateAttendance();

export const INITIAL_LEAVES: (LeaveRequest & { updated_at?: string })[] = [
  {
    id: "l1",
    user_id: "a0000000-0000-4000-8000-000000000002",
    leave_type: "paid",
    start_date: "2026-08-25",
    end_date: "2026-08-27",
    remarks: "Family trip to Coorg",
    status: "pending",
    reviewer_comment: null,
    reviewed_by: null,
    created_at: "2026-08-21T10:00:00Z",
    updated_at: "2026-08-21T10:00:00Z",
    profiles: {
      full_name: "Priya Sharma",
      employee_id: "DF-002",
      department: "Engineering",
    },
  },
  {
    id: "l2",
    user_id: "a0000000-0000-4000-8000-000000000004",
    leave_type: "paid",
    start_date: "2026-09-01",
    end_date: "2026-09-05",
    remarks: "Cousin's wedding in Kochi",
    status: "pending",
    reviewer_comment: null,
    reviewed_by: null,
    created_at: "2026-08-20T14:30:00Z",
    updated_at: "2026-08-20T14:30:00Z",
    profiles: {
      full_name: "Sneha Iyer",
      employee_id: "DF-004",
      department: "Engineering",
    },
  },
  {
    id: "l3",
    user_id: "a0000000-0000-4000-8000-000000000003",
    leave_type: "sick",
    start_date: "2026-08-18",
    end_date: "2026-08-19",
    remarks: "Down with fever",
    status: "approved",
    reviewer_comment: "Get well soon!",
    reviewed_by: "a0000000-0000-4000-8000-000000000001",
    created_at: "2026-08-17T09:00:00Z",
    updated_at: "2026-08-17T09:00:00Z",
    profiles: {
      full_name: "Rahul Verma",
      employee_id: "DF-003",
      department: "Design",
    },
  },
  {
    id: "l4",
    user_id: "a0000000-0000-4000-8000-000000000007",
    leave_type: "paid",
    start_date: "2026-08-28",
    end_date: "2026-08-29",
    remarks: "House shifting",
    status: "rejected",
    reviewer_comment: "Quarter-end closing week, please reschedule.",
    reviewed_by: "a0000000-0000-4000-8000-000000000001",
    created_at: "2026-08-20T11:00:00Z",
    updated_at: "2026-08-20T11:00:00Z",
    profiles: {
      full_name: "Vikram Singh",
      employee_id: "DF-007",
      department: "Finance",
    },
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    user_id: "a0000000-0000-4000-8000-000000000003",
    title: "Leave Request Approved",
    message: "Your Sick leave request for 18 Aug - 19 Aug was approved by HR.",
    type: "leave_approved",
    read: false,
    created_at: "2026-08-17T09:05:00Z",
  },
];
