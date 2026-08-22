import {
  INITIAL_PROFILES,
  INITIAL_USER_ROLES,
  INITIAL_SALARY,
  INITIAL_ATTENDANCE,
  INITIAL_LEAVES,
  INITIAL_NOTIFICATIONS,
} from "./mock-data";

// In-memory data store for mock operation modifications during session
const profilesStore = { ...INITIAL_PROFILES };
const userRolesStore = [...INITIAL_USER_ROLES];
const salaryStore = { ...INITIAL_SALARY };
const attendanceStore = [...INITIAL_ATTENDANCE];
const leavesStore = [...INITIAL_LEAVES];
const notificationsStore = [...INITIAL_NOTIFICATIONS];

export const mockAuth = {
  async getSession() {
    if (typeof window === "undefined") return { data: { session: null }, error: null };
    const sessionStr = sessionStorage.getItem("dayflow_demo_session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        return { data: { session }, error: null };
      } catch (e) {
        // invalid JSON
      }
    }
    return { data: { session: null }, error: null };
  },

  async getUser() {
    if (typeof window === "undefined") return { data: { user: null }, error: null };
    const sessionStr = sessionStorage.getItem("dayflow_demo_session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        return { data: { user: session.user }, error: null };
      } catch (e) {
        // invalid JSON
      }
    }
    return { data: { user: null }, error: null };
  },

  async signInWithPassword({ email }: { email: string; password?: string }) {
    const cleanEmail = (email || "").toLowerCase().trim();
    const profile = Object.values(profilesStore).find(
      (p) => p.email?.toLowerCase() === cleanEmail
    );

    let user: any;
    if (profile) {
      const roleObj = userRolesStore.find((r) => r.user_id === profile.id);
      const role = roleObj?.role || "employee";
      user = {
        id: profile.id,
        email: profile.email,
        user_metadata: {
          full_name: profile.full_name,
          employee_id: profile.employee_id,
          role,
          department: profile.department,
          designation: profile.designation,
        },
      };
    } else {
      // Default to HR Admin or generic employee for demo
      const isAdmin = cleanEmail.includes("admin");
      const id = isAdmin
        ? "a0000000-0000-4000-8000-000000000001"
        : "a0000000-0000-4000-8000-000000000002";
      const existing = profilesStore[id];
      user = {
        id,
        email: cleanEmail,
        user_metadata: {
          full_name: existing?.full_name || "Demo User",
          employee_id: existing?.employee_id || "DF-001",
          role: isAdmin ? "admin" : "employee",
          department: existing?.department || "Engineering",
          designation: existing?.designation || "Senior Engineer",
        },
      };
    }

    const session = {
      access_token: "demo_access_token",
      token_type: "bearer",
      user,
    };

    if (typeof window !== "undefined") {
      sessionStorage.setItem("dayflow_demo_session", JSON.stringify(session));
    }
    return { data: { user, session }, error: null };
  },

  async signUp({ email, options }: any) {
    const newId = "user_" + Date.now();
    const metadata = options?.data || {};
    const user = {
      id: newId,
      email,
      user_metadata: metadata,
    };
    const session = {
      access_token: "demo_access_token",
      token_type: "bearer",
      user,
    };

    profilesStore[newId] = {
      id: newId,
      employee_id: metadata.employee_id || "DF-" + Math.floor(100 + Math.random() * 900),
      full_name: metadata.full_name || email.split("@")[0],
      email,
      phone: null,
      address: null,
      department: metadata.department || "Engineering",
      designation: metadata.designation || "Team Member",
      date_of_joining: new Date().toISOString().split("T")[0] ?? null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    userRolesStore.push({
      id: "role_" + Date.now(),
      user_id: newId,
      role: metadata.role || "employee",
    });

    if (typeof window !== "undefined") {
      sessionStorage.setItem("dayflow_demo_session", JSON.stringify(session));
    }
    return { data: { user, session }, error: null };
  },

  async signOut() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("dayflow_demo_session");
    }
    return { error: null };
  },
};

export class MockQueryBuilder {
  table: string;
  filters: Array<(item: any) => boolean> = [];
  insertPayload: any = null;
  updatePayload: any = null;
  limitCount: number | null = null;
  isSingle = false;
  isMaybeSingle = false;
  sortColumn: string | null = null;
  sortAscending = true;

