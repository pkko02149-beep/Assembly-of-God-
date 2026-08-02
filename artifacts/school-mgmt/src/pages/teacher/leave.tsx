import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Loader2, CalendarRange, Users, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";

interface OwnLeave {
  id: number; reason: string; fromDate: string; toDate: string;
  status: string; adminRemarks: string; createdAt: string;
}
interface StudentLeave {
  id: number; reason: string; fromDate: string; toDate: string;
  status: string; adminRemarks: string; createdAt: string;
  studentId?: number; studentName?: string;
  fatherName?: string; className?: string; sectionName?: string;
}

export default function TeacherLeave() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ownLeaves, setOwnLeaves] = useState<OwnLeave[]>([]);
  const [studentLeaves, setStudentLeaves] = useState<StudentLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [form, setForm] = useState({ reason: "", fromDate: "", toDate: "" });

  useEffect(() => {
    if (!localStorage.getItem("teacher_token")) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await teacherApi.get<{ ownLeaves: OwnLeave[]; studentLeaves: StudentLeave[] } | OwnLeave[]>("/leave-requests");
      if (data && !Array.isArray(data) && "ownLeaves" in data) {
        setOwnLeaves(data.ownLeaves || []);
        setStudentLeaves(data.studentLeaves || []);
      } else if (Array.isArray(data)) {
        setOwnLeaves(data);
        setStudentLeaves([]);
      }
    } catch (err) { if (isAuthError(err)) navigate("/teacher/login"); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.reason || !form.fromDate || !form.toDate) {
      toast({ title: "Error", description: "All fields required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await teacherApi.post("/leave-requests", form);
      toast({ title: "Submitted", description: "Leave request submitted for admin approval" });
      setOpen(false);
      setForm({ reason: "", fromDate: "", toDate: "" });
      loadData();
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function updateStudentLeave(id: number, status: "approved" | "rejected") {
    setUpdating(id);
    try {
      await teacherApi.put(`/leave-requests/${id}`, { status });
      toast({ title: `Leave ${status}` });
      loadData();
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally { setUpdating(null); }
  }

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  const pendingCount = studentLeaves.filter(r => r.status === "pending").length;

  if (loading) return (
    <TeacherLayout title="Leave">
      <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mt-20" /></div>
    </TeacherLayout>
  );

  return (
    <TeacherLayout title="Leave">
      <Tabs defaultValue="own">
        <div className="flex items-center justify-between mb-5">
          <TabsList>
            <TabsTrigger value="own">My Leave ({ownLeaves.length})</TabsTrigger>
            <TabsTrigger value="students">
              Student Leave
              {pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setOpen(true)} size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
            <Plus className="w-4 h-4 mr-1" /> Apply Leave
          </Button>
        </div>

        <TabsContent value="own">
          {ownLeaves.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No leave requests yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ownLeaves.map(r => {
                const days = differenceInCalendarDays(new Date(r.toDate), new Date(r.fromDate)) + 1;
                return (
                  <Card key={r.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CalendarRange className="w-4 h-4 text-amber-500" />
                        <span className="font-medium text-slate-700">
                          {format(new Date(r.fromDate), "MMM d")} – {format(new Date(r.toDate), "MMM d, yyyy")}
                        </span>
                        <Badge className={statusStyles[r.status] || "bg-slate-100 text-slate-600"}>{r.status}</Badge>
                        <span className="text-xs text-slate-400">{days} day{days > 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-sm text-slate-600">{r.reason}</p>
                      {r.adminRemarks && (
                        <p className="text-xs text-slate-400 mt-1 italic bg-slate-50 p-2 rounded">Admin: {r.adminRemarks}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-800">Student Leave Requests — My Class</h3>
              <p className="text-xs text-slate-500">{studentLeaves.length} total · {pendingCount} pending</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="h-8">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {studentLeaves.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No student leave requests for your class</p>
                <p className="text-xs mt-1">Leave requests submitted by parents for students in your class will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {studentLeaves.map(r => {
                const days = differenceInCalendarDays(new Date(r.toDate), new Date(r.fromDate)) + 1;
                return (
                  <Card key={r.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-slate-800">{r.studentName || "Student"}</span>
                            {r.className && (
                              <Badge variant="outline" className="text-xs">
                                {r.className}{r.sectionName ? ` – ${r.sectionName}` : ""}
                              </Badge>
                            )}
                            <Badge className={statusStyles[r.status] || "bg-slate-100 text-slate-600"}>{r.status}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                            <CalendarRange className="w-3 h-3" />
                            {format(new Date(r.fromDate), "MMM d")} – {format(new Date(r.toDate), "MMM d, yyyy")} · {days} day{days > 1 ? "s" : ""}
                          </div>
                          <p className="text-sm text-slate-600">{r.reason}</p>
                          {r.fatherName && <p className="text-xs text-slate-400 mt-1">Parent: {r.fatherName}</p>}
                        </div>
                        {r.status === "pending" && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" onClick={() => updateStudentLeave(r.id, "approved")}
                              disabled={updating === r.id}
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateStudentLeave(r.id, "rejected")}
                              disabled={updating === r.id}
                              className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From Date *</Label>
                <Input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To Date *</Label>
                <Input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea placeholder="Reason for leave..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
            </div>
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
}
