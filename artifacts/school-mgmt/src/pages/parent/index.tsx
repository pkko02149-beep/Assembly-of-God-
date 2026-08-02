import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CreditCard, Bell, BookOpen, Loader2, AlertCircle, ClipboardList, CheckCircle2, ChevronRight, Users } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Parent { id: number; fatherName: string; motherName: string; students: { studentId: number; studentName: string }[]; }
interface Notice { id: number; title: string; content: string; createdAt: string; authorRole: string; classId?: number | null; teacherName?: string; }
interface Homework { id: number; title: string; subject: string; dueDate: string; className: string; }
interface FeePayment { status: string; amount: string; paidAmount: string; month: number; year: number; }
interface FirRecord { id: number; incidentDate: string; description: string; severity: string; status: string; actionTaken: string; }

export default function ParentDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [parent, setParent] = useState<Parent | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [feeData, setFeeData] = useState({ total: 0, paid: 0, pending: 0 });
  const [attendance, setAttendance] = useState({ present: 0, total: 0 });
  const [firRecords, setFirRecords] = useState<FirRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const push = usePushNotifications();

  // Fetch student-specific data for the selected child
  const loadStudentData = useCallback(async (p: Parent, idx: number) => {
    const student = p.students?.[idx];
    if (!student) return;
    setStudentLoading(true);
    // Reset stats before loading new child's data
    setHomework([]); setFeeData({ total: 0, paid: 0, pending: 0 });
    setAttendance({ present: 0, total: 0 }); setFirRecords([]);
    try {
      const [ntc, studs] = await Promise.all([
        parentApi.get<Notice[]>("/notices?isActive=true&targetRole=parents"),
        parentApi.get<{ classId: number }[]>(`/parents/${p.id}/students`),
      ]);
      const classId = studs[idx]?.classId;
      setNotices(ntc.filter((n: Notice) => {
        if (n.authorRole === "admin") return !n.classId || n.classId === classId;
        if (n.authorRole === "teacher") return classId != null && n.classId === classId;
        return false;
      }).slice(0, 5));
      if (classId) {
        const [hw, fees, att] = await Promise.all([
          parentApi.get<Homework[]>(`/homework?classId=${classId}`),
          parentApi.get<FeePayment[]>(`/fees/payments?studentId=${student.studentId}`),
          parentApi.get<{ status: string }[]>(`/attendance?studentId=${student.studentId}`),
        ]);
        setHomework(hw.slice(0, 5));
        const fTotal = fees.reduce((s, f) => s + parseFloat(f.amount), 0);
        const fPaid = fees.filter(f => f.status === "paid").reduce((s, f) => s + parseFloat(f.paidAmount), 0);
        setFeeData({ total: fTotal, paid: fPaid, pending: fTotal - fPaid });
        const present = att.filter(a => a.status === "present").length;
        setAttendance({ present, total: att.length });
      }
      const firs = await parentApi.get<FirRecord[]>(`/fir?studentId=${student.studentId}`).catch(() => []);
      setFirRecords(firs);
    } catch { /* ignore */ }
    finally { setStudentLoading(false); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    (async () => {
      try {
        const p = await parentApi.get<Parent>("/auth/parent/me");
        setParent(p);
        await loadStudentData(p, 0);
      } catch { navigate("/parent/login"); }
      finally { setLoading(false); }
    })();
  }, []);

  // Reload when child selection changes (after initial load)
  useEffect(() => {
    if (parent && !loading) loadStudentData(parent, selectedIdx);
  }, [selectedIdx]);

  if (loading) return (
    <ParentLayout title="Dashboard">
      <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div>
    </ParentLayout>
  );

  const attPct = attendance.total > 0 ? Math.round(attendance.present / attendance.total * 100) : 0;
  const displayName = parent?.fatherName || parent?.motherName || "Parent";
  const students = parent?.students ?? [];
  const studentName = students[selectedIdx]?.studentName || "Your Child";
  const openFirs = firRecords.filter(f => f.status === "open");

  const stats = [
    { label: "Attendance", value: `${attPct}%`, icon: CalendarCheck, color: "text-green-600", bg: "bg-green-50", sub: `${attendance.present}/${attendance.total} days` },
    { label: "Fee Paid", value: `₹${feeData.paid.toFixed(0)}`, icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50", sub: `₹${feeData.pending.toFixed(0)} pending` },
    { label: "Homework", value: homework.length, icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50", sub: "assignments" },
    { label: "Notices", value: notices.length, icon: Bell, color: "text-purple-600", bg: "bg-purple-50", sub: "active notices" },
  ];

  return (
    <ParentLayout title="Dashboard">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-5 mb-6 text-white">
        <h2 className="text-xl font-bold">Welcome, {displayName.split(" ")[0]}!</h2>

        {/* Child selector — shown when there are multiple children */}
        {students.length > 1 ? (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-xs text-blue-300">Select child to view progress:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {students.map((s, i) => (
                <button
                  key={s.studentId}
                  onClick={() => setSelectedIdx(i)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    i === selectedIdx
                      ? "bg-white text-blue-900"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  {s.studentName.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-blue-200 text-sm mt-0.5">
            Tracking progress for: <strong className="text-white">{studentName}</strong>
          </p>
        )}

        {students.length > 1 && (
          <p className="text-blue-200 text-sm mt-1.5">
            {studentLoading
              ? <span className="animate-pulse">Loading {studentName}'s data…</span>
              : <>Tracking progress for: <strong className="text-white">{studentName}</strong></>
            }
          </p>
        )}

        {attPct < 75 && attendance.total > 0 && (
          <div className="flex items-center gap-2 mt-2 text-amber-300 text-sm">
            <AlertCircle className="w-4 h-4" />
            Attendance below 75% — please ensure regular attendance
          </div>
        )}

        {/* FIR mini-summary */}
        {firRecords.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-600">
            <button
              onClick={() => navigate("/parent/incidents")}
              className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-200" />
                <div>
                  <p className="text-sm font-semibold text-white">FIR / Incident Records</p>
                  <p className="text-xs text-blue-300">
                    {firRecords.length} record{firRecords.length !== 1 ? "s" : ""}
                    {openFirs.length > 0 && <span className="ml-1 text-amber-300">· {openFirs.length} open</span>}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-300" />
            </button>
          </div>
        )}

        {firRecords.length === 0 && !studentLoading && (
          <div className="mt-3 pt-3 border-t border-blue-600">
            <div className="flex items-center gap-2 text-sm text-green-300">
              <CheckCircle2 className="w-4 h-4" />
              No incidents on record — clean record
            </div>
          </div>
        )}

        {/* Push notification opt-in */}
        {push.supported && push.permState !== "denied" && (
          <div className="mt-3 pt-3 border-t border-blue-600">
            {push.subscribed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-300">
                  <Bell className="w-4 h-4" />
                  Homework &amp; result notifications on
                </div>
                <button
                  onClick={async () => { await push.unsubscribe(); toast({ title: "Notifications turned off" }); }}
                  disabled={push.loading}
                  className="text-xs text-blue-300 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Turn off
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  const ok = await push.subscribe();
                  if (ok) toast({ title: "🔔 Notifications enabled! You'll be notified when results are published." });
                  else if (push.permState === "denied") toast({ title: "Notifications blocked in browser settings", variant: "destructive" });
                }}
                disabled={push.loading}
                className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  {push.loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-200" /> : <Bell className="w-4 h-4 text-blue-200" />}
                  <div>
                    <p className="text-sm font-semibold text-white">Enable Notifications</p>
                    <p className="text-xs text-blue-300">Get notified for new homework &amp; results</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-300" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  {studentLoading ? <Loader2 className={`w-5 h-5 ${color} animate-spin`} /> : <Icon className={`w-5 h-5 ${color}`} />}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">{studentLoading ? "—" : value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Homework */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" /> Recent Homework
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>}
            {!studentLoading && homework.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No homework found</p>}
            {!studentLoading && homework.map(h => (
              <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">{h.title}</p>
                  <p className="text-xs text-slate-400">{h.subject}</p>
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
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{n.content}</p>
                <p className="text-xs text-slate-400 mt-1">{format(new Date(n.createdAt), "MMM d, yyyy")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ParentLayout>
  );
}
