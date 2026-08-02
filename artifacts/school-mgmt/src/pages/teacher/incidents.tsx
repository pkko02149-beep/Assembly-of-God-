import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShieldAlert, Plus, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, Flame,
  CheckCheck, RotateCcw, CalendarCheck, Trash2
} from "lucide-react";
import { format, isValid } from "date-fns";

import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

interface Teacher { id: number; classAssigned: number | null; className?: string; name: string; }
interface Student { id: number; studentName: string; rollNo: number; classId: number; studentType?: string; isPromoted?: boolean; }
interface FirRecord {
  id: number;
  studentId: number;
  classId: number;
  incidentDate: string;
  description: string;
  actionTaken: string;
  severity: string;
  status: string;
  resolvedAt: string | null;
  reportedById: number;
  createdAt: string;
  studentName: string | null;
  className: string | null;
}

function safeFormat(dateStr: string | null | undefined, fmt: string, fallback = "—"): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : fallback;
}

const SEVERITY_CONFIG = {
  minor:    { label: "Minor",    color: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-400" },
  moderate: { label: "Moderate", color: "bg-amber-100 text-amber-700 border-amber-200",    dot: "bg-amber-400" },
  major:    { label: "Major",    color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  severe:   { label: "Severe",   color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200",          dot: "bg-red-600" },
} as const;

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.minor;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status, resolvedAt }: { status: string; resolvedAt?: string | null }) {
  if (status === "resolved") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3" /> Resolved
        </span>
        {resolvedAt && (
          <span className="text-[10px] text-green-600 flex items-center gap-1 pl-1">
            <CalendarCheck className="w-2.5 h-2.5" />
            {safeFormat(resolvedAt, "dd MMM yyyy")}
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-600 border-slate-200">
      <Clock className="w-3 h-3" /> Open
    </span>
  );
}

const today = new Date().toISOString().split("T")[0];

export default function TeacherIncidents() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<FirRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    studentId: "",
    incidentDate: today,
    severity: "minor",
    description: "",
    actionTaken: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Resolve dialog
  const [resolveRecord, setResolveRecord] = useState<FirRecord | null>(null);
  const [resolveDate, setResolveDate] = useState(today);
  const [resolving, setResolving] = useState(false);

  // Reopen confirm
  const [reopenRecord, setReopenRecord] = useState<FirRecord | null>(null);
  const [reopening, setReopening] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const t = await teacherApi.get<Teacher>("/auth/teacher/me");
      setTeacher(t);
      if (t.classAssigned) {
        const [studs, firs] = await Promise.all([
          teacherApi.get<Student[]>(`/students?classId=${t.classAssigned}`),
          teacherApi.get<FirRecord[]>(`/fir?classId=${t.classAssigned}`),
        ]);
        setStudents(studs);
        setRecords(Array.isArray(firs) ? firs : []);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
      else toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function submitIncident() {
    if (!teacher || !addForm.studentId || !addForm.description.trim()) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await teacherApi.post<FirRecord>("/fir", {
        studentId: parseInt(addForm.studentId),
        classId: teacher.classAssigned,
        incidentDate: addForm.incidentDate,
        severity: addForm.severity,
        description: addForm.description.trim(),
        actionTaken: addForm.actionTaken.trim(),
        reportedById: teacher.id,
      });
      setAddForm({ studentId: "", incidentDate: today, severity: "minor", description: "", actionTaken: "" });
      setShowAdd(false);
      toast({ title: "Incident reported successfully" });
      // Reload to get joined studentName / className from the server
      const updated = await teacherApi.get<FirRecord[]>(`/fir?classId=${teacher.classAssigned}`);
      setRecords(Array.isArray(updated) ? updated : []);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function openResolve(r: FirRecord) {
    setResolveRecord(r);
    setResolveDate(today);
  }

  async function confirmResolve() {
    if (!resolveRecord) return;
    setResolving(true);
    try {
      const updated = await teacherApi.put<FirRecord>(`/fir/${resolveRecord.id}`, {
        status: "resolved",
        resolvedAt: resolveDate || today,
      });
      setRecords(prev => prev.map(r => r.id === resolveRecord.id ? { ...r, ...updated } : r));
      setResolveRecord(null);
      toast({ title: "Incident marked as resolved" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  async function confirmReopen() {
    if (!reopenRecord) return;
    setReopening(true);
    try {
      const updated = await teacherApi.put<FirRecord>(`/fir/${reopenRecord.id}`, { status: "open", resolvedAt: null });
      setRecords(prev => prev.map(r => r.id === reopenRecord.id ? { ...r, ...updated } : r));
      setReopenRecord(null);
      toast({ title: "Incident reopened" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setReopening(false);
    }
  }

  async function deleteRecord() {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await teacherApi.del(`/fir/${deleteId}`);
      setRecords(prev => prev.filter(r => r.id !== deleteId));
      setDeleteId(null);
      toast({ title: "Incident deleted" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() =>
    filterStatus === "all" ? records : records.filter(r => r.status === filterStatus),
    [records, filterStatus]
  );

  const stats = useMemo(() => ({
    total: records.length,
    open: records.filter(r => r.status === "open").length,
    resolved: records.filter(r => r.status === "resolved").length,
  }), [records]);

  if (loading) {
    return (
      <TeacherLayout title="Incident Register">
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </TeacherLayout>
    );
  }

  if (!teacher?.classAssigned) {
    return (
      <TeacherLayout title="Incident Register">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <p>No class assigned to your account yet.</p>
            <p className="text-xs mt-2">Contact the admin to assign a class.</p>
          </CardContent>
        </Card>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="Incident Register">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Incident / FIR Register
            </h2>
            <p className="text-sm text-slate-500">
              Class: {teacher.className || `Class ${teacher.classAssigned}`} · {records.length} incidents
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Report Incident
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-slate-50">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-slate-500">Open</p>
              <p className="text-2xl font-bold text-slate-700">{stats.open}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-green-50">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-green-600">Resolved</p>
              <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-500">Filter:</span>
          {(["all", "open", "resolved"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Records */}
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {records.length === 0 ? "No incidents reported yet" : "No incidents match the filter"}
              </p>
              {records.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Report First Incident
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const student = students.find(s => s.id === r.studentId);
              return (
                <Card key={r.id} className={`border-0 shadow-sm ${r.status === "resolved" ? "bg-green-50/40" : ""}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="font-semibold text-slate-800">{r.studentName ?? student?.studentName ?? "Unknown"}</p>
                          {student && <SessionStatusBadge studentType={student.studentType} />}
                          <SeverityBadge severity={r.severity} />
                          <StatusBadge status={r.status} resolvedAt={r.resolvedAt} />
                        </div>
                        <p className="text-xs text-slate-400 mb-2">
                          Incident Date: {safeFormat(r.incidentDate, "dd MMM yyyy")} ·
                          Reported: {safeFormat(r.createdAt, "dd MMM yyyy")}
                        </p>
                        <div className="space-y-1">
                          <div>
                            <span className="text-xs font-medium text-slate-500">Incident: </span>
                            <span className="text-sm text-slate-700">{r.description}</span>
                          </div>
                          {r.actionTaken && (
                            <div>
                              <span className="text-xs font-medium text-slate-500">Action Taken: </span>
                              <span className="text-sm text-slate-600">{r.actionTaken}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {r.status === "open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => openResolve(r)}
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            Resolve
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
                            onClick={() => setReopenRecord(r)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reopen
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-red-500"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Incident dialog */}
      <Dialog open={showAdd} onOpenChange={open => { if (!open) setShowAdd(false); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Report New Incident
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Student *</Label>
                <Select value={addForm.studentId} onValueChange={v => setAddForm(f => ({ ...f, studentId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student…" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map(s => {
                      const sessionStatus = getSessionStatus(s.studentType);
                      return (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.studentName} (Roll {s.rollNo}){sessionStatus ? ` [${sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}]` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Incident Date *</Label>
                <Input
                  type="date"
                  value={addForm.incidentDate}
                  max={today}
                  onChange={e => setAddForm(f => ({ ...f, incidentDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Severity *</Label>
                <Select value={addForm.severity} onValueChange={v => setAddForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Incident Description *</Label>
              <Textarea
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Describe what happened…"
                className="resize-none"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Action Taken (optional)</Label>
              <Textarea
                value={addForm.actionTaken}
                onChange={e => setAddForm(f => ({ ...f, actionTaken: e.target.value }))}
                rows={2}
                placeholder="Any immediate action taken…"
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={submitIncident}
              disabled={submitting || !addForm.studentId || !addForm.description.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!resolveRecord} onOpenChange={open => !open && setResolveRecord(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCheck className="w-5 h-5" />
              Resolve Incident
            </DialogTitle>
          </DialogHeader>
          {resolveRecord && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-50 border text-sm">
                <p className="font-medium text-slate-800">{resolveRecord.studentName}</p>
                <p className="text-slate-600 text-xs mt-1 line-clamp-2">{resolveRecord.description}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Resolution Date *
                </Label>
                <Input
                  type="date"
                  value={resolveDate}
                  onChange={e => setResolveDate(e.target.value)}
                  max={today}
                />
                <p className="text-xs text-slate-400 mt-1">Date the incident was resolved or closed.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveRecord(null)}>Cancel</Button>
            <Button
              onClick={confirmResolve}
              disabled={resolving || !resolveDate}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {resolving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen confirm */}
      <AlertDialog open={!!reopenRecord} onOpenChange={open => !open && setReopenRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status back to <strong>Open</strong> and clear the resolved date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReopen} disabled={reopening} className="bg-slate-700 hover:bg-slate-800 text-white">
              {reopening && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the incident record and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRecord} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherLayout>
  );
}
