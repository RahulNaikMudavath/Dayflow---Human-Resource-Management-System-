import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MailCheck, Sunrise } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/dayflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import authSideImage from "@/assets/auth-side.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Dayflow" },
      {
        name: "description",
        content:
          "Sign in or create your Dayflow account to manage attendance, time off and payroll.",
      },
      { property: "og:title", content: "Sign in — Dayflow" },
      {
        property: "og:description",
        content: "Access your Dayflow HR workspace.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Sales",
  "Marketing",
  "Finance",
  "People Ops",
];

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [department, setDepartment] = useState("Engineering");
  const [designation, setDesignation] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (signupPassword.length < 8 || !/\d/.test(signupPassword)) {
      toast.error("Password must be 8+ characters and include a number.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: fullName,
          employee_id: employeeId,
          role,
          department,
          designation,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created — welcome to Dayflow!");
      navigate({ to: "/dashboard" });
    } else {
      setVerifyEmail(signupEmail);
    }
  }

  function fillDemo(demoEmail: string) {
    setTab("signin");
    setEmail(demoEmail);
    setPassword("Dayflow@123");
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sunrise className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            Dayflow
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {verifyEmail ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <MailCheck className="size-6" />
              </span>
              <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
                Verify your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a verification link to{" "}
                <span className="font-semibold text-foreground">
                  {verifyEmail}
                </span>
                . Confirm it, then sign in to start your day.
              </p>
              <Button
                className="mt-6 w-full rounded-xl"
                onClick={() => {
                  setVerifyEmail(null);
                  setTab("signin");
                  setEmail(verifyEmail);
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                {tab === "signin" ? "Good to see you." : "Join the flow."}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {tab === "signin"
                  ? "Sign in to your Dayflow workspace."
                  : "Create your account with your employee ID."}
              </p>

              <Tabs value={tab} onValueChange={setTab} className="mt-6">
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-secondary">
                  <TabsTrigger value="signin" className="rounded-lg">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg">
                    Sign up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@dayflow.io"
                        className="rounded-xl bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-xl bg-card"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl"
                    >
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      Sign in
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input
                          id="fullName"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Priya Sharma"
                          className="rounded-xl bg-card"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                          id="employeeId"
                          required
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                          placeholder="DF-010"
                          className="rounded-xl bg-card"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupEmail">Work email</Label>
                      <Input
                        id="signupEmail"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@dayflow.io"
                        className="rounded-xl bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signupPassword">Password</Label>
                      <Input
                        id="signupPassword"
                        type="password"
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="8+ characters with a number"
                        className="rounded-xl bg-card"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Department</Label>
                        <Select value={department} onValueChange={setDepartment}>
                          <SelectTrigger className="rounded-xl bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="designation">Designation</Label>
                        <Input
                          id="designation"
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          placeholder="Engineer"
                          className="rounded-xl bg-card"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>I am joining as</Label>
                      <RadioGroup
                        value={role}
                        onValueChange={(v) => setRole(v as "employee" | "admin")}
                        className="grid grid-cols-2 gap-3"
                      >
                        <Label
                          htmlFor="role-employee"
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent/50"
                        >
                          <RadioGroupItem value="employee" id="role-employee" />
                          Employee
                        </Label>
                        <Label
                          htmlFor="role-admin"
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent/50"
                        >
                          <RadioGroupItem value="admin" id="role-admin" />
                          HR / Admin
                        </Label>
                      </RadioGroup>
                    </div>
                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl"
                    >
                      {busy && <Loader2 className="size-4 animate-spin" />}
                      Create account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Demo accounts
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Password for both:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    Dayflow@123
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => fillDemo("admin@dayflow.io")}
                  >
                    HR Admin demo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => fillDemo("priya@dayflow.io")}
                  >
                    Employee demo
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={authSideImage}
          alt="Sunrise over rolling hills — the Dayflow brand illustration"
          width={1024}
          height={1408}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar/80 via-transparent to-transparent" />
        <div className="absolute right-10 bottom-10 left-10">
          <p className="font-display text-3xl leading-snug font-semibold text-sidebar-foreground">
            "Every workday, perfectly aligned."
          </p>
          <p className="mt-2 text-sm text-sidebar-foreground/70">
            Attendance, time off and payroll — in one calm place.
          </p>
        </div>
      </div>
    </div>
  );
}
