import { useState } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, KeyRound, Mail, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { teacherApi, getUser, setUser } from "@/lib/jwt-api";

export default function TeacherChangePassword() {
  const { toast } = useToast();
  const user = getUser<{ email?: string; name?: string }>(  "teacher");

  // Old-password method
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loadingOld, setLoadingOld] = useState(false);
  const [oldDone, setOldDone] = useState(false);

  // OTP method
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpNewPass, setOtpNewPass] = useState("");
  const [otpConfirmPass, setOtpConfirmPass] = useState("");
  const [showOtpNew, setShowOtpNew] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [otpDone, setOtpDone] = useState(false);

  function clearMustChangeFlag() {
    const stored = getUser<Record<string, unknown>>("teacher");
    if (stored) setUser("teacher", { ...stored, mustChangePassword: false });
  }

  async function handleOldPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmPass) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" }); return;
    }
    if (newPass.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" }); return;
    }
    if (newPass !== confirmPass) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" }); return;
    }
    setLoadingOld(true);
    try {
      await teacherApi.post("/auth/teacher/change-password", { oldPassword: oldPass, newPassword: newPass });
      toast({ title: "Password changed!", description: "Your password has been updated successfully." });
      clearMustChangeFlag();
      setOldDone(true);
      setOldPass(""); setNewPass(""); setConfirmPass("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoadingOld(false); }
  }

  async function handleSendOtp() {
    setLoadingOtp(true);
    try {
      await teacherApi.post("/auth/teacher/send-change-otp", {});
      setOtpSent(true);
      toast({ title: "OTP sent!", description: `Check ${user?.email || "your email"} for the 6-digit OTP.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoadingOtp(false); }
  }

  async function handleOtpChange(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || !otpNewPass || !otpConfirmPass) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" }); return;
    }
    if (otpNewPass.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" }); return;
    }
    if (otpNewPass !== otpConfirmPass) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" }); return;
    }
    setLoadingOtp(true);
    try {
      await teacherApi.post("/auth/teacher/change-password-otp", { otp: otp.trim(), newPassword: otpNewPass });
      toast({ title: "Password changed!", description: "Your password has been updated successfully." });
      clearMustChangeFlag();
      setOtpDone(true);
      setOtp(""); setOtpNewPass(""); setOtpConfirmPass(""); setOtpSent(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoadingOtp(false); }
  }

  return (
    <TeacherLayout title="Change Password">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Change Password</h1>
            <p className="text-sm text-slate-500">Update your portal password securely</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              Signed in as <strong>{user?.email || "—"}</strong>. Choose a method to change your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="old-password">
              <TabsList className="grid w-full grid-cols-2 mb-5">
                <TabsTrigger value="old-password" className="gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Old Password
                </TabsTrigger>
                <TabsTrigger value="otp" className="gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Gmail OTP
                </TabsTrigger>
              </TabsList>

              {/* Method 1 */}
              <TabsContent value="old-password">
                {oldDone ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-amber-600" />
                    </div>
                    <p className="font-semibold text-slate-800">Password updated!</p>
                    <p className="text-sm text-slate-500 text-center">Your password has been changed. Use the new password on your next login.</p>
                    <Button variant="outline" size="sm" onClick={() => setOldDone(false)}>Change again</Button>
                  </div>
                ) : (
                  <form onSubmit={handleOldPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="old-pass">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="old-pass"
                          type={showOld ? "text" : "password"}
                          placeholder="Your current password"
                          value={oldPass}
                          onChange={e => setOldPass(e.target.value)}
                          className="pr-10"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowOld(v => !v)}>
                          {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-pass">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-pass"
                          type={showNew ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          className="pr-10"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowNew(v => !v)}>
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-pass">Confirm New Password</Label>
                      <Input
                        id="confirm-pass"
                        type="password"
                        placeholder="Repeat new password"
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                      />
                      {confirmPass && newPass !== confirmPass && (
                        <p className="text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loadingOld}>
                      {loadingOld && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Update Password
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* Method 2 */}
              <TabsContent value="otp">
                {otpDone ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-amber-600" />
                    </div>
                    <p className="font-semibold text-slate-800">Password updated!</p>
                    <p className="text-sm text-slate-500 text-center">Your password has been changed via OTP.</p>
                    <Button variant="outline" size="sm" onClick={() => setOtpDone(false)}>Change again</Button>
                  </div>
                ) : !otpSent ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      A 6-digit OTP will be sent to your registered email: <strong>{user?.email || "your email"}</strong>
                    </div>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900" onClick={handleSendOtp} disabled={loadingOtp}>
                      {loadingOtp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                      Send OTP to My Email
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleOtpChange} className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      OTP sent to <strong>{user?.email}</strong>. Valid for 10 minutes.
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="otp-code">6-Digit OTP</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="tracking-widest text-center text-xl font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="otp-new">New Password</Label>
                      <div className="relative">
                        <Input
                          id="otp-new"
                          type={showOtpNew ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={otpNewPass}
                          onChange={e => setOtpNewPass(e.target.value)}
                          className="pr-10"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowOtpNew(v => !v)}>
                          {showOtpNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="otp-confirm">Confirm New Password</Label>
                      <Input
                        id="otp-confirm"
                        type="password"
                        placeholder="Repeat new password"
                        value={otpConfirmPass}
                        onChange={e => setOtpConfirmPass(e.target.value)}
                      />
                      {otpConfirmPass && otpNewPass !== otpConfirmPass && (
                        <p className="text-xs text-red-500">Passwords do not match</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => { setOtpSent(false); setOtp(""); }} disabled={loadingOtp}>
                        Resend OTP
                      </Button>
                      <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loadingOtp}>
                        {loadingOtp && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Change Password
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
}
