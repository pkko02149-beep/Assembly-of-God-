import { useMemo, useCallback, useState } from "react";
import { downloadExcelFile } from "@/lib/excel-export";
import {
  useListStudents,
  useGetPendingStudents,
  useListFeePayments,
  useListClasses,
  useListFeeStructures,
  useListFeeCategories,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, AlertCircle, CheckCircle2, Clock, IndianRupee,
  TrendingDown, Award, Flame, Download, FileSpreadsheet, FileText, Filter, MessageCircle,
} from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtNum(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function StatCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string; value: string; sub?: string;
  icon: any; color: string; trend?: { value: string; up: boolean };
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend.up ? "text-green-600" : "text-red-500"}`}>
                {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value}
              </div>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FeeDashboardTab({ session }: { session: string }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const today = now.toISOString().split("T")[0];

  const [exporting, setExporting] = useState(false);
  const [exportClassId, setExportClassId] = useState<string>("all");
  const [exportSectionId, setExportSectionId] = useState<string>("all");

  const { data: allStudents = [], isLoading: studentsLoading } = useListStudents({});
  const { data: pendingStudents = [] } = useGetPendingStudents({ session });
  const { data: allPayments = [], isLoading: paymentsLoading } = useListFeePayments({ session });
  const { data: classes = [] } = useListClasses();
  const { data: structures = [] } = useListFeeStructures({ session });
  const { data: categories = [] } = useListFeeCategories();

  const todayDate = useMemo(() => new Date(), []);
  const isLoading = studentsLoading || paymentsLoading;

  // ─── Student summaries with export metadata ────────────────────────────────
  const studentSummaries = useMemo(() => {
    return allStudents.map(stu => {
      const classId = stu.classId;
      if (!classId) return null;
      const cls = classes.find(c => c.id === classId);
      const isRTE = ((stu as any).studentType ?? "").toLowerCase() === "rte";
      const isNew = ((stu as any).studentType ?? "").toLowerCase().includes("new");
      const prevYearDue = parseFloat(String((stu as any).previousYearDue || "0")) || 0;

      const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
      const admStruct = admCat
        ? structures.find((st: any) => st.categoryId === admCat.id && st.classId === classId)
        : null;
      const admFeeAmount = isNew && admStruct ? parseFloat(String(admStruct.amount)) || 0 : 0;

      // Transport: per-month active window so inactive/re-assigned students preserve fee history
      const hasTransportRoute = !!(stu as any).transportRouteId && !!(stu as any).transportRoutePricePerMonth;
      const transportPricePerMonth = hasTransportRoute
        ? parseFloat(String((stu as any).transportRoutePricePerMonth)) || 0 : 0;
      const transportFromM: number = (stu as any).transportFromMonth ?? 4;
      const transportStopM: number | null = (stu as any).transportStopMonth ?? null;
      const transportFromIdx = SCHOOL_MONTHS_ORDER.indexOf(transportFromM);
      const transportStopIdx = transportStopM !== null ? SCHOOL_MONTHS_ORDER.indexOf(transportStopM) : -1;

      // Tuition structures (transport and admission excluded — calculated per-month below)
      const tuitionStructsForDash = structures.filter((st: any) => {
        if (st.classId !== classId) return false;
        const cat = categories.find((c: any) => c.id === st.categoryId);
        const cn = (cat?.name ?? "").toLowerCase();
        if (cn.includes("admission") || cn.includes("transport") || cn.includes("bus")) return false;
        if (isRTE && (cn.includes("tuition") || cn.includes("tution"))) return false;
        return true;
      });
      // Flat monthly-only sum kept for export-row compatibility (monthlyFee field)
      const tuitionMonthlyFee = tuitionStructsForDash
        .filter((st: any) => ((st.frequency as string) || "monthly").toLowerCase() === "monthly")
        .reduce((sum: number, st: any) => sum + (parseFloat(String(st.amount)) || 0), 0);

      const startIdx = (stu as any).feeFromApril === false && (stu as any).admissionDate
        ? (() => {
            const parts = String((stu as any).admissionDate).split("-");
            const m = parseInt(parts[1] || "0");
            const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
            return idx >= 0 ? idx : 0;
          })()
        : 0;

      let generatedTotal = 0;
      for (let i = startIdx; i < SCHOOL_MONTHS_ORDER.length; i++) {
        const m = SCHOOL_MONTHS_ORDER[i];
        const mYear = m >= 4 ? currentYear : currentYear + 1;
        if (new Date(mYear, m - 1, 1) > todayDate) break;
        const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m);
        const monthTuition = tuitionStructsForDash.reduce((sum: number, st: any) => {
          const amt = parseFloat(String(st.amount)) || 0;
          const freq = ((st.frequency as string) || "monthly").toLowerCase();
          if (freq === "monthly") return sum + amt;
          if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
          if (freq === "annually")  return schoolYearIdx === 0 ? sum + amt : sum;
          if (freq === "one-time")  return i === startIdx ? sum + amt : sum;
          return sum + amt;
        }, 0);
        let monthTransport = 0;
        if (hasTransportRoute && transportPricePerMonth > 0 && transportFromIdx >= 0) {
          const afterFrom = i >= transportFromIdx;
          const beforeStop = transportStopIdx < 0 || i < transportStopIdx;
          if (afterFrom && beforeStop) monthTransport = transportPricePerMonth;
        }
        generatedTotal += monthTuition + monthTransport + (i === startIdx ? admFeeAmount : 0);
      }

      // Preserve historical transport fees for re-assigned students
      if (hasTransportRoute && transportPricePerMonth > 0 && transportFromIdx > startIdx) {
        const stuPayments = allPayments.filter(p => p.studentId === stu.id);
        for (let i = startIdx; i < transportFromIdx; i++) {
          const m = SCHOOL_MONTHS_ORDER[i];
          const mYear = m >= 4 ? currentYear : currentYear + 1;
          if (new Date(mYear, m - 1, 1) > todayDate) break;
          const hasTransPayment = stuPayments.some((p: any) => {
            const cn = (p.categoryName ?? "").toLowerCase();
            return p.month === m && p.year === mYear && (cn.includes("transport") || cn.includes("bus"));
          });
          if (hasTransPayment) generatedTotal += transportPricePerMonth;
        }
      }

      const generated = generatedTotal + prevYearDue;
      // monthlyFee kept for export rows compatibility (average monthly including transport)
      const monthlyFee = tuitionMonthlyFee + transportPricePerMonth;

      const paid = allPayments
        .filter(p => p.studentId === stu.id)
        .reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);

      return {
        studentId: stu.id,
        classId,
        sectionId: (stu as any).sectionId as number | null,
        sectionName: (stu as any).sectionName as string ?? "",
        className: cls?.name ?? `Class ${classId}`,
        generated,
        paid,
        student: stu as any,
        monthlyFee,
        admFeeAmount,
        startIdx,
        prevYearDue,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [allStudents, structures, categories, allPayments, currentYear, todayDate, classes]);

  // ─── Unique classes & sections for export filter dropdowns ─────────────────
  const exportClassOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const s of studentSummaries) seen.set(s.classId, s.className);
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [studentSummaries]);

  const exportSectionOptions = useMemo(() => {
    const seen = new Map<number, string>();
    const classFilter = exportClassId !== "all" ? Number(exportClassId) : null;
    for (const s of studentSummaries) {
      if (classFilter !== null && s.classId !== classFilter) continue;
      if (s.sectionId && s.sectionName) seen.set(s.sectionId, s.sectionName);
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [studentSummaries, exportClassId]);

  // Reset section when class changes
  const handleClassChange = useCallback((val: string) => {
    setExportClassId(val);
    setExportSectionId("all");
  }, []);

  // ─── Dashboard aggregates (always all students) ────────────────────────────
  const totalGenerated = useMemo(() => studentSummaries.reduce((s, r) => s + r.generated, 0), [studentSummaries]);
  const totalPaid = useMemo(() => studentSummaries.reduce((s, r) => s + r.paid, 0), [studentSummaries]);
  const totalPending = Math.max(0, totalGenerated - totalPaid);
  const collectionRate = totalGenerated > 0 ? Math.round((totalPaid / totalGenerated) * 100) : 0;

  const todayCollection = useMemo(() => {
    return allPayments
      .filter(p => p.paymentDate === today)
      .reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
  }, [allPayments, today]);

  const monthCollection = useMemo(() => {
    return allPayments
      .filter(p => p.month === currentMonth && p.year === currentYear)
      .reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
  }, [allPayments, currentMonth, currentYear]);

  const defaulterCount = useMemo(() => {
    const ids = new Set(pendingStudents.filter(s => (s.pendingMonths ?? 0) >= 2).map(s => s.studentId));
    return ids.size;
  }, [pendingStudents]);

  const paidCount = useMemo(() => {
    const paidIds = new Set(
      allPayments
        .filter(p => p.month === currentMonth && p.year === currentYear)
        .map(p => p.studentId)
    );
    return paidIds.size;
  }, [allPayments, currentMonth, currentYear]);

  const byMonthData = useMemo(() => {
    const map = new Map<string, { month: number; yr: number; paid: number }>();
    for (const p of allPayments) {
      if (!p.month || !p.year) continue;
      const key = `${p.year}-${p.month}`;
      if (!map.has(key)) map.set(key, { month: p.month!, yr: p.year!, paid: 0 });
      const entry = map.get(key)!;
      entry.paid += parseFloat(String(p.paidAmount ?? "0")) || 0;
    }
    return Array.from(map.values())
      .sort((a, b) => a.yr !== b.yr ? a.yr - b.yr : a.month - b.month)
      .slice(-8)
      .map(m => ({ name: MONTHS[(m.month - 1)].slice(0, 3), paid: Math.round(m.paid) }));
  }, [allPayments]);

  const byClassData = useMemo(() => {
    const map = new Map<string, { className: string; paid: number; pending: number }>();
    for (const item of studentSummaries) {
      if (!map.has(item.className)) map.set(item.className, { className: item.className, paid: 0, pending: 0 });
      const entry = map.get(item.className)!;
      entry.paid += item.paid;
      entry.pending += Math.max(0, item.generated - item.paid);
    }
    return Array.from(map.values())
      .sort((a, b) => a.className.localeCompare(b.className))
      .slice(0, 8)
      .map(c => ({ name: c.className, paid: Math.round(c.paid), pending: Math.round(c.pending) }));
  }, [studentSummaries]);

  const pieData = useMemo(() => [
    { name: "Paid", value: Math.round(totalPaid), color: "#0f766e" },
    { name: "Pending", value: Math.round(totalPending), color: "#ef4444" },
  ].filter(d => d.value > 0), [totalPaid, totalPending]);

  const topDefaulters = useMemo(() => pendingStudents.slice(0, 5), [pendingStudents]);

  // ─── Build export rows (respects class / section filter) ───────────────────
  const buildExportRows = useCallback((classIdFilter: string, sectionIdFilter: string) => {
    const classNum = classIdFilter !== "all" ? Number(classIdFilter) : null;
    const sectionNum = sectionIdFilter !== "all" ? Number(sectionIdFilter) : null;

    const filtered = studentSummaries.filter(s => {
      if (classNum !== null && s.classId !== classNum) return false;
      if (sectionNum !== null && s.sectionId !== sectionNum) return false;
      return true;
    });

    const rows: Record<string, string | number>[] = [];

    for (const summary of filtered) {
      const { student: stu, monthlyFee, admFeeAmount, startIdx, prevYearDue } = summary;
      const studentPayments = allPayments.filter(p => p.studentId === stu.id);

      const row: Record<string, string | number> = {
        "Student Name": stu.studentName ?? stu.name ?? `ID-${stu.id}`,
        "Roll No": stu.rollNo ?? stu.rollNumber ?? "",
        "Class": summary.className,
        "Section": summary.sectionName,
        "Type": stu.studentType ?? "Regular",
        "Prev Year Due": prevYearDue,
      };

      let totalDue = prevYearDue;
      let totalPaidAmt = 0;

      for (let i = 0; i < SCHOOL_MONTHS_ORDER.length; i++) {
        const monthNum = SCHOOL_MONTHS_ORDER[i];
        const mYear = monthNum >= 4 ? currentYear : currentYear + 1;
        const label = `${MONTH_LABELS[i]} ${String(mYear).slice(-2)}`;

        const isFuture = new Date(mYear, monthNum - 1, 1) > todayDate;
        const isBeforeStart = i < startIdx;

        let due = 0;
        if (!isFuture && !isBeforeStart) {
          due = monthlyFee + (i === startIdx ? admFeeAmount : 0);
          totalDue += due;
        }

        const paidForMonth = studentPayments
          .filter(p => p.month === monthNum && p.year === mYear)
          .reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
        totalPaidAmt += paidForMonth;

        row[`${label} Due`] = isFuture || isBeforeStart ? "" : due;
        row[`${label} Paid`] = paidForMonth || 0;
      }

      row["Total Due"] = totalDue;
      row["Total Paid"] = totalPaidAmt;
      row["Balance"] = Math.max(0, totalDue - totalPaidAmt);
      row["Status"] = totalPaidAmt >= totalDue ? "Cleared" : totalPaidAmt > 0 ? "Partial" : "Pending";

      rows.push(row);
    }

    rows.sort((a, b) => {
      const cls = String(a["Class"]).localeCompare(String(b["Class"]));
      if (cls !== 0) return cls;
      const sec = String(a["Section"]).localeCompare(String(b["Section"]));
      if (sec !== 0) return sec;
      return String(a["Student Name"]).localeCompare(String(b["Student Name"]));
    });

    return rows;
  }, [studentSummaries, allPayments, currentYear, todayDate]);

  // ─── Export helpers ─────────────────────────────────────────────────────────
  const buildFilenameSuffix = useCallback(() => {
    const cls = exportClassId !== "all"
      ? exportClassOptions.find(c => c.id === Number(exportClassId))?.name ?? exportClassId
      : "All-Classes";
    const sec = exportSectionId !== "all"
      ? exportSectionOptions.find(s => s.id === Number(exportSectionId))?.name ?? exportSectionId
      : null;
    return sec ? `${cls}-${sec}` : cls;
  }, [exportClassId, exportSectionId, exportClassOptions, exportSectionOptions]);

  const buildFilterLabel = useCallback(() => {
    if (exportClassId === "all") return "All Classes";
    const cls = exportClassOptions.find(c => c.id === Number(exportClassId))?.name ?? exportClassId;
    if (exportSectionId === "all") return cls;
    const sec = exportSectionOptions.find(s => s.id === Number(exportSectionId))?.name ?? exportSectionId;
    return `${cls} — ${sec}`;
  }, [exportClassId, exportSectionId, exportClassOptions, exportSectionOptions]);

  const exportToExcel = useCallback(async () => {
    setExporting(true);
    try {
      const rows = buildExportRows(exportClassId, exportSectionId);
      if (rows.length === 0) return;

      const filterLabel = buildFilterLabel();

      const summaryAoa = [
        ["School Fee Payment History Report"],
        [`Session: ${session}`],
        [`Filter: ${filterLabel}`],
        [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
        [],
        ["Metric", "Value"],
        ["Students Exported", rows.length],
        ["Total Due (₹)", rows.reduce((s, r) => s + (Number(r["Total Due"]) || 0), 0)],
        ["Total Collected (₹)", rows.reduce((s, r) => s + (Number(r["Total Paid"]) || 0), 0)],
        ["Total Pending (₹)", rows.reduce((s, r) => s + (Number(r["Balance"]) || 0), 0)],
        ["Cleared", rows.filter(r => r["Status"] === "Cleared").length],
        ["Partial", rows.filter(r => r["Status"] === "Partial").length],
        ["Pending", rows.filter(r => r["Status"] === "Pending").length],
      ];

      const colCount = Object.keys(rows[0]).length;

      await downloadExcelFile(
        [
          { name: "Summary", rows: summaryAoa, columnWidths: [28, 20] },
          {
            name: "Payment History",
            rows,
            columnWidths: Array.from({ length: colCount }, (_, i) => (i < 6 ? 20 : 12)),
          },
        ],
        `payment-history-${session}-${buildFilenameSuffix()}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  }, [buildExportRows, buildFilterLabel, buildFilenameSuffix, exportClassId, exportSectionId, session]);

  const exportToCSV = useCallback(() => {
    setExporting(true);
    try {
      const rows = buildExportRows(exportClassId, exportSectionId);
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      const lines = [
        headers.join(","),
        ...rows.map(row =>
          headers.map(h => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(",")
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-history-${session}-${buildFilenameSuffix()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [buildExportRows, buildFilenameSuffix, exportClassId, exportSectionId, session]);

  // ─── Filtered student count badge ──────────────────────────────────────────
  const filteredCount = useMemo(() => {
    const classNum = exportClassId !== "all" ? Number(exportClassId) : null;
    const sectionNum = exportSectionId !== "all" ? Number(exportSectionId) : null;
    return studentSummaries.filter(s => {
      if (classNum !== null && s.classId !== classNum) return false;
      if (sectionNum !== null && s.sectionId !== sectionNum) return false;
      return true;
    }).length;
  }, [studentSummaries, exportClassId, exportSectionId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fee Dashboard</h2>
          <p className="text-sm text-slate-500">Session {session} — {MONTHS[currentMonth - 1]} {currentYear}</p>
        </div>

        {/* Export panel */}
        <div className="flex flex-col items-end gap-2">
          <Badge className="bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800">
            {collectionRate}% Collection Rate
          </Badge>

          {/* Filter + Export row */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="h-3 w-3" />
              <span className="hidden sm:inline">Export filter:</span>
            </div>

            {/* Class selector */}
            <Select value={exportClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="h-8 text-xs w-32 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Classes</SelectItem>
                {exportClassOptions.map(c => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Section selector — only active when a class is chosen */}
            <Select
              value={exportSectionId}
              onValueChange={setExportSectionId}
              disabled={exportClassId === "all" || exportSectionOptions.length === 0}
            >
              <SelectTrigger className="h-8 text-xs w-28 border-slate-200 dark:border-slate-700 disabled:opacity-50">
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                {exportSectionOptions.map(s => (
                  <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting || filteredCount === 0}
                  className="h-8 flex items-center gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-950/30 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? "Exporting…" : `Export (${filteredCount})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-[11px] text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                  {buildFilterLabel()}
                </div>
                <DropdownMenuItem onClick={exportToExcel} className="flex items-center gap-2 cursor-pointer text-xs">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Export as Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2 cursor-pointer text-xs">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today's Collection" value={fmt(todayCollection)} sub="Cash received today"
          icon={IndianRupee} color="bg-teal-600" />
        <StatCard title="Monthly Collection" value={fmt(monthCollection)} sub={`${MONTHS[currentMonth - 1]} ${currentYear}`}
          icon={TrendingUp} color="bg-blue-600" />
        <StatCard title="Pending Dues" value={fmt(totalPending)} sub={`${pendingStudents.length} students pending`}
          icon={Clock} color="bg-amber-500" />
        <StatCard title="Defaulters" value={String(defaulterCount)} sub="2+ months overdue"
          icon={Flame} color="bg-red-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={String(allStudents.length)} sub="Registered"
          icon={Users} color="bg-indigo-600" />
        <StatCard title="Paid This Month" value={String(paidCount)} sub="Students"
          icon={CheckCircle2} color="bg-green-600" />
        <StatCard title="Total Collected" value={fmt(totalPaid)} sub={`Session ${session}`}
          icon={Award} color="bg-purple-600" />
        <StatCard title="Total Due" value={fmt(totalGenerated)} sub="Overall dues (from fee structures)"
          icon={AlertCircle} color="bg-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Collection by Month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {byMonthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={byMonthData}>
                  <defs>
                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Area type="monotone" dataKey="paid" name="Paid" stroke="#0f766e" fill="url(#paidGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {byClassData.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Collection by Class
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byClassData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="paid" name="Paid" fill="#0f766e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#ef444480" radius={[3, 3, 0, 0]} />
                <Legend iconType="rect" iconSize={10} formatter={(v) => <span className="text-xs">{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {topDefaulters.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Flame className="h-4 w-4" />
              Top Defaulters
              <span className="text-[10px] font-normal text-slate-400 ml-auto">Click WhatsApp to send reminder</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {topDefaulters.map((s, i) => {
                const stuInfo = allStudents.find(st => st.id === s.studentId) as any;
                const waNum = stuInfo?.whatsappNumber ?? stuInfo?.parentWhatsapp ?? "";
                const waMsg = encodeURIComponent(
                  `Dear Parent,\n\nThis is a reminder that *${s.studentName}* (${s.className}) has pending school fees of *${fmt(s.balance ?? 0)}* for ${s.pendingMonths ?? 0} month(s).\n\nPlease clear the dues at your earliest convenience.\n\nThank you.`
                );
                return (
                  <div key={s.studentId} className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-red-400 w-4 shrink-0">#{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.studentName}</p>
                        <p className="text-xs text-slate-500 truncate">{s.className} — {s.pendingMonths} month{s.pendingMonths !== 1 ? "s" : ""} overdue</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">
                        {fmt(s.balance ?? 0)}
                      </Badge>
                      {waNum ? (
                        <a
                          href={`https://wa.me/${String(waNum).replace(/\D/g, "")}?text=${waMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1 transition-colors"
                          title="Send WhatsApp fee reminder"
                        >
                          <MessageCircle className="h-3 w-3" /> Remind
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-300">No WhatsApp</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
