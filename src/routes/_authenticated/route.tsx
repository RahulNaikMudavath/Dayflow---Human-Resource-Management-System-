import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/dayflow";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Only check auth in beforeLoad during client-side navigation.
    // On SSR (server side), window is undefined and client localStorage/session cannot be read.
    if (typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        const hasDemoSession = !!localStorage.getItem("dayflow_demo_session");
        if (!data?.session && !hasDemoSession) {
          throw redirect({ to: "/auth" });
        }
      } catch (err) {
        if (err && typeof err === "object" && "to" in err) {
          throw err;
        }
        const hasDemoSession = !!localStorage.getItem("dayflow_demo_session");
        if (!hasDemoSession) {
          throw redirect({ to: "/auth" });
        }
      }
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  // Fast initial check: if session exists locally in browser storage, skip the blocking full-screen spinner
  const [checking, setChecking] = useState(() => {
    if (typeof window !== "undefined") {
      const hasDemo = !!localStorage.getItem("dayflow_demo_session");
      const hasSbToken = Object.keys(localStorage).some((k) => k.includes("auth-token"));
      if (hasDemo || hasSbToken) return false;
    }
    return true;
  });

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const hasDemoSession =
        typeof window !== "undefined" && !!localStorage.getItem("dayflow_demo_session");

      if (!data?.session && !hasDemoSession) {
        if (mounted) {
          navigate({ to: "/auth" });
        }
      } else {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("dayflow_demo_session");
        navigate({ to: "/auth" });
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
