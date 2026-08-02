import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { getAuthStatus, getAdminToken } from "@/lib/auth";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Camera,
  CameraOff,
  Loader2,
  UserRound,
  Bus,
  BookOpen,
  Shield,
  ScanLine,
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

export default function ScannerPage() {
  const [, setLocation] = useLocation();
  const isAdmin = getAuthStatus();
  const adminToken = getAdminToken();

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<{ uid: string; time: number } | null>(null);
  const processingRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<ScanPhase>({ kind: "starting" });
  const today = new Date().toISOString().slice(0, 10);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const resetToScanning = useCallback(() => {
    processingRef.current = false;
    setPhase({ kind: "scanning" });
  }, []);

  const handleScannedUid = useCallback(
    async (uid: string) => {
      if (processingRef.current) return;
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.uid === uid &&
        now - lastScanRef.current.time < DEBOUNCE_MS
      ) {
        return;
      }
      processingRef.current = true;
      lastScanRef.current = { uid, time: now };

      setPhase({ kind: "looking-up", uid });

      let student: Student;
      try {
        const res = await fetch(
          `${base}/api/students/by-uid/${encodeURIComponent(uid)}`
        );
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
          headers: {
            "Content-Type": "application/json",
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
          body: JSON.stringify({
            date: today,
            records: [{ studentId: student.id, status: "present" }],
          }),
        });
        if (!res.ok) throw new Error("Failed to save");
        const time = new Date().toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setPhase({ kind: "confirmed", student, time });
        confirmTimerRef.current = setTimeout(resetToScanning, CONFIRM_MS);
      } catch {
        setPhase({ kind: "error-mark", student });
        confirmTimerRef.current = setTimeout(resetToScanning, CONFIRM_MS);
      }
    },
    [base, today, resetToScanning]
  );

  useEffect(() => {
    if (!isAdmin) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        if (devices.length === 0) {
          setPhase({ kind: "no-camera", message: "No camera detected on this device." });
          return;
        }

        setPhase({ kind: "scanning" });

        reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result, err) => {
            if (result) {
              handleScannedUid(result.getText());
            } else if (err && !(err instanceof NotFoundException)) {
              // NotFoundException is normal (no QR in frame yet), ignore it
            }
          }
        );
      })
      .catch((err) => {
        const msg =
          err?.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access."
            : err?.message ?? "Could not access camera.";
        setPhase({ kind: "no-camera", message: msg });
      });

    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [isAdmin, handleScannedUid]);

  const todayDisplay = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 z-10">
        <button
          onClick={() => setLocation("/admin")}
          className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Admin
        </button>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              phase.kind === "scanning" ? "bg-green-500 animate-pulse" : "bg-slate-600"
            }`}
          />
          <span className="text-xs text-slate-500">{todayDisplay}</span>
        </div>
      </div>

      {!isAdmin ? (
        /* Not logged in */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-amber-900/50 rounded-2xl p-8 text-center space-y-4">
            <Shield className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Admin Login Required</h2>
            <p className="text-slate-400 text-sm">
              The scanner mode is only available to admins.
            </p>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            >
              Sign In as Admin
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative">
          {/* Camera feed — always mounted so the stream starts */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            muted
            playsInline
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80 pointer-events-none" />

          {/* Scanner frame */}
          {(phase.kind === "scanning" || phase.kind === "starting") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                <div className="h-60 w-60 border-2 border-amber-400/70 rounded-2xl" />
                {/* Corner accents */}
                <div className="absolute top-0 left-0 h-6 w-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 h-6 w-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                {/* Scan line */}
                {phase.kind === "scanning" && (
                  <div className="absolute inset-x-2 top-0 animate-scan-line">
                    <div className="h-0.5 bg-amber-400/80 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status panel at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            {/* Starting */}
            {phase.kind === "starting" && (
              <StatusCard>
                <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                <p className="text-white font-medium">Starting camera…</p>
              </StatusCard>
            )}

            {/* Scanning */}
            {phase.kind === "scanning" && (
              <StatusCard>
                <ScanLine className="h-6 w-6 text-amber-400" />
                <p className="text-white font-medium">
                  Ready to scan — point at a student QR code
                </p>
              </StatusCard>
            )}

            {/* Looking up */}
            {phase.kind === "looking-up" && (
              <StatusCard>
                <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                <div>
                  <p className="text-white font-medium">Looking up student…</p>
                  <p className="text-slate-400 text-xs font-mono">{phase.uid}</p>
                </div>
              </StatusCard>
            )}

            {/* Marking */}
            {phase.kind === "marking" && (
              <StudentConfirmCard student={phase.student} color="blue">
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                <p className="text-blue-300 font-semibold text-lg">Marking present…</p>
              </StudentConfirmCard>
            )}

            {/* Confirmed ✓ */}
            {phase.kind === "confirmed" && (
              <StudentConfirmCard student={phase.student} color="green">
                <CheckCircle2 className="h-14 w-14 text-green-400" />
                <div className="text-center">
                  <p className="text-green-300 font-bold text-2xl">Present ✓</p>
                  <p className="text-slate-400 text-sm mt-0.5">{phase.time}</p>
                </div>
              </StudentConfirmCard>
            )}

            {/* Error — student not found */}
            {phase.kind === "error-student" && (
              <StatusCard color="red">
                <XCircle className="h-6 w-6 text-red-400" />
                <div>
                  <p className="text-red-300 font-medium">
                    {phase.message}
                  </p>
                  <p className="text-slate-500 text-xs font-mono">{phase.uid}</p>
                </div>
              </StatusCard>
            )}

            {/* Error — mark failed */}
            {phase.kind === "error-mark" && (
              <StudentConfirmCard student={phase.student} color="red">
                <XCircle className="h-10 w-10 text-red-400" />
                <p className="text-red-300 font-semibold">Failed to save — check connection</p>
              </StudentConfirmCard>
            )}

            {/* No camera */}
            {phase.kind === "no-camera" && (
              <StatusCard color="red">
                <CameraOff className="h-6 w-6 text-red-400" />
                <div>
                  <p className="text-red-300 font-medium">Camera unavailable</p>
                  <p className="text-slate-400 text-xs">{phase.message}</p>
                </div>
              </StatusCard>
            )}

            {/* Camera icon when scanning */}
            {(phase.kind === "scanning" || phase.kind === "starting") && (
              <div className="flex justify-center">
                <Camera className="h-5 w-5 text-slate-500" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper sub-components */

function StatusCard({
  children,
  color = "dark",
}: {
  children: React.ReactNode;
  color?: "dark" | "red" | "green";
}) {
  const bg =
    color === "red"
      ? "bg-red-950/90 border-red-800"
      : color === "green"
      ? "bg-green-950/90 border-green-800"
      : "bg-slate-900/90 border-slate-700";
  return (
    <div className={`rounded-2xl border ${bg} px-5 py-4 flex items-center gap-3 backdrop-blur`}>
      {children}
    </div>
  );
}

function StudentConfirmCard({
  student,
  color,
  children,
}: {
  student: Student;
  color: "green" | "blue" | "red";
  children: React.ReactNode;
}) {
  const bg =
    color === "green"
      ? "bg-green-950/95 border-green-700"
      : color === "red"
      ? "bg-red-950/95 border-red-700"
      : "bg-slate-900/95 border-slate-700";
  return (
    <div className={`rounded-2xl border ${bg} p-5 backdrop-blur space-y-4`}>
      {/* Student info row */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center flex-shrink-0">
          <UserRound className="h-6 w-6 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-lg leading-tight truncate">
            {student.studentName}
          </p>
          {student.fatherName && (
            <p className="text-slate-400 text-xs truncate">S/O {student.fatherName}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {student.className} · {student.sectionName}
            </span>
            {student.vehicleName && (
              <span className="flex items-center gap-1">
                <Bus className="h-3 w-3" />
                {student.vehicleName}
              </span>
            )}
          </div>
        </div>
        <p className="text-amber-500 font-mono text-xs flex-shrink-0">{student.uniqueId}</p>
      </div>
      {/* Status */}
      <div className="flex flex-col items-center gap-1 py-2">{children}</div>
    </div>
  );
}
