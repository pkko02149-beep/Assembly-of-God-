import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Users, ClipboardCheck, BookOpen, Bell, TrendingUp, Calendar,
  Loader2, ClipboardList, AlertTriangle, Plus, ChevronDown, ChevronUp,
  CheckCircle2, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Teacher {
  id: number; name: string; classAssigned: number | null;
  className?: string; subject: string; employeeId: string;
}
interface Notice { id: number; title: string; content: string; createdAt: string; targetRole: string; authorRole: string; classId?: number | null; }
interface Homework { id: number; title: string; subject: string; dueDate: string; className: string; }
interface LeaveRequest { id: number; status: string; fromDate: string; toDate: string; reason: string; }
interface Student { id: number; studentName: string; rollNo: number; }
interface FirRecord {
  id: number; studentId: number; studentName?: string; classId: number;
  incidentDate: string; description: string; actionTaken?: string;
  severity: string; status: string; teacherName?: string; createdAt?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  minor: "bg-yellow-100 text-yellow-800",
  moderate: "bg-orange-100 text-orange-800",
  severe: "bg-red-100 text-red-800",
};

export default function TeacherDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [todayAttendance, setTodayAttendance] = useState({ present: 0, absent: 0, total: 0 });
  const [firRecords, setFirRecords] = useState<FirRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Incident dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [firExpanded, setFirExpanded] = useState(false);
  const [savingFir, setSavingFir] = useState(false);
  const [firForm, setFirForm] = useState({
    studentId: "",
    incidentDate: format(new Date(), "yyyy-MM-dd"),
    severity: "minor",
    description: "",
    actionTaken: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const t = await teacherApi.get<Teacher>("/auth/teacher/me");
      setTeacher(t);

      const [hw, ntc, lrRaw] = await Promise.all([
        teacherApi.get<Homework[]>(`/homework?teacherId=${t.id}`),
        teacherApi.get<Notice[]>("/notices?isActive=true"),
        teacherApi.get<LeaveRequest[] | { ownLeaves?: LeaveRequest[]; studentLeaves?: LeaveRequest[] }>("/leave-requests"),
      ]);
      setHomework(hw.slice(0, 5));
      setNotices(ntc.filter((n: Notice) =>
        n.targetRole === "teachers" || n.targetRole === "all" ||
        (n.classId != null && t.classAssigned != null && n.classId === t.classAssigned)
      ).slice(0, 5));
      // /leave-requests returns { ownLeaves, studentLeaves } for teacher tokens
      const lrArray: LeaveRequest[] = Array.isArray(lrRaw)
        ? lrRaw
        : (Array.isArray((lrRaw as { ownLeaves?: LeaveRequest[] }).ownLeaves)
            ? (lrRaw as { ownLeaves: LeaveRequest[] }).ownLeaves
            : []);
      setLeaveRequests(lrArray.slice(0, 3));

      if (t.classAssigned) {
        const stds = await teacherApi.get<Student[]>(`/students?classId=${t.classAssigned}`);
        setStudents(stds);
        const today = format(new Date(), "yyyy-MM-dd");
        const [att, firs] = await Promise.all([
          teacherApi.get<{ status: string }[]>(`/attendance?classId=${t.classAssigned}&date=${today}`),
          teacherApi.get<FirRecord[]>(`/fir?classId=${t.classAssigned}`),
        ]);
        const present = att.filter(a => a.status === "present").length;
        setTodayAttendance({ present, absent: att.filter(a => a.status === "absent").length, total: stds.length });
        setFirRecords(firs);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
    } finally {
      setLoading(false);
    }
  }

  async function submitFir(e: React.FormEvent) {
    e.preventDefault();
    if (!firForm.studentId || !firForm.description.trim()) {
      toast({ title: "Missing fields", description: "Select a student and describe the incident.", variant: "destructive" });
      return;
    }
    if (!teacher?.classAssigned) return;
    setSavingFir(true);
    try {
      const newRecord = await teacherApi.post<FirRecord>("/fir", {
        studentId: parseInt(firForm.studentId),
        classId: teacher.classAssigned,
        incidentDate: firForm.incidentDate,
        description: firForm.description.trim(),
        actionTaken: firForm.actionTaken.trim(),
        severity: firForm.severity,
        reportedById: teacher.id,
      });
      setFirRecords(prev => [newRecord, ...prev]);
      setShowDialog(false);
      setFirForm({ studentId: "", incidentDate: format(new Date(), "yyyy-MM-dd"), severity: "minor", description: "", actionTaken: "" });
      toast({ title: "Incident filed", description: "The FIR record has been saved." });
    } catch {
      toast({ title: "Error", description: "Failed to file incident. Please try again.", variant: "destructive" });
    } finally {
      setSavingFir(false);
    }
  }

  async function closeIncident(id: number) {
    try {
      await teacherApi.put(`/fir/${id}`, { status: "resolved" });
      setFirRecords(prev => prev.map(f => f.id === id ? { ...f, status: "resolved" } : f));
      toast({ title: "Marked resolved" });
    } catch {
      toast({ title: "Error", description: "Could not update record.", variant: "destructive" });
    }
  }

  if (loading) return (
    <TeacherLayout title="Dashboard">
      <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
    </TeacherLayout>
  );

  const attendancePct = todayAttendance.total > 0
    ? Math.round((todayAttendance.present / todayAttendance.total) * 100) : 0;

  const stats = [
    { label: "My Students", value: students.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Today Present", value: `${todayAttendance.present}/${todayAttendance.total}`, icon: ClipboardCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Pending HW", value: homework.filter(h => new Date(h.dueDate) >= new Date()).length, icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Attendance %", value: `${attendancePct}%`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  const openFirs = firRecords.filter(f => f.status === "open");
  const displayedFirs = firExpanded ? firRecords : firRecords.slice(0, 3);

  return (
    <TeacherLayout title="Dashboard">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-5 mb-6 text-white">
        <h2 className="text-xl font-bold">Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"}, {teacher?.name?.split(" ")[0]}!</h2>
        <p className="text-slate-300 text-sm mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")} · {teacher?.subject || "All Subjects"}</p>
        {teacher?.classAssigned && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/20">Class Teacher</Badge>
            {teacher.className && <Badge className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/20">Assigned: {teacher.className}</Badge>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── FIR / Incident Register ── */}
      {teacher?.classAssigned && (
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-red-500" />
                FIR / Incident Register
                {openFirs.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs ml-1">
                    {openFirs.length} open
                  </Badge>
                )}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setShowDialog(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Report Incident
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {firRecords.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No incidents on record</p>
                <p className="text-xs mt-1">Click "Report Incident" to file a new record</p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedFirs.map(f => (
                  <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-800 truncate">{f.studentName || "Unknown Student"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[f.severity] || "bg-slate-100 text-slate-600"}`}>
                          {f.severity}
                        </span>
                        {f.status === "open"
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><Clock className="w-3 h-3" />Open</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Resolved</span>
                        }
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{f.description}</p>
                      {f.actionTaken && <p className="text-xs text-slate-400 mt-0.5 italic">Action: {f.actionTaken}</p>}
                      <p className="text-xs text-slate-400 mt-1">{format(new Date(f.incidentDate), "dd MMM yyyy")}</p>
                    </div>
                    {f.status === "open" && (
                      <button
                        onClick={() => closeIncident(f.id)}
                        className="text-xs text-green-600 hover:text-green-800 whitespace-nowrap mt-1 font-medium"
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                ))}
                {firRecords.length > 3 && (
                  <button
                    onClick={() => setFirExpanded(v => !v)}
                    className="w-full text-xs text-slate-500 hover:text-slate-700 py-2 flex items-center justify-center gap-1"
                  >
                    {firExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {firRecords.length} incidents</>}
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Homework */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" /> Recent Homework
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {homework.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No homework assigned yet</p>}
            {homework.map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{h.title}</p>
                  <p className="text-xs text-slate-400">{h.subject} · {h.className}</p>
                </div>
                <Badge variant={new Date(h.dueDate) < new Date() ? "destructive" : "outline"} className="text-xs shrink-0">
                  Due {format(new Date(h.dueDate), "MMM d")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notices */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" /> Latest Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notices.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No notices yet</p>}
            {notices.map(n => (
              <div key={n.id} className="p-2 rounded-lg bg-slate-50">
                <p className="text-sm font-medium text-slate-700">{n.title}</p>
                <p className="text-xs text-slate-400">{format(new Date(n.createdAt), "MMM d, yyyy")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-500" /> My Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaveRequests.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No leave requests</p>}
            <div className="space-y-2">
              {leaveRequests.map(lr => (
                <div key={lr.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{lr.reason}</p>
                    <p className="text-xs text-slate-400">{format(new Date(lr.fromDate), "MMM d")} – {format(new Date(lr.toDate), "MMM d, yyyy")}</p>
                  </div>
                  <Badge variant={lr.status === "approved" ? "default" : lr.status === "rejected" ? "destructive" : "secondary"}>
                    {lr.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Report Incident Dialog ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Report Incident
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitFir} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label>Student <span className="text-red-500">*</span></Label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                value={firForm.studentId}
                onChange={e => setFirForm(f => ({ ...f, studentId: e.target.value }))}
                required
              >
                <option value="">— Select student —</option>
                {students.sort((a, b) => a.rollNo - b.rollNo).map(s => (
                  <option key={s.id} value={s.id}>Roll {s.rollNo} · {s.studentName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={firForm.incidentDate}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={e => setFirForm(f => ({ ...f, incidentDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={firForm.severity}
                  onChange={e => setFirForm(f => ({ ...f, severity: e.target.value }))}
                >
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Incident Description <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Describe what happened..."
                value={firForm.description}
                onChange={e => setFirForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                required
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Action Taken <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea
                placeholder="What action was taken or is planned..."
                value={firForm.actionTaken}
                onChange={e => setFirForm(f => ({ ...f, actionTaken: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingFir}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {savingFir ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                File Incident
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
}
