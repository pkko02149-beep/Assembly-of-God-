import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Teacher {
  id: number;
  classAssigned: number | null;
  className?: string;
  name: string;
}

interface Student {
  id: number;
  studentName: string;
  rollNo: number;
  classId: number;
}

interface FeePayment {
  id: number;
  studentId: number;
  categoryId: number;
  categoryName: string;
  amount: string;
  paidAmount: string;
  discount: string;
  status: string;
  month: number;
  year: number;
  session: string;
  isPreviousDue: boolean;
}

interface FeeStructure {
  id: number;
  classId: number;
  categoryId: number;
  categoryName?: string;
  amount: string;
  session: string;
}

// ─── Session helpers ─────────────────────────────────────────────────────────

const SESSION_MONTHS = [
  { month: 4, label: "Apr" }, { month: 5, label: "May" }, { month: 6, label: "Jun" },
  { month: 7, label: "Jul" }, { month: 8, label: "Aug" }, { month: 9, label: "Sep" },
  { month: 10, label: "Oct" }, { month: 11, label: "Nov" }, { month: 12, label: "Dec" },
  { month: 1, label: "Jan" }, { month: 2, label: "Feb" }, { month: 3, label: "Mar" },
];

function getCurrentSession() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
}

function getStartYear(session: string) {
  return parseInt(session.split("-")[0]);
}

function getMonthYear(month: number, startYear: number) {
  return month >= 4 ? startYear : startYear + 1;
}

// ─── Per-student data helpers ────────────────────────────────────────────────

function useStudentFee(
  studentId: number,
  payments: FeePayment[],
  structures: FeeStructure[],
  session: string,
) {
  const startYear = getStartYear(session);
  const today = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  }, []);

  const myPayments = useMemo(
    () => payments.filter(p => p.studentId === studentId),
    [payments, studentId],
  );

  function isMonthInFuture(month: number) {
    const mYear = getMonthYear(month, startYear);
    return new Date(mYear, month - 1, 1) > today;
  }

  function getMonthStatus(month: number): "paid" | "partial" | "pending" | "none" {
    if (isMonthInFuture(month)) return "none";
    const mYear = getMonthYear(month, startYear);
    const mp = myPayments.filter(p => p.month === month && p.year === mYear && !p.isPreviousDue);
    if (mp.length === 0) return structures.length > 0 ? "pending" : "none";
    if (mp.every(p => p.status === "paid")) return "paid";
    if (mp.some(p => parseFloat(p.paidAmount) > 0)) return "partial";
    return "pending";
  }

  function hasMonthCF(month: number) {
    const mYear = getMonthYear(month, startYear);
    return myPayments.some(p => p.month === month && p.year === mYear && p.isPreviousDue === true && p.month !== 0);
  }

  function getMonthTotal(month: number) {
    if (isMonthInFuture(month)) return 0;
    const mYear = getMonthYear(month, startYear);
    return myPayments
      .filter(p => p.month === month && p.year === mYear && !p.isPreviousDue)
      .reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);
  }

  const prevDue = myPayments
    .filter(p => p.isPreviousDue && (!p.month || p.month === 0))
    .reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);

  const totalDue = myPayments
    .filter(p => {
      if (p.isPreviousDue) return false;
      const mYear = getMonthYear(p.month, startYear);
      return new Date(mYear, p.month - 1, 1) <= today;
    })
    .reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0) + prevDue;

  const totalPaid = myPayments.reduce((s, p) => s + parseFloat(p.paidAmount), 0);
  const balance = totalDue - totalPaid;

  return { getMonthStatus, hasMonthCF, getMonthTotal, prevDue, totalDue, totalPaid, balance };
}

// ─── Month cell component ────────────────────────────────────────────────────

function MonthCell({
  status,
  cf,
}: {
  status: "paid" | "partial" | "pending" | "none";
  cf: boolean;
}) {
  if (status === "none")
    return <td className="px-1 py-3 text-center text-slate-300 text-xs">—</td>;

  if (status === "paid") {
    return cf ? (
      <td className="px-1 py-2 text-center bg-orange-50">
        <span className="inline-flex flex-col items-center leading-tight">
          <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-orange-600 font-bold text-[9px] tracking-tight">CF</span>
        </span>
      </td>
    ) : (
      <td className="px-1 py-3 text-center">
        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
      </td>
    );
  }

  if (status === "partial") {
    return cf ? (
      <td className="px-1 py-2 text-center bg-orange-50">
        <span className="inline-flex flex-col items-center leading-tight">
          <span className="text-orange-500 font-bold text-sm leading-none">~</span>
          <span className="text-orange-600 font-bold text-[9px] tracking-tight">CF</span>
        </span>
      </td>
    ) : (
      <td className="px-1 py-3 text-center">
        <span className="text-orange-500 font-bold text-sm">~</span>
      </td>
    );
  }

  // pending
  return (
    <td className="px-1 py-3 text-center">
      <X className="w-4 h-4 text-red-500 mx-auto" />
    </td>
  );
}

