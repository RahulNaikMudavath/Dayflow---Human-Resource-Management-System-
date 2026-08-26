import {
  INITIAL_PROFILES,
  INITIAL_USER_ROLES,
  INITIAL_SALARY,
  INITIAL_ATTENDANCE,
  INITIAL_LEAVES,
  INITIAL_NOTIFICATIONS,
} from "./mock-data";

function getStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota
  }
}

const getProfilesStore = () => getStore("dayflow_db_profiles", INITIAL_PROFILES);
const saveProfilesStore = (data: any) => setStore("dayflow_db_profiles", data);

const getUserRolesStore = () => getStore("dayflow_db_user_roles", INITIAL_USER_ROLES);
const saveUserRolesStore = (data: any) => setStore("dayflow_db_user_roles", data);

const getSalaryStore = () => getStore("dayflow_db_salary", INITIAL_SALARY);
const saveSalaryStore = (data: any) => setStore("dayflow_db_salary", data);

const getAttendanceStore = () => getStore("dayflow_db_attendance", INITIAL_ATTENDANCE);
const saveAttendanceStore = (data: any) => setStore("dayflow_db_attendance", data);

const getLeavesStore = () => getStore("dayflow_db_leaves", INITIAL_LEAVES);
const saveLeavesStore = (data: any) => setStore("dayflow_db_leaves", data);

