import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  supabase,
  formatINR,
  netPay,
  type SalaryStructure,
} from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LogoLoader } from "@/components/common/logo-loader";
import {
  InitialsAvatar,
  PageHeader,
} from "@/components/common/bits";
import { ProfileEditDialog } from "@/components/features/profile/profile-edit-dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Dayflow" },
      { name: "description", content: "Your Dayflow profile and job details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useCurrentUser();

  const { data: salary } = useQuery({
    queryKey: ["payroll", "mine", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("salary_structures")
        .select("*")
        .eq("user_id", me!.id)
        .maybeSingle();
      return (data as SalaryStructure | null) ?? null;
    },
  });

  if (!me) {
    return <LogoLoader label="Loading your profile..." />;
  }

  const profile = me.profile;

  const jobDetails = [
    { icon: Briefcase, label: "Employee ID", value: profile?.employee_id ?? "—" },
    { icon: Briefcase, label: "Department", value: profile?.department ?? "—" },
    { icon: Briefcase, label: "Designation", value: profile?.designation ?? "—" },
    {
      icon: CalendarDays,
      label: "Date of joining",
      value: profile?.date_of_joining
        ? format(new Date(profile.date_of_joining), "dd MMM yyyy")
        : "—",
    },
    {
      icon: Briefcase,
      label: "Role",
      value: me.isAdmin ? "HR / Admin" : "Employee",
    },
  ];

  const contact = [
    { icon: Mail, label: "Email", value: profile?.email ?? me.email },
    { icon: Phone, label: "Phone", value: profile?.phone ?? "—" },
    { icon: MapPin, label: "Address", value: profile?.address ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Your details, as HR sees them."
      >
        {profile && (
          <ProfileEditDialog
            profile={profile}
            canEditAll={me.isAdmin}
            trigger={
              <Button className="rounded-xl">
                <Pencil className="size-4" />
                Edit profile
              </Button>
            }
          />
        )}
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-lift">
        <div className="flex flex-wrap items-center gap-5">
          <InitialsAvatar
            name={profile?.full_name ?? me.email}
            className="size-20 rounded-3xl text-2xl"
          />
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {profile?.full_name ?? "—"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.designation ?? "—"} · {profile?.department ?? "—"}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-accent/60 px-3 py-1 text-xs font-semibold text-accent-foreground">
              {me.isAdmin ? "HR / Admin" : "Employee"} · {profile?.employee_id}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Job details
          </h3>
          <dl className="mt-4 space-y-3.5">
            {jobDetails.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <d.icon className="size-4" />
                </span>
                <div>
                  <dt className="text-xs text-muted-foreground">{d.label}</dt>
                  <dd className="text-sm font-semibold text-foreground">
                    {d.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Contact
          </h3>
          <dl className="mt-4 space-y-3.5">
            {contact.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <d.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{d.label}</dt>
                  <dd className="truncate text-sm font-semibold text-foreground">
                    {d.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            Phone and address are yours to edit. Job details are managed by HR.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-lift">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-sidebar-foreground/60 uppercase">
              <Wallet className="size-3.5 text-sidebar-primary" />
              Net monthly pay
            </div>
            {salary ? (
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {formatINR(netPay(salary))}
              </p>
            ) : (
              <p className="mt-2 text-sm text-sidebar-foreground/70">
                Salary not configured yet.
              </p>
            )}
            <Link
              to="/payroll"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sidebar-primary hover:underline"
            >
              View full breakdown <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Documents
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Offer letters and payslips will live here — a Dayflow roadmap
              item from the hackathon brief.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