// ─── Per-student row ─────────────────────────────────────────────────────────

function StudentRow({
  student,
  payments,
  structures,
  session,
}: {
  student: Student;
  payments: FeePayment[];
  structures: FeeStructure[];
  session: string;
}) {
  const { getMonthStatus, hasMonthCF, prevDue, balance } =
    useStudentFee(student.id, payments, structures, session);

  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="px-3 py-3 font-semibold text-slate-800 sticky left-0 bg-white z-10 min-w-[130px]">
        <span>{student.studentName}</span>
        <span className="block text-xs font-normal text-slate-400">Roll {student.rollNo}</span>
      </td>
      <td className="px-2 py-3 text-center">
        {prevDue > 0 ? (
          <span className="text-amber-700 font-medium">₹{prevDue.toFixed(0)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      {SESSION_MONTHS.map(m => (
        <MonthCell
          key={m.month}
          status={getMonthStatus(m.month)}
          cf={hasMonthCF(m.month)}
        />
      ))}
      <td className={`px-3 py-3 text-right font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
        {balance > 0 ? `₹${balance.toFixed(0)}` : "✓ Clear"}
      </td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeacherFir() {
  const [, navigate] = useLocation();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(getCurrentSession);

  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [t, sessionStatus] = await Promise.all([
        teacherApi.get<Teacher>("/auth/teacher/me"),
        fetch("/api/academic-sessions/status").then(async response => {
          if (!response.ok) return null;
          return response.json() as Promise<{ currentSession?: { name?: string } | null }>;
        }),
      ]);
      const activeSession = sessionStatus?.currentSession?.name || getCurrentSession();
      setSession(activeSession);
      setTeacher(t);

      if (t.classAssigned) {
        const [studs, pays, structs] = await Promise.all([
          teacherApi.get<Student[]>(`/students?classId=${t.classAssigned}`),
          teacherApi.get<FeePayment[]>(
            `/fees/payments?classId=${t.classAssigned}&session=${encodeURIComponent(activeSession)}`
          ),
          teacherApi.get<FeeStructure[]>(
            `/fees/structures?classId=${t.classAssigned}&session=${encodeURIComponent(activeSession)}`
          ),
        ]);
        // Sort students by roll number
        setStudents([...studs].sort((a, b) => a.rollNo - b.rollNo));
        setPayments(Array.isArray(pays) ? pays : []);
        setStructures(Array.isArray(structs) ? structs : []);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <TeacherLayout title="FIR Register">
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </TeacherLayout>
    );
  }

  if (!teacher?.classAssigned) {
    return (
      <TeacherLayout title="FIR Register">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <p>No class assigned to your account yet.</p>
            <p className="text-xs mt-2">Contact the admin to assign a class.</p>
          </CardContent>
        </Card>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="FIR Register">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Fee Information Register (FIR)</h2>
            <p className="text-sm text-slate-500">
              Session {session} · Class {teacher.className || teacher.classAssigned} ·{" "}
              {students.length} student{students.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* CF legend */}
        <p className="text-xs text-orange-600 bg-orange-50 rounded px-3 py-1.5 inline-block">
          CF = Carry Forward &nbsp;·&nbsp; Amounts in orange = paid via carry-forward from previous partial month
        </p>

        {/* Table */}
        {students.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center text-slate-400">
              <p>No students are currently assigned to your class.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {!payments.length && !structures.length && (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                No fee records or fee structure have been entered for session {session} yet. The assigned student list is shown below.
              </p>
            )}
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[860px]">
                  <thead>
                    <tr className="bg-indigo-50 border-b border-indigo-100">
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-indigo-50 z-10">Student</th>
                      <th className="text-center px-2 py-2.5 font-semibold text-amber-700 min-w-[56px]">Prev Due</th>
                      {SESSION_MONTHS.map(m => (
                        <th key={m.month} className="text-center px-1 py-2.5 font-semibold text-slate-600 min-w-[32px]">
                          {m.label}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2.5 font-semibold text-red-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(s => (
                      <StudentRow
                        key={s.id}
                        student={s}
                        payments={payments}
                        structures={structures}
                        session={session}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
