import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, KeyRound, Mail, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { teacherApi, parentApi, setUser, getUser } from "@/lib/jwt-api";

interface Props {
  role: "teacher" | "parent";
  open: boolean;
  onDone: () => void;
}

export default function ForceChangePasswordModal({ role, open, onDone }: Props) {
  const { toast } = useToast();
  const api = role === "teacher" ? teacherApi : parentApi;

  // Old-password tab
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loadingOld, setLoadingOld] = useState(false);

  // OTP tab
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpNewPass, setOtpNewPass] = useState("");
  const [otpConfirmPass, setOtpConfirmPass] = useState("");
  const [showOtpNew, setShowOtpNew] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);

  const [done, setDone] = useState(false);

  const user = getUser<{ email?: string; name?: string }>(role);

  function markDone() {
    // Update mustChangePassword flag in localStorage so the modal won't show again
    const stored = getUser<Record<string, unknown>>(role);
    if (stored) {
      setUser(role, { ...stored, mustChangePassword: false });
    }
    setDone(true);
    setTimeout(onDone, 1200);
  }

  async function handleOldPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmPass) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" }); return;
    }
    if (newPass.length < 6) {
      toast({ title: "Too short", description: "New password must be at least 6 characters.", variant: "destructive" }); return;
    }
    if (newPass !== confirmPass) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" }); return;
    }
    setLoadingOld(true);
    try {
      await api.post(`/auth/${role}/change-password`, { oldPassword: oldPass, newPassword: newPass });
      toast({ title: "Password changed!", description: "Your password has been updated." });
      markDone();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoadingOld(false); }
  }

  async function handleSendOtp() {
    setLoadingOtp(true);
    try {
      await api.post(`/auth/${role}/send-change-otp`, {});
      setOtpSent(true);
      toast({ title: "OTP sent!", description: `A 6-digit OTP was sent to ${user?.email || "your registered email"}.` });
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
      toast({ title: "Too short", description: "New password must be at least 6 characters.", variant: "destructive" }); return;
    }
    if (otpNewPass !== otpConfirmPass) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" }); return;
    }
    setLoadingOtp(true);
    try {
      await api.post(`/auth/${role}/change-password-otp`, { otp: otp.trim(), newPassword: otpNewPass });
      toast({ title: "Password changed!", description: "Your password has been updated." });
      markDone();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoadingOtp(false); }
  }

  const accent = role === "teacher" ? "amber" : "blue";
  const accentClass = role === "teacher"
    ? "bg-amber-500 hover:bg-amber-600 text-slate-900"
    : "bg-blue-600 hover:bg-blue-700 text-white";

  if (done) {
    return (
      <Dialog open={open}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center py-8 gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${role === "teacher" ? "bg-amber-100" : "bg-blue-100"}`}>
              <CheckCircle2 className={`w-9 h-9 ${role === "teacher" ? "text-amber-600" : "text-blue-600"}`} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Password Updated!</h2>
            <p className="text-slate-500 text-sm text-center">Your new password is set. Welcome!</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${role === "teacher" ? "bg-amber-100" : "bg-blue-100"}`}>
              <ShieldCheck className={`w-5 h-5 ${role === "teacher" ? "text-amber-600" : "text-blue-600"}`} />
            </div>
            <div>
              <DialogTitle className="text-lg">Set Your Password</DialogTitle>
              <DialogDescription className="text-xs">
                Welcome, {user?.name || ""}! Please change your password before continuing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="old-password" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="old-password" className="gap-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Old Password
            </TabsTrigger>
            <TabsTrigger value="otp" className="gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Gmail OTP
            </TabsTrigger>
          </TabsList>

          {/* Method 1: Old password */}
          <TabsContent value="old-password" className="mt-4">
            <form onSubmit={handleOldPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fp-old">Current Password</Label>
                <div className="relative">
                  <Input
                    id="fp-old"
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
                <Label htmlFor="fp-new">New Password</Label>
                <div className="relative">
                  <Input
                    id="fp-new"
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
                <Label htmlFor="fp-confirm">Confirm New Password</Label>
                <Input
                  id="fp-confirm"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                />
                {confirmPass && newPass !== confirmPass && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <Button type="submit" className={`w-full ${accentClass}`} disabled={loadingOld}>
                {loadingOld ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Change Password
              </Button>
            </form>
          </TabsContent>

          {/* Method 2: OTP */}
          <TabsContent value="otp" className="mt-4">
            {!otpSent ? (
              <div className="space-y-4">
                <div className={`rounded-lg p-3 text-sm ${role === "teacher" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
                  An OTP will be sent to your registered email: <strong>{user?.email || "your email"}</strong>
                </div>
                <Button className={`w-full ${accentClass}`} onClick={handleSendOtp} disabled={loadingOtp}>
                  {loadingOtp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send OTP to My Email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleOtpChange} className="space-y-4">
                <div className={`rounded-lg p-3 text-sm ${role === "teacher" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
                  OTP sent to <strong>{user?.email}</strong>. Check your inbox.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modal-otp">6-Digit OTP</Label>
                  <Input
                    id="modal-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="tracking-widest text-center text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modal-otp-new">New Password</Label>
                  <div className="relative">
                    <Input
                      id="modal-otp-new"
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
                  <Label htmlFor="modal-otp-confirm">Confirm New Password</Label>
                  <Input
                    id="modal-otp-confirm"
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
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setOtpSent(false)}>
                    Resend OTP
                  </Button>
                  <Button type="submit" className={`flex-1 ${accentClass}`} disabled={loadingOtp}>
                    {loadingOtp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Change Password
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-slate-400 text-center mt-2">
          You must change your password to continue using the portal.
        </p>
      </DialogContent>
    </Dialog>
  );
}
