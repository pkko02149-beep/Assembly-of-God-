import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
import { BookOpen, Plus, Trash2, Loader2, Users, Clock, CheckCircle2, Sparkles, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getToken } from "@/lib/jwt-api";

// ─── AI helpers ───────────────────────────────────────────────────────────────

async function generateHomeworkAI(params: {
  className: string;
  sectionName?: string | null;
  subject: string;
}): Promise<string> {
  const token = getToken("teacher");
  const res = await fetch("/api/ai/generate-homework", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI generation failed");
  return data.text as string;
}

async function translateText(text: string, targetLang: "hi" | "en"): Promise<string> {
  if (!text.trim()) return "";
  try {
    const token = getToken("teacher");
    const res = await fetch("/api/ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, targetLang }),
    });
    const data = await res.json();
    return data.text || text;
  } catch {
    return text;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher { id: number; name: string; classAssigned: number | null; subject: string; classAssignedName?: string; }
interface TimetableEntry { id: number; dayOfWeek: number; subject: string; classId: number; className: string; sectionId: number | null; sectionName: string | null; teacherId: number; teacherName: string; startTime: string; endTime: string; period: number; }
interface Homework { id: number; title: string; subject: string; description: string; titleHi: string; descriptionHi: string; dueDate: string; classId: number; sectionId: number | null; className: string; sectionName?: string; teacherId: number; teacherName?: string; createdAt: string; }
interface BilingualForm { title: string; description: string; titleHi: string; descriptionHi: string; dueDate: string; }

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function getDayOfWeek(dateStr: string): number { const d = new Date(dateStr); return d.getDay(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
const emptyForm = (): BilingualForm => ({ title: "", description: "", titleHi: "", descriptionHi: "", dueDate: "" });

// ─── Bilingual Assign Dialog ──────────────────────────────────────────────────

function BilingualAssignDialog({
  open, onClose, dialogTitle, subtitle, onSave, onGenerateAI,
}: {
  open: boolean;
  onClose: () => void;
  dialogTitle: string;
  subtitle: string;
  onSave: (form: BilingualForm) => Promise<void>;
  onGenerateAI?: () => Promise<string>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<BilingualForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [translatingHi, setTranslatingHi] = useState(false);
  const [translatingEn, setTranslatingEn] = useState(false);

  // Debounce refs to avoid translating on every keystroke
  const enTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag to prevent re-translating translated text
  const skipNextHiRef = useRef(false);
  const skipNextEnRef = useRef(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  function handleEnglishChange(field: "title" | "description", value: string) {
    setForm(f => field === "title" ? { ...f, title: value } : { ...f, description: value });
    if (skipNextHiRef.current) { skipNextHiRef.current = false; return; }
    if (enTimer.current) clearTimeout(enTimer.current);
    enTimer.current = setTimeout(async () => {
      if (!value.trim()) return;
      setTranslatingHi(true);
      try {
        const translated = await translateText(value, "hi");
        skipNextEnRef.current = true;
        setForm(f => field === "title" ? { ...f, titleHi: translated } : { ...f, descriptionHi: translated });
      } finally { setTranslatingHi(false); }
    }, 900);
  }

  function handleHindiChange(field: "title" | "description", value: string) {
    setForm(f => field === "title" ? { ...f, titleHi: value } : { ...f, descriptionHi: value });
    if (skipNextEnRef.current) { skipNextEnRef.current = false; return; }
    if (hiTimer.current) clearTimeout(hiTimer.current);
    hiTimer.current = setTimeout(async () => {
      if (!value.trim()) return;
      setTranslatingEn(true);
      try {
        const translated = await translateText(value, "en");
        skipNextHiRef.current = true;
        setForm(f => field === "title" ? { ...f, title: translated } : { ...f, description: translated });
      } finally { setTranslatingEn(false); }
    }, 900);
  }

  async function handleGenerateAI() {
    if (!onGenerateAI) return;
    setGenerating(true);
    try {
      const text = await onGenerateAI();
      setForm(f => ({ ...f, description: text }));
      toast({ title: "✨ AI homework generated!" });
      // auto-translate the generated description to Hindi
      setTranslatingHi(true);
      try {
        const hi = await translateText(text, "hi");
        setForm(f => ({ ...f, descriptionHi: hi }));
      } finally { setTranslatingHi(false); }
    } catch (err: any) {
      toast({ title: err.message || "AI generation failed", variant: "destructive" });
    } finally { setGenerating(false); }
  }

  async function handleSave() {
    if (!form.title || !form.dueDate) {
      toast({ title: "Title and due date are required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-slate-500 mb-3">{subtitle}</div>

        {/* Due Date — shared between both languages */}
        <div className="space-y-1.5 mb-4">
          <Label>Due Date *</Label>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-48" />
        </div>

        {/* Two-panel bilingual input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── English Panel ── */}
          <div className="border border-blue-100 rounded-xl p-4 space-y-3 bg-blue-50/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-700">🇬🇧 English</span>
              {translatingEn && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Title *</Label>
              <Input
                placeholder="e.g. Chapter 5 Exercise"
                value={form.title}
                onChange={e => handleEnglishChange("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-600">Description</Label>
                {onGenerateAI && (
                  <button
                    type="button"
                    disabled={generating}
                    onClick={handleGenerateAI}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 px-2 py-0.5 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors font-medium"
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generating ? "Generating…" : "✨ AI"}
                  </button>
                )}
              </div>
              <Textarea
                placeholder="Details about the homework…"
                value={form.description}
                onChange={e => handleEnglishChange("description", e.target.value)}
                rows={5}
              />
            </div>
          </div>

          {/* ── Hindi Panel ── */}
          <div className="border border-orange-100 rounded-xl p-4 space-y-3 bg-orange-50/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-orange-700">🇮🇳 हिंदी</span>
              {translatingHi && <Loader2 className="w-3 h-3 animate-spin text-orange-400" />}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">शीर्षक *</Label>
              <Input
                placeholder="जैसे: अध्याय 5 अभ्यास"
                value={form.titleHi}
                onChange={e => handleHindiChange("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">विवरण</Label>
              <Textarea
                placeholder="गृहकार्य के बारे में विवरण…"
                value={form.descriptionHi}
                onChange={e => handleHindiChange("description", e.target.value)}
                rows={5}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          ✨ Text typed in either panel auto-translates to the other language (requires AI to be configured)
        </p>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Assign Homework
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── My Subjects Tab ──────────────────────────────────────────────────────────

function MySubjectsTab({ teacher }: { teacher: Teacher }) {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loadingTT, setLoadingTT] = useState(true);
  const [dialog, setDialog] = useState<{ entry: TimetableEntry } | null>(null);
  const [editDialog, setEditDialog] = useState<Homework | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", dueDate: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    teacherApi.get<TimetableEntry[]>(`/timetable?teacherId=${teacher.id}`)
      .then(setTimetable).finally(() => setLoadingTT(false));
    loadHomework();
  }, [teacher.id]);

  async function loadHomework() {
    const hw = await teacherApi.get<Homework[]>(`/homework?teacherId=${teacher.id}`);
    setHomework(hw);
  }

  const dayOfWeek = getDayOfWeek(date);
  const slotsForDay = useMemo(() => timetable.filter(e => e.dayOfWeek === dayOfWeek), [timetable, dayOfWeek]);

  function getHomeworkForSlot(entry: TimetableEntry) {
    return homework.filter(h => h.classId === entry.classId && h.subject.toLowerCase() === entry.subject.toLowerCase());
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this homework?")) return;
    await teacherApi.del(`/homework/${id}`);
    toast({ title: "Deleted" });
    loadHomework();
  }

  async function handleEditSave() {
    if (!editDialog || !editForm.title || !editForm.dueDate) {
      toast({ title: "Title and due date are required", variant: "destructive" }); return;
    }
    setEditSaving(true);
    try {
      await teacherApi.put(`/homework/${editDialog.id}`, { title: editForm.title, description: editForm.description, dueDate: editForm.dueDate });
      toast({ title: "Homework updated!" });
      setEditDialog(null);
      loadHomework();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setEditSaving(false); }
  }

  const openDialog = (entry: TimetableEntry) => setDialog({ entry });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Select Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        {dayOfWeek === 0
          ? <div className="text-sm text-slate-400 italic mt-4">Sunday — no classes scheduled</div>
          : <div className="text-sm font-medium text-slate-600 mt-4">{DAY_NAMES[dayOfWeek]} — {slotsForDay.length} period{slotsForDay.length !== 1 ? "s" : ""}</div>
        }
      </div>

      {loadingTT ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
      ) : dayOfWeek === 0 ? null : slotsForDay.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No periods assigned to you on {DAY_NAMES[dayOfWeek]}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slotsForDay.map(entry => {
            const hw = getHomeworkForSlot(entry);
            return (
              <Card key={entry.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{entry.subject}</span>
                          <Badge variant="outline" className="text-xs">{entry.className}{entry.sectionName ? ` – ${entry.sectionName}` : ""}</Badge>
                        </div>
                        {entry.startTime && <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" />{entry.startTime}–{entry.endTime}</div>}
                      </div>
                    </div>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0" onClick={() => openDialog(entry)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Assign
                    </Button>
                  </div>
                  {hw.length > 0 && (
                    <div className="space-y-2 mt-2 border-t border-slate-100 pt-2">
                      <p className="text-xs font-medium text-slate-500 mb-1">Assigned homework</p>
                      {hw.map(h => (
                        <div key={h.id} className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-800">{h.title}</div>
                              {h.titleHi && <div className="text-xs text-orange-700 font-medium mt-0.5">{h.titleHi}</div>}
                              <div className="text-xs text-slate-400 mt-0.5">Due {format(new Date(h.dueDate), "MMM d, yyyy")}</div>
                              {h.description && <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-wrap leading-snug">{h.description}</p>}
                              {h.descriptionHi && <p className="text-xs text-orange-600 mt-1 whitespace-pre-wrap leading-snug">{h.descriptionHi}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setEditDialog(h); setEditForm({ title: h.title, description: h.description || "", dueDate: h.dueDate }); }} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={o => !o && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Homework</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} /></div>
            <div className="space-y-1.5"><Label>Due Date *</Label><Input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialog(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />} Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bilingual Assign Dialog */}
      <BilingualAssignDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        dialogTitle={`Assign Homework — ${dialog?.entry.subject}`}
        subtitle={`Class: ${dialog?.entry.className ?? ""}${dialog?.entry.sectionName ? ` – ${dialog.entry.sectionName}` : ""}`}
        onSave={async (form) => {
          if (!dialog) return;
          await teacherApi.post("/homework", {
            classId: dialog.entry.classId,
            sectionId: dialog.entry.sectionId,
            subject: dialog.entry.subject,
            title: form.title,
            description: form.description,
            titleHi: form.titleHi,
            descriptionHi: form.descriptionHi,
            dueDate: form.dueDate,
          });
          toast({ title: "Homework assigned!" });
          loadHomework();
        }}
        onGenerateAI={dialog ? async () => generateHomeworkAI({
          className: dialog.entry.className,
          sectionName: dialog.entry.sectionName,
          subject: dialog.entry.subject,
        }) : undefined}
      />
    </div>
  );
}

// ─── My Class Tab ─────────────────────────────────────────────────────────────

function MyClassTab({ teacher }: { teacher: Teacher }) {
  const { toast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loadingTT, setLoadingTT] = useState(true);
  const [dialog, setDialog] = useState<{ subject: string; teacherName: string } | null>(null);
  const [editDialog, setEditDialog] = useState<Homework | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", dueDate: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!teacher.classAssigned) return;
    teacherApi.get<TimetableEntry[]>(`/timetable?classId=${teacher.classAssigned}`)
      .then(setTimetable).finally(() => setLoadingTT(false));
    loadHomework();
  }, [teacher.classAssigned]);

  async function loadHomework() {
    if (!teacher.classAssigned) return;
    const hw = await teacherApi.get<Homework[]>(`/homework?classId=${teacher.classAssigned}`);
    setHomework(hw);
  }

  const dayOfWeek = getDayOfWeek(date);
  const slotsForDay = useMemo(() => timetable.filter(e => e.dayOfWeek === dayOfWeek), [timetable, dayOfWeek]);
  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return slotsForDay.filter(e => { const k = `${e.subject}|${e.teacherId}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [slotsForDay]);

  function getHomeworkForSubject(subject: string) {
    return homework.filter(h => h.subject.toLowerCase() === subject.toLowerCase());
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this homework?")) return;
    await teacherApi.del(`/homework/${id}`);
    toast({ title: "Deleted" });
    loadHomework();
  }

  async function handleEditSave() {
    if (!editDialog || !editForm.title || !editForm.dueDate) {
      toast({ title: "Title and due date are required", variant: "destructive" }); return;
    }
    setEditSaving(true);
    try {
      await teacherApi.put(`/homework/${editDialog.id}`, { title: editForm.title, description: editForm.description, dueDate: editForm.dueDate });
      toast({ title: "Homework updated!" });
      setEditDialog(null);
      loadHomework();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setEditSaving(false); }
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">Select Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
        </div>
        {dayOfWeek !== 0 && (
          <div className="text-sm font-medium text-slate-600 mt-4">{DAY_NAMES[dayOfWeek]} — {uniqueSubjects.length} subject{uniqueSubjects.length !== 1 ? "s" : ""} on this day</div>
        )}
      </div>

      {dayOfWeek === 0 ? (
        <div className="text-sm text-slate-400 italic">Sunday — no classes scheduled</div>
      ) : loadingTT ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
      ) : uniqueSubjects.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No periods scheduled on {DAY_NAMES[dayOfWeek]}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {uniqueSubjects.map(entry => {
            const hw = getHomeworkForSubject(entry.subject);
            const isMySubject = entry.teacherId === teacher.id;
            return (
              <Card key={`${entry.subject}-${entry.teacherId}`} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMySubject ? "bg-amber-100" : "bg-slate-100"}`}>
                        <BookOpen className={`w-4 h-4 ${isMySubject ? "text-amber-600" : "text-slate-500"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{entry.subject}</span>
                          {isMySubject && <Badge className="bg-amber-100 text-amber-700 text-xs">Your subject</Badge>}
                        </div>
                        <div className="text-xs text-slate-400">{entry.teacherName || "Unassigned teacher"}</div>
                      </div>
                    </div>
                    <Button size="sm" variant={hw.length > 0 ? "outline" : "default"}
                      className={hw.length > 0 ? "shrink-0" : "bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0"}
                      onClick={() => setDialog({ subject: entry.subject, teacherName: entry.teacherName })}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> {hw.length > 0 ? "Add More" : "Assign"}
                    </Button>
                  </div>
                  {hw.length > 0 ? (
                    <div className="space-y-2 border-t border-slate-100 pt-2">
                      {hw.map(h => (
                        <div key={h.id} className="bg-slate-50 rounded-lg px-3 py-2.5 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                <span className="font-semibold text-slate-800">{h.title}</span>
                              </div>
                              {h.titleHi && <div className="text-xs text-orange-700 font-medium ml-5 mt-0.5">{h.titleHi}</div>}
                              <div className="text-xs text-slate-400 mt-0.5 ml-5">Due {format(new Date(h.dueDate), "MMM d, yyyy")} · {h.teacherName}</div>
                              {h.description && <p className="text-sm text-slate-600 mt-1.5 ml-5 whitespace-pre-wrap leading-snug">{h.description}</p>}
                              {h.descriptionHi && <p className="text-xs text-orange-600 mt-1 ml-5 whitespace-pre-wrap leading-snug">{h.descriptionHi}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setEditDialog(h); setEditForm({ title: h.title, description: h.description || "", dueDate: h.dueDate }); }} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(h.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">No homework assigned for this subject yet</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={o => !o && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Homework</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} /></div>
            <div className="space-y-1.5"><Label>Due Date *</Label><Input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialog(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />} Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bilingual Assign Dialog */}
      <BilingualAssignDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        dialogTitle={`Assign Homework — ${dialog?.subject}`}
        subtitle={`Assigned teacher: ${dialog?.teacherName || "—"} · Class teacher override`}
        onSave={async (form) => {
          if (!dialog) return;
          await teacherApi.post("/homework", {
            classId: teacher.classAssigned,
            subject: dialog.subject,
            title: form.title,
            description: form.description,
            titleHi: form.titleHi,
            descriptionHi: form.descriptionHi,
            dueDate: form.dueDate,
          });
          toast({ title: "Homework assigned!" });
          loadHomework();
        }}
        onGenerateAI={dialog ? async () => generateHomeworkAI({
          className: teacher.classAssignedName || String(teacher.classAssigned),
          subject: dialog.subject,
        }) : undefined}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherHomework() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"subjects" | "class">("subjects");

  useEffect(() => {
    teacherApi.get<Teacher>("/auth/teacher/me")
      .then(setTeacher)
      .catch(err => {
        if (isAuthError(err)) navigate("/teacher/login");
        else toast({ title: "Failed to load profile", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <TeacherLayout>
      <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
    </TeacherLayout>
  );

  if (!teacher) return null;

  return (
    <TeacherLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Homework</h1>
          <p className="text-sm text-slate-500 mt-1">Homework Management</p>
          <p className="text-xs text-slate-400 mt-0.5">Assign and manage homework from your timetable</p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("subjects")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${tab === "subjects" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <BookOpen className="w-4 h-4" /> Homework for My Subjects
          </button>
          <button
            onClick={() => setTab("class")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${tab === "class" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <Users className="w-4 h-4" /> Homework for My Class
          </button>
        </div>

        {tab === "subjects" ? <MySubjectsTab teacher={teacher} /> : <MyClassTab teacher={teacher} />}
      </div>
    </TeacherLayout>
  );
}
