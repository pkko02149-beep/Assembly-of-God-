import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Loader2, User } from "lucide-react";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

interface Teacher { id: number; classAssigned: number | null; subject: string; }
interface Student { id: number; studentName: string; fatherName: string; rollNo: number; whatsappNumber: string; parentEmail: string; className?: string; sectionName?: string; uniqueId: string; studentType?: string; isPromoted?: boolean; }

export default function TeacherStudents() {
  const [, navigate] = useLocation();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const t = await teacherApi.get<Teacher>("/auth/teacher/me");
      setTeacher(t);
      if (t.classAssigned) {
        const stds = await teacherApi.get<Student[]>(`/students?classId=${t.classAssigned}`);
        setStudents(stds);
        setFiltered(stds);
      }
    } catch (err) { if (isAuthError(err)) navigate("/teacher/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(students.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.fatherName.toLowerCase().includes(q) ||
      s.rollNo.toString().includes(q) ||
      s.uniqueId.toLowerCase().includes(q)
    ));
  }, [search, students]);

  if (loading) return <TeacherLayout title="My Students"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mt-20" /></div></TeacherLayout>;

  return (
    <TeacherLayout title="My Students">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Class Students</h2>
          <p className="text-sm text-slate-500 mt-0.5">{students.length} total students</p>
        </div>
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 px-3 py-1">
          <Users className="w-3.5 h-3.5 mr-1.5" />{students.length} Students
        </Badge>
      </div>

      {!teacher?.classAssigned ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No class assigned to you yet.</p>
            <p className="text-sm">Contact admin to assign a class.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, father name, roll no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Roll</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Student Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Father's Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">WhatsApp</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-12 text-slate-400">No students found</td></tr>
                    )}
                    {filtered.map((s, i) => {
                      const sessionStatus = getSessionStatus(s.studentType);
                      const isLocked = !!sessionStatus;
                      return (
                      <tr key={s.id} className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${isLocked ? "opacity-70" : ""} ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                        <td className="px-4 py-3">
                          <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">{s.rollNo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{s.studentName}</p>
                              <p className="text-xs text-slate-400">{s.uniqueId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isLocked
                            ? <SessionStatusBadge studentType={s.studentType} />
                            : <span className="text-xs text-slate-400">Active</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-slate-600">{s.fatherName}</td>
                        <td className="px-4 py-3 text-slate-600">{s.whatsappNumber || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.parentEmail || "—"}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </TeacherLayout>
  );
}
