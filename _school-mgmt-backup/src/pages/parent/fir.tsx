import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, X, AlertCircle, IndianRupee, ShoppingCart, CheckCheck, Zap, Download } from "lucide-react";
import { getPrevYearDueMonthsAll } from "@/lib/prev-year-due";
import { generateReceiptPdf } from "@/lib/receipt";

interface FeePayment {
  id: number;
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
  receiptNo?: string;
  paymentDate?: string | null;
  paymentMethod?: string;
}

interface FeeStructure {
  id: number;
  classId: number;
  categoryId: number;
  categoryName?: string;
  amount: string | number;
  frequency?: string;
  session: string;
}

interface Student {
  studentId: number;
  studentName: string;
  classId: number | null;
  previousYearDue?: string | null;
  previousYearDueRemarks?: string | null;
  hasVehicle?: boolean | null;
  transportRouteId?: number | null;
  transportFromMonth?: number | null;
  transportStopMonth?: number | null;
  transportRoutePricePerMonth?: number | null;
  studentType?: string | null;
  admissionDate?: string | null;
}

const SESSION_MONTHS = [
  { month: 4, label: "Apr" }, { month: 5, label: "May" }, { month: 6, label: "Jun" },
  { month: 7, label: "Jul" }, { month: 8, label: "Aug" }, { month: 9, label: "Sep" },
  { month: 10, label: "Oct" }, { month: 11, label: "Nov" }, { month: 12, label: "Dec" },
  { month: 1, label: "Jan" }, { month: 2, label: "Feb" }, { month: 3, label: "Mar" },
];

// School-year index (0=Apr … 11=Mar) — matches admin fees-tab frequency logic
const SCHOOL_YEAR_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
function schoolYearIdx(month: number) { return SCHOOL_YEAR_ORDER.indexOf(month); }

/** Calendar-year fallback used only until the API responds */
function getCurrentSession() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function getStartYear(session: string) { return parseInt(session.split("-")[0]); }
function getMonthYear(month: number, startYear: number) { return month >= 4 ? startYear : startYear + 1; }

