import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Palmtree,
  Sparkles,
  Sunrise,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { InitialsAvatar } from "@/components/dayflow/bits";
import { NotificationBell } from "@/components/dayflow/notification-bell";
import { FloatingChatbot } from "@/components/dayflow/floating-chatbot";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
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

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || me?.isAdmin);

  async function signOut() {
    localStorage.removeItem("dayflow_demo_session");
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  }

  const brand = (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <Sunrise className="size-5" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-sidebar-foreground">
        Dayflow
      </span>
    </Link>
  );

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          item.to === "/dashboard" ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            {active ? <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" /> : null}
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="px-3">
      <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
        <InitialsAvatar
          name={me?.profile?.full_name ?? "…"}
          src={me?.profile?.avatar_url}
          className="size-9 text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {me?.profile?.full_name ?? "…"}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/50">
            {me?.isAdmin ? "HR Admin" : (me?.profile?.designation ?? "Employee")}
          </p>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 md:flex">
        <div className="flex items-center justify-between pr-4">
          {brand}
          <NotificationBell dark />
        </div>
        {nav()}
        {userCard}
      </aside>

      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sunrise className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold text-foreground">Dayflow</span>
        </Link>
        <div className="flex items-center gap-2">
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
              className="flex w-72 flex-col gap-6 border-sidebar-border bg-sidebar p-0 py-6 [&>button]:text-sidebar-foreground"
            >
              {brand}
              {nav(() => setMobileOpen(false))}
              <div className="mt-auto">{userCard}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">{children}</div>
      </main>

      {/* Floating AI Chatbot — visible on all authenticated pages */}
      <FloatingChatbot />
    </div>
  );
}
