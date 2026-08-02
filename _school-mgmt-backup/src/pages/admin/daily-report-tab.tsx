import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useGetAttendanceSummary, useListClasses } from "@workspace/api-client-react";
import { CalendarDays, Download, TrendingUp, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DailyReportTab() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: summary = [], isLoading } = useGetAttendanceSummary({ date: selectedDate });
  const { data: classes = [] } = useListClasses();

  const totals = useMemo(() => {
    const totalStudents = summary.reduce((sum, s) => sum + s.totalStudents, 0);
    const totalPresent = summary.reduce((sum, s) => sum + s.presentCount, 0);
    const totalAbsent = summary.reduce((sum, s) => sum + s.absentCount, 0);
    const totalUnmarked = summary.reduce((sum, s) => sum + (s.unmarkedCount ?? (s.totalStudents - s.presentCount - s.absentCount)), 0);
    const presentPct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
    return { totalStudents, totalPresent, totalAbsent, totalUnmarked, presentPct };
  }, [summary]);

  const groupedByClass = useMemo(() => {
    const map = new Map<number, { className: string; sections: typeof summary }>();
    summary.forEach(item => {
      if (!map.has(item.classId!)) {
        map.set(item.classId!, { className: item.className!, sections: [] });
      }
      map.get(item.classId!)!.sections.push(item);
    });
    return [...map.entries()].map(([classId, { className, sections }]) => {
      const total = sections.reduce((s, r) => s + r.totalStudents, 0);
      const present = sections.reduce((s, r) => s + r.presentCount, 0);
      const absent = sections.reduce((s, r) => s + r.absentCount, 0);
      const unmarked = sections.reduce((s, r) => s + (r.unmarkedCount ?? (r.totalStudents - r.presentCount - r.absentCount)), 0);
      return { classId, className, total, present, absent, unmarked, sections };
    });
  }, [summary]);

  const chartData = useMemo(() =>
    summary.map(item => ({
      name: `${item.className}-${item.sectionName}`,
      Present: item.presentCount,
      Absent: item.absentCount,
      Unmarked: item.unmarkedCount ?? (item.totalStudents - item.presentCount - item.absentCount),
    })),
    [summary]
  );

  function exportCSV() {
    if (summary.length === 0) return;
    const headers = ["Class", "Section", "Total Students", "Present", "Absent", "Unmarked", "Present %", "Absent %"];
    const rows = summary.map(r => {
      const unmarked = r.unmarkedCount ?? (r.totalStudents - r.presentCount - r.absentCount);
      const presentPct = r.totalStudents > 0 ? ((r.presentCount / r.totalStudents) * 100).toFixed(1) : "0";
      const absentPct = r.totalStudents > 0 ? ((r.absentCount / r.totalStudents) * 100).toFixed(1) : "0";
      return [r.className, r.sectionName, r.totalStudents, r.presentCount, r.absentCount, unmarked, `${presentPct}%`, `${absentPct}%`];
    });
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_report_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Attendance Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">Class-wise summary for the selected date</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={summary.length === 0}
            className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
          Loading report...
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <CalendarDays className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No data for this date</h3>
          <p className="text-slate-500 mt-2 text-sm">No attendance has been recorded for {selectedDate}.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Students</span>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{totals.totalStudents}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Present</span>
              </div>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{totals.totalPresent}</p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">{totals.presentPct}%</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Absent</span>
              </div>
              <p className="text-3xl font-bold text-red-700 dark:text-red-400">{totals.totalAbsent}</p>
              <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">{totals.totalStudents > 0 ? Math.round((totals.totalAbsent / totals.totalStudents) * 100) : 0}%</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unmarked</span>
              </div>
              <p className="text-3xl font-bold text-slate-500">{totals.totalUnmarked}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Overall Attendance Rate
              </h3>
              <div className="space-y-3">
                {groupedByClass.map(cls => {
                  const pct = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
                  return (
                    <div key={cls.classId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{cls.className}</span>
                        <span className="text-slate-500">{cls.present}/{cls.total} — {pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Section-wise Chart</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Present" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Absent" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Unmarked" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Detailed Breakdown</h3>
            </div>
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
                <TableRow>
                  <TableHead className="font-semibold">Class</TableHead>
                  <TableHead className="font-semibold">Section</TableHead>
                  <TableHead className="font-semibold text-center">Total</TableHead>
                  <TableHead className="font-semibold text-center">Present</TableHead>
                  <TableHead className="font-semibold text-center">Absent</TableHead>
                  <TableHead className="font-semibold text-center">Unmarked</TableHead>
                  <TableHead className="font-semibold text-center">Present %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map(row => {
                  const unmarked = row.unmarkedCount ?? (row.totalStudents - row.presentCount - row.absentCount);
                  const pct = row.totalStudents > 0 ? Math.round((row.presentCount / row.totalStudents) * 100) : 0;
                  return (
                    <TableRow key={`${row.classId}-${row.sectionId}`}>
                      <TableCell className="font-medium text-slate-900 dark:text-white">{row.className}</TableCell>
                      <TableCell className="text-slate-600">{row.sectionName}</TableCell>
                      <TableCell className="text-center text-slate-600">{row.totalStudents}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-700 dark:text-green-400 font-semibold">{row.presentCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-red-700 dark:text-red-400 font-semibold">{row.absentCount}</span>
                      </TableCell>
                      <TableCell className="text-center text-slate-500">{unmarked}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${pct >= 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {pct}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
