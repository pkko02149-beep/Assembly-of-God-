import { useState, useMemo } from "react";
import {
  useListStudents, useListVehicles, useListTrips, useListClasses, useListSections,
  useListAttendance, getListStudentsQueryKey, getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { formatWhatsappNumber } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, CheckCircle, SkipForward, RotateCcw, CalendarDays, ClipboardList, Bus, Zap } from "lucide-react";

type NotifyTarget = {
  id: number;
  studentName: string;
  whatsappNumber: string;
  extra?: string;
  status?: string;
};

const ATTENDANCE_MSG = "Dear parent of {name}, your child was marked {status} on {date}. Please contact the school if needed.";
const BUS_MSG = "Hello parent of {name}, this is an update regarding the school bus / trip. Please contact us for details.";

export default function BulkNotifyTab() {
  const today = new Date().toISOString().split("T")[0];

  // Mode toggle
  const [attendanceMode, setAttendanceMode] = useState(false);

  // Attendance filters
  const [filterDate, setFilterDate] = useState(today);
  const [filterStatus, setFilterStatus] = useState<string>("absent");

  // Student / bus filters
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [tripId, setTripId] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");

  // Separate message templates for each mode
  const [attendanceMsg, setAttendanceMsg] = useState(ATTENDANCE_MSG);
  const [busMsg, setBusMsg] = useState(BUS_MSG);

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [sendAllProgress, setSendAllProgress] = useState(0);
  const [sendAllRunning, setSendAllRunning] = useState(false);

  const { data: vehicles = [] } = useListVehicles();
  const { data: trips = [] } = useListTrips();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const studentsParams = {
    vehicleId: vehicleId !== "all" ? parseInt(vehicleId) : undefined,
    tripId: tripId !== "all" ? parseInt(tripId) : undefined,
    classId: classId !== "all" ? parseInt(classId) : undefined,
    sectionId: sectionId !== "all" ? parseInt(sectionId) : undefined,
  };
  const { data: rawStudents = [], isLoading: studentsLoading } = useListStudents(
    studentsParams,
    { query: { enabled: !attendanceMode, queryKey: getListStudentsQueryKey(studentsParams) } }
  );

  const attendanceParams = {
    date: filterDate,
    classId: classId !== "all" ? parseInt(classId) : undefined,
    sectionId: sectionId !== "all" ? parseInt(sectionId) : undefined,
    status: filterStatus !== "all" ? (filterStatus as "present" | "absent") : undefined,
  };
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useListAttendance(
    attendanceParams,
    { query: { enabled: attendanceMode, queryKey: getListAttendanceQueryKey(attendanceParams) } }
  );

  const isLoading = attendanceMode ? attendanceLoading : studentsLoading;

  const targets: NotifyTarget[] = useMemo(() => {
    if (attendanceMode) {
      return attendanceRecords.map(r => ({
        id: r.studentId,
        studentName: r.studentName,
        whatsappNumber: r.whatsappNumber ?? "",
        extra: `${r.className ?? ""} / ${r.sectionName ?? ""}`,
        status: r.status ?? "absent",
      }));
    }
    return rawStudents.map(s => ({
      id: s.id,
      studentName: s.studentName,
      whatsappNumber: s.whatsappNumber ?? "",
      extra: [s.vehicleName, s.tripName].filter(Boolean).join(" · ") || "—",
    }));
  }, [attendanceMode, attendanceRecords, rawStudents]);

  const resetSession = () => {
    setCurrentIndex(-1);
    setSentIds(new Set());
    setSkippedIds(new Set());
    setSendAllProgress(0);
    setSendAllRunning(false);
  };

  const handleSendAll = async () => {
    if (targets.length === 0 || sendAllRunning) return;
    const withNumbers = targets.filter(t => t.whatsappNumber);
    if (withNumbers.length === 0) return;

    // Open wa.me links in browser tabs
    setSendAllRunning(true);
    setSendAllProgress(0);
    const newSent = new Set<number>();
    withNumbers.forEach((target, i) => {
      setTimeout(() => {
        const statusLabel = target.status ?? (filterStatus !== "all" ? filterStatus : "absent");
        const msg = activeMsg
          .replace(/{name}/g, target.studentName)
          .replace(/{date}/g, filterDate || today)
          .replace(/{status}/g, statusLabel);
        const formatted = formatWhatsappNumber(target.whatsappNumber);
        window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, "_blank");
        newSent.add(target.id);
        setSentIds(new Set(newSent));
        setSendAllProgress(i + 1);
        if (i === withNumbers.length - 1) setSendAllRunning(false);
      }, i * 600);
    });
  };

  const handleModeToggle = (checked: boolean) => {
    setAttendanceMode(checked);
    resetSession();
  };

  const resetFilters = () => {
    setFilterDate(today);
    setFilterStatus("absent");
    setVehicleId("all"); setTripId("all");
    setClassId("all"); setSectionId("all");
    resetSession();
  };

  const isStarted = currentIndex >= 0;
  const isComplete = currentIndex >= targets.length && isStarted;
  const currentTarget = isStarted && !isComplete ? targets[currentIndex] : null;

  const activeMsg = attendanceMode ? attendanceMsg : busMsg;
  const setActiveMsg = attendanceMode ? setAttendanceMsg : setBusMsg;

  const handleStartSending = () => {
    if (targets.length === 0) return;
    setCurrentIndex(0);
    setSentIds(new Set());
    setSkippedIds(new Set());
  };

  const handleSendNext = () => {
    if (!currentTarget) return;
    const statusLabel = currentTarget.status ?? (filterStatus !== "all" ? filterStatus : "absent");
    const msg = activeMsg
      .replace(/{name}/g, currentTarget.studentName)
      .replace(/{date}/g, filterDate || today)
      .replace(/{status}/g, statusLabel);
    const formatted = formatWhatsappNumber(currentTarget.whatsappNumber);
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, "_blank");
    setSentIds(prev => new Set(prev).add(currentTarget.id));
    setCurrentIndex(i => i + 1);
  };

  const handleSkip = () => {
    if (!currentTarget) return;
    setSkippedIds(prev => new Set(prev).add(currentTarget.id));
    setCurrentIndex(i => i + 1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-6">

        {/* Step 1: Filters */}
        <div>
          <h3 className="text-lg font-semibold mb-4">1. Filter Target Audience</h3>

          {/* Mode toggle checkbox */}
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer mb-5 transition-all ${
              attendanceMode
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            }`}
            onClick={() => handleModeToggle(!attendanceMode)}
          >
            <Checkbox
              checked={attendanceMode}
              onCheckedChange={handleModeToggle}
              id="attendance-mode-toggle"
              className="mt-0.5"
            />
            <div>
              <label htmlFor="attendance-mode-toggle" className="font-semibold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Attendance Based Filter
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                {attendanceMode
                  ? "Filtering by attendance records — Date and Status fields are active."
                  : "Filtering by bus/trip assignment — Vehicle and Trip fields are active."}
              </p>
            </div>
          </div>

          {/* Attendance filters — visible only when attendance mode is ON */}
          {attendanceMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pl-4 border-l-2 border-amber-400">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
                  <CalendarDays className="inline h-3.5 w-3.5 mr-1 mb-0.5" />Date
                </label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => { setFilterDate(e.target.value); resetSession(); }}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Attendance Status
                </label>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetSession(); }}>
                  <SelectTrigger className="bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Vehicle / Trip filters — visible only when attendance mode is OFF */}
          {!attendanceMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pl-4 border-l-2 border-slate-300 dark:border-slate-600">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
                  <Bus className="inline h-3.5 w-3.5 mr-1 mb-0.5" />Vehicle
                </label>
                <Select value={vehicleId} onValueChange={(v) => { setVehicleId(v); resetSession(); }}>
                  <SelectTrigger className="bg-white dark:bg-slate-950">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
                  Trip
                </label>
                <Select value={tripId} onValueChange={(v) => { setTripId(v); resetSession(); }}>
                  <SelectTrigger className="bg-white dark:bg-slate-950">
                    <SelectValue placeholder="All Trips" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trips</SelectItem>
                    {trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Class / Section — always visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Class</label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); resetSession(); }}>
                <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">Section</label>
              <Select value={sectionId} onValueChange={(v) => { setSectionId(v); resetSession(); }}>
                <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue placeholder="All Sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={resetFilters} className="text-slate-600 dark:text-slate-400">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset Filters
            </Button>
          </div>
        </div>

        {/* Step 2: Message */}
        <div>
          <h3 className="text-lg font-semibold mb-1">2. Compose Message</h3>
          <p className="text-xs text-slate-400 mb-3">
            {attendanceMode
              ? <>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{name}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{date}"}</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{status}"}</code> as placeholders.</>
              : <>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{name}"}</code> as a placeholder for the student's name.</>
            }
          </p>
          <div className={`rounded-lg border-2 p-1 transition-all ${attendanceMode ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"}`}>
            <Textarea
              value={activeMsg}
              onChange={(e) => setActiveMsg(e.target.value)}
              className="h-24 bg-slate-50 dark:bg-slate-950 border-0 focus-visible:ring-0 resize-none"
              placeholder="Type your message..."
            />
          </div>
          {attendanceMode && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
              Attendance message — includes date &amp; status info
            </p>
          )}
        </div>

        {/* Step 3: Send */}
        <div>
          <h3 className="text-lg font-semibold mb-4">3. Send Notifications</h3>

          {/* Stats */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Target</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{targets.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Sent</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">{sentIds.size}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Skipped</p>
              <p className="text-2xl font-bold text-slate-400">{skippedIds.size}</p>
            </div>
          </div>

          {/* Current target preview */}
          {currentTarget && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide mb-1">
                Sending to ({currentIndex + 1}/{targets.length})
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">{currentTarget.studentName}</p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {currentTarget.whatsappNumber || <span className="text-red-400">No contact — skip recommended</span>}
              </p>
            </div>
          )}

          {isComplete && (
            <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700 dark:text-green-400">
                All done! {sentIds.size} sent, {skippedIds.size} skipped.
              </p>
            </div>
          )}

          {currentIndex === -1 ? (
            <div className="space-y-3">
              {/* Send All — one click */}
              <div className="rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <p className="text-xs text-green-700 dark:text-green-400">
                    <strong>One-click mode:</strong> Opens all WhatsApp chats automatically, one every 0.6 seconds.
                    Your browser will ask to <strong>allow popups</strong> — click Allow once and all chats open.
                    You only need to press Send inside each WhatsApp window.
                  </p>
                </div>
                {sendAllRunning && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-green-700 dark:text-green-400 mb-1">
                      <span>Opening chats...</span>
                      <span>{sendAllProgress} / {targets.filter(t => t.whatsappNumber).length}</span>
                    </div>
                    <div className="h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${(sendAllProgress / Math.max(targets.filter(t => t.whatsappNumber).length, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {sendAllProgress > 0 && !sendAllRunning && (
                  <p className="text-xs text-green-700 dark:text-green-400 font-semibold mb-3">
                    ✓ All {sendAllProgress} chats opened! Go to each WhatsApp tab and press Send.
                  </p>
                )}
                <Button
                  onClick={handleSendAll}
                  disabled={targets.length === 0 || isLoading || sendAllRunning}
                  className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  {sendAllRunning
                    ? `Opening ${sendAllProgress}/${targets.filter(t => t.whatsappNumber).length}...`
                    : `Send All ${targets.filter(t => t.whatsappNumber).length} at Once`}
                </Button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">or send one by one</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <Button
                onClick={handleStartSending}
                disabled={targets.length === 0 || isLoading}
                className="w-full h-12 text-base font-bold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Send className="h-4 w-4 mr-2" />
                Step-by-step ({targets.length} student{targets.length !== 1 ? "s" : ""})
              </Button>
            </div>
          ) : isComplete ? (
            <Button
              variant="outline"
              onClick={resetSession}
              className="w-full h-14 text-lg font-semibold text-slate-600 dark:text-slate-400"
            >
              <RotateCcw className="h-5 w-5 mr-2" />Restart Session
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={handleSendNext}
                disabled={!currentTarget?.whatsappNumber}
                className="h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-slate-950"
              >
                <Send className="h-5 w-5 mr-2" />
                Send ({currentIndex + 1}/{targets.length})
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                className="h-14 text-lg font-semibold border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <SkipForward className="h-5 w-5 mr-2" />Skip
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Target list table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>{attendanceMode ? "Class / Section" : "Vehicle / Trip"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((target, idx) => (
              <TableRow key={`${target.id}-${idx}`} className={idx === currentIndex ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                <TableCell>
                  {sentIds.has(target.id) ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : skippedIds.has(target.id) ? (
                    <SkipForward className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  ) : idx === currentIndex ? (
                    <div className="h-3 w-3 bg-amber-500 rounded-full animate-pulse mx-1" />
                  ) : (
                    <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded-full mx-1" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{target.studentName}</TableCell>
                <TableCell className="font-mono text-xs text-slate-500">
                  {target.whatsappNumber || <span className="text-slate-300 dark:text-slate-600 italic">not set</span>}
                </TableCell>
                <TableCell className="text-xs text-slate-500">{target.extra ?? "—"}</TableCell>
              </TableRow>
            ))}
            {targets.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  No students match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
