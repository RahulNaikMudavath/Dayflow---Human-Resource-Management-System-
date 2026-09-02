import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarCheck,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Palmtree,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
  Sunrise,
} from "lucide-react";
import { supabase, checkAndDispatchLeaveReminders } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { InitialsAvatar } from "@/components/common/bits";
import { FloatingChatbot } from "@/components/layout/floating-chatbot";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AiAssistantWidget } from "@/components/features/ai/ai-assistant-widget";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/reports", label: "Analytics", icon: BarChart3, adminOnly: true },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/leave", label: "Time Off", icon: Palmtree },
  { to: "/payroll", label: "Payroll", icon: IndianRupee },
  { to: "/employees", label: "People", icon: Users, adminOnly: true },
  { to: "/profile", label: "My Profile", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCollapsed(localStorage.getItem("dayflow-sidebar-collapsed") === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("dayflow-sidebar-collapsed", String(next));
      return next;
    });
  };

  // Instantaneous Realtime Sync between HR and Employee views & Leave Reminders
  useEffect(() => {
    if (!me?.id) return;

    // Check for 1-day leave completion reminders
    checkAndDispatchLeaveReminders(me.id);

    const channel = supabase
      .channel("dayflow-global-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leave"] });
          queryClient.invalidateQueries({ queryKey: ["attendance"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["payroll"] });
          checkAndDispatchLeaveReminders(me.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["attendance"] });
          queryClient.invalidateQueries({ queryKey: ["leave"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "salary_structures" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["payroll"] });
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
          queryClient.invalidateQueries({ queryKey: ["user"] });
        }
      )
      .subscribe();

    const handleLocalUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    };

    window.addEventListener("dayflow-leave-updated", handleLocalUpdate);
    window.addEventListener("storage", handleLocalUpdate);

    return () => {
      window.removeEventListener("dayflow-leave-updated", handleLocalUpdate);
      window.removeEventListener("storage", handleLocalUpdate);
      supabase.removeChannel(channel);
    };
  }, [me?.id, queryClient]);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || me?.isAdmin);

  async function signOut() {
    sessionStorage.removeItem("dayflow_cached_user");
    sessionStorage.removeItem("dayflow_demo_session");
    localStorage.removeItem("dayflow_demo_session");
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  const brand = (showNotification = true, isDesktop = false) => (
    <div
      className={cn(
        "flex items-center justify-between px-3 w-full transition-all duration-300",
        isDesktop && collapsed && "px-2 flex-col gap-3 justify-center"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Sunrise className="size-5" />
          </span>
          {(!isDesktop || !collapsed) && (
            <span className="font-display text-xl font-semibold tracking-tight text-sidebar-foreground truncate animate-in fade-in duration-200">
              Dayflow
            </span>
          )}
        </Link>
      </div>

      {isDesktop ? (
        <div className={cn("flex items-center gap-1.5", collapsed && "flex-col gap-2")}>
          <NotificationBell />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl cursor-pointer transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {showNotification && <NotificationBell />}
        </div>
      )}
    </div>
  );

  const nav = (onNavigate?: () => void, isDesktop = false) => (
    <nav
      className={cn(
        "flex flex-1 flex-col gap-1 w-full px-3 transition-all duration-300",
        isDesktop && collapsed && "px-2 items-center"
      )}
    >
      {items.map((item) => {
        const active =
          item.to === "/dashboard" ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={isDesktop && collapsed ? item.label : item.label}
            className={cn(
              "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium cursor-pointer transition-all duration-200 group relative",
              isDesktop && collapsed ? "size-11 justify-center px-0" : "px-3.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className={cn("size-4 shrink-0 transition-transform duration-200 group-hover:scale-110", active && "text-sidebar-primary")} />
            {(!isDesktop || !collapsed) && (
              <span className="truncate animate-in fade-in duration-200">{item.label}</span>
            )}
            {active && (!isDesktop || !collapsed) && (
              <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary shrink-0" />
            )}
            {/* Tooltip for collapsed desktop state */}
            {isDesktop && collapsed && (
              <span className="absolute left-full ml-3 hidden rounded-lg border border-sidebar-border bg-sidebar px-2.5 py-1 text-xs font-semibold text-sidebar-foreground shadow-xl group-hover:block z-50 whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-150">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (isDesktop = false) => (
    <div className={cn("w-full px-3 transition-all duration-300", isDesktop && collapsed && "px-2")}>
      {/* Theme choose button directly on top of the sidebar profile component */}
      {(!isDesktop || !collapsed) ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
            Theme Mode
          </span>
          <ThemeToggle variant="sidebar" showLabel className="h-7 text-xs bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border/40 cursor-pointer" />
        </div>
      ) : (
        <div className="mb-2 flex justify-center">
          <ThemeToggle variant="sidebar" />
        </div>
      )}
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3 transition-all duration-200 group relative",
          isDesktop && collapsed && "justify-center p-2"
        )}
        title={isDesktop && collapsed ? `${me?.profile?.full_name ?? "User"} (${me?.isAdmin ? "HR Admin" : "Employee"})` : undefined}
      >
        <InitialsAvatar
          name={me?.profile?.full_name ?? "…"}
          className="size-9 text-xs shrink-0 cursor-pointer"
        />
        {isDesktop && collapsed && (
          <span className="absolute left-full ml-3 hidden rounded-lg border border-sidebar-border bg-sidebar px-2.5 py-1 text-xs font-semibold text-sidebar-foreground shadow-xl group-hover:block z-50 whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-150">
            {me?.profile?.full_name ?? "User"} ({me?.isAdmin ? "HR Admin" : "Employee"})
          </span>
        )}
        {(!isDesktop || !collapsed) && (
          <>
            <div className="min-w-0 flex-1 animate-in fade-in duration-200">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {me?.profile?.full_name ?? "…"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {me?.isAdmin ? "HR Admin" : (me?.profile?.designation ?? "Employee")}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign out of Dayflow"
              aria-label="Sign out"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 cursor-pointer transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 transition-all duration-300 ease-in-out md:flex shadow-xl",
          collapsed ? "w-20 items-center" : "w-64"
        )}
      >
        {brand(true, true)}
        {nav(undefined, true)}
        {userCard(true)}
      </aside>

      {/* Mobile Top Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sunrise className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold text-foreground">Dayflow</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-72 flex-col gap-6 border-sidebar-border bg-sidebar p-0 py-6 [&>button]:top-5 [&>button]:right-4 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-xl [&>button]:border [&>button]:border-sidebar-border [&>button]:bg-sidebar-accent/50 [&>button]:text-sidebar-foreground/80 [&>button]:hover:bg-sidebar-accent [&>button]:hover:text-sidebar-foreground"
            >
              {brand(false, false)}
              {nav(() => setMobileOpen(false), false)}
              <div className="mt-auto">{userCard(false)}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          collapsed ? "md:pl-20" : "md:pl-64"
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
          {children}
        </div>
      </main>

      {/* Floating AI Chatbot — visible on all authenticated pages */}
      <FloatingChatbot />
    </div>
  );
}
