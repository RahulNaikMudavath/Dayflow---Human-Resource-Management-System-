import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/dayflow";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Only check auth in beforeLoad during client-side navigation.
    // On SSR (server side), window is undefined and client localStorage/session cannot be read.
    if (typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        const hasDemoSession = !!(
          sessionStorage.getItem("dayflow_demo_session") ||
          localStorage.getItem("dayflow_demo_session")
        );
        if (!data?.session && !hasDemoSession) {
          throw redirect({ to: "/auth" });
        }
      } catch (err) {
        if (err && typeof err === "object" && "to" in err) {
          throw err;
        }
        const hasDemoSession = !!(
          sessionStorage.getItem("dayflow_demo_session") ||
          localStorage.getItem("dayflow_demo_session")
        );
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
  const [isMounted, setIsMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  // useEffect only runs on the client after the initial render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const hasDemoSession =
        typeof window !== "undefined" &&
        !!(
          sessionStorage.getItem("dayflow_demo_session") ||
          localStorage.getItem("dayflow_demo_session")
        );

      if (!data?.session && !hasDemoSession) {
        if (mounted) {
          void navigate({ to: "/auth" });
        }
      } else {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    void checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("dayflow_demo_session");
        localStorage.removeItem("dayflow_demo_session");
        void navigate({ to: "/auth" });
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [isMounted, navigate]);

  // Force both server and initial client render to show the spinner
  if (!isMounted || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Once mounted on the client, render the actual layout
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
