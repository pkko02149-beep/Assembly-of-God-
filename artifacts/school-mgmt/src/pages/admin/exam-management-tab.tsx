import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  FileText,
  CreditCard,
  Lock,
  Unlock,
  Printer,
  Loader2,
  Plus,
  Trash2,
  GraduationCap,
  ClipboardList,
  Users,
  BarChart2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  AlertCircle,
  Edit2,
  X,
  Mail,
  EyeOff,
  Eye,
  Clock,
  Send,
  ThumbsUp,
  ThumbsDown,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useListClasses,
  useListSections,
  useListSubjects,
  useCreateSubject,
  useDeleteSubject,
  useListExams,
  useCreateExam,
  useDeleteExam,
  useUpdateExamStatus,
  useListExamSchedules,
  useCreateExamSchedule,
  useDeleteExamSchedule,
  useListExamMarks,
  useBulkSaveExamMarks,
  useGetExamResults,
  useListTeacherSubjectAssignments,
  useCreateTeacherSubjectAssignment,
  useDeleteTeacherSubjectAssignment,
  useListGradingRules,
  useDeleteGradingRule,
  useResetGradingRules,
  useGetMarksEntryStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminToken } from "@/lib/auth";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

const EXAM_TYPES = [
  { value: "PT1", label: "PT1 (Periodic Test 1)" },
  { value: "HALF_YEAR", label: "Half Yearly Examination" },
  { value: "PT2", label: "PT2 (Periodic Test 2)" },
  { value: "ANNUAL", label: "Annual Examination" },
];

const EXAM_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "active", label: "Active", color: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", color: "bg-yellow-100 text-yellow-700" },
  { value: "published", label: "Published", color: "bg-green-100 text-green-700" },
];

const CURRENT_SESSION = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

/** Fetch the real current academic session name from the API (e.g. "2028-2029"). */
async function fetchCurrentSession(): Promise<string> {
  try {
    const r = await fetch("/api/academic-sessions/status");
    const d = await r.json();
    if (d?.currentSession?.name) return d.currentSession.name;
  } catch { /* ignore */ }
  return CURRENT_SESSION; // fallback to calendar-year default
}

