import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import {
  useListStudents, useListClasses, useListSections,
  useGetAttendanceSummary, useListAttendance, useSaveAttendance,
  getListStudentsQueryKey, getListAttendanceQueryKey, getGetAttendanceSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, XCircle, HelpCircle,
  Save, Filter, Download, RotateCcw, Lock,
} from "lucide-react";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

type AttendanceStatus = "present" | "absent" | "unmarked";


export default function AttendanceTab() {
  const today = new Date().toISOString().split("T")[0];
  const [view, setView] = useState<"classes" | "marking" | "view">("classes");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Map<number, AttendanceStatus>>(new Map());

  // Filter view state
  const [filterDateFrom, setFilterDateFrom] = useState(today);
  const [filterDateTo, setFilterDateTo] = useState(today);
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const { data: summary = [] } = useGetAttendanceSummary({ date: selectedDate });

  const studentsParams = selectedClassId && selectedSectionId
    ? { classId: selectedClassId, sectionId: selectedSectionId }
    : {};
  const { data: students = [], isLoading: studentsLoading } = useListStudents(
    studentsParams,
    { query: { enabled: !!(selectedClassId && selectedSectionId), queryKey: getListStudentsQueryKey(studentsParams) } }
  );

  const attendanceMarkingParams = selectedClassId && selectedSectionId
    ? { date: selectedDate, classId: selectedClassId, sectionId: selectedSectionId }
    : {};
  const { data: existingAttendance = [] } = useListAttendance(
    attendanceMarkingParams,
    { query: { enabled: !!(selectedClassId && selectedSectionId) && view === "marking", queryKey: getListAttendanceQueryKey(attendanceMarkingParams) } }
  );

  const attendanceFilterParams = {
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
    classId: filterClassId !== "all" ? parseInt(filterClassId) : undefined,
    sectionId: filterSectionId !== "all" ? parseInt(filterSectionId) : undefined,
    status: filterStatus !== "all" ? (filterStatus as "present" | "absent") : undefined,
  };
  const { data: filteredAttendance = [], isLoading: filterLoading } = useListAttendance(
    attendanceFilterParams,
    { query: { enabled: view === "view", queryKey: getListAttendanceQueryKey(attendanceFilterParams) } }
  );

  const saveAttendance = useSaveAttendance({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAttendanceSummaryQueryKey() });
        toast({ title: "Attendance saved successfully" });
      },
      onError: () => {
        toast({ title: "Failed to save attendance", variant: "destructive" });
      }
    }
  });

  function openMarking(classId: number, sectionId: number) {
    setSelectedClassId(classId);
    setSelectedSectionId(sectionId);
    setAttendanceMap(new Map());
    setView("marking");
  }

  useMemo(() => {
    if (existingAttendance.length > 0 && view === "marking") {
      const map = new Map<number, AttendanceStatus>();
      existingAttendance.forEach(r => {
        map.set(r.studentId, r.status as AttendanceStatus);
      });
      setAttendanceMap(map);
    }
  }, [existingAttendance, view]);

  function toggleStatus(studentId: number) {
    setAttendanceMap(prev => {
      const next = new Map(prev);
      const current = next.get(studentId) ?? "unmarked";
      if (current === "unmarked") next.set(studentId, "present");
      else if (current === "present") next.set(studentId, "absent");
      else next.set(studentId, "present");
      return next;
    });
  }

  function markAll(status: "present" | "absent") {
    const next = new Map<number, AttendanceStatus>();
    students.forEach(s => next.set(s.id, status));
    setAttendanceMap(next);
  }

  function handleSave() {
    const records = students.map(s => ({
      studentId: s.id,
      status: (attendanceMap.get(s.id) ?? "absent") as "present" | "absent",
    }));
    saveAttendance.mutate({ data: { date: selectedDate, records } });
  }

  function resetFilterView() {
    setFilterDateFrom(today);
    setFilterDateTo(today);
    setFilterClassId("all");
    setFilterSectionId("all");
    setFilterStatus("all");
  }

  function exportAttendanceCSV() {
    if (filteredAttendance.length === 0) return;
    const headers = ["Student Name", "Father's Name", "Class", "Section", "Date", "Status"];
    const rows = filteredAttendance.map(r => [
      r.studentName,
      r.fatherName || "",
      r.className || "",
      r.sectionName || "",
      r.date,
      r.status,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${filterDateFrom}_to_${filterDateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  const presentCount = [...attendanceMap.values()].filter(v => v === "present").length;
  const absentCount = [...attendanceMap.values()].filter(v => v === "absent").length;
  const unmarkedCount = students.length - presentCount - absentCount;

  const summaryByClass = useMemo(() => {
    const map = new Map<number, { className: string; sections: typeof summary }>();
    summary.forEach(item => {
      if (!map.has(item.classId!)) {
        map.set(item.classId!, { className: item.className!, sections: [] });
      }
      map.get(item.classId!)!.sections.push(item);
    });
    return map;
  }, [summary]);

  const chartData = useMemo(() =>
    summary.map(item => ({
      name: `${item.className}-${item.sectionName}`,
      Present: item.presentCount,
      Absent: item.absentCount,
      Unmarked: (item.unmarkedCount ?? (item.totalStudents - item.presentCount - item.absentCount)),
    })),
    [summary]
  );

  /* ─────────────── MARKING VIEW ─────────────── */
  if (view === "marking") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setView("classes")} className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Mark Attendance — {selectedClass?.name} / {selectedSection?.name}
            </h2>
            <p className="text-sm text-slate-500">{selectedDate}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{presentCount}</p>
            <p className="text-xs text-green-700 dark:text-green-500 font-medium mt-0.5">Present</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{absentCount}</p>
            <p className="text-xs text-red-700 dark:text-red-500 font-medium mt-0.5">Absent</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-500">{unmarkedCount}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Unmarked</p>
          </div>
        </div>

        {/* Quick mark actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => markAll("present")} className="text-green-600 border-green-200 hover:bg-green-50">
            Mark All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll("absent")} className="text-red-600 border-red-200 hover:bg-red-50">
            Mark All Absent
          </Button>
        </div>

        {/* Student list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          {studentsLoading ? (
            <div className="p-8 text-center text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No students found in this class/section.</div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
                <TableRow>
                  <TableHead className="font-semibold">#</TableHead>
                  <TableHead className="font-semibold">Student Name</TableHead>
                  <TableHead className="font-semibold">Father's Name</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, idx) => {
                  const status = attendanceMap.get(student.id) ?? "unmarked";
                  const isProcessed = !!(student as any).isPromoted;
                  const sessionStatus = getSessionStatus((student as any).studentType);
                  return (
                    <TableRow
                      key={student.id}
                      className={isProcessed
                        ? "opacity-60 bg-slate-50/80 dark:bg-slate-800/20 cursor-not-allowed"
                        : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"}
                      onClick={() => !isProcessed && toggleStatus(student.id)}
                    >
                      <TableCell className="text-slate-400 text-sm">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        <div className="flex flex-col gap-1">
                          <span>{student.studentName}</span>
                          {sessionStatus && <SessionStatusBadge studentType={(student as any).studentType} />}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{student.fatherName || "—"}</TableCell>
                      <TableCell className="text-center">
                        {isProcessed ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                            <Lock className="h-3 w-3" />Session Closed
                          </span>
                        ) : status === "present" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />Present
                          </span>
                        ) : status === "absent" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3.5 w-3.5" />Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <HelpCircle className="h-3.5 w-3.5" />Tap to Mark
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveAttendance.isPending || students.length === 0} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8">
            <Save className="h-4 w-4 mr-2" />
            {saveAttendance.isPending ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </div>
    );
  }

  /* ─────────────── VIEW / FILTER RECORDS ─────────────── */
  if (view === "view") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setView("classes")} className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">View Attendance Records</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportAttendanceCSV}
            disabled={filteredAttendance.length === 0}
            className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
          >
            <Download className="h-4 w-4" />
            Export CSV ({filteredAttendance.length})
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filter Records</span>
            </div>
            <Button variant="outline" size="sm" onClick={resetFilterView} className="text-slate-600 dark:text-slate-400 h-8 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />Reset
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                min={filterDateFrom}
                onChange={e => setFilterDateTo(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Class</label>
              <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Section</label>
              <Select value={filterSectionId} onValueChange={setFilterSectionId}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="All Sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
              <TableRow>
                <TableHead className="font-semibold">Student</TableHead>
                <TableHead className="font-semibold">Father's Name</TableHead>
                <TableHead className="font-semibold">Class / Section</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filterLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Loading...</TableCell></TableRow>
              ) : filteredAttendance.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">No attendance records found for the selected filters.</TableCell></TableRow>
              ) : (
                filteredAttendance.map(record => {
                  const isAbsent = record.status === "absent";
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium text-slate-900 dark:text-white">{record.studentName}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{record.fatherName || "—"}</TableCell>
                      <TableCell className="text-slate-600">{record.className} / {record.sectionName}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{record.date}</TableCell>
                      <TableCell className="text-center">
                        {isAbsent ? (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
                            <XCircle className="h-3 w-3 mr-1" />Absent
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Present
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  /* ─────────────── CLASS CARDS VIEW (default) ─────────────── */
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance</h2>
          <p className="text-sm text-slate-500 mt-0.5">Select a class and section to mark attendance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <Button variant="outline" onClick={() => setView("view")} className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            View Records
          </Button>
        </div>
      </div>

      {summary.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <CalendarDays className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No classes yet</h3>
          <p className="text-slate-500 mt-2 text-sm">Add classes and students first, then come back to mark attendance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...summaryByClass.entries()].map(([classId, { className, sections: classSections }]) => (
            <div
              key={classId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm"
            >
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{className}</p>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">Click a section to take attendance</p>
              <div className="flex flex-wrap gap-2">
                {classSections.map(item => (
                  <button
                    key={`${item.classId}-${item.sectionId}`}
                    onClick={() => openMarking(item.classId!, item.sectionId!)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400 transition-all"
                  >
                    {item.sectionName}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
