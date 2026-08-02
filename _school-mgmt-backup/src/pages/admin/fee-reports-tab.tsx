import { useState, useMemo, useEffect } from "react";
import {
  useListFeePayments,
  useListClasses,
  useListSections,
  useListStudents,
  useListFeeStructures,
  useListFeeCategories,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Download, FileSpreadsheet, Filter,
  TrendingDown, IndianRupee, Users, CheckCircle2, X, Info, Printer,
} from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NUMS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // Apr → Mar (school session order)
const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const SCHOOL_MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const currentYear = new Date().getFullYear();

/** Extract the start year from a session string like "2027-28" or "2027-2028" → 2027 */
function sessionYearStart(session: string): number {
  const m = session.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : currentYear;
}
const now = new Date();
const todayStr = now.toISOString().split("T")[0];

function fmt(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusBadge(s: string) {
  if (s === "paid") return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Paid</Badge>;
  if (s === "partial") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Pending</Badge>;
}

type ReportType = "daily" | "monthly" | "due" | "classwise" | "history" | "prevdue" | "defaulter" | "fir";

const REPORT_LABELS: Record<ReportType, string> = {
  daily: "Daily Collection",
  monthly: "Monthly Report",
  due: "Student Due",
  classwise: "Class-wise",
  history: "Payment History",
  prevdue: "Prev Year Due",
  defaulter: "⚠ Defaulters",
  fir: "📋 FIR Register",
};

export default function FeeReportsTab({ session }: { session: string }) {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [year, setYear] = useState(() => sessionYearStart(session));
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(() => sessionYearStart(session));

  // Keep year filters in sync when the active academic session changes
  useEffect(() => {
    setYear(sessionYearStart(session));
    setFilterYear(sessionYearStart(session));
  }, [session]);
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections({});
  const { data: allStudents = [] } = useListStudents({});
  const { data: categories = [] } = useListFeeCategories();
  const { data: structures = [] } = useListFeeStructures({ session });
  const { data: allPayments = [], isLoading } = useListFeePayments(
    { session },
    { query: { queryKey: ["listFeePayments", { session }], staleTime: 0, refetchOnMount: true } }
  );

  const today = useMemo(() => new Date(), []);

  // ─── Section helpers ───
  const filteredSections = useMemo(() => {
    const allSections = sections as any[];
    if (filterClassId === "all") return allSections;
    // First try: sections linked by classId (populated DB)
    const byClassId = allSections.filter((s: any) => s.classId != null && String(s.classId) === filterClassId);
    if (byClassId.length > 0) return byClassId;
    // Second try: derive from students actually enrolled in this class
    const sectionIdsInClass = new Set(
      allStudents
        .filter((s: any) => String(s.classId) === filterClassId && s.sectionId != null)
        .map((s: any) => String(s.sectionId))
    );
    const fromStudents = allSections.filter((s: any) => sectionIdsInClass.has(String(s.id)));
    if (fromStudents.length > 0) return fromStudents;
    // Fallback: sections are global (not tied to classes) — show all so the dropdown never goes blank
    return allSections;
  }, [sections, filterClassId, allStudents]);

  // Maps studentId → sectionId (as string) for payment-based reports
  const studentSectionMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const stu of allStudents) {
      if (stu.sectionId != null) map.set(stu.id as number, String(stu.sectionId));
    }
    return map;
  }, [allStudents]);

  // ─── Core computation: same logic as FeeCollectionTab.getStudentGenerated ───
  const studentSummaries = useMemo(() => {
    return allStudents.map(stu => {
      const cId = stu.classId;
      if (!cId) return null;
      const cls = classes.find(c => c.id === cId);
      const sec = (sections as any[]).find((s: any) => s.id === stu.sectionId);
      const isRTE = ((stu as any).studentType ?? "").toLowerCase() === "rte";
      const isNew = ((stu as any).studentType ?? "").toLowerCase().includes("new");
      const prevYearDue = parseFloat(String((stu as any).previousYearDue || "0")) || 0;

      const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
      const admStruct = admCat ? structures.find((s: any) => s.categoryId === admCat.id && s.classId === cId) : null;
      const admFeeAmount = isNew && admStruct ? parseFloat(String(admStruct.amount)) || 0 : 0;

      const transportFee = (stu as any).hasVehicle && (stu as any).transportRouteId && (stu as any).transportRoutePricePerMonth
        ? parseFloat(String((stu as any).transportRoutePricePerMonth)) || 0 : 0;

      // Tuition structures (transport and admission excluded — handled separately)
      const tuitionStructsForReport = structures.filter((s: any) => {
        if (s.classId !== cId) return false;
        const cat = categories.find((c: any) => c.id === s.categoryId);
        const cn = (cat?.name ?? "").toLowerCase();
        if (cn.includes("admission") || cn.includes("transport") || cn.includes("bus")) return false;
        if (isRTE && (cn.includes("tuition") || cn.includes("tution"))) return false;
        return true;
      });

      const startIdx = (stu as any).feeFromApril === false && (stu as any).admissionDate
        ? (() => {
            const parts = String((stu as any).admissionDate).split("-");
            const m = parseInt(parts[1] || "0");
            const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
            return idx >= 0 ? idx : 0;
          })()
        : 0;

      let generated = 0;
      const dueMonthNames: string[] = [];
      const paidMonthKeys = new Set(
        allPayments
          .filter(p => p.studentId === stu.id && !p.isPreviousDue && (p.status === "paid" || (p.paidAmount && parseFloat(String(p.paidAmount)) > 0)))
          .map(p => `${p.month}-${p.year}`)
      );

      for (let i = startIdx; i < SCHOOL_MONTHS_ORDER.length; i++) {
        const m = SCHOOL_MONTHS_ORDER[i];
        const mYear = m >= 4 ? year : year + 1;
        if (new Date(mYear, m - 1, 1) > today) break;
        const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m);
        const monthTuition = tuitionStructsForReport.reduce((sum: number, st: any) => {
          const amt = parseFloat(String(st.amount)) || 0;
          const freq = ((st.frequency as string) || "monthly").toLowerCase();
          if (freq === "monthly") return sum + amt;
          if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
          if (freq === "annually")  return schoolYearIdx === 0 ? sum + amt : sum;
          if (freq === "one-time")  return i === startIdx ? sum + amt : sum;
          return sum + amt;
        }, 0);
        const amt = monthTuition + transportFee + (i === startIdx ? admFeeAmount : 0);
        generated += amt;
        if (!paidMonthKeys.has(`${m}-${mYear}`)) {
          dueMonthNames.push(`${MONTHS[m - 1]} ${mYear}`);
        }
      }
      generated += prevYearDue;

      const stuPays = allPayments.filter(p => p.studentId === stu.id);
      const paid = stuPays.reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
      const pending = Math.max(0, generated - paid);

      const prevYearPayments = stuPays.filter(p => p.isPreviousDue === true);
      const prevYearPaid = prevYearPayments.reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
      const prevYearBalance = Math.max(0, prevYearDue - prevYearPaid);

      return {
        studentId: stu.id,
        studentName: stu.studentName ?? "",
        rollNo: (stu as any).rollNo ?? "",
        classId: cId,
        className: cls?.name ?? "—",
        sectionId: stu.sectionId ?? null,
        sectionName: sec?.name ?? "",
        studentType: (stu as any).studentType ?? "—",
        generated, paid, pending, dueMonthNames,
        prevYearDue, prevYearPaid, prevYearBalance,
        prevYearRemarks: String((stu as any).previousYearDueRemarks || ""),
        whatsappNumber: (stu as any).whatsappNumber ?? "",
        parentEmail: (stu as any).parentEmail ?? "",
        startMonthIdx: startIdx, // index into SCHOOL_MONTHS_ORDER (0=Apr … 11=Mar)
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [allStudents, structures, categories, allPayments, classes, sections, year, today]);

  // ─── Daily collection: payments filtered by date range ───
  const dailyData = useMemo(() => {
    if (reportType !== "daily") return [];
    return allPayments.filter(p => {
      if (!p.paymentDate) return false;
      if (p.paymentDate < fromDate || p.paymentDate > toDate) return false;
      if (filterClassId !== "all" && String(p.classId) !== filterClassId) return false;
      if (filterSectionId !== "all" && studentSectionMap.get(p.studentId ?? 0) !== filterSectionId) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? ""));
  }, [reportType, allPayments, fromDate, toDate, filterClassId, filterSectionId, studentSectionMap, filterStatus]);

  // ─── Monthly report: per-student status for selected month/year ───
  const monthlyData = useMemo(() => {
    if (reportType !== "monthly") return [];
    const selectedMonthIdx = SCHOOL_MONTHS_ORDER.indexOf(filterMonth); // position in school year (0=Apr … 11=Mar)
    return studentSummaries
      .filter(s => {
        if (filterClassId !== "all" && String(s.classId) !== filterClassId) return false;
        if (filterSectionId !== "all" && String(s.sectionId) !== filterSectionId) return false;
        // Exclude students whose fees hadn't started yet for the selected month
        if (selectedMonthIdx >= 0 && selectedMonthIdx < s.startMonthIdx) return false;
        return true;
      })
      .map(s => {
        const stuMonthPays = allPayments.filter(p =>
          p.studentId === s.studentId && p.month === filterMonth && p.year === filterYear && !p.isPreviousDue
        );
        // Also include carry-forward payments that cleared this month's balance (isPreviousDue=true, same month/year)
        const carryoverPays = allPayments.filter(p =>
          p.studentId === s.studentId && p.month === filterMonth && p.year === filterYear && p.isPreviousDue === true
        );
        const directPaid = stuMonthPays.reduce((sum, p) => sum + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
        const carryoverPaid = carryoverPays.reduce((sum, p) => sum + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
        const monthPaid = directPaid + carryoverPaid;
        const monthAmt = stuMonthPays.reduce((sum, p) => sum + (parseFloat(String(p.amount ?? "0")) || 0), 0);
        const status = monthPaid === 0 ? "pending" : monthPaid >= monthAmt && monthAmt > 0 ? "paid" : "partial";
        return { ...s, monthPaid, monthAmt, status, receiptNo: stuMonthPays[0]?.receiptNo ?? "", payDate: stuMonthPays[0]?.paymentDate ?? "" };
      })
      .filter(s => filterStatus === "all" || s.status === filterStatus);
  }, [reportType, studentSummaries, allPayments, filterMonth, filterYear, filterClassId, filterSectionId, filterStatus]);

  // ─── Class-wise summary: computed from studentSummaries ───
  const classwiseData = useMemo(() => {
    if (reportType !== "classwise") return [];
    const map = new Map<number, { classId: number; className: string; students: number; generated: number; paid: number; pending: number }>();
    for (const s of studentSummaries) {
      if (filterClassId !== "all" && String(s.classId) !== filterClassId) continue;
      if (filterSectionId !== "all" && String(s.sectionId) !== filterSectionId) continue;
      if (!map.has(s.classId)) map.set(s.classId, { classId: s.classId, className: s.className, students: 0, generated: 0, paid: 0, pending: 0 });
      const entry = map.get(s.classId)!;
      entry.students++;
      entry.generated += s.generated;
      entry.paid += s.paid;
      entry.pending += s.pending;
    }
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [reportType, studentSummaries, filterClassId, filterSectionId]);

  // ─── Due / Defaulter: from studentSummaries where pending > 0 ───
  const dueData = useMemo(() => {
    if (reportType !== "due" && reportType !== "defaulter") return [];
    return studentSummaries
      .filter(s => s.pending > 0)
      .filter(s => filterClassId === "all" || String(s.classId) === filterClassId)
      .filter(s => filterSectionId === "all" || String(s.sectionId) === filterSectionId)
      .sort((a, b) => b.pending - a.pending);
  }, [reportType, studentSummaries, filterClassId, filterSectionId]);

  // ─── Previous Year Due ───
  const prevDueData = useMemo(() => {
    if (reportType !== "prevdue") return [];
    return studentSummaries
      .filter(s => s.prevYearDue > 0)
      .filter(s => filterClassId === "all" || String(s.classId) === filterClassId)
      .filter(s => filterSectionId === "all" || String(s.sectionId) === filterSectionId)
      .sort((a, b) => b.prevYearBalance - a.prevYearBalance);
  }, [reportType, studentSummaries, filterClassId, filterSectionId]);

  // ─── Payment History ───
  const historyData = useMemo(() => {
    if (reportType !== "history") return [];
    return allPayments
      .filter(p => filterClassId === "all" || String(p.classId) === filterClassId)
      .filter(p => filterSectionId === "all" || studentSectionMap.get(p.studentId ?? 0) === filterSectionId)
      .filter(p => filterStatus === "all" || p.status === filterStatus)
      .sort((a, b) => (b.paymentDate ?? "").localeCompare(a.paymentDate ?? ""));
  }, [reportType, allPayments, filterClassId, filterSectionId, studentSectionMap, filterStatus]);

  // ─── CF Drill-down popup state ───
  const [cfPopup, setCfPopup] = useState<{
    studentName: string;
    monthLabel: string;
    payments: { receiptNo: string; paymentDate: string; paidAmount: number; paymentMethod?: string }[];
  } | null>(null);

  async function printCFReceipt() {
    if (!cfPopup) return;
    let schoolName = "School";
    let schoolAddress = "";
    let schoolPhone = "";
    let receiptFooter = "";
    try {
      const res = await fetch("/api/settings/school-info");
      if (res.ok) {
        const d = await res.json();
        schoolName = d.schoolName || schoolName;
        schoolAddress = d.address || "";
        schoolPhone = d.contactNumber || "";
        receiptFooter = d.receiptFooter || "";
      }
    } catch { /* ignore */ }

    const totalPaid = cfPopup.payments.reduce((s, p) => s + p.paidAmount, 0);
    const receiptNo = cfPopup.payments[0]?.receiptNo || "CF-RECEIPT";
    const rows = cfPopup.payments.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="border:1px solid #ddd;padding:5px 8px;font-size:12px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:5px 8px;font-size:12px;font-family:monospace;color:#4338ca">${p.receiptNo}</td>
        <td style="border:1px solid #ddd;padding:5px 8px;font-size:12px">${p.paymentDate}</td>
        <td style="border:1px solid #ddd;padding:5px 8px;font-size:12px">${p.paymentMethod || "Cash"}</td>
        <td style="border:1px solid #ddd;padding:5px 8px;font-size:12px;text-align:right;font-weight:600;color:#c2410c">₹${Number(p.paidAmount).toFixed(2)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><title>CF Receipt — ${cfPopup.studentName}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 13px; color: #555; margin: 3px 0 0; }
  .school-info { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
  .badge { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
  .title { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #444; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  .total-row td { background: #fff7ed; font-weight: bold; font-size: 14px; }
  .footer { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="school-info">
  <h1>${schoolName}</h1>
  ${schoolAddress ? `<h2>${schoolAddress}</h2>` : ""}
  ${schoolPhone ? `<h2>Ph: ${schoolPhone}</h2>` : ""}
</div>
<div class="badge">Carry-Forward Payment Receipt</div>
<div class="title">Fee Receipt</div>
<table>
  <tr><td style="border:1px solid #ddd;padding:5px 8px;font-weight:bold;color:#555;width:42%;font-size:13px">Student Name</td><td style="border:1px solid #ddd;padding:5px 8px;font-size:13px">${cfPopup.studentName}</td></tr>
  <tr><td style="border:1px solid #ddd;padding:5px 8px;font-weight:bold;color:#555;font-size:13px">Month</td><td style="border:1px solid #ddd;padding:5px 8px;font-size:13px;color:#c2410c;font-weight:600">${cfPopup.monthLabel}</td></tr>
  <tr><td style="border:1px solid #ddd;padding:5px 8px;font-weight:bold;color:#555;font-size:13px">Receipt Type</td><td style="border:1px solid #ddd;padding:5px 8px;font-size:13px">Carry-Forward (Previous Balance)</td></tr>
</table>
<p style="font-size:12px;font-weight:600;color:#555;margin:12px 0 6px">Payment Breakdown:</p>
<table>
  <thead><tr style="background:#ea580c;color:white">
    <th style="border:1px solid #fb923c;padding:5px 8px;font-size:11px">#</th>
    <th style="border:1px solid #fb923c;padding:5px 8px;font-size:11px;text-align:left">Receipt No.</th>
    <th style="border:1px solid #fb923c;padding:5px 8px;font-size:11px;text-align:left">Date Paid</th>
    <th style="border:1px solid #fb923c;padding:5px 8px;font-size:11px;text-align:left">Mode</th>
    <th style="border:1px solid #fb923c;padding:5px 8px;font-size:11px">Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr class="total-row">
    <td colspan="4" style="border:1px solid #ddd;padding:6px 8px;font-size:13px;color:#c2410c">Total CF Paid</td>
    <td style="border:1px solid #ddd;padding:6px 8px;font-size:14px;text-align:right;color:#c2410c">₹${totalPaid.toFixed(2)}</td>
  </tr></tfoot>
</table>
<div class="footer">${receiptFooter || `This is a computer-generated receipt. — ${schoolName}`}</div>
<script>window.onload = () => window.print();<\/script>
</body></html>`;

    const win = window.open("", "_blank", "width=680,height=720");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  // ─── FIR (Fee Information Register): month-wise matrix for all students ───
  const firData = useMemo(() => {
    if (reportType !== "fir") return [];
    return studentSummaries
      .filter(s => (filterClassId === "all" || String(s.classId) === filterClassId) && (filterSectionId === "all" || String(s.sectionId) === filterSectionId))
      .map(s => {
        const months: Record<string, { paid: number; carryoverPaid: number; status: string; carryoverPayments: { receiptNo: string; paymentDate: string; paidAmount: number }[] }> = {};
        let totalCarryForward = 0;
        for (let i = 0; i < SCHOOL_MONTHS_ORDER.length; i++) {
          const m = SCHOOL_MONTHS_ORDER[i];
          const mYear = m >= 4 ? year : year + 1;
          const label = SCHOOL_MONTH_LABELS[i];
          const isFuture = new Date(mYear, m - 1, 1) > today;
          if (isFuture) { months[label] = { paid: 0, carryoverPaid: 0, status: "future", carryoverPayments: [] }; continue; }
          const stuPays = allPayments.filter(p =>
            p.studentId === s.studentId && p.month === m && p.year === mYear && !p.isPreviousDue
          );
          // Also include carry-forward payments credited back to this month (isPreviousDue=true, same month/year)
          const carryoverPays = allPayments.filter(p =>
            p.studentId === s.studentId && p.month === m && p.year === mYear && p.isPreviousDue === true
          );
          const regularPaid = stuPays.reduce((acc, p) => acc + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
          const carryoverPaid = carryoverPays.reduce((acc, p) => acc + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
          const paid = regularPaid + carryoverPaid;
          const due = stuPays.reduce((acc, p) => acc + (parseFloat(String(p.amount ?? "0")) || 0), 0);
          const monthLabel = `${MONTHS[m - 1]} ${mYear}`;
          totalCarryForward += carryoverPaid;
          const carryoverPayments = carryoverPays.map(p => ({
            receiptNo: p.receiptNo ?? "—",
            paymentDate: p.paymentDate ?? "—",
            paidAmount: parseFloat(String(p.paidAmount ?? "0")) || 0,
          }));
          // Use dueMonthNames (computed in studentSummaries) to determine if this month is pending
          const isPending = s.dueMonthNames.includes(monthLabel);
          if (!isPending && regularPaid === 0 && carryoverPaid === 0) {
            months[label] = { paid: 0, carryoverPaid: 0, status: "na", carryoverPayments: [] };
          } else if (paid > 0 && due > 0 && paid < due) {
            months[label] = { paid: Math.round(paid), carryoverPaid: Math.round(carryoverPaid), status: "partial", carryoverPayments };
          } else if (paid > 0) {
            months[label] = { paid: Math.round(paid), carryoverPaid: Math.round(carryoverPaid), status: "paid", carryoverPayments };
          } else {
            months[label] = { paid: 0, carryoverPaid: 0, status: "pending", carryoverPayments: [] };
          }
        }
        return { ...s, months, totalDue: Math.round(s.generated), totalPaid: Math.round(s.paid), balance: Math.max(0, Math.round(s.generated - s.paid)), totalCarryForward: Math.round(totalCarryForward) };
      })
      .sort((a, b) => a.className.localeCompare(b.className) || a.studentName.localeCompare(b.studentName));
  }, [reportType, studentSummaries, allPayments, filterClassId, filterSectionId, year, today]);

  // ─── Totals for summary row ───
  const totals = useMemo(() => {
    if (reportType === "daily") {
      const paid = dailyData.reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
      return { count: dailyData.length, paid, generated: 0, pending: 0 };
    }
    if (reportType === "monthly") {
      const paid = monthlyData.reduce((s, r) => s + r.monthPaid, 0);
      const generated = monthlyData.reduce((s, r) => s + r.monthAmt, 0);
      return { count: monthlyData.length, paid, generated, pending: Math.max(0, generated - paid) };
    }
    if (reportType === "classwise") {
      return { count: classwiseData.length, generated: classwiseData.reduce((s, r) => s + r.generated, 0), paid: classwiseData.reduce((s, r) => s + r.paid, 0), pending: classwiseData.reduce((s, r) => s + r.pending, 0) };
    }
    if (reportType === "due" || reportType === "defaulter") {
      return { count: dueData.length, generated: dueData.reduce((s, r) => s + r.generated, 0), paid: dueData.reduce((s, r) => s + r.paid, 0), pending: dueData.reduce((s, r) => s + r.pending, 0) };
    }
    if (reportType === "prevdue") {
      return { count: prevDueData.length, generated: prevDueData.reduce((s, r) => s + r.prevYearDue, 0), paid: prevDueData.reduce((s, r) => s + r.prevYearPaid, 0), pending: prevDueData.reduce((s, r) => s + r.prevYearBalance, 0) };
    }
    if (reportType === "history") {
      const paid = historyData.reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
      return { count: historyData.length, paid, generated: 0, pending: 0 };
    }
    if (reportType === "fir") {
      return { count: firData.length, generated: firData.reduce((s,r)=>s+r.totalDue,0), paid: firData.reduce((s,r)=>s+r.totalPaid,0), pending: firData.reduce((s,r)=>s+r.balance,0) };
    }
    return { count: 0, paid: 0, generated: 0, pending: 0 };
  }, [reportType, dailyData, monthlyData, classwiseData, dueData, prevDueData, historyData, firData]);

  // ─── School name for exports ───
  async function getSchoolName(): Promise<string> {
    try {
      const res = await fetch("/api/settings/school-info");
      if (res.ok) { const d = await res.json(); return d.schoolName || "School"; }
    } catch { /* ignore */ }
    return "School";
  }

  // ─── CSV Export ───
  const exportCSV = () => {
    let csv = "";
    if (reportType === "daily") {
      csv = "Receipt No,Student,Roll,Class,Category,Amount,Paid,Status,Date,Method\n";
      for (const p of dailyData) {
        csv += `"${p.receiptNo||""}","${p.studentName||""}","${(p as any).rollNo||""}","${p.className||""}","${p.categoryName||""}",${p.amount||0},${p.paidAmount||0},"${p.status}","${p.paymentDate||""}","${p.paymentMethod||""}"\n`;
      }
    } else if (reportType === "monthly") {
      csv = "Student,Roll,Class,Section,Type,Expected,Paid,Status,Receipt,Date\n";
      for (const r of monthlyData) {
        csv += `"${r.studentName}","${r.rollNo}","${r.className}","${r.sectionName}","${r.studentType}",${r.monthAmt},${r.monthPaid},"${r.status}","${r.receiptNo}","${r.payDate}"\n`;
      }
    } else if (reportType === "classwise") {
      csv = "Class,Students,Generated,Paid,Pending,Collection%\n";
      for (const r of classwiseData) {
        const pct = r.generated > 0 ? Math.round((r.paid / r.generated) * 100) : 0;
        csv += `"${r.className}",${r.students},${r.generated},${r.paid},${r.pending},${pct}%\n`;
      }
    } else if (reportType === "due" || reportType === "defaulter") {
      csv = "Student,Roll,Class,Section,Generated,Paid,Pending,Due Months\n";
      for (const r of dueData) {
        csv += `"${r.studentName}","${r.rollNo}","${r.className}","${r.sectionName}",${r.generated},${r.paid},${r.pending},"${r.dueMonthNames.join("; ")}"\n`;
      }
    } else if (reportType === "prevdue") {
      csv = "Student,Roll,Class,Section,Total Due,Paid,Balance,Status\n";
      for (const r of prevDueData) {
        const st = r.prevYearBalance <= 0 ? "Cleared" : r.prevYearPaid > 0 ? "Partial" : "Pending";
        csv += `"${r.studentName}","${r.rollNo}","${r.className}","${r.sectionName}",${r.prevYearDue},${r.prevYearPaid},${r.prevYearBalance},"${st}"\n`;
      }
    } else if (reportType === "history") {
      csv = "Receipt,Student,Roll,Class,Category,Amount,Paid,Status,Month,Year,Date,Method\n";
      for (const p of historyData) {
        csv += `"${p.receiptNo||""}","${p.studentName||""}","${(p as any).rollNo||""}","${p.className||""}","${p.categoryName||""}",${p.amount||0},${p.paidAmount||0},"${p.status}",${p.month||""},${p.year||""},"${p.paymentDate||""}","${p.paymentMethod||""}"\n`;
      }
    } else if (reportType === "fir") {
      const monthHeaders = SCHOOL_MONTH_LABELS.join(",");
      csv = `Student,Roll,Class,Section,${monthHeaders},Total Due,Paid,CF Paid,Balance\n`;
      for (const r of firData) {
        const mVals = SCHOOL_MONTH_LABELS.map(ml => {
          const md = r.months[ml];
          if (!md || md.status === "future" || md.status === "na") return "—";
          if (md.status === "paid") return md.carryoverPaid > 0 ? "Paid(CF)" : "Paid";
          if (md.status === "partial") return `Partial(${md.paid})`;
          return "Pending";
        }).join(",");
        csv += `"${r.studentName}","${r.rollNo||""}","${r.className}","${r.sectionName}",${mVals},${r.totalDue},${r.totalPaid},${r.totalCarryForward},${r.balance}\n`;
      }
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fee-report-${reportType}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  // ─── PDF Export ───
  const exportPDF = async () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const schoolName = await getSchoolName();
    const title = reportType === "daily"
      ? (fromDate === toDate ? `Daily Collection — ${fromDate}` : `Collection: ${fromDate} to ${toDate}`)
      : reportType === "monthly" ? `Monthly Report — ${MONTHS[filterMonth - 1]} ${filterYear}`
      : reportType === "due" ? `Student Due Report (Year ${year})`
      : reportType === "classwise" ? `Class-wise Fee Summary (Year ${year})`
      : reportType === "prevdue" ? "Previous Year Due — Outstanding"
      : reportType === "defaulter" ? "Fee Defaulter Report"
      : reportType === "fir" ? `Fee Information Register (FIR) — Session ${session}`
      : "Payment History";

    let tableHTML = "";
    if (reportType === "daily") {
      tableHTML = `<table><thead><tr><th>Receipt</th><th>Student</th><th>Class</th><th>Category</th><th>Paid</th><th>Status</th><th>Date</th><th>Method</th></tr></thead><tbody>`;
      for (const p of dailyData) {
        tableHTML += `<tr><td>${p.receiptNo||""}</td><td>${p.studentName||""}</td><td>${p.className||""}</td><td>${p.categoryName||""}</td><td>${fmt(parseFloat(String(p.paidAmount||"0")))}</td><td>${p.status}</td><td>${p.paymentDate||""}</td><td>${p.paymentMethod||""}</td></tr>`;
      }
    } else if (reportType === "monthly") {
      tableHTML = `<table><thead><tr><th>Student</th><th>Roll</th><th>Class</th><th>Expected</th><th>Paid</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
      for (const r of monthlyData) {
        tableHTML += `<tr><td>${r.studentName}</td><td>${r.rollNo}</td><td>${r.className} ${r.sectionName}</td><td>${fmt(r.monthAmt)}</td><td style="color:#16a34a">${fmt(r.monthPaid)}</td><td>${r.status}</td><td>${r.payDate||"—"}</td></tr>`;
      }
    } else if (reportType === "classwise") {
      tableHTML = `<table><thead><tr><th>Class</th><th>Students</th><th>Generated</th><th>Paid</th><th>Pending</th><th>Rate</th></tr></thead><tbody>`;
      for (const r of classwiseData) {
        const pct = r.generated > 0 ? Math.round((r.paid / r.generated) * 100) : 0;
        tableHTML += `<tr><td>${r.className}</td><td>${r.students}</td><td>${fmt(r.generated)}</td><td style="color:#16a34a">${fmt(r.paid)}</td><td style="color:#dc2626">${fmt(r.pending)}</td><td>${pct}%</td></tr>`;
      }
    } else if (reportType === "due" || reportType === "defaulter") {
      tableHTML = `<table><thead><tr style="background:${reportType==="defaulter"?"#b91c1c":"#0f766e"};color:white"><th>#</th><th>Student</th><th>Roll</th><th>Class</th><th>Generated</th><th>Paid</th><th style="color:#fca5a5">Pending</th><th>Due Months</th></tr></thead><tbody>`;
      for (const [i, r] of dueData.entries()) {
        tableHTML += `<tr><td>${i+1}</td><td>${r.studentName}</td><td>${r.rollNo||""}</td><td>${r.className} ${r.sectionName}</td><td>${fmt(r.generated)}</td><td>${fmt(r.paid)}</td><td style="color:#b91c1c;font-weight:bold">${fmt(r.pending)}</td><td style="font-size:10px">${r.dueMonthNames.join(", ")}</td></tr>`;
      }
      tableHTML += `<tr style="background:#fef2f2;font-weight:bold"><td colspan="4">Total (${dueData.length} students)</td><td>${fmt(totals.generated)}</td><td>${fmt(totals.paid)}</td><td style="color:#b91c1c">${fmt(totals.pending)}</td><td></td></tr>`;
    } else if (reportType === "prevdue") {
      tableHTML = `<table><thead><tr><th>Student</th><th>Roll</th><th>Class</th><th>Total Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>`;
      for (const r of prevDueData) {
        const st = r.prevYearBalance <= 0 ? "Cleared" : r.prevYearPaid > 0 ? "Partial" : "Pending";
        tableHTML += `<tr><td>${r.studentName}</td><td>${r.rollNo||""}</td><td>${r.className}</td><td>${fmt(r.prevYearDue)}</td><td style="color:#16a34a">${fmt(r.prevYearPaid)}</td><td style="color:#dc2626;font-weight:bold">${fmt(r.prevYearBalance)}</td><td>${st}</td></tr>`;
      }
    } else if (reportType === "fir") {
      const monthCols = SCHOOL_MONTH_LABELS.join("</th><th>");
      tableHTML = `<table><thead><tr><th>#</th><th>Student</th><th>Roll</th><th>Class</th><th>${monthCols}</th><th>Total Due</th><th>Paid</th><th style="color:#ea580c">CF Paid</th><th>Balance</th></tr></thead><tbody>`;
      for (const [i, r] of firData.entries()) {
        const mCells = SCHOOL_MONTH_LABELS.map(ml => {
          const md = r.months[ml];
          if (!md || md.status === "future" || md.status === "na") return `<td style="color:#cbd5e1">—</td>`;
          if (md.status === "paid") return `<td style="${md.carryoverPaid > 0 ? "color:#ea580c" : "color:#16a34a"};text-align:center">${md.carryoverPaid > 0 ? "✓CF" : "✓"}</td>`;
          if (md.status === "partial") return `<td style="color:#d97706;text-align:center">${fmt(md.paid)}</td>`;
          return `<td style="color:#dc2626;text-align:center">✗</td>`;
        }).join("");
        tableHTML += `<tr><td>${i+1}</td><td>${r.studentName}</td><td>${r.rollNo||""}</td><td>${r.className} ${r.sectionName}</td>${mCells}<td>${fmt(r.totalDue)}</td><td style="color:#16a34a">${fmt(r.totalPaid)}</td><td style="color:#ea580c;font-weight:bold">${r.totalCarryForward > 0 ? fmt(r.totalCarryForward) : "—"}</td><td style="color:#dc2626;font-weight:bold">${r.balance>0?fmt(r.balance):"✓ Clear"}</td></tr>`;
      }
      tableHTML += `<tr style="background:#f0fdf4;font-weight:bold"><td colspan="4">Total (${firData.length} students)</td>${SCHOOL_MONTH_LABELS.map(()=>"<td></td>").join("")}<td>${fmt(totals.generated)}</td><td style="color:#16a34a">${fmt(totals.paid)}</td><td style="color:#ea580c">${fmt(firData.reduce((s,r)=>s+r.totalCarryForward,0))}</td><td style="color:#dc2626">${fmt(totals.pending)}</td></tr>`;
    } else {
      tableHTML = `<table><thead><tr><th>Receipt</th><th>Student</th><th>Class</th><th>Category</th><th>Paid</th><th>Status</th><th>Month</th><th>Date</th></tr></thead><tbody>`;
      for (const p of historyData) {
        tableHTML += `<tr><td>${p.receiptNo||""}</td><td>${p.studentName||""}</td><td>${p.className||""}</td><td>${p.categoryName||""}</td><td>${fmt(parseFloat(String(p.paidAmount||"0")))}</td><td>${p.status}</td><td>${p.month?MONTHS[(p.month as number)-1]:""} ${p.year||""}</td><td>${p.paymentDate||""}</td></tr>`;
      }
    }
    tableHTML += "</tbody></table>";

    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
        h1 { color: #0f766e; margin-bottom: 4px; font-size: 18px; }
        h3 { color: #64748b; margin-top: 0; font-size: 13px; }
        .summary { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 16px; margin: 12px 0; display: flex; gap: 20px; flex-wrap: wrap; font-size: 12px; }
        .summary b { color: #0f766e; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
        th { background: #0f766e; color: white; padding: 5px 7px; text-align: left; }
        td { padding: 4px 7px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        @media print { button { display: none; } }
      </style>
    </head><body>
      <h1>${schoolName}</h1><h3>${title}</h3>
      <div class="summary">
        <div>Records: <b>${totals.count}</b></div>
        ${totals.generated > 0 ? `<div>Generated: <b>${fmt(totals.generated)}</b></div>` : ""}
        <div>Total Paid: <b>${fmt(totals.paid)}</b></div>
        ${totals.pending > 0 ? `<div>Pending: <b style="color:#dc2626">${fmt(totals.pending)}</b></div>` : ""}
        <div>Generated: <b>${new Date().toLocaleString("en-IN")}</b></div>
      </div>
      ${tableHTML}
      <br><button onclick="window.print()" style="background:#0f766e;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer">Print / Save as PDF</button>
    </body></html>`);
    w.document.close();
  };

  // ─── Excel Export ───
  const exportExcel = () => {
    let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Fee Report"><Table>`;
    const cell = (v: string | number, t: "String" | "Number" = "String") =>
      `<Cell><Data ss:Type="${t}">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;

    if (reportType === "daily") {
      xml += `<Row>${["Receipt","Student","Roll","Class","Category","Amount","Paid","Status","Date","Method"].map(h => cell(h)).join("")}</Row>`;
      for (const p of dailyData) {
        xml += `<Row>${[p.receiptNo||"",p.studentName||"",(p as any).rollNo||"",p.className||"",p.categoryName||""].map(v=>cell(v)).join("")}${cell(p.amount||0,"Number")}${cell(p.paidAmount||0,"Number")}${[p.status,p.paymentDate||"",p.paymentMethod||""].map(v=>cell(v)).join("")}</Row>`;
      }
    } else if (reportType === "monthly") {
      xml += `<Row>${["Student","Roll","Class","Section","Type","Expected","Paid","Status","Receipt","Date"].map(h=>cell(h)).join("")}</Row>`;
      for (const r of monthlyData) {
        xml += `<Row>${[r.studentName,r.rollNo,r.className,r.sectionName,r.studentType].map(v=>cell(v)).join("")}${cell(r.monthAmt,"Number")}${cell(r.monthPaid,"Number")}${[r.status,r.receiptNo,r.payDate||""].map(v=>cell(v)).join("")}</Row>`;
      }
    } else if (reportType === "classwise") {
      xml += `<Row>${["Class","Students","Generated","Paid","Pending","Rate%"].map(h=>cell(h)).join("")}</Row>`;
      for (const r of classwiseData) {
        const pct = r.generated > 0 ? Math.round((r.paid / r.generated) * 100) : 0;
        xml += `<Row>${cell(r.className)}${cell(r.students,"Number")}${cell(r.generated,"Number")}${cell(r.paid,"Number")}${cell(r.pending,"Number")}${cell(pct,"Number")}</Row>`;
      }
    } else if (reportType === "due" || reportType === "defaulter") {
      xml += `<Row>${["#","Student","Roll","Class","Section","Generated","Paid","Pending","Due Months"].map(h=>cell(h)).join("")}</Row>`;
      for (const [i, r] of dueData.entries()) {
        xml += `<Row>${cell(i+1,"Number")}${[r.studentName,r.rollNo,r.className,r.sectionName].map(v=>cell(v)).join("")}${cell(r.generated,"Number")}${cell(r.paid,"Number")}${cell(r.pending,"Number")}${cell(r.dueMonthNames.join(", "))}</Row>`;
      }
    } else if (reportType === "prevdue") {
      xml += `<Row>${["Student","Roll","Class","Section","Total Due","Paid","Balance","Status"].map(h=>cell(h)).join("")}</Row>`;
      for (const r of prevDueData) {
        const st = r.prevYearBalance <= 0 ? "Cleared" : r.prevYearPaid > 0 ? "Partial" : "Pending";
        xml += `<Row>${[r.studentName,r.rollNo,r.className,r.sectionName].map(v=>cell(v)).join("")}${cell(r.prevYearDue,"Number")}${cell(r.prevYearPaid,"Number")}${cell(r.prevYearBalance,"Number")}${cell(st)}</Row>`;
      }
    } else if (reportType === "fir") {
      const monthHeaders = SCHOOL_MONTH_LABELS.map(h => cell(h)).join("");
      xml += `<Row>${cell("#")}${cell("Student")}${cell("Roll")}${cell("Class")}${cell("Section")}${monthHeaders}${cell("Total Due")}${cell("Paid")}${cell("CF Paid")}${cell("Balance")}</Row>`;
      for (const [i, r] of firData.entries()) {
        const mVals = SCHOOL_MONTH_LABELS.map(ml => {
          const md = r.months[ml];
          if (!md || md.status === "future" || md.status === "na") return cell("—");
          if (md.status === "paid") return cell(md.carryoverPaid > 0 ? "Paid(CF)" : "Paid");
          if (md.status === "partial") return cell(`Partial(${md.paid})`);
          return cell("Pending");
        }).join("");
        xml += `<Row>${cell(i+1,"Number")}${[r.studentName,r.rollNo||"",r.className,r.sectionName].map(v=>cell(v)).join("")}${mVals}${cell(r.totalDue,"Number")}${cell(r.totalPaid,"Number")}${cell(r.totalCarryForward,"Number")}${cell(r.balance,"Number")}</Row>`;
      }
    } else {
      xml += `<Row>${["Receipt","Student","Roll","Class","Category","Amount","Paid","Status","Month","Year","Date","Method"].map(h=>cell(h)).join("")}</Row>`;
      for (const p of historyData) {
        xml += `<Row>${[p.receiptNo||"",p.studentName||"",(p as any).rollNo||"",p.className||"",p.categoryName||""].map(v=>cell(v)).join("")}${cell(p.amount||0,"Number")}${cell(p.paidAmount||0,"Number")}${[p.status,p.month?MONTHS[(p.month as number)-1]:"",p.year||"",p.paymentDate||"",p.paymentMethod||""].map(v=>cell(v)).join("")}</Row>`;
      }
    }
    xml += `</Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fee-report-${reportType}-${Date.now()}.xls`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel exported" });
  };

  // ─── Render ───
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" /> Fee Reports
          </h2>
          <p className="text-sm text-slate-500">All amounts computed from fee structures — matches Collection tab exactly</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 text-xs gap-1">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel} className="h-8 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF} className="h-8 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50">
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Type:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["daily", "monthly", "due", "classwise", "history", "prevdue", "defaulter", "fir"] as ReportType[]).map(t => (
                <button key={t}
                  onClick={() => setReportType(t)}
                  className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                    reportType === t
                      ? t === "prevdue" ? "bg-yellow-500 text-yellow-900 border-yellow-500"
                        : t === "defaulter" ? "bg-red-600 text-white border-red-600"
                        : t === "fir" ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-teal-600 text-white border-teal-600"
                      : t === "prevdue" ? "border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                        : t === "defaulter" ? "border-red-400 text-red-700 hover:bg-red-50"
                        : t === "fir" ? "border-indigo-400 text-indigo-700 hover:bg-indigo-50"
                        : "border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-700"
                  }`}>
                  {REPORT_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Year selector — for fee structure computation */}
            {(reportType === "due" || reportType === "defaulter" || reportType === "classwise" || reportType === "monthly" || reportType === "fir") && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Year:</span>
                <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                  <SelectTrigger className="w-22 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[sessionYearStart(session) - 1, sessionYearStart(session), sessionYearStart(session) + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date range — Daily */}
            {reportType === "daily" && (
              <>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-500">From:</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-900 h-8" />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-500">To:</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-slate-900 h-8" />
                </div>
              </>
            )}

            {/* Month/Year filter — Monthly */}
            {reportType === "monthly" && (
              <>
                <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v))}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_NUMS.map(m => <SelectItem key={m} value={String(m)}>{MONTHS[m-1]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
                  <SelectTrigger className="w-22 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[sessionYearStart(session)-1,sessionYearStart(session),sessionYearStart(session)+1].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </>
            )}

            {/* Class filter — all types */}
            <Select value={filterClassId} onValueChange={v => { setFilterClassId(v); setFilterSectionId("all"); }}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Section filter — all types */}
            <Select value={filterSectionId} onValueChange={setFilterSectionId}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Sections" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {filteredSections.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter — daily, monthly, history */}
            {(reportType === "daily" || reportType === "monthly" || reportType === "history") && (
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400 shrink-0" />
          <div><div className="text-[10px] text-slate-500">Records</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200">{totals.count}</div></div>
        </div>
        {totals.generated > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-amber-500 shrink-0" />
            <div><div className="text-[10px] text-amber-600">Generated</div><div className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmt(totals.generated)}</div></div>
          </div>
        )}
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-teal-500 shrink-0" />
          <div><div className="text-[10px] text-teal-600">Collected</div><div className="text-sm font-bold text-teal-700 dark:text-teal-400">{fmt(totals.paid)}</div></div>
        </div>
        {totals.pending > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
            <div><div className="text-[10px] text-red-600">Pending</div><div className="text-sm font-bold text-red-700 dark:text-red-400">{fmt(totals.pending)}</div></div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {reportType === "daily" && (fromDate === toDate ? `Daily Collection — ${fromDate}` : `Collection: ${fromDate} → ${toDate}`)}
              {reportType === "monthly" && `Monthly Report — ${MONTHS[filterMonth - 1]} ${filterYear}`}
              {reportType === "due" && `Student Due Report — Year ${year}`}
              {reportType === "classwise" && `Class-wise Summary — Year ${year}`}
              {reportType === "history" && "Payment History"}
              {reportType === "prevdue" && "Previous Year Due — Outstanding"}
              {reportType === "defaulter" && <span className="text-red-700 dark:text-red-400">Fee Defaulter Report — Year {year}</span>}
              {reportType === "fir" && <span className="text-indigo-700 dark:text-indigo-400">Fee Information Register (FIR) — Session {session}</span>}
            </CardTitle>
            <span className="text-xs text-slate-400">{totals.count} records</span>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="overflow-x-auto">

              {/* ── DAILY ── */}
              {reportType === "daily" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs pl-4">Receipt</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyData.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">No payments in this date range</TableCell></TableRow>
                    ) : dailyData.map((p, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <TableCell className="pl-4 text-xs font-mono text-slate-500">{String(p.receiptNo||"").split("-").slice(-2).join("-") || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{p.studentName}</div>
                          <div className="text-[10px] text-slate-400">Roll: {(p as any).rollNo || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{p.className}</TableCell>
                        <TableCell className="text-xs">{p.categoryName || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-teal-700">{fmt(parseFloat(String(p.paidAmount||"0")))}</TableCell>
                        <TableCell>{statusBadge(p.status ?? "pending")}</TableCell>
                        <TableCell className="text-xs">{p.paymentDate || "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{p.paymentMethod || "Cash"}</TableCell>
                      </TableRow>
                    ))}
                    {dailyData.length > 0 && (
                      <TableRow className="bg-teal-50 dark:bg-teal-900/20 font-semibold">
                        <TableCell colSpan={4} className="pl-4 text-sm">Total ({dailyData.length} entries)</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── MONTHLY ── */}
              {reportType === "monthly" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs pl-4 w-8">#</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Expected</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">No students found for this filter</TableCell></TableRow>
                    ) : monthlyData.map((r, i) => (
                      <TableRow key={r.studentId} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${r.status === "paid" ? "bg-green-50/30" : r.status === "pending" ? "bg-red-50/30" : ""}`}>
                        <TableCell className="pl-4 text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400">Roll: {r.rollNo || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.className} {r.sectionName}</TableCell>
                        <TableCell className="text-xs">{r.studentType}</TableCell>
                        <TableCell className="text-right text-sm">{r.monthAmt > 0 ? fmt(r.monthAmt) : "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-teal-700">{r.monthPaid > 0 ? fmt(r.monthPaid) : "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-xs">{r.payDate || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {monthlyData.length > 0 && (
                      <TableRow className="bg-teal-50 dark:bg-teal-900/20 font-semibold">
                        <TableCell colSpan={4} className="pl-4 text-sm">Total ({monthlyData.length} students)</TableCell>
                        <TableCell className="text-right text-sm">{fmt(totals.generated)}</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── CLASS-WISE ── */}
              {reportType === "classwise" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs pl-4">Class</TableHead>
                      <TableHead className="text-xs text-center">Students</TableHead>
                      <TableHead className="text-xs text-right">Generated</TableHead>
                      <TableHead className="text-xs text-right">Collected</TableHead>
                      <TableHead className="text-xs text-right">Pending</TableHead>
                      <TableHead className="text-xs text-center">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classwiseData.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No data</TableCell></TableRow>
                    ) : classwiseData.map(r => {
                      const pct = r.generated > 0 ? Math.round((r.paid / r.generated) * 100) : 0;
                      return (
                        <TableRow key={r.classId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <TableCell className="pl-4 font-semibold text-sm">{r.className}</TableCell>
                          <TableCell className="text-center text-sm">{r.students}</TableCell>
                          <TableCell className="text-right text-sm">{fmt(r.generated)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-teal-700">{fmt(r.paid)}</TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${r.pending > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(r.pending)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-500 w-8">{pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {classwiseData.length > 0 && (
                      <TableRow className="bg-teal-50 dark:bg-teal-900/20 font-semibold">
                        <TableCell className="pl-4 text-sm">Total</TableCell>
                        <TableCell className="text-center text-sm">{classwiseData.reduce((s,r)=>s+r.students,0)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(totals.generated)}</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">{fmt(totals.pending)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── DUE / DEFAULTER ── */}
              {(reportType === "due" || reportType === "defaulter") && (
                <Table>
                  <TableHeader>
                    <TableRow className={`${reportType === "defaulter" ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                      <TableHead className="text-xs pl-4 w-8">#</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs text-right">Generated</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className={`text-xs text-right ${reportType === "defaulter" ? "text-red-700" : ""}`}>Pending ↓</TableHead>
                      <TableHead className="text-xs">Due Months</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueData.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">
                        {reportType === "defaulter" ? "No defaulters — all fees up to date!" : "No pending dues found"}
                      </TableCell></TableRow>
                    ) : dueData.map((r, i) => (
                      <TableRow key={r.studentId} className={`hover:bg-red-50/50 dark:hover:bg-red-900/10`}>
                        <TableCell className="pl-4 text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400">Roll: {r.rollNo || "—"} · {r.studentType}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.className} {r.sectionName}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.generated)}</TableCell>
                        <TableCell className="text-right text-xs text-teal-700">{r.paid > 0 ? fmt(r.paid) : "—"}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-red-600">{fmt(r.pending)}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[180px]">
                          <div className="text-[10px] text-red-700 leading-tight">{r.dueMonthNames.join(", ") || "—"}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dueData.length > 0 && (
                      <TableRow className="bg-red-50 dark:bg-red-900/20 font-semibold">
                        <TableCell colSpan={3} className="pl-4 text-sm">Total ({dueData.length} students)</TableCell>
                        <TableCell className="text-right text-sm">{fmt(totals.generated)}</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">{fmt(totals.pending)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── PREV YEAR DUE ── */}
              {reportType === "prevdue" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-yellow-50 dark:bg-yellow-900/20">
                      <TableHead className="text-xs pl-4 w-8">#</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs text-right">Total Due</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs text-right">Balance</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prevDueData.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No previous year dues found</TableCell></TableRow>
                    ) : prevDueData.map((r, i) => (
                      <TableRow key={r.studentId} className={`hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 ${r.prevYearBalance <= 0 ? "bg-green-50/30" : r.prevYearPaid > 0 ? "bg-orange-50/30" : ""}`}>
                        <TableCell className="pl-4 text-xs text-slate-400">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{r.studentName}</div>
                          <div className="text-[10px] text-slate-400">Roll: {r.rollNo || "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.className} {r.sectionName}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{fmt(r.prevYearDue)}</TableCell>
                        <TableCell className="text-right text-sm text-teal-700 font-semibold">{r.prevYearPaid > 0 ? fmt(r.prevYearPaid) : "—"}</TableCell>
                        <TableCell className={`text-right text-sm font-bold ${r.prevYearBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {fmt(r.prevYearBalance)}
                        </TableCell>
                        <TableCell>
                          {r.prevYearBalance <= 0
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Cleared ✓</Badge>
                            : r.prevYearPaid > 0
                              ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Partial</Badge>
                              : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Pending</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {prevDueData.length > 0 && (
                      <TableRow className="bg-yellow-50 dark:bg-yellow-900/20 font-semibold">
                        <TableCell colSpan={3} className="pl-4 text-sm">Total ({prevDueData.length} students)</TableCell>
                        <TableCell className="text-right text-sm">{fmt(totals.generated)}</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">{fmt(totals.pending)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── HISTORY ── */}
              {reportType === "history" && (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="text-xs pl-4">Receipt</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Paid</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Month</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-slate-400 py-8">No payment records found</TableCell></TableRow>
                    ) : historyData.map((p, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <TableCell className="pl-4 text-xs font-mono text-slate-500">{String(p.receiptNo||"").split("-").slice(-2).join("-") || "—"}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{p.studentName}</div>
                          <div className="text-[10px] text-slate-400">{p.className}</div>
                        </TableCell>
                        <TableCell className="text-xs">{p.className}</TableCell>
                        <TableCell className="text-xs">{p.categoryName || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(parseFloat(String(p.amount||"0")))}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-teal-700">{fmt(parseFloat(String(p.paidAmount||"0")))}</TableCell>
                        <TableCell>{statusBadge(p.status ?? "pending")}</TableCell>
                        <TableCell className="text-xs">{p.month ? `${MONTHS[(p.month as number)-1]} ${p.year}` : "—"}</TableCell>
                        <TableCell className="text-xs">{p.paymentDate || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {historyData.length > 0 && (
                      <TableRow className="bg-teal-50 dark:bg-teal-900/20 font-semibold">
                        <TableCell colSpan={5} className="pl-4 text-sm">Total ({historyData.length} entries)</TableCell>
                        <TableCell className="text-right text-sm text-teal-700">{fmt(totals.paid)}</TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ── FIR (Fee Information Register) ── */}
              {reportType === "fir" && (
                <div className="overflow-x-auto">
                  {firData.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">No student data found</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/10 border-b border-orange-100 text-[11px] text-orange-700">
                        <span className="font-semibold">CF = Carry Forward</span>
                        <span className="text-orange-500">· Amounts in orange = paid via carry-forward from previous partial month</span>
                      </div>
                      <table className="w-full text-xs border-collapse min-w-[900px]">
                        <thead>
                          <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left font-semibold text-[11px] whitespace-nowrap sticky left-0 bg-indigo-50 dark:bg-indigo-900/20 z-10">#</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left font-semibold text-[11px] whitespace-nowrap sticky left-6 bg-indigo-50 dark:bg-indigo-900/20 z-10 min-w-[130px]">Student</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left font-semibold text-[11px]">Class</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-semibold text-[11px] whitespace-nowrap text-yellow-700">Prev Due</th>
                            {SCHOOL_MONTH_LABELS.map(ml => (
                              <th key={ml} className="border border-slate-200 dark:border-slate-700 px-1.5 py-2 text-center font-semibold text-[11px] whitespace-nowrap">{ml}</th>
                            ))}
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-semibold text-[11px] whitespace-nowrap">Total Due</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-semibold text-[11px] whitespace-nowrap text-teal-700">Paid</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-semibold text-[11px] whitespace-nowrap text-orange-600">CF Paid</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right font-semibold text-[11px] whitespace-nowrap text-red-600">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {firData.map((r, i) => (
                            <tr key={r.studentId} className={`${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/30"} hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10`}>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-400 sticky left-0 bg-inherit z-10">{i + 1}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-medium sticky left-6 bg-inherit z-10">
                                <div className="truncate max-w-[130px]">{r.studentName}</div>
                                <div className="text-[10px] text-slate-400">Roll: {r.rollNo || "—"}</div>
                              </td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 whitespace-nowrap text-[11px]">{r.className} {r.sectionName}</td>
                              <td className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right text-[11px] font-medium ${r.prevYearDue > 0 ? "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/10" : "text-slate-300"}`}>
                                {r.prevYearDue > 0 ? fmt(r.prevYearDue) : "—"}
                              </td>
                              {SCHOOL_MONTH_LABELS.map(ml => {
                                const mData = r.months[ml];
                                if (!mData || mData.status === "future") return (
                                  <td key={ml} className="border border-slate-200 dark:border-slate-700 px-1 py-1.5 text-center text-slate-300">—</td>
                                );
                                if (mData.status === "na") return (
                                  <td key={ml} className="border border-slate-200 dark:border-slate-700 px-1 py-1.5 text-center text-slate-200 bg-slate-50 dark:bg-slate-800/20">N/A</td>
                                );
                                const hasCF = mData.carryoverPaid > 0;
                                return (
                                  <td key={ml} className={`border border-slate-200 dark:border-slate-700 px-1 py-1.5 text-center font-medium ${
                                    mData.status === "paid"
                                      ? hasCF ? "text-orange-600 bg-orange-50 dark:bg-orange-900/10"
                                               : "text-green-700 bg-green-50 dark:bg-green-900/10"
                                      : mData.status === "partial" ? "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/10"
                                      : "text-red-600 bg-red-50 dark:bg-red-900/10"
                                  }`}>
                                    {mData.status === "paid"
                                      ? hasCF
                                        ? (
                                          <button
                                            onClick={() => setCfPopup({ studentName: r.studentName, monthLabel: ml, payments: mData.carryoverPayments })}
                                            className="inline-flex items-center gap-0.5 text-orange-600 font-semibold underline underline-offset-2 decoration-dotted hover:text-orange-800 cursor-pointer"
                                            title="Click to view carry-forward payment details"
                                          >
                                            ✓ CF <Info size={10} className="opacity-60" />
                                          </button>
                                        )
                                        : "✓"
                                      : mData.paid > 0 ? fmt(mData.paid) : "✗"}
                                  </td>
                                );
                              })}
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-medium text-[11px]">{fmt(r.totalDue)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-semibold text-teal-700 text-[11px]">{fmt(r.totalPaid)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-semibold text-orange-600 text-[11px]">
                                {r.totalCarryForward > 0 ? fmt(r.totalCarryForward) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className={`border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-right font-bold text-[11px] ${r.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                                {r.balance > 0 ? fmt(r.balance) : "✓ Clear"}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-semibold">
                            <td colSpan={3} className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-[11px]">Total ({firData.length} students)</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-yellow-700 text-[11px]">{fmt(firData.reduce((s,r)=>s+(r.prevYearDue||0),0))}</td>
                            {SCHOOL_MONTH_LABELS.map(ml => <td key={ml} className="border border-slate-200 dark:border-slate-700" />)}
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-[11px]">{fmt(totals.generated)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-teal-700 text-[11px]">{fmt(totals.paid)}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-orange-600 text-[11px]">{fmt(firData.reduce((s,r)=>s+r.totalCarryForward,0))}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-right text-red-600 text-[11px]">{fmt(totals.pending)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── CF Drill-down Popup ─── */}
      {cfPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCfPopup(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-orange-200 dark:border-orange-800 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-semibold text-sm">
                  <span className="text-base">📋</span> Carry-Forward Payment History
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{cfPopup.studentName}</span>
                  {" · "}
                  <span className="text-orange-600 font-medium">{cfPopup.monthLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={printCFReceipt}
                  title="Print CF Receipt"
                  className="text-orange-600 hover:text-orange-800 dark:hover:text-orange-300 p-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors flex items-center gap-1 text-xs font-medium"
                >
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setCfPopup(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {cfPopup.payments.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">No carry-forward payment records found.</p>
              ) : (
                <>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">#</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Receipt No.</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Date Paid</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfPopup.payments.map((p, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/40"}>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono text-indigo-700 dark:text-indigo-400">{p.receiptNo}</td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{p.paymentDate}</td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-right font-semibold text-orange-600">{fmt(p.paidAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-orange-50 dark:bg-orange-900/20 font-semibold">
                        <td colSpan={3} className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">Total CF Paid</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-right text-orange-700 dark:text-orange-400 font-bold">
                          {fmt(cfPopup.payments.reduce((s, p) => s + p.paidAmount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-3 text-center">
                    These payments were carried forward from a previous partial payment and credited to this month.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
