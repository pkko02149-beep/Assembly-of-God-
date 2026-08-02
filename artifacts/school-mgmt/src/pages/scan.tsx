import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { getAuthStatus, getAdminToken } from "@/lib/auth";
import { getToken } from "@/lib/jwt-api";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, Clock, ArrowLeft,
  Loader2, UserRound, Bus, BookOpen, RefreshCw, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: number;
  uniqueId: string;
  studentName: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  vehicleName?: string | null;
  tripName?: string | null;
  rollNo: number;
}

type Phase =
  | "fetching-student"
  | "auto-marking"
  | "marked-present"
  | "marked-absent"
  | "override"
  | "error-fetch"
  | "error-mark";

export default function ScanPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [student, setStudent] = useState<Student | null>(null);
  const [phase, setPhase] = useState<Phase>("fetching-student");
  const [markedAt, setMarkedAt] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const autoMarkFired = useRef(false);
  const isAdmin = getAuthStatus();
  const teacherToken = getToken("teacher");

  // Determine which auth token to use (admin takes priority)
  const authToken: string | null = isAdmin ? getAdminToken() : teacherToken;
  const isAuthenticated = !!(isAdmin || teacherToken);

  const params = new URLSearchParams(window.location.search);
  const uid = params.get("id") || "";
  const today = new Date().toISOString().slice(0, 10);
  const todayDisplay = new Date().toLocaleDateString("en-PK", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    // Block unauthenticated users — students cannot mark themselves present
    if (!isAuthenticated) return;

    if (!uid) {
      setFetchError("No student ID in the QR code. Please scan a valid QR.");
      setPhase("error-fetch");
      return;
    }
    fetch(`${base}/api/students/by-uid/${encodeURIComponent(uid)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Student not found." : "Server error");
        return res.json();
      })
      .then((data: Student) => {
        setStudent(data);
        if (!autoMarkFired.current) {
          autoMarkFired.current = true;
          markAttendance(data, "present");
        }
      })
      .catch((e) => { setFetchError(e.message); setPhase("error-fetch"); });
  }, [uid, isAuthenticated]);

  async function markAttendance(s: Student, status: "present" | "absent") {
    setPhase("auto-marking");
    try {
      const res = await fetch(`${base}/api/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ date: today, records: [{ studentId: s.id, status }] }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMarkedAt(new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }));
      setPhase(status === "present" ? "marked-present" : "marked-absent");
    } catch {
      setPhase("error-mark");
      toast({ title: "Failed to mark attendance", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <button onClick={() => setLocation("/")} className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <span className="text-xs text-slate-500">{todayDisplay}</span>
      </div>

      {/* Blocked: unauthenticated users cannot mark attendance */}
      {!isAuthenticated && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-amber-900/50 rounded-2xl p-8 text-center space-y-4">
            <Shield className="h-14 w-14 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Staff Login Required</h2>
            <p className="text-slate-400 text-sm">
              Attendance can only be marked by a teacher or admin. Students cannot mark their own attendance.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => setLocation("/teacher/login")}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                Teacher Login
              </Button>
              <Button
                onClick={() => setLocation("/login")}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Admin Login
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && <div className="flex-1 flex items-center justify-center p-4">
        {/* Loading student */}
        {phase === "fetching-student" && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
            <p className="text-sm">Looking up student…</p>
          </div>
        )}

        {/* Auto-marking spinner */}
        {phase === "auto-marking" && student && (
          <div className="max-w-sm w-full space-y-4">
            <StudentCard student={student} />
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-green-400" />
              <p className="text-slate-300 text-sm font-medium">Marking attendance…</p>
            </div>
          </div>
        )}

        {/* Error fetching student */}
        {phase === "error-fetch" && (
          <div className="max-w-sm w-full bg-slate-900 border border-red-900/50 rounded-2xl p-6 text-center space-y-3">
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-white">Not Found</h2>
            <p className="text-slate-400 text-sm">{fetchError}</p>
          </div>
        )}

        {/* ✅ Marked Present */}
        {phase === "marked-present" && student && (
          <div className="max-w-sm w-full space-y-4">
            <StudentCard student={student} />
            <div className="bg-green-950 border-2 border-green-600 rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
              <p className="text-2xl font-bold text-green-300">Present ✓</p>
              <p className="text-green-500 text-sm">Attendance recorded for today</p>
              {markedAt && (
                <p className="text-slate-400 text-sm flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Marked at {markedAt}
                </p>
              )}
              {/* Admin override option */}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("override")}
                  className="mt-1 border-red-700 text-red-400 hover:bg-red-950 hover:text-red-300"
                >
                  Override → Mark Absent
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ❌ Marked Absent */}
        {phase === "marked-absent" && student && (
          <div className="max-w-sm w-full space-y-4">
            <StudentCard student={student} />
            <div className="bg-red-950 border-2 border-red-700 rounded-2xl p-6 text-center space-y-3">
              <XCircle className="h-16 w-16 text-red-400 mx-auto" />
              <p className="text-2xl font-bold text-red-300">Absent</p>
              {markedAt && (
                <p className="text-slate-400 text-sm flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Marked at {markedAt}
                </p>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase("override")}
                  className="mt-1 border-green-700 text-green-400 hover:bg-green-950 hover:text-green-300"
                >
                  Override → Mark Present
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Admin override — manual choose */}
        {phase === "override" && student && isAdmin && (
          <div className="max-w-sm w-full space-y-4">
            <StudentCard student={student} />
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <p className="text-center text-slate-400 text-sm font-medium uppercase tracking-wide">
                Override Attendance
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => markAttendance(student, "present")}
                  className="h-14 text-base bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
                >
                  <CheckCircle2 className="h-5 w-5 mr-1.5" /> Present
                </Button>
                <Button
                  onClick={() => markAttendance(student, "absent")}
                  className="h-14 text-base bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  <XCircle className="h-5 w-5 mr-1.5" /> Absent
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error saving */}
        {phase === "error-mark" && student && (
          <div className="max-w-sm w-full space-y-4">
            <StudentCard student={student} />
            <div className="bg-red-950 border border-red-700 rounded-2xl p-5 text-center space-y-3">
              <p className="text-red-300 text-sm">Failed to save attendance. Check your connection.</p>
              <Button
                onClick={() => markAttendance(student, "present")}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}

function StudentCard({ student }: {
  student: { studentName: string; fatherName?: string; uniqueId: string; className: string; sectionName: string; vehicleName?: string | null; rollNo: number }
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center flex-shrink-0">
          <UserRound className="h-7 w-7 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white leading-tight">{student.studentName}</h2>
          {student.fatherName && <p className="text-slate-400 text-sm">S/O {student.fatherName}</p>}
          <p className="text-amber-500 font-mono text-xs mt-1">{student.uniqueId}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-white truncate">{student.className} · {student.sectionName}</span>
        </div>
        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <Bus className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-white truncate">{student.vehicleName || "No bus"}</span>
        </div>
      </div>
      <div className="text-xs text-center text-slate-500">Roll #{student.rollNo}</div>
    </div>
  );
}
