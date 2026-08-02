import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Trash2, Download, Plus, BookOpen, Users,
  Loader2, User, Calendar,
} from "lucide-react";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { uploadDocumentToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher {
  id: number;
  name: string;
  subject: string;
  classAssigned: number | null;
  sectionAssigned: number | null;
}

interface TimetableEntry {
  id: number;
  dayOfWeek: number;
  subject: string;
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  teacherId: number;
  teacherName: string;
  startTime: string;
  endTime: string;
  period: number;
}

interface TeacherDocument {
  id: number;
  title: string;
  subject: string;
  description: string;
  fileUrl: string;
  fileType: string;
  teacherId: number;
  teacherName: string;
  classId: number;
  className: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFileIcon(fileType: string) {
  const t = fileType?.toLowerCase();
  if (t === "pdf") return "📄";
  if (t === "doc" || t === "docx") return "📝";
  if (t === "xls" || t === "xlsx") return "📊";
  if (t === "ppt" || t === "pptx") return "📊";
  if (t?.startsWith("image")) return "🖼️";
  return "📎";
}

function inferFileType(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "docx";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "pptx";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}

// ─── Upload Dialog ────────────────────────────────────────────────────────────

function UploadDialog({
  open,
  onClose,
  dialogTitle,
  subtitle,
  fixedSubject,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  dialogTitle: string;
  subtitle: string;
  fixedSubject?: string; // if set, subject field is locked
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ title: "", subject: fixedSubject || "", description: "", file: null as File | null });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm({ title: "", subject: fixedSubject || "", description: "", file: null });
  }, [open, fixedSubject]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    if (!form.file) return toast({ title: "Please select a file", variant: "destructive" });

    setUploading(true);
    try {
      const fileUrl = await uploadDocumentToCloudinary(form.file);
      const fileType = inferFileType(form.file);
      await teacherApi.post("/teacher-documents", {
        title: form.title.trim(),
        subject: form.subject.trim(),
        description: form.description.trim(),
        fileUrl,
        fileType,
      });
      toast({ title: "Document uploaded!" });
      onClose();
      onUploaded();
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Could not upload. Check Cloudinary is configured in Settings.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-slate-500 mb-2">{subtitle}</div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Chapter 3 Notes"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              placeholder="e.g. Mathematics"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              disabled={!!fixedSubject}
              className={fixedSubject ? "bg-slate-50 text-slate-500" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional notes or description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>File <span className="text-red-500">*</span></Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
              required
            />
            <p className="text-xs text-slate-400">PDF, Word, Excel, PowerPoint, or images</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading…</> : <><Upload className="w-4 h-4 mr-2" />Upload</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document item row ────────────────────────────────────────────────────────

function DocRow({ doc, canDelete, onDelete }: { doc: TeacherDocument; canDelete: boolean; onDelete: () => void }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-lg shrink-0 mt-0.5">{getFileIcon(doc.fileType)}</span>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">{doc.title}</div>
            {doc.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.description}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {doc.subject && (
                <Badge variant="secondary" className="text-xs">{doc.subject}</Badge>
              )}
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" />{doc.teacherName}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Open
          </a>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Subject Tab ───────────────────────────────────────────────────────────
// Uses the timetable (same as Homework "My Subjects" tab) to find which
// subjects this teacher is assigned to, then shows one card per unique subject.

function MySubjectTab({ teacher, docs, onRefresh }: { teacher: Teacher; docs: TeacherDocument[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loadingTT, setLoadingTT] = useState(true);
  // dialog state: which subject+class is being uploaded for
  const [dialog, setDialog] = useState<{ subject: string; className: string; sectionName: string | null } | null>(null);

  useEffect(() => {
    teacherApi
      .get<TimetableEntry[]>(`/timetable?teacherId=${teacher.id}`)
      .then(setTimetable)
      .catch(() => {/* silently ignore – empty state will show */})
      .finally(() => setLoadingTT(false));
  }, [teacher.id]);

  // Unique subject+class combos across all days of the timetable
  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return timetable.filter((e) => {
      const key = `${e.subject.toLowerCase()}|${e.classId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [timetable]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    try {
      await teacherApi.del(`/teacher-documents/${id}`);
      toast({ title: "Deleted" });
      onRefresh();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  if (loadingTT) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (uniqueSubjects.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No subjects assigned in timetable</p>
          <p className="text-sm mt-1">Ask the admin to add you to the timetable</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {uniqueSubjects.map((entry) => {
        // docs uploaded by this teacher for this subject
        const subjectDocs = docs.filter(
          (d) =>
            d.teacherId === teacher.id &&
            d.subject.toLowerCase() === entry.subject.toLowerCase(),
        );
        const label = entry.className + (entry.sectionName ? ` – ${entry.sectionName}` : "");

        return (
          <Card key={`${entry.subject}|${entry.classId}`} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{entry.subject}</span>
                      <Badge variant="outline" className="text-xs">{label}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{teacher.name}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0"
                  onClick={() =>
                    setDialog({ subject: entry.subject, className: label, sectionName: entry.sectionName })
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {subjectDocs.length > 0 ? "Upload More" : "Upload"}
                </Button>
              </div>

              {subjectDocs.length > 0 ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Uploaded documents</p>
                  {subjectDocs.map((doc) => (
                    <DocRow key={doc.id} doc={doc} canDelete onDelete={() => handleDelete(doc.id)} />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic border-t border-slate-100 pt-3">
                  No documents uploaded for {entry.subject} yet
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {dialog && (
        <UploadDialog
          open
          onClose={() => setDialog(null)}
          dialogTitle={`Upload for ${dialog.subject}`}
          subtitle={`Subject: ${dialog.subject} · ${dialog.className}`}
          fixedSubject={dialog.subject}
          onUploaded={() => { setDialog(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── My Class Tab ─────────────────────────────────────────────────────────────

function MyClassTab({ teacher, docs, onRefresh }: { teacher: Teacher; docs: TeacherDocument[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);

  const className = docs.find((d) => d.classId === teacher.classAssigned)?.className || (teacher.classAssigned ? `Class ${teacher.classAssigned}` : "");

  async function handleDelete(id: number) {
    if (!confirm("Delete this document?")) return;
    try {
      await teacherApi.del(`/teacher-documents/${id}`);
      toast({ title: "Deleted" });
      onRefresh();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  if (!teacher.classAssigned) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-16 text-center text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">You are not assigned as a class teacher</p>
          <p className="text-sm mt-1">Contact the admin to be assigned to a class</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Class card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{className || "My Class"}</span>
                  <Badge variant="outline" className="text-xs">All subjects</Badge>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Class teacher uploads</div>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0"
              onClick={() => setDialog(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {docs.length > 0 ? "Upload More" : "Upload"}
            </Button>
          </div>

          {/* All class docs */}
          {docs.length > 0 ? (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500 mb-1">All class documents</p>
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  canDelete={doc.teacherId === teacher.id}
                  onDelete={() => handleDelete(doc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic border-t border-slate-100 pt-3">
              No documents uploaded for this class yet
            </div>
          )}
        </CardContent>
      </Card>

      <UploadDialog
        open={dialog}
        onClose={() => setDialog(false)}
        dialogTitle="Upload for My Class"
        subtitle={`Upload any document for ${className || "your class"}`}
        onUploaded={onRefresh}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherDownloads() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [docs, setDocs] = useState<TeacherDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"subject" | "class">("subject");

  async function loadAll() {
    const [t, d] = await Promise.all([
      teacherApi.get<Teacher>("/auth/teacher/me"),
      teacherApi.get<TeacherDocument[]>("/teacher-documents"),
    ]);
    setTeacher(t);
    setDocs(d);
  }

  useEffect(() => {
    loadAll()
      .catch((err) => {
        if (isAuthError(err)) navigate("/teacher/login");
        else toast({ title: "Failed to load downloads", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
        </div>
      </TeacherLayout>
    );
  }

  if (!teacher) return null;

  return (
    <TeacherLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Downloads</h1>
          <p className="text-sm text-slate-500 mt-1">Document Management</p>
          <p className="text-xs text-slate-400 mt-0.5">Upload and manage documents for your subject and class</p>
        </div>

        {/* Tab buttons — identical style to Homework */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("subject")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              tab === "subject"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Upload for My Subjects
          </button>
          <button
            onClick={() => setTab("class")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
              tab === "class"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4" />
            Upload for My Class
          </button>
        </div>

        {tab === "subject" ? (
          <MySubjectTab teacher={teacher} docs={docs} onRefresh={loadAll} />
        ) : (
          <MyClassTab teacher={teacher} docs={docs} onRefresh={loadAll} />
        )}
      </div>
    </TeacherLayout>
  );
}
