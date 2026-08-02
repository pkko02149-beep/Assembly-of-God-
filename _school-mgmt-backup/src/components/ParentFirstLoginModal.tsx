import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parentApi, setUser, getUser } from "@/lib/jwt-api";

interface Props {
  open: boolean;
  onDone: () => void;
}

export default function ParentFirstLoginModal({ open, onDone }: Props) {
  const { toast } = useToast();

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const user = getUser<{ name?: string; fatherName?: string; motherName?: string }>("parent");
  const displayName = user?.fatherName || user?.motherName || user?.name || "Parent";

  const passwordsMatch = confirmPass === "" || newPass === confirmPass;
  const canSubmit = newPass.length >= 6 && confirmPass.length >= 6 && newPass === confirmPass;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      await parentApi.post("/auth/parent/set-first-password", { newPassword: newPass });

      // Clear the flag in localStorage so the modal won't reappear
      const stored = getUser<Record<string, unknown>>("parent");
      if (stored) setUser("parent", { ...stored, mustChangePassword: false });

      setDone(true);
      setTimeout(onDone, 1400);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Dialog open={open}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Password Set!</h2>
            <p className="text-slate-500 text-sm text-center">Your new password is saved. Welcome to the Parent Portal!</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Set Your Password</DialogTitle>
              <DialogDescription className="text-xs">
                Welcome, {displayName}! Please create a password before you continue.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="first-new-pass">New Password</Label>
            <div className="relative">
              <Input
                id="first-new-pass"
                type={showNew ? "text" : "password"}
                placeholder="At least 6 characters"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPass.length > 0 && newPass.length < 6 && (
              <p className="text-xs text-amber-600">Password must be at least 6 characters</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="first-confirm-pass">Confirm Password</Label>
            <div className="relative">
              <Input
                id="first-confirm-pass"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your new password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!passwordsMatch && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            disabled={!canSubmit || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Password & Continue
          </Button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-1">
          You must set a password to access the Parent Portal.
        </p>
      </DialogContent>
    </Dialog>
  );
}