function statusBadge(status: string) {
  const s = EXAM_STATUSES.find((x) => x.value === status);
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s?.color ?? "bg-gray-100 text-gray-600"}`}>
      {s?.label ?? status}
    </span>
  );
}

interface ResultItem {
  studentId?: number;
  studentName?: string;
  rollNo?: number;
  totalObtained?: string;
  totalMax?: string;
  overallPercentage?: string;
  grade?: string;
  result?: string;
  rank?: number;
}

// ── Subjects Tab ──────────────────────────────────────────────────────────────
function SubjectsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: classes = [] } = useListClasses();
  const [classId, setClassId] = useState<number | undefined>();
  const { data: subjects = [], isLoading } = useListSubjects(classId ? { classId } : {});
  const createMutation = useCreateSubject();
  const deleteMutation = useDeleteSubject();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    classId: "",
    maxTheoryMarks: "80",
    maxPracticalMarks: "20",
    maxInternalMarks: "0",
    isOptional: false,
    orderIndex: 0,
  });

  async function handleCreate() {
    if (!form.name || !form.classId) {
      toast({ title: "Name and class are required", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          code: form.code || undefined,
          classId: parseInt(form.classId),
          maxTheoryMarks: form.maxTheoryMarks || undefined,
          maxPracticalMarks: form.maxPracticalMarks || undefined,
          maxInternalMarks: form.maxInternalMarks || undefined,
          isOptional: form.isOptional,
          orderIndex: form.orderIndex,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Subject created" });
      setOpen(false);
      setForm({
        name: "", code: "", classId: "",
        maxTheoryMarks: "80", maxPracticalMarks: "20", maxInternalMarks: "0",
        isOptional: false, orderIndex: 0,
      });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label>Filter by Class:</Label>
          <Select
            value={classId?.toString() ?? "all"}
            onValueChange={(v) => setClassId(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Subject
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Class</TableHead>
              <TableHead>Theory</TableHead><TableHead>Practical</TableHead><TableHead>Internal</TableHead>
              <TableHead>Optional</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No subjects found</TableCell></TableRow>
            ) : subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.code ?? "—"}</TableCell>
                <TableCell>{s.className ?? "—"}</TableCell>
                <TableCell>{s.maxTheoryMarks ?? "—"}</TableCell>
                <TableCell>{s.maxPracticalMarks ?? "—"}</TableCell>
                <TableCell>{s.maxInternalMarks ?? "—"}</TableCell>
                <TableCell>{s.isOptional ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (!confirm("Delete this subject?")) return;
                    await deleteMutation.mutateAsync({ id: s.id });
                    qc.invalidateQueries({ queryKey: ["/api/subjects"] });
                    toast({ title: "Deleted" });
                  }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH" />
              </div>
            </div>
            <div>
              <Label>Class *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Max Theory</Label>
                <Input type="number" value={form.maxTheoryMarks} onChange={(e) => setForm({ ...form, maxTheoryMarks: e.target.value })} />
              </div>
              <div>
                <Label>Max Practical</Label>
                <Input type="number" value={form.maxPracticalMarks} onChange={(e) => setForm({ ...form, maxPracticalMarks: e.target.value })} />
              </div>
              <div>
                <Label>Max Internal</Label>
                <Input type="number" value={form.maxInternalMarks} onChange={(e) => setForm({ ...form, maxInternalMarks: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isOptional" checked={form.isOptional} onChange={(e) => setForm({ ...form, isOptional: e.target.checked })} />
              <Label htmlFor="isOptional">Optional Subject</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Exams Tab ─────────────────────────────────────────────────────────────────
function ExamsTab({ currentSession }: { currentSession: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterSession, setFilterSession] = useState(currentSession);
  const [filterStatus, setFilterStatus] = useState("all");
  const { data: exams = [], isLoading } = useListExams({
    session: filterSession,
    status: filterStatus === "all" ? undefined : filterStatus,
  });
  const createMutation = useCreateExam();
  const deleteMutation = useDeleteExam();
  const statusMutation = useUpdateExamStatus();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "PT1",
    session: currentSession,
    startDate: "",
    endDate: "",
    resultPublishDate: "",
    passingPercentage: "33",
  });

  // Sync to the active session if it loads after first render
  useEffect(() => {
    setFilterSession(currentSession);
    setForm(f => ({ ...f, session: currentSession }));
  }, [currentSession]);

  async function handleCreate() {
    if (!form.name) { toast({ title: "Exam name required", variant: "destructive" }); return; }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          type: form.type || undefined,
          session: form.session,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          resultPublishDate: form.resultPublishDate || undefined,
          passingPercentage: form.passingPercentage || undefined,
          status: "draft",
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({ title: "Exam created" });
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  async function changeStatus(id: number, status: string) {
    try {
      await statusMutation.mutateAsync({ id, data: { status } });
      qc.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({ title: `Status updated to ${status}` });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input className="w-36" value={filterSession} onChange={(e) => setFilterSession(e.target.value)} placeholder="Session" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {EXAM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Exam
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Session</TableHead>
              <TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No exams found</TableCell></TableRow>
            ) : exams.map((exam) => (
              <TableRow key={exam.id}>
                <TableCell className="font-medium">{exam.name}</TableCell>
                <TableCell>{exam.type ?? "—"}</TableCell>
                <TableCell>{exam.session ?? "—"}</TableCell>
                <TableCell>{exam.startDate ?? "—"}</TableCell>
                <TableCell>{exam.endDate ?? "—"}</TableCell>
                <TableCell>{statusBadge(exam.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {exam.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(exam.id, "active")}>Activate</Button>
                    )}
                    {exam.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(exam.id, "completed")}>Complete</Button>
                    )}
                    {exam.status === "completed" && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(exam.id, "published")}>Publish</Button>
                    )}
                    {exam.status === "published" && (
                      <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => {
                        if (!confirm("Reverse this exam from Published back to Completed?")) return;
                        changeStatus(exam.id, "completed");
                      }}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Reverse
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={async () => {
                      if (!confirm("Delete this exam?")) return;
                      await deleteMutation.mutateAsync({ id: exam.id });
                      qc.invalidateQueries({ queryKey: ["/api/exams"] });
                      toast({ title: "Deleted" });
                    }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Exam Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Half Yearly 2025-26" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Session</Label>
                <Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Result Publish Date</Label>
                <Input type="date" value={form.resultPublishDate} onChange={(e) => setForm({ ...form, resultPublishDate: e.target.value })} />
              </div>
              <div>
                <Label>Passing %</Label>
                <Input type="number" value={form.passingPercentage} onChange={(e) => setForm({ ...form, passingPercentage: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
function ScheduleTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: classes = [] } = useListClasses();
  const { data: exams = [] } = useListExams({});
  const [filterExamId, setFilterExamId] = useState<number | undefined>();
  const [filterClassId, setFilterClassId] = useState<number | undefined>();
  const { data: subjects = [] } = useListSubjects(filterClassId ? { classId: filterClassId } : {});
  const { data: schedules = [], isLoading } = useListExamSchedules({
    examId: filterExamId,
    classId: filterClassId,
  });
  const createMutation = useCreateExamSchedule();
  const deleteMutation = useDeleteExamSchedule();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    examId: "", subjectId: "", classId: "", examDate: "",
    startTime: "", endTime: "", room: "", invigilator: "",
  });
  const [formSubjects, setFormSubjects] = useState<{ id: number; name: string }[]>([]);

  function handleFormClassChange(v: string) {
    setForm({ ...form, classId: v, subjectId: "" });
    fetch(`/api/subjects?classId=${v}`).then((r) => r.json()).then(setFormSubjects).catch(() => setFormSubjects([]));
  }

  async function handleCreate() {
    if (!form.examId || !form.subjectId || !form.classId) {
      toast({ title: "Exam, subject and class are required", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          examId: parseInt(form.examId),
          subjectId: parseInt(form.subjectId),
          classId: parseInt(form.classId),
          examDate: form.examDate || undefined,
          startTime: form.startTime || undefined,
          endTime: form.endTime || undefined,
          room: form.room || undefined,
          invigilator: form.invigilator || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
      toast({ title: "Schedule created" });
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={filterExamId?.toString() ?? "all"}
            onValueChange={(v) => setFilterExamId(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="All Exams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {exams.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={filterClassId?.toString() ?? "all"}
            onValueChange={(v) => setFilterClassId(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead>
              <TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Room</TableHead>
              <TableHead>Invigilator</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No schedules found</TableCell></TableRow>
            ) : schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.examName ?? "—"}</TableCell>
                <TableCell>{s.subjectName ?? "—"}</TableCell>
                <TableCell>{s.className ?? "—"}</TableCell>
                <TableCell>{s.examDate ?? "—"}</TableCell>
                <TableCell>{s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : "—"}</TableCell>
                <TableCell>{s.room ?? "—"}</TableCell>
                <TableCell>{s.invigilator ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (!confirm("Delete?")) return;
                    await deleteMutation.mutateAsync({ id: s.id });
                    qc.invalidateQueries({ queryKey: ["/api/exam-schedules"] });
                    toast({ title: "Deleted" });
                  }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Exam Schedule</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Exam *</Label>
              <Select value={form.examId} onValueChange={(v) => setForm({ ...form, examId: v })}>
                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class *</Label>
              <Select value={form.classId} onValueChange={handleFormClassChange}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {(formSubjects.length > 0 ? formSubjects : subjects).map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
              </div>
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Room</Label>
                <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
              <div>
                <Label>Invigilator</Label>
                <Input value={form.invigilator} onChange={(e) => setForm({ ...form, invigilator: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Teacher Assignments Tab ───────────────────────────────────────────────────
function TeacherAssignmentsTab({ currentSession }: { currentSession: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const [filterClassId, setFilterClassId] = useState<number | undefined>();
  const { data: subjects = [] } = useListSubjects(filterClassId ? { classId: filterClassId } : {});
  const assignmentParams = filterClassId !== undefined
    ? { classId: filterClassId, session: currentSession }
    : { session: currentSession };
  const { data: rawAssignments, isLoading, isError } = useListTeacherSubjectAssignments(assignmentParams);
  const assignments = Array.isArray(rawAssignments) ? rawAssignments : [];
  const createMutation = useCreateTeacherSubjectAssignment();
  const deleteMutation = useDeleteTeacherSubjectAssignment();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    teacherId: "", subjectId: "", classId: "", sectionId: "", session: currentSession,
  });

  // Sync form session when active session changes
  useEffect(() => {
    setForm(f => ({ ...f, session: currentSession }));
  }, [currentSession]);
  const [teachers, setTeachers] = useState<{ id: number; name: string; subject: string }[]>([]);
  const [teacherSubjectNames, setTeacherSubjectNames] = useState<string[]>([]);
  const [formSubjects, setFormSubjects] = useState<{ id: number; name: string }[]>([]);
  const [formSections, setFormSections] = useState<{ id: number; name: string }[]>([]);

  function loadTeachers() {
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((d) => setTeachers(Array.isArray(d) ? d.map((t: { id: number; name: string; subject?: string }) => ({ id: t.id, name: t.name, subject: t.subject ?? "" })) : []))
      .catch(() => setTeachers([]));
  }

  function handleTeacherChange(v: string) {
    const teacher = teachers.find((t) => t.id.toString() === v);
    const subjects = teacher?.subject
      ? teacher.subject.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];
    setTeacherSubjectNames(subjects);
    setForm({ ...form, teacherId: v, subjectId: "" });
    // Re-filter formSubjects if class already selected
    if (form.classId) {
      filterFormSubjectsByTeacher(form.classId, subjects);
    }
  }

  async function filterFormSubjectsByTeacher(classId: string, teacherSubjects: string[]) {
    try {
      const all: { id: number; name: string }[] = await fetch(`/api/subjects?classId=${classId}`).then((r) => r.json());
      const filtered = teacherSubjects.length > 0
        ? all.filter((s) => teacherSubjects.some((ts) => s.name.toLowerCase().includes(ts) || ts.includes(s.name.toLowerCase())))
        : all;
      setFormSubjects(filtered.length > 0 ? filtered : all);
    } catch {
      setFormSubjects([]);
    }
  }

  function handleFormClassChange(v: string) {
    setForm({ ...form, classId: v, subjectId: "", sectionId: "" });
    filterFormSubjectsByTeacher(v, teacherSubjectNames);
    setFormSections(
      sections
        .filter((s) => !s.classId || s.classId === parseInt(v))
        .map((s) => ({ id: s.id, name: s.name })),
    );
  }

  async function handleCreate() {
    if (!form.teacherId || !form.subjectId || !form.classId) {
      toast({ title: "Teacher, subject and class required", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          teacherId: parseInt(form.teacherId),
          subjectId: parseInt(form.subjectId),
          classId: parseInt(form.classId),
          sectionId: (form.sectionId && form.sectionId !== "none") ? parseInt(form.sectionId) : undefined,
          session: form.session || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/teacher-subject-assignments"] });
      toast({ title: "Assignment created" });
      setOpen(false);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select
          value={filterClassId?.toString() ?? "all"}
          onValueChange={(v) => setFilterClassId(v === "all" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="w-40"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { loadTeachers(); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Assign Teacher
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : isError ? (
        <div className="text-center py-8 text-red-500">Failed to load assignments. Please refresh.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead><TableHead>Subject</TableHead><TableHead>Class</TableHead>
              <TableHead>Section</TableHead><TableHead>Session</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No assignments found. Click &quot;Assign Teacher&quot; to add one.</TableCell></TableRow>
            ) : assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.teacherName ?? `Teacher #${a.teacherId}`}</TableCell>
                <TableCell>{a.subjectName ?? "—"}</TableCell>
                <TableCell>{a.className ?? "—"}</TableCell>
                <TableCell>{a.sectionName ?? "All"}</TableCell>
                <TableCell>{a.session ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (!confirm("Delete assignment?")) return;
                    await deleteMutation.mutateAsync({ id: a.id });
                    qc.invalidateQueries({ queryKey: ["/api/teacher-subject-assignments"] });
                    toast({ title: "Deleted" });
                  }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign Teacher to Subject</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Teacher *</Label>
              <Select value={form.teacherId} onValueChange={handleTeacherChange}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}{t.subject ? ` — ${t.subject}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class *</Label>
              <Select value={form.classId} onValueChange={handleFormClassChange}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subject *</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {(formSubjects.length > 0 ? formSubjects : subjects).map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Section (optional)</Label>
                <Select value={form.sectionId} onValueChange={(v) => setForm({ ...form, sectionId: v })}>
                  <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Sections</SelectItem>
                    {formSections.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Session</Label>
              <Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Results Management Tab ────────────────────────────────────────────────────
interface AdminMarksRow {
  studentId: number;
  studentName: string;
  rollNo: number;
  theoryMarks: string;
  practicalMarks: string;
  internalMarks: string;
  isAbsent: boolean;
  remarks: string;
  isDirty: boolean;
}

function PerSubjectEntryTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: exams = [] } = useListExams({});
  const [examId, setExamId] = useState<number | undefined>();
  const [classId, setClassId] = useState<number | undefined>();
  const [sectionId, setSectionId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const { data: subjects = [] } = useListSubjects(classId ? { classId } : {});
  const { data: rawEntryStatus = [], refetch: refetchStatus } = useGetMarksEntryStatus(examId ?? 0);
  const entryStatus = examId ? rawEntryStatus : [];
  const bulkMutation = useBulkSaveExamMarks();
  const statusMutation = useUpdateExamStatus();

  const [rows, setRows] = useState<AdminMarksRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [nameFilter, setNameFilter] = useState("");

  const selectedExam = exams.find((e) => e.id === examId);
  const isPublished = selectedExam?.status === "published";
  const filteredSections = classId ? sections.filter((s) => !s.classId || s.classId === classId) : sections;
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Subject-level completion for the current class
  const subjectStatuses = entryStatus.filter(
    (s) => s.classId === classId && (!sectionId || !s.sectionId || s.sectionId === sectionId),
  );
  const allComplete = subjectStatuses.length > 0 && subjectStatuses.every((s) => s.status === "complete");

  const statusCfg: Record<string, { label: string; cls: string }> = {
    complete: { label: "Complete", cls: "bg-green-100 text-green-700 border-green-200" },
    partial: { label: "Partial", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    not_started: { label: "Not Started", cls: "bg-red-100 text-red-700 border-red-200" },
  };

  async function loadStudents() {
    if (!classId || !subjectId || !examId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ classId: classId.toString() });
      if (sectionId) qs.set("sectionId", sectionId.toString());
      const marksQs = new URLSearchParams({ examId: examId.toString(), classId: classId.toString() });
      if (sectionId) marksQs.set("sectionId", sectionId.toString());
      const [students, existingMarks] = await Promise.all([
        fetch(`/api/students?${qs}`).then((r) => r.json()),
        fetch(`/api/exam-marks?${marksQs}`).then((r) => r.json()),
      ]);
      const marksByStudent: Record<number, { theoryMarks?: string; practicalMarks?: string; internalMarks?: string; isAbsent?: boolean; remarks?: string }> = {};
      (Array.isArray(existingMarks) ? existingMarks : [])
        .filter((m: { subjectId: number }) => m.subjectId === subjectId)
        .forEach((m: { studentId: number; theoryMarks?: string; practicalMarks?: string; internalMarks?: string; isAbsent?: boolean; remarks?: string }) => { marksByStudent[m.studentId] = m; });
      setRows(
        (Array.isArray(students) ? students : [])
          .map((s: { id: number; studentName: string; rollNumber?: string | number }) => {
            const existing = marksByStudent[s.id];
            return {
              studentId: s.id,
              studentName: s.studentName,
              rollNo: typeof s.rollNumber === "number" ? s.rollNumber : parseInt(String(s.rollNumber ?? "0")) || 0,
              theoryMarks: existing?.theoryMarks ?? "",
              practicalMarks: existing?.practicalMarks ?? "",
              internalMarks: existing?.internalMarks ?? "",
              isAbsent: existing?.isAbsent ?? false,
              remarks: existing?.remarks ?? "",
              isDirty: false,
            };
          })
          .sort((a: AdminMarksRow, b: AdminMarksRow) => a.rollNo - b.rollNo),
      );
      refetchStatus();
    } catch {
      toast({ title: "Failed to load students", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, field: keyof AdminMarksRow, value: string | boolean) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value, isDirty: true } : r));
  }

  async function handleSave() {
    if (!examId || !classId || !subjectId) {
      toast({ title: "Select exam, class and subject first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await bulkMutation.mutateAsync({
        data: {
          marks: rows.map((r) => ({
            examId,
            studentId: r.studentId,
            subjectId: subjectId!,
            classId,
            sectionId,
            theoryMarks: r.isAbsent ? undefined : (r.theoryMarks || undefined),
            practicalMarks: r.isAbsent ? undefined : (r.practicalMarks || undefined),
            internalMarks: r.isAbsent ? undefined : (r.internalMarks || undefined),
            isAbsent: r.isAbsent,
            remarks: r.remarks || undefined,
          })),
        },
      });
      setRows((prev) => prev.map((r) => ({ ...r, isDirty: false })));
      qc.invalidateQueries({ queryKey: ["/api/exam-marks"] });
      refetchStatus();
      toast({ title: `Marks saved for ${rows.length} students` });
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!examId || !selectedExam) return;
    const confirmed = confirm(
      `Finalize and publish "${selectedExam.name}"?\n\nResults will be visible to parents/students and marks entry will be locked. This cannot be undone.`,
    );
    if (!confirmed) return;
    setPublishing(true);
    try {
      await statusMutation.mutateAsync({ id: examId, data: { status: "published" } });
      qc.invalidateQueries({ queryKey: ["/api/exams"] });
      toast({ title: `"${selectedExam.name}" published — results are now visible.` });
    } catch (e: unknown) {
      toast({ title: (e as Error).message ?? "Publish failed", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>Exam *</Label>
          <Select value={examId?.toString() ?? ""} onValueChange={(v) => { setExamId(parseInt(v)); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id.toString()}>
                  {e.name}
                  {e.status === "published" && <span className="ml-1 text-green-600 text-xs">✓ Published</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class *</Label>
          <Select value={classId?.toString() ?? ""} onValueChange={(v) => { setClassId(parseInt(v)); setSectionId(undefined); setSubjectId(undefined); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Section</Label>
          <Select value={sectionId?.toString() ?? "all"} onValueChange={(v) => { setSectionId(v === "all" ? undefined : parseInt(v)); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {filteredSections.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Subject *</Label>
          <Select value={subjectId?.toString() ?? ""} onValueChange={(v) => { setSubjectId(parseInt(v)); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Exam status banner + finalize button */}
      {selectedExam && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isPublished ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="flex items-center gap-2">
            {isPublished
              ? <CheckCircle2 className="h-5 w-5 text-green-600" />
              : <AlertCircle className="h-5 w-5 text-blue-500" />}
            <span className={`font-medium text-sm ${isPublished ? "text-green-700" : "text-blue-700"}`}>
              {selectedExam.name} — {isPublished ? "Published · Results visible to parents & students" : `Status: ${selectedExam.status}`}
            </span>
          </div>
          {!isPublished && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="bg-green-600 hover:bg-green-700 text-white shrink-0"
            >
              {publishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Finalize &amp; Publish
            </Button>
          )}
        </div>
      )}

      {/* Subject-wise completion cards */}
      {examId && classId && subjectStatuses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Subject Entry Status — click to switch subject</p>
          <div className="flex flex-wrap gap-2">
            {subjectStatuses.map((s) => {
              const cfg = statusCfg[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
              const pct = s.totalStudents > 0 ? Math.round((s.marksEntered / s.totalStudents) * 100) : 0;
              const isSelected = subjectId === s.subjectId;
              return (
                <button
                  key={s.assignmentId}
                  onClick={() => { setSubjectId(s.subjectId); setRows([]); }}
                  className={`border rounded-lg px-3 py-2 text-left transition-all hover:opacity-80 ${cfg.cls} ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                >
                  <div className="font-semibold text-xs">{s.subjectName}</div>
                  <div className="text-xs opacity-75">{s.teacherName || "Unassigned"}</div>
                  <div className="text-xs font-medium">{cfg.label} · {s.marksEntered}/{s.totalStudents}</div>
                  <div className="mt-1 w-20 bg-white/50 rounded-full h-1">
                    <div className={`h-1 rounded-full ${s.status === "complete" ? "bg-green-600" : s.status === "partial" ? "bg-yellow-600" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          {!isPublished && allComplete && (
            <p className="mt-2 text-sm text-green-700 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> All subjects complete — ready to finalize!
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Button onClick={loadStudents} disabled={!examId || !classId || !subjectId || loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Load Students
        </Button>
        {rows.length > 0 && (
          <div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-48"
                placeholder="Search by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          {selectedSubject && (
            <p className="text-sm text-muted-foreground">
              <strong>{selectedSubject.name}</strong> — Max: Theory <strong>{selectedSubject.maxTheoryMarks ?? "—"}</strong>, Practical <strong>{selectedSubject.maxPracticalMarks ?? "—"}</strong>, Internal <strong>{selectedSubject.maxInternalMarks ?? "—"}</strong>
            </p>
          )}
          {isPublished && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <Lock className="h-4 w-4" /> Results are published — marks are read-only.
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Theory</TableHead>
                  <TableHead>Practical</TableHead>
                  <TableHead>Internal</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .filter((row) =>
                    !nameFilter || row.studentName.toLowerCase().includes(nameFilter.toLowerCase()),
                  )
                  .map((row, idx) => (
                  <TableRow
                    key={row.studentId}
                    className={row.isAbsent ? "opacity-50" : row.isDirty ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                  >
                    <TableCell>{row.rollNo || "—"}</TableCell>
                    <TableCell className="font-medium">{row.studentName}</TableCell>
                    <TableCell>
                      <Input className="w-20" type="number" value={row.theoryMarks} disabled={row.isAbsent || isPublished}
                        onChange={(e) => updateRow(idx, "theoryMarks", e.target.value)} min={0} />
                    </TableCell>
                    <TableCell>
                      <Input className="w-20" type="number" value={row.practicalMarks} disabled={row.isAbsent || isPublished}
                        onChange={(e) => updateRow(idx, "practicalMarks", e.target.value)} min={0} />
                    </TableCell>
                    <TableCell>
                      <Input className="w-20" type="number" value={row.internalMarks} disabled={row.isAbsent || isPublished}
                        onChange={(e) => updateRow(idx, "internalMarks", e.target.value)} min={0} />
                    </TableCell>
                    <TableCell>
                      <input type="checkbox" checked={row.isAbsent} disabled={isPublished}
                        onChange={(e) => updateRow(idx, "isAbsent", e.target.checked)} />
                    </TableCell>
                    <TableCell>
                      <Input className="w-28" value={row.remarks} placeholder="Optional" disabled={isPublished}
                        onChange={(e) => updateRow(idx, "remarks", e.target.value)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!isPublished && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Marks
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ── Admin All-Subjects Cross-Tab View ─────────────────────────────────────────
interface AdminSubjectInfo {
  id: number;
  name: string;
  code?: string;
  maxTheoryMarks?: string;
  maxPracticalMarks?: string;
  maxInternalMarks?: string;
}
interface AdminStudentInfo {
  id: number;
  studentName: string;
  rollNo?: number;
  rollNumber?: string | number;
  sectionId?: number;
}
interface AdminMarkInfo {
  studentId: number;
  subjectId: number;
  theoryMarks?: string | null;
  practicalMarks?: string | null;
  internalMarks?: string | null;
  totalMarks?: string | null;
  isAbsent?: boolean;
  remarks?: string | null;
}

function AdminAllSubjectsTab() {
  const { toast } = useToast();
  const { data: exams = [] } = useListExams({});
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const bulkMutation = useBulkSaveExamMarks();

  const [examId, setExamId] = useState<number | undefined>();
  const [classId, setClassId] = useState<number | undefined>();
  const [sectionId, setSectionId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<AdminSubjectInfo[]>([]);
  const [students, setStudents] = useState<AdminStudentInfo[]>([]);
  const [allMarks, setAllMarks] = useState<AdminMarkInfo[]>([]);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<AdminMarksRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Email feature
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // All-classes mode
  const [allClassesMode, setAllClassesMode] = useState(false);
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<number, AdminSubjectInfo[]>>({});

  // School info (for report cards)
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string; logoUrl: string; address: string;
    contactNumber: string; udiseCode: string; email: string; session: string;
  }>({ name: "", logoUrl: "", address: "", contactNumber: "", udiseCode: "", email: "", session: "" });

  useEffect(() => {
    fetch("/api/settings/school-info").then((r) => r.json()).then((d) => {
      if (d) setSchoolInfo({
        name: d.schoolName ?? "", logoUrl: d.logoUrl ?? "", address: d.address ?? "",
        contactNumber: d.contactNumber ?? "", udiseCode: d.udiseCode ?? "",
        email: d.email ?? "", session: d.session ?? "",
      });
    }).catch(() => {});
  }, []);

  // Fee filter
  const [feeMonth, setFeeMonth] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [feeStatusMap, setFeeStatusMap] = useState<Record<number, "paid" | "unpaid">>({});
  const [loadingFees, setLoadingFees] = useState(false);
  const [nameFilter, setNameFilter] = useState("");

  // Selection + hold
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [heldStudentIds, setHeldStudentIds] = useState<Set<number>>(new Set());
  const [holdingResult, setHoldingResult] = useState(false);
  const [parentEmailMap, setParentEmailMap] = useState<Record<number, string>>({});

  const filteredSections = classId
    ? sections.filter((s) => !s.classId || s.classId === classId)
    : sections;

  const authHeaders = (): Record<string, string> => {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function loadAll() {
    if (!examId) return;
    if (!allClassesMode && !classId) return;
    setLoading(true);
    setEditingSubjectId(null);
    setSelectedIds(new Set());
    setFeeStatusMap({});
    setFeeMonth("all");
    setFeeFilter("all");
    try {
      const h = authHeaders();

      if (allClassesMode) {
        // Fetch all students and all marks for this exam (no classId filter)
        const marksQs = new URLSearchParams({ examId: examId.toString() });
        const [studentList, marksList] = await Promise.all([
          fetch(`/api/students`, { headers: h }).then((r) => r.json()),
          fetch(`/api/exam-marks?${marksQs}`, { headers: h }).then((r) => r.json()),
        ]);
        setSubjects([]); // no subject grid in all-classes mode
        const sorted = (Array.isArray(studentList) ? studentList : []).sort(
          (a: AdminStudentInfo, b: AdminStudentInfo) =>
            ((a as any).className ?? "").localeCompare((b as any).className ?? "") ||
            (Number(a.rollNo ?? a.rollNumber ?? 0)) - (Number(b.rollNo ?? b.rollNumber ?? 0)),
        );
        setStudents(sorted);
        const mList = Array.isArray(marksList) ? marksList : [];
        setAllMarks(mList);
        const emailMap: Record<number, string> = {};
        for (const s of sorted) {
          if ((s as any).parentEmail) emailMap[s.id] = (s as any).parentEmail;
        }
        setParentEmailMap(emailMap);
        const held = new Set<number>();
        for (const m of mList) { if ((m as any).isHeld) held.add(m.studentId); }
        setHeldStudentIds(held);
        // Fetch subjects for each unique class so we can render full report cards
        const uniqueClassIds = [...new Set(sorted.map((s: AdminStudentInfo) => (s as any).classId as number).filter(Boolean))];
        const subjectResults = await Promise.all(
          uniqueClassIds.map((cid) =>
            fetch(`/api/subjects?classId=${cid}`, { headers: h }).then((r) => r.json()).catch(() => [])
          )
        );
        const csMap: Record<number, AdminSubjectInfo[]> = {};
        uniqueClassIds.forEach((cid, i) => { csMap[cid] = Array.isArray(subjectResults[i]) ? subjectResults[i] : []; });
        setClassSubjectsMap(csMap);
      } else {
        const studentQs = new URLSearchParams({ classId: classId!.toString() });
        if (sectionId) studentQs.set("sectionId", sectionId.toString());
        const marksQs = new URLSearchParams({ examId: examId.toString(), classId: classId!.toString() });
        if (sectionId) marksQs.set("sectionId", sectionId.toString());

        const [subjectList, studentList, marksList] = await Promise.all([
          fetch(`/api/subjects?classId=${classId}`, { headers: h }).then((r) => r.json()),
          fetch(`/api/students?${studentQs}`, { headers: h }).then((r) => r.json()),
          fetch(`/api/exam-marks?${marksQs}`, { headers: h }).then((r) => r.json()),
        ]);
        setSubjects(Array.isArray(subjectList) ? subjectList : []);
        const sorted = (Array.isArray(studentList) ? studentList : []).sort(
          (a: AdminStudentInfo, b: AdminStudentInfo) =>
            (Number(a.rollNo ?? a.rollNumber ?? 0)) - (Number(b.rollNo ?? b.rollNumber ?? 0)),
        );
        setStudents(sorted);
        setAllMarks(Array.isArray(marksList) ? marksList : []);

        const emailMap: Record<number, string> = {};
        for (const s of sorted) {
          if ((s as any).parentEmail) emailMap[s.id] = (s as any).parentEmail;
        }
        setParentEmailMap(emailMap);

        const held = new Set<number>();
        if (Array.isArray(marksList)) {
          for (const m of marksList) {
            if ((m as any).isHeld) held.add(m.studentId);
          }
        }
        setHeldStudentIds(held);
      }
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const marksMap: Record<string, AdminMarkInfo> = {};
  for (const m of allMarks) {
    marksMap[`${m.studentId}-${m.subjectId}`] = m;
  }

  // For all-classes mode: compute per-student total obtained from all marks
  function studentAllClassesTotal(studentId: number): { obtained: number; hasMarks: boolean } {
    const marks = allMarks.filter((m) => m.studentId === studentId);
    if (marks.length === 0) return { obtained: 0, hasMarks: false };
    let total = 0;
    for (const m of marks) {
      if (!m.isAbsent) {
        total += parseFloat((m as any).theoryMarks ?? "0") || 0;
        total += parseFloat((m as any).practicalMarks ?? "0") || 0;
        total += parseFloat((m as any).internalMarks ?? "0") || 0;
      }
    }
    return { obtained: total, hasMarks: true };
  }

  function subjectTotal(studentId: number, subject: AdminSubjectInfo): string {
    const m = marksMap[`${studentId}-${subject.id}`];
    if (!m) return "—";
    if (m.isAbsent) return "Ab";
    if (m.totalMarks) return m.totalMarks;
    const t = (parseFloat(m.theoryMarks ?? "0") || 0)
      + (parseFloat(m.practicalMarks ?? "0") || 0)
      + (parseFloat(m.internalMarks ?? "0") || 0);
    return t > 0 ? String(t) : "—";
  }

  function studentGrandTotal(studentId: number): string {
    let total = 0;
    let hasAny = false;
    for (const s of subjects) {
      const m = marksMap[`${studentId}-${s.id}`];
      if (m && !m.isAbsent) {
        const t = (parseFloat(m.theoryMarks ?? "0") || 0)
          + (parseFloat(m.practicalMarks ?? "0") || 0)
          + (parseFloat(m.internalMarks ?? "0") || 0);
        if (m.totalMarks) { total += parseFloat(m.totalMarks) || 0; hasAny = true; }
        else if (t > 0) { total += t; hasAny = true; }
      }
    }
    return hasAny ? String(total) : "—";
  }

  function maxTotal(): number {
    return subjects.reduce(
      (acc, s) =>
        acc
        + (parseFloat(s.maxTheoryMarks ?? "0") || 0)
        + (parseFloat(s.maxPracticalMarks ?? "0") || 0)
        + (parseFloat(s.maxInternalMarks ?? "0") || 0),
      0,
    );
  }

  function startEdit(subjectId: number) {
    const rows: AdminMarksRow[] = students.map((s) => {
      const rollNo = typeof s.rollNo === "number" ? s.rollNo : parseInt(String(s.rollNumber ?? "0")) || 0;
      const m = marksMap[`${s.id}-${subjectId}`];
      return {
        studentId: s.id,
        studentName: s.studentName,
        rollNo,
        theoryMarks: m?.theoryMarks ?? "",
        practicalMarks: m?.practicalMarks ?? "",
        internalMarks: m?.internalMarks ?? "",
        isAbsent: m?.isAbsent ?? false,
        remarks: m?.remarks ?? "",
        isDirty: false,
      };
    });
    setEditRows(rows);
    setEditingSubjectId(subjectId);
  }

  function updateEditRow(idx: number, field: keyof AdminMarksRow, value: string | boolean) {
    setEditRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value, isDirty: true } : r)));
  }

  async function saveEdit() {
    if (!editingSubjectId || !examId || !classId) return;
    setSaving(true);
    try {
      await bulkMutation.mutateAsync({
        data: {
          marks: editRows.map((r) => ({
            examId,
            studentId: r.studentId,
            subjectId: editingSubjectId,
            classId,
            sectionId,
            theoryMarks: r.isAbsent ? undefined : (r.theoryMarks || undefined),
            practicalMarks: r.isAbsent ? undefined : (r.practicalMarks || undefined),
            internalMarks: r.isAbsent ? undefined : (r.internalMarks || undefined),
            isAbsent: r.isAbsent,
            remarks: r.remarks || undefined,
          })),
        },
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

  const selectedExamObj = exams.find((e) => e.id === examId);
  const isPublished = selectedExamObj?.status === "published";
  const editingSubject = subjects.find((s) => s.id === editingSubjectId);
  const maxT = maxTotal();

  function calcGrade(pct: number): string {
    if (pct >= 91) return "A1";
    if (pct >= 81) return "A2";
    if (pct >= 71) return "B1";
    if (pct >= 61) return "B2";
    if (pct >= 51) return "C1";
    if (pct >= 41) return "C2";
    if (pct >= 33) return "D";
    return "E (Fail)";
  }

  // Build a single full report card HTML div (parent-portal style) for any student + subject array
  function buildFullCardHtml(
    student: AdminStudentInfo,
    studentSubjects: AdminSubjectInfo[],
    classLabel: string,
  ): string {
    const rollNo = typeof student.rollNo === "number" ? student.rollNo : parseInt(String(student.rollNumber ?? "0")) || 0;
    const examName = selectedExamObj?.name ?? "Examination";
    const examSession = selectedExamObj ? (selectedExamObj as any).session ?? "" : "";
    const si = schoolInfo;
    const qrData = encodeURIComponent(`RESULT:${student.id}:${examId}:${student.studentName}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}`;

    const maxForStudent = studentSubjects.reduce((acc, s) =>
      acc + (parseFloat(s.maxTheoryMarks ?? "0") || 0)
          + (parseFloat(s.maxPracticalMarks ?? "0") || 0)
          + (parseFloat(s.maxInternalMarks ?? "0") || 0), 0);

    const rows = studentSubjects.map((s, i) => {
      const m = marksMap[`${student.id}-${s.id}`];
      const thMax = parseFloat(s.maxTheoryMarks ?? "0") || 0;
      const prMax = parseFloat(s.maxPracticalMarks ?? "0") || 0;
      const inMax = parseFloat(s.maxInternalMarks ?? "0") || 0;
      const th = m?.isAbsent ? "<span style='color:#ea580c'>AB</span>" : (thMax > 0 ? `${m?.theoryMarks ?? "—"}/${s.maxTheoryMarks}` : "—");
      const pr = m?.isAbsent ? "—" : (prMax > 0 ? `${m?.practicalMarks ?? "—"}/${s.maxPracticalMarks}` : "—");
      const inn = m?.isAbsent ? "—" : (inMax > 0 ? `${m?.internalMarks ?? "—"}/${s.maxInternalMarks}` : "—");
      let tot = "—"; let totNum = 0;
      if (m && !m.isAbsent) {
        totNum = (parseFloat(m.theoryMarks ?? "0") || 0) + (parseFloat(m.practicalMarks ?? "0") || 0) + (parseFloat(m.internalMarks ?? "0") || 0);
        tot = m.totalMarks ? m.totalMarks : String(totNum);
      } else if (m?.isAbsent) { tot = "AB"; }
      const subMax = thMax + prMax + inMax;
      const pct = subMax > 0 && tot !== "—" && tot !== "AB" ? ((parseFloat(tot) / subMax) * 100).toFixed(1) : "—";
      const grade = pct !== "—" ? calcGrade(parseFloat(pct)) : (m?.isAbsent ? "AB" : "—");
      return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
        <td style="border:1px solid #d1d5db;padding:6px 8px">${s.name}${s.code ? ` (${s.code})` : ""}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${th}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${pr}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${inn}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold">${m?.isAbsent ? "AB" : tot}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${subMax || "—"}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${pct !== "—" ? pct + "%" : "—"}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold">${grade}</td>
      </tr>`;
    }).join("");

    let grandTotal = 0; let hasAny = false;
    for (const s of studentSubjects) {
      const m = marksMap[`${student.id}-${s.id}`];
      if (m && !m.isAbsent) {
        grandTotal += (parseFloat(m.theoryMarks ?? "0") || 0) + (parseFloat(m.practicalMarks ?? "0") || 0) + (parseFloat(m.internalMarks ?? "0") || 0);
        hasAny = true;
      }
    }
    const grandStr = hasAny ? String(grandTotal) : "—";
    const pct = hasAny && maxForStudent > 0 ? ((grandTotal / maxForStudent) * 100).toFixed(1) : null;
    const grade = pct ? calcGrade(parseFloat(pct)) : "—";
    const passFail = pct ? (parseFloat(pct) >= 33 ? "PASS" : "FAIL") : "—";
    const passColor = passFail === "PASS" ? "#16a34a" : passFail === "FAIL" ? "#dc2626" : "#6b7280";

    return `<div style="page-break-after:always;font-family:Arial,sans-serif;font-size:12px;max-width:760px;margin:0 auto 40px;border:2px solid #1e3a5f;border-radius:8px;overflow:hidden">
      <div style="background:#1e3a5f;color:white;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="display:flex;align-items:flex-start;gap:12px">
          ${si.logoUrl ? `<img src="${si.logoUrl}" width="52" height="52" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.4);flex-shrink:0" />` : ""}
          <div>
            <div style="font-size:17px;font-weight:bold;letter-spacing:.3px">${(si.name || "School").toUpperCase()}</div>
            ${si.address ? `<div style="font-size:9.5px;opacity:.8;margin-top:1px">${si.address}</div>` : ""}
            <div style="font-size:9.5px;opacity:.75;margin-top:1px">${[si.contactNumber ? `Tel: ${si.contactNumber}` : "", si.udiseCode ? `UDISE: ${si.udiseCode}` : "", si.email ? si.email : ""].filter(Boolean).join(" | ")}</div>
            <div style="font-size:12px;margin-top:5px;font-weight:600;opacity:.95">PROGRESS REPORT CARD</div>
            <div style="font-size:10px;opacity:.8">${examName}${examSession ? ` | Session: ${examSession}` : si.session ? ` | Session: ${si.session}` : ""}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">
          <img src="${qrUrl}" width="70" height="70" style="border:2px solid rgba(255,255,255,.35);border-radius:4px;background:white" alt="QR" />
          <div style="font-size:8px;opacity:.7">Scan to verify</div>
        </div>
      </div>
      <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb">
        <table style="font-size:12px;border-collapse:collapse;width:100%">
          <tr><td style="color:#6b7280;padding:3px 0;width:130px">Student Name</td><td style="font-weight:bold;padding:3px 0">: ${student.studentName}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0">Roll Number</td><td style="padding:3px 0">: ${rollNo || "—"}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0">Class / Section</td><td style="font-weight:bold;padding:3px 0">: ${classLabel}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 0">Father's Name</td><td style="padding:3px 0">: ${(student as any).fatherName || "—"}</td></tr>
        </table>
      </div>
      <div style="padding:12px 16px">
        <div style="font-size:12px;font-weight:bold;color:#1e3a5f;border-bottom:2px solid #1e3a5f;margin-bottom:8px;padding-bottom:3px">SUBJECT-WISE MARKS</div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr style="background:#1e3a5f;color:white">
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:left;font-size:11px">Subject</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Theory</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Practical</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Internal</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Total</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Max</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">%</th>
            <th style="border:1px solid #1e3a5f;padding:7px 8px;text-align:center;font-size:11px">Grade</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tbody><tr style="background:#1e3a5f;color:white;font-weight:bold">
            <td style="border:1px solid #374151;padding:7px 8px">GRAND TOTAL</td>
            <td colspan="3" style="border:1px solid #374151;padding:7px 8px;text-align:center">—</td>
            <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${grandStr}</td>
            <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${maxForStudent || "—"}</td>
            <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${pct ? pct + "%" : "—"}</td>
            <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${grade}</td>
          </tr></tbody>
        </table>
      </div>
      <div style="padding:10px 16px;display:flex;gap:12px;background:#f9fafb;border-top:1px solid #e5e7eb;flex-wrap:wrap">
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 16px;text-align:center;background:white">
          <div style="font-size:20px;font-weight:bold;color:#1e3a5f">${pct ? pct + "%" : "—"}</div>
          <div style="font-size:10px;color:#6b7280">Percentage</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 16px;text-align:center;background:white">
          <div style="font-size:20px;font-weight:bold;color:#1e3a5f">${grade}</div>
          <div style="font-size:10px;color:#6b7280">Grade</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 20px;text-align:center;background:white">
          <div style="font-size:20px;font-weight:bold;color:${passColor}">${passFail}</div>
          <div style="font-size:10px;color:#6b7280">Result</div>
        </div>
      </div>
      <div style="padding:12px 16px;display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280">
        <span>Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        <div style="display:flex;gap:40px">
          <div style="text-align:center"><div style="border-top:1px solid #333;width:100px;margin-bottom:3px"></div>Class Teacher</div>
          <div style="text-align:center"><div style="border-top:1px solid #333;width:100px;margin-bottom:3px"></div>Principal</div>
        </div>
      </div>
    </div>`;
  }

  function printReportCards(studentsToPrint?: AdminStudentInfo[]) {
    const toPrint = studentsToPrint ?? filteredStudents;
    if (!toPrint.length || !subjects.length) return;
    const examName = selectedExamObj?.name ?? "Examination";
    const selectedClass = classes.find((c) => c.id === classId);
    const selectedSection = sections.find((s) => s.id === sectionId);
    const classLabel = [selectedClass?.name, selectedSection?.name].filter(Boolean).join(" – ");

    const cards = toPrint.map((student) => {
      return buildFullCardHtml(student, subjects, classLabel);
    }).join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Report Cards – ${selectedExamObj?.name ?? ""} – ${classLabel}</title>
      <style>
        @media print { body { margin:0; } @page { margin:12mm; size:A4; } }
        body { font-family:Arial,sans-serif; background:#e5e7eb; padding:24px; }
        @media print { body { background:#fff; padding:0; } }
        button.no-print { display:inline-block; margin-bottom:20px; background:#1e3a5f; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-size:14px; cursor:pointer; }
        @media print { button.no-print { display:none; } }
      </style>
    </head><body>
      <button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      ${cards}
    </body></html>`);
    win.document.close();
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const ACADEMIC_MONTHS = [4,5,6,7,8,9,10,11,12,1,2,3];

  async function loadFeeStatus() {
    if ((!classId && !allClassesMode) || feeMonth === "all") { setFeeStatusMap({}); return; }
    setLoadingFees(true);
    try {
      const h = authHeaders();
      const qs = new URLSearchParams({ month: feeMonth, year: String(new Date().getFullYear()) });
      if (!allClassesMode && classId) {
        qs.set("classId", classId.toString());
        if (sectionId) qs.set("sectionId", sectionId.toString());
      }
      const payments = await fetch(`/api/fees/payments?${qs}`, { headers: h }).then((r) => r.json());
      const map: Record<number, "paid" | "unpaid"> = {};
      for (const s of students) { map[s.id] = "unpaid"; }
      if (Array.isArray(payments)) {
        for (const p of payments) {
          if (p.status === "paid") map[p.studentId] = "paid";
        }
      }
      setFeeStatusMap(map);
    } catch {
      toast({ title: "Failed to load fee status", variant: "destructive" });
    } finally {
      setLoadingFees(false);
    }
  }

  const filteredStudents = students.filter((s) => {
    if (nameFilter && !s.studentName.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (feeFilter === "all" || feeMonth === "all") return true;
    if (feeFilter === "paid") return feeStatusMap[s.id] === "paid";
    return feeStatusMap[s.id] !== "paid";
  });

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => { const n = new Set(prev); filteredStudents.forEach((s) => n.delete(s.id)); return n; });
    } else {
      setSelectedIds((prev) => { const n = new Set(prev); filteredStudents.forEach((s) => n.add(s.id)); return n; });
    }
  }

  async function sendResultsEmail() {
    const recipients = filteredStudents
      .filter((s) => selectedIds.has(s.id) && parentEmailMap[s.id])
      .map((s) => ({ email: parentEmailMap[s.id], studentName: s.studentName, fatherName: (s as any).fatherName || undefined }));
    if (recipients.length === 0) {
      toast({ title: "No selected students have a parent email address", variant: "destructive" }); return;
    }
    setSendingEmail(true);
    try {
      const h = { "Content-Type": "application/json", ...authHeaders() };
      const res = await fetch("/api/email/bulk", { method: "POST", headers: h, body: JSON.stringify({ recipients, subject: emailSubject, message: emailMessage }) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `✓ Sent to ${data.sent} parent${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}` });
        setShowEmailDialog(false);
      } else { toast({ title: data.error ?? "Send failed", variant: "destructive" }); }
    } catch { toast({ title: "Email send failed", variant: "destructive" }); }
    finally { setSendingEmail(false); }
  }

  async function toggleHoldResults(hold: boolean) {
    if (!examId || selectedIds.size === 0) return;
    setHoldingResult(true);
    try {
      const h = { "Content-Type": "application/json", ...authHeaders() };
      const res = await fetch("/api/exam-marks/bulk-hold", { method: "POST", headers: h, body: JSON.stringify({ examId, studentIds: Array.from(selectedIds), isHeld: hold }) });
      if (res.ok) {
        toast({ title: `✓ Results ${hold ? "held" : "released"} for ${selectedIds.size} student${selectedIds.size !== 1 ? "s" : ""}` });
        await loadAll();
      } else { const d = await res.json(); toast({ title: d.error ?? "Failed", variant: "destructive" }); }
    } catch { toast({ title: "Operation failed", variant: "destructive" }); }
    finally { setHoldingResult(false); }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label>Select Exam</Label>
              <Select
                value={examId?.toString() ?? ""}
                onValueChange={(v) => {
                  setExamId(parseInt(v));
                  setSubjects([]); setStudents([]); setAllMarks([]); setEditingSubjectId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose exam" /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.name}
                      {e.status === "published" && <span className="text-green-600 text-xs ml-1"> ✓ published</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-36">
              <Label>Class</Label>
              <Select
                value={allClassesMode ? "all" : (classId?.toString() ?? "")}
                onValueChange={(v) => {
                  if (v === "all") {
                    setAllClassesMode(true); setClassId(undefined); setSectionId(undefined);
                  } else {
                    setAllClassesMode(false); setClassId(parseInt(v)); setSectionId(undefined);
                  }
                  setSubjects([]); setStudents([]); setAllMarks([]); setEditingSubjectId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!allClassesMode && (
              <div className="min-w-36">
                <Label>Section</Label>
                <Select
                  value={sectionId?.toString() ?? "all"}
                  onValueChange={(v) => {
                    setSectionId(v === "all" ? undefined : parseInt(v));
                    setSubjects([]); setStudents([]); setAllMarks([]); setEditingSubjectId(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {filteredSections.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={loadAll} disabled={!examId || (!allClassesMode && !classId) || loading} variant="outline" className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Load Results
            </Button>
          </div>
          {isPublished && (
            <p className="mt-3 text-sm text-amber-600 flex items-center gap-1">
              <Lock className="h-4 w-4" /> This exam is published — marks are visible to parents. You can still edit them.
            </p>
          )}
        </CardContent>
      </Card>

      {/* All-Classes Summary View */}
      {allClassesMode && students.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground font-medium">
              All Classes — {filteredStudents.length}{filteredStudents.length !== students.length ? ` of ${students.length}` : ""} student{filteredStudents.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Filter bar for all-classes mode */}
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Search by Name</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 w-44 h-8 text-sm"
                      placeholder="Filter by name…"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fee Month Filter</Label>
                  <Select value={feeMonth} onValueChange={setFeeMonth}>
                    <SelectTrigger className="h-8 w-36"><SelectValue placeholder="All months" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {ACADEMIC_MONTHS.map((n) => <SelectItem key={n} value={String(n)}>{MONTHS[n-1]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fee Status</Label>
                  <Select value={feeFilter} onValueChange={(v) => setFeeFilter(v as "all" | "paid" | "unpaid")}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {feeMonth !== "all" && (
                  <Button variant="outline" size="sm" onClick={loadFeeStatus} disabled={loadingFees} className="gap-1.5 h-8">
                    {loadingFees ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Load Fee Status
                  </Button>
                )}
                {loadingFees && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-end mb-2" />}
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <input type="checkbox" className="w-4 h-4 accent-primary"
                      checked={filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id))}
                      onChange={() => {
                        const allSel = filteredStudents.every((s) => selectedIds.has(s.id));
                        setSelectedIds((prev) => {
                          const n = new Set(prev);
                          filteredStudents.forEach((s) => allSel ? n.delete(s.id) : n.add(s.id));
                          return n;
                        });
                      }} />
                  </TableHead>
                  <TableHead className="font-semibold">Roll</TableHead>
                  <TableHead className="font-semibold">Student Name</TableHead>
                  <TableHead className="font-semibold">Class</TableHead>
                  <TableHead className="font-semibold">Section</TableHead>
                  <TableHead className="text-center font-semibold">Total Obtained</TableHead>
                  <TableHead className="text-center font-semibold">Print</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const { obtained, hasMarks } = studentAllClassesTotal(student.id);
                  const rollNo = typeof student.rollNo === "number"
                    ? student.rollNo
                    : parseInt(String(student.rollNumber ?? "0")) || 0;
                  const isSelected = selectedIds.has(student.id);
                  const className = (student as any).className ?? classes.find((c) => c.id === (student as any).classId)?.name ?? "—";
                  const sectionName = (student as any).sectionName ?? sections.find((s) => s.id === (student as any).sectionId)?.name ?? "—";
                  return (
                    <TableRow key={student.id} className={isSelected ? "bg-primary/5" : ""}>
                      <TableCell>
                        <input type="checkbox" className="w-4 h-4 accent-primary"
                          checked={isSelected}
                          onChange={(e) => setSelectedIds((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(student.id); else n.delete(student.id);
                            return n;
                          })} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{rollNo || "—"}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{student.studentName}</span>
                          {getSessionStatus((student as any).studentType) && (
                            <SessionStatusBadge studentType={(student as any).studentType} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{className}</TableCell>
                      <TableCell>{sectionName}</TableCell>
                      <TableCell className="text-center font-semibold">
                        {hasMarks ? obtained : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost"
                          title="Print full report card"
                          onClick={() => {
                            const studentClassId = (student as any).classId as number;
                            const studentSubjects = classSubjectsMap[studentClassId] ?? [];
                            const html = buildFullCardHtml(student, studentSubjects, `${className}${sectionName !== "—" ? ` – ${sectionName}` : ""}`);
                            const win = window.open("", "_blank");
                            if (!win) return;
                            win.document.write(`<!DOCTYPE html><html><head><title>Result – ${student.studentName}</title><style>@media print{body{margin:0}@page{margin:12mm;size:A4}}body{font-family:Arial,sans-serif;background:#e5e7eb;padding:24px}@media print{body{background:#fff;padding:0}}button.no-print{display:inline-block;margin-bottom:20px;background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer}@media print{button.no-print{display:none}}</style></head><body><button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>${html}</body></html>`);
                            win.document.close();
                            setTimeout(() => win.print(), 500);
                          }}
                        >
                          <Printer className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {nameFilter ? `No students match "${nameFilter}"` : "No students found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => {
                  const selected = filteredStudents.filter((s) => selectedIds.has(s.id));
                  const cards = selected.map((student) => {
                    const studentClassId = (student as any).classId as number;
                    const studentSubjects = classSubjectsMap[studentClassId] ?? [];
                    const cName = (student as any).className ?? classes.find((c) => c.id === studentClassId)?.name ?? "—";
                    const sName = (student as any).sectionName ?? sections.find((s) => s.id === (student as any).sectionId)?.name ?? "";
                    return buildFullCardHtml(student, studentSubjects, `${cName}${sName ? ` – ${sName}` : ""}`);
                  }).join("");
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(`<!DOCTYPE html><html><head><title>Bulk Results – ${selectedExamObj?.name ?? ""}</title><style>@media print{body{margin:0}@page{margin:12mm;size:A4}}body{font-family:Arial,sans-serif;background:#e5e7eb;padding:24px}@media print{body{background:#fff;padding:0}}button.no-print{display:inline-block;margin-bottom:20px;background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer}@media print{button.no-print{display:none}}</style></head><body><button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>${cards}</body></html>`);
                  win.document.close();
                }}
              >
                <Printer className="h-3.5 w-3.5" /> Print Selected ({selectedIds.size})
              </Button>
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                disabled={holdingResult}
                onClick={() => toggleHoldResults(true)}
              >
                {holdingResult ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Hold Result
              </Button>
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                disabled={holdingResult}
                onClick={() => toggleHoldResults(false)}
              >
                {holdingResult ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Release Result
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cross-tabular grid */}
      {!allClassesMode && subjects.length > 0 && students.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground font-medium">
              Class Results — {students.length} student{students.length !== 1 ? "s" : ""} · {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
              {maxT > 0 && <span className="ml-2 text-muted-foreground/70">· Max total: {maxT}</span>}
            </p>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm"
                  onClick={() => printReportCards(filteredStudents.filter((s) => selectedIds.has(s.id)))}
                  className="gap-1.5 shrink-0 text-primary border-primary hover:bg-primary/10"
                >
                  <Printer className="h-4 w-4" /> Print Selected ({selectedIds.size})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => printReportCards()} className="gap-1.5 shrink-0">
                <Printer className="h-4 w-4" /> {nameFilter || filteredStudents.length < students.length ? `Print Filtered (${filteredStudents.length})` : "Print All Report Cards"}
              </Button>
            </div>
          </div>

          {/* Fee filter + name search + bulk action bar */}
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Search by Name</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 w-44 h-8 text-sm"
                      placeholder="Filter by name…"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fee Month Filter</Label>
                  <Select value={feeMonth} onValueChange={setFeeMonth}>
                    <SelectTrigger className="h-8 w-36"><SelectValue placeholder="All months" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {ACADEMIC_MONTHS.map((n) => <SelectItem key={n} value={String(n)}>{MONTHS[n-1]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fee Status</Label>
                  <Select value={feeFilter} onValueChange={(v) => setFeeFilter(v as "all" | "paid" | "unpaid")}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {feeMonth !== "all" && (
                  <Button variant="outline" size="sm" onClick={loadFeeStatus} disabled={loadingFees} className="gap-1.5 h-8">
                    {loadingFees ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Load Fee Status
                  </Button>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select students:"}
                  </span>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5"
                    onClick={() => {
                      setEmailSubject(`Results for ${selectedExamObj?.name ?? "Examination"} — ${new Date().getFullYear()}`);
                      setEmailMessage(`Dear Parent,\n\nThe results for ${selectedExamObj?.name ?? "the examination"} are now available.\n\nPlease login to the Parent Portal to view your child's marksheet.\n\nRegards,\nSchool Administration`);
                      setShowEmailDialog(true);
                    }}
                    disabled={selectedIds.size === 0}
                  >
                    <Mail className="h-3.5 w-3.5" /> Send Email
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={() => toggleHoldResults(true)}
                    disabled={selectedIds.size === 0 || holdingResult}
                  >
                    {holdingResult ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                    Hold Result
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => toggleHoldResults(false)}
                      disabled={holdingResult}
                    >
                      {holdingResult ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      Release
                    </Button>
                  )}
                </div>
              </div>
              {feeMonth !== "all" && Object.keys(feeStatusMap).length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing by {MONTHS[parseInt(feeMonth) - 1]} fee status — {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} shown
                </p>
              )}
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 bg-muted/50">
                    <input type="checkbox" className="w-4 h-4 accent-primary"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      title="Select all" />
                  </TableHead>
                  <TableHead className="w-16 font-semibold sticky left-0 bg-muted/50">Roll</TableHead>
                  <TableHead className="font-semibold sticky left-16 bg-muted/50 min-w-36">Student</TableHead>
                  {subjects.map((s) => (
                    <TableHead key={s.id} className="text-center min-w-28">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-semibold leading-tight">{s.name}</span>
                        <button
                          title={`Edit marks for ${s.name}`}
                          onClick={() => editingSubjectId === s.id ? setEditingSubjectId(null) : startEdit(s.id)}
                          className={`p-1 rounded transition-colors ${
                            editingSubjectId === s.id
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          }`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const grand = studentGrandTotal(student.id);
                  const rollNo = typeof student.rollNo === "number"
                    ? student.rollNo
                    : parseInt(String(student.rollNumber ?? "0")) || 0;
                  const isSelected = selectedIds.has(student.id);
                  const isHeld = heldStudentIds.has(student.id);
                  const feeStatus = feeMonth !== "all" ? feeStatusMap[student.id] : undefined;
                  return (
                    <TableRow key={student.id} className={isSelected ? "bg-primary/5" : ""}>
                      <TableCell>
                        <input type="checkbox" className="w-4 h-4 accent-primary"
                          checked={isSelected}
                          onChange={(e) => setSelectedIds((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(student.id); else n.delete(student.id);
                            return n;
                          })} />
                      </TableCell>
                      <TableCell className="font-mono text-sm sticky left-0 bg-background">{rollNo || "—"}</TableCell>
                      <TableCell className="font-medium sticky left-16 bg-background">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {student.studentName}
                            {isHeld && <span title="Result held — not visible to parents"><EyeOff className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                            {feeStatus === "paid" && <span className="text-[10px] text-green-600 font-medium border border-green-300 bg-green-50 rounded px-1">Paid</span>}
                            {feeStatus === "unpaid" && <span className="text-[10px] text-red-600 font-medium border border-red-300 bg-red-50 rounded px-1">Unpaid</span>}
                          </div>
                          {getSessionStatus((student as any).studentType) && (
                            <SessionStatusBadge studentType={(student as any).studentType} />
                          )}
                        </div>
                      </TableCell>
                      {subjects.map((s) => {
                        const val = subjectTotal(student.id, s);
                        const isAbs = val === "Ab";
                        const isEmpty = val === "—";
                        return (
                          <TableCell key={s.id} className="text-center">
                            <span className={`text-sm font-medium ${isAbs ? "text-red-500" : isEmpty ? "text-muted-foreground/50" : ""}`}>
                              {val}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold">
                        {grand}
                        {maxT > 0 && grand !== "—" && (
                          <span className="text-xs text-muted-foreground font-normal ml-1">/{maxT}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Inline edit panel */}
          {editingSubjectId && editingSubject && (
            <Card className="border-primary/40 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Edit2 className="h-4 w-4 text-primary" />
                    Editing: <strong>{editingSubject.name}</strong>
                    <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
                      Max Theory {editingSubject.maxTheoryMarks ?? "—"} · Practical {editingSubject.maxPracticalMarks ?? "—"} · Internal {editingSubject.maxInternalMarks ?? "—"}
                    </span>
                  </span>
                  <button
                    onClick={() => setEditingSubjectId(null)}
                    className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border mb-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
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
                        <TableRow
                          key={row.studentId}
                          className={row.isAbsent ? "opacity-50 bg-red-50/50" : row.isDirty ? "bg-amber-50/50" : ""}
                        >
                          <TableCell className="font-mono text-sm">{row.rollNo || "—"}</TableCell>
                          <TableCell className="font-medium">{row.studentName}</TableCell>
                          <TableCell>
                            <Input className="h-8 w-20" type="number" min={0} value={row.theoryMarks}
                              disabled={row.isAbsent}
                              onChange={(e) => updateEditRow(idx, "theoryMarks", e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-20" type="number" min={0} value={row.practicalMarks}
                              disabled={row.isAbsent}
                              onChange={(e) => updateEditRow(idx, "practicalMarks", e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-20" type="number" min={0} value={row.internalMarks}
                              disabled={row.isAbsent}
                              onChange={(e) => updateEditRow(idx, "internalMarks", e.target.value)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-red-500"
                              checked={row.isAbsent}
                              onChange={(e) => updateEditRow(idx, "isAbsent", e.target.checked)}
                            />
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
                  <Button onClick={saveEdit} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save All Marks
                  </Button>
                  <Button variant="outline" onClick={() => setEditingSubjectId(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {examId && classId && !loading && students.length === 0 && subjects.length > 0 && (
        <p className="text-center text-muted-foreground py-6">No students found for the selected class/section.</p>
      )}
      {(!examId || !classId) && (
        <p className="text-center text-muted-foreground py-8">Select an exam and class, then click Load Results.</p>
      )}

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Results Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sending to <strong>{filteredStudents.filter((s) => selectedIds.has(s.id) && parentEmailMap[s.id]).length}</strong> parent(s) with registered email
              {filteredStudents.filter((s) => selectedIds.has(s.id) && !parentEmailMap[s.id]).length > 0 && (
                <span className="text-amber-600 ml-1">
                  · {filteredStudents.filter((s) => selectedIds.has(s.id) && !parentEmailMap[s.id]).length} skipped (no email)
                </span>
              )}
            </p>
            <div>
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject" />
            </div>
            <div>
              <Label>Message</Label>
              <textarea
                className="w-full min-h-[120px] border rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Type your message here..."
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)} disabled={sendingEmail}>Cancel</Button>
              <Button onClick={sendResultsEmail} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()} className="gap-1.5">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {sendingEmail ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── ApprovalRequestsTab ────────────────────────────────────────────────────────
interface ApprovalRow {
  id: number;
  teacherName: string | null;
  examName: string | null;
  className: string | null;
  subjectName: string | null;
  status: string;
  validUntil: string | null;
  adminNote: string | null;
  requestedAt: string;
}

function ApprovalRequestsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [durationMap, setDurationMap] = useState<Record<number, string>>({});
  const adminToken = localStorage.getItem("admin_token");

  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${adminToken ?? ""}` };

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/teacher-mark-approvals", { headers: authHeaders });
      const data: ApprovalRow[] = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { toast({ title: "Failed to load requests", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function review(id: number, action: "approved" | "rejected") {
    setProcessingId(id);
    const durationMinutes = parseInt(durationMap[id] ?? "0") || 0;
    try {
      const r = await fetch(`/api/teacher-mark-approvals/${id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ action, durationMinutes: action === "approved" ? durationMinutes : 0 }),
      });
      if (!r.ok) throw new Error("Failed");
      toast({ title: action === "approved" ? "Approved!" : "Rejected" });
      await load();
    } catch { toast({ title: "Action failed", variant: "destructive" }); }
    finally { setProcessingId(null); }
  }

  function timeLeft(validUntil: string | null): string {
    if (!validUntil) return "No expiry";
    const ms = new Date(validUntil).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m left` : `${mins}m left`;
  }

  const pending = rows.filter(r => r.status === "pending");
  const reviewed = rows.filter(r => r.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          Teacher Mark-Entry Approval Requests
          {pending.length > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-300">{pending.length} pending</Badge>}
        </h3>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>}

      {!loading && pending.length === 0 && reviewed.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No approval requests yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Pending</p>
          {pending.map((row) => (
            <Card key={row.id} className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{row.teacherName ?? "Teacher"}</p>
                    <p className="text-xs text-muted-foreground">
                      wants to enter marks for <strong>{row.subjectName}</strong> in{" "}
                      <strong>{row.className}</strong> — Exam: {row.examName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested: {new Date(row.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Approve for (mins)</p>
                      <input
                        type="number"
                        min="1"
                        max="480"
                        placeholder="e.g. 60"
                        value={durationMap[row.id] ?? ""}
                        onChange={(e) => setDurationMap(prev => ({ ...prev, [row.id]: e.target.value }))}
                        className="w-24 h-8 px-2 text-sm border rounded-md"
                      />
                    </div>
                    <div className="flex gap-1.5 mt-4">
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700"
                        disabled={processingId === row.id}
                        onClick={() => void review(row.id, "approved")}
                      >
                        {processingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-red-300 text-red-600 hover:bg-red-50"
                        disabled={processingId === row.id}
                        onClick={() => void review(row.id, "rejected")}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Reviews</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead><TableHead>Subject</TableHead>
                <TableHead>Class</TableHead><TableHead>Exam</TableHead>
                <TableHead>Status</TableHead><TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewed.slice(0, 20).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.teacherName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{row.subjectName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{row.className ?? "—"}</TableCell>
                  <TableCell className="text-sm">{row.examName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      row.status === "approved" ? "border-green-400 text-green-700 bg-green-50"
                        : "border-red-300 text-red-600 bg-red-50"
                    }>
                      {row.status === "approved" ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.validUntil ? (
                      <span className={new Date(row.validUntil) > new Date() ? "text-green-600 font-medium" : "text-red-500"}>
                        {timeLeft(row.validUntil)}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── ResultsManagementTab wrapper (two inner tabs) ──────────────────────────────
function ResultsManagementTab() {
  return (
    <div className="space-y-3">
      <Tabs defaultValue="all-subjects">
        <TabsList>
          <TabsTrigger value="all-subjects" className="flex items-center gap-1">
            <Users className="h-4 w-4" /> All Subjects
          </TabsTrigger>
          <TabsTrigger value="per-subject" className="flex items-center gap-1">
            <BarChart2 className="h-4 w-4" /> Per Subject Entry
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> Approval Requests
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all-subjects">
          <AdminAllSubjectsTab />
        </TabsContent>
        <TabsContent value="per-subject">
          <PerSubjectEntryTab />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Results Tab ───────────────────────────────────────────────────────────────
function ResultsTab() {
  const { data: exams = [] } = useListExams({});
  const { data: classes = [] } = useListClasses();
  const [examId, setExamId] = useState<number | undefined>();
  const [classId, setClassId] = useState<string | undefined>();
  const [nameFilter, setNameFilter] = useState("");
  const [allClassResults, setAllClassResults] = useState<ResultItem[]>([]);
  const [loadingAllClasses, setLoadingAllClasses] = useState(false);

  const isAllClasses = classId === "all";
  const numericClassId = (classId && classId !== "all") ? parseInt(classId) : undefined;
  const enabled = !!(examId && numericClassId);

  const { data: results, isLoading } = useGetExamResults(
    examId ?? 0,
    { classId: numericClassId ?? 0 },
  );

  useEffect(() => {
    if (!examId || classId !== "all") { setAllClassResults([]); return; }
    setLoadingAllClasses(true);
    const adminToken = localStorage.getItem("admin_token");
    const authH = { Authorization: `Bearer ${adminToken ?? ""}` };
    void Promise.all(
      classes.map(c =>
        fetch(`/api/exam-marks/results/${examId}?classId=${c.id}`, { headers: authH })
          .then(r => r.json())
          .then((d: { results?: ResultItem[] }) => d.results ?? [])
          .catch(() => [] as ResultItem[])
      )
    ).then(all => {
      const combined: ResultItem[] = (all as ResultItem[][]).flat();
      combined.sort((a, b) => parseFloat(String(b.overallPercentage ?? 0)) - parseFloat(String(a.overallPercentage ?? 0)));
      combined.forEach((r, i) => { (r as Record<string, unknown>).rank = i + 1; });
      setAllClassResults(combined);
    }).finally(() => setLoadingAllClasses(false));
  }, [examId, classId]);

  const typedResults: ResultItem[] = isAllClasses
    ? allClassResults
    : (enabled && results?.results ? (results.results as unknown as ResultItem[]) : []);

  const filteredResults = nameFilter
    ? typedResults.filter((r) =>
        String(r.studentName ?? "").toLowerCase().includes(nameFilter.toLowerCase()),
      )
    : typedResults;

  const effectiveLoading = isAllClasses ? loadingAllClasses : (enabled ? isLoading : false);
  const selectedExamName = exams.find((e) => e.id === examId)?.name ?? "Examination";
  const selectedClassName = classId === "all" ? "All Classes" : (classes.find((c) => c.id === numericClassId)?.name ?? "");

  async function printStudentResult(r: ResultItem) {
    if (!r.studentId || !examId) return;
    const adminToken = localStorage.getItem("admin_token");
    const authHeaders = { Authorization: `Bearer ${adminToken ?? ""}` };

    let schoolData: { schoolName?: string; udiseCode?: string; logoUrl?: string; address?: string; contactNumber?: string } = {};
    let marksheet: {
      exam: { id?: number; name?: string; session?: string };
      student: { id?: number; studentName: string; rollNo?: number; fatherName?: string; className: string; sectionName: string };
      subjects: Array<{ subjectName: string; subjectCode?: string; theoryMarks?: string | null; practicalMarks?: string | null; internalMarks?: string | null; totalMarks?: string | null; maxMarks?: string; maxTheoryMarks?: string; maxPracticalMarks?: string; maxInternalMarks?: string; grade?: string | null; percentage?: string | null; isAbsent?: boolean }>;
      totalMarks: string; maxMarks: string; percentage: string; grade: string; passFail: string;
    } | null = null;

    try {
      [schoolData, marksheet] = await Promise.all([
        fetch("/api/settings/school-info").then(res => res.json()).catch(() => ({})),
        fetch(`/api/exam-marks/student/${r.studentId}/exam/${examId}`, { headers: authHeaders }).then(res => res.json()).catch(() => null),
      ]);
    } catch { return; }

    if (!marksheet || !marksheet.student) return;

    const sName = String(schoolData?.schoolName ?? "School");
    const { student, subjects, exam } = marksheet;
    const passColor = marksheet.passFail === "pass" ? "#16a34a" : "#dc2626";
    const qrData = encodeURIComponent(`RESULT:${student.id ?? r.studentId}:${exam.id ?? examId}:${student.studentName}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}`;

    const rows = subjects.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
        <td style="border:1px solid #d1d5db;padding:6px 8px">${s.subjectName}${s.subjectCode ? ` (${s.subjectCode})` : ""}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">
          ${s.isAbsent ? "<span style='color:#ea580c'>AB</span>" : (s.maxTheoryMarks && parseFloat(s.maxTheoryMarks) > 0 ? `${s.theoryMarks ?? "—"}/${s.maxTheoryMarks}` : "—")}
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">
          ${s.isAbsent ? "—" : (s.maxPracticalMarks && parseFloat(s.maxPracticalMarks) > 0 ? `${s.practicalMarks ?? "—"}/${s.maxPracticalMarks}` : "—")}
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">
          ${s.isAbsent ? "—" : (s.maxInternalMarks && parseFloat(s.maxInternalMarks) > 0 ? `${s.internalMarks ?? "—"}/${s.maxInternalMarks}` : "—")}
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold">
          ${s.isAbsent ? "AB" : (s.totalMarks ?? "—")}
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">${s.maxMarks ?? "—"}</td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center">
          ${s.isAbsent ? "—" : (s.percentage ? `${parseFloat(s.percentage).toFixed(1)}%` : "—")}
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold">
          ${s.isAbsent ? "AB" : (s.grade ?? "—")}
        </td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><title>Report Card – ${student.studentName}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1f2937}
  @media print{body{padding:0;margin:0}@page{margin:12mm}.no-print{display:none}}
  table{border-collapse:collapse;width:100%}
  th{background:#1e3a5f;color:white;padding:7px 8px;text-align:center;font-size:11px}
</style></head><body>
<div class="no-print" style="margin-bottom:16px">
  <button onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:14px;cursor:pointer;">🖨️ Print Result</button>
</div>
<div style="border:2px solid #1e3a5f;border-radius:8px;overflow:hidden">
  <div style="background:#1e3a5f;color:white;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div style="display:flex;align-items:flex-start;gap:12px">
      ${schoolData.logoUrl ? `<img src="${schoolData.logoUrl}" width="52" height="52" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.4);flex-shrink:0" />` : ""}
      <div>
        <div style="font-size:18px;font-weight:bold;letter-spacing:.3px">${sName.toUpperCase()}</div>
        ${schoolData.address ? `<div style="font-size:9.5px;opacity:.8;margin-top:1px">${schoolData.address}</div>` : ""}
        <div style="font-size:9.5px;opacity:.75;margin-top:1px">${[schoolData.contactNumber ? `Tel: ${schoolData.contactNumber}` : "", schoolData.udiseCode ? `UDISE: ${schoolData.udiseCode}` : ""].filter(Boolean).join(" | ")}</div>
        <div style="font-size:12px;margin-top:5px;font-weight:600;opacity:.95">PROGRESS REPORT CARD</div>
        <div style="font-size:10px;opacity:.8">${exam?.name ?? ""}${exam?.session ? ` | Session: ${exam.session}` : ""}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">
      <img src="${qrUrl}" width="70" height="70" style="border:2px solid rgba(255,255,255,.35);border-radius:4px;background:white" alt="QR" />
      <div style="font-size:8px;opacity:.7">Scan to verify</div>
    </div>
  </div>
  <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb">
    <table style="font-size:12px">
      <tr><td style="color:#6b7280;padding:3px 0;width:130px">Student Name</td><td style="font-weight:bold;padding:3px 0">: ${student.studentName}</td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">Roll Number</td><td style="padding:3px 0">: ${student.rollNo ?? "—"}</td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">Class / Section</td><td style="font-weight:bold;padding:3px 0">: ${student.className} – ${student.sectionName}</td></tr>
      <tr><td style="color:#6b7280;padding:3px 0">Father's Name</td><td style="padding:3px 0">: ${student.fatherName || "—"}</td></tr>
    </table>
  </div>
  <div style="padding:12px 16px">
    <div style="font-size:12px;font-weight:bold;color:#1e3a5f;border-bottom:2px solid #1e3a5f;margin-bottom:8px;padding-bottom:3px">SUBJECT-WISE MARKS</div>
    <table><thead><tr>
      <th style="text-align:left">Subject</th><th>Theory</th><th>Practical</th><th>Internal</th><th>Total</th><th>Max</th><th>%</th><th>Grade</th>
    </tr></thead><tbody>
      ${rows}
      <tr style="background:#1e3a5f;color:white;font-weight:bold">
        <td style="border:1px solid #374151;padding:7px 8px">GRAND TOTAL</td>
        <td colspan="3" style="border:1px solid #374151;padding:7px 8px;text-align:center">—</td>
        <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${marksheet.totalMarks}</td>
        <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${marksheet.maxMarks}</td>
        <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${parseFloat(marksheet.percentage).toFixed(1)}%</td>
        <td style="border:1px solid #374151;padding:7px 8px;text-align:center">${marksheet.grade}</td>
      </tr>
    </tbody></table>
  </div>
  <div style="padding:10px 16px;display:flex;gap:12px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 16px;text-align:center;background:white">
      <div style="font-size:20px;font-weight:bold;color:#1e3a5f">${parseFloat(marksheet.percentage).toFixed(1)}%</div>
      <div style="font-size:10px;color:#6b7280">Percentage</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 16px;text-align:center;background:white">
      <div style="font-size:20px;font-weight:bold;color:#1e3a5f">${marksheet.grade}</div>
      <div style="font-size:10px;color:#6b7280">Grade</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 20px;text-align:center;background:white">
      <div style="font-size:20px;font-weight:bold;color:${passColor}">${(marksheet.passFail ?? "").toUpperCase()}</div>
      <div style="font-size:10px;color:#6b7280">Result</div>
    </div>
  </div>
  <div style="padding:12px 16px;display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280">
    <span>Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
    <div style="display:flex;gap:40px">
      <div style="text-align:center"><div style="border-top:1px solid #333;width:100px;margin-bottom:3px"></div>Class Teacher</div>
      <div style="text-align:center"><div style="border-top:1px solid #333;width:100px;margin-bottom:3px"></div>Principal</div>
    </div>
  </div>
</div></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Label>Exam</Label>
          <Select value={examId?.toString() ?? ""} onValueChange={(v) => setExamId(parseInt(v))}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              {exams.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class</Label>
          <Select value={classId ?? ""} onValueChange={(v) => setClassId(v || undefined)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(enabled || isAllClasses) && (
          <div>
            <Label>Search by Name</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 w-48"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
        )}
        {(enabled || isAllClasses) && (
          <Button variant="outline" size="sm" onClick={() => window.print()} className="mt-5">
            <Printer className="h-4 w-4 mr-1" /> Print Merit List
          </Button>
        )}
      </div>

      {!(examId && classId) ? (
        <p className="text-center text-muted-foreground py-8">Select an exam and class to view results.</p>
      ) : effectiveLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : typedResults.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{typedResults.length}</div>
                <div className="text-sm text-muted-foreground">Total Students</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">
                  {typedResults.filter((r) => r.result === "PASS").length}
                </div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">
                  {typedResults.filter((r) => r.result === "FAIL").length}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
          </div>
          {nameFilter && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredResults.length} of {typedResults.length} students
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead><TableHead>Roll No</TableHead><TableHead>Student Name</TableHead>
                <TableHead>Total</TableHead><TableHead>Max</TableHead><TableHead>%</TableHead>
                <TableHead>Grade</TableHead><TableHead>Result</TableHead><TableHead>Print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((r, idx) => (
                <TableRow key={r.studentId ?? idx}>
                  <TableCell>{r.rank ?? idx + 1}</TableCell>
                  <TableCell>{r.rollNo ?? "—"}</TableCell>
                  <TableCell className="font-medium">{String(r.studentName ?? "—")}</TableCell>
                  <TableCell>{String(r.totalObtained ?? "—")}</TableCell>
                  <TableCell>{String(r.totalMax ?? "—")}</TableCell>
                  <TableCell>
                    {r.overallPercentage ? `${parseFloat(String(r.overallPercentage)).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(r.grade ?? "—")}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.result === "PASS" ? (
                      <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" />Pass</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600"><XCircle className="h-4 w-4" />Fail</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => printStudentResult(r)}
                      title="Print this student's result"
                    >
                      <Printer className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No students match "{nameFilter}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">No results found. Marks may not have been entered yet.</p>
      )}
    </div>
  );
}

// ── Admit Cards Tab ───────────────────────────────────────────────────────────
interface StudentCard {
  id: number;
  studentName: string;
  rollNumber?: string;
  rollNo?: number;
  fatherName: string;
  className: string;
  sectionName: string;
  photoUrl?: string;
}

interface SchoolInfo {
  schoolName: string;
  udiseCode: string;
  logoUrl: string;
  address: string;
  contactNumber: string;
  gmailUser: string;
}

const AC_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const AC_ACADEMIC_MONTHS = [4,5,6,7,8,9,10,11,12,1,2,3];

function AdmitCardsTab({ currentSession }: { currentSession: string }) {
  // Format "2028-2029" → "2028-29" for the admit card header
  const sessionLabel = (() => {
    const parts = currentSession.split("-");
    if (parts.length === 2) return `${parts[0]}–${parts[1].slice(-2)}`;
    return currentSession;
  })();
  const { toast } = useToast();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: exams = [] } = useListExams({});
  const [examId, setExamId] = useState("none");
  const [classId, setClassId] = useState("none");
  const [sectionId, setSectionId] = useState("none");
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingHolds, setSavingHolds] = useState(false);
  const [holdList, setHoldList] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [feeMonth, setFeeMonth] = useState("all");
  const [feeFilter, setFeeFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [feeStatusMap, setFeeStatusMap] = useState<Record<number, "paid" | "unpaid">>({});
  const [loadingFees, setLoadingFees] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [schedules, setSchedules] = useState<{
    subjectName: string; examDate: string; startTime?: string; endTime?: string; room?: string;
  }[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({ schoolName: "", udiseCode: "", logoUrl: "", address: "", contactNumber: "", gmailUser: "" });
  const adminToken = localStorage.getItem("admin_token");
  const authH = { Authorization: `Bearer ${adminToken ?? ""}` };

  async function loadPublishStatus(eid: string) {
    if (eid === "none") { setIsPublished(false); return; }
    try {
      const r = await fetch(`/api/admit-card-holds/publish-status?examId=${eid}`, { headers: authH });
      const d = await r.json();
      setIsPublished(d.published === true);
    } catch { setIsPublished(false); }
  }

  useEffect(() => { loadPublishStatus(examId); }, [examId]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/school-info").then(r => r.json()).catch(() => ({})),
      fetch("/api/settings/gmail").then(r => r.json()).catch(() => ({})),
    ]).then(([info, gmail]) => {
      setSchoolInfo({
        schoolName: info.schoolName || "",
        udiseCode: info.udiseCode || "",
        logoUrl: info.logoUrl || "",
        address: info.address || "",
        contactNumber: info.contactNumber || "",
        gmailUser: gmail.gmailUser || "",
      });
    });
  }, []);

  async function togglePublish() {
    if (examId === "none") { toast({ title: "Select an exam first", variant: "destructive" }); return; }
    setPublishing(true);
    try {
      const r = await fetch("/api/admit-card-holds/publish", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({ examId: parseInt(examId), published: !isPublished }),
      });
      const d = await r.json();
      setIsPublished(d.published === true);
      toast({ title: d.published ? "✅ Admit cards published — parents can now view them" : "Admit cards unpublished" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setPublishing(false); }
  }

  const filteredSections = classId === "none"
    ? sections
    : sections.filter((s) => !s.classId || s.classId === parseInt(classId));

  const displayedStudents = students.filter((s) => {
    if (feeFilter !== "all") {
      const status = feeStatusMap[s.id] ?? "unpaid";
      if (feeFilter !== status) return false;
    }
    if (nameFilter && !s.studentName.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  async function loadStudents() {
    if (classId === "none") { toast({ title: "Select a class", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (classId !== "all") qs.set("classId", classId);
      if (classId !== "all" && sectionId !== "none") qs.set("sectionId", sectionId);
      const scheduleUrl = examId !== "none"
        ? `/api/exam-schedules?examId=${examId}${classId !== "all" ? `&classId=${classId}` : ""}`
        : null;
      const [stds, sch] = await Promise.all([
        fetch(`/api/students?${qs}`, { headers: authH }).then((r) => r.json()),
        scheduleUrl ? fetch(scheduleUrl, { headers: authH }).then((r) => r.json()) : Promise.resolve([]),
      ]);
      const studentList: StudentCard[] = Array.isArray(stds) ? stds : [];
      setStudents(studentList);
      setSchedules(Array.isArray(sch) ? sch : []);
      setSelectedIds(new Set());
      // Load current hold status from API
      if (examId !== "none" && studentList.length > 0 && classId !== "all") {
        const holdsRes = await fetch(`/api/admit-card-holds?examId=${examId}&classId=${classId}`, { headers: authH })
          .then(r => r.json()).catch(() => []);
        const heldIds = new Set<number>(
          (Array.isArray(holdsRes) ? holdsRes : [])
            .filter((h: { held: boolean }) => h.held)
            .map((h: { studentId: number }) => h.studentId)
        );
        setHoldList(heldIds);
      }
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function loadFeeStatus() {
    if (!classId || classId === "none" || classId === "all" || feeMonth === "all") { setFeeStatusMap({}); return; }
    setLoadingFees(true);
    try {
      const url = `/api/fee-payments?classId=${classId}&month=${feeMonth}`;
      const data = await fetch(url, { headers: authH }).then(r => r.json()).catch(() => []);
      const map: Record<number, "paid" | "unpaid"> = {};
      students.forEach(s => { map[s.id] = "unpaid"; });
      if (Array.isArray(data)) {
        data.forEach((fp: { studentId: number; status: string }) => {
          if (fp.status === "paid") map[fp.studentId] = "paid";
        });
      }
      setFeeStatusMap(map);
    } catch { setFeeStatusMap({}); }
    finally { setLoadingFees(false); }
  }

  useEffect(() => { if (students.length > 0) void loadFeeStatus(); }, [feeMonth, students]);

  async function persistHolds(ids: number[], held: boolean) {
    if (examId === "none") return;
    setSavingHolds(true);
    try {
      await fetch("/api/admit-card-holds/bulk", {
        method: "POST",
        headers: { ...authH, "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: parseInt(examId),
          holds: ids.map(studentId => ({ studentId, held })),
        }),
      });
    } catch { toast({ title: "Failed to save holds", variant: "destructive" }); }
    finally { setSavingHolds(false); }
  }

  async function toggleHold(id: number) {
    const wasHeld = holdList.has(id);
    setHoldList((prev) => {
      const next = new Set(prev);
      wasHeld ? next.delete(id) : next.add(id);
      return next;
    });
    await persistHolds([id], !wasHeld);
  }

  async function bulkHold(held: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setHoldList(prev => {
      const next = new Set(prev);
      ids.forEach(id => held ? next.add(id) : next.delete(id));
      return next;
    });
    setSelectedIds(new Set());
    await persistHolds(ids, held);
    toast({ title: held ? `${ids.length} students placed on hold` : `${ids.length} students released from hold` });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === displayedStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedStudents.map(s => s.id)));
    }
  }

  function buildCardHtml(s: StudentCard, examName: string, info: SchoolInfo, cardSchedules: typeof schedules, sessionLabel: string): string {
    const qrData = encodeURIComponent(`ADMIT:${s.id}:${examName}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}`;
    const logoHtml = info.logoUrl
      ? `<img src="${info.logoUrl}" width="48" height="48" style="border-radius:50%;object-fit:contain;background:#fff;border:2px solid #fff" alt="logo" />`
      : `<div style="width:48px;height:48px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center">
           <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M16 4L28 10V14C28 20.627 22.627 26.627 16 28C9.373 26.627 4 20.627 4 14V10L16 4Z" fill="#1e3a5f"/>
             <path d="M16 8L24 12V15C24 19.418 20.418 23.418 16 24.5C11.582 23.418 8 19.418 8 15V12L16 8Z" fill="#f59e0b"/>
           </svg>
         </div>`;
    const photoHtml = s.photoUrl
      ? `<img src="${s.photoUrl}" width="80" height="90" style="object-fit:cover;border-radius:4px;border:1px solid #ccc" alt="photo" onerror="this.parentElement.innerHTML='<div style=width:80px;height:90px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#999;text-align:center;border-radius:4px>Photo<br>Here</div>'" />`
      : `<div style="width:80px;height:90px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#999;text-align:center;border-radius:4px">Photo<br>Here</div>`;
    const scheduleHtml = cardSchedules.length > 0 ? `
      <table style="width:100%;margin-top:10px;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#1e3a5f;color:#fff">
            <th style="border:1px solid #1e3a5f;padding:5px 6px;text-align:left">Subject</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Date</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Time</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Room</th>
          </tr>
        </thead>
        <tbody>
          ${cardSchedules.map((sc, i) => `
            <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#fff"}">
              <td style="border:1px solid #dee2e6;padding:4px 6px">${sc.subjectName}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.examDate ?? "—"}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.startTime && sc.endTime ? `${sc.startTime}–${sc.endTime}` : "—"}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.room ?? "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : "<p style='font-size:11px;color:#666;margin-top:8px'>Schedule will be announced. Arrive 30 minutes early.</p>";

    const metaLine = [
      info.contactNumber && `📞 ${info.contactNumber}`,
      info.gmailUser && `✉ ${info.gmailUser}`,
      info.udiseCode && `U-DISE: ${info.udiseCode}`,
    ].filter(Boolean).join("  |  ");

    return `
      <div style="border:2px solid #1e3a5f;border-radius:8px;padding:0;margin-bottom:24px;page-break-inside:avoid;font-family:Arial,sans-serif;overflow:hidden;max-width:720px;margin-left:auto;margin-right:auto">
        <!-- Header -->
        <div style="background:#1e3a5f;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            ${logoHtml}
            <div>
              <div style="font-size:16px;font-weight:bold;letter-spacing:0.5px">${(info.schoolName || "School").toUpperCase()}</div>
              ${info.address ? `<div style="font-size:9px;opacity:0.8;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${info.address}</div>` : ""}
              ${metaLine ? `<div style="font-size:9px;opacity:0.8">${metaLine}</div>` : ""}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:bold">${examName.toUpperCase()}</div>
            <div style="font-size:10px;opacity:0.8">ADMIT CARD</div>
            <div style="font-size:10px;opacity:0.8">Academic Year ${sessionLabel}</div>
          </div>
        </div>

        <!-- Body -->
        <div style="padding:14px 16px;display:flex;gap:14px">
          <!-- Student Info -->
          <div style="flex:1">
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr><td style="color:#555;padding:3px 0;width:120px">Student Name</td><td style="font-weight:bold;padding:3px 0">: ${s.studentName}</td></tr>
              <tr><td style="color:#555;padding:3px 0">Roll Number</td><td style="font-weight:bold;padding:3px 0">: ${s.rollNo ?? s.rollNumber ?? "—"}</td></tr>
              <tr><td style="color:#555;padding:3px 0">Class / Section</td><td style="font-weight:bold;padding:3px 0">: ${s.className} – ${s.sectionName}</td></tr>
              <tr><td style="color:#555;padding:3px 0">Father's Name</td><td style="padding:3px 0">: ${s.fatherName || "—"}</td></tr>
            </table>
            <div style="margin-top:8px;padding:6px 8px;background:#fff8e1;border-left:3px solid #f59e0b;font-size:10px;color:#555">
              Candidate must bring this card to every paper. Late entry not permitted.
            </div>
          </div>
          <!-- Photo + QR -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:88px">
            ${photoHtml}
            <img src="${qrUrl}" width="80" height="80" style="border:1px solid #eee;border-radius:4px" alt="QR" onerror="this.style.display='none'"/>
            <div style="font-size:8px;color:#888;text-align:center">Scan to verify</div>
          </div>
        </div>

        <!-- Schedule -->
        <div style="padding:0 16px 4px">
          <div style="font-size:11px;font-weight:bold;color:#1e3a5f;border-bottom:1px solid #1e3a5f;margin-bottom:6px;padding-bottom:2px">EXAMINATION SCHEDULE</div>
          ${scheduleHtml}
        </div>

        <!-- Signatures -->
        <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;margin-top:10px">
          <div style="text-align:center">
            <div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div>
            <div style="font-size:10px;color:#555">Student Signature</div>
          </div>
          <div style="text-align:center">
            <div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div>
            <div style="font-size:10px;color:#555">Principal Signature & Stamp</div>
          </div>
        </div>
      </div>`;
  }

  function openPrintWindow(cardsHtml: string, title: string) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @media print { body { margin: 0; } @page { margin: 12mm; } }
      body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
      @media print { body { background: white; padding: 0; } }
    </style></head><body>${cardsHtml}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  function printAdmitCards() {
    const eligibleStudents = students.filter((s) => !holdList.has(s.id));
    if (eligibleStudents.length === 0) { toast({ title: "No students to print", variant: "destructive" }); return; }
    const examName = exams.find((e) => e.id.toString() === examId)?.name ?? "Examination";
    const cardsHtml = eligibleStudents.map((s) => buildCardHtml(s, examName, schoolInfo, schedules, sessionLabel)).join("");
    openPrintWindow(cardsHtml, `Admit Cards – ${examName}`);
  }

  function printSingleStudent(s: StudentCard) {
    const examName = exams.find((e) => e.id.toString() === examId)?.name ?? "Examination";
    openPrintWindow(buildCardHtml(s, examName, schoolInfo, schedules, sessionLabel), `Admit Card – ${s.studentName}`);
  }

  return (
    <div className="space-y-4">
      {/* Publish status banner */}
      {examId !== "none" && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${isPublished ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-2">
            {isPublished
              ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-sm font-medium text-green-800">Admit Cards Published — parents can view them</span></>
              : <><EyeOff className="h-4 w-4 text-amber-600" /><span className="text-sm font-medium text-amber-800">Admit Cards Not Published — parents cannot see them yet</span></>}
          </div>
          <Button
            size="sm"
            onClick={togglePublish}
            disabled={publishing}
            className={isPublished ? "bg-amber-500 hover:bg-amber-600 text-slate-900" : "bg-green-600 hover:bg-green-700 text-white"}
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : isPublished ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
            {isPublished ? "Unpublish" : "Publish Admit Cards"}
          </Button>
        </div>
      )}

      {/* Row 1: Exam / Class / Section / Load */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>Exam</Label>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific exam</SelectItem>
              {exams.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class *</Label>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId("none"); setStudents([]); }}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select class</SelectItem>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Sections</SelectItem>
              {filteredSections.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={loadStudents} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Load Students
          </Button>
        </div>
      </div>

      {/* Row 2: Name search + Fee Month + Paid/Unpaid filter (shown after students load) */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-3 items-end p-3 bg-muted/30 rounded-lg border">
          <div>
            <Label className="text-xs">Search by Name</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 w-44 h-9 text-sm"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Fee Month (Apr–Mar)</Label>
            <Select value={feeMonth} onValueChange={setFeeMonth}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {AC_ACADEMIC_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {AC_MONTHS[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {feeMonth !== "all" && (
            <div>
              <Label className="text-xs">Fee Status</Label>
              <Select value={feeFilter} onValueChange={(v) => setFeeFilter(v as "all" | "paid" | "unpaid")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="unpaid">Unpaid only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {loadingFees && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-end mb-2" />}
          <div className="text-xs text-muted-foreground self-end mb-2">
            Showing {displayedStudents.length} of {students.length} students
            {feeMonth !== "all" && ` · ${feeFilter !== "all" ? feeFilter : "all"}`}
          </div>
        </div>
      )}

      {/* Bulk actions + Print */}
      {students.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {displayedStudents.length} students · {holdList.size} on hold
              {selectedIds.size > 0 && <span className="ml-2 text-primary font-medium">{selectedIds.size} selected</span>}
            </p>
            {selectedIds.size > 0 && examId !== "none" && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={savingHolds}
                  onClick={() => bulkHold(true)}
                >
                  <Lock className="h-3.5 w-3.5 mr-1" /> Hold Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingHolds}
                  onClick={() => bulkHold(false)}
                >
                  <Unlock className="h-3.5 w-3.5 mr-1" /> Release Selected
                </Button>
              </>
            )}
          </div>
          <Button onClick={printAdmitCards} size="sm">
            <Printer className="h-4 w-4 mr-1" /> Print Admit Cards ({students.length - holdList.size})
          </Button>
        </div>
      )}

      {/* Student table with checkboxes */}
      {students.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={displayedStudents.length > 0 && displayedStudents.every((s) => selectedIds.has(s.id))}
                  onChange={toggleSelectAll}
                  title="Select all"
                />
              </TableHead>
              <TableHead>Roll No</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Class / Section</TableHead>
              <TableHead>Father's Name</TableHead>
              {feeMonth !== "all" && <TableHead className="text-center">Fee ({AC_MONTHS[(parseInt(feeMonth) || 1) - 1]})</TableHead>}
              <TableHead className="text-center">Hold</TableHead>
              <TableHead className="text-center">Print</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedStudents.map((s) => {
              const feeStatus = feeMonth !== "all" ? (feeStatusMap[s.id] ?? "unpaid") : null;
              return (
                <TableRow key={s.id} className={holdList.has(s.id) ? "opacity-40 bg-red-50/30" : ""}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.rollNumber || s.rollNo || "—"}</TableCell>
                  <TableCell className="font-medium">{s.studentName}</TableCell>
                  <TableCell>{s.className} {s.sectionName}</TableCell>
                  <TableCell>{s.fatherName || "—"}</TableCell>
                  {feeMonth !== "all" && (
                    <TableCell className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        feeStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {feeStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Button
                      variant={holdList.has(s.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleHold(s.id)}
                      disabled={examId === "none" || savingHolds}
                      title={holdList.has(s.id) ? "Release hold" : "Place on hold"}
                    >
                      {holdList.has(s.id) ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => printSingleStudent(s)}
                      title="Print admit card for this student"
                      disabled={holdList.has(s.id)}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Grading Rules Tab ─────────────────────────────────────────────────────────
function GradingRulesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useListGradingRules();
  const deleteMutation = useDeleteGradingRule();
  const resetMutation = useResetGradingRules();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={async () => {
          if (!confirm("Reset grading rules to defaults (A1–E)?")) return;
          try {
            await resetMutation.mutateAsync();
            qc.invalidateQueries({ queryKey: ["/api/grading-rules"] });
            toast({ title: "Grading rules reset to defaults" });
          } catch (e: unknown) {
            toast({ title: (e as Error).message, variant: "destructive" });
          }
        }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Reset to Defaults
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grade</TableHead><TableHead>Min %</TableHead><TableHead>Max %</TableHead>
              <TableHead>Grade Point</TableHead><TableHead>Description</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="outline" className="font-bold">{r.grade}</Badge></TableCell>
                <TableCell>{r.minPercent}%</TableCell>
                <TableCell>{r.maxPercent}%</TableCell>
                <TableCell>{r.gradePoint ?? "—"}</TableCell>
                <TableCell>{r.description ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (!confirm("Delete this grade?")) return;
                    await deleteMutation.mutateAsync({ id: r.id });
                    qc.invalidateQueries({ queryKey: ["/api/grading-rules"] });
                    toast({ title: "Deleted" });
                  }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Marks Entry Status Tab ────────────────────────────────────────────────────
function MarksStatusTab() {
  const { data: exams = [] } = useListExams({});
  const [examId, setExamId] = useState<number | undefined>();
  const { data: rawRows = [], isLoading, refetch } = useGetMarksEntryStatus(examId ?? 0);
  const rows = examId ? rawRows : [];

  const statusConfig = {
    complete:     { label: "Complete",     cls: "bg-green-100 text-green-700" },
    partial:      { label: "Partial",      cls: "bg-yellow-100 text-yellow-700" },
    not_started:  { label: "Not Started",  cls: "bg-red-100 text-red-700" },
  };

  const total       = rows.length;
  const complete    = rows.filter(r => r.status === "complete").length;
  const partial     = rows.filter(r => r.status === "partial").length;
  const notStarted  = rows.filter(r => r.status === "not_started").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={examId?.toString() ?? "none"}
          onValueChange={(v) => setExamId(v === "none" ? undefined : parseInt(v))}
        >
          <SelectTrigger className="w-56"><SelectValue placeholder="Select exam…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Select Exam —</SelectItem>
            {exams.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {examId && (
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        )}
      </div>

      {!examId && (
        <div className="text-center py-12 text-muted-foreground">
          Select an exam above to see the marks submission status.
        </div>
      )}

      {examId && isLoading && (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}

      {examId && !isLoading && rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No teacher–subject assignments found. Add assignments in the Teacher Assignments tab first.
        </div>
      )}

      {examId && !isLoading && rows.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">Total Assignments</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{complete}</div>
              <div className="text-xs text-green-600">Complete</div>
            </div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{partial}</div>
              <div className="text-xs text-yellow-600">Partial</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{notStarted}</div>
              <div className="text-xs text-red-600">Not Started</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-center">Total Students</TableHead>
                <TableHead className="text-center">Marks Entered</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const cfg = statusConfig[r.status as keyof typeof statusConfig] ?? { label: r.status, cls: "bg-gray-100 text-gray-700" };
                const pct = r.totalStudents > 0 ? Math.round((r.marksEntered / r.totalStudents) * 100) : 0;
                return (
                  <TableRow key={r.assignmentId}>
                    <TableCell className="font-medium">{r.teacherName || "—"}</TableCell>
                    <TableCell>{r.subjectName || "—"}</TableCell>
                    <TableCell>{r.className || "—"}</TableCell>
                    <TableCell>{r.sectionName || "All"}</TableCell>
                    <TableCell className="text-center">{r.totalStudents}</TableCell>
                    <TableCell className="text-center">{r.marksEntered}</TableCell>
                    <TableCell className="text-center">
                      {r.pending > 0 ? (
                        <span className="font-semibold text-red-600">{r.pending}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${r.status === "complete" ? "bg-green-500" : r.status === "partial" ? "bg-yellow-500" : "bg-red-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">{pct}%</div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExamManagementTab() {
  const [currentSession, setCurrentSession] = useState(CURRENT_SESSION);

  // Fetch the actual current academic session from the API on mount so that
  // sub-tabs default to the right session instead of the calendar year.
  useEffect(() => {
    fetchCurrentSession().then(setCurrentSession);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">Exam Management</h2>
      </div>

      <Tabs defaultValue="exams">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="exams" className="flex items-center gap-1">
            <FileText className="h-4 w-4" /> Exams
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" /> Subjects
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-1">
            <ClipboardList className="h-4 w-4" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-1">
            <Users className="h-4 w-4" /> Teacher Assignments
          </TabsTrigger>
          <TabsTrigger value="marks" className="flex items-center gap-1">
            <BarChart2 className="h-4 w-4" /> Results Management
          </TabsTrigger>
          <TabsTrigger value="marks-status" className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Entry Status
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-1">
            <BarChart2 className="h-4 w-4" /> Results
          </TabsTrigger>
          <TabsTrigger value="admitcards" className="flex items-center gap-1">
            <CreditCard className="h-4 w-4" /> Admit Cards
          </TabsTrigger>
          <TabsTrigger value="grading" className="flex items-center gap-1">
            <GraduationCap className="h-4 w-4" /> Grading
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exams">
          <Card><CardHeader><CardTitle className="text-base">Exams</CardTitle></CardHeader>
            <CardContent><ExamsTab currentSession={currentSession} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="subjects">
          <Card><CardHeader><CardTitle className="text-base">Subjects</CardTitle></CardHeader>
            <CardContent><SubjectsTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card><CardHeader><CardTitle className="text-base">Exam Schedule</CardTitle></CardHeader>
            <CardContent><ScheduleTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="assignments">
          <Card><CardHeader><CardTitle className="text-base">Teacher–Subject Assignments</CardTitle></CardHeader>
            <CardContent><TeacherAssignmentsTab currentSession={currentSession} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="marks">
          <Card><CardHeader><CardTitle className="text-base">Results Management</CardTitle></CardHeader>
            <CardContent><ResultsManagementTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="marks-status">
          <Card><CardHeader><CardTitle className="text-base">Marks Entry Status</CardTitle></CardHeader>
            <CardContent><MarksStatusTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="results">
          <Card><CardHeader><CardTitle className="text-base">Results &amp; Merit List</CardTitle></CardHeader>
            <CardContent><ResultsTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="admitcards">
          <Card><CardHeader><CardTitle className="text-base">Admit Cards</CardTitle></CardHeader>
            <CardContent><AdmitCardsTab currentSession={currentSession} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="grading">
          <Card><CardHeader><CardTitle className="text-base">Grading Rules</CardTitle></CardHeader>
            <CardContent><GradingRulesTab /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
