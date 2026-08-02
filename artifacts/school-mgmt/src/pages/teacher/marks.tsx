import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Trophy,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  Lock,
  Edit2,
  X,
  AlertCircle,
  BookUser,
  Users,
  Send,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeacherMe {
  id: number;
  teacherName: string;
  classAssigned: number | null;
  subject: string;
}
interface Exam {
  id: number;
  name: string;
  status: string;
}
interface Subject {
  id: number;
  name: string;
  code?: string;
  maxTheoryMarks: string;
  maxPracticalMarks: string;
  maxInternalMarks: string;
}
interface Assignment {
  id: number;
  teacherId: number;
  teacherName?: string;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  sectionId?: number;
  sectionName?: string;
}
interface Student {
  id: number;
  studentName: string;
  rollNo: number;
  sectionId?: number;
}
interface ExamMark {
  id: number;
  studentId: number;
  subjectId: number;
  theoryMarks?: string | null;
  practicalMarks?: string | null;
  internalMarks?: string | null;
  totalMarks?: string | null;
  grade?: string | null;
  percentage?: string | null;
  isAbsent?: boolean;
  isLocked?: boolean;
  remarks?: string | null;
  classId?: number;
  sectionId?: number;
}
interface MarksRow {
  studentId: number;
  studentName: string;
  rollNo: number;
  sectionId?: number;
  theoryMarks: string;
  practicalMarks: string;
  internalMarks: string;
  isAbsent: boolean;
  remarks: string;
  saved: boolean;
  dirty: boolean;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeacherResults() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    if (!localStorage.getItem("teacher_token")) { navigate("/teacher/login"); return; }
    loadInitial();
  }, []);

  async function loadInitial() {
    try {
      const t = await teacherApi.get<TeacherMe>("/auth/teacher/me");
      setTeacher(t);
      const [examList, asgList] = await Promise.all([
        teacherApi.get<Exam[]>("/exams"),
        teacherApi.get<Assignment[]>(`/teacher-subject-assignments?teacherId=${t.id}`),
      ]);
      setExams(Array.isArray(examList) ? examList : []);
      setMyAssignments(Array.isArray(asgList) ? asgList : []);
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </TeacherLayout>
    );
  }

  const activeExams = exams.filter((e) => e.status === "active");

  return (
    <TeacherLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl font-semibold">Results Management</h1>
        </div>

        <Tabs defaultValue="my-subject">
          <TabsList>
            <TabsTrigger value="my-subject" className="gap-1.5">
              <BookUser className="h-4 w-4" />
              My Subject
            </TabsTrigger>
            <TabsTrigger value="all-subjects" className="gap-1.5">
              <Users className="h-4 w-4" />
              All Subjects
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-subject">
            <MySubjectTab
              teacher={teacher}
              exams={activeExams}
              myAssignments={myAssignments}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="all-subjects">
            <AllSubjectsTab
              teacher={teacher}
              exams={activeExams}
              myAssignments={myAssignments}
              toast={toast}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  );
}

