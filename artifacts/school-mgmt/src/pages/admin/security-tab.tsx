import { useState, useEffect } from "react";
import { requestOtp, changeCredentials, getAdminToken } from "@/lib/auth";
import StaffUsersSection from "./staff-users-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  KeyRound,
  ClipboardList,
  RefreshCw,
  LogIn,
  UserPlus,
  UserCog,
  UserMinus,
  KeySquare,
  ShieldCheck,
} from "lucide-react";

interface AuditLog {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  description: string;
  entityType: string;
  entityId: number | null;
  metadata: string;
  createdAt: string;
}

const API_BASE = "/api";

export default function SecurityTab() {
  const { toast } = useToast();

  // Gmail for Notifications (SMTP sender)
  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailSaving, setGmailSaving] = useState(false);
  const [gmailTesting, setGmailTesting] = useState(false);

  // Admin Gmail (OTP inbox)
  const [adminGmail, setAdminGmail] = useState("");
  const [adminGmailConfigured, setAdminGmailConfigured] = useState(false);
  const [adminGmailLoading, setAdminGmailLoading] = useState(true);
  const [adminGmailSaving, setAdminGmailSaving] = useState(false);

  // Change Credentials
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [credOtp, setCredOtp] = useState("");
  const [credStep, setCredStep] = useState<"idle" | "verify">("idle");
  const [credRequesting, setCredRequesting] = useState(false);
  const [credSaving, setCredSaving] = useState(false);

  // Audit Log
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState("all");

  useEffect(() => {
    fetchGmailSettings();
    fetchAdminGmail();
    fetchAuditLogs();
  }, []);

  async function fetchAuditLogs() {
    setAuditLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/audit-logs?limit=200`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  }

  async function fetchGmailSettings() {
    setGmailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/gmail`);
      if (res.ok) {
        const data = await res.json();
        setGmailUser(data.gmailUser || "");
        setGmailAppPassword(data.gmailAppPassword || "");
        setGmailConfigured(data.configured || false);
      }
    } catch {
      // ignore
    } finally {
      setGmailLoading(false);
    }
  }

  async function fetchAdminGmail() {
    setAdminGmailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings/admin-gmail`);
      if (res.ok) {
        const data = await res.json();
        setAdminGmail(data.adminGmail || "");
        setAdminGmailConfigured(data.configured || false);
      }
    } catch {
      // ignore
    } finally {
      setAdminGmailLoading(false);
    }
  }

  async function handleSaveGmail() {
    if (!gmailUser.trim()) {
      toast({ title: "Gmail address is required", variant: "destructive" });
      return;
    }
    if (!gmailAppPassword.trim() || gmailAppPassword === "********") {
      toast({ title: "App Password is required", variant: "destructive" });
      return;
    }
    setGmailSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings/gmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailUser: gmailUser.trim(),
          gmailAppPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setGmailConfigured(true);
        setGmailAppPassword("********");
        toast({
          title: data.verified ? "Gmail saved and verified" : "Gmail saved",
          description: data.message,
          variant: data.verified ? "default" : "destructive",
        });
      } else {
        toast({
          title: "Failed to save Gmail settings",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGmailSaving(false);
    }
  }

  async function handleTestEmail() {
    setGmailTesting(true);
    try {
      const res = await fetch(`${API_BASE}/settings/gmail/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Test email sent", description: data.message });
      } else {
        toast({
          title: "Test email failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGmailTesting(false);
    }
  }

  async function handleSaveAdminGmail() {
    if (!adminGmail.trim()) {
      toast({ title: "Admin Gmail address is required", variant: "destructive" });
      return;
    }
    setAdminGmailSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings/admin-gmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminGmail: adminGmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAdminGmailConfigured(true);
        toast({ title: "Admin Gmail saved" });
      } else {
        toast({
          title: "Failed to save Admin Gmail",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAdminGmailSaving(false);
    }
  }

  async function handleRequestCredOtp() {
    if (!newPassword) {
      toast({
        title: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }
    setCredRequesting(true);
    const result = await requestOtp("change-credentials");
    setCredRequesting(false);
    if (result.ok) {
      setCredStep("verify");
      toast({ title: "OTP sent", description: result.message });
    } else {
      toast({
        title: "Failed to send OTP",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  async function handleVerifyCredOtp() {
    if (!credOtp || credOtp.length !== 6) {
      toast({ title: "Enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    setCredSaving(true);
    const result = await changeCredentials({
      otp: credOtp,
      purpose: "change-credentials",
      newUsername: newUsername || undefined,
      newPassword,
    });
    setCredSaving(false);
    if (result.ok) {
      setCredStep("idle");
      setNewUsername("");
      setNewPassword("");
      setCredOtp("");
      toast({ title: "Credentials updated", description: result.message });
    } else {
      toast({
        title: "Failed to update credentials",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  return (
    <>
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Gmail for Notifications (SMTP sender) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                Gmail for Notifications
              </h3>
              {!gmailLoading &&
                (gmailConfigured ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <AlertCircle className="h-3 w-3" /> Not configured
                  </span>
                ))}
            </div>
            <p className="text-sm text-slate-500">
              Gmail address and App Password used to send attendance emails and
              OTPs.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {gmailLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">How to get a Gmail App Password:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>
                    Go to Google Account → Security → 2-Step Verification (must
                    be ON)
                  </li>
                  <li>
                    Scroll to "App passwords" and create one for "Mail"
                  </li>
                  <li>Copy the 16-character password and paste it below</li>
                </ol>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gmail Address</label>
                <Input
                  type="email"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="youraddress@gmail.com"
                  className="max-w-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">App Password</label>
                <Input
                  type="password"
                  value={gmailAppPassword}
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="max-w-sm font-mono"
                />
                <p className="text-xs text-slate-500">
                  16-character App Password (not your regular Gmail password).
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleSaveGmail}
                  disabled={gmailSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {gmailSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Gmail Settings"
                  )}
                </Button>
                {gmailConfigured && (
                  <Button
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={gmailTesting}
                  >
                    {gmailTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin Gmail (OTP inbox) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                Admin Gmail
              </h3>
              {!adminGmailLoading &&
                (adminGmailConfigured ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <AlertCircle className="h-3 w-3" /> Not configured
                  </span>
                ))}
            </div>
            <p className="text-sm text-slate-500">
              The Gmail inbox that receives OTPs for password changes and
              forgot-password requests.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {adminGmailLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                <p>
                  When anyone requests to change or reset the admin password, a
                  6-digit OTP is sent to this inbox. Enter the OTP in the app
                  to confirm the action.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Gmail Address</label>
                <Input
                  type="email"
                  value={adminGmail}
                  onChange={(e) => setAdminGmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="max-w-sm"
                />
              </div>
              <Button
                onClick={handleSaveAdminGmail}
                disabled={adminGmailSaving}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                {adminGmailSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Admin Gmail"
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Change Credentials */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
              Change Credentials
            </h3>
            <p className="text-sm text-slate-500">
              Update admin username and password. An OTP will be sent to the
              Admin Gmail inbox.
            </p>
          </div>
        </div>
        <div className="p-6">
          {credStep === "idle" ? (
            <div className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  New Username{" "}
                  <span className="text-slate-400 font-normal">
                    (leave blank to keep current)
                  </span>
                </label>
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                  data-testid="input-new-username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  data-testid="input-new-password"
                />
              </div>
              <Button
                onClick={handleRequestCredOtp}
                disabled={credRequesting}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
                data-testid="btn-request-otp"
              >
                {credRequesting ? (
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
            <div className="space-y-4 max-w-sm">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                OTP sent to your Admin Gmail inbox. Check your email and enter
                the 6-digit code below.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enter 6-digit OTP
                </label>
                <Input
                  value={credOtp}
                  onChange={(e) => setCredOtp(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-otp"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCredStep("idle");
                    setCredOtp("");
                  }}
                  className="flex-1"
                  data-testid="btn-cancel-otp"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyCredOtp}
                  disabled={credSaving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                  data-testid="btn-verify-otp"
                >
                  {credSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Verify & Save"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Audit Log</h3>
              <p className="text-sm text-slate-500">Track who changed what and when — logins, credentials, staff modifications.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={auditLoading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${auditLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filter bar */}
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "login", label: "Logins" },
            { key: "credentials", label: "Credentials" },
            { key: "staff", label: "Staff Users" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setAuditFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                auditFilter === f.key
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="p-6 pt-3">
          {auditLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading audit log…
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No audit events recorded yet. Events will appear here after logins and admin actions.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {auditLogs
                .filter((log) => {
                  if (auditFilter === "all") return true;
                  if (auditFilter === "login") return log.action.includes("login");
                  if (auditFilter === "credentials") return log.action.includes("credential") || log.action.includes("otp");
                  if (auditFilter === "staff") return log.action.includes("staff_user");
                  return true;
                })
                .map((log) => {
                  const isLoginOk = log.action === "admin_login" || log.action === "staff_login";
                  const isLoginFail = log.action.includes("failed");
                  const isCreate = log.action.includes("created");
                  const isDelete = log.action.includes("deleted");
                  const isUpdate = log.action.includes("updated") || log.action.includes("changed");
                  const isOtp = log.action.includes("otp") || log.action.includes("credential");

                  const icon = isLoginFail ? (
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  ) : isLoginOk ? (
                    <LogIn className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  ) : isCreate ? (
                    <UserPlus className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  ) : isDelete ? (
                    <UserMinus className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  ) : isUpdate ? (
                    <UserCog className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : isOtp ? (
                    <KeySquare className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  );

                  const bgClass = isLoginFail
                    ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40"
                    : isCreate
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40"
                    : isDelete
                    ? "bg-red-50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50";

                  const dt = new Date(log.createdAt);
                  const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                  const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                  return (
                    <div key={log.id} className={`flex gap-3 p-3 rounded-lg border ${bgClass}`}>
                      {icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-100 leading-snug">{log.description || log.action}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{log.actorName}</span>
                          <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">{log.actorRole}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{dateStr} · {timeStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

    </div>

    <StaffUsersSection />
    </>
  );
}
