/**
 * Dayflow Local Database Engine (Offline & Local Storage Manager)
 * Ensures 100% functionality without internet connectivity or external cloud reliance.
 */

import type { AttendanceRow, LeaveRequest, Profile, SalaryStructure } from "./dayflow";

const KEYS = {
  PROFILES: "dayflow_local_profiles",
  ATTENDANCE: "dayflow_local_attendance",
  LEAVES: "dayflow_local_leaves",
  SALARIES: "dayflow_local_salaries",
};

export const INITIAL_LOCAL_PROFILES: Profile[] = [
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

export const INITIAL_LOCAL_SALARIES: SalaryStructure[] = [
  {
    id: "demo-sal-1",
    user_id: "demo-user-id",
    basic: 85000,
    hra: 34000,
    allowances: 18000,
    deductions: 11000,
    effective_from: "2024-01-01",
  },
  {
    id: "demo-sal-2",
    user_id: "demo-emp-2",
    basic: 70000,
    hra: 28000,
    allowances: 15000,
    deductions: 9200,
    effective_from: "2024-01-01",
  },
  {
    id: "demo-sal-3",
    user_id: "demo-emp-3",
    basic: 75000,
    hra: 30000,
    allowances: 16000,
    deductions: 9800,
    effective_from: "2024-01-01",
  },
  {
    id: "demo-sal-4",
    user_id: "demo-emp-4",
    basic: 68000,
    hra: 27200,
    allowances: 14000,
    deductions: 8900,
    effective_from: "2024-01-01",
  },
  {
    id: "demo-sal-5",
    user_id: "demo-emp-5",
    basic: 55000,
    hra: 22000,
    allowances: 11000,
    deductions: 7200,
    effective_from: "2024-01-01",
  },
  {
    id: "demo-sal-6",
    user_id: "demo-emp-6",
    basic: 60000,
    hra: 24000,
    allowances: 12000,
    deductions: 7800,
    effective_from: "2024-01-01",
  },
];

/* ---------------- Profiles ---------------- */

export function getLocalProfiles(): Profile[] {
  if (typeof window === "undefined") return INITIAL_LOCAL_PROFILES;
  try {
    const raw = localStorage.getItem(KEYS.PROFILES);
    if (!raw) {
      localStorage.setItem(KEYS.PROFILES, JSON.stringify(INITIAL_LOCAL_PROFILES));
      return INITIAL_LOCAL_PROFILES;
    }
    return JSON.parse(raw) as Profile[];
  } catch {
    return INITIAL_LOCAL_PROFILES;
  }
}

export function saveLocalProfile(profile: Profile): Profile[] {
  const current = getLocalProfiles();
  const index = current.findIndex((p) => p.id === profile.id);
  let updated: Profile[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...profile, updated_at: new Date().toISOString() };
  } else {
    updated = [...current, profile];
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.PROFILES, JSON.stringify(updated));
  }
  return updated;
}

/* ---------------- Attendance ---------------- */

export function getLocalAttendance(): AttendanceRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.ATTENDANCE);
    if (!raw) return [];
    return JSON.parse(raw) as AttendanceRow[];
  } catch {
    return [];
  }
}

export function saveLocalAttendance(row: Partial<AttendanceRow> & { user_id: string; date: string }): AttendanceRow[] {
  const current = getLocalAttendance();
  const index = current.findIndex((r) => r.user_id === row.user_id && r.date === row.date);
  let updated: AttendanceRow[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...row } as AttendanceRow;
  } else {
    const newRow: AttendanceRow = {
      id: row.id || `local-att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: row.user_id,
      date: row.date,
      check_in: row.check_in ?? null,
      check_out: row.check_out ?? null,
      status: row.status ?? "present",
    };
    updated = [...current, newRow];
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(updated));
  }
  return updated;
}

/* ---------------- Leaves ---------------- */

export function getLocalLeaves(): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.LEAVES);
    if (!raw) return [];
    return JSON.parse(raw) as LeaveRequest[];
  } catch {
    return [];
  }
}

export function saveLocalLeave(req: Omit<LeaveRequest, "id" | "created_at"> & { id?: string }): LeaveRequest[] {
  const current = getLocalLeaves();
  const newReq: LeaveRequest = {
    id: req.id || `local-leave-${Date.now()}`,
    user_id: req.user_id,
    leave_type: req.leave_type,
    start_date: req.start_date,
    end_date: req.end_date,
    remarks: req.remarks ?? null,
    status: req.status ?? "pending",
    reviewer_comment: req.reviewer_comment ?? null,
    reviewed_by: req.reviewed_by ?? null,
    created_at: new Date().toISOString(),
  };
  const updated = [newReq, ...current];
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(updated));
  }
  return updated;
}

export function updateLocalLeaveStatus(id: string, status: "approved" | "rejected", reviewerId: string): LeaveRequest[] {
  const current = getLocalLeaves();
  const updated = current.map((l) =>
    l.id === id ? { ...l, status, reviewed_by: reviewerId } : l,
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.LEAVES, JSON.stringify(updated));
  }
  return updated;
}

/* ---------------- Salaries ---------------- */

export function getLocalSalaries(): SalaryStructure[] {
  if (typeof window === "undefined") return INITIAL_LOCAL_SALARIES;
  try {
    const raw = localStorage.getItem(KEYS.SALARIES);
    if (!raw) {
      localStorage.setItem(KEYS.SALARIES, JSON.stringify(INITIAL_LOCAL_SALARIES));
      return INITIAL_LOCAL_SALARIES;
    }
    return JSON.parse(raw) as SalaryStructure[];
  } catch {
    return INITIAL_LOCAL_SALARIES;
  }
}

export function saveLocalSalary(salary: Omit<SalaryStructure, "id"> & { id?: string | undefined }): SalaryStructure[] {
  const current = getLocalSalaries();
  const index = current.findIndex((s) => s.user_id === salary.user_id);
  let updated: SalaryStructure[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...salary } as SalaryStructure;
  } else {
    const newSal: SalaryStructure = {
      id: salary.id || `local-sal-${Date.now()}`,
      user_id: salary.user_id,
      basic: salary.basic,
      hra: salary.hra,
      allowances: salary.allowances,
      deductions: salary.deductions,
      effective_from: salary.effective_from || (new Date().toISOString().split("T")[0] as string),
    };
    updated = [...current, newSal];
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(KEYS.SALARIES, JSON.stringify(updated));
  }
  return updated;
}
