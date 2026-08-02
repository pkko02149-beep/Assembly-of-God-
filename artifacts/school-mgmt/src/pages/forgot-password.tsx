import { useState } from "react";
import { useLocation, Link } from "wouter";
import * as z from "zod";
import { requestOtp, changeCredentials } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Mail, Loader2 } from "lucide-react";

const passwordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<"request" | "verify">("request");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");

  async function handleRequestOtp() {
    setPasswordError("");
    setConfirmError("");

    const result = passwordSchema.safeParse({ password: newPassword, confirmPassword });
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      if (errs.password) setPasswordError(errs.password[0]);
      if (errs.confirmPassword) setConfirmError(errs.confirmPassword[0]);
      return;
    }

    setRequesting(true);
    const res = await requestOtp("forgot-password");
    setRequesting(false);

    if (res.ok) {
      setStep("verify");
      toast({ title: "OTP sent", description: res.message });
    } else {
      toast({ title: "Could not send OTP", description: res.error, variant: "destructive" });
    }
  }

  async function handleVerify() {
    if (!otp || otp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP from your email", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await changeCredentials({
      otp,
      purpose: "forgot-password",
      newPassword,
    });
    setSaving(false);

    if (res.ok) {
      toast({ title: "Password reset", description: "You can now log in with your new password." });
      setLocation("/login");
    } else {
      toast({ title: "Reset failed", description: res.error, variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <KeyRound className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-slate-400 mt-2 text-center">
            {step === "request"
              ? "Enter a new password — an OTP will be sent to the Admin Gmail."
              : "Check your Admin Gmail inbox and enter the OTP."}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {step === "request" ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500 h-12"
                  data-testid="input-new-password"
                />
                {passwordError && (
                  <p className="text-sm text-red-400">{passwordError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500 h-12"
                  data-testid="input-confirm-password"
                />
                {confirmError && (
                  <p className="text-sm text-red-400">{confirmError}</p>
                )}
              </div>
              <Button
                onClick={handleRequestOtp}
                disabled={requesting}
                className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-base"
                data-testid="button-send-otp"
              >
                {requesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send OTP to Admin Gmail
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-green-950/40 border border-green-800 rounded-lg p-3 text-sm text-green-300">
                A 6-digit OTP has been sent to the Admin Gmail inbox. Enter it
                below to confirm the password reset.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Enter OTP
                </label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500 h-12 text-center text-2xl tracking-widest font-mono"
                  data-testid="input-otp"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("request");
                    setOtp("");
                  }}
                  className="flex-1 h-12 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={saving}
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                  data-testid="button-reset-password"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Confirm Reset"
                  )}
                </Button>
              </div>
              <button
                onClick={handleRequestOtp}
                className="w-full text-center text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Didn't receive it? Resend OTP
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-slate-500 hover:text-white transition-colors"
            data-testid="link-back-login"
          >
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
