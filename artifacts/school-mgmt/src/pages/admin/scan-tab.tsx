import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import {
  CheckCircle2, XCircle, Camera, CameraOff,
  Loader2, UserRound, Bus, BookOpen, ScanLine, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Student {
  id: number;
  uniqueId: string;
  studentName: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  vehicleName?: string | null;
  rollNo: number;
}

type ScanPhase =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "looking-up"; uid: string }
  | { kind: "marking"; student: Student }
  | { kind: "confirmed"; student: Student; time: string }
  | { kind: "error-student"; uid: string; message: string }
  | { kind: "error-mark"; student: Student }
  | { kind: "no-camera"; message: string };

const CONFIRM_MS = 3500;
const DEBOUNCE_MS = 5000;

export default function ScanTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<{ uid: string; time: number } | null>(null);
  const processingRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>({ kind: "starting" });

  const today = new Date().toISOString().slice(0, 10);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const resetToScanning = useCallback(() => {
    processingRef.current = false;
    setPhase({ kind: "scanning" });
  }, []);

  const handleScannedUid = useCallback(async (rawText: string) => {
    if (processingRef.current) return;

    // Extract uid param from a full URL if the QR encodes one
    let uid = rawText;
    try {
      const url = new URL(rawText);
      const param = url.searchParams.get("id");
      if (param) uid = param;
    } catch {
      // rawText is just a plain uid string — use as-is
    }

    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.uid === uid && now - lastScanRef.current.time < DEBOUNCE_MS) return;
    processingRef.current = true;
    lastScanRef.current = { uid, time: now };

    setPhase({ kind: "looking-up", uid });

    let student: Student;
    try {
      const res = await fetch(`${base}/api/students/by-uid/${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error(res.status === 404 ? "Student not found" : "Server error");
      student = await res.json();
    } catch (e: any) {
      setPhase({ kind: "error-student", uid, message: e.message ?? "Unknown error" });
      confirmTimerRef.current = setTimeout(resetToScanning, CONFIRM_MS);
      return;
    }

    setPhase({ kind: "marking", student });
    try {
      const res = await fetch(`${base}/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, records: [{ studentId: student.id, status: "present" }] }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const time = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setPhase({ kind: "confirmed", student, time });
      confirmTimerRef.current = setTimeout(resetToScanning, CONFIRM_MS);
    } catch {
      setPhase({ kind: "error-mark", student });
      confirmTimerRef.current = setTimeout(resetToScanning, CONFIRM_MS);
    }
  }, [base, today, resetToScanning]);

  const startCamera = useCallback(() => {
    setStarted(true);
    setPhase({ kind: "starting" });

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        if (devices.length === 0) {
          setPhase({ kind: "no-camera", message: "No camera detected on this device." });
          return;
        }
        setPhase({ kind: "scanning" });
        reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
          if (result) handleScannedUid(result.getText());
          else if (err && !(err instanceof NotFoundException)) { /* ignore */ }
        });
      })
      .catch((err) => {
        const msg = err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser."
          : err?.message ?? "Could not access camera.";
        setPhase({ kind: "no-camera", message: msg });
      });
  }, [handleScannedUid]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, []);

  const todayDisplay = new Date().toLocaleDateString("en-PK", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-amber-500" />
          QR Scanner
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Scan student QR codes to mark Present — {todayDisplay}
        </p>
      </div>

      {/* Camera viewport */}
      <div className="relative bg-slate-950 rounded-2xl overflow-hidden" style={{ height: 440 }}>
        {/* Video feed */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${started ? "opacity-60" : "opacity-0"}`}
          muted
          playsInline
        />

        {/* Dark overlay */}
        {started && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/70 pointer-events-none" />
        )}

        {/* Not started yet */}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="h-20 w-20 rounded-full bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center">
              <Camera className="h-10 w-10 text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Camera Scanner</p>
              <p className="text-slate-400 text-sm mt-1">Click Start to activate the camera and begin scanning QR codes</p>
            </div>
            <Button
              onClick={startCamera}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-8 h-12 text-base"
            >
              <Camera className="h-5 w-5 mr-2" />
              Start Scanning
            </Button>
          </div>
        )}

        {/* Scanner frame — shown while scanning */}
        {started && (phase.kind === "scanning" || phase.kind === "starting") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="h-56 w-56 border-2 border-amber-400/70 rounded-2xl" />
              <div className="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
              {phase.kind === "scanning" && (
                <div className="absolute inset-x-2 top-0 animate-scan-line">
                  <div className="h-0.5 bg-amber-400/80 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status panel at bottom of viewport */}
        {started && (
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {phase.kind === "starting" && (
              <StatusCard>
                <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                <p className="text-white text-sm font-medium">Starting camera…</p>
              </StatusCard>
            )}
            {phase.kind === "scanning" && (
              <StatusCard>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <ScanLine className="h-5 w-5 text-amber-400" />
                <p className="text-white text-sm font-medium">Ready — point at a student QR code</p>
              </StatusCard>
            )}
            {phase.kind === "looking-up" && (
              <StatusCard>
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                <div>
                  <p className="text-white text-sm font-medium">Looking up student…</p>
                  <p className="text-slate-400 text-xs font-mono truncate max-w-xs">{phase.uid}</p>
                </div>
              </StatusCard>
            )}
            {phase.kind === "marking" && (
              <StudentCard student={phase.student} color="blue">
                <Loader2 className="h-7 w-7 text-blue-400 animate-spin" />
                <p className="text-blue-300 font-semibold">Marking present…</p>
              </StudentCard>
            )}
            {phase.kind === "confirmed" && (
              <StudentCard student={phase.student} color="green">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
                <div className="text-center">
                  <p className="text-green-300 font-bold text-xl">Present ✓</p>
                  <p className="text-slate-400 text-xs mt-0.5">{phase.time}</p>
                </div>
              </StudentCard>
            )}
            {phase.kind === "error-student" && (
              <StatusCard color="red">
                <XCircle className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-red-300 text-sm font-medium">{phase.message}</p>
                  <p className="text-slate-500 text-xs font-mono truncate max-w-xs">{phase.uid}</p>
                </div>
              </StatusCard>
            )}
            {phase.kind === "error-mark" && (
              <StudentCard student={phase.student} color="red">
                <XCircle className="h-8 w-8 text-red-400" />
                <p className="text-red-300 text-sm font-semibold">Failed to save — check connection</p>
              </StudentCard>
            )}
            {phase.kind === "no-camera" && (
              <StatusCard color="red">
                <CameraOff className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-red-300 text-sm font-medium">Camera unavailable</p>
                  <p className="text-slate-400 text-xs">{phase.message}</p>
                </div>
              </StatusCard>
            )}
          </div>
        )}
      </div>

      {/* Restart button if camera failed or not started yet */}
      {started && (phase.kind === "no-camera" || phase.kind === "error-mark") && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              BrowserMultiFormatReader.releaseAllStreams();
              setStarted(false);
              setPhase({ kind: "starting" });
              setTimeout(startCamera, 300);
            }}
            className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Restart Camera
          </Button>
        </div>
      )}

      {/* Tip */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
        <ScanLine className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <p>
          Hold the student's QR card in front of the camera. Each scan auto-marks <strong>Present</strong> and
          sends a Gmail notification to the parent if an email is saved in their record.
          After {CONFIRM_MS / 1000} seconds the scanner resets automatically.
        </p>
      </div>
    </div>
  );
}

function StatusCard({ children, color = "dark" }: { children: React.ReactNode; color?: "dark" | "red" | "green" }) {
  const bg = color === "red" ? "bg-red-950/90 border-red-800" : color === "green" ? "bg-green-950/90 border-green-800" : "bg-slate-900/90 border-slate-700";
  return <div className={`rounded-xl border ${bg} px-4 py-3 flex items-center gap-3 backdrop-blur`}>{children}</div>;
}

function StudentCard({ student, color, children }: { student: Student; color: "green" | "blue" | "red"; children: React.ReactNode }) {
  const bg = color === "green" ? "bg-green-950/95 border-green-700" : color === "red" ? "bg-red-950/95 border-red-700" : "bg-slate-900/95 border-slate-700";
  return (
    <div className={`rounded-xl border ${bg} p-4 backdrop-blur space-y-3`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center flex-shrink-0">
          <UserRound className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold leading-tight truncate">{student.studentName}</p>
          {student.fatherName && <p className="text-slate-400 text-xs truncate">S/O {student.fatherName}</p>}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{student.className} · {student.sectionName}</span>
            {student.vehicleName && <span className="flex items-center gap-1"><Bus className="h-3 w-3" />{student.vehicleName}</span>}
          </div>
        </div>
        <p className="text-amber-500 font-mono text-xs flex-shrink-0">{student.uniqueId}</p>
      </div>
      <div className="flex flex-col items-center gap-1 py-1">{children}</div>
    </div>
  );
}
