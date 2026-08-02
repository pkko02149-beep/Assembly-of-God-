import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Calendar, Loader2, Clock, Coffee, Printer, BookOpen, Users, LayoutGrid, RefreshCw } from "lucide-react";

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
interface Teacher {
  id: number; name: string; classAssigned: number | null;
  className?: string; subject: string; employeeId: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE: Record<string, string> = {
  english: "bg-blue-100 text-blue-800 border-blue-200",
  math: "bg-green-100 text-green-800 border-green-200",
  mathematics: "bg-green-100 text-green-800 border-green-200",
  science: "bg-yellow-100 text-yellow-800 border-yellow-200",
  computer: "bg-orange-100 text-orange-800 border-orange-200",
  hindi: "bg-red-100 text-red-800 border-red-200",
  sst: "bg-purple-100 text-purple-800 border-purple-200",
  "social science": "bg-purple-100 text-purple-800 border-purple-200",
  physics: "bg-cyan-100 text-cyan-800 border-cyan-200",
  chemistry: "bg-pink-100 text-pink-800 border-pink-200",
  biology: "bg-lime-100 text-lime-800 border-lime-200",
  geography: "bg-teal-100 text-teal-800 border-teal-200",
  history: "bg-amber-100 text-amber-800 border-amber-200",
  sanskrit: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

const ALL_BG = [
  "bg-blue-100 text-blue-800","bg-green-100 text-green-800","bg-yellow-100 text-yellow-800",
  "bg-orange-100 text-orange-800","bg-red-100 text-red-800","bg-purple-100 text-purple-800",
  "bg-cyan-100 text-cyan-800","bg-pink-100 text-pink-800","bg-lime-100 text-lime-800",
  "bg-teal-100 text-teal-800","bg-amber-100 text-amber-800","bg-indigo-100 text-indigo-800",
];

function subjectColor(subject: string): string {
  const key = subject.toLowerCase().trim();
  for (const [k, v] of Object.entries(PALETTE)) {
    if (key.includes(k)) return v;
  }
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = subject.charCodeAt(i) + ((h << 5) - h);
  return ALL_BG[Math.abs(h) % ALL_BG.length];
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

export default function TeacherTimetable() {
  const [, navigate] = useLocation();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [myEntries, setMyEntries] = useState<TimetableEntry[]>([]);
  const [classEntries, setClassEntries] = useState<TimetableEntry[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"my-schedule" | "class-timetable">("my-schedule");

  useEffect(() => {
    if (!localStorage.getItem("teacher_token")) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const t = await teacherApi.get<Teacher>("/auth/teacher/me");
      setTeacher(t);

      const [tt, pe] = await Promise.all([
        fetch(`/api/timetable?teacherId=${t.id}`).then(r => r.json()).catch(() => []),
        fetch("/api/periods").then(r => r.json()).catch(() => []),
      ]);
      setMyEntries(Array.isArray(tt) ? tt : []);
      setPeriods(Array.isArray(pe) ? pe : []);

      if (t.classAssigned) {
        const ct = await fetch(`/api/timetable?classId=${t.classAssigned}`).then(r => r.json()).catch(() => []);
        setClassEntries(Array.isArray(ct) ? ct : []);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
    } finally {
      setLoading(false);
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const sortedPeriods = [...periods].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const activePeriods = sortedPeriods.filter(p => !p.isBreak);
  const subjectsTaught = [...new Set(myEntries.map(e => e.subject))];
  const classesTaught = [...new Set(myEntries.map(e => e.className).filter(Boolean))];

  function getEntry(entries: TimetableEntry[], day: number, periodId: number) {
    return entries.find(e => e.dayOfWeek === day && e.periodId === periodId) ?? null;
  }

  // ─── Print ────────────────────────────────────────────────────────────────

  function handlePrint() {
    const title = view === "my-schedule"
      ? `My Timetable — ${teacher?.name || ""}`
      : `Class Timetable — ${teacher?.className || ""}`;
    const displayEntries = view === "my-schedule" ? myEntries : classEntries;

    const headerRow = `<tr style="background:#1e293b;color:white">
      <th style="padding:8px 10px;text-align:left;border:1px solid #334155;min-width:80px">Day</th>
      ${sortedPeriods.map(p => `<th style="padding:8px 10px;text-align:center;border:1px solid #334155;min-width:90px">${p.name}${p.startTime ? `<br/><span style="font-size:10px;font-weight:400">${p.startTime}${p.endTime ? `–${p.endTime}` : ""}</span>` : ""}</th>`).join("")}
    </tr>`;

    const bodyRows = DAYS.map(day => {
      const cells = sortedPeriods.map(period => {
        if (period.isBreak) return `<td style="background:#fefce8;text-align:center;border:1px solid #e2e8f0;color:#b45309;font-size:11px;padding:6px">☕ Break</td>`;
        const entry = getEntry(displayEntries, day.num, period.id);
        if (!entry) return `<td style="border:1px solid #e2e8f0;padding:6px"></td>`;
        return `<td style="border:1px solid #e2e8f0;padding:6px;text-align:center">
          <div style="font-weight:600;font-size:12px">${entry.subject}</div>
          <div style="font-size:10px;color:#64748b">${view === "my-schedule" ? `${entry.className || ""}${entry.sectionName ? ` ${entry.sectionName}` : ""}` : (entry.teacherName || "")}</div>
        </td>`;
      }).join("");
      return `<tr><td style="font-weight:600;padding:8px;border:1px solid #e2e8f0;background:#f8fafc">${day.label}</td>${cells}</tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h2{margin-bottom:4px}p{margin:0 0 16px;color:#64748b;font-size:13px}table{border-collapse:collapse;width:100%}@media print{body{padding:16px}}</style>
</head><body>
<h2>${title}</h2>
<p>Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
<table>${headerRow}${bodyRows}</table>
</body></html>`;
    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  // ─── Render loading ───────────────────────────────────────────────────────

  if (loading) return (
    <TeacherLayout title="Timetable">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    </TeacherLayout>
  );

  const displayEntries = view === "my-schedule" ? myEntries : classEntries;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TeacherLayout title="Timetable">

      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" /> Timetable
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{teacher?.name} · {teacher?.subject || "All Subjects"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {periods.length > 0 && displayEntries.length > 0 && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { icon: LayoutGrid, label: "Periods / Week", value: myEntries.length, color: "text-blue-600 bg-blue-50" },
          { icon: BookOpen, label: "Subjects", value: subjectsTaught.length, color: "text-green-600 bg-green-50" },
          { icon: Users, label: "Classes", value: classesTaught.length, color: "text-purple-600 bg-purple-50" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View Toggle (only if class teacher) */}
      {teacher?.classAssigned && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView("my-schedule")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${view === "my-schedule" ? "bg-amber-500 border-amber-500 text-white shadow" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            My Teaching Schedule
          </button>
          <button
            onClick={() => setView("class-timetable")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${view === "class-timetable" ? "bg-amber-500 border-amber-500 text-white shadow" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {teacher.className ? `Class ${teacher.className} Full Timetable` : "Class Timetable"}
          </button>
        </div>
      )}

      {/* No periods defined */}
      {periods.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center mb-4">
          <Clock className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <p className="font-semibold text-amber-800">Period timings not configured yet</p>
          <p className="text-sm text-amber-600 mt-1">Ask the admin to set up period times.</p>
        </div>
      )}

      {/* No entries */}
      {periods.length > 0 && displayEntries.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-10 text-center shadow-sm">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">
            {view === "my-schedule" ? "No classes assigned to you yet" : "No class timetable set up yet"}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {view === "my-schedule" ? "Ask admin to assign you periods in the Timetable module." : "Ask admin to set up the class timetable."}
          </p>
        </div>
      )}

      {/* Timetable Grid */}
      {periods.length > 0 && displayEntries.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {view === "my-schedule" ? "My Weekly Schedule" : `Class ${teacher?.className} — Full Timetable`}
            </span>
            <span className="text-xs text-slate-400">{displayEntries.length} periods</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: `${(sortedPeriods.length + 1) * 88}px` }}>
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-2 py-2 text-left font-semibold border border-slate-700 w-16 sticky left-0 bg-slate-800 z-10">Day</th>
                  {sortedPeriods.map(p => (
                    <th key={p.id} className={`px-1.5 py-2 text-center font-semibold border border-slate-700 min-w-[80px] ${p.isBreak ? "bg-amber-900/50" : ""}`}>
                      <div>{p.name}</div>
                      {(p.startTime || p.endTime) && (
                        <div className="text-[9px] font-normal text-slate-400 mt-0.5">
                          {p.startTime}{p.endTime ? `–${p.endTime}` : ""}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, di) => {
                  const hasSomething = sortedPeriods.some(p => !p.isBreak && getEntry(displayEntries, day.num, p.id));
                  return (
                    <tr key={day.num} className={`${di % 2 === 0 ? "bg-white" : "bg-slate-50/50"} ${!hasSomething && view === "my-schedule" ? "opacity-40" : ""}`}>
                      <td className="px-2 py-1.5 font-semibold text-slate-700 border border-slate-200 sticky left-0 bg-inherit z-10">
                        <div className="hidden sm:block">{day.label}</div>
                        <div className="sm:hidden">{day.short}</div>
                      </td>
                      {sortedPeriods.map(period => {
                        if (period.isBreak) {
                          return (
                            <td key={period.id} className="border border-slate-200 px-1 py-1.5 text-center bg-amber-50/60">
                              <div className="flex items-center justify-center gap-0.5 text-amber-500">
                                <Coffee className="w-3 h-3" />
                              </div>
                            </td>
                          );
                        }
                        const entry = getEntry(displayEntries, day.num, period.id);
                        if (!entry) {
                          return (
                            <td key={period.id} className="border border-slate-200 px-1 py-1.5">
                              <div className="h-8" />
                            </td>
                          );
                        }
                        const colors = subjectColor(entry.subject);
                        return (
                          <td key={period.id} className="border border-slate-200 px-1 py-1">
                            <div className={`rounded-md px-1.5 py-1.5 border ${colors}`}>
                              <div className="font-semibold text-[11px] leading-tight">{entry.subject}</div>
                              {view === "my-schedule" ? (
                                <div className="text-[9px] opacity-70 mt-0.5 truncate">
                                  {entry.className}{entry.sectionName ? ` ${entry.sectionName}` : ""}
                                </div>
                              ) : (
                                <div className="text-[9px] opacity-70 mt-0.5 truncate">{entry.teacherName || ""}</div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Subject legend */}
          {subjectsTaught.length > 0 && view === "my-schedule" && (
            <div className="px-3 py-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-400 self-center">Subjects:</span>
              {subjectsTaught.map(s => (
                <span key={s} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${subjectColor(s)}`}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day-by-day list view (always shown as secondary reference) */}
      {myEntries.length > 0 && view === "my-schedule" && (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Day-by-Day Details</h3>
          {DAYS.map(day => {
            const dayEntries = myEntries
              .filter(e => e.dayOfWeek === day.num)
              .sort((a, b) => {
                const pa = sortedPeriods.find(p => p.id === a.periodId)?.sortOrder ?? a.period;
                const pb = sortedPeriods.find(p => p.id === b.periodId)?.sortOrder ?? b.period;
                return pa - pb;
              });
            if (dayEntries.length === 0) return null;
            return (
              <div key={day.num} className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="font-semibold text-slate-700 text-sm">{day.label}</span>
                  <span className="text-xs text-slate-400 ml-2">· {dayEntries.length} period{dayEntries.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {dayEntries.map(e => {
                    const periodInfo = sortedPeriods.find(p => p.id === e.periodId);
                    return (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border ${subjectColor(e.subject)}`}>
                          {periodInfo?.name?.replace(/\D/g, "") || e.period}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{e.subject}</p>
                          <p className="text-xs text-slate-400">
                            {e.className}{e.sectionName ? ` – ${e.sectionName}` : ""}
                            {periodInfo?.name ? ` · ${periodInfo.name}` : ""}
                          </p>
                        </div>
                        {(e.startTime || e.endTime) && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                            <Clock className="w-3 h-3" />
                            {e.startTime}{e.endTime ? `–${e.endTime}` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </TeacherLayout>
  );
}