  constructor(table: string) {
    this.table = table;
  }

  select(_fields?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((item) => item[col] === val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push((item) => item[col] >= val);
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push((item) => item[col] <= val);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.sortColumn = col;
    this.sortAscending = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.insertPayload = data;
    return this;
  }

  update(data: any) {
    this.updatePayload = data;
    return this;
  }

  delete() {
    return this;
  }

  async then(resolve: any, reject?: any) {
    try {
      const result = this.execute();
      return resolve(result);
    } catch (err) {
      if (reject) return reject(err);
      return resolve({ data: null, error: err });
    }
  }

  private execute() {
    let source: any[] = [];
    if (this.table === "profiles") {
      source = Object.values(profilesStore);
    } else if (this.table === "user_roles") {
      source = userRolesStore;
    } else if (this.table === "attendance") {
      source = attendanceStore;
    } else if (this.table === "leave_requests") {
      source = leavesStore.map((l) => {
        const prof = profilesStore[l.user_id];
        return {
          ...l,
          profiles: prof
            ? {
                full_name: prof.full_name,
                employee_id: prof.employee_id,
                department: prof.department,
              }
            : null,
        };
      });
    } else if (this.table === "salary_structures") {
      source = Object.values(salaryStore);
    } else if (this.table === "notifications") {
      source = notificationsStore;
    }

    // Insert operation
    if (this.insertPayload) {
      const items = Array.isArray(this.insertPayload)
        ? this.insertPayload
        : [this.insertPayload];
      const inserted: any[] = [];

      items.forEach((item) => {
        const newItem = {
          id: item.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          created_at: new Date().toISOString(),
          ...item,
        };
        if (this.table === "profiles") profilesStore[newItem.id] = newItem;
        else if (this.table === "user_roles") userRolesStore.push(newItem);
        else if (this.table === "attendance") {
          const idx = attendanceStore.findIndex(
            (a) => a.user_id === newItem.user_id && a.date === newItem.date
          );
          if (idx !== -1) {
            attendanceStore[idx] = { ...attendanceStore[idx], ...newItem };
          } else {
            attendanceStore.push(newItem);
          }
        }
        else if (this.table === "leave_requests") leavesStore.unshift(newItem);
        else if (this.table === "salary_structures") salaryStore[newItem.user_id] = newItem;
        else if (this.table === "notifications") notificationsStore.unshift(newItem);
        inserted.push(newItem);
      });

      return {
        data: Array.isArray(this.insertPayload) ? inserted : inserted[0],
        error: null,
      };
    }

    // Filter items
    let filtered = source.filter((item) =>
      this.filters.every((fn) => fn(item))
    );

    // Update operation
    if (this.updatePayload) {
      filtered.forEach((item) => {
        Object.assign(item, this.updatePayload);
        if (this.table === "profiles") profilesStore[item.id] = item;
        else if (this.table === "salary_structures") salaryStore[item.user_id] = item;
        else if (this.table === "leave_requests") {
          const idx = leavesStore.findIndex((l) => l.id === item.id);
          if (idx !== -1) leavesStore[idx] = { ...leavesStore[idx], ...this.updatePayload };
        } else if (this.table === "attendance") {
          const idx = attendanceStore.findIndex((a) => a.id === item.id);
          if (idx !== -1) attendanceStore[idx] = { ...attendanceStore[idx], ...this.updatePayload };
        } else if (this.table === "notifications") {
          const idx = notificationsStore.findIndex((n) => n.id === item.id);
          if (idx !== -1) notificationsStore[idx] = { ...notificationsStore[idx], ...this.updatePayload };
        }
      });
      return { data: filtered, error: null };
    }

    // Sort items
    if (this.sortColumn) {
      const col = this.sortColumn;
      const asc = this.sortAscending;
      filtered.sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
    }

    // Limit items
    if (this.limitCount !== null) {
      filtered = filtered.slice(0, this.limitCount);
    }

    if (this.isSingle || this.isMaybeSingle) {
      return { data: filtered[0] ?? null, error: null };
    }

    return { data: filtered, error: null };
  }
}
