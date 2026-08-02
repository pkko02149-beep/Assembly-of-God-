import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, FileText, BookOpen, Loader2, CheckCircle2, XCircle, Clock, Calendar, RefreshCw, GraduationCap, Users, Lock, Unlock, UserCog, Timer, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getAdminToken } from "@/lib/auth";
import TeachersTab from "./teachers-tab";

function authHeader() {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─── Teachers AdM Permission ───────────────────────────────────────────────────
interface TeacherPerm {
  id: number; name: string; email: string; employeeId: string;
  classAssigned: number | null; sectionAssigned: number | null;
  subject: string | null; className: string | null; sectionName: string | null;
  permission: {
    id: number; isLocked: boolean; expiresAt: string | null;
    grantedAt: string | null; effectivelyLocked: boolean;
  } | null;
}

const DURATION_OPTIONS = [
  { label: "No Expiry (Permanent)", value: "0" },
  { label: "1 Hour", value: "1" },
  { label: "2 Hours", value: "2" },
  { label: "4 Hours", value: "4" },
  { label: "8 Hours", value: "8" },
  { label: "12 Hours", value: "12" },
  { label: "24 Hours (1 Day)", value: "24" },
  { label: "48 Hours (2 Days)", value: "48" },
  { label: "72 Hours (3 Days)", value: "72" },
  { label: "1 Week (168 Hours)", value: "168" },
];

function formatExpiry(expiresAt: string | null, effectivelyLocked: boolean, isLocked: boolean): string {
  if (isLocked) return "Locked";
  if (!expiresAt) return "No expiry";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function TeachersAdmPermission() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<number, string>>({});

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher-admission-permission", { headers: authHeader() });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load teacher permissions", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  async function updatePermission(teacherId: number, isLocked: boolean) {
    setSaving(teacherId);
    try {
      const durationHours = parseFloat(durations[teacherId] ?? "0") || 0;
      const res = await fetch(`/api/teacher-admission-permission/${teacherId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ isLocked, durationHours }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isLocked ? "Tab locked for teacher" : "Tab unlocked for teacher" });
      fetchTeachers();
    } catch {
      toast({ title: "Failed to update permission", variant: "destructive" });
    } finally { setSaving(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading teachers…
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No teachers found. Add teachers in the Teachers tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Control which teachers can access the Student Records tab to add students. Set a time limit or lock manually.
        </p>
        <Button size="sm" variant="outline" onClick={fetchTeachers} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-0.5">How this works</p>
          <p className="text-blue-600 text-xs leading-relaxed">
            When unlocked, the teacher can access their <strong>Student Records</strong> tab to add students
            to their assigned class and section only. Set a duration to auto-lock after a time period,
            or leave it as "No Expiry" to keep it open until you manually lock it.
          </p>
        </div>
      </div>

      {/* Teachers list */}
      <div className="space-y-3">
        {teachers.map((t) => {
          const isEffectivelyLocked = t.permission?.effectivelyLocked ?? true;
          const isSaving = saving === t.id;
          const dur = durations[t.id] ?? "0";
          return (
            <div key={t.id} className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${isEffectivelyLocked ? "border-slate-200" : "border-green-300 ring-1 ring-green-200"}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Teacher info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-800">{t.name}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{t.employeeId}</span>
                    {!isEffectivelyLocked && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        <Unlock className="h-3 w-3" /> Active
                      </span>
                    )}
                    {isEffectivelyLocked && t.permission && !t.permission.isLocked && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="h-3 w-3" /> Expired
                      </span>
                    )}
                    {isEffectivelyLocked && (!t.permission || t.permission.isLocked) && (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                    {t.className && <span>Class: <strong className="text-slate-600">{t.className}{t.sectionName ? ` – ${t.sectionName}` : ""}</strong></span>}
                    {t.subject && <span>Subject: <strong className="text-slate-600">{t.subject}</strong></span>}
                    {!t.classAssigned && <span className="text-amber-600">⚠ No class assigned</span>}
                    {t.permission?.expiresAt && !isEffectivelyLocked && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Timer className="h-3 w-3" />
                        {formatExpiry(t.permission.expiresAt, isEffectivelyLocked, t.permission?.isLocked ?? true)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={dur}
                      onChange={e => setDurations(d => ({ ...d, [t.id]: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a6e]/30"
                    >
                      {DURATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    disabled={isSaving || !isEffectivelyLocked}
                    onClick={() => updatePermission(t.id, false)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                    Unlock
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSaving || isEffectivelyLocked}
                    onClick={() => updatePermission(t.id, true)}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 gap-1.5 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    Lock
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface LeaveRequest {
  id: number; teacherName: string; employeeId: string;
  fromDate: string; toDate: string; reason: string;
  status: "pending" | "approved" | "rejected"; createdAt: string;
}

interface Notice {
  id: number; title: string; content: string; createdAt: string; isActive: boolean;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Request failed"); }
  return res.json();
}

function LeaveRequestsPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api("GET", "/leave-requests?userType=teacher");
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Could not load leave requests", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function updateStatus(id: number, status: "approved" | "rejected") {
    try {
      await api("PUT", `/leave-requests/${id}`, { status });
      toast({ title: `Leave ${status}` });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  const filtered = requests.filter(r => filter === "all" || r.status === filter);
  const pending = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Teacher Leave Requests</h3>
          {pending > 0 && <Badge className="bg-amber-500 text-white">{pending} Pending</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No {filter === "all" ? "" : filter} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className="border border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{req.teacherName}</span>
                      <Badge variant="outline" className="text-xs">{req.employeeId}</Badge>
                      <Badge className={
                        req.status === "pending" ? "bg-amber-100 text-amber-700" :
                        req.status === "approved" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      } variant="secondary">{req.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{req.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(req.fromDate), "d MMM")} — {format(new Date(req.toDate), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" onClick={() => updateStatus(req.id, "approved")}
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, "rejected")}
                        className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50">
                        <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticesPanel() {
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api("GET", "/notices");
      setNotices(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Could not load notices", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function createNotice() {
    if (!form.title || !form.content) {
      toast({ title: "Title and content required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await api("POST", "/notices", { ...form, targetRole: "teachers", isActive: true });
      toast({ title: "Notice published to all teachers" });
      setForm({ title: "", content: "" });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function toggleNotice(id: number, isActive: boolean) {
    try {
      await api("PUT", `/notices/${id}`, { isActive: !isActive });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function deleteNotice(id: number) {
    if (!confirm("Delete this notice?")) return;
    try {
      await api("DELETE", `/notices/${id}`);
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-amber-800 dark:text-amber-300">Post New Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Notice title..."
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 min-h-[80px] resize-none"
            placeholder="Notice content visible to all teachers..."
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          />
          <Button onClick={createNotice} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
            Publish Notice
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">All Notices ({notices.length})</h3>
          <Button variant="outline" size="sm" onClick={load} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-amber-500" /></div>
        ) : notices.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No notices yet</p>
          </div>
        ) : (
          notices.map(n => (
            <Card key={n.id} className={`border shadow-sm ${n.isActive ? "border-slate-200 dark:border-slate-700" : "opacity-50 border-slate-200 dark:border-slate-700"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
                      <Badge className={n.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"} variant="secondary">
                        {n.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{n.content}</p>
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(n.createdAt), "d MMM yyyy, h:mm a")}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleNotice(n.id, n.isActive)}
                      className="h-7 text-xs text-slate-500 hover:text-slate-700">
                      {n.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteNotice(n.id)}
                      className="h-7 text-xs text-red-400 hover:text-red-600 hover:bg-red-50">
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ExamMarksPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Exam Marks Summary by Teacher</h3>
      </div>
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardContent className="py-16 text-center text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Marks entered via the Exam Management tab will appear here</p>
          <p className="text-xs mt-1">Go to Exam Management → Marks Entry to enter marks by class and subject</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeacherManagementTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-amber-500" />
          Teacher Management
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage teachers, leave requests, publish notices, and monitor exam marks</p>
      </div>
      <Tabs defaultValue="teachers" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-lg flex-wrap h-auto gap-1">
          <TabsTrigger value="teachers" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm text-sm">
            <Users className="h-4 w-4 mr-1.5" />Teachers
          </TabsTrigger>
          <TabsTrigger value="leave" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm text-sm">
            <Clock className="h-4 w-4 mr-1.5" />Leave Requests
          </TabsTrigger>
          <TabsTrigger value="notices" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm text-sm">
            <Bell className="h-4 w-4 mr-1.5" />Notices
          </TabsTrigger>
          <TabsTrigger value="marks" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm text-sm">
            <FileText className="h-4 w-4 mr-1.5" />Exam Marks
          </TabsTrigger>
          <TabsTrigger value="adm-permission" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm text-sm">
            <UserCog className="h-4 w-4 mr-1.5" />AdM Permission
          </TabsTrigger>
        </TabsList>
        <TabsContent value="teachers" className="focus-visible:outline-none mt-4"><TeachersTab /></TabsContent>
        <TabsContent value="leave" className="focus-visible:outline-none mt-4"><LeaveRequestsPanel /></TabsContent>
        <TabsContent value="notices" className="focus-visible:outline-none mt-4"><NoticesPanel /></TabsContent>
        <TabsContent value="marks" className="focus-visible:outline-none mt-4"><ExamMarksPanel /></TabsContent>
        <TabsContent value="adm-permission" className="focus-visible:outline-none mt-4"><TeachersAdmPermission /></TabsContent>
      </Tabs>
    </div>
  );
}
