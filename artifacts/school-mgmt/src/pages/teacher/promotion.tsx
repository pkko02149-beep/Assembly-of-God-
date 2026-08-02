import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Lock, ArrowUpCircle, CheckCircle2, AlertTriangle, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Action = "promote" | "detain" | "drop";
type Decision = { action: Action; toSectionId?: number };

interface Status {
  authorized: boolean;
  reason: string | null;
  teacher: { id: number; name: string; classAssigned: number | null; sectionAssigned: number | null } | null;
  sourceSession: { id: number; name: string } | null;
  targetSession: { id: number; name: string } | null;
  windowOpenedAt: string | null;
  windowEndsAt: string | null;
}
interface ClassRow { id: number; name: string }
interface SectionRow { id: number; name: string; classId: number | null }
interface StudentRow {
  id: number; rollNo: number; studentName: string; classId: number; sectionId: number;
  className: string; sectionName: string; previousYearDue: number; pendingFeeDue: number;
  alreadyAction: Action | null;
}

const actionStyles: Record<Action, string> = {
  promote: "border-emerald-300 bg-emerald-50 text-emerald-800",
  detain: "border-amber-300 bg-amber-50 text-amber-800",
  drop: "border-red-300 bg-red-50 text-red-800",
};

export default function TeacherPromotion() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    load();
  }, []);

  async function load() {
    try {
      const [nextStatus, classRows, sectionRows] = await Promise.all([
        teacherApi.get<Status>("/teacher-promotion/status"),
        teacherApi.get<ClassRow[]>("/classes"),
        teacherApi.get<SectionRow[]>("/sections"),
      ]);
      setStatus(nextStatus);
      setClasses(classRows);
      setSections(sectionRows);
      if (nextStatus.authorized) {
        setLoadingStudents(true);
        const rows = await teacherApi.get<StudentRow[]>("/academic-sessions/promote/students");
        setStudents(rows);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
      else toast({ title: "Could not load promotion workspace", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingStudents(false);
    }
  }

  const currentClass = useMemo(
    () => classes.find(c => c.id === status?.teacher?.classAssigned),
    [classes, status],
  );
  const targetClass = useMemo(() => {
    const ordered = [...classes].sort((a, b) => a.id - b.id);
    const index = ordered.findIndex(c => c.id === status?.teacher?.classAssigned);
    return index >= 0 ? ordered[index + 1] : undefined;
  }, [classes, status]);
  const sectionsForAction = (action: Action | undefined) => {
    const classId = action === "promote" ? targetClass?.id : status?.teacher?.classAssigned;
    return sections.filter(s => !s.classId || s.classId === classId);
  };

  function chooseAction(student: StudentRow, action: Action) {
    if (student.alreadyAction || student.previousYearDue > 0) return;
    const actionSections = sectionsForAction(action);
    const sameName = actionSections.find(s => s.name.toLowerCase() === student.sectionName.toLowerCase());
    setDecisions(prev => ({
      ...prev,
      [student.id]: { action, toSectionId: sameName?.id },
    }));
  }

  function setSection(studentId: number, value: string) {
    setDecisions(prev => ({ ...prev, [studentId]: { ...prev[studentId], toSectionId: value ? Number(value) : undefined } }));
  }

  async function submit() {
    const selected = students.filter(s => decisions[s.id]?.action);
    if (!selected.length) {
      toast({ title: "Choose an action first", description: "Select promote, detain, or drop for at least one student.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await teacherApi.post<{ succeeded: number; failed: number; results: Array<{ studentId: number; status: string; error?: string }> }>(
        "/academic-sessions/promote",
        { decisions: selected.map(s => ({ studentId: s.id, action: decisions[s.id].action, toSectionId: decisions[s.id].toSectionId })) },
      );
      const failures = result.results.filter(r => r.status === "error");
      if (failures.length) {
        toast({ title: `${result.succeeded} saved, ${failures.length} need attention`, description: failures[0]?.error, variant: "destructive" });
      } else {
        toast({ title: "Promotion decisions saved", description: `${result.succeeded} student${result.succeeded === 1 ? "" : "s"} processed successfully.` });
      }
      setSubmitted(true);
      await load();
    } catch (err) {
      toast({ title: "Could not save decisions", description: (err as Error).message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <TeacherLayout title="Year-End Promotion"><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div></TeacherLayout>;
  }

  if (!status?.authorized) {
    return (
      <TeacherLayout title="Year-End Promotion">
        <Card className="max-w-2xl border-amber-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center"><Lock className="h-7 w-7 text-slate-400" /></div>
            <h2 className="text-xl font-bold text-slate-800">Promotion access is locked</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{status?.reason || "Your administrator has not opened this feature for you yet."}</p>
            <p className="mt-5 text-xs text-slate-400">Contact the school administrator if you believe you should have access.</p>
          </CardContent>
        </Card>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="Year-End Promotion">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ArrowUpCircle className="h-6 w-6 text-violet-600" />Year-End Promotion</h2>
            <p className="mt-1 text-sm text-slate-500">Review decisions for students in your assigned class. Target class is fixed; target section may be changed.</p>
          </div>
          <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100"><Clock className="mr-1.5 h-3.5 w-3.5" />Open until {status.windowEndsAt ? new Date(status.windowEndsAt).toLocaleString() : "—"}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Source session</p><p className="mt-1 font-semibold text-slate-800">{status.sourceSession?.name}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Target session</p><p className="mt-1 font-semibold text-slate-800">{status.targetSession?.name}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Assigned class</p><p className="mt-1 font-semibold text-slate-800">{currentClass?.name || "—"} {status.teacher?.sectionAssigned ? "· assigned section" : ""}</p></CardContent></Card>
        </div>

        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <AlertTriangle className="h-4 w-4" /><AlertTitle>Fee rules still apply</AlertTitle>
          <AlertDescription>Previous-year dues block promote and detain. Monthly dues are carried forward automatically using the same calculation as the admin promotion wizard. Drop is not fee-blocked.</AlertDescription>
        </Alert>

        {loadingStudents ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-violet-500" /></div> : (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-violet-600" />Students ({students.length})</CardTitle>
              <Button onClick={submit} disabled={submitting || submitted} className="bg-violet-600 text-white hover:bg-violet-700">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {submitted ? "Saved" : "Save decisions"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {students.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No students are currently assigned to your class.</p>}
              {students.map(student => {
                const decision = decisions[student.id];
                const blocked = !!student.alreadyAction || student.previousYearDue > 0;
                return (
                  <div key={student.id} className={`rounded-lg border p-3 ${student.alreadyAction ? "bg-slate-50 opacity-70" : "bg-white"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{student.studentName}</span>
                          <Badge variant="outline" className="text-xs">Roll {student.rollNo}</Badge>
                          {student.alreadyAction && <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">Already {student.alreadyAction}</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">{student.className} · {student.sectionName} {student.previousYearDue > 0 && <span className="font-medium text-red-600">· Previous-year due ₹{student.previousYearDue.toFixed(0)}</span>}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(["promote", "detain", "drop"] as Action[]).map(action => (
                          <Button key={action} size="sm" variant="outline" disabled={blocked} onClick={() => chooseAction(student, action)}
                            className={decision?.action === action ? actionStyles[action] : "text-slate-600"}>
                            {action[0].toUpperCase() + action.slice(1)}
                          </Button>
                        ))}
                        <select disabled={!decision || decision.action === "drop" || blocked} value={decision?.toSectionId ?? ""} onChange={e => setSection(student.id, e.target.value)}
                          className="h-9 min-w-[145px] rounded-md border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-100">
                          <option value="">Target section</option>
                          {sectionsForAction(decision?.action).map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {decision && !blocked && <p className="mt-2 text-xs text-slate-400">Target class: <strong>{decision.action === "promote" ? targetClass?.name || "Next class" : decision.action === "detain" ? currentClass?.name || "Current class" : "Not applicable"}</strong> (fixed by the system)</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherLayout>
  );
}