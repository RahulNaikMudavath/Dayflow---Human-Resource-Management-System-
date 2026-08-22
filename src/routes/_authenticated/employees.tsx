import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert, Users } from "lucide-react";
import { supabase, type Profile } from "@/lib/dayflow";
import { useCurrentUser } from "@/hooks/use-current-user";
import { EmptyState, InitialsAvatar, PageHeader } from "@/components/dayflow/bits";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "People — Dayflow" },
      { name: "description", content: "The whole team, in one directory." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data: me } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");

  const { data: everyone } = useQuery({
    queryKey: ["profiles", "all"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return (data ?? []) as Profile[];
    },
  });

  const departments = useMemo(
    () => [...new Set((everyone ?? []).map((p) => p.department).filter(Boolean))] as string[],
    [everyone],
  );

  const filtered = (everyone ?? []).filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.employee_id.toLowerCase().includes(q) ||
      (p.designation ?? "").toLowerCase().includes(q);
    const matchesDept = dept === "all" || p.department === dept;
    return matchesSearch && matchesDept;
  });

  if (me && !me.isAdmin) {
    return (
      <div>
        <PageHeader title="People" description="The team directory." />
        <EmptyState
          icon={ShieldAlert}
          title="HR access only"
          description="The people directory is available to HR officers and admins. Your own profile lives under My Profile."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="People"
        description={`${(everyone ?? []).length} employees across ${departments.length} departments.`}
      >
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, role…"
            className="w-56 rounded-xl bg-card pl-9"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-44 rounded-xl bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No one matches"
          description="Try a different search or department filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/employees/$employeeId"
              params={{ employeeId: p.id }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-lift transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <InitialsAvatar name={p.full_name} src={p.avatar_url} className="size-12 text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-foreground group-hover:text-primary">
                    {p.full_name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{p.designation ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full bg-accent/60 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  {p.department ?? "Unassigned"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{p.employee_id}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
