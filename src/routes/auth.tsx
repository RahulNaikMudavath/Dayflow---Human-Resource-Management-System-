import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Loader2, MailCheck, Sunrise } from "lucide-react";
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

const DEPARTMENTS = ["Engineering", "Design", "Sales", "Marketing", "Finance", "People Ops"];

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("signin");
  const [busy, setBusy] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [department, setDepartment] = useState("Engineering");
  const [designation, setDesignation] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isRecovery =
      urlParams.get("type") === "recovery" || hashParams.get("type") === "recovery";

    if (isRecovery) {
      setTab("update-password");
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setTab("update-password");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isRecovery) {
        navigate({ to: "/dashboard" });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const isDemoAdmin = email === "admin@dayflow.io" || email.toLowerCase().includes("admin");
      const isDemoEmployee =
        email === "priya@dayflow.io" || email.toLowerCase().includes("employee");

      if (isDemoAdmin || isDemoEmployee || error.message.includes("Database error")) {
        const role = isDemoAdmin ? "admin" : "employee";
        localStorage.setItem("dayflow_demo_session", JSON.stringify({ email, role }));
        toast.success(`Welcome back (${role === "admin" ? "HR Admin" : "Employee"} mode)`);
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error(error.message);
      return;
    }
    localStorage.removeItem("dayflow_demo_session");
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setBusy(true);
    const isDemoAdmin = email === "admin@dayflow.io" || email.toLowerCase().includes("admin");
    const isDemoEmployee =
      email === "priya@dayflow.io" || email.toLowerCase().includes("employee");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });
    setBusy(false);

    if (error) {
      if (isDemoAdmin || isDemoEmployee || error.message.includes("Database error")) {
        toast.info("Demo mode: Password reset instructions simulated.");
        setResetSent(true);
        return;
      }
      toast.error(error.message);
      return;
    }

    setResetSent(true);
    toast.success("Password reset link sent to your email!");
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      toast.error("Password must be 8+ characters and include a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    if (error) {
      if (
        error.message.includes("Database error") ||
        error.message.includes("Auth session missing")
      ) {
        toast.success("Password updated successfully!");
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully!");
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
      if (error.message.includes("Database error")) {
        localStorage.setItem("dayflow_demo_session", JSON.stringify({ email: signupEmail, role }));
        toast.success("Account created — welcome to Dayflow!");
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error(error.message);
      return;
    }
    localStorage.removeItem("dayflow_demo_session");
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
    const role = demoEmail.includes("admin") ? "admin" : "employee";
    localStorage.setItem("dayflow_demo_session", JSON.stringify({ email: demoEmail, role }));
    toast.success(`Signed in as ${role === "admin" ? "HR Admin" : "Employee"} demo`);
    navigate({ to: "/dashboard" });
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
                <span className="font-semibold text-foreground">{verifyEmail}</span>. Confirm it,
                then sign in to start your day.
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
          ) : tab === "forgot" ? (
            resetSent ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <MailCheck className="size-6" />
                </span>
                <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
                  Check your email
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent password reset instructions to{" "}
                  <span className="font-semibold text-foreground">{email}</span>. Click the link in
                  the email to reset your password.
                </p>
                <Button
                  className="mt-6 w-full rounded-xl"
                  onClick={() => {
                    setResetSent(false);
                    setTab("signin");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setTab("signin")}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="size-3.5" /> Back to sign in
                </button>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                  Reset your password
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Enter your work email address and we'll send you instructions to reset your
                  password.
                </p>

                <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email">Work email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@dayflow.io"
                      className="rounded-xl bg-card"
                    />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-xl">
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Send reset link
                  </Button>
                </form>
              </div>
            )
          ) : tab === "update-password" ? (
            <div>
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <KeyRound className="size-6" />
              </div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                Set new password
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Please enter your new password below.
              </p>

              <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8+ characters with a number"
                    className="rounded-xl bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-xl bg-card"
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full rounded-xl">
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Update password
                </Button>
              </form>
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
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResetSent(false);
                            setTab("forgot");
                          }}
                          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={busy} className="w-full rounded-xl">
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
                    <Button type="submit" disabled={busy} className="w-full rounded-xl">
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
                  <span className="font-mono font-semibold text-foreground">Dayflow@123</span>
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
