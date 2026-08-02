import { useState, useEffect, useCallback } from "react";
import { getAdminToken } from "@/lib/auth";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolClass { id: number; name: string; }
interface Section { id: number; name: string; classId: number | null; }
interface TimetableEntry {
  id: number; classId: number; sectionId: number | null;
  dayOfWeek: number; periodId: number | null;
  subject: string; teacherId: number; teacherName: string | null;
}
interface HomeworkEntry {
  id: number; classId: number; sectionId: number | null;
  subject: string; title: string; description: string;
  dueDate: string; teacherId: number; teacherName: string | null;
  createdAt: string;
}

// Day of week helpers (JS: 0=Sun,1=Mon...6=Sat → timetable: 1=Mon...6=Sat)
function toTimetableDay(jsDay: number): number {
  // 0(Sun)→7, 1(Mon)→1, ..., 6(Sat)→6
  return jsDay === 0 ? 7 : jsDay;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Subject color palette ────────────────────────────────────────────────────
const SUBJ_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
];
function subjectColor(subject: string) {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = subject.charCodeAt(i) + ((h << 5) - h);
  return SUBJ_COLORS[Math.abs(h) % SUBJ_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeworkStatusTab() {
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [homework, setHomework] = useState<HomeworkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Fetch everything ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const [cl, sec, tt, hw] = await Promise.all([
        fetch("/api/classes").then(r => r.json()).catch(() => []),
        fetch("/api/sections").then(r => r.json()).catch(() => []),
        fetch("/api/timetable").then(r => r.json()).catch(() => []),
        fetch(`/api/homework?date=${date}`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      ]);
      setClasses(Array.isArray(cl) ? cl : []);
      setSections(Array.isArray(sec) ? sec : []);
      setTimetable(Array.isArray(tt) ? tt : []);
      setHomework(Array.isArray(hw) ? hw : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(selectedDate); }, [selectedDate, refreshKey, fetchAll]);

  // ── Date navigation ─────────────────────────────────────────────────────────
  function changeDate(delta: number) {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDate(d));
  }

  const dateObj = parseLocalDate(selectedDate);
  const dayOfWeek = toTimetableDay(dateObj.getDay()); // 1=Mon…6=Sat,7=Sun
  const dayLabel = DAY_NAMES[dateObj.getDay()];
  const isToday = selectedDate === formatDate(new Date());
  const isSunday = dateObj.getDay() === 0;

  // ── Derive class-section cards ──────────────────────────────────────────────
  // Collect unique class+section combinations from timetable (for selected day)
  const ttForDay = timetable.filter(e => e.dayOfWeek === dayOfWeek);

  // Build set of class+section keys that appear in timetable today
  const cardKeys = new Map<string, { classId: number; sectionId: number | null }>();
  ttForDay.forEach(e => {
    const key = `${e.classId}-${e.sectionId ?? "null"}`;
    if (!cardKeys.has(key)) cardKeys.set(key, { classId: e.classId, sectionId: e.sectionId });
  });

  // Also include combinations that only have homework (teacher gave hw even if no timetable)
  homework.forEach(h => {
    const key = `${h.classId}-${h.sectionId ?? "null"}`;
    if (!cardKeys.has(key)) cardKeys.set(key, { classId: h.classId, sectionId: h.sectionId ?? null });
  });

  const cards = Array.from(cardKeys.values()).sort((a, b) => {
    if (a.classId !== b.classId) return a.classId - b.classId;
    return (a.sectionId ?? 0) - (b.sectionId ?? 0);
  });

  // ── Teacher summary across all classes for selected day ─────────────────────
  interface TeacherSummary { name: string; total: number; given: number; }
  const teacherMap = new Map<number, TeacherSummary>();

  // For each subject slot in timetable today, check if hw was given
  ttForDay.forEach(entry => {
    if (!entry.teacherId || !entry.teacherName) return;
    const hw = homework.find(h =>
      h.classId === entry.classId &&
      (entry.sectionId == null || h.sectionId == null || h.sectionId === entry.sectionId) &&
      h.subject.toLowerCase() === entry.subject.toLowerCase()
    );
    if (!teacherMap.has(entry.teacherId)) {
      teacherMap.set(entry.teacherId, { name: entry.teacherName, total: 0, given: 0 });
    }
    const t = teacherMap.get(entry.teacherId)!;
    t.total += 1;
    if (hw) t.given += 1;
  });

  const teacherSummaries = Array.from(teacherMap.entries())
    .map(([id, s]) => ({ id, ...s, pending: s.total - s.given }))
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));

  const totalSubjects = teacherSummaries.reduce((s, t) => s + t.total, 0);
  const totalGiven = teacherSummaries.reduce((s, t) => s + t.given, 0);
  const totalPending = totalSubjects - totalGiven;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-violet-600" />
            Homework Status
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Monitor homework given by teachers across all classes</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto text-xs h-8"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* ── Date Picker ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-violet-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Date</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="h-9 px-3 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => changeDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isSunday ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"}`}>
              {dayLabel}
            </span>
            {isToday && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Today</span>
            )}
          </div>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs text-violet-600 h-8" onClick={() => setSelectedDate(formatDate(new Date()))}>
              Go to Today
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary Chips ── */}
      {!isSunday && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalSubjects}</div>
              <div className="text-xs text-slate-500">Total Subjects</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totalGiven}</div>
              <div className="text-xs text-slate-500">HW Given</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{totalPending}</div>
              <div className="text-xs text-slate-500">Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sunday message ── */}
      {isSunday && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
          <Clock className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Sunday — No Classes</p>
          <p className="text-sm text-slate-400 mt-1">Select a weekday (Mon–Sat) to view homework status.</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !isSunday && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        </div>
      )}

      {/* ── No timetable / No data ── */}
      {!loading && !isSunday && cards.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl p-12 text-center shadow-sm">
          <BookOpen className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">No timetable or homework found for {dayLabel}</p>
          <p className="text-sm text-slate-400 mt-1">Set up the timetable in the Timetable tab first so subjects appear here automatically.</p>
        </div>
      )}

      {/* ── Class Cards ── */}
      {!loading && !isSunday && cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {cards.map(({ classId, sectionId }) => {
            const cls = classes.find(c => c.id === classId);
            const sec = sectionId ? sections.find(s => s.id === sectionId) : null;

            // Subjects from timetable for this day + class/section
            const classEntries = ttForDay.filter(e =>
              e.classId === classId &&
              (sectionId == null || e.sectionId == null || e.sectionId === sectionId)
            );

            // Deduplicate by subject (same subject might appear in multiple periods)
            const subjectMap = new Map<string, { subject: string; teacherName: string | null; teacherId: number }>();
            classEntries.forEach(e => {
              const key = e.subject.toLowerCase();
              if (!subjectMap.has(key)) subjectMap.set(key, { subject: e.subject, teacherName: e.teacherName, teacherId: e.teacherId });
            });
            const subjectSlots = Array.from(subjectMap.values());

            // Class teacher = teacher with most periods in this class today
            const teacherCount = new Map<number, { name: string; count: number }>();
            classEntries.forEach(e => {
              if (!e.teacherId) return;
              const entry = teacherCount.get(e.teacherId) || { name: e.teacherName || "Unknown", count: 0 };
              entry.count++;
              teacherCount.set(e.teacherId, entry);
            });
            const classTeacher = Array.from(teacherCount.values()).sort((a, b) => b.count - a.count)[0]?.name || "—";

            // Homework for this class on selected date
            const classHw = homework.filter(h =>
              h.classId === classId &&
              (sectionId == null || h.sectionId == null || h.sectionId === sectionId)
            );

            const givenCount = subjectSlots.filter(slot =>
              classHw.some(h => h.subject.toLowerCase() === slot.subject.toLowerCase())
            ).length;
            const pendingCount = subjectSlots.length - givenCount;

            return (
              <div key={`${classId}-${sectionId}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-slate-50 dark:from-violet-900/10 dark:to-slate-950/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        Class {cls?.name ?? classId}
                        {sec && <span className="text-violet-600 dark:text-violet-400"> · {sec.name}</span>}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Class Teacher: <span className="font-medium text-slate-700 dark:text-slate-300">{classTeacher}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {givenCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">
                        ✓ {givenCount} given
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-medium">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Column header */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject · Teacher</div>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Homework</div>
                </div>

                {/* Subject rows */}
                {subjectSlots.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">No periods defined for {dayLabel}</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {subjectSlots.map(slot => {
                      const hw = classHw.find(h => h.subject.toLowerCase() === slot.subject.toLowerCase());
                      const col = subjectColor(slot.subject);
                      return (
                        <div key={slot.subject} className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                          {/* Subject col */}
                          <div className="px-4 py-3 flex items-start gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 ${col}`}>
                              {slot.subject}
                            </span>
                            {slot.teacherName && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">({slot.teacherName})</span>
                            )}
                          </div>
                          {/* Homework col */}
                          <div className="px-4 py-3 flex items-start">
                            {hw ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 leading-snug">{hw.title}</span>
                                </div>
                                {hw.description && (
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 ml-5 line-clamp-2 leading-snug">{hw.description}</p>
                                )}
                                <p className="text-[10px] text-slate-400 ml-5">Due: {hw.dueDate}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wide animate-pulse">
                                <AlertCircle className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Extra homework given (not in timetable) */}
                {classHw.filter(h => !subjectSlots.some(s => s.subject.toLowerCase() === h.subject.toLowerCase())).map(h => (
                  <div key={h.id} className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/50 bg-green-50/40 dark:bg-green-900/5">
                    <div className="px-4 py-3 flex items-start gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 ${subjectColor(h.subject)}`}>
                        {h.subject}
                      </span>
                      {h.teacherName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">({h.teacherName})</span>
                      )}
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400">{h.title}</span>
                      </div>
                      {h.description && <p className="text-[11px] text-slate-500 ml-5 line-clamp-1">{h.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Teacher Summary ── */}
      {!loading && !isSunday && teacherSummaries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" /> Teacher Homework Summary
            </h3>
            <span className="text-xs text-slate-500">{dayLabel}, {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-slate-800 dark:bg-slate-950 text-white text-xs">
                  <th className="px-4 py-2.5 text-left font-semibold">Teacher</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Total Subjects</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-green-400">HW Given</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-red-400">Pending</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teacherSummaries.map((t, i) => {
                  const pct = t.total > 0 ? Math.round((t.given / t.total) * 100) : 0;
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-950/30"}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{t.name}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{t.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t.given}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.pending > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" /> {t.pending}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-9 text-right ${pct === 100 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold text-sm border-t-2 border-slate-300 dark:border-slate-600">
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">Total</td>
                  <td className="px-4 py-2.5 text-center text-slate-700 dark:text-slate-300">{totalSubjects}</td>
                  <td className="px-4 py-2.5 text-center text-green-700 dark:text-green-400">{totalGiven}</td>
                  <td className="px-4 py-2.5 text-center text-red-600 dark:text-red-400">{totalPending}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-400">
                    {totalSubjects > 0 ? `${Math.round((totalGiven / totalSubjects) * 100)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
