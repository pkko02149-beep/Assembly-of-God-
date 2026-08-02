import { useState, useMemo } from "react";
import {
  useListStudents,
  useListClasses,
  useListSections,
  useListVehicles,
  useListTrips,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCw,
  Bus,
} from "lucide-react";

interface SendResult {
  email: string;
  studentName: string;
  ok: boolean;
  error?: string;
}

export default function BulkEmailTab() {
  const { toast } = useToast();

  const [vehicleMode, setVehicleMode] = useState(false);

  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [tripId, setTripId] = useState<string>("all");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  const { data: studentsRaw } = useListStudents({});
  const { data: classesRaw } = useListClasses();
  const { data: sectionsRaw } = useListSections({});
  const { data: vehiclesRaw } = useListVehicles();
  const { data: tripsRaw } = useListTrips();

  const students = Array.isArray(studentsRaw) ? studentsRaw : [];
  const classes = Array.isArray(classesRaw) ? classesRaw : [];
  // Show sections that belong to the selected class OR have no class assigned (global sections)
  const sections = useMemo(() => {
    const all = Array.isArray(sectionsRaw) ? sectionsRaw : [];
    if (classId === "all") return all;
    return all.filter((s: any) => !s.classId || s.classId === parseInt(classId));
  }, [sectionsRaw, classId]);
  const vehicles = Array.isArray(vehiclesRaw) ? vehiclesRaw : [];
  const trips = Array.isArray(tripsRaw) ? tripsRaw : [];

  const eligibleStudents = useMemo(() => {
    return students.filter((s) => {
      if (!s.parentEmail?.trim()) return false;
      if (vehicleMode) {
        if (vehicleId !== "all" && s.vehicleId !== parseInt(vehicleId)) return false;
        if (tripId !== "all" && s.tripId !== parseInt(tripId)) return false;
      } else {
        if (classId !== "all" && s.classId !== parseInt(classId)) return false;
        if (sectionId !== "all" && s.sectionId !== parseInt(sectionId)) return false;
      }
      return true;
    });
  }, [students, classId, sectionId, vehicleId, tripId, vehicleMode]);

  const handleClassChange = (v: string) => {
    setClassId(v);
    setSectionId("all");
    setSelectedIds(new Set());
    setResults(null);
  };
  const handleSectionChange = (v: string) => {
    setSectionId(v);
    setSelectedIds(new Set());
    setResults(null);
  };
  const handleVehicleChange = (v: string) => {
    setVehicleId(v);
    setTripId("all");
    setSelectedIds(new Set());
    setResults(null);
  };
  const handleTripChange = (v: string) => {
    setTripId(v);
    setSelectedIds(new Set());
    setResults(null);
  };
  const handleVehicleModeToggle = (checked: boolean) => {
    setVehicleMode(checked);
    setClassId("all");
    setSectionId("all");
    setVehicleId("all");
    setTripId("all");
    setSelectedIds(new Set());
    setResults(null);
    if (checked) {
      setSubject("Important Notice – School Bus");
      setMessage("Dear parent of {studentName},\n\nThis is an important message regarding your child's school bus.\n\nPlease contact the school office for more details.\n\nThank you.");
    } else {
      setSubject("");
      setMessage("");
    }
  };

  const toggleAll = () => {
    if (selectedIds.size === eligibleStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleStudents.map((s) => s.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedStudents = eligibleStudents.filter((s) => selectedIds.has(s.id));

  async function handleSend() {
    if (!subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message body is required", variant: "destructive" });
      return;
    }
    if (selectedStudents.length === 0) {
      toast({
        title: "No recipients selected",
        description: "Select at least one student with a parent email.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setResults(null);
    try {
      const res = await fetch("/api/email/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedStudents.map((s) => ({
            email: s.parentEmail,
            studentName: s.studentName,
            fatherName: s.fatherName,
            vehicleName: (s as any).vehicleName,
            tripName: (s as any).tripName,
          })),
          subject: subject.trim(),
          message: message.trim(),
          vehicleMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResults(data.results);
        toast({
          title: `${data.sent} email${data.sent !== 1 ? "s" : ""} sent`,
          description:
            data.failed > 0
              ? `${data.failed} failed — see details below.`
              : "All emails delivered successfully.",
          variant: data.failed > 0 ? "destructive" : "default",
        });
      } else {
        toast({
          title: "Failed to send emails",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  const selectedVehicleName =
    vehicleId !== "all" ? vehicles.find((v) => v.id.toString() === vehicleId)?.name : null;
  const selectedTripName =
    tripId !== "all" ? trips.find((t) => t.id.toString() === tripId)?.name : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Email</h2>
          <p className="text-sm text-slate-500">
            Send a custom message to parents — filter by class/section or by vehicle/trip.
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
        <Checkbox
          id="vehicleMode"
          checked={vehicleMode}
          onCheckedChange={(c) => handleVehicleModeToggle(!!c)}
          className="border-amber-400"
        />
        <label
          htmlFor="vehicleMode"
          className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-amber-900 dark:text-amber-200 select-none"
        >
          <Bus className="h-4 w-4 text-amber-600" />
          Vehicle Bulk Email Mode — filter and email parents by bus vehicle & trip
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — filters + recipient list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-900 dark:text-white text-sm">
              Recipients
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {eligibleStudents.length} with email · {selectedIds.size} selected
            </span>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
            {vehicleMode ? (
              <>
                <div className="flex gap-3">
                  <Select value={vehicleId} onValueChange={handleVehicleChange}>
                    <SelectTrigger className="flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
                      <SelectValue placeholder="All Vehicles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vehicles</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={tripId} onValueChange={handleTripChange}>
                    <SelectTrigger className="flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
                      <SelectValue placeholder="All Trips" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Trips</SelectItem>
                      {trips.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(selectedVehicleName || selectedTripName) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Bus className="h-3 w-3" />
                    Sending to parents of students on{" "}
                    {selectedVehicleName ? <strong>{selectedVehicleName}</strong> : "any vehicle"}
                    {selectedTripName ? <> / trip <strong>{selectedTripName}</strong></> : ""}
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-3">
                <Select value={classId} onValueChange={handleClassChange}>
                  <SelectTrigger className="flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sectionId}
                  onValueChange={handleSectionChange}
                  disabled={classId === "all"}
                >
                  <SelectTrigger className="flex-1 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm disabled:opacity-50">
                    <SelectValue placeholder={classId === "all" ? "Select class first" : "All Sections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Student table */}
          <div className="max-h-80 overflow-y-auto">
            {eligibleStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No students with a parent email found for this filter.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950/80">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selectedIds.size === eligibleStudents.length &&
                          eligibleStudents.length > 0
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-xs">Student</TableHead>
                    <TableHead className="text-xs">
                      {vehicleMode ? "Vehicle / Trip" : "Parent Email"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleStudents.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      onClick={() => toggleOne(s.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleOne(s.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {s.studentName}
                        {s.fatherName && (
                          <div className="text-xs text-slate-400">{s.fatherName}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 truncate max-w-[140px]">
                        {vehicleMode ? (
                          <span className="flex items-center gap-1">
                            <Bus className="h-3 w-3 text-amber-500" />
                            {(s as any).vehicleName || "—"}{" "}
                            {(s as any).tripName ? `/ ${(s as any).tripName}` : ""}
                          </span>
                        ) : (
                          s.parentEmail
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Right — compose */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            {vehicleMode ? (
              <Bus className="h-4 w-4 text-amber-500" />
            ) : (
              <Mail className="h-4 w-4 text-slate-500" />
            )}
            <span className="font-semibold text-slate-900 dark:text-white text-sm">
              {vehicleMode ? "Compose Vehicle Notice" : "Compose Message"}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-4 flex-1">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Important notice regarding bus schedule"
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Message Body
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  vehicleMode
                    ? "Write your vehicle/bus related notice here. Each parent will receive a personalised email."
                    : "Write your message here. Each parent will receive a personalised email with their child's name at the top."
                }
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 min-h-[180px] resize-none"
              />
              <p className="text-xs text-slate-400">
                {vehicleMode
                  ? "Each email is personalised with the student's name, vehicle and trip details automatically."
                  : "Each email is personalised with the student's name and father's name automatically."}
              </p>
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || selectedStudents.length === 0}
              className={`w-full font-semibold text-white ${
                vehicleMode
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending to {selectedStudents.length} parent
                  {selectedStudents.length !== 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  {vehicleMode ? (
                    <Bus className="h-4 w-4 mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send to {selectedStudents.length} parent
                  {selectedStudents.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-white text-sm">
              Send Results
            </span>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {results.filter((r) => r.ok).length} sent
              </span>
              {results.some((r) => !r.ok) && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  {results.filter((r) => !r.ok).length} failed
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResults(null)}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950/80">
                <TableRow>
                  <TableHead className="w-10 text-xs">Status</TableHead>
                  <TableHead className="text-xs">Student</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-xs text-slate-500">{r.email}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {r.ok ? "Delivered" : r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
