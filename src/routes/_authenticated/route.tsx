import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/dayflow";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const hasDemoSession =
        typeof window !== "undefined" && !!localStorage.getItem("dayflow_demo_session");
      if (!data?.session && !hasDemoSession) {
        throw redirect({ to: "/auth" });
      }
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) {
        throw err;
      }
      const hasDemoSession =
        typeof window !== "undefined" && !!localStorage.getItem("dayflow_demo_session");
      if (!hasDemoSession) {
        throw redirect({ to: "/auth" });
      }
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
