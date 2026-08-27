import { useQuery } from "@tanstack/react-query";
import { supabase, type Profile } from "@/lib/dayflow";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile | null;
  roles: string[];
  isAdmin: boolean;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (typeof window !== "undefined") {
          const rawDemo = localStorage.getItem("dayflow_demo_session");
          if (rawDemo) {
            try {
              const parsed = JSON.parse(rawDemo);
              const userEmail = parsed.email || "pranavhiremath7777@gmail.com";
              const isAdmin =
                parsed.role === "admin" ||
                userEmail.includes("admin") ||
                userEmail.includes("pranav");

              const formattedName =
                userEmail.includes("pranav")
                  ? "Pranav Hiremath"
                  : userEmail.split("@")[0]?.replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Admin User";

              return {
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
            } catch {
              // ignore
            }
          }
        }
        return null;
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

        const { data: created } = await supabase
          .from("profiles")
          .upsert(fallback as any, { onConflict: "id" })
          .select("*")
          .maybeSingle();

        profile = (created as unknown as Profile | null) ?? fallback;
      }

      const roleList = (roles ?? []).map((r: any) => String(r.role));
      return {
        id: user.id,
        email: user.email ?? "",
        profile,
        roles: roleList,
        isAdmin: roleList.includes("admin"),
      };
    },
    staleTime: 30_000,
  });
}
