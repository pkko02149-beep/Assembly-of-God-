import { useState } from "react";
import { useGetAbsenceStreaks, useListClasses, useListSections } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Flame, User, Download, RefreshCw } from "lucide-react";
import { formatWhatsappNumber } from "@/lib/auth";

const ABSENT_MSG = "Dear parent of {name}, we have noticed your child has been absent for {days} consecutive school days (since {from}). Please contact the school urgently.";

export default function AtRiskTab() {
  const [minDays, setMinDays] = useState("3");
  const [classId, setClassId] = useState("all");
  const [sectionId, setSectionId] = useState("all");

  const params: { minDays: number; classId?: number; sectionId?: number } = {
    minDays: parseInt(minDays) || 3,
  };
  if (classId !== "all") params.classId = parseInt(classId);
  if (sectionId !== "all") params.sectionId = parseInt(sectionId);

  const { data: rawStreaks, isLoading, error: streakError, refetch } = useGetAbsenceStreaks(params);
  const streaks = Array.isArray(rawStreaks) ? rawStreaks : [];
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  function getSeverity(days: number) {
    if (days >= 7) return { label: "Critical", color: "bg-red-600", textColor: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/10", border: "border-red-200 dark:border-red-800" };
    if (days >= 5) return { label: "High", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/10", border: "border-orange-200 dark:border-orange-800" };
    return { label: "Warning", color: "bg-amber-400", textColor: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10", border: "border-amber-200 dark:border-amber-800" };
  }

  function notifyOne(s: typeof streaks[0]) {
    const msg = ABSENT_MSG
      .replace(/{name}/g, s.studentName)
      .replace(/{days}/g, String(s.consecutiveDays))
      .replace(/{from}/g, s.firstAbsenceDate);
    const num = formatWhatsappNumber(s.whatsappNumber ?? "");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function notifyAll() {
    streaks.filter(s => s.whatsappNumber).forEach((s, i) => {
      setTimeout(() => {
        const msg = ABSENT_MSG
          .replace(/{name}/g, s.studentName)
          .replace(/{days}/g, String(s.consecutiveDays))
          .replace(/{from}/g, s.firstAbsenceDate);
        const num = formatWhatsappNumber(s.whatsappNumber ?? "");
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
      }, i * 600);
    });
  }

  function exportCSV() {
    if (streaks.length === 0) return;
    const headers = ["Student", "Father", "Class", "Section", "Consecutive Days", "First Absence", "Last Absence", "WhatsApp"];
    const rows = streaks.map(s => [s.studentName, s.fatherName ?? "", s.className, s.sectionName, s.consecutiveDays, s.firstAbsenceDate, s.lastAbsenceDate, s.whatsappNumber ?? ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `at_risk_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const critical = streaks.filter(s => s.consecutiveDays >= 7).length;
  const high = streaks.filter(s => s.consecutiveDays >= 5 && s.consecutiveDays < 7).length;
  const warning = streaks.filter(s => s.consecutiveDays < 5).length;

  return (
    <div className="space-y-6">
      {streakError && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <span className="font-semibold">Error loading at-risk data.</span>
          <span>Please check your connection and try refreshing.</span>
          <button onClick={() => refetch()} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-500" />
            At-Risk Students
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Students with consecutive absences — sorted by streak length</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-slate-600 dark:text-slate-400">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
          {streaks.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700">
                <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
              </Button>
              <Button size="sm" onClick={notifyAll} className="h-8 bg-red-600 hover:bg-red-700 text-white">
                Notify All Parents ({streaks.filter(s => s.whatsappNumber).length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Min. Absent Days</label>
            <Select value={minDays} onValueChange={setMinDays}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2+ days</SelectItem>
                <SelectItem value="3">3+ days</SelectItem>
                <SelectItem value="5">5+ days</SelectItem>
                <SelectItem value="7">7+ days</SelectItem>
                <SelectItem value="10">10+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Class</label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Section</label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="All Sections" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="text-center w-full">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{streaks.length}</p>
              <p className="text-xs text-slate-500">students flagged</p>
            </div>
          </div>
        </div>
      </div>

      {/* Severity summary cards */}
      {streaks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-700 dark:text-red-400">{critical}</p>
            <p className="text-xs font-semibold text-red-600 dark:text-red-500 mt-1">Critical (7+ days)</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">{high}</p>
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-500 mt-1">High (5–6 days)</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{warning}</p>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-500 mt-1">Warning (3–4 days)</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
          Checking attendance records...
        </div>
      ) : streaks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No at-risk students</h3>
          <p className="text-slate-500 mt-2 text-sm">No student has {minDays}+ consecutive absences. Great attendance!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
              <TableRow>
                <TableHead className="font-semibold">#</TableHead>
                <TableHead className="font-semibold">Student</TableHead>
                <TableHead className="font-semibold">Class / Section</TableHead>
                <TableHead className="font-semibold text-center">Streak</TableHead>
                <TableHead className="font-semibold">Absent Since</TableHead>
                <TableHead className="font-semibold">Last Absent</TableHead>
                <TableHead className="font-semibold text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streaks.map((s, idx) => {
                const sev = getSeverity(s.consecutiveDays);
                return (
                  <TableRow key={s.studentId} className={sev.bg}>
                    <TableCell className="text-slate-400 text-sm">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{s.studentName}</p>
                          {s.fatherName && <p className="text-xs text-slate-400">{s.fatherName}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{s.className} / {s.sectionName}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span className={`text-2xl font-black ${sev.textColor}`}>{s.consecutiveDays}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${sev.color}`}>{sev.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{s.firstAbsenceDate}</TableCell>
                    <TableCell className="text-sm text-slate-600">{s.lastAbsenceDate}</TableCell>
                    <TableCell className="text-center">
                      {s.whatsappNumber ? (
                        <Button
                          size="sm"
                          onClick={() => notifyOne(s)}
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                          Notify
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No number</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
