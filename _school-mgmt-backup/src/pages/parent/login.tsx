import { useState } from "react";
import { useLocation } from "wouter";
import { openApi, setToken, setUser } from "@/lib/jwt-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Eye, EyeOff, Loader2, ArrowLeft, Mail, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "login" | "forgot-email" | "forgot-otp" | "done" | "session-ended";

export default function ParentLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast({ title: "Error", description: "Email and password are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await openApi.post<{ token: string; parent: { students?: Array<{ sessionSchema?: string }> } }>("/auth/parent/login", form);
      setToken("parent", data.token);
      setUser("parent", data.parent);
      // Store the student's session schema so parentApi can route requests to
      // the correct academic-year schema (not just the current global session).
      const schema = data.parent?.students?.[0]?.sessionSchema;
      if (schema) localStorage.setItem("parent_session_schema", schema);
      navigate("/parent");
    } catch (err: any) {
      // Show a dedicated screen when the parent's children are not in the current session
      if (err?.message === "SESSION_ENDED") {
        setStep("session-ended");
      } else {
        toast({ title: "Login Failed", description: err.message, variant: "destructive" });
      }
    } finally { setLoading(false); }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!fpEmail.trim()) { toast({ title: "Error", description: "Enter your registered email", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await openApi.post("/auth/parent/forgot-password", { email: fpEmail.trim() });
      toast({ title: "OTP Sent", description: "Check your email for a 6-digit OTP" });
      setStep("forgot-otp");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || !newPassword) {
      toast({ title: "Error", description: "Enter the OTP and a new password", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      await openApi.post("/auth/parent/reset-password", { email: fpEmail.trim(), otp: otp.trim(), newPassword });
      setStep("done");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-400 rounded-2xl mb-4 shadow-lg">
            <Users className="w-8 h-8 text-blue-950" />
          </div>
          <h1 className="text-2xl font-bold text-white">Parent Portal</h1>
          <p className="text-blue-200 mt-1">View your child's academic progress</p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur">

          {/* ── Step: Login ── */}
          {step === "login" && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription>Sign in with your registered email</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="parent@email.com"
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button type="button" onClick={() => { setFpEmail(form.email); setStep("forgot-email"); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input id="password" type={showPass ? "text" : "password"} placeholder="••••••••"
                        value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPass(v => !v)}>
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
                <div className="mt-4 pt-4 border-t text-center">
                  <a href="/" className="text-sm text-slate-500 hover:text-slate-700">← Back to School Portal</a>
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step: Enter email for OTP ── */}
          {step === "forgot-email" && (
            <>
              <CardHeader className="pb-4">
                <button onClick={() => setStep("login")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </button>
                <CardTitle className="text-xl flex items-center gap-2"><Mail className="w-5 h-5 text-blue-500" />Reset Password</CardTitle>
                <CardDescription>Enter your registered email — we'll send you a 6-digit OTP</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" placeholder="parent@email.com" value={fpEmail}
                      onChange={e => setFpEmail(e.target.value)} autoFocus />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send OTP
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Step: Enter OTP + new password ── */}
          {step === "forgot-otp" && (
            <>
              <CardHeader className="pb-4">
                <button onClick={() => setStep("forgot-email")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <CardTitle className="text-xl flex items-center gap-2"><KeyRound className="w-5 h-5 text-blue-500" />Enter OTP</CardTitle>
                <CardDescription>
                  A 6-digit code was sent to <strong>{fpEmail}</strong>. Enter it below along with your new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label>OTP Code</Label>
                    <Input placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      autoFocus inputMode="numeric" maxLength={6}
                      className="text-center text-2xl tracking-[0.4em] font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input type={showNew ? "text" : "password"} placeholder="Min. 6 characters"
                        value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        onClick={() => setShowNew(v => !v)}>
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reset Password
                  </Button>
                  <p className="text-center text-xs text-slate-400">
                    Didn't receive the code?{" "}
                    <button type="button" onClick={() => setStep("forgot-email")} className="text-blue-600 hover:underline">
                      Resend OTP
                    </button>
                  </p>
                </form>
              </CardContent>
            </>
          )}

          {/* ── Step: Success ── */}
          {step === "done" && (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl" />
              </CardHeader>
              <CardContent className="text-center py-6">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">Password Reset!</h2>
                <p className="text-slate-500 text-sm mb-6">Your password has been updated. You can now sign in with your new password.</p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 font-semibold" onClick={() => setStep("login")}>
                  Back to Sign In
                </Button>
              </CardContent>
            </>
          )}

          {/* ── Step: Session Ended ── */}
          {step === "session-ended" && (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl" />
              </CardHeader>
              <CardContent className="text-center py-8 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-5">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">Session Ended</h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Your session has ended and your children are not enrolled in the current academic session.
                  Please contact the school for more information.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-slate-300 text-slate-600 hover:bg-slate-50"
                  onClick={() => setStep("login")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </div>
  );
}
