import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import {
  Calendar, Plus, Trash2, Edit2, RefreshCw, Printer, Zap, Clock,
  Coffee, ChevronDown, ChevronUp, X, Check, BookOpen, Users, GraduationCap, LayoutGrid
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Period {
  id: number; name: string; startTime: string; endTime: string;
  isBreak: boolean; sortOrder: number;
}
interface TimetableEntry {
  id: number; classId: number; className?: string | null;
  sectionId?: number | null; sectionName?: string | null;
  dayOfWeek: number; period: number; periodId?: number | null;
  periodName?: string | null; subject: string;
  teacherId: number; teacherName?: string | null;
  startTime: string; endTime: string;
}
interface Teacher { id: number; name: string; employeeId?: string; }
interface SchoolClass { id: number; name: string; }
interface Section { id: number; name: string; classId?: number | null; }
interface Subject { id: number; name: string; code?: string; classId: number; }

// ─── Subject Color Mapping ────────────────────────────────────────────────────

const PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-800 dark:text-blue-200", dot: "bg-blue-500" },
  { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-800 dark:text-green-200", dot: "bg-green-500" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-800 dark:text-yellow-200", dot: "bg-yellow-500" },
  { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-800 dark:text-orange-200", dot: "bg-orange-500" },
  { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-800 dark:text-red-200", dot: "bg-red-500" },
  { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-800 dark:text-purple-200", dot: "bg-purple-500" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-800 dark:text-cyan-200", dot: "bg-cyan-500" },
  { bg: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-800 dark:text-pink-200", dot: "bg-pink-500" },
  { bg: "bg-lime-100 dark:bg-lime-900/40", text: "text-lime-800 dark:text-lime-200", dot: "bg-lime-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-800 dark:text-teal-200", dot: "bg-teal-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-200", dot: "bg-amber-500" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-800 dark:text-indigo-200", dot: "bg-indigo-500" },
];

const SUBJECT_COLOR_OVERRIDES: Record<string, number> = {
  english: 0, math: 1, mathematics: 1, science: 2, computer: 3, hindi: 4,
  sst: 5, "social science": 5, physics: 6, chemistry: 7, biology: 8,
  geography: 9, history: 10, sanskrit: 11,
};

function getSubjectColor(subject: string) {
  const key = subject.toLowerCase().trim();
  for (const [pattern, idx] of Object.entries(SUBJECT_COLOR_OVERRIDES)) {
    if (key.includes(pattern)) return PALETTE[idx];
  }
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

const DAYS = [
  { num: 1, label: "Monday", short: "Mon" },
  { num: 2, label: "Tuesday", short: "Tue" },
  { num: 3, label: "Wednesday", short: "Wed" },
  { num: 4, label: "Thursday", short: "Thu" },
  { num: 5, label: "Friday", short: "Fri" },
  { num: 6, label: "Saturday", short: "Sat" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimetableManagementTab() {
  const { toast } = useToast();

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [showPeriodsPanel, setShowPeriodsPanel] = useState(true);
  const [periodForm, setPeriodForm] = useState({ name: "", startTime: "", endTime: "", isBreak: false, sortOrder: 0 });
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [entryModal, setEntryModal] = useState<{ open: boolean; day: number; periodId: number | null; entry: TimetableEntry | null }>({ open: false, day: 1, periodId: null, entry: null });
  const [entryForm, setEntryForm] = useState({ subject: "", teacherId: "", subjectFromList: "" });
  const [savingEntry, setSavingEntry] = useState(false);

  const [autoModal, setAutoModal] = useState(false);
  const [autoReplace, setAutoReplace] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [loading, setLoading] = useState(true);

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cl, te, pe] = await Promise.all([
        fetch("/api/classes").then(r => r.json()),
        fetch("/api/teachers").then(r => r.json()),
        fetch("/api/periods").then(r => r.json()),
      ]);
      setClasses(Array.isArray(cl) ? cl : []);
      setTeachers(Array.isArray(te) ? te : []);
      setPeriods(Array.isArray(pe) ? pe : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const fetchSections = useCallback(async (classId: string) => {
    if (!classId) { setSections([]); return; }
    const data = await fetch(`/api/sections`).then(r => r.json()).catch(() => []);
    setSections(Array.isArray(data) ? data : []);
  }, []);

  const fetchSubjects = useCallback(async (classId: string) => {
    if (!classId) { setSubjects([]); return; }
    const data = await fetch(`/api/subjects?classId=${classId}`).then(r => r.json()).catch(() => []);
    setSubjects(Array.isArray(data) ? data : []);
  }, []);

  const fetchTimetable = useCallback(async (classId: string, sectionId: string) => {
    if (!classId) { setEntries([]); return; }
    let url = `/api/timetable?classId=${classId}`;
    if (sectionId) url += `&sectionId=${sectionId}`;
    const data = await fetch(url).then(r => r.json()).catch(() => []);
    setEntries(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    fetchSections(selectedClassId);
    fetchSubjects(selectedClassId);
    fetchTimetable(selectedClassId, selectedSectionId);
  }, [selectedClassId, selectedSectionId, fetchSections, fetchSubjects, fetchTimetable]);

  // ─── Stats ────────────────────────────────────────────────────────────────

  // API already filters by classId — use results directly
  const filteredSections = sections;

  // ─── Period CRUD ──────────────────────────────────────────────────────────

  async function handleSavePeriod() {
    if (!periodForm.name.trim()) { toast({ title: "Period name is required", variant: "destructive" }); return; }
    setSavingPeriod(true);
    try {
      const url = editingPeriod ? `/api/periods/${editingPeriod.id}` : "/api/periods";
      const method = editingPeriod ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(periodForm),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await fetch("/api/periods").then(r => r.json());
      setPeriods(Array.isArray(updated) ? updated : []);
      setPeriodForm({ name: "", startTime: "", endTime: "", isBreak: false, sortOrder: 0 });
      setEditingPeriod(null);
      toast({ title: editingPeriod ? "Period updated" : "Period added" });
    } catch { toast({ title: "Failed to save period", variant: "destructive" }); }
    finally { setSavingPeriod(false); }
  }

  async function handleDeletePeriod(id: number) {
    await fetch(`/api/periods/${id}`, { method: "DELETE", headers: authHeaders() });
    setPeriods(prev => prev.filter(p => p.id !== id));
    toast({ title: "Period deleted" });
  }

  function startEditPeriod(p: Period) {
    setEditingPeriod(p);
    setPeriodForm({ name: p.name, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak, sortOrder: p.sortOrder });
  }

  // ─── Entry CRUD ───────────────────────────────────────────────────────────

  function openAddEntry(day: number, periodId: number) {
    const period = periods.find(p => p.id === periodId);
    if (period?.isBreak) return;
    setEntryForm({ subject: "", teacherId: "", subjectFromList: "" });
    setEntryModal({ open: true, day, periodId, entry: null });
  }

  function openEditEntry(entry: TimetableEntry) {
    setEntryForm({ subject: entry.subject, teacherId: String(entry.teacherId), subjectFromList: entry.subject });
    setEntryModal({ open: true, day: entry.dayOfWeek, periodId: entry.periodId ?? null, entry });
  }

  async function handleSaveEntry() {
    const { day, periodId, entry } = entryModal;
    const subject = entryForm.subject.trim() || entryForm.subjectFromList;
    const teacherId = parseInt(entryForm.teacherId);
    if (!subject || !teacherId || !selectedClassId) {
      toast({ title: "Subject and teacher are required", variant: "destructive" });
      return;
    }
    const period = periods.find(p => p.id === periodId);
    setSavingEntry(true);
    try {
      if (entry) {
        const res = await fetch(`/api/timetable/${entry.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ subject, teacherId, periodId, dayOfWeek: day, period: period?.sortOrder || periodId }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      } else {
        const res = await fetch("/api/timetable", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            classId: parseInt(selectedClassId),
            sectionId: selectedSectionId ? parseInt(selectedSectionId) : undefined,
            dayOfWeek: day, period: period?.sortOrder || periodId, periodId,
            subject, teacherId,
            startTime: period?.startTime || "",
            endTime: period?.endTime || "",
          }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      }
      await fetchTimetable(selectedClassId, selectedSectionId);
      setEntryModal(m => ({ ...m, open: false }));
      toast({ title: entry ? "Entry updated" : "Entry added" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to save entry", variant: "destructive" });
    } finally { setSavingEntry(false); }
  }

  async function handleDeleteEntry(id: number) {
    await fetch(`/api/timetable/${id}`, { method: "DELETE", headers: authHeaders() });
    setEntries(prev => prev.filter(e => e.id !== id));
    toast({ title: "Entry deleted" });
  }

  // ─── Auto-generate ────────────────────────────────────────────────────────

  async function handleAutoGenerate() {
    if (!selectedClassId) { toast({ title: "Select a class first", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/timetable/auto-generate", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          classId: parseInt(selectedClassId),
          sectionId: selectedSectionId ? parseInt(selectedSectionId) : undefined,
          replaceExisting: autoReplace,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await fetchTimetable(selectedClassId, selectedSectionId);
      setAutoModal(false);
      toast({ title: `Timetable generated — ${data.inserted} entries created` });
    } catch (e: any) {
      toast({ title: e.message || "Failed to generate timetable", variant: "destructive" });
    } finally { setGenerating(false); }
  }

  // ─── Print ────────────────────────────────────────────────────────────────

  function handlePrint() {
    if (!selectedClassId) { toast({ title: "Select a class first", variant: "destructive" }); return; }
    const cls = classes.find(c => c.id === parseInt(selectedClassId));
    const sec = sections.find(s => s.id === parseInt(selectedSectionId));
    const title = `Timetable — ${cls?.name || "Class"}${sec ? ` ${sec.name}` : ""}`;

    const activePeriods = periods.filter(p => !p.isBreak).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const allPeriods = periods.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

    const headerRow = `<tr style="background:#1e293b;color:white">
      <th style="padding:8px 10px;text-align:left;border:1px solid #334155;min-width:80px">Day</th>
      ${allPeriods.map(p => `<th style="padding:8px 10px;text-align:center;border:1px solid #334155;min-width:90px">${p.name}${p.startTime ? `<br/><span style="font-size:10px;font-weight:400">${p.startTime}${p.endTime ? `–${p.endTime}` : ""}</span>` : ""}</th>`).join("")}
    </tr>`;

    const bodyRows = DAYS.map(day => {
      const cells = allPeriods.map(period => {
        if (period.isBreak) return `<td style="background:#f8fafc;text-align:center;border:1px solid #e2e8f0;color:#94a3b8;font-size:12px;padding:6px">Break</td>`;
        const entry = entries.find(e => e.dayOfWeek === day.num && e.periodId === period.id);
        if (!entry) return `<td style="border:1px solid #e2e8f0;padding:6px"></td>`;
        return `<td style="border:1px solid #e2e8f0;padding:6px;text-align:center">
          <div style="font-weight:600;font-size:12px">${entry.subject}</div>
          <div style="font-size:11px;color:#64748b">${entry.teacherName || ""}</div>
        </td>`;
      }).join("");
      return `<tr><td style="font-weight:600;padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc">${day.label}</td>${cells}</tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
  h2 { margin-bottom: 4px; } p { margin: 0 0 16px; color: #64748b; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h2>${title}</h2>
<p>Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
<table>${headerRow}${bodyRows}</table>
</body></html>`;
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  // ─── Grid helpers ─────────────────────────────────────────────────────────

  const sortedPeriods = [...periods].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  function getEntry(day: number, periodId: number) {
    return entries.find(e => e.dayOfWeek === day && e.periodId === periodId) ?? null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-teal-600" />
            Timetable Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Create, manage and auto-generate class timetables (Mon–Sat)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400"
            onClick={() => setAutoModal(true)}
            disabled={!selectedClassId}
          >
            <Zap className="h-4 w-4 mr-1.5" /> Auto Generate
          </Button>
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            onClick={handlePrint}
            disabled={!selectedClassId || entries.length === 0}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: GraduationCap, label: "Total Classes", value: classes.length, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
          { icon: Users, label: "Total Teachers", value: teachers.length, color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
          { icon: BookOpen, label: "Subjects (Class)", value: subjects.length, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
          { icon: LayoutGrid, label: "Timetable Entries", value: entries.length, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Class/Section Selector ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">View / Edit Timetable For</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedSectionId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={selectedSectionId || "__all__"} onValueChange={v => setSelectedSectionId(v === "__all__" ? "" : v)} disabled={!selectedClassId}>
              <SelectTrigger><SelectValue placeholder="All Sections (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sections</SelectItem>
                {filteredSections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Period Setup ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors"
          onClick={() => setShowPeriodsPanel(!showPeriodsPanel)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Period Setup</h3>
              <p className="text-xs text-slate-500">{periods.length} periods defined · {periods.filter(p => p.isBreak).length} breaks</p>
            </div>
          </div>
          {showPeriodsPanel ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </button>

        {showPeriodsPanel && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
            {periods.length > 0 && (
              <div className="space-y-2">
                {sortedPeriods.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${p.isBreak ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700"}`}>
                    {editingPeriod?.id === p.id ? (
                      <>
                        <Input className="h-8 text-sm flex-1" value={periodForm.name} onChange={e => setPeriodForm(f => ({ ...f, name: e.target.value }))} placeholder="Period name" />
                        <Input type="time" className="h-8 text-sm w-28" value={periodForm.startTime} onChange={e => setPeriodForm(f => ({ ...f, startTime: e.target.value }))} />
                        <span className="text-slate-400 text-xs">to</span>
                        <Input type="time" className="h-8 text-sm w-28" value={periodForm.endTime} onChange={e => setPeriodForm(f => ({ ...f, endTime: e.target.value }))} />
                        <Input type="number" className="h-8 text-sm w-16" value={periodForm.sortOrder} onChange={e => setPeriodForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} placeholder="Order" />
                        <label className="flex items-center gap-1 text-xs text-amber-600 cursor-pointer shrink-0">
                          <input type="checkbox" checked={periodForm.isBreak} onChange={e => setPeriodForm(f => ({ ...f, isBreak: e.target.checked }))} /> Break
                        </label>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" disabled={savingPeriod} onClick={handleSavePeriod}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400" onClick={() => setEditingPeriod(null)}><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        {p.isBreak ? <Coffee className="h-4 w-4 text-amber-500 shrink-0" /> : <Clock className="h-4 w-4 text-teal-500 shrink-0" />}
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-200 flex-1">{p.name}</span>
                        {(p.startTime || p.endTime) && <span className="text-xs text-slate-500">{p.startTime}{p.endTime ? `–${p.endTime}` : ""}</span>}
                        {p.isBreak && <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Break</span>}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 shrink-0" onClick={() => startEditPeriod(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" onClick={() => handleDeletePeriod(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new period form */}
            {!editingPeriod && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Add New Period</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input className="h-8 text-sm w-32" placeholder="Name (e.g. P1)" value={periodForm.name} onChange={e => setPeriodForm(f => ({ ...f, name: e.target.value }))} />
                  <div className="flex items-center gap-1">
                    <Input type="time" className="h-8 text-sm w-28" value={periodForm.startTime} onChange={e => setPeriodForm(f => ({ ...f, startTime: e.target.value }))} />
                    <span className="text-xs text-slate-400">to</span>
                    <Input type="time" className="h-8 text-sm w-28" value={periodForm.endTime} onChange={e => setPeriodForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                  <Input type="number" className="h-8 text-sm w-20" placeholder="Order" value={periodForm.sortOrder || ""} onChange={e => setPeriodForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
                  <label className="flex items-center gap-1.5 text-sm text-amber-600 cursor-pointer">
                    <input type="checkbox" checked={periodForm.isBreak} onChange={e => setPeriodForm(f => ({ ...f, isBreak: e.target.checked }))} />
                    Break
                  </label>
                  <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white" disabled={!periodForm.name.trim() || savingPeriod} onClick={handleSavePeriod}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Timetable Grid ── */}
      {!selectedClassId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-12 text-center">
          <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Select a class above to view or edit its timetable</p>
        </div>
      ) : periods.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm p-10 text-center">
          <Clock className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">No periods defined yet</p>
          <p className="text-sm text-slate-400 mt-1">Add periods above (e.g. P1 08:00–08:45, Lunch Break, P2…) before creating a timetable.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Timetable Grid — {classes.find(c => c.id === parseInt(selectedClassId))?.name}
              {selectedSectionId && ` · ${sections.find(s => s.id === parseInt(selectedSectionId))?.name}`}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => fetchTimetable(selectedClassId, selectedSectionId)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-slate-800 dark:bg-slate-950 text-white">
                  <th className="border border-slate-700 px-3 py-2.5 text-left w-24 font-semibold sticky left-0 bg-slate-800 dark:bg-slate-950 z-10">Day</th>
                  {sortedPeriods.map(p => (
                    <th key={p.id} className={`border border-slate-700 px-2 py-2.5 text-center font-semibold min-w-[100px] ${p.isBreak ? "bg-amber-900/60" : ""}`}>
                      <div>{p.name}</div>
                      {(p.startTime || p.endTime) && (
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          {p.startTime}{p.endTime ? `–${p.endTime}` : ""}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => (
                  <tr key={day.num} className={di % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-950/30"}>
                    <td className="border border-slate-200 dark:border-slate-700 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                      <div className="hidden sm:block">{day.label}</div>
                      <div className="sm:hidden">{day.short}</div>
                    </td>
                    {sortedPeriods.map(period => {
                      if (period.isBreak) {
                        return (
                          <td key={period.id} className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center bg-amber-50/60 dark:bg-amber-900/10">
                            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center justify-center gap-1">
                              <Coffee className="h-3 w-3" /> Break
                            </div>
                          </td>
                        );
                      }
                      const entry = getEntry(day.num, period.id);
                      const colors = entry ? getSubjectColor(entry.subject) : null;
                      return (
                        <td key={period.id} className="border border-slate-200 dark:border-slate-700 px-1 py-1 group">
                          {entry ? (
                            <div className={`rounded-md px-2 pt-1 pb-1.5 border border-transparent ${colors!.bg}`}>
                              <div className="flex items-center justify-between gap-0.5 mb-0.5">
                                <div className={`font-semibold text-xs leading-tight truncate flex-1 ${colors!.text}`}>{entry.subject}</div>
                                <div className="flex gap-0.5 shrink-0">
                                  <button
                                    className="h-4 w-4 rounded bg-white/80 dark:bg-slate-800/80 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 active:scale-90 transition-transform"
                                    title="Edit entry"
                                    onClick={() => openEditEntry(entry)}
                                  >
                                    <Edit2 className="h-2.5 w-2.5 text-blue-600" />
                                  </button>
                                  <button
                                    className="h-4 w-4 rounded bg-white/80 dark:bg-slate-800/80 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-90 transition-transform"
                                    title="Delete entry"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5 text-red-500" />
                                  </button>
                                </div>
                              </div>
                              {entry.teacherName && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{entry.teacherName}</div>
                              )}
                            </div>
                          ) : (
                            <button
                              className="w-full h-10 flex items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-colors text-xs"
                              onClick={() => openAddEntry(day.num, period.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          {subjects.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 font-medium mr-1 self-center">Colors:</span>
              {subjects.slice(0, 10).map(s => {
                const c = getSubjectColor(s.name);
                return (
                  <span key={s.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-transparent ${c.bg} ${c.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    {s.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Entry Modal ── */}
      <Dialog open={entryModal.open} onOpenChange={o => setEntryModal(m => ({ ...m, open: o }))}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle>{entryModal.entry ? "Edit Timetable Entry" : "Add Timetable Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Day: <span className="text-teal-600">{DAYS.find(d => d.num === entryModal.day)?.label}</span>
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Period: <span className="text-teal-600">{periods.find(p => p.id === entryModal.periodId)?.name}</span>
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
              {subjects.length > 0 ? (
                <Select value={entryForm.subjectFromList} onValueChange={v => setEntryForm(f => ({ ...f, subjectFromList: v, subject: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Enter subject name" value={entryForm.subject} onChange={e => setEntryForm(f => ({ ...f, subject: e.target.value, subjectFromList: "" }))} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teacher</label>
              <Select value={entryForm.teacherId} onValueChange={v => setEntryForm(f => ({ ...f, teacherId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryModal(m => ({ ...m, open: false }))}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={savingEntry || (!entryForm.subject && !entryForm.subjectFromList) || !entryForm.teacherId}
              onClick={handleSaveEntry}
            >
              {savingEntry ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</> : <><Check className="h-4 w-4 mr-1.5" /> Save Entry</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Auto-Generate Modal ── */}
      <Dialog open={autoModal} onOpenChange={setAutoModal}>
        <DialogContent className="sm:max-w-sm bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-teal-500" /> Auto-Generate Timetable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <p>This will automatically distribute all subjects across Mon–Sat using the defined periods, assigning teachers from subject assignments.</p>
            <p className="text-xs text-slate-400">Conflict detection is applied — no teacher will be double-booked in the same period.</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoReplace} onChange={e => setAutoReplace(e.target.checked)} className="rounded" />
              <span className="font-medium text-slate-700 dark:text-slate-300">Replace existing entries for this class</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoModal(false)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={generating}
              onClick={handleAutoGenerate}
            >
              {generating ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</> : <><Zap className="h-4 w-4 mr-1.5" /> Generate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
