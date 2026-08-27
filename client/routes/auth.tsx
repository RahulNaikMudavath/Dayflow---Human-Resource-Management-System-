import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MailCheck,
  ShieldCheck,
  Sunrise,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, verifyEmailExists } from "@/lib/dayflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
        content: "Access your Dayflow HR workspace securely.",
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

  // Sign In state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up state
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [department, setDepartment] = useState("Engineering");
  const [designation, setDesignation] = useState("");

  // Forgot password modal state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [signInError, setSignInError] = useState<string | null>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Dynamic password security checks
  const hasMinLength = signupPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(signupPassword);
  const hasLowercase = /[a-z]/.test(signupPassword);
  const hasNumber = /\d/.test(signupPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(signupPassword);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = signupPassword === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSignInError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setSignInError("Please enter a valid work email address.");
      return;
    }
    if (!password) {
      setSignInError("Please enter your password.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setBusy(false);
    if (error) {
      setSignInError(error.message);
      toast.error(error.message);
      return;
    }
    toast.success("Signed in securely. Welcome back!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSignUpError(null);

    const cleanEmail = signupEmail.trim();
    const cleanName = fullName.trim();
    const cleanEmpId = employeeId.trim().toUpperCase();
    const cleanDesignation = designation.trim();

    if (!cleanName) {
      setSignUpError("Full name is required.");
      return;
    }
    if (!cleanEmpId) {
      setSignUpError("Employee ID is required (e.g., DF-009).");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setSignUpError("Please enter a valid work email address.");
      return;
    }
    if (!isPasswordValid) {
      const errorMsg = "Password does not meet all security requirements.";
      setSignUpError(errorMsg);
      toast.error(errorMsg);
      return;
    }
    if (signupPassword !== confirmPassword) {
      const errorMsg = "Passwords do not match. Please verify your entries.";
      setSignUpError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: signupPassword,
      options: {
        data: {
          full_name: cleanName,
          employee_id: cleanEmpId,
          department,
          designation: cleanDesignation || "Team Member",
        },
      },
    });
    setBusy(false);

    if (data.user) {
      try {
        await (supabase.from("notifications").insert as any)({
          user_id: data.user.id,
          title: "Registration Successful",
          message: `Welcome to Dayflow HR, ${cleanName}! A registration confirmation notification has been sent to your email.`,
          type: "system",
        });
      } catch (err) {
        console.warn("Could not insert in-app welcome notification:", err);
      }
    }

    if (data.session) {
      toast.success("Account created! Registration notification email sent to " + cleanEmail);
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Registration successful! Notification email sent to " + cleanEmail);
      setVerifyEmail(cleanEmail);
    }
  }

  async function handlePasswordReset(e: FormEvent) {
    e.preventDefault();
    setResetError(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setResetError("Please enter a valid work email address.");
      toast.error("Please enter a valid work email address.");
      return;
    }

    setResetBusy(true);

    try {
      // Verify if email exists using secure RPC function (prevents querying profiles table as anon)
      const exists = await verifyEmailExists(cleanEmail);

      if (!exists) {
        setResetError("Email Not Registered");
        toast.error("Email Not Registered");
        setResetBusy(false);
        return;
      }

      // Send password reset link
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setResetBusy(false);

      if (error) {
        setResetError("Email Not Registered");
        toast.error("Email Not Registered");
      } else {
        setResetSuccess(true);
        toast.success("Password reset link sent to your registered email!");
      }
    } catch {
      setResetBusy(false);
      setResetError("Email Not Registered");
      toast.error("Email Not Registered");
    }
  }

  async function fillDemo(demoEmail: string) {
    setTab("signin");
    setEmail(demoEmail);
    setPassword("Dayflow@123");
    setSignInError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: "Dayflow@123",
    });
    setBusy(false);
    if (error) {
      setSignInError(error.message);
      toast.error(error.message);
      return;
    }
    toast.success(
      `Signed in as ${demoEmail.includes("admin") ? "HR Admin" : "Employee"} demo!`,
    );
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 md:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sunrise className="size-5" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">
              Dayflow
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-status-present" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          {verifyEmail ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lift space-y-4">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <MailCheck className="size-7 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Registration Notification Sent!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We have sent a registration confirmation and activation email to{" "}
                  <span className="font-semibold text-foreground underline decoration-primary/40 underline-offset-4">
                    {verifyEmail}
                  </span>
                  . Please check your inbox and click the verification link to activate your account.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <Button
                  className="w-full rounded-xl"
                  onClick={() => {
                    setVerifyEmail(null);
                    setTab("signin");
                    setEmail(verifyEmail);
                  }}
                >
                  Proceed to Sign In
                </Button>
                <Button
                  variant="outline"
                  disabled={resending}
                  className="w-full rounded-xl"
                  onClick={async () => {
                    setResending(true);
                    try {
                      await supabase.auth.resend({ type: "signup", email: verifyEmail });
                      toast.success("Registration notification email resent to " + verifyEmail);
                    } catch {
                      toast.error("Failed to resend notification email. Please try again.");
                    } finally {
                      setResending(false);
                    }
                  }}
                >
                  {resending ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Resending Email...
                    </>
                  ) : (
                    "Resend Notification Email"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                {tab === "signin" ? "Good to see you." : "Join the flow."}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {tab === "signin"
                  ? "Sign in securely to your Dayflow HR workspace."
                  : "Create your verified employee account."}
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

                {/* SIGN IN TAB */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                    {signInError && (
                      <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5 text-destructive">
                        <AlertCircle className="size-4 text-destructive" />
                        <AlertTitle>Authentication Failed</AlertTitle>
                        <AlertDescription>{signInError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work Email</Label>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmail(email);
                            setResetSuccess(false);
                            setResetDialogOpen(true);
                          }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showSignInPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="rounded-xl bg-card pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl font-medium"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Authenticating...
                        </>
                      ) : (
                        <>
                          <Lock className="size-4 mr-2" />
                          Sign in securely
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* SIGN UP TAB */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                    {signUpError && (
                      <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5 text-destructive">
                        <AlertCircle className="size-4 text-destructive" />
                        <AlertTitle>Registration Error</AlertTitle>
                        <AlertDescription>{signUpError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName">Full Name</Label>
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
                          onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                          placeholder="DF-009"
                          className="rounded-xl bg-card uppercase"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signupEmail">Work Email</Label>
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

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signupPassword">Password</Label>
                      <div className="relative">
                        <Input
                          id="signupPassword"
                          type={showSignUpPassword ? "text" : "password"}
                          required
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="Choose a strong password"
                          className="rounded-xl bg-card pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>

                      {/* Password Requirements Checklist */}
                      <div className="mt-2 rounded-xl border border-border bg-muted/20 p-3 space-y-1.5 text-[11px] leading-none">
                        <p className="font-semibold text-muted-foreground mb-2 text-xs">Security Policy Requirements:</p>
                        <div className="flex items-center gap-2">
                          <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${hasMinLength ? "bg-status-present/20 text-status-present" : "bg-secondary text-muted-foreground"}`}>
                            ✓
                          </span>
                          <span className={hasMinLength ? "text-foreground font-medium" : "text-muted-foreground"}>8+ characters long</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${hasUppercase ? "bg-status-present/20 text-status-present" : "bg-secondary text-muted-foreground"}`}>
                            ✓
                          </span>
                          <span className={hasUppercase ? "text-foreground font-medium" : "text-muted-foreground"}>At least one uppercase letter (A-Z)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${hasLowercase ? "bg-status-present/20 text-status-present" : "bg-secondary text-muted-foreground"}`}>
                            ✓
                          </span>
                          <span className={hasLowercase ? "text-foreground font-medium" : "text-muted-foreground"}>At least one lowercase letter (a-z)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${hasNumber ? "bg-status-present/20 text-status-present" : "bg-secondary text-muted-foreground"}`}>
                            ✓
                          </span>
                          <span className={hasNumber ? "text-foreground font-medium" : "text-muted-foreground"}>At least one number (0-9)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${hasSpecial ? "bg-status-present/20 text-status-present" : "bg-secondary text-muted-foreground"}`}>
                            ✓
                          </span>
                          <span className={hasSpecial ? "text-foreground font-medium" : "text-muted-foreground"}>At least one special character (!@#$%^&*)</span>
                        </div>
                      </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        {confirmPassword.length > 0 && (
                          <span className={`text-[11px] font-medium ${passwordsMatch ? "text-status-present flex items-center gap-1" : "text-destructive"}`}>
                            {passwordsMatch ? (
                              <>
                                <CheckCircle2 className="size-3" /> Passwords match
                              </>
                            ) : (
                              "Passwords do not match"
                            )}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className={`rounded-xl bg-card pr-10 ${
                            confirmPassword.length > 0
                              ? passwordsMatch
                                ? "border-status-present/50 focus-visible:ring-status-present"
                                : "border-destructive/50 focus-visible:ring-destructive"
                              : ""
                          }`}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
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
                          placeholder="Software Engineer"
                          className="rounded-xl bg-card"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={busy || !isPasswordValid || !passwordsMatch}
                      className="w-full rounded-xl font-medium"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <KeyRound className="size-4 mr-2" />
                          Create Verified Account
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* DEMO ACCOUNTS HELPER */}
              <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-4">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Quick Demo Sign-In
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Default Demo Password:{" "}
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
                    HR Admin Demo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => fillDemo("priya@dayflow.io")}
                  >
                    Employee Demo
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
          alt="Sunrise over rolling hills — Dayflow brand illustration"
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
            Secure attendance, time off and payroll — protected with Supabase Auth & RLS policies.
          </p>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border bg-card p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              Reset your password
            </DialogTitle>
            <DialogDescription>
              Enter your work email address below and we'll send you a password reset link.
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <div className="py-4 text-center space-y-3">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <CheckCircle2 className="size-6 text-status-present" />
              </span>
              <p className="text-sm text-foreground font-medium">Reset link sent!</p>
              <p className="text-xs text-muted-foreground">
                Check your inbox for further instructions to reset your password.
              </p>
              <Button
                variant="outline"
                className="w-full rounded-xl mt-2"
                onClick={() => setResetDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4 pt-2">
              {resetError && (
                <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5 text-destructive py-2.5 px-3.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-destructive shrink-0" />
                    <span className="font-semibold text-sm">Email Not Registered</span>
                  </div>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Work Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  placeholder="you@dayflow.io"
                  className="rounded-xl bg-card"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => setResetDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetBusy}
                  className="rounded-xl"
                >
                  {resetBusy ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Verifying Email...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

