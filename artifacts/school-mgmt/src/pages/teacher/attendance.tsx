import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Save, CalendarCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

interface Teacher { id: number; classAssigned: number | null; subject: string; }
interface Student { id: number; studentName: string; rollNo: number; fatherName: string; studentType?: string; isPromoted?: boolean; }

export default function TeacherAttendance() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, "present" | "absent">>({});
  const [existingIds, setExistingIds] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("teacher_token")) { navigate("/teacher/login"); return; }
    loadTeacher();
  }, []);

  useEffect(() => {
    if (teacher?.classAssigned) loadAttendance();
  }, [date, teacher]);

  async function loadTeacher() {
    try {
      const t = await teacherApi.get<Teacher>("/auth/teacher/me");
      setTeacher(t);
      if (t.classAssigned) {
        const stds = await teacherApi.get<Student[]>(`/students?classId=${t.classAssigned}`);
        setStudents(stds.sort((a, b) => a.rollNo - b.rollNo));
        const init: Record<number, "present" | "absent"> = {};
        stds.forEach(s => { init[s.id] = "present"; });
        setAttendance(init);
      }
    } catch (err) { if (isAuthError(err)) navigate("/teacher/login"); }
    finally { setLoading(false); }
  }

  async function loadAttendance() {
    if (!teacher?.classAssigned) return;
    try {
      const att = await teacherApi.get<{ studentId: number; status: string; id: number }[]>(
        `/attendance?classId=${teacher.classAssigned}&date=${date}`
      );
      if (att.length > 0) {
        const map: Record<number, "present" | "absent"> = {};
        const ids = new Set<number>();
        att.forEach(a => {
          map[a.studentId] = a.status as "present" | "absent";
          ids.add(a.studentId);
        });
        setAttendance(prev => ({ ...prev, ...map }));
        setExistingIds(ids);
      } else {
        const init: Record<number, "present" | "absent"> = {};
        students.forEach(s => { init[s.id] = "present"; });
        setAttendance(init);
        setExistingIds(new Set());
      }
    } catch { /* ignore */ }
  }

  function toggle(studentId: number) {
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present",
    }));
  }

  function markAll(status: "present" | "absent") {
    const next: Record<number, "present" | "absent"> = {};
    students.forEach(s => { next[s.id] = status; });
    setAttendance(next);
  }

  async function save() {
    if (!teacher?.classAssigned) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        status: attendance[s.id] || "present",
      }));
      await teacherApi.post("/attendance", { date, records });
      toast({ title: "Saved", description: `Attendance saved for ${format(new Date(date), "MMMM d, yyyy")}` });
      loadAttendance();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(attendance).filter(v => v === "present").length;
  const absentCount = Object.values(attendance).filter(v => v === "absent").length;

  if (loading) return <TeacherLayout title="Attendance"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mt-20" /></div></TeacherLayout>;

  return (
    <TeacherLayout title="Mark Attendance">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Daily Attendance</h2>
          <p className="text-sm text-slate-500">{students.length} students in class</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
          <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{presentCount}</p>
            <p className="text-xs text-green-600">Present</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            <p className="text-xs text-red-600">Absent</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{students.length > 0 ? Math.round(presentCount / students.length * 100) : 0}%</p>
            <p className="text-xs text-blue-600">Attendance</p>
          </CardContent>
        </Card>
      </div>

      {!teacher?.classAssigned ? (
        <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-slate-400">No class assigned. Contact admin.</CardContent></Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                <CalendarCheck className="w-4 h-4 inline mr-2 text-amber-500" />
                Student List — {format(new Date(date), "MMMM d, yyyy")}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => markAll("present")}>All Present</Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => markAll("absent")}>All Absent</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Roll</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Father's Name</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr></thead>
                <tbody>
                  {students.map(s => {
                    const sessionStatus = getSessionStatus(s.studentType);
                    const isLocked = !!sessionStatus;
                    return (
                    <tr key={s.id} className={`border-b last:border-0 hover:bg-slate-50 ${isLocked ? "opacity-60 bg-slate-50/70" : ""}`}>
                      <td className="px-4 py-3 font-medium text-slate-600">{s.rollNo}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{s.studentName}</span>
                          {isLocked && <SessionStatusBadge studentType={s.studentType} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.fatherName}</td>
                      <td className="px-4 py-3 text-center">
                        {isLocked ? (
                          <span className="text-xs text-slate-400 italic">Locked</span>
                        ) : (
                          <button onClick={() => toggle(s.id)} className="flex items-center gap-1.5 mx-auto">
                            {attendance[s.id] === "present"
                              ? <><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-green-600 font-medium">Present</span></>
                              : <><XCircle className="w-5 h-5 text-red-500" /><span className="text-red-600 font-medium">Absent</span></>
                            }
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {students.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-slate-400">No students in this class</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </TeacherLayout>
  );
}
