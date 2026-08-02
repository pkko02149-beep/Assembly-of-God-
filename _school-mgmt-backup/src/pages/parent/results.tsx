import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Trophy,
  Loader2,
  Printer,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  TrendingUp,
  Award,
  Users,
  CreditCard,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentInfo {
  studentId: number;
  studentName: string;
}
interface Exam {
  id: number;
  name: string;
  type?: string;
  status: string;
  session?: string;
}
interface SubjectMark {
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  theoryMarks?: string | null;
  practicalMarks?: string | null;
  internalMarks?: string | null;
  totalMarks?: string | null;
  maxMarks?: string;
  maxTheoryMarks?: string;
  maxPracticalMarks?: string;
  maxInternalMarks?: string;
  grade?: string | null;
  percentage?: string | null;
  isAbsent?: boolean;
  remarks?: string | null;
}
interface Marksheet {
  exam: { id?: number; name?: string; type?: string; session?: string };
  student: {
    id?: number;
    studentName: string;
    rollNo?: number;
    fatherName?: string;
    motherName?: string;
    className: string;
    sectionName: string;
  };
  subjects: SubjectMark[];
  totalMarks: string;
  maxMarks: string;
  percentage: string;
  grade: string;
  gradePoint?: string;
  passFail: string;
}
interface ExamSummary {
  examId: number;
  examName: string;
  examType?: string;
  session?: string;
  totalMarks: string;
  maxMarks: string;
  percentage: string;
  grade: string;
  gradePoint?: string;
  passFail: string;
  subjectMarks: SubjectMark[];
}

// ─── Grade helpers ─────────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  if (["A1", "A2"].includes(grade)) return "border-green-400 text-green-700 bg-green-50";
  if (["B1", "B2"].includes(grade)) return "border-blue-400 text-blue-700 bg-blue-50";
  if (["C1", "C2"].includes(grade)) return "border-yellow-400 text-yellow-700 bg-yellow-50";
  if (grade === "D") return "border-orange-400 text-orange-700 bg-orange-50";
  return "border-red-400 text-red-700 bg-red-50";
}

