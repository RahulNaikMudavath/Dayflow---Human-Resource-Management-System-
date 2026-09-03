import { useQuery } from "@tanstack/react-query";
import { supabase, type Profile } from "@/lib/dayflow";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile | null;
  roles: string[];
  isAdmin: boolean;
}

function getCachedUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem("dayflow_cached_user") ||
      localStorage.getItem("dayflow_cached_user");
    if (raw) return JSON.parse(raw);

    const rawDemo =
      sessionStorage.getItem("dayflow_demo_session") ||
      localStorage.getItem("dayflow_demo_session");
    if (rawDemo) {
      const parsed = JSON.parse(rawDemo);
      const userEmail = parsed.email || "pranavhiremath7777@gmail.com";
      const isAdmin =
        parsed.role === "admin" ||
        userEmail.includes("admin") ||
        userEmail.includes("pranav");

      const formattedName = userEmail.includes("pranav")
        ? "Pranav Hiremath"
        : userEmail
            .split("@")[0]
            ?.replace(/[._]/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Admin User";

      const demoUser: CurrentUser = {
        id: "demo-user-id",
        email: userEmail,
        profile: {
          id: "demo-user-id",
          employee_id: isAdmin ? "DF-001" : "DF-002",
          full_name: formattedName,
          email: userEmail,
          phone: "+91 98220 41102",
          address: "Bengaluru, India",
          department: isAdmin ? "People Ops" : "Engineering",
          designation: isAdmin ? "Head of HR & Operations" : "Senior Engineer",
          date_of_joining: "2022-01-01",
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        roles: [isAdmin ? "admin" : "employee"],
        isAdmin,
      };
      sessionStorage.setItem("dayflow_cached_user", JSON.stringify(demoUser));
      return demoUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    initialData: getCachedUser,
    initialDataUpdatedAt: () => (getCachedUser() ? Date.now() : 0),
    queryFn: async (): Promise<CurrentUser | null> => {
      // Check local cache first for instant resolution
      const cached = getCachedUser();
      if (cached) return cached;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;

        if (!user) {
          return getCachedUser();
        }

        const [{ data: rawProfile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id),
        ]);

        let profile: Profile | null = (rawProfile as unknown as Profile | null);
        if (!profile) {
          const metadata = user.user_metadata ?? {};
          const metaFullName =
            typeof metadata["full_name"] === "string" ? metadata["full_name"] : undefined;
          const metaEmpId =
            typeof metadata["employee_id"] === "string" ? metadata["employee_id"] : undefined;
          const metaDept =
            typeof metadata["department"] === "string" ? metadata["department"] : undefined;
          const metaDesig =
            typeof metadata["designation"] === "string" ? metadata["designation"] : undefined;
          const now = new Date().toISOString();
          const todayDate = now.split("T")[0] || null;

          const fallback: Profile = {
            id: user.id,
            employee_id: metaEmpId || `DF-${user.id.slice(0, 6).toUpperCase()}`,
            full_name: metaFullName || user.email?.split("@")[0]?.replace(/[._]/g, " ") || "User",
            email: user.email ?? null,
            phone: null,
            address: null,
            department: metaDept || "Engineering",
            designation: metaDesig || "Employee",
            date_of_joining: todayDate,
            avatar_url: null,
            created_at: now,
            updated_at: now,
          };

          profile = fallback;
        }

        const roleList = (roles ?? []).map((r: any) => String(r.role));
        const res: CurrentUser = {
          id: user.id,
          email: user.email ?? "",
          profile,
          roles: roleList,
          isAdmin: roleList.includes("admin"),
        };

        if (typeof window !== "undefined") {
          sessionStorage.setItem("dayflow_cached_user", JSON.stringify(res));
          localStorage.setItem("dayflow_cached_user", JSON.stringify(res));
        }
        return res;
      } catch (err) {
        return getCachedUser();
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
