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
  Loader2,
  Lock,
  Printer,
  ClipboardList,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  Calendar,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Exam { id: number; name: string; status: string; session?: string; }
interface StudentInfo { studentId: number; studentName: string; }
interface ExamSchedule {
  subjectName: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
}
interface StudentDetail {
  id: number;
  studentName: string;
  rollNo?: number;
  fatherName?: string;
  className: string;
  sectionName: string;
}
interface SchoolInfo {
  schoolName: string;
  udiseCode: string;
  logoUrl: string;
  address: string;
  contactNumber: string;
  receiptFooter: string;
}

export default function ParentAdmitCard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loadingCard, setLoadingCard] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isNotPublished, setIsNotPublished] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    init();
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedExamId) loadCard();
  }, [selectedStudentId, selectedExamId]);

  async function init() {
    try {
      const [p, si] = await Promise.all([
        parentApi.get<{ id: number; students: StudentInfo[] }>("/auth/parent/me"),
        fetch("/api/settings/school-info").then(r => r.json()).catch(() => ({})),
      ]);
      setSchoolInfo(si || null);
      setParentId(p.id);
      const list = p.students || [];
      setStudents(list);
      if (list.length > 0) setSelectedStudentId(list[0].studentId);

      const examList = await parentApi.get<Exam[]>("/exams").catch((): Exam[] => []);
      const arr = Array.isArray(examList)
        ? examList.filter((e) => e.status === "active" || e.status === "completed" || e.status === "published")
        : [];
      setExams(arr);
      if (arr.length > 0) setSelectedExamId(arr[0].id);
    } catch {
      navigate("/parent/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadCard() {
    if (!selectedStudentId || !selectedExamId) return;
    setLoadingCard(true);
    setIsHeld(false);
    setIsNotPublished(false);
    setStudentDetail(null);
    setSchedules([]);
    const authHeader = { Authorization: `Bearer ${localStorage.getItem("parent_token")}` };
    try {
      // 1. Check if admin has published admit cards for this exam
      const pubRes = await fetch(
        `/api/admit-card-holds/publish-status?examId=${selectedExamId}`,
        { headers: authHeader },
      ).then(r => r.json()).catch(() => ({ published: false }));
      if (!pubRes.published) {
        setIsNotPublished(true);
        setLoadingCard(false);
        return;
      }

      // 2. Check admit card hold status
      const holdRes = await fetch(
        `/api/admit-card-holds?examId=${selectedExamId}&studentId=${selectedStudentId}`,
        { headers: authHeader },
      ).then(r => r.json()).catch(() => []);

      const holdEntry = Array.isArray(holdRes) ? holdRes.find((h: { studentId: number; held: boolean }) => h.studentId === selectedStudentId && h.held) : null;
      if (holdEntry) {
        setIsHeld(true);
        setLoadingCard(false);
        return;
      }

      // 3. Load student details via parent's student list + schedule in parallel
      const pid = parentId;
      if (!pid) { throw new Error("Session expired"); }

      const [studsRaw, sch] = await Promise.all([
        fetch(`/api/parents/${pid}/students`, { headers: authHeader }).then(r => r.json()).catch(() => []),
        fetch(`/api/exam-schedules?examId=${selectedExamId}`).then(r => r.json()).catch(() => []),
      ]);

      const stuList = Array.isArray(studsRaw) ? studsRaw : [];
      const found = stuList.find((s: { studentId: number }) => s.studentId === selectedStudentId) || stuList[0] || null;
      const det: StudentDetail | null = found ? {
        id: found.studentId,
        studentName: found.studentName,
        rollNo: found.rollNo ?? undefined,
        fatherName: found.fatherName ?? undefined,
        className: found.className || "—",
        sectionName: found.sectionName || "—",
      } : null;
      setStudentDetail(det);
      setSchedules(Array.isArray(sch) ? sch : []);
    } catch {
      toast({ title: "Failed to load admit card", variant: "destructive" });
    } finally {
      setLoadingCard(false);
    }
  }

  function printAdmitCard() {
    if (!studentDetail) return;
    const examObj = exams.find(e => e.id === selectedExamId);
    const examName = examObj?.name ?? "Examination";
    const sName = schoolInfo?.schoolName || "School";
    const contact = schoolInfo?.contactNumber || "";
    const udise = schoolInfo?.udiseCode || "";
    const address = schoolInfo?.address || "";

    const qrData = encodeURIComponent(`ADMIT:${selectedStudentId}:${selectedExamId}:${examName}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}`;

    const scheduleHtml = schedules.length > 0 ? `
      <table style="width:100%;margin-top:8px;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#1e3a5f;color:#fff">
            <th style="border:1px solid #1e3a5f;padding:5px 6px;text-align:left">Subject</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Date</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Time</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Room</th>
          </tr>
        </thead>
        <tbody>
          ${schedules.map((sc, i) => `
            <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#fff"}">
              <td style="border:1px solid #dee2e6;padding:4px 6px">${sc.subjectName}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.examDate ?? "—"}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.startTime && sc.endTime ? `${sc.startTime}–${sc.endTime}` : "—"}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.room ?? "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : "<p style='font-size:11px;color:#666;margin-top:6px'>Schedule will be announced.</p>";

    const html = `<!DOCTYPE html><html><head><title>Admit Card – ${studentDetail.studentName}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:24px;background:#f0f0f0}
  @media print{body{background:white;padding:0}@page{margin:12mm}}
</style></head><body>
<div style="border:2px solid #1e3a5f;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      ${schoolInfo?.logoUrl ? `<img src="${schoolInfo.logoUrl}" width="48" height="48" style="border-radius:50%;object-fit:cover;background:#fff" />` : `<div style="width:48px;height:48px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 4L28 10V14C28 20.627 22.627 26.627 16 28C9.373 26.627 4 20.627 4 14V10L16 4Z" fill="#1e3a5f"/><path d="M16 8L24 12V15C24 19.418 20.418 23.418 16 24.5C11.582 23.418 8 19.418 8 15V12L16 8Z" fill="#f59e0b"/></svg>
      </div>`}
      <div>
        <div style="font-size:16px;font-weight:bold;letter-spacing:0.5px">${sName.toUpperCase()}</div>
        ${address ? `<div style="font-size:9px;opacity:0.8">${address}</div>` : ""}
        <div style="font-size:9px;opacity:0.75">${contact ? `Tel: ${contact}` : ""}${udise ? ` | UDISE: ${udise}` : ""}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;background:#fff;color:#1e3a5f;padding:3px 10px;border-radius:12px;font-weight:bold">ADMIT CARD</div>
      <div style="font-size:12px;font-weight:bold;margin-top:4px">${examName.toUpperCase()}</div>
      ${examObj?.session ? `<div style="font-size:9px;opacity:0.8">Session: ${examObj.session}</div>` : ""}
    </div>
  </div>

  <div style="padding:14px 16px;display:flex;gap:14px">
    <div style="flex:1">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#555;padding:3px 0;width:130px">Student Name</td><td style="font-weight:bold;padding:3px 0">: ${studentDetail.studentName}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Roll Number</td><td style="font-weight:bold;padding:3px 0">: ${studentDetail.rollNo ?? "—"}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Class / Section</td><td style="font-weight:bold;padding:3px 0">: ${studentDetail.className} – ${studentDetail.sectionName}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Father's Name</td><td style="padding:3px 0">: ${studentDetail.fatherName || "—"}</td></tr>
      </table>
      <div style="margin-top:8px;padding:6px 8px;background:#fff8e1;border-left:3px solid #f59e0b;font-size:10px;color:#555">
        Candidate must bring this card to every paper. Late entry not permitted.
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:88px">
      <div style="width:80px;height:90px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#999;text-align:center;border-radius:4px">Photo<br>Here</div>
      <img src="${qrUrl}" width="80" height="80" style="border:1px solid #eee;border-radius:4px" alt="QR" />
      <div style="font-size:8px;color:#888;text-align:center">Scan to verify</div>
    </div>
  </div>

  <div style="padding:0 16px 8px">
    <div style="font-size:11px;font-weight:bold;color:#1e3a5f;border-bottom:1px solid #1e3a5f;margin-bottom:6px;padding-bottom:2px">EXAMINATION SCHEDULE</div>
    ${scheduleHtml}
  </div>

  <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb">
    <div style="text-align:center">
      <div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div>
      <div style="font-size:10px;color:#555">Student Signature</div>
    </div>
    <div style="text-align:center">
      <div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div>
      <div style="font-size:10px;color:#555">Principal Signature & Stamp</div>
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
      <ParentLayout title="Admit Card">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </ParentLayout>
    );
  }

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <ParentLayout title="Admit Card">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold">Admit Card</h1>
        </div>

        {/* Selectors */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              {students.length > 1 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Student</p>
                  <Select
                    value={selectedStudentId?.toString() ?? ""}
                    onValueChange={(v) => setSelectedStudentId(parseInt(v))}
                  >
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.studentId} value={s.studentId.toString()}>{s.studentName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Exam</p>
                <Select
                  value={selectedExamId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedExamId(parseInt(v))}
                >
                  <SelectTrigger className="w-52"><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>
                    {exams.length === 0
                      ? <SelectItem value="__none" disabled>No published exams</SelectItem>
                      : exams.map(e => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadingCard && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* Not Published Message */}
        {!loadingCard && isNotPublished && (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <ClipboardList className="h-7 w-7 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-700">Admit Cards Not Yet Available</h2>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    The admit card for <strong>{exams.find(e => e.id === selectedExamId)?.name ?? "this exam"}</strong> has not been published yet. Please check back later or contact school administration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Held Message */}
        {!loadingCard && !isNotPublished && !studentDetail && isHeld && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                  <Lock className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-red-700">Admit Card is Held</h2>
                  <p className="text-sm text-red-600 mt-1 max-w-sm">
                    Your child's admit card for{" "}
                    <strong>{selectedExam?.name ?? "this exam"}</strong> has been held
                    due to pending fee dues. Please clear all outstanding dues to
                    receive the admit card.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-3 border border-red-200 shadow-sm">
                  <CreditCard className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">
                    Please visit school office or pay online to resolve dues
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-100"
                  onClick={() => navigate("/parent/fees")}
                >
                  <CreditCard className="h-4 w-4 mr-1" /> View Fee Status
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admit Card Preview */}
        {!loadingCard && !isNotPublished && !isHeld && studentDetail && selectedExam && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Eligible to Appear
              </Badge>
              <Button onClick={printAdmitCard} size="sm" className="gap-1.5">
                <Printer className="h-4 w-4" /> Print Admit Card
              </Button>
            </div>

            {/* Card Preview */}
            <Card className="border-2 border-blue-900">
              {/* Header */}
              <div className="bg-blue-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0">
                    <ClipboardList className="h-6 w-6 text-blue-900" />
                  </div>
                  <div>
                    <div className="font-bold text-base">{schoolInfo?.schoolName?.toUpperCase() ?? "SCHOOL"}</div>
                    {schoolInfo?.address && <div className="text-xs opacity-80">{schoolInfo.address}</div>}
                    <div className="text-xs opacity-75">
                      {schoolInfo?.contactNumber ? `Tel: ${schoolInfo.contactNumber}` : ""}
                      {schoolInfo?.udiseCode ? ` | UDISE: ${schoolInfo.udiseCode}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-white text-blue-900 font-bold text-xs">ADMIT CARD</Badge>
                  <div className="text-sm font-bold mt-1">{selectedExam.name.toUpperCase()}</div>
                  {selectedExam.session && <div className="text-xs opacity-80">{selectedExam.session}</div>}
                </div>
              </div>

              <CardContent className="pt-4 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-4 text-sm">
                      <span className="text-muted-foreground">Student Name</span>
                      <span className="font-semibold">{studentDetail.studentName}</span>
                      <span className="text-muted-foreground">Roll Number</span>
                      <span className="font-semibold">{studentDetail.rollNo ?? "—"}</span>
                      <span className="text-muted-foreground">Class / Section</span>
                      <span className="font-semibold">{studentDetail.className} – {studentDetail.sectionName}</span>
                      <span className="text-muted-foreground">Father's Name</span>
                      <span>{studentDetail.fatherName || "—"}</span>
                    </div>
                    <div className="mt-2 p-2 bg-amber-50 border-l-4 border-amber-400 text-xs text-muted-foreground rounded-sm">
                      Candidate must bring this card to every paper. Late entry not permitted.
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-20 h-24 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-xs text-muted-foreground text-center">
                      Photo<br />Here
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                {schedules.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-blue-900 border-b border-blue-900 pb-1 mb-2 uppercase">
                      Examination Schedule
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead><Calendar className="h-3.5 w-3.5 inline mr-1" />Date</TableHead>
                          <TableHead><Clock className="h-3.5 w-3.5 inline mr-1" />Time</TableHead>
                          <TableHead>Room</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((sc, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-sm">{sc.subjectName}</TableCell>
                            <TableCell className="text-sm">{sc.examDate ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {sc.startTime && sc.endTime ? `${sc.startTime} – ${sc.endTime}` : "—"}
                            </TableCell>
                            <TableCell className="text-sm">{sc.room ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {schedules.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded">
                    <AlertCircle className="h-4 w-4" />
                    Schedule will be announced. Arrive 30 minutes before exam time.
                  </div>
                )}

                <div className="flex justify-between items-end pt-2 border-t">
                  <div className="text-center">
                    <div className="border-t border-gray-400 w-28 mb-1" />
                    <div className="text-xs text-muted-foreground">Student Signature</div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-gray-400 w-28 mb-1" />
                    <div className="text-xs text-muted-foreground">Principal Signature & Stamp</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No exams */}
        {!loadingCard && !isNotPublished && !isHeld && !studentDetail && exams.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No upcoming exams found. Admit cards will appear here once the admin schedules an exam.</p>
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