function pctBar(pct: number) {
  const color = pct >= 60 ? "bg-green-500" : pct >= 33 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ParentResults() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [marksheet, setMarksheet] = useState<Marksheet | null>(null);
  const [heldResult, setHeldResult] = useState(false);
  const [allResults, setAllResults] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [schoolName, setSchoolName] = useState("School");
  const [schoolInfo, setSchoolInfo] = useState<{udiseCode:string;logoUrl:string;address:string;contactNumber:string;receiptFooter:string}>({udiseCode:"",logoUrl:"",address:"",contactNumber:"",receiptFooter:""});
  const [activeView, setActiveView] = useState<"marksheet" | "history">("marksheet");

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    init();
  }, []);

  useEffect(() => {
    if (selectedStudentId) fetchExams();
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId && selectedExamId) fetchMarksheet();
  }, [selectedStudentId, selectedExamId]);

  async function init() {
    try {
      const [p, s] = await Promise.all([
        parentApi.get<{ id: number; students: StudentInfo[] }>("/auth/parent/me"),
        fetch("/api/settings/school-info").then(r => r.json()).catch(() => ({})),
      ]);
      if (s?.schoolName) setSchoolName(s.schoolName);
      if (s) setSchoolInfo({ udiseCode: s.udiseCode ?? "", logoUrl: s.logoUrl ?? "", address: s.address ?? "", contactNumber: s.contactNumber ?? "", receiptFooter: s.receiptFooter ?? "" });
      const list = p.students || [];
      setStudents(list);
      if (list.length > 0) setSelectedStudentId(list[0].studentId);
    } catch {
      navigate("/parent/login");
    } finally {
      setLoading(false);
    }
  }

  async function fetchExams() {
    try {
      const data = await parentApi.get<Exam[]>("/exams?status=published");
      const list = Array.isArray(data) ? data : [];
      setExams(list);
      if (list.length > 0) setSelectedExamId(list[0].id);
      else setSelectedExamId(null);
    } catch { setExams([]); }
  }

  async function fetchMarksheet() {
    if (!selectedStudentId || !selectedExamId) return;
    setLoadingSheet(true);
    setHeldResult(false);
    setMarksheet(null);
    try {
      const data = await parentApi.get<Marksheet & { held?: boolean }>(
        `/exam-marks/student/${selectedStudentId}/exam/${selectedExamId}`,
      );
      if (data && (data as any).held === true) {
        setHeldResult(true);
        setMarksheet(null);
      } else {
        setMarksheet(data);
      }
    } catch { setMarksheet(null); setHeldResult(false); }
    finally { setLoadingSheet(false); }
  }

  async function fetchHistory() {
    if (!selectedStudentId) return;
    setLoadingAll(true);
    try {
      const data = await parentApi.get<ExamSummary[]>(
        `/exam-marks/results/student/${selectedStudentId}`,
      );
      setAllResults(Array.isArray(data) ? data : []);
    } catch { setAllResults([]); }
    finally { setLoadingAll(false); }
  }

  function handleViewChange(view: "marksheet" | "history") {
    setActiveView(view);
    if (view === "history" && allResults.length === 0) fetchHistory();
  }

  function printMarksheet() {
    if (!marksheet) return;
    const { student, subjects, exam } = marksheet;
    const passColor = marksheet.passFail === "pass" ? "#16a34a" : "#dc2626";
    const qrData = encodeURIComponent(`RESULT:${student.id ?? selectedStudentId}:${exam.id ?? selectedExamId}:${student.studentName}`);
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
  @media print{body{padding:0;margin:0}@page{margin:12mm}}
  table{border-collapse:collapse;width:100%}
  th{background:#1e3a5f;color:white;padding:7px 8px;text-align:center;font-size:11px}
</style></head><body>
<div style="border:2px solid #1e3a5f;border-radius:8px;overflow:hidden">
  <div style="background:#1e3a5f;color:white;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div style="display:flex;align-items:flex-start;gap:12px">
      ${schoolInfo.logoUrl ? `<img src="${schoolInfo.logoUrl}" width="52" height="52" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.4);flex-shrink:0" />` : ""}
      <div>
        <div style="font-size:18px;font-weight:bold;letter-spacing:.3px">${schoolName.toUpperCase()}</div>
        ${schoolInfo.address ? `<div style="font-size:9.5px;opacity:.8;margin-top:1px">${schoolInfo.address}</div>` : ""}
        <div style="font-size:9.5px;opacity:.75;margin-top:1px">${[schoolInfo.contactNumber ? `Tel: ${schoolInfo.contactNumber}` : "", schoolInfo.udiseCode ? `UDISE: ${schoolInfo.udiseCode}` : ""].filter(Boolean).join(" | ")}</div>
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
    if (!win) { toast({ title: "Allow popups to print", variant: "destructive" }); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  if (loading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl font-semibold">Exam Results</h1>
        </div>

        {/* Student selector (if multiple children) */}
        {students.length > 1 && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedStudentId?.toString() ?? ""}
                  onValueChange={(v) => {
                    setSelectedStudentId(parseInt(v));
                    setMarksheet(null);
                    setHeldResult(false);
                    setAllResults([]);
                  }}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.studentId} value={s.studentId.toString()}>
                        {s.studentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* View toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => handleViewChange("marksheet")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              activeView === "marksheet"
                ? "bg-blue-950 text-white border-blue-950"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Marksheet
          </button>
          <button
            onClick={() => handleViewChange("history")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              activeView === "history"
                ? "bg-blue-950 text-white border-blue-950"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            All Exams
          </button>
        </div>

        {/* ── MARKSHEET VIEW ── */}
        {activeView === "marksheet" && (
          <div className="space-y-4">
            {/* Exam selector */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={selectedExamId?.toString() ?? ""}
                    onValueChange={(v) => setSelectedExamId(parseInt(v))}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a published exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {exams.length === 0
                        ? <SelectItem value="__none" disabled>No published exams yet</SelectItem>
                        : exams.map((e) => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchMarksheet} disabled={!selectedExamId || loadingSheet} className="gap-1.5">
                    <RefreshCw className={`h-4 w-4 ${loadingSheet ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  {marksheet && (
                    <Button variant="outline" size="sm" onClick={printMarksheet} className="gap-1.5">
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {loadingSheet && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {!loadingSheet && heldResult && selectedExamId && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="py-10 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
                      <Lock className="h-8 w-8 text-amber-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-amber-800 mb-1">Result Withheld</h3>
                  <p className="text-amber-700 font-medium mb-3">
                    Please pay the remaining fee to view your result.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-800">
                    <CreditCard className="h-4 w-4" />
                    Contact the school office to clear dues and unlock the result.
                  </div>
                </CardContent>
              </Card>
            )}

            {!loadingSheet && !heldResult && !marksheet && selectedExamId && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p>No results found for this exam yet.</p>
                  <p className="text-sm mt-1">Results will appear once the teacher enters marks.</p>
                </CardContent>
              </Card>
            )}

            {!loadingSheet && marksheet && marksheet.subjects?.length > 0 && (
              <>
                {/* Student info card */}
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Student</span>
                        <p className="font-semibold">{marksheet.student.studentName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Class / Section</span>
                        <p className="font-semibold">{marksheet.student.className} – {marksheet.student.sectionName}</p>
                      </div>
                      {marksheet.student.rollNo && (
                        <div>
                          <span className="text-muted-foreground text-xs">Roll No</span>
                          <p className="font-semibold">{marksheet.student.rollNo}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground text-xs">Exam</span>
                        <p className="font-semibold">{marksheet.exam.name}</p>
                      </div>
                      {marksheet.exam.session && (
                        <div>
                          <span className="text-muted-foreground text-xs">Session</span>
                          <p className="font-semibold">{marksheet.exam.session}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Summary stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="text-center">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-3xl font-bold text-blue-700">
                        {parseFloat(marksheet.percentage).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Percentage</div>
                      <div className="mt-2">{pctBar(parseFloat(marksheet.percentage))}</div>
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-3xl font-bold text-blue-700">{marksheet.grade}</div>
                      <div className="text-xs text-muted-foreground mt-1">Overall Grade</div>
                      {marksheet.gradePoint && (
                        <div className="text-xs text-muted-foreground mt-1">GPA: {marksheet.gradePoint}</div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="text-center">
                    <CardContent className="pt-4 pb-4">
                      <div className="text-3xl font-bold text-blue-700">{marksheet.totalMarks}</div>
                      <div className="text-xs text-muted-foreground mt-1">out of {marksheet.maxMarks}</div>
                    </CardContent>
                  </Card>
                  <Card className={`text-center ${marksheet.passFail === "pass" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className={`text-3xl font-bold flex items-center justify-center gap-1 ${marksheet.passFail === "pass" ? "text-green-600" : "text-red-600"}`}>
                        {marksheet.passFail === "pass"
                          ? <CheckCircle2 className="h-7 w-7" />
                          : <XCircle className="h-7 w-7" />}
                      </div>
                      <div className={`text-sm font-bold mt-1 ${marksheet.passFail === "pass" ? "text-green-700" : "text-red-700"}`}>
                        {(marksheet.passFail ?? "").toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">Result</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Absent / failed alerts */}
                {marksheet.subjects.some((s) => s.isAbsent) && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    Absent in: {marksheet.subjects.filter((s) => s.isAbsent).map((s) => s.subjectName).join(", ")}
                  </div>
                )}
                {marksheet.subjects.some((s) => !s.isAbsent && s.grade === "E") && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    Failed in: {marksheet.subjects.filter((s) => !s.isAbsent && s.grade === "E").map((s) => s.subjectName).join(", ")}
                  </div>
                )}

                {/* Subject-wise marks table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4 text-amber-500" />
                      Subject-wise Marks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-950 hover:bg-blue-950">
                            <TableHead className="text-white font-medium">Subject</TableHead>
                            <TableHead className="text-white font-medium text-center">Theory</TableHead>
                            <TableHead className="text-white font-medium text-center">Practical</TableHead>
                            <TableHead className="text-white font-medium text-center">Internal</TableHead>
                            <TableHead className="text-white font-medium text-center">Total</TableHead>
                            <TableHead className="text-white font-medium text-center">Max</TableHead>
                            <TableHead className="text-white font-medium text-center">%</TableHead>
                            <TableHead className="text-white font-medium text-center">Grade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marksheet.subjects.map((s, idx) => (
                            <TableRow
                              key={s.subjectId}
                              className={`${idx % 2 === 0 ? "bg-slate-50/50" : ""} ${s.isAbsent ? "opacity-60 bg-orange-50" : ""}`}
                            >
                              <TableCell className="font-medium">
                                {s.subjectName}
                                {s.subjectCode && (
                                  <span className="text-xs text-muted-foreground ml-1">({s.subjectCode})</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {s.isAbsent
                                  ? <span className="text-orange-500 font-medium text-xs">AB</span>
                                  : (s.maxTheoryMarks && parseFloat(s.maxTheoryMarks) > 0
                                    ? `${s.theoryMarks ?? "—"}/${s.maxTheoryMarks}`
                                    : "—")}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {s.isAbsent ? "—"
                                  : (s.maxPracticalMarks && parseFloat(s.maxPracticalMarks) > 0
                                    ? `${s.practicalMarks ?? "—"}/${s.maxPracticalMarks}`
                                    : "—")}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {s.isAbsent ? "—"
                                  : (s.maxInternalMarks && parseFloat(s.maxInternalMarks) > 0
                                    ? `${s.internalMarks ?? "—"}/${s.maxInternalMarks}`
                                    : "—")}
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {s.isAbsent ? "—" : (s.totalMarks ?? "—")}
                              </TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground">
                                {s.maxMarks ?? "—"}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {s.isAbsent ? "—"
                                  : (s.percentage ? `${parseFloat(s.percentage).toFixed(1)}%` : "—")}
                              </TableCell>
                              <TableCell className="text-center">
                                {s.isAbsent ? (
                                  <Badge variant="outline" className="border-orange-300 text-orange-600 bg-orange-50 text-xs">AB</Badge>
                                ) : s.grade ? (
                                  <Badge variant="outline" className={`text-xs ${gradeColor(s.grade)}`}>
                                    {s.grade}
                                  </Badge>
                                ) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Grand total row */}
                          <TableRow className="bg-blue-950 hover:bg-blue-950 font-bold">
                            <TableCell className="text-white">Grand Total</TableCell>
                            <TableCell colSpan={3} className="text-white text-center text-sm">—</TableCell>
                            <TableCell className="text-white text-center">{marksheet.totalMarks}</TableCell>
                            <TableCell className="text-white text-center">{marksheet.maxMarks}</TableCell>
                            <TableCell className="text-white text-center">{parseFloat(marksheet.percentage).toFixed(1)}%</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-xs ${gradeColor(marksheet.grade)}`}>
                                {marksheet.grade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── ALL EXAMS HISTORY VIEW ── */}
        {activeView === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">All published exam results for your child</p>
              <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingAll} className="gap-1.5">
                <RefreshCw className={`h-4 w-4 ${loadingAll ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {loadingAll && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {!loadingAll && allResults.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p>No published exam results found yet.</p>
                </CardContent>
              </Card>
            )}

            {!loadingAll && allResults.map((result) => {
              const pct = parseFloat(result.percentage);
              return (
                <Card key={result.examId} className="overflow-hidden">
                  {/* Exam header */}
                  <div className="bg-blue-950 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{result.examName}</p>
                      {result.session && <p className="text-blue-300 text-xs">{result.session}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${gradeColor(result.grade)} border-2`}>
                        {result.grade}
                      </Badge>
                      <span className={`text-sm font-bold ${result.passFail === "pass" ? "text-green-400" : "text-red-400"}`}>
                        {(result.passFail ?? "").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <CardContent className="pt-3 pb-3">
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center p-2 bg-slate-50 rounded-lg">
                        <p className="text-lg font-bold text-blue-700">{result.totalMarks}</p>
                        <p className="text-xs text-muted-foreground">out of {result.maxMarks}</p>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded-lg">
                        <p className="text-lg font-bold text-blue-700">{pct.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Percentage</p>
                      </div>
                      <div className="text-center p-2 bg-slate-50 rounded-lg">
                        <p className="text-lg font-bold text-blue-700">{result.gradePoint ?? result.grade}</p>
                        <p className="text-xs text-muted-foreground">Grade Point</p>
                      </div>
                    </div>
                    {pctBar(pct)}

                    {/* Subject breakdown */}
                    {result.subjectMarks && result.subjectMarks.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subjects</p>
                        {result.subjectMarks.map((s) => {
                          const sp = s.percentage ? parseFloat(s.percentage) : 0;
                          return (
                            <div key={s.subjectId} className="flex items-center gap-2 text-sm">
                              <span className="w-32 truncate text-slate-700">{s.subjectName}</span>
                              <div className="flex-1">
                                {s.isAbsent
                                  ? <span className="text-orange-500 text-xs font-medium">Absent</span>
                                  : pctBar(sp)}
                              </div>
                              <span className="w-10 text-right font-medium text-sm">
                                {s.isAbsent ? "AB" : (s.totalMarks ?? "—")}
                              </span>
                              {s.grade && !s.isAbsent && (
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${gradeColor(s.grade)}`}>
                                  {s.grade}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
