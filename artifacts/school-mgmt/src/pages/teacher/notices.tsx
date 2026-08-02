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
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, Trash2, Loader2, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Notice {
  id: number; title: string; content: string; targetRole: string;
  classId?: number; authorRole: string; isActive: boolean; createdAt: string;
}
interface TeacherProfile {
  id: number; name: string; classAssigned?: number; sectionAssigned?: number;
  className?: string; sectionName?: string;
}

export default function TeacherNotices() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });

  useEffect(() => {
    if (!localStorage.getItem("teacher_token")) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const [n, t] = await Promise.all([
        teacherApi.get<Notice[]>("/notices"),
        teacherApi.get<TeacherProfile>("/auth/teacher/me").catch(() => null),
      ]);
      // Show only notices for teacher's class or for all teachers
      const filtered = Array.isArray(n) ? n.filter(notice =>
        notice.targetRole === "teachers" ||
        notice.targetRole === "all" ||
        (t && notice.classId === t.classAssigned)
      ) : [];
      setNotices(filtered);
      setTeacher(t);
    } catch (err) { if (isAuthError(err)) navigate("/teacher/login"); }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!form.title || !form.content) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" }); return;
    }
    if (!teacher?.classAssigned) {
      toast({ title: "No class assigned", description: "You must have a class assigned to send notices", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await teacherApi.post("/notices", {
        title: form.title,
        content: form.content,
        targetRole: "parents",
        classId: teacher.classAssigned,
        sectionId: teacher.sectionAssigned || null,
      });
      toast({ title: "Published", description: "Notice sent to your class parents" });
      setOpen(false);
      setForm({ title: "", content: "" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this notice?")) return;
    await teacherApi.del(`/notices/${id}`);
    toast({ title: "Deleted" });
    loadData();
  }

  if (loading) return (
    <TeacherLayout title="Notices">
      <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mt-20" /></div>
    </TeacherLayout>
  );

  return (
    <TeacherLayout title="Notices">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Class Notices</h2>
          <p className="text-sm text-slate-500">
            {teacher?.className
              ? `Sending to parents of ${teacher.className}${teacher.sectionName ? ` – ${teacher.sectionName}` : ""}`
              : "Notices visible to you"}
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={!teacher?.classAssigned}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" /> Send Notice to Class
        </Button>
      </div>

      {!teacher?.classAssigned && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <CardContent className="py-4 text-sm text-amber-700 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            You don't have a class assigned. Ask admin to assign you a class to send notices.
          </CardContent>
        </Card>
      )}

      {notices.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notices yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map(n => (
            <Card key={n.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                      <h4 className="font-semibold text-slate-800 truncate">{n.title}</h4>
                      <Badge className={
                        n.targetRole === "teachers" ? "bg-green-100 text-green-700" :
                        n.targetRole === "parents" ? "bg-purple-100 text-purple-700" :
                        "bg-blue-100 text-blue-700"
                      }>
                        {n.targetRole === "teachers" ? "Teachers" :
                         n.targetRole === "parents" && n.classId ? "My Class Parents" :
                         n.targetRole === "parents" ? "All Parents" : "Everyone"}
                      </Badge>
                      {n.authorRole === "admin" && (
                        <Badge variant="outline" className="text-xs">From Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{n.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {format(new Date(n.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  {n.authorRole === "teacher" && (
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 shrink-0" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notice to Class</DialogTitle>
          </DialogHeader>
          {teacher?.classAssigned && (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              📣 This notice will be sent to parents of <strong>{teacher.className}{teacher.sectionName ? ` – ${teacher.sectionName}` : ""}</strong>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="Notice title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Content *</Label>
              <Textarea placeholder="Write the notice content..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} />
            </div>
            <Button onClick={handleAdd} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Publish Notice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
}
