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
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roleList = (roles ?? []).map((r) => String(r.role));
      return {
        id: user.id,
        email: user.email ?? "",
        profile: (profile as Profile | null) ?? null,
        roles: roleList,
        isAdmin: roleList.includes("admin"),
      };
    },
    staleTime: 30_000,
  });
}