// ─── Tab 1: My Subject Marks Entry ───────────────────────────────────────────
function MySubjectTab({
  exams,
  myAssignments,
  toast,
}: {
  teacher: TeacherMe | null;
  exams: Exam[];
  myAssignments: Assignment[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>();
  const [rows, setRows] = useState<MarksRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedAssignment = myAssignments.find((a) => a.subjectId === selectedSubjectId);

  async function loadStudentsAndMarks() {
    if (!selectedExamId || !selectedSubjectId || !selectedAssignment) return;
    setLoadingStudents(true);
    try {
      const qs = new URLSearchParams({ classId: selectedAssignment.classId.toString() });
      if (selectedAssignment.sectionId) qs.set("sectionId", selectedAssignment.sectionId.toString());

      const [studentList, existingMarks] = await Promise.all([
        teacherApi.get<Student[]>(`/students?${qs}`),
        teacherApi.get<ExamMark[]>(
          `/exam-marks?examId=${selectedExamId}&classId=${selectedAssignment.classId}&subjectId=${selectedSubjectId}`,
        ),
      ]);

      const marksByStudent: Record<number, ExamMark> = {};
      (Array.isArray(existingMarks) ? existingMarks : []).forEach(
        (m) => { marksByStudent[m.studentId] = m; },
      );

      setRows(
        (Array.isArray(studentList) ? studentList : [])
          .sort((a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0))
          .map((s) => {
            const e = marksByStudent[s.id];
            return {
              studentId: s.id,
              studentName: s.studentName,
              rollNo: s.rollNo ?? 0,
              sectionId: s.sectionId,
              theoryMarks: e?.theoryMarks ?? "",
              practicalMarks: e?.practicalMarks ?? "",
              internalMarks: e?.internalMarks ?? "",
              isAbsent: e?.isAbsent ?? false,
              remarks: e?.remarks ?? "",
              saved: !!e,
              dirty: false,
            };
          }),
      );
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoadingStudents(false);
    }
  }

  function updateRow(idx: number, field: keyof MarksRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, dirty: true, saved: false } : r,
      ),
    );
  }

  async function handleSave() {
    if (!selectedExamId || !selectedSubjectId || !selectedAssignment) {
      toast({ title: "Select exam and subject first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await teacherApi.post("/exam-marks/bulk", {
        marks: rows.map((r) => ({
          examId: selectedExamId,
          studentId: r.studentId,
          subjectId: selectedSubjectId,
          classId: selectedAssignment.classId,
          sectionId: r.sectionId ?? selectedAssignment.sectionId,
          theoryMarks: r.isAbsent ? undefined : (r.theoryMarks || undefined),
          practicalMarks: r.isAbsent ? undefined : (r.practicalMarks || undefined),
          internalMarks: r.isAbsent ? undefined : (r.internalMarks || undefined),
          isAbsent: r.isAbsent,
          remarks: r.remarks || undefined,
        })),
      });
      setRows((prev) => prev.map((r) => ({ ...r, saved: true, dirty: false })));
      toast({ title: `✓ Marks saved for ${rows.length} students` });
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const unsaved = rows.filter((r) => r.dirty).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookUser className="h-4 w-4 text-amber-500" />
          Enter / Update Marks — My Assigned Subject
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Select Exam</Label>
            <Select
              value={selectedExamId?.toString() ?? ""}
              onValueChange={(v) => { setSelectedExamId(parseInt(v)); setRows([]); }}
            >
              <SelectTrigger><SelectValue placeholder="Choose an exam" /></SelectTrigger>
              <SelectContent>
                {exams.length === 0
                  ? <SelectItem value="__none" disabled>No active exams</SelectItem>
                  : exams.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name} <span className="text-muted-foreground text-xs ml-1">{e.status}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Your Assigned Subject</Label>
            <Select
              value={selectedSubjectId?.toString() ?? ""}
              onValueChange={(v) => { setSelectedSubjectId(parseInt(v)); setRows([]); }}
            >
              <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
              <SelectContent>
                {myAssignments.length === 0
                  ? <SelectItem value="__none" disabled>No assignments found</SelectItem>
                  : myAssignments.map((a) => (
                    <SelectItem key={`${a.subjectId}-${a.classId}`} value={a.subjectId.toString()}>
                      {a.subjectName} — {a.className}
                      {a.sectionName ? ` (${a.sectionName})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={loadStudentsAndMarks}
            disabled={!selectedExamId || !selectedSubjectId || loadingStudents}
            variant="outline"
          >
            {loadingStudents
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Load Students
          </Button>
          {rows.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {rows.length} students
              {unsaved > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  · {unsaved} unsaved
                </span>
              )}
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-24">Theory</TableHead>
                    <TableHead className="w-24">Practical</TableHead>
                    <TableHead className="w-24">Internal</TableHead>
                    <TableHead className="w-16 text-center">Absent</TableHead>
                    <TableHead className="w-32">Remarks</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={row.studentId}
                      className={row.isAbsent ? "opacity-50 bg-red-50/50" : row.dirty ? "bg-amber-50/50" : ""}
                    >
                      <TableCell className="font-mono text-sm">{row.rollNo || "—"}</TableCell>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0} value={row.theoryMarks}
                          disabled={row.isAbsent} onChange={(e) => updateRow(idx, "theoryMarks", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0} value={row.practicalMarks}
                          disabled={row.isAbsent} onChange={(e) => updateRow(idx, "practicalMarks", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0} value={row.internalMarks}
                          disabled={row.isAbsent} onChange={(e) => updateRow(idx, "internalMarks", e.target.value)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" className="w-4 h-4 accent-red-500" checked={row.isAbsent}
                          onChange={(e) => updateRow(idx, "isAbsent", e.target.checked)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-28" value={row.remarks} placeholder="Optional"
                          onChange={(e) => updateRow(idx, "remarks", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        {row.saved && !row.dirty && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Marks
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 2: All Subjects View ─────────────────────────────────────────────────
function AllSubjectsTab({
  teacher,
  exams,
  myAssignments,
  toast,
}: {
  teacher: TeacherMe | null;
  exams: Exam[];
  myAssignments: Assignment[];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>();
  const [loadingData, setLoadingData] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allMarks, setAllMarks] = useState<ExamMark[]>([]);
  const [classAssignments, setClassAssignments] = useState<Assignment[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<MarksRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<number, string>>({});
  const [requestingApproval, setRequestingApproval] = useState<number | null>(null);

  const classId = teacher?.classAssigned ?? (myAssignments.length > 0 ? myAssignments[0].classId : null);

  async function loadAll() {
    if (!selectedExamId || !classId) return;
    setLoadingData(true);
    setEditingSubjectId(null);
    try {
      const [subjectList, studentList, marksList, classAsgList] = await Promise.all([
        teacherApi.get<Subject[]>(`/subjects?classId=${classId}`),
        teacherApi.get<Student[]>(`/students?classId=${classId}`),
        teacherApi.get<ExamMark[]>(`/exam-marks?examId=${selectedExamId}&classId=${classId}`),
        teacherApi.get<Assignment[]>(`/teacher-subject-assignments?classId=${classId}`),
      ]);
      setSubjects(Array.isArray(subjectList) ? subjectList : []);
      setStudents(
        (Array.isArray(studentList) ? studentList : []).sort(
          (a, b) => (a.rollNo ?? 0) - (b.rollNo ?? 0),
        ),
      );
      setAllMarks(Array.isArray(marksList) ? marksList : []);
      setClassAssignments(Array.isArray(classAsgList) ? classAsgList : []);
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoadingData(false);
      void loadApprovalStatuses();
    }
  }

  async function loadApprovalStatuses() {
    if (!selectedExamId || !classId) return;
    try {
      const res = await teacherApi.get<Array<{subjectId: number; examId: number; classId: number; status: string; validUntil?: string}>>("/teacher-mark-approvals/my");
      const map: Record<number, string> = {};
      for (const r of res) {
        if (r.examId === selectedExamId && r.classId === classId) {
          const isValid = r.status === "approved" && (!r.validUntil || new Date(r.validUntil) > new Date());
          map[r.subjectId] = isValid ? "approved_active" : r.status;
        }
      }
      setApprovalStatuses(map);
    } catch { }
  }

  async function requestApproval(subjectId: number) {
    if (!selectedExamId || !classId) return;
    setRequestingApproval(subjectId);
    try {
      await teacherApi.post("/teacher-mark-approvals", { examId: selectedExamId, classId, subjectId });
      setApprovalStatuses(prev => ({ ...prev, [subjectId]: "pending" }));
      toast({ title: "Approval requested! Admin will review it soon." });
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Request failed", variant: "destructive" });
    } finally {
      setRequestingApproval(null);
    }
  }

  // Marks lookup: "studentId-subjectId" → ExamMark
  const marksMap: Record<string, ExamMark> = {};
  for (const m of allMarks) {
    marksMap[`${m.studentId}-${m.subjectId}`] = m;
  }

  function canEditSubject(subjectId: number): { canEdit: boolean; label: string; color: string } {
    const approvalStatus = approvalStatuses[subjectId];
    if (approvalStatus === "approved_active") {
      return { canEdit: true, label: "Approved", color: "border-purple-400 text-purple-700 bg-purple-50" };
    }
    const assigned = classAssignments.filter((a) => a.subjectId === subjectId);
    if (assigned.length === 0) {
      return { canEdit: true, label: "Open", color: "border-blue-400 text-blue-700 bg-blue-50" };
    }
    const isMe = assigned.some((a) => a.teacherId === teacher?.id);
    if (isMe) {
      return { canEdit: true, label: "Mine", color: "border-amber-400 text-amber-700 bg-amber-50" };
    }
    return { canEdit: false, label: "Other", color: "border-slate-300 text-slate-500 bg-slate-50" };
  }

  function startEdit(subjectId: number) {
    const rows: MarksRow[] = students.map((s) => {
      const m = marksMap[`${s.id}-${subjectId}`];
      return {
        studentId: s.id,
        studentName: s.studentName,
        rollNo: s.rollNo ?? 0,
        sectionId: s.sectionId,
        theoryMarks: m?.theoryMarks ?? "",
        practicalMarks: m?.practicalMarks ?? "",
        internalMarks: m?.internalMarks ?? "",
        isAbsent: m?.isAbsent ?? false,
        remarks: m?.remarks ?? "",
        saved: !!m,
        dirty: false,
      };
    });
    setEditRows(rows);
    setEditingSubjectId(subjectId);
  }

  function updateEditRow(idx: number, field: keyof MarksRow, value: string | boolean) {
    setEditRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  async function saveEditSubject() {
    if (!editingSubjectId || !selectedExamId || !classId) return;
    setSaving(true);
    try {
      await teacherApi.post("/exam-marks/bulk", {
        marks: editRows.map((r) => ({
          examId: selectedExamId,
          studentId: r.studentId,
          subjectId: editingSubjectId,
          classId,
          sectionId: r.sectionId,
          theoryMarks: r.isAbsent ? undefined : (r.theoryMarks || undefined),
          practicalMarks: r.isAbsent ? undefined : (r.practicalMarks || undefined),
          internalMarks: r.isAbsent ? undefined : (r.internalMarks || undefined),
          isAbsent: r.isAbsent,
          remarks: r.remarks || undefined,
        })),
      });
      toast({ title: `✓ Marks saved for ${editRows.length} students` });
      setEditingSubjectId(null);
      setEditRows([]);
      await loadAll();
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!classId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
          <p>No class assigned. Ask the admin to assign you a class.</p>
        </CardContent>
      </Card>
    );
  }

  const editingSubject = subjects.find((s) => s.id === editingSubjectId);

  return (
    <div className="space-y-4">
      {/* Exam selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <Label>Select Exam</Label>
              <Select
                value={selectedExamId?.toString() ?? ""}
                onValueChange={(v) => {
                  setSelectedExamId(parseInt(v));
                  setSubjects([]);
                  setStudents([]);
                  setAllMarks([]);
                  setEditingSubjectId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                <SelectContent>
                  {exams.length === 0
                    ? <SelectItem value="__none" disabled>No active exams</SelectItem>
                    : exams.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.name} <span className="text-muted-foreground text-xs ml-1">{e.status}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadAll} disabled={!selectedExamId || loadingData} variant="outline" className="gap-1.5">
              {loadingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Load Results
            </Button>
          </div>

          {/* Legend */}
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <strong>Mine</strong> — your subject
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                <strong>Open</strong> — no teacher assigned (you can fill in)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                <strong>Other</strong> — click <Send className="h-3 w-3 inline mx-0.5" /> to request approval
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                <strong>Approved</strong> — admin granted temporary access
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline edit panel */}
      {editingSubjectId && editingSubject && (
        <Card className="border-amber-300 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-amber-500" />
                Editing: <span className="text-amber-600">{editingSubject.name}</span>
                <span className="text-muted-foreground font-normal text-sm">
                  (T/{editingSubject.maxTheoryMarks} · P/{editingSubject.maxPracticalMarks} · I/{editingSubject.maxInternalMarks})
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setEditingSubjectId(null); setEditRows([]); }} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50">
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-24">Theory</TableHead>
                    <TableHead className="w-24">Practical</TableHead>
                    <TableHead className="w-24">Internal</TableHead>
                    <TableHead className="w-16 text-center">Absent</TableHead>
                    <TableHead className="w-32">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editRows.map((row, idx) => (
                    <TableRow key={row.studentId} className={row.isAbsent ? "opacity-50 bg-red-50/60" : ""}>
                      <TableCell className="font-mono text-sm">{row.rollNo || "—"}</TableCell>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0}
                          max={parseFloat(editingSubject.maxTheoryMarks) || undefined}
                          value={row.theoryMarks} disabled={row.isAbsent}
                          onChange={(e) => updateEditRow(idx, "theoryMarks", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0}
                          max={parseFloat(editingSubject.maxPracticalMarks) || undefined}
                          value={row.practicalMarks} disabled={row.isAbsent}
                          onChange={(e) => updateEditRow(idx, "practicalMarks", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-20" type="number" min={0}
                          max={parseFloat(editingSubject.maxInternalMarks) || undefined}
                          value={row.internalMarks} disabled={row.isAbsent}
                          onChange={(e) => updateEditRow(idx, "internalMarks", e.target.value)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <input type="checkbox" className="w-4 h-4 accent-red-500" checked={row.isAbsent}
                          onChange={(e) => updateEditRow(idx, "isAbsent", e.target.checked)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 w-28" value={row.remarks} placeholder="Optional"
                          onChange={(e) => updateEditRow(idx, "remarks", e.target.value)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEditSubject} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save {editingSubject.name} Marks
              </Button>
              <Button variant="outline" onClick={() => { setEditingSubjectId(null); setEditRows([]); }} disabled={saving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class results grid */}
      {subjects.length > 0 && students.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Class Results — {students.length} students · {subjects.length} subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="min-w-12">Roll</TableHead>
                    <TableHead className="min-w-36">Student</TableHead>
                    {subjects.map((subj) => {
                      const { canEdit, label, color } = canEditSubject(subj.id);
                      const isEditing = editingSubjectId === subj.id;
                      return (
                        <TableHead key={subj.id} className="min-w-28">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium leading-tight">{subj.name}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${color}`}>
                                {label === "Other" && <Lock className="h-2.5 w-2.5 mr-0.5 inline" />}
                                {label}
                              </Badge>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    if (isEditing) {
                                      setEditingSubjectId(null);
                                      setEditRows([]);
                                    } else {
                                      startEdit(subj.id);
                                    }
                                  }}
                                  title={isEditing ? "Cancel editing" : `Edit ${subj.name}`}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs transition-colors ${
                                    isEditing
                                      ? "bg-amber-500 text-white"
                                      : "bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-700"
                                  }`}
                                >
                                  {isEditing ? <X className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                                </button>
                              )}
                              {!canEdit && (
                                <button
                                  onClick={() => void requestApproval(subj.id)}
                                  disabled={requestingApproval === subj.id || approvalStatuses[subj.id] === "pending"}
                                  title={approvalStatuses[subj.id] === "pending" ? "Approval pending admin review" : "Request admin approval to enter marks"}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs transition-colors ${
                                    approvalStatuses[subj.id] === "pending"
                                      ? "bg-amber-100 text-amber-600 cursor-not-allowed"
                                      : "bg-slate-100 hover:bg-purple-100 text-slate-400 hover:text-purple-700"
                                  }`}
                                >
                                  {requestingApproval === subj.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : approvalStatuses[subj.id] === "pending" ? (
                                    <Clock className="h-3 w-3" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="min-w-24">Total</TableHead>
                    <TableHead className="min-w-16">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const totalObtained = subjects.reduce((sum, s) => {
                      const m = marksMap[`${student.id}-${s.id}`];
                      if (!m || m.isAbsent) return sum;
                      return sum + (parseFloat(m.totalMarks ?? "0") || 0);
                    }, 0);
                    const totalMax = subjects.reduce((sum, s) => {
                      return sum +
                        parseFloat(s.maxTheoryMarks || "0") +
                        parseFloat(s.maxPracticalMarks || "0") +
                        parseFloat(s.maxInternalMarks || "0");
                    }, 0);
                    const pct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
                    const hasAny = subjects.some((s) => marksMap[`${student.id}-${s.id}`] !== undefined);

                    const gradeLabel =
                      pct >= 90 ? "A1" : pct >= 80 ? "A2" : pct >= 70 ? "B1" :
                      pct >= 60 ? "B2" : pct >= 50 ? "C1" : pct >= 40 ? "C2" :
                      pct >= 33 ? "D" : "E";
                    const gradeColor =
                      pct >= 60 ? "border-green-400 text-green-700" :
                      pct >= 33 ? "border-amber-400 text-amber-700" : "border-red-400 text-red-700";

                    return (
                      <TableRow key={student.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-sm">{student.rollNo || "—"}</TableCell>
                        <TableCell className="font-medium text-sm">{student.studentName}</TableCell>
                        {subjects.map((subj) => {
                          const m = marksMap[`${student.id}-${subj.id}`];
                          return (
                            <TableCell key={subj.id} className="text-center text-sm">
                              {!m ? (
                                <span className="text-muted-foreground">—</span>
                              ) : m.isAbsent ? (
                                <span className="text-red-500 font-medium text-xs">AB</span>
                              ) : (
                                <span>
                                  <span className="font-medium">{m.totalMarks ?? "—"}</span>
                                  {m.grade && (
                                    <span className="text-[10px] text-muted-foreground ml-0.5">({m.grade})</span>
                                  )}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-sm">
                          {hasAny ? (
                            <span className="font-semibold">
                              {totalObtained.toFixed(0)}/{totalMax.toFixed(0)}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({pct.toFixed(1)}%)
                              </span>
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {hasAny && totalMax > 0 ? (
                            <Badge variant="outline" className={gradeColor}>
                              {gradeLabel}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedExamId && !loadingData && subjects.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertCircle className="h-7 w-7 mx-auto mb-2 text-slate-400" />
            No subjects found for your class. Click "Load Results" to refresh.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
