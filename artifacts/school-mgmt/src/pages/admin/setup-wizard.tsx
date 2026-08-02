import { useState, useEffect } from "react";
import { Shield, School, KeyRound, Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [udiseCode, setUdiseCode] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [newUsername, setNewUsername] = useState("admin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveSchoolInfo = async () => {
    if (!schoolName.trim()) { setError("School name is required"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings/school-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName: schoolName.trim(), udiseCode, address, contactNumber }),
      });
      if (!res.ok) throw new Error("Failed to save school info");
      setStep(2);
    } catch {
      setError("Could not save school info. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveCredentials = async () => {
    if (!newUsername.trim()) { setError("Username is required"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: newUsername.trim(), newPassword }),
      });
      if (!res.ok) throw new Error("Failed to save credentials");
      setStep(3);
    } catch {
      setError("Could not save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">First-Time Setup</h2>
              <p className="text-amber-100 text-xs">Configure your school ERP before you begin</p>
            </div>
          </div>
          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex items-center gap-1.5 ${s < 3 ? "flex-1" : ""}`}>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  step > s ? "bg-white text-amber-600" : step === s ? "bg-white/30 text-white ring-2 ring-white" : "bg-white/10 text-amber-200"
                }`}>
                  {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
                <span className={`text-xs ${step >= s ? "text-white" : "text-amber-200"}`}>
                  {s === 1 ? "School Info" : s === 2 ? "Admin Login" : "Done"}
                </span>
                {s < 3 && <div className={`h-px flex-1 ${step > s ? "bg-white/60" : "bg-white/20"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">School Information</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">School Name <span className="text-red-500">*</span></label>
                  <Input
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="e.g. Sunrise Public School"
                    className="h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">UDISE Code</label>
                    <Input value={udiseCode} onChange={e => setUdiseCode(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Contact Number</label>
                    <Input value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Address</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Optional" className="h-9 text-sm" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              <Button onClick={saveSchoolInfo} disabled={saving || !schoolName.trim()} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold h-10 mt-2">
                {saving ? "Saving…" : <><span>Next: Admin Login</span> <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Set Admin Credentials</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                Replace the default <span className="font-mono font-semibold">admin / admin123</span> with your own secure credentials.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Username <span className="text-red-500">*</span></label>
                  <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="admin" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">New Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Input
                      type={showPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="h-9 text-sm pr-9"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Confirm Password <span className="text-red-500">*</span></label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              <Button onClick={saveCredentials} disabled={saving || !newPassword || !confirmPassword} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold h-10 mt-2">
                {saving ? "Saving…" : <><span>Save & Continue</span> <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Setup Complete!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{schoolName}</span> is ready to use.
                </p>
                <p className="text-xs text-slate-400 mt-1">Your new login credentials have been saved.</p>
              </div>
              <Button onClick={onComplete} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-10 mt-2">
                Enter Admin Panel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