const getNotificationsStore = () => getStore("dayflow_db_notifications", INITIAL_NOTIFICATIONS);
const saveNotificationsStore = (data: any) => setStore("dayflow_db_notifications", data);

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
    const profilesStore = getProfilesStore();
    const userRolesStore = getUserRolesStore();
    const profile = Object.values(profilesStore).find(
      (p: any) => p.email?.toLowerCase() === cleanEmail
    );

    let user: any;
    if (profile) {
      const roleObj = userRolesStore.find((r: any) => r.user_id === profile.id);
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

    const profilesStore = getProfilesStore();
    const userRolesStore = getUserRolesStore();

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
    saveProfilesStore(profilesStore);

    userRolesStore.push({
      id: "role_" + Date.now(),
      user_id: newId,
      role: "employee",
    });
    saveUserRolesStore(userRolesStore);

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

export async function mockRpc(fnName: string, args: any) {
  if (fnName === "promote_user_to_admin") {
    const targetUserId = args?._target_user_id || args?.target_user_id || args?.userId;
    const userRolesStore = getUserRolesStore();
    const existing = userRolesStore.find((r: any) => r.user_id === targetUserId);
    if (existing) {
      existing.role = "admin";
    } else {
      userRolesStore.push({
        id: "role_" + Date.now(),
        user_id: targetUserId,
        role: "admin",
      });
    }
    saveUserRolesStore(userRolesStore);
    return { data: null, error: null };
  }
  if (fnName === "check_email_exists") {
    const email = (args?._email || args?.email || "").toLowerCase().trim();
    const profilesStore = getProfilesStore();
    const exists = Object.values(profilesStore).some((p: any) => p.email?.toLowerCase().trim() === email);
    return { data: exists, error: null };
  }
  if (fnName === "notify_admins") {
    const title = args?._title || args?.title || "Notification";
    const message = args?._message || args?.message || "";
    const type = args?._type || args?.type || "system";
    const userRolesStore = getUserRolesStore();
    const adminRoles = userRolesStore.filter((r: any) => r.role === "admin");
    const notificationsStore = getNotificationsStore();
    for (const a of adminRoles) {
      notificationsStore.unshift({
        id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        user_id: a.user_id,
        title,
        message,
        type,
        read: false,
        created_at: new Date().toISOString(),
      });
    }
    saveNotificationsStore(notificationsStore);
    return { data: null, error: null };
  }
  return { data: null, error: new Error(`Unknown RPC function ${fnName}`) };
}

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

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) =>
      typeof item[column] === "string" && typeof value === "string"
        ? item[column].toLowerCase() === value.toLowerCase()
        : item[column] === value
    );
    return this;
  }

  ilike(column: string, value: any) {
    const cleanPattern = String(value ?? "").replace(/%/g, "").toLowerCase();
    this.filters.push((item) => String(item[column] ?? "").toLowerCase().includes(cleanPattern));
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item) => item[column] >= value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => item[column] <= value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.sortColumn = column;
    this.sortAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
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

  insert(payload: any) {
    this.insertPayload = payload;
    return this;
  }

  upsert(payload: any, _options?: any) {
    this.insertPayload = payload;
    return this;
  }

  update(payload: any) {
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.updatePayload = { __deleted: true };
    return this;
  }

  async then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) {
    try {
      const profilesStore = getProfilesStore();
      const userRolesStore = getUserRolesStore();
      const salaryStore = getSalaryStore();
      const attendanceStore = getAttendanceStore();
      const leavesStore = getLeavesStore();
      const notificationsStore = getNotificationsStore();

      let source: any[] = [];
      if (this.table === "profiles") {
        source = Object.values(profilesStore);
      } else if (this.table === "user_roles") {
        source = userRolesStore;
      } else if (this.table === "attendance") {
        source = attendanceStore;
      } else if (this.table === "leave_requests") {
        source = leavesStore.map((l: any) => {
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
          if (this.table === "profiles") {
            profilesStore[newItem.id] = newItem;
            saveProfilesStore(profilesStore);
          } else if (this.table === "user_roles") {
            userRolesStore.push(newItem);
            saveUserRolesStore(userRolesStore);
          } else if (this.table === "attendance") {
            const idx = attendanceStore.findIndex(
              (a: any) => a.user_id === newItem.user_id && a.date === newItem.date
            );
            if (idx !== -1) {
              attendanceStore[idx] = { ...attendanceStore[idx], ...newItem };
            } else {
              attendanceStore.push(newItem);
            }
            saveAttendanceStore(attendanceStore);
          } else if (this.table === "leave_requests") {
            leavesStore.unshift(newItem);
            saveLeavesStore(leavesStore);
          } else if (this.table === "salary_structures") {
            salaryStore[newItem.user_id] = newItem;
            saveSalaryStore(salaryStore);
          } else if (this.table === "notifications") {
            notificationsStore.unshift(newItem);
            saveNotificationsStore(notificationsStore);
          }
          inserted.push(newItem);
        });

        const result = {
          data: Array.isArray(this.insertPayload) ? inserted : inserted[0],
          error: null,
        };
        return onFulfilled ? onFulfilled(result) : result;
      }

      // Filter items
      let filtered = source.filter((item) =>
        this.filters.every((fn) => fn(item))
      );

      // Update / Delete operation
      if (this.updatePayload) {
        if (this.updatePayload.__deleted) {
          if (this.table === "leave_requests") {
            const idsToDelete = new Set(filtered.map((f) => f.id));
            const updatedLeaves = leavesStore.filter((l: any) => !idsToDelete.has(l.id));
            saveLeavesStore(updatedLeaves);
          }
        } else {
          filtered.forEach((item) => {
            Object.assign(item, this.updatePayload);
            if (this.table === "profiles") {
              profilesStore[item.id] = item;
              saveProfilesStore(profilesStore);
            } else if (this.table === "salary_structures") {
              salaryStore[item.user_id] = item;
              saveSalaryStore(salaryStore);
            } else if (this.table === "leave_requests") {
              const idx = leavesStore.findIndex((l: any) => l.id === item.id);
              if (idx !== -1) leavesStore[idx] = { ...leavesStore[idx], ...this.updatePayload };
              saveLeavesStore(leavesStore);
            } else if (this.table === "attendance") {
              const idx = attendanceStore.findIndex((a: any) => a.id === item.id);
              if (idx !== -1) attendanceStore[idx] = { ...attendanceStore[idx], ...this.updatePayload };
              saveAttendanceStore(attendanceStore);
            } else if (this.table === "notifications") {
              const idx = notificationsStore.findIndex((n: any) => n.id === item.id);
              if (idx !== -1) notificationsStore[idx] = { ...notificationsStore[idx], ...this.updatePayload };
              saveNotificationsStore(notificationsStore);
            }
          });
        }
        const result = { data: filtered, error: null };
        return onFulfilled ? onFulfilled(result) : result;
      }

      // Sort items
      if (this.sortColumn) {
        const col = this.sortColumn;
        filtered.sort((a, b) => {
          const valA = a[col] ?? "";
          const valB = b[col] ?? "";
          if (valA < valB) return this.sortAscending ? -1 : 1;
          if (valA > valB) return this.sortAscending ? 1 : -1;
          return 0;
        });
      }

      // Limit items
      if (this.limitCount !== null) {
        filtered = filtered.slice(0, this.limitCount);
      }

      // Single item response
      if (this.isSingle) {
        if (filtered.length === 0) {
          const errRes = { data: null, error: { message: "Row not found" } };
          return onRejected ? onRejected(errRes.error) : errRes;
        }
        const singleRes = { data: filtered[0], error: null };
        return onFulfilled ? onFulfilled(singleRes) : singleRes;
      }

      if (this.isMaybeSingle) {
        const maybeRes = { data: filtered[0] ?? null, error: null };
        return onFulfilled ? onFulfilled(maybeRes) : maybeRes;
      }

      const listRes = { data: filtered, error: null };
      return onFulfilled ? onFulfilled(listRes) : listRes;
    } catch (err) {
      if (onRejected) return onRejected(err);
      throw err;
    }
  }
}
