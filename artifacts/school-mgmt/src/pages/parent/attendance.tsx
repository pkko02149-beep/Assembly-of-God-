import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, CheckCircle, XCircle, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord { id: number; date: string; status: string; className: string; }
interface Student { studentId: number; studentName: string; classId: number; }

export default function ParentAttendance() {
  const [, navigate] = useLocation();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    loadParent();
  }, []);

  useEffect(() => {
    if (selectedStudent) loadAttendance();
  }, [selectedStudent, month]);

  async function loadParent() {
    try {
      const p = await parentApi.get<{ id: number; students: Student[] }>("/auth/parent/me");
      setParentId(p.id);
      const studs = await parentApi.get<Student[]>(`/parents/${p.id}/students`);
      setStudents(studs as Student[]);
      if (studs.length > 0) setSelectedStudent((studs[0] as Student).studentId);
    } catch { navigate("/parent/login"); }
    finally { setLoading(false); }
  }

  async function loadAttendance() {
    if (!selectedStudent) return;
    try {
      const [year, m] = month.split("-");
      const dateFrom = `${year}-${m}-01`;
      const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
      const dateTo = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;
      const data = await parentApi.get<AttendanceRecord[]>(`/attendance?studentId=${selectedStudent}&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setRecords(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch { setRecords([]); }
  }

  const presentCount = records.filter(r => r.status === "present").length;
  const absentCount = records.filter(r => r.status === "absent").length;
  const total = records.length;
  const pct = total > 0 ? Math.round(presentCount / total * 100) : 0;

  if (loading) return <ParentLayout title="Attendance"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div></ParentLayout>;

  return (
    <ParentLayout title="Attendance">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Record</h2>
          <p className="text-sm text-slate-500">Monthly attendance view</p>
        </div>
        <div className="flex gap-2">
          {students.length > 1 && (
            <Select value={String(selectedStudent)} onValueChange={v => setSelectedStudent(parseInt(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.studentId} value={String(s.studentId)}>{s.studentName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className={`border-0 shadow-sm ${pct < 75 ? "bg-red-50" : "bg-green-50"}`}>
          <CardContent className="p-4 text-center">
            <TrendingUp className={`w-5 h-5 mx-auto mb-1 ${pct < 75 ? "text-red-500" : "text-green-500"}`} />
            <p className={`text-2xl font-bold ${pct < 75 ? "text-red-700" : "text-green-700"}`}>{pct}%</p>
            <p className={`text-xs ${pct < 75 ? "text-red-600" : "text-green-600"}`}>Attendance</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-700">{presentCount}</p>
            <p className="text-xs text-blue-600">Present</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-orange-50">
          <CardContent className="p-4 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold text-orange-700">{absentCount}</p>
            <p className="text-xs text-orange-600">Absent</p>
          </CardContent>
        </Card>
      </div>

      {pct < 75 && total > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Attendance is below 75%. Regular attendance is important for academic progress.
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-500" />
            Daily Attendance — {format(new Date(month + "-01"), "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No attendance records for this month</p>
            </div>
          ) : (
            <div className="divide-y">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {r.status === "present"
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-red-500" />
                    }
                    <span className="text-sm text-slate-700">{format(new Date(r.date), "EEEE, MMMM d")}</span>
                  </div>
                  <Badge className={r.status === "present" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ParentLayout>
  );
}
