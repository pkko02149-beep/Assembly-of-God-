import { useState } from "react";
import { useListStudents, useListAttendance, getListStudentsQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search, User, Download, RotateCcw } from "lucide-react";

export default function StudentHistoryTab() {
  const today = new Date().toISOString().split("T")[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [dateFrom, setDateFrom] = useState(oneMonthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: students = [] } = useListStudents(
    { search: search.trim() || undefined },
    { query: { enabled: search.trim().length >= 1, queryKey: getListStudentsQueryKey({ search: search.trim() }) } }
  );

  const historyParams = selectedStudentId
    ? { studentId: selectedStudentId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
    : {};

  const { data: history = [], isLoading: historyLoading } = useListAttendance(
    historyParams as any,
    { query: { enabled: !!selectedStudentId, queryKey: getListAttendanceQueryKey(historyParams as any) } }
  );

  function selectStudent(id: number, name: string) {
    setSelectedStudentId(id);
    setSelectedStudentName(name);
    setSearch(name);
    setShowSuggestions(false);
  }

  function reset() {
    setSearch("");
    setSelectedStudentId(null);
    setSelectedStudentName("");
    setDateFrom(oneMonthAgo);
    setDateTo(today);
  }

  const presentCount = history.filter(r => r.status === "present").length;
  const absentCount = history.filter(r => r.status === "absent").length;
  const attendancePct = history.length > 0 ? Math.round((presentCount / history.length) * 100) : 0;

  function exportCSV() {
    if (history.length === 0) return;
    const headers = ["Date", "Status", "Class", "Section"];
    const rows = history.map(r => [r.date, r.status, r.className || "", r.sectionName || ""]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_history_${selectedStudentName.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Attendance History</h2>
        <p className="text-sm text-slate-500 mt-0.5">Look up any student's attendance records over a date range</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 relative">
            <label className="text-xs text-slate-500 font-medium mb-1 block">Search Student</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setSelectedStudentId(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type student name..."
                className="pl-9 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            {showSuggestions && students.length > 0 && !selectedStudentId && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-52 overflow-auto">
                {students.slice(0, 10).map(s => (
                  <button
                    key={s.id}
                    onMouseDown={() => selectStudent(s.id, s.studentName)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{s.studentName}</p>
                    <p className="text-xs text-slate-400">{s.className} / {s.sectionName} · Roll #{s.rollNo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">To Date</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={e => setDateTo(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={reset} className="text-slate-600 dark:text-slate-400 text-xs h-8">
            <RotateCcw className="h-3 w-3 mr-1" />Reset
          </Button>
          {selectedStudentId && history.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV} className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20 text-xs h-8">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {selectedStudentId && (
        <>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{selectedStudentName}</p>
              <p className="text-xs text-slate-500">{dateFrom} to {dateTo}</p>
            </div>
            {history.length > 0 && (
              <div className="ml-auto flex items-center gap-4 text-sm">
                <span className="text-green-700 dark:text-green-400 font-semibold">{presentCount} Present</span>
                <span className="text-red-700 dark:text-red-400 font-semibold">{absentCount} Absent</span>
                <span className={`font-bold ${attendancePct >= 75 ? 'text-green-600' : attendancePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {attendancePct}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
                <TableRow>
                  <TableHead className="font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Class / Section</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Loading...</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">No attendance records found for this student in the selected date range.</TableCell></TableRow>
                ) : (
                  history.map((record, idx) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-slate-400 text-sm">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">{record.date}</TableCell>
                      <TableCell className="text-slate-600">{record.className} / {record.sectionName}</TableCell>
                      <TableCell className="text-center">
                        {record.status === "present" ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Present
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
                            <XCircle className="h-3 w-3 mr-1" />Absent
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!selectedStudentId && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Search className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Search for a student</h3>
          <p className="text-slate-500 mt-2 text-sm">Type a student's name above to look up their attendance history.</p>
        </div>
      )}
    </div>
  );
}
