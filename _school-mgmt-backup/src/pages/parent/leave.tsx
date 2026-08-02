import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Loader2, CalendarRange } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";

interface LeaveRequest { id: number; reason: string; fromDate: string; toDate: string; status: string; adminRemarks: string; studentId?: number; createdAt: string; }
interface Student { studentId: number; studentName: string; }

export default function ParentLeave() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ reason: "", fromDate: "", toDate: "", studentId: "" });

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const p = await parentApi.get<{ id: number; students: Student[] }>("/auth/parent/me");
      setStudents(p.students || []);
      if (p.students?.length > 0) setForm(f => ({ ...f, studentId: String(p.students[0].studentId) }));
      const r = await parentApi.get<LeaveRequest[]>("/leave-requests");
      setRequests(r);
    } catch { navigate("/parent/login"); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.reason || !form.fromDate || !form.toDate) {
      toast({ title: "Error", description: "All fields required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await parentApi.post("/leave-requests", {
        reason: form.reason,
        fromDate: form.fromDate,
        toDate: form.toDate,
        studentId: form.studentId ? parseInt(form.studentId) : undefined,
      });
      toast({ title: "Submitted", description: "Leave request submitted for admin approval" });
      setOpen(false);
      setForm(f => ({ ...f, reason: "", fromDate: "", toDate: "" }));
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  if (loading) return <ParentLayout title="Leave Request"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div></ParentLayout>;

  return (
    <ParentLayout title="Leave Requests">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Leave Requests</h2>
          <p className="text-sm text-slate-500">{requests.length} requests</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
          <Plus className="w-4 h-4 mr-2" /> Apply Leave
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No leave requests yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const days = differenceInCalendarDays(new Date(r.toDate), new Date(r.fromDate)) + 1;
            return (
              <Card key={r.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CalendarRange className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-slate-700">
                          {format(new Date(r.fromDate), "MMM d")} – {format(new Date(r.toDate), "MMM d, yyyy")}
                        </span>
                        <Badge className={statusStyles[r.status] || "bg-slate-100 text-slate-600"}>{r.status}</Badge>
                        <span className="text-xs text-slate-400">{days} day{days > 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-sm text-slate-600">{r.reason}</p>
                      {r.adminRemarks && (
                        <p className="text-xs text-slate-400 mt-1 italic bg-slate-50 p-2 rounded">Admin remarks: {r.adminRemarks}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Student Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {students.length > 1 && (
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select value={form.studentId} onValueChange={v => setForm(f => ({ ...f, studentId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.studentId} value={String(s.studentId)}>{s.studentName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
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
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ParentLayout>
  );
}