// Load Razorpay checkout script
function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function ParentFir() {
  const [, navigate] = useLocation();
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment state
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  // Individual previous-year-due month boxes selected for payment. -1 is a
  // sentinel used when there is no monthly breakdown (a single lump box).
  const [selectedPrevDueMonths, setSelectedPrevDueMonths] = useState<Set<number>>(new Set());
  function togglePrevDueMonth(month: number) {
    setSelectedPrevDueMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [razorpayConfigured, setRazorpayConfigured] = useState(false);

  // Session: start with calendar-year fallback, then sync to the real API value
  const [session, setSession] = useState(getCurrentSession);
  const startYear = getStartYear(session);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    loadRazorpayScript();
    fetch("/api/settings/razorpay/status")
      .then(r => r.json())
      .then(d => setRazorpayConfigured(!!d.configured))
      .catch(() => {});
    // Fetch real academic session from API
    fetch("/api/academic-sessions/status")
      .then(r => r.json())
      .then((d: { currentSession?: { name: string } | null }) => {
        if (d?.currentSession?.name) setSession(d.currentSession.name);
      })
      .catch(() => {});
    loadParent();
  }, []);

  // Re-load fees when either the student or the session changes
  useEffect(() => { if (selectedStudentId) { loadFees(); setSelectedMonths(new Set()); } }, [selectedStudentId, session]);

  async function loadParent() {
    try {
      const p = await parentApi.get<{ id: number; students: Student[] }>("/auth/parent/me");
      setStudents(p.students || []);
      if (p.students?.length > 0) {
        const first = p.students[0];
        setSelectedStudentId(first.studentId);
        setSelectedStudentName(first.studentName);
        setSelectedClassId(first.classId ?? null);
      }
    } catch { navigate("/parent/login"); }
    finally { setLoading(false); }
  }

  async function loadFees() {
    if (!selectedStudentId) return;
    try {
      const student = students.find(s => s.studentId === selectedStudentId);
      const classId = student?.classId ?? selectedClassId;
      const [data, structs] = await Promise.all([
        parentApi.get<FeePayment[]>(`/fees/payments?studentId=${selectedStudentId}&session=${encodeURIComponent(session)}`),
        classId
          ? fetch(`/api/fees/structures?classId=${classId}&session=${encodeURIComponent(session)}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("parent_token")}` },
            }).then(r => r.ok ? r.json() : [] as FeeStructure[])
          : Promise.resolve([] as FeeStructure[]),
      ]);
      setPayments(data);
      setStructures(structs);
    } catch { setPayments([]); setStructures([]); }
  }

  function monthKey(month: number) {
    return `${month}-${getMonthYear(month, startYear)}`;
  }

  function isMonthInFuture(month: number): boolean {
    const mYear = getMonthYear(month, startYear);
    return new Date(mYear, month - 1, 1) > today;
  }

  /** Sum of all carry-forward payments that cleared the balance for a given month (isPreviousDue records). */
  function getMonthCFPaid(month: number, mYear: number): number {
    return payments
      .filter(p => p.month === month && p.year === mYear && p.isPreviousDue === true)
      .reduce((s, p) => s + parseFloat(p.paidAmount || "0"), 0);
  }

  /**
   * Tuition-only structures (excludes transport/bus/admission categories).
   * Mirrors admin's `tuitionStructs` filter so we can handle transport and
   * admission separately — exactly as the admin fee collection page does.
   */
  const tuitionStructs = structures.filter(st => {
    const cn = (st.categoryName ?? "").toLowerCase();
    return !cn.includes("transport") && !cn.includes("bus") && !cn.includes("admission");
  });

  /**
   * Tuition/non-transport/non-admission structures — frequency-aware total for a given month.
   * Mirrors admin tuitionAmountByMonthIdx logic.
   */
  function structureDueForMonth(month: number): number {
    const idx = schoolYearIdx(month); // 0=Apr … 11=Mar
    return tuitionStructs.reduce((s, st) => {
      const amt = parseFloat(String(st.amount) || "0");
      const freq = (st.frequency || "monthly").toLowerCase();
      if (freq === "monthly")   return s + amt;
      if (freq === "quarterly") return idx % 3 === 0 ? s + amt : s;
      if (freq === "annually")  return idx === 0 ? s + amt : s;
      if (freq === "one-time")  return idx === 0 ? s + amt : s;
      return s + amt;
    }, 0);
  }

  /**
   * Transport fee for a given month — mirrors admin's per-month transport logic.
   * Uses the student's assigned route price (not fee structures).
   */
  function getTransportForMonth(month: number): number {
    if (!selectedStudent?.hasVehicle || !selectedStudent?.transportRoutePricePerMonth) return 0;
    const fromMonth = selectedStudent.transportFromMonth ?? 4;
    const stopMonth = selectedStudent.transportStopMonth ?? null;
    const fromIdx = SCHOOL_YEAR_ORDER.indexOf(fromMonth);
    const mIdx = schoolYearIdx(month);
    if (fromIdx < 0 || mIdx < fromIdx) return 0;
    if (stopMonth !== null) {
      const stopIdx = SCHOOL_YEAR_ORDER.indexOf(stopMonth);
      if (stopIdx >= 0 && mIdx >= stopIdx) return 0;
    }
    return parseFloat(String(selectedStudent.transportRoutePricePerMonth)) || 0;
  }

  /**
   * Admission fee for a given month — only for "New" students, only in April (school-year idx 0).
   * Mirrors admin's thisMonthAdmFee logic.
   */
  function getAdmissionForMonth(month: number): number {
    if (schoolYearIdx(month) !== 0) return 0;
    // Promotion/detention/drop append an action suffix to the original type
    // (for example, New/Promoted). The admission fee still belongs to that
    // student, so identify the base type rather than requiring an exact match.
    const isNew = (selectedStudent?.studentType ?? "").toLowerCase().trim().includes("new");
    if (!isNew) return 0;
    const admStruct = structures.find(st => (st.categoryName ?? "").toLowerCase().includes("admission"));
    if (!admStruct) return 0;
    const alreadyPaid = payments.some(p => p.categoryId === admStruct.categoryId && !p.isPreviousDue);
    return alreadyPaid ? 0 : parseFloat(String(admStruct.amount)) || 0;
  }

  function getMonthStatus(month: number): "paid" | "partial" | "pending" | "none" {
    if (isMonthInFuture(month)) return "none";
    const mYear = getMonthYear(month, startYear);
    const mp = payments.filter(p => p.month === month && p.year === mYear && !p.isPreviousDue);
    if (mp.length === 0) {
      // No payment records yet — only show as pending if something is actually due
      // this month according to the frequency schedule
      const due = structureDueForMonth(month) + getTransportForMonth(month) + getAdmissionForMonth(month);
      return due > 0 ? "pending" : "none";
    }
    // All records explicitly marked paid
    if (mp.every(p => p.status === "paid")) return "paid";
    // Even if records are "partial", the remaining balance may have been
    // collected via carry-forward (isPreviousDue records) — treat as fully paid
    const total = mp.reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);
    const directPaid = mp.reduce((s, p) => s + parseFloat(p.paidAmount || "0"), 0);
    const cfPaid = getMonthCFPaid(month, mYear);
    if (total - directPaid - cfPaid <= 0) return "paid";
    if (mp.some(p => parseFloat(p.paidAmount) > 0)) return "partial";
    return "pending";
  }

  function hasMonthCF(month: number): boolean {
    const mYear = getMonthYear(month, startYear);
    return payments.some(p => p.month === month && p.year === mYear && p.isPreviousDue === true && p.month !== 0);
  }

  function getMonthTotal(month: number): number {
    if (isMonthInFuture(month)) return 0;
    const mYear = getMonthYear(month, startYear);
    const monthPmts = payments.filter(p => p.month === month && p.year === mYear && !p.isPreviousDue);
    if (monthPmts.length > 0) {
      return monthPmts.reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);
    }
    // Fall back to tuition structures + transport (from student route) + admission fee
    return structureDueForMonth(month) + getTransportForMonth(month) + getAdmissionForMonth(month);
  }

  function getMonthBalance(month: number): number {
    const status = getMonthStatus(month);
    if (status === "paid") return 0;
    const mYear = getMonthYear(month, startYear);
    const monthPmts = payments.filter(p => p.month === month && p.year === mYear && !p.isPreviousDue);
    if (monthPmts.length > 0) {
      const total = monthPmts.reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);
      const directPaid = monthPmts.reduce((s, p) => s + parseFloat(p.paidAmount || "0"), 0);
      const cfPaid = getMonthCFPaid(month, mYear);
      return Math.max(0, total - directPaid - cfPaid);
    }
    // Fall back to tuition structures + transport (from student route) + admission fee
    return structureDueForMonth(month) + getTransportForMonth(month) + getAdmissionForMonth(month);
  }

  function isMonthSelectable(month: number): boolean {
    const status = getMonthStatus(month);
    return status === "pending" || status === "partial";
  }

  function downloadMonthReceipt(month: number) {
    if (!selectedStudent) return;
    const mYear = getMonthYear(month, startYear);
    // Include carry-forward settlement records (isPreviousDue rows tagged with
    // this specific month/year) so a month cleared via CF top-up still shows
    // its full paid total on the receipt, not just the direct payment portion.
    const monthPmts = payments.filter(p => p.month === month && p.year === mYear);
    if (monthPmts.length === 0) return;
    const receiptNo = monthPmts.find(p => p.receiptNo)?.receiptNo || `RCP-${monthPmts[0].id}`;
    generateReceiptPdf({
      studentName: selectedStudentName || selectedStudent.studentName,
      receiptNo,
      paymentDate: monthPmts[0].paymentDate,
      paymentMethod: monthPmts[0].paymentMethod,
      payments: monthPmts,
    });
  }

  function downloadPrevDueMonthReceipt(month: number, label: string, originalAmount: number) {
    if (!selectedStudent) return;
    // Previous-year-due payments are recorded as a lump sum (month: 0, isPreviousDue: true),
    // not per specific month, so build a synthetic line item for this month's due
    // using the receipt/date/method from the underlying lump payment record(s).
    const prevDuePmts = payments.filter(p => p.isPreviousDue && (!p.month || p.month === 0));
    if (prevDuePmts.length === 0) return;
    const receiptNo = prevDuePmts.find(p => p.receiptNo)?.receiptNo || `RCP-${prevDuePmts[0].id}`;
    generateReceiptPdf({
      studentName: selectedStudentName || selectedStudent.studentName,
      receiptNo,
      paymentDate: prevDuePmts[0].paymentDate,
      paymentMethod: prevDuePmts[0].paymentMethod,
      payments: [{
        categoryId: 0,
        categoryName: `Previous Year Due — ${label}`,
        amount: originalAmount,
        discount: 0,
        paidAmount: originalAmount,
        month: 0,
        year: 0,
      }],
      fileName: `Receipt-PrevDue-${label}-${(selectedStudentName || selectedStudent.studentName).replace(/\s+/g, "-")}`,
    });
  }

  function toggleMonth(month: number) {
    if (!isMonthSelectable(month)) return;
    const key = monthKey(month);
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllUnpaid() {
    const keys = SESSION_MONTHS
      .filter(m => isMonthSelectable(m.month))
      .map(m => monthKey(m.month));
    setSelectedMonths(new Set(keys));
    if (prevDueRemaining > 0) {
      setSelectedPrevDueMonths(new Set(prevYearDueMonths.length > 0 ? prevYearDueMonths.map(m => m.month) : [-1]));
    }
  }

  function clearSelection() { setSelectedMonths(new Set()); setSelectedPrevDueMonths(new Set()); }

  // prevDue constants must be declared BEFORE totalPayable, which references
  // prevDueRemaining in its ternary. If declared after, the ternary branch that
  // reads prevDueRemaining would hit the TDZ and crash the component the moment
  // includePrevDue becomes true.
  const selectedStudent = students.find(s => s.studentId === selectedStudentId);
  const prevYearDueTotal = parseFloat(String(selectedStudent?.previousYearDue || "0")) || 0;
  const prevYearDuePaidSoFar = payments
    .filter(p => p.isPreviousDue && (!p.month || p.month === 0))
    .reduce((s, p) => s + parseFloat(p.paidAmount || "0"), 0);
  const prevDueRemaining = Math.max(0, prevYearDueTotal - prevYearDuePaidSoFar);
  const prevYearDueMonthsAll = getPrevYearDueMonthsAll(selectedStudent?.previousYearDueRemarks, prevYearDuePaidSoFar);
  const prevYearDueMonths = prevYearDueMonthsAll.filter(m => !m.paid);
  const includePrevDue = selectedPrevDueMonths.size > 0;
  const prevDueSelectedAmount = prevYearDueMonths.length > 0
    ? prevYearDueMonths.filter(m => selectedPrevDueMonths.has(m.month)).reduce((s, m) => s + m.amount, 0)
    : (selectedPrevDueMonths.has(-1) ? prevDueRemaining : 0);

  const selectionTotal = Array.from(selectedMonths).reduce((sum, key) => {
    const [monthStr] = key.split("-");
    return sum + getMonthBalance(parseInt(monthStr));
  }, 0);
  const totalPayable = selectionTotal + prevDueSelectedAmount;

  async function handlePayNow() {
    if ((selectedMonths.size === 0 && !includePrevDue) || !selectedStudentId || !selectedClassId) return;
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      alert("Could not load payment gateway. Please check your internet connection and try again.");
      return;
    }

    setPaying(true);
    try {
      const selections = Array.from(selectedMonths).map(key => {
        const [m, y] = key.split("-").map(Number);
        return { month: m, year: y };
      });

      const prevDueMonths = Array.from(selectedPrevDueMonths).filter(m => m !== -1);

      const order = await parentApi.post<{ orderId: string; keyId: string; amount: number; currency: string }>(
        "/fees/payments/online-order",
        { studentId: selectedStudentId, classId: selectedClassId, selections, session, includePrevDue, prevDueMonths }
      );

      const RazorpayCheckout = (window as any).Razorpay;
      const rzp = new RazorpayCheckout({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "School Fee Payment",
        description: `${selections.length} month(s) — ${selectedStudentName}`,
        prefill: { name: selectedStudentName },
        theme: { color: "#0f766e" },
        handler: async (response: any) => {
          try {
            await parentApi.post("/fees/payments/online-verify", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              studentId: selectedStudentId,
              classId: selectedClassId,
              selections,
              session,
              includePrevDue,
            });
            setPaymentSuccess(response.razorpay_payment_id);
            setSelectedMonths(new Set());
            setSelectedPrevDueMonths(new Set());
            await loadFees();
          } catch (err: any) {
            alert("Payment was completed but verification failed. Please contact the school with your payment ID: " + response.razorpay_payment_id);
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
    } catch (err: any) {
      alert(err.message || "Failed to initiate payment. Please try again.");
      setPaying(false);
    }
  }

  // ─── FIR table helpers ───────────────────────────────────────────────────
  // Note: selectedStudent, prevYearDueTotal, prevYearDuePaidSoFar, prevDueRemaining
  // are declared above (before totalPayable) to avoid TDZ crashes.

  // Generated Due Amount: sum of monthly fee amounts for non-future months.
  // Uses getMonthTotal() so it falls back to fee structures when no payment records exist.
  const generatedDue = SESSION_MONTHS
    .filter(m => !isMonthInFuture(m.month))
    .reduce((s, m) => s + getMonthTotal(m.month), 0);

  // Overall balance = (generated monthly dues + full prev-year due) − everything paid
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.paidAmount), 0);
  const balance = generatedDue + prevYearDueTotal - totalPaid;

  function MonthCell({ month }: { month: number }) {
    const status = getMonthStatus(month);
    const cf = hasMonthCF(month);
    if (status === "none") return <td className="px-1 py-3 text-center text-slate-300 text-xs">—</td>;
    if (status === "paid") {
      return cf
        ? <td className="px-1 py-2 text-center bg-orange-50"><span className="inline-flex flex-col items-center leading-tight"><CheckCircle2 className="w-3.5 h-3.5 text-orange-500" /><span className="text-orange-600 font-bold text-[9px] tracking-tight">CF</span></span></td>
        : <td className="px-1 py-3 text-center"><CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /></td>;
    }
    if (status === "partial") {
      return cf
        ? <td className="px-1 py-2 text-center bg-orange-50"><span className="inline-flex flex-col items-center leading-tight"><span className="text-orange-500 font-bold text-sm leading-none">~</span><span className="text-orange-600 font-bold text-[9px] tracking-tight">CF</span></span></td>
        : <td className="px-1 py-3 text-center"><span className="text-orange-500 font-bold text-sm">~</span></td>;
    }
    return <td className="px-1 py-3 text-center"><X className="w-4 h-4 text-red-500 mx-auto" /></td>;
  }

  const hasAnyFeeRecord = payments.length > 0 || structures.length > 0;
  const unpaidCount = SESSION_MONTHS.filter(m => isMonthSelectable(m.month)).length;

  if (loading) return <ParentLayout title="FIR Register"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div></ParentLayout>;

  return (
    <ParentLayout title="FIR Register">
      {/* ─── Header ─── */}
      <div className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Fee Information Register (FIR)</h2>
            <p className="text-sm text-slate-500">Session {session} · {payments.filter(p => !p.isPreviousDue).length} records</p>
          </div>
          {students.length > 1 && (
            <select
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white"
              value={selectedStudentId ?? ""}
              onChange={e => {
                const id = parseInt(e.target.value);
                const student = students.find(s => s.studentId === id);
                setSelectedStudentId(id);
                setSelectedStudentName(student?.studentName || "");
                setSelectedClassId(student?.classId ?? null);
              }}
            >
              {students.map(s => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
            </select>
          )}
        </div>
        <p className="text-xs text-orange-600 bg-orange-50 rounded px-3 py-1.5 mt-2 inline-block">
          CF = Carry Forward &nbsp;·&nbsp; Amounts in orange = paid via carry-forward from previous partial month
        </p>
      </div>

      {/* ─── FIR Summary Table ─── */}
      {!hasAnyFeeRecord ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <p>No fee records for session {session}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[780px]">
              <thead>
                <tr className="bg-indigo-50 border-b border-indigo-100">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-700">Student</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-amber-700 min-w-[56px]">Prev Due</th>
                  {SESSION_MONTHS.map(m => (
                    <th key={m.month} className="text-center px-1 py-2.5 font-semibold text-slate-600 min-w-[32px]">{m.label}</th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-700 min-w-[110px]">
                    <div>Generated Due</div>
                    <div className="text-[10px] font-normal text-slate-400">(monthly + prev yr)</div>
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold text-green-700">Paid</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-red-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold text-slate-800">{selectedStudentName}</td>
                  <td className="px-2 py-3 text-center">
                    {prevDueRemaining > 0 ? <span className="text-amber-700 font-medium">₹{prevDueRemaining.toFixed(0)}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  {SESSION_MONTHS.map(m => <MonthCell key={m.month} month={m.month} />)}
                  <td className="px-3 py-3 text-right">
                    <div className="font-bold text-slate-800">₹{(generatedDue + prevYearDueTotal).toFixed(0)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Monthly: ₹{generatedDue.toFixed(0)}</div>
                    {prevYearDueTotal > 0 && (
                      <div className="text-[10px] text-amber-600 mt-0.5">Prev Yr: ₹{prevYearDueTotal.toFixed(0)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-green-600">₹{totalPaid.toFixed(0)}</td>
                  <td className={`px-3 py-3 text-right font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {balance > 0 ? `₹${balance.toFixed(0)}` : "✓ Clear"}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                  <td className="px-3 py-2.5 text-slate-600">Total (1 student)</td>
                  <td className="px-2 py-2.5 text-center text-amber-700">{prevDueRemaining > 0 ? `₹${prevDueRemaining.toFixed(0)}` : "—"}</td>
                  {SESSION_MONTHS.map(m => {
                    const t = getMonthTotal(m.month);
                    return <td key={m.month} className="px-1 py-2.5 text-center text-slate-500">{t > 0 ? `₹${t.toFixed(0)}` : "—"}</td>;
                  })}
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-bold text-slate-800">₹{(generatedDue + prevYearDueTotal).toFixed(0)}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Monthly: ₹{generatedDue.toFixed(0)}</div>
                    {prevYearDueTotal > 0 && (
                      <div className="text-[10px] text-amber-600 mt-0.5">Prev Yr: ₹{prevYearDueTotal.toFixed(0)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-700">₹{totalPaid.toFixed(0)}</td>
                  <td className={`px-3 py-2.5 text-right ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {balance > 0 ? `₹${balance.toFixed(0)}` : "✓ Clear"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Online Payment Section ─── */}
      {hasAnyFeeRecord && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Pay Online via UPI</h3>
              <p className="text-xs text-slate-500">Select the months you want to pay, then click Pay Now</p>
            </div>
          </div>

          {/* Payment Success Banner */}
          {paymentSuccess && (
            <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Payment Successful!</p>
                <p className="text-xs text-green-700 mt-0.5">Payment ID: <span className="font-mono">{paymentSuccess}</span></p>
                <p className="text-xs text-green-600 mt-0.5">A receipt has been sent to your registered email. The fee register has been updated.</p>
              </div>
              <button onClick={() => setPaymentSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!razorpayConfigured ? (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <p>Online payment is not set up yet. Please contact the school office or pay in person.</p>
            </div>
          ) : (
            <>
              {/* Summary bar + action buttons */}
              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  {totalPayable === 0 ? (
                    <p className="text-sm text-slate-500">Select months or previous year due below to pay</p>
                  ) : (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-700">
                        {selectedMonths.size > 0 && `${selectedMonths.size} month${selectedMonths.size > 1 ? "s" : ""}`}
                        {selectedMonths.size > 0 && includePrevDue && " + "}
                        {includePrevDue && "Prev Due"}
                        {" selected"}
                      </span>
                      <span className="text-lg font-bold text-teal-700">₹{totalPayable.toFixed(0)}</span>
                      <button onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(unpaidCount > 0 || prevDueRemaining > 0) && (
                    <button
                      onClick={selectAllUnpaid}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Pay All Unpaid{unpaidCount > 0 ? ` (${unpaidCount})` : ""}
                    </button>
                  )}
                  <button
                    onClick={handlePayNow}
                    disabled={totalPayable === 0 || paying}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:text-slate-400 text-white transition-colors"
                  >
                    {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</> : <><ShoppingCart className="w-4 h-4" /> Pay Now</>}
                  </button>
                </div>
              </div>

              {/* Previous Year Due boxes — stay visible after payment, showing a Paid/Unpaid badge instead of disappearing */}
              {prevYearDueTotal > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous Year Due</p>
                    {prevDueRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPrevDueMonths(prev =>
                          prev.size > 0 ? new Set() : new Set(prevYearDueMonths.length > 0 ? prevYearDueMonths.map(m => m.month) : [-1])
                        )}
                        className={[
                          "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border-2 transition-all select-none",
                          includePrevDue
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-amber-300 bg-white text-amber-700 hover:border-amber-400",
                        ].join(" ")}
                      >
                        {includePrevDue && <CheckCheck className="w-3 h-3" />}
                        {includePrevDue ? "Clear" : `Select all ₹${prevDueRemaining.toFixed(0)}`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {prevYearDueMonthsAll.length > 0 ? (
                      prevYearDueMonthsAll.map(({ month, label, amount, originalAmount, paid }) => {
                        const isSelected = selectedPrevDueMonths.has(month);
                        return (
                          <div
                            key={month}
                            onClick={() => !paid && togglePrevDueMonth(month)}
                            className={[
                              "rounded-xl border-2 px-3 py-2.5 transition-all select-none",
                              paid ? "border-green-200 bg-green-50 cursor-default" :
                              isSelected
                                ? "border-amber-500 bg-amber-50 shadow-sm shadow-amber-100 cursor-pointer"
                                : "border-amber-200 bg-amber-50/60 hover:border-amber-400 cursor-pointer",
                            ].join(" ")}
                          >
                            <p className={`text-xs font-semibold truncate ${paid ? "text-green-800" : "text-amber-800"}`}>{label}</p>
                            <p className={`text-sm font-bold ${paid ? "text-green-700 line-through opacity-60" : "text-amber-700"}`}>₹{(paid ? originalAmount : amount).toFixed(0)}</p>
                            <span className={`inline-block mt-1 text-[9px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 ${paid ? "text-white bg-green-500" : "text-red-700 bg-red-100"}`}>
                              {paid ? "PAID" : "UNPAID"}
                            </span>
                            {paid && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); downloadPrevDueMonthReceipt(month, label, originalAmount); }}
                                className="mt-1 flex items-center justify-center gap-0.5 w-full text-[9px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full px-1.5 py-0.5 transition-colors"
                              >
                                <Download className="w-2.5 h-2.5" /> Receipt
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div
                        onClick={() => prevDueRemaining > 0 && togglePrevDueMonth(-1)}
                        className={[
                          "rounded-xl border-2 px-3 py-2.5 transition-all select-none col-span-3 sm:col-span-4",
                          prevDueRemaining <= 0 ? "border-green-200 bg-green-50 cursor-default" :
                          selectedPrevDueMonths.has(-1)
                            ? "border-amber-500 bg-amber-50 shadow-sm shadow-amber-100 cursor-pointer"
                            : "border-amber-200 bg-amber-50/60 hover:border-amber-400 cursor-pointer",
                        ].join(" ")}
                      >
                        <p className={`text-xs font-semibold ${prevDueRemaining <= 0 ? "text-green-800" : "text-amber-800"}`}>Previous Session</p>
                        <p className={`text-sm font-bold ${prevDueRemaining <= 0 ? "text-green-700 line-through opacity-60" : "text-amber-700"}`}>₹{(prevDueRemaining <= 0 ? prevYearDueTotal : prevDueRemaining).toFixed(0)}</p>
                        <span className={`inline-block mt-1 text-[9px] font-bold tracking-wide uppercase rounded-full px-2 py-0.5 ${prevDueRemaining <= 0 ? "text-white bg-green-500" : "text-red-700 bg-red-100"}`}>
                          {prevDueRemaining <= 0 ? "PAID" : "UNPAID"}
                        </span>
                        {prevDueRemaining <= 0 && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); downloadPrevDueMonthReceipt(-1, "Previous Session", prevYearDueTotal); }}
                            className="mt-1 flex items-center justify-center gap-0.5 w-full text-[9px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full px-1.5 py-0.5 transition-colors"
                          >
                            <Download className="w-2.5 h-2.5" /> Receipt
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Month payment grid */}
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max pb-2">
                  {SESSION_MONTHS.map(({ month, label }) => {
                    const status = getMonthStatus(month);
                    const isPaid = status === "paid";
                    const isPartial = status === "partial";
                    const isFuture = status === "none";
                    const isSelectable = isMonthSelectable(month);
                    const key = monthKey(month);
                    const isSelected = selectedMonths.has(key);
                    const total = getMonthTotal(month);
                    const balance = getMonthBalance(month);
                    const cf = hasMonthCF(month);

                    return (
                      <div
                        key={month}
                        onClick={() => isSelectable && toggleMonth(month)}
                        className={[
                          "flex flex-col items-center rounded-xl border-2 w-[76px] shrink-0 transition-all select-none",
                          isPaid ? "border-green-200 bg-green-50 cursor-default" :
                          isFuture ? "border-slate-100 bg-slate-50 cursor-default opacity-50" :
                          isSelected ? "border-teal-500 bg-teal-50 cursor-pointer shadow-md shadow-teal-100" :
                          isPartial ? "border-amber-300 bg-amber-50 cursor-pointer hover:border-amber-400" :
                          "border-red-200 bg-red-50 cursor-pointer hover:border-red-400",
                        ].join(" ")}
                      >
                        {/* Row 1 — Checkbox + month name */}
                        <div className="w-full flex items-center gap-1.5 px-2 pt-2.5 pb-1">
                          <div className={[
                            "w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all",
                            isPaid ? "border-green-400 bg-green-400" :
                            isFuture ? "border-slate-300 bg-slate-100" :
                            isSelected ? "border-teal-500 bg-teal-500" :
                            "border-slate-300 bg-white",
                          ].join(" ")}>
                            {(isPaid || isSelected) && <CheckCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className={`text-xs font-bold ${isPaid ? "text-green-700" : isFuture ? "text-slate-400" : isSelected ? "text-teal-700" : "text-slate-700"}`}>
                            {label}
                          </span>
                          {cf && !isFuture && <span className="text-[8px] font-bold text-orange-500 ml-auto">CF</span>}
                        </div>

                        {/* Row 2 — Amount */}
                        <div className="w-full px-2 pb-1 text-center">
                          {isFuture ? (
                            <span className="text-[10px] text-slate-300">—</span>
                          ) : (
                            <span className={`text-[11px] font-semibold ${isPaid ? "text-green-600" : isPartial ? "text-amber-600" : "text-slate-600"}`}>
                              ₹{(isPartial ? balance : total).toFixed(0)}
                              {isPartial && <span className="text-[8px] ml-0.5 text-amber-500">bal</span>}
                            </span>
                          )}
                        </div>

                        {/* Row 3 — Status badge */}
                        <div className="w-full px-1.5 pb-2.5 text-center">
                          {isFuture ? (
                            <span className="text-[9px] text-slate-300 font-medium">—</span>
                          ) : isPaid ? (
                            <span className="inline-block text-[9px] font-bold text-white bg-green-500 rounded-full px-2 py-0.5">PAID</span>
                          ) : isPartial ? (
                            <span className="inline-block text-[9px] font-bold text-amber-800 bg-amber-200 rounded-full px-2 py-0.5">PARTIAL</span>
                          ) : (
                            <span className="inline-block text-[9px] font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">UNPAID</span>
                          )}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); downloadMonthReceipt(month); }}
                              className="mt-1 flex items-center justify-center gap-0.5 w-full text-[9px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full px-1.5 py-0.5 transition-colors"
                            >
                              <Download className="w-2.5 h-2.5" /> Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-3">
                Tap months to select · Green = paid · Red = unpaid · Amber = partially paid (shows remaining balance) · Grey = upcoming
              </p>
            </>
          )}
        </div>
      )}
    </ParentLayout>
  );
}
