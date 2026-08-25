import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  IndianRupee,
  Palmtree,
  ShieldCheck,
  Sunrise,
} from "lucide-react";
import heroImage from "@/assets/hero-dayflow.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dayflow — Every workday, perfectly aligned" },
      {
        name: "description",
        content:
          "Dayflow is a human resource management system that brings attendance, time-off approvals, payroll visibility and people operations into one calm workspace.",
      },
      { property: "og:title", content: "Dayflow — Every workday, perfectly aligned" },
      {
        property: "og:description",
        content:
          "Attendance, leave approvals, payroll and people operations — one warm, aligned HR workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Attendance that keeps up",
    copy: "One-tap check-in and check-out, live status for the whole team, and daily or weekly views that stay honest.",
  },
  {
    icon: Palmtree,
    title: "Time off without the chase",
    copy: "Employees apply in seconds with balances up front. HR approves or declines with a comment — records update instantly.",
  },
  {
    icon: IndianRupee,
    title: "Payroll in plain sight",
    copy: "A clear salary structure for every employee — basic, HRA, allowances and deductions — read-only for them, editable by HR.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sunrise className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            Dayflow
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View demo
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8">
        <section className="py-14 text-center md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <Sunrise className="size-3.5 text-primary" />
            Human Resource Management
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[1.05] font-semibold tracking-tight text-foreground md:text-7xl">
            Every workday,{" "}
            <span className="sunrise-text">perfectly aligned.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Dayflow brings your people, their attendance, their time off and
            their pay into one warm, calm workspace — for HR officers and
            employees alike.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-warm transition-transform hover:-translate-y-0.5"
            >
              Open the live demo
              <ArrowRight className="size-4" />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="size-4 text-status-present" />
              Role-based access for HR & employees
            </span>
          </div>
        </section>

        <section className="pb-16">
          <div className="overflow-hidden rounded-3xl border border-border shadow-warm">
            <img
              src={heroImage}
              alt="Illustration of a sunrise over an aligned calendar landscape — the Dayflow brand"
              width={1920}
              height={1088}
              className="h-auto w-full"
            />
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-lift"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.copy}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 pb-20 md:grid-cols-2">
          <div className="rounded-2xl bg-sidebar p-8 text-sidebar-foreground shadow-lift">
            <p className="text-xs font-semibold tracking-widest text-sidebar-primary uppercase">
              For HR & Admins
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold">
              The whole team, at a glance
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-sidebar-foreground/75">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                Live attendance board with present, absent, half-day and leave
                status for everyone
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                A pending-approvals queue for time off, with one-click decisions
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                Salary structures you can update, with headcount analytics
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lift">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              For employees
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              Your day, without the paperwork
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Check in with one tap and see your hours build up through the
                week
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Know your leave balance before you apply — no surprises
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Your profile and salary structure, always visible and always
                yours
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground md:px-8">
          <div className="flex items-center gap-2">
            <Sunrise className="size-4 text-primary" />
            <span className="font-display font-semibold text-foreground">
              Dayflow
            </span>
          </div>
          <p>Every workday, perfectly aligned.</p>
        </div>
      </footer>
    </div>
  );
}
