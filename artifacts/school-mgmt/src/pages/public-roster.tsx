import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useListStudents, useListVehicles, useListClasses } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Bus, Search, Lock, ScanLine, QrCode, Info, Receipt, Camera, CheckCircle2, XCircle, AlertTriangle, GraduationCap, Users } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface ReceiptVerifyResult {
  found: boolean;
  studentName?: string;
  className?: string;
  sectionName?: string;
  months?: string[];
  totalPaid?: number;
  paymentDate?: string;
  paymentMethod?: string;
  receiptNo?: string;
}

function ReceiptScanner() {
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<ReceiptVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const stopCamera = useCallback(() => {
    readerRef.current = null;
    // Stop all video tracks from the video element
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function verifyReceipt(receiptNo: string) {
    if (!receiptNo.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/fees/receipt-verify/${encodeURIComponent(receiptNo.trim())}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    setCameraError("");
    setScanning(true);
    // Allow React to render the video element before attaching
    await new Promise((r) => setTimeout(r, 80));
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const result = await reader.decodeOnceFromVideoDevice(undefined, videoRef.current!);
      const code = result.getText();
      stopCamera();
      setManualInput(code);
      await verifyReceipt(code);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("notallowed")) {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings, then try again.");
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("device")) {
        setCameraError("No camera found on this device. Please enter the receipt number manually.");
      } else if (err?.name !== "NotFoundException") {
        setCameraError("Camera unavailable. Please enter the receipt number manually below.");
      }
      stopCamera();
    }
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Receipt className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-green-900 dark:text-green-300 text-sm">Fee Receipt Verification</h2>
          <p className="text-green-800 dark:text-green-400 text-xs mt-0.5">
            Scan the barcode on your printed fee receipt, or enter the receipt number below to verify payment.
          </p>
          <p className="text-[11px] text-green-600 dark:text-green-500 mt-1 italic">
            ⚠ Disclaimer: This verification tool is for informational purposes only. Always collect original receipts from the school office for official records.
          </p>
        </div>
      </div>

      {/* Camera scanner */}
      <div className="space-y-2">
        {/* Always render video element so ref is available */}
        <div className={scanning ? "space-y-2" : "hidden"}>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-52">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 border-4 border-green-400/60 rounded-xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-24 border-2 border-green-400 rounded-lg pointer-events-none" />
            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs font-medium drop-shadow">
              Point camera at the barcode on the receipt
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full text-xs h-8 border-red-300 text-red-600 hover:bg-red-50" onClick={stopCamera}>
            Stop Camera
          </Button>
        </div>
        {!scanning && (
          <Button
            size="sm"
            className="w-full h-9 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold flex items-center gap-2"
            onClick={startCamera}
            disabled={loading}
          >
            <Camera className="h-4 w-4" /> Scan Barcode with Camera
          </Button>
        )}
        {cameraError && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {cameraError}
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="flex gap-2">
        <Input
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          placeholder="Enter receipt number (e.g. RCP-1234567890)"
          className="h-8 text-sm bg-white dark:bg-slate-900"
          onKeyDown={e => e.key === "Enter" && verifyReceipt(manualInput)}
        />
        <Button
          size="sm"
          className="h-8 px-4 bg-green-600 hover:bg-green-700 text-white text-xs shrink-0"
          onClick={() => verifyReceipt(manualInput)}
          disabled={loading || !manualInput.trim()}
        >
          {loading ? "Verifying…" : "Verify"}
        </Button>
      </div>

      {/* Result */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className={`rounded-xl border p-4 space-y-2 ${result.found ? "bg-white border-green-300" : "bg-red-50 border-red-200"}`}>
          {result.found ? (
            <>
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" /> Receipt Verified ✓
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                <div><span className="text-slate-400">Student</span><div className="font-semibold text-slate-800">{result.studentName}</div></div>
                <div><span className="text-slate-400">Class</span><div className="font-semibold text-slate-800">{result.className} {result.sectionName}</div></div>
                <div><span className="text-slate-400">Months Paid</span><div className="font-semibold text-slate-800">{result.months?.join(", ") || "—"}</div></div>
                <div><span className="text-slate-400">Amount</span><div className="font-semibold text-green-700">₹{result.totalPaid?.toLocaleString("en-IN")}</div></div>
                <div><span className="text-slate-400">Date</span><div className="font-semibold text-slate-800">{result.paymentDate || "—"}</div></div>
                <div><span className="text-slate-400">Mode</span><div className="font-semibold text-slate-800 capitalize">{result.paymentMethod || "—"}</div></div>
                <div className="col-span-2"><span className="text-slate-400">Receipt No.</span><div className="font-mono text-xs text-slate-600">{result.receiptNo}</div></div>
              </div>
              <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 mt-2">
                This is an unofficial digital verification. For official purposes, please present the original printed receipt to the school office.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
              <XCircle className="h-5 w-5" /> Receipt not found. Please check the receipt number and try again.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PublicRoster() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");
  const [showHowTo, setShowHowTo] = useState(false);
  const [showReceiptVerify, setShowReceiptVerify] = useState(false);

  const { data: studentsRaw, isLoading } = useListStudents({
    search: search || undefined,
    vehicleId: vehicleId !== "all" ? parseInt(vehicleId) : undefined,
    classId: classId !== "all" ? parseInt(classId) : undefined,
  });
  const students = Array.isArray(studentsRaw) ? studentsRaw : [];

  const { data: vehiclesRaw } = useListVehicles();
  const { data: classesRaw } = useListClasses();
  const vehicles = Array.isArray(vehiclesRaw) ? vehiclesRaw : [];
  const classes = Array.isArray(classesRaw) ? classesRaw : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-amber-500 flex items-center justify-center rounded-lg shadow-sm">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                School Bus Roster
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-base">
              Check student bus and trip assignments.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/teacher/login")}
              className="flex items-center gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm"
            >
              <GraduationCap className="h-4 w-4" />
              Teacher Login
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/parent/login")}
              className="flex items-center gap-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm"
            >
              <Users className="h-4 w-4" />
              Parent Login
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/login")}
              data-testid="btn-admin-login"
              className="self-start md:self-auto flex items-center gap-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
            >
              <Lock className="h-4 w-4" />
              Admin Login
            </Button>
          </div>
        </div>

        {/* ── How students check in ── */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <ScanLine className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                How Students Check In for Bus Attendance
              </h2>
              <p className="text-amber-800 dark:text-amber-400 text-sm mt-0.5">
                Each student has a personal QR code. When boarding the bus, the conductor scans it — attendance is marked instantly.
              </p>
              <button
                onClick={() => setShowHowTo(!showHowTo)}
                className="text-xs text-amber-600 dark:text-amber-400 underline mt-1.5 flex items-center gap-1"
              >
                <Info className="h-3 w-3" />
                {showHowTo ? "Hide details" : "How does scanning work?"}
              </button>
              {showHowTo && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { step: "1", title: "Get Your QR Card", desc: "The school admin prints a QR code card for each student from the Admin Panel → QR Codes tab." },
                    { step: "2", title: "Show QR at Bus Stop", desc: "When boarding, show your printed QR code (or phone screen) to the bus conductor." },
                    { step: "3", title: "Instant Check-In", desc: "The conductor scans your QR with their phone → you are marked Present automatically." },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                      <div className="h-6 w-6 bg-amber-500 text-white rounded-full text-xs font-bold flex items-center justify-center mb-2">{step}</div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="hidden sm:flex flex-col items-center gap-1.5 flex-shrink-0">
              <QrCode className="h-8 w-8 text-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center leading-tight">
                Scan QR<br />to check in
              </span>
            </div>
          </div>
        </div>

        {/* ── Fee Receipt Verification ── */}
        <div>
          <button
            onClick={() => setShowReceiptVerify(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400 hover:underline mb-2"
          >
            <Receipt className="h-4 w-4" />
            {showReceiptVerify ? "Hide" : "Verify a Fee Receipt"} (scan barcode from receipt)
          </button>
          {showReceiptVerify && <ReceiptScanner />}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by student name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              data-testid="input-search"
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger data-testid="select-vehicle" className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-64">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger data-testid="select-class" className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Student table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
              <TableRow>
                <TableHead className="font-semibold">Student Name</TableHead>
                <TableHead className="font-semibold">Father's Name</TableHead>
                <TableHead className="font-semibold">Class</TableHead>
                <TableHead className="font-semibold">Section</TableHead>
                <TableHead className="font-semibold">Vehicle</TableHead>
                <TableHead className="font-semibold">Trip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">Loading...</TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">No students found.</TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400">
                      {(student as any).fatherName || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                    </TableCell>
                    <TableCell>{student.className}</TableCell>
                    <TableCell>{student.sectionName}</TableCell>
                    <TableCell>
                      {student.vehicleName ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {student.vehicleName}
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      {student.tripName || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
