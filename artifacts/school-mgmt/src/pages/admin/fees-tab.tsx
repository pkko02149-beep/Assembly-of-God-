import React, { useState, useMemo, useRef, useEffect } from "react";
import { isAdmin, canEdit, canDelete, getStaffUser, getAdminToken } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import FeeReportsTab from "./fee-reports-tab";
import TransportManagerTab from "./transport-manager-tab";
import {
  useListFeeCategories, useCreateFeeCategory, useUpdateFeeCategory, useDeleteFeeCategory,
  getListFeeCategoriesQueryKey,
  useListFeeStructures, useUpsertFeeStructure, getListFeeStructuresQueryKey,
  useListFeePayments, useCollectFee, useUpdateFeePayment, useDeleteFeePayment,
  getListFeePaymentsQueryKey,
  useGetFeeSummary, getGetFeeSummaryQueryKey,
  useGetPendingStudents, getGetPendingStudentsQueryKey,
  useSendFeeReminders,
  useSendFeeReceipt,
  useListStudents, useListClasses, useListSections,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import {
  DollarSign, Plus, Trash2, Pencil, Send, Receipt, CheckCircle2, Clock, XCircle,
  TrendingUp, AlertCircle, Mail, RefreshCw, ChevronDown, Filter, IndianRupee,
  MessageCircle, Layers, ArrowLeft, Search, Printer, Eye, Bus, Info, FileText
} from "lucide-react";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

function waAuthHeader() {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {} as Record<string, string>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COLORS = ["#0f766e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

/** Extract the start year from a session string like "2027-28" or "2027-2028" → 2027 */
function sessionYearStart(session: string): number {
  const m = session.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : currentYear;
}

function currencyFmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusBadge(status: string) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Paid</Badge>;
  if (status === "partial") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Pending</Badge>;
}

// ── Module-level caches — populated on first use, valid for the browser session ─
// Avoids repeated network round-trips on every print/collect button click.
let _catFreqMapCache: Map<string, string> | null = null;
let _schoolInfoCache: { schoolName: string; schoolAddress: string; schoolPhone: string; receiptFooter: string; logoUrl: string } | null = null;

// ── Fee category frequency helper ────────────────────────────────────────────

async function fetchCatFreqMap(): Promise<Map<string, string>> {
  if (_catFreqMapCache) return _catFreqMapCache;
  try {
    const res = await fetch("/api/fees/categories");
    if (res.ok) {
      const cats: { name: string; frequency: string }[] = await res.json();
      _catFreqMapCache = new Map(cats.map(c => [c.name, c.frequency]));
      return _catFreqMapCache;
    }
  } catch { /* ignore */ }
  return new Map();
}

async function fetchSchoolInfo() {
  if (_schoolInfoCache) return _schoolInfoCache;
  try {
    const res = await fetch("/api/settings/school-info");
    if (res.ok) {
      const d = await res.json();
      _schoolInfoCache = {
        schoolName: d.schoolName || "School",
        schoolAddress: d.address || "",
        schoolPhone: d.contactNumber || d.phone || "",
        receiptFooter: d.receiptFooter || "",
        logoUrl: d.logoUrl || "",
      };
    }
  } catch { /* ignore */ }
  return _schoolInfoCache ?? { schoolName: "School", schoolAddress: "", schoolPhone: "", receiptFooter: "", logoUrl: "" };
}

function freqLabel(freq: string | undefined): string {
  if (freq === "monthly") return "Per/M";
  if (freq === "quarterly") return "Quarterly";
  if (freq === "annually") return "Yearly";
  if (freq === "one-time") return "Onetime";
  return "";
}

function feeTypeCell(categoryName: string, style?: string): string {
  return `<td${style ? ` style="${style}"` : ""}>${categoryName}</td>`;
}

function feeRateCell(amount: number, freq: string | undefined, style?: string): string {
  const fl = freqLabel(freq);
  const rateStr = (amount > 0 && fl) ? `₹${Math.round(amount)} ${fl}` : "—";
  const baseStyle = "text-align:center;font-size:10px;color:#475569";
  const combined = style ? `${baseStyle};${style}` : baseStyle;
  return `<td style="${combined}">${rateStr}</td>`;
}

// ── Date display helper ──────────────────────────────────────────────────────
function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

// ── Email receipt helper (module-level) ─────────────────────────────────────

async function emailReceiptToParent(
  toEmail: string,
  collected: { month: string; mYear: number; totalPaid: number; payments: any[]; carryoverDue?: number; carryoverFromLabel?: string; monthlyDue?: number; balanceDue?: number }[],
  student: { studentName: string; fatherName: string; uniqueId: string; className: string; sectionName: string },
  receiptNo: string,
  payMode: string,
  payDate: string,
): Promise<boolean> {
  try {
    const { schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl } = await fetchSchoolInfo();

    const catFreqMap = await fetchCatFreqMap();

    const totalPaid = collected.reduce((s, c) => s + c.totalPaid, 0);
    const totalDue = collected.reduce((s, c) => s + (c.monthlyDue ?? c.totalPaid), 0);
    const totalBalance = Math.max(0, totalDue - totalPaid);
    const regularMonths = collected.filter(c => c.month !== "Prev Year Due" && c.mYear !== 0);
    const isCompactMode = regularMonths.length > 3;
    const monthsLabel = isCompactMode && regularMonths.length > 0
      ? `${regularMonths[0].month} ${regularMonths[0].mYear} – ${regularMonths[regularMonths.length - 1].month} ${regularMonths[regularMonths.length - 1].mYear} (${regularMonths.length} months)`
      : collected.filter(c => !c.month.startsWith("Prev")).map(c => `${c.month} ${c.mYear}`).join(", ");

    // Build inline-styled receipt body for email
    const td1 = `style="padding:5px 8px;border:1px solid #ccc;font-weight:bold;color:#444;font-size:12px;width:38%"`;
    const td2 = `style="padding:5px 8px;border:1px solid #ccc;font-size:12px"`;

    // Fee rows
    let feeRowsHtml = "";
    if (isCompactMode) {
      const catMap = new Map<string, { totalPaid: number; months: number }>();
      let prevYearDuePaid = 0;
      for (const c of collected) {
        if (c.month === "Prev Year Due" || c.mYear === 0) { prevYearDuePaid += c.totalPaid; continue; }
        for (const p of c.payments?.filter((p: any) => !p.isPreviousDue) ?? []) {
          const name = p.categoryName || "Fee"; const amt = parseFloat(p.paidAmount ?? "0");
          const e = catMap.get(name); if (!e) catMap.set(name, { totalPaid: amt, months: 1 }); else { e.totalPaid += amt; e.months += 1; }
        }
      }
      feeRowsHtml = `<tr style="background:#f8fafc"><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold">Fee Type</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:right">Rate/Mo</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center">Months</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:right">Amount</td></tr>`;
      feeRowsHtml += Array.from(catMap.entries()).map(([name, { totalPaid: tp, months: mo }]) =>
        `<tr><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px">${name}</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:right">₹${mo > 0 ? Math.round(tp / mo) : tp}</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:center">${mo}</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:right">₹${tp.toFixed(2)}</td></tr>`
      ).join("");
      if (prevYearDuePaid > 0) feeRowsHtml += `<tr style="background:#fff7ed"><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;color:#b45309;font-weight:bold">Prev Year Due</td><td colspan="2" style="padding:5px 8px;border:1px solid #ccc">—</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:right;color:#b45309;font-weight:bold">₹${prevYearDuePaid.toFixed(2)}</td></tr>`;
    } else {
      feeRowsHtml = `<tr style="background:#f8fafc"><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:bold">Fee Type</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:center;font-weight:bold">Have to Pay</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:11px;text-align:right;font-weight:bold">Paid Amount</td></tr>`;
      for (const c of collected) {
        const isPrev = c.month === "Prev Year Due" || c.mYear === 0;
        const label = isPrev ? "Previous Year Due" : `${c.month} ${c.mYear}`;
        const bg = isPrev ? "#fff7ed" : "#f0fdf4";
        feeRowsHtml += `<tr><td colspan="3" style="padding:4px 8px;border:1px solid #ccc;font-weight:bold;font-size:12px;background:${bg}">${label}</td></tr>`;
        const carryAmt = c.carryoverDue ?? 0;
        if (carryAmt > 0 && c.carryoverFromLabel) feeRowsHtml += `<tr><td style="padding:4px 8px 4px 20px;border:1px solid #ccc;font-size:11px;color:#b45309;font-style:italic">Carry Forward (from ${c.carryoverFromLabel})</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:10px;text-align:center;color:#94a3b8">—</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right;color:#b45309;font-weight:bold">₹${carryAmt.toFixed(2)}</td></tr>`;
        const pays = (isPrev ? c.payments : c.payments?.filter((p: any) => !p.isPreviousDue)) ?? [];
        for (const p of pays) {
          const rowLabel = isPrev ? (p.remarks ? String(p.remarks).replace(/Previous Year Due — ?/, "").replace(/UTR:.*/, "").trim() || "Previous Year Due" : "Previous Year Due") : (p.categoryName || "Fee");
          const rateAmt = parseFloat(String(p.amount ?? "0"));
          const fl = isPrev ? "" : freqLabel(catFreqMap.get(p.categoryName || ""));
          const rateTdEmail = (!isPrev && rateAmt > 0 && fl) ? `<td style="padding:4px 8px;border:1px solid #ccc;font-size:10px;text-align:center;color:#475569">₹${Math.round(rateAmt)} ${fl}</td>` : `<td style="padding:4px 8px;border:1px solid #ccc;font-size:10px;text-align:center;color:#94a3b8">—</td>`;
          feeRowsHtml += `<tr><td style="padding:4px 8px 4px 18px;border:1px solid #ccc;font-size:11px;color:#555">${rowLabel}</td>${rateTdEmail}<td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right">₹${parseFloat(p.paidAmount ?? "0").toFixed(2)}</td></tr>`;
        }
        const monthTotal = pays.reduce((s: number, p: any) => s + parseFloat(p.paidAmount ?? "0"), 0) || c.totalPaid;
        feeRowsHtml += `<tr><td colspan="2" style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right;color:#15803d">Total Paid</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right;color:#15803d;font-weight:bold">₹${monthTotal.toFixed(2)}</td></tr>`;
        const monthBalance = c.balanceDue ?? Math.max(0, (c.monthlyDue ?? monthTotal) - c.totalPaid);
        if (monthBalance > 0.01) feeRowsHtml += `<tr><td colspan="2" style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right;color:#dc2626">Balance</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:11px;text-align:right;color:#dc2626;font-weight:bold">₹${monthBalance.toFixed(2)}</td></tr>`;
      }
    }

    const resp = await fetch("/api/fees/send-receipt-html-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail, receiptNo, studentName: student.studentName, fatherName: student.fatherName,
        uniqueId: student.uniqueId, className: student.className, sectionName: student.sectionName,
        monthsLabel, payDate: formatDate(payDate) || payDate, payMode, totalPaid, totalDue, totalBalance,
        schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl,
        feeRowsHtml,
      }),
    });
    return resp.ok;
  } catch { return false; }
}

// ── Email special receipt helper (CFNOW carry-forward clearance OR STLMT stuck-due settlement) ─
async function emailCarryNowReceipt(
  toEmail: string,
  student: { studentName: string; fatherName?: string; uniqueId?: string; className?: string; sectionName?: string },
  cfReceiptNo: string,
  cfAmt: number,
  cfDate: string,
  cfMethod: string,
  monthLabel: string,
  kindLabel: "Carry-Forward Clearance" | "Settlement of Stuck Due" = "Carry-Forward Clearance",
): Promise<boolean> {
  try {
    const { schoolName, schoolAddress, schoolPhone, receiptFooter } = await fetchSchoolInfo();

    const isStlmt = kindLabel === "Settlement of Stuck Due";
    const cfDateFmt = formatDate(cfDate) || cfDate;
    const sectionHeader = isStlmt
      ? `Settlement of Stuck Due — ${cfDateFmt} | ${cfMethod}`
      : `Carry-Forward Cleared — ${cfDateFmt} | ${cfMethod}`;
    const rowLabel = isStlmt
      ? `Stuck Due Balance (${monthLabel})`
      : `Balance Due (${monthLabel})`;
    const totalRowLabel = isStlmt
      ? "Stuck Due Amount Settled"
      : "Carry-Forward Amount Cleared";

    const feeRowsHtml = `
      <tr><td colspan="2" style="padding:6px 10px;border:1px solid #fed7aa;background:#fef3c7;color:#b45309;font-weight:bold;font-size:12px">${sectionHeader}</td></tr>
      <tr><td style="padding:5px 8px 5px 20px;border:1px solid #ccc;font-size:12px;color:#b45309">${rowLabel}</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:right;color:#b45309;font-weight:bold">₹${cfAmt.toFixed(2)}</td></tr>
      <tr style="background:#fef3c7"><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;font-weight:bold;color:#b45309">${totalRowLabel}</td><td style="padding:5px 8px;border:1px solid #ccc;font-size:12px;text-align:right;font-weight:bold;color:#b45309">₹${cfAmt.toFixed(2)}</td></tr>
    `;

    const resp = await fetch("/api/fees/send-receipt-html-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail,
        receiptNo: cfReceiptNo,
        studentName: student.studentName,
        fatherName: student.fatherName ?? "",
        uniqueId: student.uniqueId ?? "",
        className: student.className ?? "",
        sectionName: student.sectionName ?? "",
        monthsLabel: `${kindLabel} — ${monthLabel}`,
        payDate: cfDateFmt,
        payMode: cfMethod,
        totalPaid: cfAmt,
        totalDue: cfAmt,
        totalBalance: 0,
        schoolName, schoolAddress, schoolPhone, receiptFooter,
        feeRowsHtml,
      }),
    });
    return resp.ok;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee Setup Tab
// ─────────────────────────────────────────────────────────────────────────────

export function FeeSetupTab({ session }: { session: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [catName, setCatName] = useState("");
  const [catFreq, setCatFreq] = useState("monthly");
  const [catDesc, setCatDesc] = useState("");
  const [editCat, setEditCat] = useState<any>(null);
  const [structClassId, setStructClassId] = useState<string>("all");
  const [structCatId, setStructCatId] = useState<string>("");
  const [structAmount, setStructAmount] = useState<string>("");
  const [structDueDay, setStructDueDay] = useState<string>("10");
  const [editStruct, setEditStruct] = useState<any>(null);
  const [editStructAmount, setEditStructAmount] = useState<string>("");
  const [editStructDueDay, setEditStructDueDay] = useState<string>("");
  const [editStructLoading, setEditStructLoading] = useState(false);

  const { data: categories = [], isLoading: catsLoading } = useListFeeCategories();
  const { data: structures = [] } = useListFeeStructures({
    classId: structClassId !== "all" ? parseInt(structClassId) : undefined,
    session,
  });
  const { data: classes = [] } = useListClasses();

  const createCat = useCreateFeeCategory({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFeeCategoriesQueryKey() }); setCatName(""); setCatDesc(""); toast({ title: "Category added" }); } } });
  const updateCat = useUpdateFeeCategory({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFeeCategoriesQueryKey() }); setEditCat(null); toast({ title: "Category updated" }); } } });
  const deleteCat = useDeleteFeeCategory({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFeeCategoriesQueryKey() }); toast({ title: "Category deleted" }); } } });
  const upsertStruct = useUpsertFeeStructure({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() }); toast({ title: "Fee structure saved" }); setStructAmount(""); } } });

  async function handleEditStruct(s: any) {
    setEditStruct(s);
    setEditStructAmount(String(s.amount ?? ""));
    setEditStructDueDay(String(s.dueDay ?? "10"));
  }
  async function handleSaveEditStruct() {
    if (!editStruct) return;
    setEditStructLoading(true);
    try {
      await fetch(`/api/fees/structures/${editStruct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(editStructAmount) || 0, dueDay: parseInt(editStructDueDay) || 10 }),
      });
      queryClient.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
      toast({ title: "Structure updated" });
      setEditStruct(null);
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
    finally { setEditStructLoading(false); }
  }
  async function handleDeleteStruct(id: number) {
    await fetch(`/api/fees/structures/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
    toast({ title: "Structure deleted" });
  }

  return (
    <div className="space-y-6">
      {/* Step-by-step guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: "1", title: "Fee Categories", desc: "Create fee types like Tuition, Transport, Exam Fee, Sports, etc.", color: "teal" },
          { step: "2", title: "Fee Structures", desc: "Assign amounts per class for each category and the due day each month.", color: "amber" },
          { step: "3", title: "Collect Fees", desc: "Go to Collection tab → select a student → pick months → record payment.", color: "blue" },
        ].map(({ step, title, desc, color }) => (
          <div key={step} className={`flex gap-3 p-4 rounded-xl border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-200 dark:border-${color}-800`}>
            <div className={`shrink-0 w-8 h-8 rounded-full bg-${color}-600 text-white flex items-center justify-center text-sm font-bold`}>{step}</div>
            <div>
              <div className={`text-sm font-semibold text-${color}-800 dark:text-${color}-300`}>{title}</div>
              <div className={`text-xs text-${color}-700 dark:text-${color}-400 mt-0.5`}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-600" />
            Fee Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input className="w-40 h-8 text-sm" placeholder="Category name" value={catName} onChange={e => setCatName(e.target.value)} data-testid="input-cat-name" />
            <Input className="w-36 h-8 text-sm" placeholder="Description" value={catDesc} onChange={e => setCatDesc(e.target.value)} />
            <Select value={catFreq} onValueChange={setCatFreq}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white" disabled={!catName.trim() || createCat.isPending} onClick={() => createCat.mutate({ data: { name: catName, description: catDesc, frequency: catFreq as any } })} data-testid="button-add-category">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {catsLoading ? <div className="text-sm text-slate-400">Loading…</div> : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-xs text-slate-400">({cat.frequency})</span>
                  <button onClick={() => setEditCat(cat)} className="text-slate-400 hover:text-blue-600 ml-1"><Pencil className="h-3 w-3" /></button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-slate-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete category?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the <strong>{cat.name}</strong> category. Existing payments will remain.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteCat.mutate({ id: cat.id })}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
              {categories.length === 0 && <div className="text-sm text-slate-400">No categories yet. Add one above.</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit category dialog */}
      {editCat && (
        <Dialog open={!!editCat} onOpenChange={() => setEditCat(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Name" value={editCat.name} onChange={e => setEditCat((p: any) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Description" value={editCat.description ?? ""} onChange={e => setEditCat((p: any) => ({ ...p, description: e.target.value }))} />
              <Select value={editCat.frequency} onValueChange={v => setEditCat((p: any) => ({ ...p, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCat(null)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => updateCat.mutate({ id: editCat.id, data: { name: editCat.name, description: editCat.description, frequency: editCat.frequency } })}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Fee Structures */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-teal-600" />
            Fee Structures — Session {session}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          {/* Due day info */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span><strong>Due Day</strong> is the day of each month by which fee must be paid (e.g., Due Day 10 means payment is due by the 10th of every month). Payments made after this date may be considered late.</span>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Class</label>
              <Select value={structClassId} onValueChange={setStructClassId}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Category</label>
              <Select value={structCatId} onValueChange={setStructCatId}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Amount (₹)</label>
              <Input className="w-28 h-8 text-sm" type="number" placeholder="Amount" value={structAmount} onChange={e => setStructAmount(e.target.value)} data-testid="input-struct-amount" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Due Day</label>
              <Input className="w-20 h-8 text-sm" type="number" placeholder="10" value={structDueDay} onChange={e => setStructDueDay(e.target.value)} />
            </div>
            <Button size="sm" className="h-8 bg-teal-600 hover:bg-teal-700 text-white" disabled={structClassId === "all" || !structCatId || !structAmount || upsertStruct.isPending} onClick={() => upsertStruct.mutate({ data: { classId: parseInt(structClassId), categoryId: parseInt(structCatId), amount: parseFloat(structAmount), session, dueDay: parseInt(structDueDay) || 10 } })} data-testid="button-save-structure">
              <Plus className="h-3 w-3 mr-1" /> Save Structure
            </Button>
          </div>
          {structures.length === 0 ? (
            <div className="text-sm text-slate-400">No fee structures defined yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Day</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.className}</TableCell>
                    <TableCell>{s.categoryName}</TableCell>
                    <TableCell>{currencyFmt(s.amount ?? 0)}</TableCell>
                    <TableCell>{s.dueDay ?? 10}th</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEditStruct(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete fee structure?</AlertDialogTitle>
                              <AlertDialogDescription>Remove <strong>{s.categoryName}</strong> ({currencyFmt(s.amount ?? 0)}/mo) for <strong>{s.className}</strong>? Existing payments remain.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteStruct(s.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit structure dialog */}
      {editStruct && (
        <Dialog open={!!editStruct} onOpenChange={() => setEditStruct(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Fee Structure — {editStruct.className} / {editStruct.categoryName}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Amount (₹)</label>
                <Input type="number" value={editStructAmount} onChange={e => setEditStructAmount(e.target.value)} placeholder="0" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Due Day (1–31)</label>
                <Input type="number" min={1} max={31} value={editStructDueDay} onChange={e => setEditStructDueDay(e.target.value)} placeholder="10" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditStruct(null)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled={editStructLoading} onClick={handleSaveEditStruct}>
                {editStructLoading ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Fee Detail View — 12-Month Chart (April → March)
// ─────────────────────────────────────────────────────────────────────────────

const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const SCHOOL_MONTH_LABELS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

function getGeneratedByLabel(): string {
  const staff = getStaffUser();
  if (staff) return `${staff.name} (${staff.role})`;
  if (isAdmin()) return "Administrator";
  return "Admin Panel";
}

// When a month's fee was paid online by the parent themselves (via the Parent
// Portal or the public website's "Fee Payment" quick-access button), the
// server tags that payment's `collectedBy` field as "Online (UPI)" — no staff
// member actually collected it. In that case the printed receipt should say
// so instead of showing whichever admin/staff happens to be logged in when
// the receipt is (re)printed.
function getReceiptGeneratedByLabel(collectedByValues: Array<string | null | undefined>): string {
  // Match the exact sentinel the server writes for parent-initiated online
  // payments (see razorpay.ts online-verify / public-verify routes) rather
  // than a loose "online" substring match, so a staff member whose name or
  // role happens to contain the word "online" is never mislabeled.
  const isOnlinePayment = collectedByValues.some((cb) => {
    const v = cb?.trim().toLowerCase();
    return v === "parent (upi)" || v === "online (upi)";
  });
  if (isOnlinePayment) return "Parent (UPI)";
  return getGeneratedByLabel();
}

function makeReceiptCopy(opts: { schoolName: string; schoolAddress: string; schoolPhone: string; logoUrl: string; receiptFooter: string; copyLabel: string; receiptNo: string; bodyContent: string; generatedBy?: string; idSuffix?: string }) {
  const { schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel, bodyContent, generatedBy } = opts;
  const logoHtml = logoUrl
    ? `<img class="school-logo" src="${logoUrl}" style="height:40px;width:auto;margin-right:8px;object-fit:contain;vertical-align:middle;" />`
    : "";
  const qrId = `qr-${copyLabel.replace(/\s/g, "-")}`;
  const qrCell = `<td rowspan="4" class="qr-cell"><div id="${qrId}" style="width:54px;height:54px;margin:0 auto;"></div><div class="qr-label">Scan to verify</div></td>`;
  const processedBody = bodyContent.replace("##QR##", qrCell);
  return `<div class="receipt-col">
<div class="copy-label">${copyLabel}</div>
<div class="receipt-box">
<div class="receipt-inner">
<div class="school-info">
  <div style="display:flex;align-items:center;justify-content:center;">
    ${logoHtml}<div>
      <div style="font-size:14px;font-weight:800;color:#1e293b">${schoolName}</div>
      ${schoolAddress ? `<div style="font-size:9px;color:#555">${schoolAddress}</div>` : ""}
      ${schoolPhone ? `<div style="font-size:9px;color:#555">Ph: ${schoolPhone}</div>` : ""}
    </div>
  </div>
</div>
${processedBody}
<div class="sig-row">
  <div class="gen-by">
    <div>Generated by:</div>
    <div style="font-weight:bold;color:#334155">${generatedBy || "Administrator"}</div>
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <div>Authorised Signatory</div>
  </div>
</div>
<div class="footer">${receiptFooter || `Computer-generated receipt. — ${schoolName}`}</div>
</div>
</div>
</div>`;
}

const RECEIPT_PRINT_CSS = `
  @page { size: 210mm 148.5mm; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 210mm; height: 148.5mm; overflow: hidden; }
  .pair {
    display: flex; width: 210mm; height: 148.5mm;
    overflow: hidden; page-break-inside: avoid; break-inside: avoid;
  }
  .receipt-col {
    flex: 1; display: flex; flex-direction: column;
    padding: 5px 4px 4px 4px; overflow: hidden; height: 100%;
  }
  .copy-label {
    text-align: center; font-size: 9px; font-weight: bold;
    color: #555; margin-bottom: 3px; letter-spacing: 0.3px;
    flex-shrink: 0;
  }
  .receipt-box {
    flex: 1; border: 1.5px solid #555; overflow: hidden;
    display: flex; flex-direction: column; min-height: 0;
  }
  .receipt-inner {
    flex: 1; padding: 5px 7px; overflow: hidden;
    transform-origin: top left; width: 100%; position: relative;
  }
  .divider {
    width: 2px;
    background: repeating-linear-gradient(to bottom, #94a3b8 0, #94a3b8 5px, transparent 5px, transparent 9px);
    margin: 0 2px; flex-shrink: 0;
  }
  .school-info { text-align: center; border-bottom: 1.5px solid #333; padding-bottom: 4px; margin-bottom: 4px; }
  .receipt-header-title {
    text-align: center; font-weight: bold; font-size: 11px;
    letter-spacing: 1px; background: #f1f5f9; padding: 4px !important;
    border-bottom: 1px solid #ccc !important;
  }
  .badge { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; display: inline-block; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
  td { padding: 3px 5px; border: 1px solid #ccc; word-wrap: break-word; overflow-wrap: break-word; }
  td:first-child { font-weight: bold; color: #444; width: 38%; }
  .qr-cell {
    width: 64px !important; min-width: 64px !important; max-width: 64px !important;
    text-align: center; vertical-align: top;
    padding: 4px 3px !important; border-left: 1px solid #ccc !important;
  }
  .qr-label { font-size: 7px; color: #94a3b8; margin-top: 3px; line-height: 1.2; }
  .fee-table thead tr { background: #f8fafc; }
  .fee-table td:first-child { font-weight: normal; }
  .due-row td { background: #eff6ff; color: #1e40af; font-weight: bold; }
  .carry-row td { background: #fff7ed; color: #b45309; font-weight: bold; }
  .total-row td { background: #f0f9f0; font-weight: bold; font-size: 12px; }
  .balance-row td { background: #fff7f7; color: #dc2626; font-weight: bold; }
  .sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 5px; padding-top: 4px; border-top: 1px solid #e2e8f0; flex-shrink: 0; }
  .gen-by { font-size: 9px; color: #64748b; }
  .sig-block { text-align: center; font-size: 9px; color: #64748b; min-width: 90px; }
  .sig-line { border-top: 1px solid #334155; margin-bottom: 2px; width: 90px; }
  .footer { margin-top: 4px; font-size: 9px; color: #999; text-align: center; flex-shrink: 0; }
  /* ── Compact mode: applied automatically when content overflows ── */
  .compact .school-info { padding-bottom: 2px; margin-bottom: 3px; }
  .compact .school-logo { height: 26px !important; }
  .compact .badge { margin-bottom: 2px; padding: 0 5px; font-size: 9px; }
  .compact table { font-size: 9px; margin-bottom: 2px; }
  .compact td { padding: 1px 4px; }
  .compact .receipt-header-title { font-size: 10px; padding: 2px !important; }
  .compact .total-row td { font-size: 10px; }
  .compact .footer { margin-top: 2px; font-size: 8px; }
  .compact .sig-row { margin-top: 3px; padding-top: 2px; }
  /* QR cell: NEVER hidden, NEVER removed — only minimal padding reduction */
  .compact .qr-cell { padding: 3px 2px !important; }
  /* ── Duplicate watermark ── */
  .watermark {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 52px; font-weight: 900;
    color: rgba(220, 38, 38, 0.13);
    letter-spacing: 6px; white-space: nowrap;
    pointer-events: none; user-select: none; z-index: 10;
    text-transform: uppercase;
  }
  @media print { body { margin: 0; } }
`;

const RECEIPT_AUTO_FIT_JS = `
(function() {
  function autoFit(inner) {
    var box = inner.parentElement;
    if (!box) return;
    var availH = box.clientHeight;
    var naturalH = inner.scrollHeight;
    if (naturalH <= availH) return;
    inner.classList.add('compact');
    naturalH = inner.scrollHeight;
    if (naturalH <= availH) return;
    var scale = availH / naturalH;
    scale = Math.max(0.52, Math.floor(scale * 100) / 100);
    inner.style.transform = 'scale(' + scale + ')';
    inner.style.width = (100 / scale) + '%';
  }
  document.querySelectorAll('.receipt-inner').forEach(autoFit);
})();
`;

async function printPrevYearDueReceipt(payment: any, student: any, prevYearDueAmount: number, prevYearDueBalance: number, prevYearDueRemarks: string) {
  const { schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl } = await fetchSchoolInfo();

  const paidAmt = parseFloat(String(payment.paidAmount ?? "0"));
  const receiptNo = payment.receiptNo || `PYD-${payment.id}`;
  const payDate = formatDate(payment.paymentDate) || new Date().toLocaleDateString("en-IN");
  const payMethod = payment.paymentMethod || "Cash";
  const payTime = payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

  const bodyContent = `
<div class="badge">Previous Year Due Payment</div>
<table>
  <tr><td colspan="3" class="receipt-header-title">FEE RECEIPT</td></tr>
  <tr><td>Receipt No.</td><td style="font-size:10px;color:#888">${receiptNo}</td>##QR##</tr>
  <tr><td>Student Name</td><td>${student.studentName}</td></tr>
  <tr><td>Father's Name</td><td>${student.fatherName || "—"}</td></tr>
  <tr><td>Admission No.</td><td>${student.uniqueId || "—"}</td></tr>
  <tr><td>Class</td><td colspan="2">${student.className || ""} ${student.sectionName || ""}</td></tr>
  <tr><td>Payment Date</td><td colspan="2">${payDate}${payTime ? ` at ${payTime}` : ""}</td></tr>
  <tr><td>Payment Mode</td><td colspan="2">${payMethod}${(() => { const m = String(payment.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/); return m ? ` <span style="font-size:10px;color:#64748b">(UTR: ****${m[1]})</span>` : ""; })()}</td></tr>
  ${prevYearDueRemarks ? `<tr><td>Remarks</td><td colspan="2">${prevYearDueRemarks}</td></tr>` : ""}
</table>
<table>
  <tr><td>Total Previous Year Due</td><td style="text-align:right">₹${prevYearDueAmount.toFixed(2)}</td></tr>
  <tr class="total-row"><td>Amount Paid</td><td style="text-align:right">₹${paidAmt.toFixed(2)}</td></tr>
  ${prevYearDueBalance > 0 ? `<tr class="balance-row"><td>Balance Remaining</td><td style="text-align:right">₹${prevYearDueBalance.toFixed(2)}</td></tr>` : `<tr><td colspan="2" style="text-align:center;color:#16a34a;font-weight:bold;">✓ Prev Due Fully Cleared</td></tr>`}
</table>`;

  const generatedBy = getReceiptGeneratedByLabel([payment.collectedBy]);
  const parentCopy = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "Parent Copy", receiptNo, bodyContent, generatedBy });
  const schoolCopy = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "School Copy", receiptNo, bodyContent, generatedBy });
  const _pydKey = `receipt_print_${receiptNo}`;
  const _pydCount = parseInt(localStorage.getItem(_pydKey) || "0", 10) + 1;
  localStorage.setItem(_pydKey, String(_pydCount));
  const isDuplicatePyd = _pydCount > 1;

  const html = `<!DOCTYPE html><html><head><title>Previous Year Due Receipt</title>
<style>${RECEIPT_PRINT_CSS}</style></head><body>
<div class="pair">
  ${parentCopy}
  <div class="divider"></div>
  ${schoolCopy}
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
try {
  ["Parent-Copy","School-Copy"].forEach(function(id) {
    var el = document.getElementById("qr-"+id);
    if (el) new QRCode(el, { text: "${receiptNo}", width: 44, height: 44, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.M });
  });
} catch(e) {}
if (${isDuplicatePyd}) {
  document.querySelectorAll('.receipt-inner').forEach(function(el) {
    var w = document.createElement('div');
    w.className = 'watermark'; w.textContent = 'DUPLICATE';
    el.appendChild(w);
  });
}
${RECEIPT_AUTO_FIT_JS}
setTimeout(function() { window.print(); }, 700);
</script>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

async function printCombinedReceipt(
  collected: { month: string; mYear: number; totalPaid: number; payments: any[]; carryoverDue?: number; carryoverFromLabel?: string; monthlyDue?: number; balanceDue?: number }[],
  student: { studentName: string; fatherName: string; uniqueId: string; className: string; sectionName: string },
  receiptNo: string,
  payMode: string,
  payDate: string,
  utrLast4?: string,
) {
  const { schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl } = await fetchSchoolInfo();
  const catFreqMap = await fetchCatFreqMap();

  const totalPaid = collected.reduce((s, c) => s + c.totalPaid, 0);
  const totalDue = collected.reduce((s, c) => s + (c.monthlyDue ?? c.totalPaid), 0);
  const totalBalance = Math.max(0, totalDue - totalPaid);
  const monthsLabel = collected.filter(c => !c.month.startsWith("Prev")).map(c => `${c.month} ${c.mYear}`).join(", ");

  // ── Compact mode auto-activates when more than 3 regular months are selected ──
  const regularMonths = collected.filter(c => c.month !== "Prev Year Due" && c.mYear !== 0);
  const isCompactMode = regularMonths.length > 3;

  // Compact months label: "Apr 2025 – Jan 2026 (10 months)" vs full list
  const compactMonthsLabel = isCompactMode && regularMonths.length > 0
    ? `${regularMonths[0].month} ${regularMonths[0].mYear} – ${regularMonths[regularMonths.length - 1].month} ${regularMonths[regularMonths.length - 1].mYear} (${regularMonths.length} months)`
    : monthsLabel || "—";

  let feeTableHtml: string;

  if (isCompactMode) {
    // ── COMPACT MODE: aggregate by category across all months ──────────────
    const catMap = new Map<string, { totalPaid: number; months: number }>();
    let prevYearDuePaid = 0;
    let carryoverTotal = 0;

    for (const c of collected) {
      const isPrevYearDue = c.month === "Prev Year Due" || c.mYear === 0;
      if (isPrevYearDue) { prevYearDuePaid += c.totalPaid; continue; }
      if (c.carryoverDue && c.carryoverDue > 0) carryoverTotal += c.carryoverDue;
      const pays = c.payments?.filter((p: any) => !p.isPreviousDue) ?? [];
      for (const p of pays) {
        const catName = p.categoryName || "Fee";
        const amt = parseFloat(p.paidAmount ?? "0");
        const entry = catMap.get(catName);
        if (!entry) catMap.set(catName, { totalPaid: amt, months: 1 });
        else { entry.totalPaid += amt; entry.months += 1; }
      }
    }

    const compactRows = Array.from(catMap.entries()).map(([name, { totalPaid: tp, months: mo }]) => {
      const rate = mo > 0 ? Math.round(tp / mo) : tp;
      return `<tr><td>${name}</td><td style="text-align:right">₹${rate.toFixed(0)}</td><td style="text-align:center">${mo}</td><td style="text-align:right">₹${tp.toFixed(2)}</td></tr>`;
    }).join("");
    const prevYearRow = prevYearDuePaid > 0
      ? `<tr style="background:#fff7ed"><td style="color:#b45309;font-weight:bold">Prev Year Due</td><td>—</td><td style="text-align:center">—</td><td style="text-align:right;color:#b45309;font-weight:bold">₹${prevYearDuePaid.toFixed(2)}</td></tr>`
      : "";
    const carryRow = carryoverTotal > 0
      ? `<tr style="background:#fff7ed"><td style="color:#b45309;font-style:italic" colspan="3">Carry Forward Included</td><td style="text-align:right;color:#b45309">₹${carryoverTotal.toFixed(2)}</td></tr>`
      : "";

    feeTableHtml = `
<table class="fee-table">
  <thead><tr><td>Fee Type</td><td style="text-align:right">Rate/Mo</td><td style="text-align:center">Months</td><td style="text-align:right">Amount</td></tr></thead>
  <tbody>${compactRows}${prevYearRow}${carryRow}</tbody>
</table>`;
  } else {
    // ── DETAILED MODE: per-month sections (≤3 months) ──────────────────────
    const monthSections = collected.map(c => {
      const isPrevYearDue = c.month === "Prev Year Due" || c.mYear === 0;
      const sectionLabel = isPrevYearDue ? "Previous Year Due" : `${c.month} ${c.mYear}`;
      const sectionBg = isPrevYearDue ? "#fff7ed" : "#f0fdf4";
      const sectionBorder = isPrevYearDue ? "#fed7aa" : "#d1fae5";
      const carryAmtDisplay = c.carryoverDue ? Math.round(c.carryoverDue) : 0;
      const carryRow = (c.carryoverDue && c.carryoverDue > 0 && c.carryoverFromLabel)
        ? `<tr><td style="padding-left:24px;color:#b45309;font-style:italic">Carry Forward (from ${c.carryoverFromLabel})</td><td style="text-align:center;font-size:10px;color:#94a3b8">—</td><td style="text-align:right;color:#b45309;font-weight:bold">₹${carryAmtDisplay.toFixed(2)}</td></tr>`
        : "";
      const feeRows = (isPrevYearDue
        ? c.payments
        : c.payments?.filter((p: any) => !p.isPreviousDue)
      )?.map((p: any) => {
        const label = isPrevYearDue
          ? (p.remarks ? String(p.remarks).replace(/Previous Year Due — ?/, "").replace(/UTR:.*/, "").trim() || "Previous Year Due" : "Previous Year Due")
          : (p.categoryName || "Fee");
        const rateAmt = parseFloat(String(p.amount ?? "0"));
        const rateTd = isPrevYearDue ? `<td style="text-align:center;font-size:10px;color:#94a3b8">—</td>` : feeRateCell(rateAmt, catFreqMap.get(p.categoryName || ""), "font-size:9px");
        return `<tr><td style="padding-left:20px;color:#64748b">${label}</td>${rateTd}<td style="text-align:right">₹${parseFloat(p.paidAmount ?? "0").toFixed(2)}</td></tr>`;
      }).join("") || "";
      const relevantPays = isPrevYearDue ? c.payments : c.payments?.filter((p: any) => !p.isPreviousDue);
      const monthTotal = relevantPays?.reduce((s: number, p: any) => s + parseFloat(p.paidAmount ?? "0"), 0) ?? c.totalPaid;
      const monthDueTotal = c.monthlyDue ?? (monthTotal + (c.carryoverDue ?? 0));
      const monthBalance = c.balanceDue ?? Math.max(0, monthDueTotal - c.totalPaid);
      const dueRow = monthDueTotal > 0 ? `<tr><td colspan="2" style="text-align:right;font-size:10px;color:#1e40af;padding-right:10px;border-top:1px dashed #e2e8f0">Total Due</td><td style="text-align:right;font-size:10px;font-weight:bold;color:#1e40af;border-top:1px dashed #e2e8f0">₹${monthDueTotal.toFixed(2)}</td></tr>` : "";
      const paidRow = `<tr><td colspan="2" style="text-align:right;font-size:10px;color:#15803d;padding-right:10px">Total Paid</td><td style="text-align:right;font-size:10px;font-weight:bold;color:#15803d">₹${c.totalPaid.toFixed(2)}</td></tr>`;
      const balRow = monthBalance > 0.01 ? `<tr><td colspan="2" style="text-align:right;font-size:10px;color:#dc2626;padding-right:10px">Balance</td><td style="text-align:right;font-size:10px;font-weight:bold;color:#dc2626">₹${monthBalance.toFixed(2)}</td></tr>` : "";
      return `<tr style="background:${sectionBg}"><td colspan="3" style="font-weight:bold;padding:4px 8px;font-size:12px;border-top:1px solid ${sectionBorder}">${sectionLabel}</td></tr>${carryRow}${feeRows}${dueRow}${paidRow}${balRow}`;
    }).join("");

    feeTableHtml = `
<table class="fee-table">
  <thead><tr><td>Fee Type</td><td style="text-align:center">Have to Pay</td><td style="text-align:right">Paid Amount</td></tr></thead>
  <tbody>${monthSections}</tbody>
</table>`;
  }

  const combinedBodyContent = `
<table>
  <tr><td colspan="3" class="receipt-header-title">FEE RECEIPT${isCompactMode ? " — COMPACT" : ""}</td></tr>
  <tr><td>Receipt No.</td><td style="font-size:10px;color:#888">${receiptNo}</td>##QR##</tr>
  <tr><td>Student</td><td>${student.studentName}</td></tr>
  <tr><td>Father</td><td>${student.fatherName || "—"}</td></tr>
  <tr><td>Adm. No.</td><td>${student.uniqueId || "—"}</td></tr>
  <tr><td>Class</td><td colspan="2">${student.className || ""} ${student.sectionName || ""}</td></tr>
  <tr><td>Months</td><td colspan="2" style="font-size:9px">${compactMonthsLabel}</td></tr>
  <tr><td>Date</td><td colspan="2">${payDate}</td></tr>
  <tr><td>Mode</td><td colspan="2">${payMode}${utrLast4 ? ` &nbsp;<span style="font-size:10px;color:#64748b">(UTR: ****${utrLast4})</span>` : ""}</td></tr>
</table>
${feeTableHtml}
<table>
  ${totalDue > 0 && totalDue !== totalPaid ? `<tr style="background:#eff6ff"><td style="color:#1e40af">Total Fee Due</td><td style="text-align:right;color:#1e40af;font-weight:bold">₹${totalDue.toFixed(2)}</td></tr>` : ""}
  <tr class="total-row"><td>Total Paid</td><td style="text-align:right">₹${totalPaid.toFixed(2)}</td></tr>
  ${totalBalance > 0 ? `<tr style="background:#fff7f7"><td style="color:#dc2626;font-weight:bold">Balance Remaining</td><td style="text-align:right;color:#dc2626;font-weight:bold">₹${totalBalance.toFixed(2)}</td></tr>` : `<tr><td colspan="2" style="text-align:center;color:#16a34a;font-weight:bold;">✓ Fully Paid</td></tr>`}
</table>`;

  const generatedBy = getReceiptGeneratedByLabel(collected.flatMap((c) => c.payments?.map((p: any) => p.collectedBy) ?? []));
  const parentCopyC = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "Parent Copy", receiptNo, bodyContent: combinedBodyContent, generatedBy });
  const schoolCopyC = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "School Copy", receiptNo, bodyContent: combinedBodyContent, generatedBy });
  const _cKey = `receipt_print_${receiptNo}`;
  const _cCount = parseInt(localStorage.getItem(_cKey) || "0", 10) + 1;
  localStorage.setItem(_cKey, String(_cCount));
  const isDuplicateC = _cCount > 1;

  const html = `<!DOCTYPE html><html><head><title>Fee Receipt</title>
<style>${RECEIPT_PRINT_CSS}</style></head><body>
<div class="pair">
  ${parentCopyC}
  <div class="divider"></div>
  ${schoolCopyC}
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
try {
  ["Parent-Copy","School-Copy"].forEach(function(id) {
    var el = document.getElementById("qr-"+id);
    if (el) new QRCode(el, { text: "${receiptNo}", width: 44, height: 44, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.M });
  });
} catch(e) {}
if (${isDuplicateC}) {
  document.querySelectorAll('.receipt-inner').forEach(function(el) {
    var w = document.createElement('div');
    w.className = 'watermark'; w.textContent = 'DUPLICATE';
    el.appendChild(w);
  });
}
${RECEIPT_AUTO_FIT_JS}
setTimeout(function() { window.print(); }, 700);
</script>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

async function printFeeReceipt(row: any, student: any, studentPayments?: any[]) {
  const { schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl } = await fetchSchoolInfo();

  const catFreqMap = await fetchCatFreqMap();

  // Build per-category rows — exclude ₹0-paid entries (ghost records from
  // carryover-only partial sessions where budget for the current month was ₹0)
  const catRows = (row.payments as any[])
    .filter((p: any) => parseFloat(p.paidAmount ?? "0") > 0)
    .map((p: any) => {
      const rateAmt = parseFloat(String(p.amount ?? "0"));
      return `<tr>${feeTypeCell(p.categoryName || "Fee")}${feeRateCell(rateAmt, catFreqMap.get(p.categoryName || ""))}<td style="text-align:right">₹${parseFloat(p.paidAmount ?? "0").toFixed(2)}</td></tr>`;
    }).join("");

  // Fall back to summary rows if no payments array
  const feeLines = row.payments?.length > 0 ? catRows : [
    row.tuitionAmount > 0 ? `<tr><td>Tuition Fee</td><td style="text-align:center;font-size:10px;color:#475569">—</td><td style="text-align:right">₹${row.tuitionAmount.toFixed(2)}</td></tr>` : "",
    row.admissionFee > 0 ? `<tr><td>Admission Fee</td><td style="text-align:center;font-size:10px;color:#475569">—</td><td style="text-align:right">₹${row.admissionFee.toFixed(2)}</td></tr>` : "",
    row.transportAmount > 0 ? `<tr><td>Transport Fee</td><td style="text-align:center;font-size:10px;color:#475569">—</td><td style="text-align:right">₹${row.transportAmount.toFixed(2)}</td></tr>` : "",
  ].join("");

  const receiptNo = row.receiptNo || (row.payments?.[0]?.receiptNo) || `RCP-${row.m}-${row.mYear}`;
  const payDate = formatDate(row.payments?.[0]?.paymentDate) || new Date().toLocaleDateString("en-IN");
  const payMethod = row.payments?.[0]?.paymentMethod || "Cash";
  const balance = row.effectiveTotal != null ? Math.max(0, row.effectiveTotal - row.paidTotal) : (row.balance ?? 0);
  // carryoverDue = amount still OWED from the previous month (a debt, not a payment)
  const carryoverDue = row.carryoverDue ?? 0;
  let carryoverFromLabel = row.carryoverFromLabel ?? "";

  // carryoverPaidInReceipt = amount paid toward a PREVIOUS month's carry-forward
  // IN THIS receipt session only.
  //
  // Critical distinction:
  //   row.carryoverPaid tracks THIS month's own balance that was cleared as carry-forward
  //   in a FUTURE session (e.g. April's ₹400 balance cleared during May's payment).
  //   Using row.carryoverPaid here would wrongly show a carry-settlement section on April's
  //   receipt after May has been paid — even though nothing was settled in April's session.
  //
  // Correct approach: when the admin collects month M's fees AND clears the prior month's
  // carry-forward in the same session, the carry payment is saved with:
  //   receiptNo = `${sharedReceiptBase}-${M}-PREV`   (see collection code, line ~2042)
  // So we find carries belonging to THIS session by looking for receiptNo ending in
  //   `-${row.m}-PREV`   (current month's PREV suffix)
  // which is set exclusively at collection time and cannot match a different month's session.
  let carryoverPaidInReceipt = 0;

  if (studentPayments) {
    // Suffix pattern for carry payments made during month row.m's collection session
    const prevSuffix = `-${row.m}-PREV`;
    const cfPays = (studentPayments as any[]).filter((p: any) =>
      p.isPreviousDue === true &&
      p.month !== 0 &&        // exclude "previous year due" entries (month 0)
      p.month !== row.m &&    // exclude THIS month's own balance cleared in a later session
      String(p.receiptNo ?? "").endsWith(prevSuffix)
    );
    if (cfPays.length > 0) {
      carryoverPaidInReceipt = Math.round(
        cfPays.reduce((s: number, p: any) => s + (parseFloat(p.paidAmount ?? "0") || 0), 0) * 100
      ) / 100;
      const cfM = cfPays[0]?.month as number | undefined;
      if (!carryoverFromLabel && cfM) carryoverFromLabel = MONTHS[cfM - 1] ?? "";
    }
  }

  // Total expected due for this month — use effectiveTotal (month fee + any carry-forward)
  // rather than summing p.amount, which double-counts when multiple payment sessions exist
  // for the same month (e.g. a carryover-only payment followed by the regular month payment).
  const monthDue = row.effectiveTotal ?? row.totalAmount ?? 0;
  // Total actually paid = regular month payments + carry-forward amount cleared in this receipt
  // NOTE: carryoverDue is the amount OWED (debt label), NOT added here — only actually paid carry counts
  const receiptTotalPaid = Math.round((row.paidTotal + carryoverPaidInReceipt) * 100) / 100;
  // Balance: effectiveTotal (month + carry) minus everything actually paid
  const adjustedBalance = row.effectiveTotal != null
    ? Math.max(0, Math.round((row.effectiveTotal - receiptTotalPaid) * 100) / 100)
    : Math.max(0, balance);
  // When carry-forward was cleared in this session, the true balance for THIS month
  // is only (monthDue - paidToThisMonth). The adjustedBalance incorrectly subtracts
  // the carry payment from the month balance, showing a lower (wrong) number.
  const monthActualBalance = carryoverPaidInReceipt > 0
    ? Math.max(0, Math.round(((row.totalAmount ?? 0) - row.paidTotal) * 100) / 100)
    : adjustedBalance;

  const feeBodyContent = `
<table>
  <tr><td colspan="3" class="receipt-header-title">FEE RECEIPT</td></tr>
  <tr><td>Receipt No.</td><td style="font-size:10px;color:#888">${receiptNo}</td>##QR##</tr>
  <tr><td>Student Name</td><td>${student.studentName}</td></tr>
  <tr><td>Father's Name</td><td>${student.fatherName || "—"}</td></tr>
  <tr><td>Admission No.</td><td>${student.uniqueId || "—"}</td></tr>
  <tr><td>Class</td><td colspan="2">${student.className || ""} ${student.sectionName || ""}</td></tr>
  <tr><td>Month</td><td colspan="2">${row.label} ${row.mYear}</td></tr>
  <tr><td>Payment Date</td><td colspan="2">${payDate}</td></tr>
  <tr><td>Payment Mode</td><td colspan="2">${payMethod}${(() => { const m = String((row.payments as any[])?.[0]?.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/); return m ? ` <span style="font-size:10px;color:#64748b">(UTR: ****${m[1]})</span>` : ""; })()}</td></tr>
</table>
<table class="fee-table">
  <tbody>
  ${carryoverPaidInReceipt > 0 ? `
    <tr style="background:#fff7ed"><td colspan="3" style="font-weight:bold;padding:4px 8px;font-size:11.5px;border-top:1px solid #fed7aa;color:#92400e;letter-spacing:0.01em">⟳ Carry Forward Settlement (from ${carryoverFromLabel})</td></tr>
    <tr style="background:#fef9f0"><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#92400e;border-top:1px solid #fed7aa">Fee Type</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#92400e;text-align:center;border-top:1px solid #fed7aa">Have to Pay</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#92400e;text-align:right;border-top:1px solid #fed7aa">Paid Amount</td></tr>
    <tr style="background:#fffbeb"><td style="padding-left:20px;font-size:10.5px;color:#b45309">Outstanding balance cleared</td><td style="text-align:right;font-size:10.5px;color:#b45309;font-weight:bold">₹${carryoverPaidInReceipt.toFixed(2)}</td><td style="text-align:right;font-size:10.5px;color:#b45309;font-weight:bold">₹${carryoverPaidInReceipt.toFixed(2)}</td></tr>
    <tr style="background:#f0fdf4"><td colspan="3" style="font-weight:bold;padding:4px 8px;font-size:11.5px;border-top:1px solid #d1fae5;color:#166534;letter-spacing:0.01em">${row.label} ${row.mYear} — Current Month Fees</td></tr>
    <tr style="background:#f8fafc"><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569;border-top:1px solid #e2e8f0">Fee Type</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center;border-top:1px solid #e2e8f0">Have to Pay</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right;border-top:1px solid #e2e8f0">Paid Amount</td></tr>
  ` : (carryoverDue > 0 ? `<tr class="carry-row"><td>Carry Forward${carryoverFromLabel ? ` (from ${carryoverFromLabel})` : ""}</td><td style="text-align:center;font-size:10px;color:#475569">—</td><td style="text-align:right">₹${Math.round(carryoverDue).toFixed(2)}</td></tr>` : `<tr style="background:#f8fafc"><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569">Fee Type</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:center">Have to Pay</td><td style="padding:3px 8px;font-size:10px;font-weight:bold;color:#475569;text-align:right">Paid Amount</td></tr>`)}
  ${feeLines}
  </tbody>
</table>
<table>
  ${((carryoverPaidInReceipt > 0 ? carryoverPaidInReceipt : 0) + (row.totalAmount ?? 0)) > 0 ? `<tr class="due-row"><td>Total Due</td><td style="text-align:right">₹${((carryoverPaidInReceipt > 0 ? carryoverPaidInReceipt : 0) + (row.totalAmount ?? 0)).toFixed(2)}</td></tr>` : ""}
  <tr class="total-row"><td>Total Paid</td><td style="text-align:right">₹${receiptTotalPaid.toFixed(2)}</td></tr>
  ${monthActualBalance > 0 ? `<tr class="balance-row"><td>Balance Remaining → Carry Forward to Next Month</td><td style="text-align:right">₹${monthActualBalance.toFixed(2)}</td></tr>` : (adjustedBalance > 0 ? `<tr class="balance-row"><td>Balance Remaining</td><td style="text-align:right">₹${adjustedBalance.toFixed(2)}</td></tr>` : `<tr><td colspan="2" style="text-align:center;color:#16a34a;font-weight:bold;">✓ Fully Paid</td></tr>`)}
</table>`;

  const generatedBy = getReceiptGeneratedByLabel((row.payments as any[] ?? []).map((p: any) => p.collectedBy));
  const parentCopyF = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "Parent Copy", receiptNo, bodyContent: feeBodyContent, generatedBy });
  const schoolCopyF = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "School Copy", receiptNo, bodyContent: feeBodyContent, generatedBy });
  const _fKey = `receipt_print_${receiptNo}`;
  const _fCount = parseInt(localStorage.getItem(_fKey) || "0", 10) + 1;
  localStorage.setItem(_fKey, String(_fCount));
  const isDuplicateF = _fCount > 1;

  const html = `<!DOCTYPE html><html><head><title>Fee Receipt</title>
<style>${RECEIPT_PRINT_CSS}</style></head><body>
<div class="pair">
  ${parentCopyF}
  <div class="divider"></div>
  ${schoolCopyF}
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
try {
  ["Parent-Copy","School-Copy"].forEach(function(id) {
    var el = document.getElementById("qr-"+id);
    if (el) new QRCode(el, { text: "${receiptNo}", width: 44, height: 44, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.M });
  });
} catch(e) {}
if (${isDuplicateF}) {
  document.querySelectorAll('.receipt-inner').forEach(function(el) {
    var w = document.createElement('div');
    w.className = 'watermark'; w.textContent = 'DUPLICATE';
    el.appendChild(w);
  });
}
${RECEIPT_AUTO_FIT_JS}
setTimeout(function() { window.print(); }, 700);
</script>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

async function printCarryNowReceipt(row: any, cfNowPay: any, student: any, kind: "CFNOW" | "STLMT" = "CFNOW") {
  const { schoolName, schoolAddress, schoolPhone, receiptFooter, logoUrl } = await fetchSchoolInfo();

  const oldReceiptNo = row.receiptNo || (row.payments?.[0]?.receiptNo) || "—";
  const oldDate = formatDate(row.payments?.[0]?.paymentDate) || "—";
  const oldMethod = (row.payments?.[0]?.paymentMethod || "Cash");
  const oldPaid = row.paidTotal ?? 0;
  const cfAmt = parseFloat(String(cfNowPay?.paidAmount ?? "0"));
  const cfDate = formatDate(cfNowPay?.paymentDate) || new Date().toLocaleDateString("en-IN");
  const cfMethod = cfNowPay?.paymentMethod || "Cash";
  const cfReceiptNo = cfNowPay?.receiptNo || "—";
  const totalPaid = Math.round((oldPaid + cfAmt) * 100) / 100;
  const totalDue = row.totalAmount ?? 0;

  const catRows = ((row.payments as any[]) ?? [])
    .filter((p: any) => parseFloat(p.paidAmount ?? "0") > 0 && !p.isPreviousDue)
    .map((p: any) =>
      `<tr><td style="padding-left:12px">${p.categoryName || "Fee"}</td><td style="text-align:right">₹${parseFloat(p.paidAmount ?? "0").toFixed(2)}</td></tr>`
    ).join("");

  const utrMatch = String(cfNowPay?.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/);
  const utrNote = utrMatch ? ` (UTR: ****${utrMatch[1]})` : "";
  const oldUtrMatch = String((row.payments as any[])?.[0]?.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/);
  const oldUtrNote = oldUtrMatch ? ` (UTR: ****${oldUtrMatch[1]})` : "";

  const isStlmt = kind === "STLMT";
  const _receiptTitle = isStlmt ? "FEE RECEIPT — SETTLEMENT OF STUCK DUE" : "FEE RECEIPT — CARRY-FORWARD CLEARANCE";
  const _sectionHeader = isStlmt
    ? `Stuck Due Settled — ${cfDate} | ${cfMethod}${utrNote}`
    : `Carry-Forward Cleared — ${cfDate} | ${cfMethod}${utrNote}`;
  const _balanceLbl = isStlmt
    ? `Stuck Balance Due (${row.label} ${row.mYear})`
    : `Balance Due (${row.label} ${row.mYear})`;
  const _totalLbl = isStlmt ? "Stuck Due Amount Settled" : "Carry-Forward Amount Cleared";

  const bodyContent = `
<table>
  <tr><td colspan="3" class="receipt-header-title">${_receiptTitle}</td></tr>
  <tr><td>Receipt No.</td><td colspan="2" style="font-size:10px;color:#888">${cfReceiptNo}</td></tr>
  <tr><td>Student Name</td><td colspan="2">${student.studentName}</td></tr>
  <tr><td>Father's Name</td><td colspan="2">${student.fatherName || "—"}</td></tr>
  <tr><td>Admission No.</td><td colspan="2">${student.uniqueId || "—"}</td></tr>
  <tr><td>Class</td><td colspan="2">${student.className || ""} ${student.sectionName || ""}</td></tr>
  <tr><td>Month</td><td colspan="2">${row.label} ${row.mYear}</td></tr>
</table>
<table class="fee-table">
  <thead><tr><th colspan="2" style="background:#dbeafe;color:#1d4ed8;font-weight:bold;text-align:left;padding:4px 8px">Original Payment — ${oldDate} | Receipt: ${oldReceiptNo} | ${oldMethod}${oldUtrNote}</th></tr></thead>
  <tbody>
    ${catRows || `<tr><td style="padding-left:12px">Fee</td><td style="text-align:right">₹${oldPaid.toFixed(2)}</td></tr>`}
    <tr style="background:#eff6ff"><td style="font-weight:bold;color:#1d4ed8">Original Subtotal</td><td style="text-align:right;font-weight:bold;color:#1d4ed8">₹${oldPaid.toFixed(2)}</td></tr>
  </tbody>
</table>
<table class="fee-table">
  <thead><tr><th colspan="2" style="background:#fef3c7;color:#b45309;font-weight:bold;text-align:left;padding:4px 8px">${_sectionHeader}</th></tr></thead>
  <tbody>
    <tr><td style="padding-left:12px;color:#b45309">${_balanceLbl}</td><td style="text-align:right;color:#b45309;font-weight:bold">₹${cfAmt.toFixed(2)}</td></tr>
    <tr style="background:#fef3c7"><td style="font-weight:bold;color:#b45309">${_totalLbl}</td><td style="text-align:right;font-weight:bold;color:#b45309">₹${cfAmt.toFixed(2)}</td></tr>
  </tbody>
</table>
<table>
  ${totalDue > 0 ? `<tr class="due-row"><td>Total Due</td><td style="text-align:right">₹${totalDue.toFixed(2)}</td></tr>` : ""}
  <tr class="total-row"><td style="font-size:13px">Total Paid (Combined)</td><td style="text-align:right;font-size:13px">₹${totalPaid.toFixed(2)}</td></tr>
  <tr><td colspan="2" style="text-align:center;color:#16a34a;font-weight:bold;padding:6px">✓ Fully Paid</td></tr>
</table>`;

  const generatedBy = getReceiptGeneratedByLabel([cfNowPay?.collectedBy, row.payments?.[0]?.collectedBy]);
  const receiptNo = cfReceiptNo;
  const parentCopy = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "Parent Copy", receiptNo, bodyContent, generatedBy });
  const schoolCopy = makeReceiptCopy({ schoolName, schoolAddress, schoolPhone, logoUrl, receiptFooter, copyLabel: "School Copy", receiptNo, bodyContent, generatedBy });
  const _fKey = `receipt_print_${receiptNo}`;
  const _fCount = parseInt(localStorage.getItem(_fKey) || "0", 10) + 1;
  localStorage.setItem(_fKey, String(_fCount));
  const isDuplicate = _fCount > 1;

  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — Carry-Forward Clearance</title>
<style>${RECEIPT_PRINT_CSS}</style></head><body>
<div class="pair">
  ${parentCopy}
  <div class="divider"></div>
  ${schoolCopy}
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
try {
  ["Parent-Copy","School-Copy"].forEach(function(id) {
    var el = document.getElementById("qr-"+id);
    if (el) new QRCode(el, { text: "${receiptNo}", width: 44, height: 44, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.M });
  });
} catch(e) {}
if (${isDuplicate}) {
  document.querySelectorAll('.receipt-inner').forEach(function(el) {
    var w = document.createElement('div');
    w.className = 'watermark'; w.textContent = 'DUPLICATE';
    el.appendChild(w);
  });
}
${RECEIPT_AUTO_FIT_JS}
setTimeout(function() { window.print(); }, 700);
</script>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

const StudentFeeDetailView = React.memo(function StudentFeeDetailView({
  student, session, year, categories, structures, allPayments, classes, sections, allStudents, onBack, onCollected, onNavigateToStudent,
}: {
  student: any; session: string; year: number;
  categories: any[]; structures: any[]; allPayments: any[];
  classes: any[]; sections: any[];
  allStudents: any[];
  onBack: () => void; onCollected: () => void;
  onNavigateToStudent: (s: any) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prevDueSelected, setPrevDueSelected] = useState(false);
  const [prevDuePartialAmt, setPrevDuePartialAmt] = useState("");
  const [prevDueExpanded, setPrevDueExpanded] = useState(false);
  const [prevDueSelectedMonths, setPrevDueSelectedMonths] = useState<Set<number>>(new Set());
  const [payMode, setPayMode] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmounts, setPartialAmounts] = useState<Map<string, string>>(new Map());
  const [prevDueMonthPartialAmts, setPrevDueMonthPartialAmts] = useState<Map<number, string>>(new Map());
  const [stuckPayRow, setStuckPayRow] = useState<any>(null);
  const [stuckPayAmount, setStuckPayAmount] = useState("");
  const [stuckPayMode, setStuckPayMode] = useState("cash");
  const [stuckUtrLast4, setStuckUtrLast4] = useState("");
  const [carryPayRow, setCarryPayRow] = useState<any>(null);
  const [carryPayMode, setCarryPayMode] = useState("cash");
  const [carryUtrLast4, setCarryUtrLast4] = useState("");
  const [sendGmail, setSendGmail] = useState(true);
  const [autoPrint, setAutoPrint] = useState(true);
  const [utrLast4, setUtrLast4] = useState("");
  const transportCatIdRef = useRef<number | null>(null);

  // Per-student payments — used for all student-scoped computations (monthRows, prevYearDue,
  // duplicate detection, etc.). Avoids heavy re-computation whenever the global allPayments
  // array (still used for cross-student UTR checks and sibling balance) is refreshed after
  // unrelated mutations. Mutations invalidate getListFeePaymentsQueryKey broadly, so this
  // stays in sync automatically.
  const { data: ownPayments = [] } = useListFeePayments(
    { studentId: student.id, session } as any,
    { query: { queryKey: getListFeePaymentsQueryKey({ studentId: student.id, session } as any), staleTime: 30_000 } }
  );

  // ─── UTR duplicate detection (main collection) ───
  const utrDuplicate = useMemo(() => {
    if (payMode !== "online" || utrLast4.length !== 4) return null;
    const pattern = `UTR:****${utrLast4}`;
    const match = (allPayments as any[]).find((p: any) =>
      p.remarks && String(p.remarks).includes(pattern)
    );
    if (!match) return null;
    return {
      receiptNo: match.receiptNo ?? "—",
      studentName: match.studentName ?? "another student",
      paymentDate: match.paymentDate ?? "—",
    };
  }, [utrLast4, payMode, allPayments]);

  // ─── UTR duplicate detection (stuck pay dialog) ───
  const stuckUtrDuplicate = useMemo(() => {
    if (stuckPayMode !== "online" || stuckUtrLast4.length !== 4) return null;
    const pattern = `UTR:****${stuckUtrLast4}`;
    const match = (allPayments as any[]).find((p: any) =>
      p.remarks && String(p.remarks).includes(pattern)
    );
    if (!match) return null;
    return {
      receiptNo: match.receiptNo ?? "—",
      studentName: match.studentName ?? "another student",
      paymentDate: match.paymentDate ?? "—",
    };
  }, [stuckUtrLast4, stuckPayMode, allPayments]);

  // ─── UTR duplicate detection (carry-forward pay now dialog) ───
  const carryUtrDuplicate = useMemo(() => {
    if (carryPayMode !== "online" || carryUtrLast4.length !== 4) return null;
    const pattern = `UTR:****${carryUtrLast4}`;
    const match = (allPayments as any[]).find((p: any) =>
      p.remarks && String(p.remarks).includes(pattern)
    );
    if (!match) return null;
    return {
      receiptNo: match.receiptNo ?? "—",
      studentName: match.studentName ?? "another student",
      paymentDate: match.paymentDate ?? "—",
    };
  }, [carryUtrLast4, carryPayMode, allPayments]);

  const collectFee = useCollectFee({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey(), exact: false }) } });
  const deletePayment = useDeleteFeePayment({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey(), exact: false }) } });

  async function handleDeletePrevYearDuePayment(pydPay: any, label: string) {
    if (!window.confirm(`Delete this previous year due receipt (₹${parseFloat(String(pydPay.paidAmount ?? "0")).toFixed(2)}) for ${student.studentName}?\n\nThis cannot be undone.`)) return;
    await deletePayment.mutateAsync({ id: pydPay.id });
    toast({ title: `Previous year due receipt deleted` });
    logAudit({
      action: "fee_deleted",
      description: `Deleted prev year due receipt for ${student.studentName} — ${label} (₹${parseFloat(String(pydPay.paidAmount ?? "0")).toFixed(2)})`,
      entityType: "fee_payment",
      metadata: { studentName: student.studentName, month: label, amount: parseFloat(String(pydPay.paidAmount ?? "0")).toFixed(2) },
    });
    onCollected();
  }

  async function handleDeleteMonthPayments(row: any) {
    const pays = (row.payments as any[]) ?? [];
    const carryPays = (row.carryoverPayments as any[]) ?? [];

    // Also find carry-forward payments that were created in the SAME session as this month's
    // collection. They are stored under the previous month (isPreviousDue=true) with
    // receiptNo ending in `-{row.m}-PREV` (set by the collection code at save time).
    const prevSuffix = `-${row.m}-PREV`;
    const linkedCarryPays = (ownPayments as any[]).filter(
      (p: any) =>
        p.isPreviousDue === true &&
        String(p.receiptNo ?? "").endsWith(prevSuffix)
    );

    // Deduplicate by id in case of any overlap
    const allPays = [
      ...new Map(
        [...pays, ...carryPays, ...linkedCarryPays].map((p) => [p.id, p])
      ).values(),
    ];
    if (allPays.length === 0) return;

    const hasLinked = linkedCarryPays.length > 0;
    const linkedAmt = linkedCarryPays.reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0);
    const confirmMsg = [
      `Delete ALL payment records for ${row.label}${row.mYear ? " " + row.mYear : ""} for ${student.studentName}?`,
      hasLinked
        ? `\nThis will also remove the carry-forward clearance of ₹${linkedAmt.toFixed(2)} from the previous month that was paid in this session.`
        : "",
      `\nThis cannot be undone.`,
    ].join("");

    if (!window.confirm(confirmMsg)) return;
    for (const p of allPays) {
      await deletePayment.mutateAsync({ id: p.id });
    }
    toast({ title: `Payment records deleted for ${row.label}${hasLinked ? " (carry-forward also removed)" : ""}` });
    logAudit({
      action: "fee_deleted",
      description: `Deleted fee receipt for ${student.studentName} — ${row.label}${row.mYear ? " " + row.mYear : ""} (₹${row.paidTotal?.toFixed(2) ?? "?"})${hasLinked ? ` + carry-forward ₹${linkedAmt.toFixed(2)}` : ""}`,
      entityType: "fee_payment",
      metadata: {
        studentName: student.studentName,
        month: row.label,
        year: row.mYear ?? "",
        amount: row.paidTotal?.toFixed(2) ?? "?",
        carryForwardAlsoDeleted: hasLinked,
        carryForwardAmount: hasLinked ? linkedAmt.toFixed(2) : "0",
      },
    });
    onCollected();
  }

  const _stuTypeLC = (student.studentType ?? "").toLowerCase();
  const isRTE = _stuTypeLC.includes("rte");
  const isNew = _stuTypeLC.includes("new");
  const isDropped = _stuTypeLC.includes("dropped");
  const isPromoted = student.isPromoted === true;
  const cls = classes.find((c: any) => c.id === student.classId);
  const sec = sections.find((s: any) => s.id === student.sectionId);

  // Siblings: students sharing the same parent email AND father name (excluding self)
  const siblings = useMemo(() => {
    const email = (student.parentEmail ?? "").trim().toLowerCase();
    const father = (student.fatherName ?? "").trim().toLowerCase();
    if (!email || !father) return [];
    return allStudents.filter((s: any) => {
      if (s.id === student.id) return false;
      return (
        (s.parentEmail ?? "").trim().toLowerCase() === email &&
        (s.fatherName ?? "").trim().toLowerCase() === father
      );
    });
  }, [allStudents, student.id, student.parentEmail, student.fatherName]);

  // Unpaid balance for each sibling up to the current running month
  const siblingBalances = useMemo<Record<number, number>>(() => {
    const now = new Date();
    const currentM = now.getMonth() + 1;
    const currentMIdx = SCHOOL_MONTHS_ORDER.indexOf(currentM);
    const result: Record<number, number> = {};

    for (const sib of siblings) {
      // Tuition structs for sib's class (non-transport, non-admission)
      const sibStructs = structures.filter((s: any) => {
        if (s.classId !== sib.classId) return false;
        const cat = categories.find((c: any) => c.id === s.categoryId);
        const cn = (cat?.name ?? "").toLowerCase();
        return !cn.includes("transport") && !cn.includes("bus") && !cn.includes("admission");
      });

      // Transport
      const sibHasTransport = sib.transportRouteId && sib.transportRoutePricePerMonth;
      const sibTransportAmt = sibHasTransport ? parseFloat(String(sib.transportRoutePricePerMonth)) || 0 : 0;
      const sibTransportFrom: number = (sib as any).transportFromMonth ?? 4;
      const sibTransportStop: number | null = (sib as any).transportStopMonth ?? null;

      // Admission fee
      const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
      const sibAdmStruct = admCat ? structures.find((s: any) => s.categoryId === admCat.id && s.classId === sib.classId) : null;
      const _sibTypeLC = (sib.studentType ?? "").toLowerCase();
      const sibIsNew = _sibTypeLC.includes("new");
      const sibIsRTE = _sibTypeLC.includes("rte");
      const sibAdmFee = (sibIsNew && sibAdmStruct) ? parseFloat(String(sibAdmStruct.amount)) || 0 : 0;

      // Visible months for sib
      let sibVisibleMonths: number[];
      if (sib.feeFromApril) {
        sibVisibleMonths = SCHOOL_MONTHS_ORDER;
      } else if (sib.admissionDate) {
        const parts = String(sib.admissionDate).split("-");
        const am = parseInt(parts[1] || "0");
        const si = am > 0 ? SCHOOL_MONTHS_ORDER.indexOf(am) : -1;
        sibVisibleMonths = si >= 0 ? SCHOOL_MONTHS_ORDER.slice(si) : SCHOOL_MONTHS_ORDER;
      } else {
        sibVisibleMonths = SCHOOL_MONTHS_ORDER;
      }

      // Only months up to and including the current month
      const monthsUntilNow = sibVisibleMonths.filter(m => SCHOOL_MONTHS_ORDER.indexOf(m) <= currentMIdx);

      let totalDueNow = 0;
      let totalPaidNow = 0;

      monthsUntilNow.forEach((m: number, relIdx: number) => {
        const mYear = m >= 4 ? year : year + 1;
        const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m);

        // Tuition for this month
        let tuitionAmt = 0;
        if (!sibIsRTE) {
          tuitionAmt = sibStructs.reduce((sum: number, s: any) => {
            const amt = parseFloat(String(s.amount)) || 0;
            const freq = (s.frequency || "monthly").toLowerCase();
            if (freq === "monthly") return sum + amt;
            if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
            if (freq === "annually") return schoolYearIdx === 0 ? sum + amt : sum;
            if (freq === "one-time") {
              if (relIdx !== 0) return sum;
              const alreadyPaid = allPayments.some((p: any) => p.studentId === sib.id && p.categoryId === s.categoryId && !p.isPreviousDue);
              return alreadyPaid ? sum : sum + amt;
            }
            return sum + amt;
          }, 0);
        }

        // Transport for this month
        let monthTransport = 0;
        if (sibHasTransport && sibTransportAmt > 0) {
          const fromIdx = SCHOOL_MONTHS_ORDER.indexOf(sibTransportFrom);
          const mIdx = SCHOOL_MONTHS_ORDER.indexOf(m);
          if (fromIdx >= 0 && mIdx >= fromIdx) {
            if (sibTransportStop !== null) {
              const stopIdx = SCHOOL_MONTHS_ORDER.indexOf(sibTransportStop);
              monthTransport = (stopIdx >= 0 && mIdx < stopIdx) ? sibTransportAmt : 0;
            } else {
              monthTransport = sibTransportAmt;
            }
          }
        }

        const admFee = relIdx === 0 ? sibAdmFee : 0;
        totalDueNow += tuitionAmt + monthTransport + admFee;

        // Paid (regular)
        const paid = allPayments
          .filter((p: any) => p.studentId === sib.id && p.month === m && !p.isPreviousDue &&
            (m >= 4 ? p.year === year : p.year === year + 1))
          .reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
        // Carryover paid
        const carryoverPaid = allPayments
          .filter((p: any) => p.studentId === sib.id && p.month === m && p.isPreviousDue === true &&
            (m >= 4 ? p.year === year : p.year === year + 1))
          .reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
        totalPaidNow += paid + carryoverPaid;
      });

      // Previous year due
      const prevDue = parseFloat(String((sib as any).previousYearDue || "0")) || 0;
      const prevPaid = allPayments
        .filter((p: any) => p.studentId === sib.id && p.isPreviousDue === true && p.month === 0)
        .reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
      totalDueNow += prevDue;
      totalPaidNow += prevPaid;

      result[sib.id] = Math.max(0, totalDueNow - totalPaidNow);
    }
    return result;
  }, [siblings, structures, categories, allPayments, year]);

  // Tuition structures: non-transport, non-admission fee structures for this student's class
  const tuitionStructs = useMemo(() => structures.filter((s: any) => {
    if (s.classId !== student.classId) return false;
    const cat = categories.find((c: any) => c.id === s.categoryId);
    const cn = (cat?.name ?? "").toLowerCase();
    return !cn.includes("transport") && !cn.includes("bus") && !cn.includes("admission");
  }), [structures, student.classId, categories]);

  // Admission fee — only for "New" student type, only in the first eligible month
  const admissionCat = useMemo(() => categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission")), [categories]);
  const admissionStruct = useMemo(() => admissionCat
    ? structures.find((s: any) => s.categoryId === admissionCat.id && s.classId === student.classId)
    : null, [admissionCat, structures, student.classId]);
  const admissionFeeAmount = (isNew && admissionStruct) ? parseFloat(String(admissionStruct.amount)) || 0 : 0;

  // Transport fee base rate — per-month activation checked inside monthRows
  const hasTransport = student.transportRouteId && student.transportRoutePricePerMonth;
  const transportAmount = hasTransport ? parseFloat(String(student.transportRoutePricePerMonth)) || 0 : 0;
  const transportFromMonth: number = (student as any).transportFromMonth ?? 4;
  const transportStopMonth: number | null = (student as any).transportStopMonth ?? null;

  // Determine which months to show based on feeFromApril flag
  const admissionMonth = useMemo(() => {
    if (!student.admissionDate) return null;
    const parts = String(student.admissionDate).split("-");
    const m = parseInt(parts[1] || "0");
    return m > 0 ? m : null;
  }, [student.admissionDate]);

  const visibleMonthsOrder = useMemo(() => {
    if (student.feeFromApril) return SCHOOL_MONTHS_ORDER;
    if (!admissionMonth) {
      const now = new Date();
      const currentM = now.getMonth() + 1;
      const curIdx = SCHOOL_MONTHS_ORDER.indexOf(currentM);
      return curIdx >= 0 ? SCHOOL_MONTHS_ORDER.slice(curIdx) : SCHOOL_MONTHS_ORDER;
    }
    const startIdx = SCHOOL_MONTHS_ORDER.indexOf(admissionMonth);
    return startIdx >= 0 ? SCHOOL_MONTHS_ORDER.slice(startIdx) : SCHOOL_MONTHS_ORDER;
  }, [student.feeFromApril, admissionMonth]);

  const visibleMonthLabels = useMemo(() => {
    return visibleMonthsOrder.map((m: number) => SCHOOL_MONTH_LABELS[SCHOOL_MONTHS_ORDER.indexOf(m)]);
  }, [visibleMonthsOrder]);

  // Per-month tuition amounts — respects each category's frequency
  // Quarterly: due in Apr, Jul, Oct, Jan (indices 0,3,6,9 in SCHOOL_MONTHS_ORDER)
  // Annually:  due in Apr only (school year index 0)
  // One-time:  due in the student's first visible month, only if not yet paid for that category
  // Monthly:   due every month (unchanged)
  const tuitionAmountByMonthIdx = useMemo(() => {
    return visibleMonthsOrder.map((m: number, idx: number) => {
      if (isRTE) return 0;
      const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m); // 0=Apr … 11=Mar
      return tuitionStructs.reduce((sum: number, s: any) => {
        const amt = parseFloat(String(s.amount)) || 0;
        const freq = (s.frequency || "monthly").toLowerCase();
        if (freq === "monthly") return sum + amt;
        if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
        if (freq === "annually")  return schoolYearIdx === 0 ? sum + amt : sum;
        if (freq === "one-time") {
          if (idx !== 0) return sum;
          const paid = ownPayments.some(
            (p: any) => p.categoryId === s.categoryId && !p.isPreviousDue
          );
          return paid ? sum : sum + amt;
        }
        return sum + amt;
      }, 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRTE, tuitionStructs, visibleMonthsOrder, ownPayments]);

  // Month rows: respect feeFromApril and student type
  const monthRows = useMemo(() => {
    const baseRows = visibleMonthsOrder.map((m: number, idx: number) => {
      const mYear = m >= 4 ? year : year + 1;
      const key = `${m}-${mYear}`;
      // Regular payments for this month (not carryover entries)
      const monthPayments = ownPayments.filter(
        (p: any) => p.month === m && !p.isPreviousDue &&
          (m >= 4 ? p.year === year : p.year === year + 1)
      );
      // Payments recorded for this month as previous-due clearance (from next month's collection)
      const carryoverPayments = ownPayments.filter(
        (p: any) => p.month === m && p.isPreviousDue === true &&
          (m >= 4 ? p.year === year : p.year === year + 1)
      );
      const paidTotal = Math.round(monthPayments.reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0) * 100) / 100;
      const carryoverPaid = Math.round(carryoverPayments.reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0) * 100) / 100;
      const thisMonthAdmFee = idx === 0 ? admissionFeeAmount : 0;
      // Per-month transport: active from transportFromMonth; stops at transportStopMonth (if set)
      const monthTransportAmt = (() => {
        if (!hasTransport || !transportAmount) return 0;
        const fromIdx = SCHOOL_MONTHS_ORDER.indexOf(transportFromMonth);
        const mIdx = SCHOOL_MONTHS_ORDER.indexOf(m);
        if (fromIdx < 0 || mIdx < 0 || mIdx < fromIdx) return 0;
        if (transportStopMonth !== null) {
          const stopIdx = SCHOOL_MONTHS_ORDER.indexOf(transportStopMonth);
          return (stopIdx >= 0 && mIdx < stopIdx) ? transportAmount : 0;
        }
        // No stop month recorded: fee applies for all months from fromMonth (active or legacy)
        return transportAmount;
      })();
      const totalAmount = (tuitionAmountByMonthIdx[idx] ?? 0) + monthTransportAmt + thisMonthAdmFee;
      // Round to 2 decimal places to prevent floating-point artifacts (e.g. 0.000001 ≠ 0)
      const balance = Math.round(Math.max(0, totalAmount - paidTotal - carryoverPaid) * 100) / 100;
      const isPaid = totalAmount > 0 && balance <= 0;
      // isPartial: some paid but not fully paid — checkbox locked, due auto-carries to next month
      const isPartial = !isPaid && paidTotal > 0 && totalAmount > 0;
      const receiptNo = monthPayments[0]?.receiptNo || "";
      return {
        m, label: visibleMonthLabels[idx], mYear, key,
        tuitionAmount: tuitionAmountByMonthIdx[idx] ?? 0, transportAmount: monthTransportAmt, admissionFee: thisMonthAdmFee,
        totalAmount, paidTotal, carryoverPaid, balance, isPaid, isPartial,
        receiptNo, payments: monthPayments, carryoverPayments,
        // Filled in second pass below:
        carryoverDue: 0, carryoverFromLabel: "", carryoverFromM: 0, carryoverFromMYear: 0,
        effectiveTotal: totalAmount,
      };
    });
    // Sequential pass: if a month is partial, carry its remaining balance into the next month
    for (let i = 1; i < baseRows.length; i++) {
      const prev = baseRows[i - 1];
      if (prev.isPartial && prev.balance > 0) {
        baseRows[i].carryoverDue = prev.balance;
        baseRows[i].carryoverFromLabel = prev.label;
        baseRows[i].carryoverFromM = prev.m;
        baseRows[i].carryoverFromMYear = prev.mYear;
        baseRows[i].effectiveTotal = baseRows[i].totalAmount + prev.balance;
      }
    }
    return baseRows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownPayments, year, tuitionAmountByMonthIdx, transportAmount, admissionFeeAmount, visibleMonthsOrder, visibleMonthLabels, transportFromMonth, transportStopMonth, student.hasVehicle]);

  const totalDue = monthRows.reduce((s, r) => s + r.totalAmount, 0);
  const totalCarryoverPaid = monthRows.reduce((s, r) => s + (r.carryoverPaid ?? 0), 0);
  const totalPaid = monthRows.reduce((s, r) => s + r.paidTotal + (r.carryoverPaid ?? 0), 0);
  const totalBalance = monthRows.reduce((s, r) => s + r.balance, 0);
  // Partial months are locked — due auto-carries to next month, cannot be re-selected
  // Promoted students cannot collect fees in source session — all months locked
  const selectableRows = isPromoted ? [] : monthRows.filter(r => !r.isPaid && !r.isPartial && r.totalAmount > 0);

  // Detect "stuck" partial months: a partial month whose carry-forward can't apply
  // because the immediately next month is already paid (or it's the last month).
  // These rows need a direct "Pay Remaining" button since normal carry-forward is blocked.
  const stuckMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < monthRows.length; i++) {
      const row = monthRows[i];
      if (!row.isPartial || row.balance <= 0) continue;
      const nextRow = monthRows[i + 1];
      if (!nextRow || nextRow.isPaid) {
        keys.add(row.key);
      }
    }
    return keys;
  }, [monthRows]);

  // Previous Year Due row
  const prevYearDueAmount = parseFloat(String((student as any).previousYearDue || "0")) || 0;
  const prevYearDueRemarks = (student as any).previousYearDueRemarks || "";
  const prevYearDuePayments = ownPayments.filter((p: any) => p.isPreviousDue === true && p.month === 0);
  const prevYearDuePaid = prevYearDuePayments.reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
  const prevYearDueBalance = Math.max(0, prevYearDueAmount - prevYearDuePaid);
  const prevYearDueClearedFull = prevYearDueAmount > 0 && prevYearDueBalance <= 0;
  const prevYearDueIsPartial = !prevYearDueClearedFull && prevYearDuePaid > 0 && prevYearDueAmount > 0;

  // Monthly breakdown parsing (new format)
  const prevYearMonthlyAmounts: Record<number, number> = useMemo(() => {
    try {
      if (prevYearDueRemarks && prevYearDueRemarks.startsWith("{")) {
        const parsed = JSON.parse(prevYearDueRemarks) as Record<string, number>;
        const result: Record<number, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          result[parseInt(k)] = parseFloat(String(v)) || 0;
        }
        return result;
      }
    } catch { /* ignore */ }
    return {};
  }, [prevYearDueRemarks]);
  const hasPrevYearMonthly = Object.keys(prevYearMonthlyAmounts).length > 0;

  // Get payments for a specific month of previous year due
  function getPrevMonthPayments(monthNum: number) {
    return prevYearDuePayments.filter((p: any) => String(p.remarks || "").includes(`PYD-MONTH:${monthNum}`));
  }
  function getPrevMonthBalance(monthNum: number): number {
    const monthAmt = prevYearMonthlyAmounts[monthNum] || 0;
    const paid = getPrevMonthPayments(monthNum).reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
    return Math.max(0, monthAmt - paid);
  }
  function isPrevMonthPaid(monthNum: number): boolean {
    const monthAmt = prevYearMonthlyAmounts[monthNum] || 0;
    return monthAmt > 0 && getPrevMonthBalance(monthNum) <= 0;
  }

  function toggleRow(key: string) {
    setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }
  function toggleAll() {
    if (selected.size === selectableRows.length) setSelected(new Set());
    else setSelected(new Set(selectableRows.map(r => r.key)));
  }

  async function getTransportCategoryId(): Promise<number | null> {
    if (transportCatIdRef.current !== null) return transportCatIdRef.current;
    try {
      const res = await fetch("/api/fees/transport-category");
      const data = await res.json();
      transportCatIdRef.current = data.id;
      return data.id;
    } catch { return null; }
  }

  // Pay the carry-forward due balance of a partial month directly (non-stuck)
  async function handlePayCarryNow() {
    if (!carryPayRow) return;
    const finalAmt = carryPayRow.balance;
    if (finalAmt <= 0) return;
    setIsSubmitting(true);
    try {
      const catId = tuitionStructs[0]?.categoryId ?? (await getTransportCategoryId());
      if (!catId) { toast({ title: "No fee category found", variant: "destructive" }); return; }
      const payDate = new Date().toISOString().split("T")[0];
      const receiptBase = `RCP-${Date.now()}`;
      const utrSuffix = carryPayMode === "online" && carryUtrLast4 ? ` [UTR:****${carryUtrLast4}]` : "";
      await collectFee.mutateAsync({
        data: {
          studentId: student.id,
          categoryId: catId,
          amount: carryPayRow.balance,
          paidAmount: finalAmt,
          discount: 0, fine: 0,
          status: "paid",
          month: carryPayRow.m,
          year: carryPayRow.mYear,
          session,
          paymentDate: payDate,
          paymentMethod: carryPayMode,
          receiptNo: `${receiptBase}-${carryPayRow.m}-CFNOW`,
          remarks: `Carry-forward direct clearance for ${carryPayRow.label} ${carryPayRow.mYear}${utrSuffix}`,
          isPreviousDue: true,
          collectedBy: getGeneratedByLabel(),
          sendReceipt: false,
        }
      });
      toast({ title: `₹${finalAmt.toFixed(0)} carry-forward cleared for ${carryPayRow.label} ${carryPayRow.mYear}` });
      setCarryPayRow(null);
      setCarryPayMode("cash");
      setCarryUtrLast4("");
      onCollected();
    } catch { toast({ title: "Payment failed", variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  }

  // Pay the remaining stuck balance of a partial month directly
  async function handlePayStuck() {
    if (!stuckPayRow) return;
    const inputAmt = stuckPayAmount ? parseFloat(stuckPayAmount) : NaN;
    const finalAmt = (!isNaN(inputAmt) && inputAmt > 0 && inputAmt <= stuckPayRow.balance)
      ? inputAmt
      : stuckPayRow.balance;
    if (finalAmt <= 0) return;
    setIsSubmitting(true);
    try {
      const catId = tuitionStructs[0]?.categoryId ?? (await getTransportCategoryId());
      if (!catId) { toast({ title: "No fee category found", variant: "destructive" }); return; }
      const payDate = new Date().toISOString().split("T")[0];
      const receiptBase = `RCP-${Date.now()}`;
      const stuckUtrSuffix = stuckPayMode === "online" && stuckUtrLast4 ? ` [UTR:****${stuckUtrLast4}]` : "";
      await collectFee.mutateAsync({
        data: {
          studentId: student.id,
          categoryId: catId,
          amount: stuckPayRow.balance,
          paidAmount: finalAmt,
          discount: 0, fine: 0,
          status: finalAmt >= stuckPayRow.balance ? "paid" : "partial",
          month: stuckPayRow.m,
          year: stuckPayRow.mYear,
          session,
          paymentDate: payDate,
          paymentMethod: stuckPayMode,
          receiptNo: `${receiptBase}-${stuckPayRow.m}-STLMT`,
          remarks: `Settlement of stuck due for ${stuckPayRow.label} ${stuckPayRow.mYear}${stuckUtrSuffix}`,
          isPreviousDue: true,
          collectedBy: getGeneratedByLabel(),
          sendReceipt: false,
        }
      });
      toast({ title: `₹${finalAmt.toFixed(0)} collected for ${stuckPayRow.label} ${stuckPayRow.mYear}` });
      setStuckPayRow(null);
      setStuckPayAmount("");
      setStuckUtrLast4("");
      setStuckPayMode("cash");
      onCollected();
    } catch { toast({ title: "Payment failed", variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  }

  function openWhatsApp(row: typeof monthRows[0]) {
    if (!student.whatsappNumber) return;
    const ph = student.whatsappNumber.replace(/\D/g, "");
    const dueNote = row.isPartial && row.balance > 0
      ? `\nBalance Due: ${currencyFmt(row.balance)} (auto-adjusted in next month's fee)`
      : "";
    const msg = encodeURIComponent(
      `Dear Parent,\n\nFee details for ${row.label} ${row.mYear}:\n` +
      `Student: ${student.studentName}\nAmount Paid: ${currencyFmt(row.paidTotal)}` +
      dueNote +
      `\nReceipt No: ${row.receiptNo || "N/A"}` +
      `\n\nThank you!`
    );
    window.open(`https://wa.me/${ph}?text=${msg}`, "_blank");
  }

  function openWhatsAppForPrevDue(payment: any) {
    if (!student.whatsappNumber) return;
    const ph = student.whatsappNumber.replace(/\D/g, "");
    const paidAmt = parseFloat(String(payment.paidAmount ?? "0"));
    const runningPaid = prevYearDuePayments
      .filter((p: any) => new Date(p.createdAt) <= new Date(payment.createdAt))
      .reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0);
    const remaining = Math.max(0, prevYearDueAmount - runningPaid);
    const msg = encodeURIComponent(
      `Dear Parent,\n\nPrevious Year Due Payment:\n` +
      `Student: ${student.studentName}\n` +
      `Amount Paid: ${currencyFmt(paidAmt)}\n` +
      `Remaining Balance: ${currencyFmt(remaining)}\n` +
      `Receipt No: ${payment.receiptNo || "N/A"}\n` +
      `Date: ${formatDate(payment.paymentDate) || new Date().toLocaleDateString("en-IN")}\n\nThank you!`
    );
    window.open(`https://wa.me/${ph}?text=${msg}`, "_blank");
  }

  async function handleCollect() {
    const rows = monthRows.filter(r => selected.has(r.key));
    if (rows.length === 0 && !prevDueSelected && prevDueSelectedMonths.size === 0) return;

    // ─── Duplicate Receipt Prevention ───
    // Only warn if the month is already FULLY paid (balance = 0).
    // A month with a partial payment (carryover-only session) still has balance > 0
    // and must not trigger a duplicate warning when the user returns to pay the rest.
    const alreadyPaid = rows.filter(row => {
      const existingPays = ownPayments.filter((p: any) =>
        p.month === row.m && p.year === row.mYear && !p.isPreviousDue &&
        (parseFloat(p.paidAmount ?? "0") > 0)
      );
      return existingPays.length > 0 && row.balance <= 0;
    });
    if (alreadyPaid.length > 0) {
      const monthNames = alreadyPaid.map(r => `${r.label} ${r.mYear}`).join(", ");
      const proceed = window.confirm(
        `⚠️ Duplicate Receipt Warning\n\n${student.studentName} already has a payment recorded for: ${monthNames}.\n\nCollecting again will create a duplicate record.\n\nDo you want to continue anyway?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);

    // Fetch transport category id upfront (only one lookup needed)
    let transportCatId: number | null = null;
    if (rows.some(r => r.transportAmount > 0)) {
      transportCatId = await getTransportCategoryId();
    }

    const payDate = new Date().toISOString().split("T")[0];
    const utrSuffix = payMode === "online" && utrLast4 ? ` [UTR:****${utrLast4}]` : "";
    const sharedReceiptBase = `RCP-${Date.now()}`;
    const lastSelectedKey = rows.length > 0 ? rows[rows.length - 1].key : null;

    // ── Phase 1: Build all payment records locally (zero API calls) ──
    const collectedBy = getGeneratedByLabel();
    type BatchItem = {
      studentId: number; categoryId: number; amount: number; paidAmount: number;
      discount: number; fine: number; status: string;
      month: number; year: number; session: string;
      paymentDate: string | null; paymentMethod: string;
      receiptNo: string; remarks: string; isPreviousDue: boolean; previousSession: string;
      collectedBy: string;
    };
    const batchItems: BatchItem[] = [];
    // Track which slice of batchItems belongs to each row (for reassembly after batch insert)
    const rowSlices: {
      label: string; mYear: number; start: number; end: number;
      effectiveTotal: number; carryoverDue: number; carryoverFromLabel: string;
    }[] = [];

    for (const row of rows) {
      const customAmtStr = row.key === lastSelectedKey ? partialAmounts.get(row.key) : undefined;
      const customAmt = customAmtStr ? parseFloat(customAmtStr) : NaN;
      // isPayingPartial: true when the user enters less than the full effectiveTotal
      // (which includes any carry-forward). E.g. entering ₹1000 for June when
      // effectiveTotal=₹1400 (₹200 carry + ₹1200 June fees) → isPayingPartial=true.
      const isPayingPartial = partialMode && row.key === lastSelectedKey && !isNaN(customAmt) && customAmt < row.effectiveTotal;

      const carryoverFull = row.carryoverDue > 0 ? row.carryoverDue : 0;
      // When partial mode is active and the user typed a custom amount, always use that
      // amount as the budget — even if it exactly equals totalAmount. Without this,
      // entering exactly ₹1200 for June (effectiveTotal=1400) would fall back to
      // effectiveTotal=1400 and auto-pay the carry-forward unexpectedly.
      const totalBudget = (partialMode && row.key === lastSelectedKey && !isNaN(customAmt))
        ? customAmt
        : row.effectiveTotal;
      // Carry-forward is paid FIRST from the budget, then the remainder goes to current
      // month fees. Example: budget=₹1000, carry=₹200 → ₹200 clears prev month, ₹800 for
      // current month (partial). If budget=₹1400 → ₹200 carry + ₹1200 full current month.
      const carryoverToPay = isPayingPartial ? Math.min(carryoverFull, totalBudget) : carryoverFull;
      const budgetForCurrentMonth = Math.max(0, totalBudget - carryoverToPay);
      const currentMonthRatio = (isPayingPartial && row.totalAmount > 0)
        ? Math.min(budgetForCurrentMonth / row.totalAmount, 1) : 1;

      const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(row.m);
      const rowVisIdx = visibleMonthsOrder.indexOf(row.m);
      const sliceStart = batchItems.length;

      // Track how much of budgetForCurrentMonth has been allocated so far (for rounding correction)
      let allocatedForCurrentMonth = 0;

      // Tuition structures — frequency-aware (same logic as tuitionAmountByMonthIdx)
      if (!isRTE) {
        for (let i = 0; i < tuitionStructs.length; i++) {
          const struct = tuitionStructs[i];
          const freq = (struct.frequency || "monthly").toLowerCase();
          let isDueThisMonth = false;
          if (freq === "monthly") isDueThisMonth = true;
          else if (freq === "quarterly") isDueThisMonth = schoolYearIdx % 3 === 0;
          else if (freq === "annually") isDueThisMonth = schoolYearIdx === 0;
          else if (freq === "one-time") {
            if (rowVisIdx === 0) {
              const alreadyPaidOnce = ownPayments.some(
                (p: any) => p.categoryId === struct.categoryId && !p.isPreviousDue
              );
              isDueThisMonth = !alreadyPaidOnce;
            }
          } else isDueThisMonth = true;
          if (!isDueThisMonth) continue;

          const fullAmt = parseFloat(String(struct.amount)) || 0;
          const paidAmt = isPayingPartial ? Math.round(fullAmt * currentMonthRatio * 100) / 100 : fullAmt;
          // Skip creating a record when the entire payment budget was consumed by
          // the carryover (currentMonthRatio = 0 → paidAmt = 0). Recording ₹0
          // entries pollutes the receipt with duplicate zero-amount rows and
          // inflates the "Monthly Fee Due" total on subsequent receipts.
          if (paidAmt === 0 && fullAmt > 0) continue;
          batchItems.push({
            studentId: student.id, categoryId: struct.categoryId,
            amount: fullAmt, paidAmount: paidAmt, discount: 0, fine: 0,
            status: paidAmt >= fullAmt ? "paid" : "partial",
            month: row.m, year: row.mYear, session,
            paymentDate: payDate, paymentMethod: payMode,
            receiptNo: `${sharedReceiptBase}-${row.m}-T${i}`,
            remarks: utrSuffix.trim(), isPreviousDue: false, previousSession: "", collectedBy,
          });
          if (isPayingPartial) allocatedForCurrentMonth += paidAmt;
        }
      }

      // Admission fee (New students, first month only)
      if (row.admissionFee > 0 && admissionCat) {
        const fullAmt = row.admissionFee;
        const paidAmt = isPayingPartial ? Math.round(fullAmt * currentMonthRatio * 100) / 100 : fullAmt;
        if (!(paidAmt === 0 && fullAmt > 0)) {
          batchItems.push({
            studentId: student.id, categoryId: admissionCat.id,
            amount: fullAmt, paidAmount: paidAmt, discount: 0, fine: 0,
            status: paidAmt >= fullAmt ? "paid" : "partial",
            month: row.m, year: row.mYear, session,
            paymentDate: payDate, paymentMethod: payMode,
            receiptNo: `${sharedReceiptBase}-${row.m}-ADM`,
            remarks: `Admission Fee${utrSuffix}`, isPreviousDue: false, previousSession: "", collectedBy,
          });
          if (isPayingPartial) allocatedForCurrentMonth += paidAmt;
        }
      }

      // Transport fee (only if active for this month)
      if (row.transportAmount > 0 && transportCatId) {
        const fullAmt = row.transportAmount;
        const paidAmt = isPayingPartial ? Math.round(fullAmt * currentMonthRatio * 100) / 100 : fullAmt;
        if (!(paidAmt === 0 && fullAmt > 0)) {
          batchItems.push({
            studentId: student.id, categoryId: transportCatId,
            amount: fullAmt, paidAmount: paidAmt, discount: 0, fine: 0,
            status: paidAmt >= fullAmt ? "paid" : "partial",
            month: row.m, year: row.mYear, session,
            paymentDate: payDate, paymentMethod: payMode,
            receiptNo: `${sharedReceiptBase}-${row.m}-TR`,
            remarks: `Transport — ${student.transportRouteName ?? "Route"}${utrSuffix}`,
            isPreviousDue: false, previousSession: "", collectedBy,
          });
          if (isPayingPartial) allocatedForCurrentMonth += paidAmt;
        }
      }

      // ── Rounding correction ──────────────────────────────────────────────────
      // Proportional rounding across multiple categories can cause the sum to
      // differ from the entered budget by ±0.01 or more. Fix: adjust the last
      // current-month item so the total paid exactly matches budgetForCurrentMonth.
      if (isPayingPartial && batchItems.length > sliceStart) {
        const roundedAlloc = Math.round(allocatedForCurrentMonth * 100) / 100;
        const roundedBudget = Math.round(budgetForCurrentMonth * 100) / 100;
        const diff = Math.round((roundedAlloc - roundedBudget) * 100) / 100;
        if (diff !== 0) {
          // Walk backwards to find the last non-carryover item for this month
          for (let k = batchItems.length - 1; k >= sliceStart; k--) {
            const item = batchItems[k];
            if (item.isPreviousDue) continue;
            const corrected = Math.round((item.paidAmount - diff) * 100) / 100;
            if (corrected >= 0) {
              batchItems[k] = { ...item, paidAmount: corrected, status: corrected >= item.amount ? "paid" : "partial" };
            }
            break;
          }
        }
      }

      // Carryover from previous partial month (paid in full first)
      if (row.carryoverDue > 0 && row.carryoverFromM > 0 && carryoverToPay > 0) {
        const prevCatId = tuitionStructs[0]?.categoryId ?? transportCatId;
        if (prevCatId) {
          batchItems.push({
            studentId: student.id, categoryId: prevCatId,
            amount: row.carryoverDue, paidAmount: carryoverToPay, discount: 0, fine: 0,
            status: carryoverToPay >= row.carryoverDue ? "paid" : "partial",
            month: row.carryoverFromM, year: row.carryoverFromMYear, session,
            paymentDate: payDate, paymentMethod: payMode,
            receiptNo: `${sharedReceiptBase}-${row.m}-PREV`,
            remarks: `Previous due from ${row.carryoverFromLabel}`,
            isPreviousDue: true, previousSession: "", collectedBy,
          });
        }
      }

      rowSlices.push({
        label: row.label, mYear: row.mYear,
        start: sliceStart, end: batchItems.length,
        effectiveTotal: row.effectiveTotal, carryoverDue: row.carryoverDue,
        carryoverFromLabel: row.carryoverFromLabel,
      });
    }

    // Previous Year Due — per-month mode
    const pydRows: { label: string; mYear: number; totalPaid: number }[] = [];
    let prevDueSinglePaid = 0;
    if (hasPrevYearMonthly && prevDueSelectedMonths.size > 0) {
      const prevCatId = tuitionStructs[0]?.categoryId ?? (await getTransportCategoryId());
      if (prevCatId) {
        for (const monthNum of prevDueSelectedMonths) {
          const monthAmt = prevYearMonthlyAmounts[monthNum] || 0;
          if (monthAmt <= 0) continue;
          const monthBalance = getPrevMonthBalance(monthNum);
          if (monthBalance <= 0) continue;
          const customPydStr = prevDueMonthPartialAmts.get(monthNum);
          const customPydNum = customPydStr ? parseFloat(customPydStr) : NaN;
          const pydPaidAmt = (partialMode && !isNaN(customPydNum) && customPydNum > 0 && customPydNum < monthBalance)
            ? Math.min(customPydNum, monthBalance) : monthBalance;
          batchItems.push({
            studentId: student.id, categoryId: prevCatId,
            amount: monthAmt, paidAmount: pydPaidAmt, discount: 0, fine: 0,
            status: pydPaidAmt >= monthBalance ? "paid" : "partial",
            month: 0, year, session,
            paymentDate: payDate, paymentMethod: payMode,
            receiptNo: `${sharedReceiptBase}-PYD${monthNum}`,
            remarks: `PYD-MONTH:${monthNum}${utrSuffix}`,
            isPreviousDue: true, previousSession: "", collectedBy,
          });
          pydRows.push({ label: `Prev Year Due (${SCHOOL_MONTH_LABELS[SCHOOL_MONTHS_ORDER.indexOf(monthNum)]})`, mYear: year, totalPaid: pydPaidAmt });
        }
      }
    } else if (!hasPrevYearMonthly && prevDueSelected && prevYearDueAmount > 0) {
      const prevCatId = tuitionStructs[0]?.categoryId ?? (await getTransportCategoryId());
      if (prevCatId) {
        const customAmt = prevDuePartialAmt ? parseFloat(prevDuePartialAmt) : NaN;
        const paidAmt = (!isNaN(customAmt) && partialMode) ? Math.min(customAmt, prevYearDueBalance) : prevYearDueBalance;
        prevDueSinglePaid = paidAmt;
        batchItems.push({
          studentId: student.id, categoryId: prevCatId,
          amount: prevYearDueAmount, paidAmount: paidAmt, discount: 0, fine: 0,
          status: paidAmt >= prevYearDueBalance ? "paid" : "partial",
          month: 0, year, session,
          paymentDate: payDate, paymentMethod: payMode,
          receiptNo: sharedReceiptBase,
          remarks: `Previous Year Due${prevYearDueRemarks ? ` — ${prevYearDueRemarks}` : ""}${utrSuffix}`,
          isPreviousDue: true, previousSession: "", collectedBy,
        });
      }
    }

    if (batchItems.length === 0) { setIsSubmitting(false); return; }

    // ── Phase 2: Single batch API call ──
    try {
      const batchRes = await fetch("/api/fees/payments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payments: batchItems }),
      });
      if (!batchRes.ok) throw new Error("Batch payment failed");
      const allReturned: any[] = await batchRes.json();

      // ── Phase 3: Reassemble per-row results from flat returned array (insertion order preserved) ──
      const newlyCollected: { month: string; mYear: number; totalPaid: number; payments: any[]; carryoverDue?: number; carryoverFromLabel?: string; monthlyDue?: number; balanceDue?: number }[] = [];

      for (const slice of rowSlices) {
        const rowPayments = allReturned.slice(slice.start, slice.end);
        const totalPaidNow = rowPayments.reduce((s: number, p: any) => s + (parseFloat(String(p?.paidAmount ?? "0")) || 0), 0);
        newlyCollected.push({
          month: slice.label, mYear: slice.mYear, totalPaid: totalPaidNow, payments: rowPayments,
          carryoverDue: slice.carryoverDue > 0 ? slice.carryoverDue : undefined,
          carryoverFromLabel: slice.carryoverFromLabel || undefined,
          monthlyDue: slice.effectiveTotal, balanceDue: Math.max(0, slice.effectiveTotal - totalPaidNow),
        });
      }
      for (const pyd of pydRows) {
        newlyCollected.push({ month: pyd.label, mYear: pyd.mYear, totalPaid: pyd.totalPaid, payments: [] });
      }
      if (!hasPrevYearMonthly && prevDueSelected && prevDueSinglePaid > 0) {
        newlyCollected.push({ month: "Prev Year Due", mYear: year, totalPaid: prevDueSinglePaid, payments: [] });
      }

      // ── Invalidate cache exactly once ──
      queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey(), exact: false });

      if (hasPrevYearMonthly && prevDueSelectedMonths.size > 0) {
        setPrevDueSelectedMonths(new Set());
        setPrevDueExpanded(false);
        setPrevDueMonthPartialAmts(new Map());
      }
      if (!hasPrevYearMonthly && prevDueSelected) {
        setPrevDueSelected(false);
        setPrevDuePartialAmt("");
      }

      if (newlyCollected.length > 0) {
        toast({ title: `Payment recorded for ${newlyCollected.length} month(s)` });
        const studentForReceipt = { studentName: student.studentName, fatherName: student.fatherName ?? "", uniqueId: student.uniqueId ?? "", className: cls?.name ?? "", sectionName: sec?.name ?? "" };
        if (autoPrint) {
          printCombinedReceipt(newlyCollected, studentForReceipt, sharedReceiptBase, payMode, payDate, payMode === "online" ? utrLast4 : undefined).catch(() => {});
        }
        if (sendGmail && student.parentEmail) {
          emailReceiptToParent(student.parentEmail, newlyCollected, studentForReceipt, sharedReceiptBase, payMode, payDate)
            .then(ok => {
              if (ok) toast({ title: `Receipt emailed to ${student.parentEmail}` });
              else toast({ title: "Email failed — check Gmail settings in Admin → Settings", variant: "destructive" });
            })
            .catch(() => {});
        }
      }

      setSelected(new Set());
      setPartialAmounts(new Map());
      onCollected();
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </button>

      {/* Student profile card — mobile friendly */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        {/* Row 1: Avatar + name + type badges */}
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            {student.photoUrl
              ? <img src={student.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber-400" />
              : <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl font-bold text-amber-600">{student.studentName?.[0]}</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">{student.studentName}</h2>
            <div className="flex flex-wrap gap-1 mt-1">
              {isRTE && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] h-4">RTE</Badge>}
              {student.studentType && !isRTE && <Badge variant="outline" className="text-[10px] h-4">{student.studentType}</Badge>}
              {hasTransport && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] h-4 flex items-center gap-1">
                  <Bus className="h-2.5 w-2.5" /> {student.transportRouteName} ₹{transportAmount}/mo
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Info grid + optional siblings column side-by-side */}
        <div className="flex gap-3 items-start">
          {/* Info fields — always visible */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs flex-1 min-w-0">
            {([
              ["Father", student.fatherName || "—"],
              ["Mobile", student.whatsappNumber || "—"],
              ["Class", `${cls?.name ?? "—"} ${sec?.name ?? ""}`.trim()],
              ["Roll No", String(student.rollNo ?? "—")],
              ["Admission No", student.uniqueId ?? "—"],
              ["Session", student.session || session],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">{label}</div>
                <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* Siblings column — shown only when siblings exist, sits to the right of the info grid */}
          {siblings.length > 0 && (
            <div className="shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3 min-w-[120px] max-w-[160px]">
              <div className="flex items-center gap-1 mb-1.5">
                <svg className="h-3 w-3 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide leading-none">
                  Siblings
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {siblings.map((sib: any) => {
                  const sibCls = classes.find((c: any) => c.id === sib.classId);
                  const sibSec = sections.find((s: any) => s.id === sib.sectionId);
                  const sibBal = siblingBalances[sib.id] ?? 0;
                  return (
                    <button
                      key={sib.id}
                      type="button"
                      onClick={() => onNavigateToStudent(sib)}
                      className="flex items-center gap-1.5 min-w-0 w-full text-left rounded-md px-1 py-0.5 -mx-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 active:bg-violet-200 dark:active:bg-violet-900/50 transition-colors cursor-pointer group"
                    >
                      {sib.photoUrl
                        ? <img src={sib.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-violet-300 shrink-0" />
                        : <div className="w-6 h-6 rounded-full bg-violet-200 dark:bg-violet-800 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">{(sib.studentName ?? "?")[0]}</div>
                      }
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 group-hover:underline truncate leading-tight">{sib.studentName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                          {sibCls?.name ?? "—"}{sibSec?.name ? ` ${sibSec.name}` : ""}
                        </div>
                        {sibBal > 0
                          ? <div className="text-[10px] font-semibold text-red-600 dark:text-red-400 leading-tight">Due: ₹{sibBal.toLocaleString("en-IN")}</div>
                          : <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 leading-tight">Paid up</div>
                        }
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Row 3: Summary badges — always full width row */}
        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1.5 text-center">
            <div className="text-[9px] text-red-500 font-medium uppercase tracking-wide">Annual Due</div>
            <div className="text-sm font-bold text-red-700 dark:text-red-400">{currencyFmt(totalDue)}</div>
          </div>
          <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-2 py-1.5 text-center">
            <div className="text-[9px] text-green-500 font-medium uppercase tracking-wide">Total Paid</div>
            <div className="text-sm font-bold text-green-700 dark:text-green-400">{currencyFmt(totalPaid)}</div>
            {totalCarryoverPaid > 0 && (
              <div className="text-[9px] text-teal-600 font-medium mt-0.5">(incl. ₹{totalCarryoverPaid.toFixed(0)} cf)</div>
            )}
          </div>
          <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1.5 text-center">
            <div className="text-[9px] text-amber-500 font-medium uppercase tracking-wide">Balance</div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{currencyFmt(totalBalance)}</div>
          </div>
        </div>

      </div>

      {/* Payment action bar — shown when months are selected or prev due selected */}
      {(selected.size > 0 || prevDueSelected || prevDueSelectedMonths.size > 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {selected.size > 0 && <>{selected.size} month(s)</>}{selected.size > 0 && (prevDueSelected || prevDueSelectedMonths.size > 0) && " + "}{prevDueSelectedMonths.size > 0 && `${prevDueSelectedMonths.size} Prev Due month(s)`}{!hasPrevYearMonthly && prevDueSelected && "Prev Year Due"} selected — {currencyFmt(monthRows.filter(r => selected.has(r.key)).reduce((s, r) => s + r.effectiveTotal, 0) + (prevDueSelectedMonths.size > 0 ? Array.from(prevDueSelectedMonths).reduce((s, m) => s + getPrevMonthBalance(m), 0) : prevDueSelected ? prevYearDueBalance : 0))} total
              {monthRows.filter(r => selected.has(r.key) && r.carryoverDue > 0).map(r => (
                <span key={r.key} className="ml-2 text-xs font-normal text-orange-600">(incl. {currencyFmt(r.carryoverDue)} prev. due from {r.carryoverFromLabel})</span>
              ))}
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 whitespace-nowrap">Pay Mode:</label>
              <Select value={payMode} onValueChange={v => { setPayMode(v); if (v !== "online") setUtrLast4(""); }}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="dd">DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMode === "online" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-500 whitespace-nowrap">UTR last 4:</label>
                  <Input
                    type="text"
                    maxLength={4}
                    className={`h-7 w-16 text-xs font-mono text-center ${utrDuplicate ? "border-red-500 focus-visible:ring-red-400" : ""}`}
                    placeholder="0000"
                    value={utrLast4}
                    onChange={e => setUtrLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  {utrLast4.length === 4 && !utrDuplicate && (
                    <span className="text-[10px] text-green-600 font-medium">✓ Unique</span>
                  )}
                </div>
                {utrDuplicate && (
                  <div className="flex items-start gap-1.5 bg-red-50 border border-red-300 rounded-md px-2.5 py-1.5 max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="text-red-500 text-sm mt-0.5 shrink-0">⚠</span>
                    <div className="text-[11px] leading-tight">
                      <p className="font-semibold text-red-700">Duplicate UTR detected!</p>
                      <p className="text-red-600">
                        Already used in receipt <span className="font-mono font-bold">{utrDuplicate.receiptNo}</span>
                        {utrDuplicate.studentName ? ` · ${utrDuplicate.studentName}` : ""}
                        {utrDuplicate.paymentDate ? ` · ${formatDate(utrDuplicate.paymentDate)}` : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Checkbox id="partial-mode" checked={partialMode} onCheckedChange={v => setPartialMode(!!v)} />
              <label htmlFor="partial-mode" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer">Partial payment</label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="send-gmail" checked={sendGmail} onCheckedChange={v => setSendGmail(!!v)} />
              <label htmlFor="send-gmail" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer flex items-center gap-1">
                <Mail className="h-3 w-3 text-blue-500" /> Gmail receipt
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="auto-print" checked={autoPrint} onCheckedChange={v => setAutoPrint(!!v)} />
              <label htmlFor="auto-print" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer flex items-center gap-1">
                <Printer className="h-3 w-3 text-slate-500" /> Auto-print receipt
              </label>
            </div>
            <Button
              size="sm"
              className="h-7 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCollect}
              disabled={isSubmitting || !!utrDuplicate || (payMode === "online" && utrLast4.length < 4)}
              title={utrDuplicate ? `UTR ****${utrLast4} already used in receipt ${utrDuplicate.receiptNo}` : payMode === "online" && utrLast4.length < 4 ? "Enter UTR last 4 digits to collect online payment" : undefined}
            >
              {isSubmitting ? "Processing…" : utrDuplicate ? "⛔ Duplicate UTR" : payMode === "online" && utrLast4.length < 4 ? `Enter UTR to Collect` : `Collect Payment${selected.size > 0 ? ` (${selected.size} months)` : ""}${prevDueSelectedMonths.size > 0 ? ` + ${prevDueSelectedMonths.size} Prev Due month(s)` : prevDueSelected ? " + Prev Due" : ""}`}
            </Button>
          </div>
          {/* Partial amount inputs — only LAST selected month is editable */}
          {partialMode && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200">
              {(() => {
                const selRows = monthRows.filter(r => selected.has(r.key));
                const lastRow = selRows[selRows.length - 1];
                return (
                  <>
                    {selRows.slice(0, -1).map(row => (
                      <div key={row.key} className="flex items-center gap-1.5 opacity-70">
                        <span className="text-xs text-slate-600">
                          {row.label}{row.carryoverDue > 0 ? <span className="text-orange-500"> +prev</span> : ""}:
                        </span>
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded px-2 py-0.5">₹{row.effectiveTotal} (full)</span>
                      </div>
                    ))}
                    {lastRow && (
                      <div key={lastRow.key} className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded px-2 py-0.5">
                        <span className="text-xs font-semibold text-amber-700">
                          {lastRow.label}{lastRow.carryoverDue > 0 ? <span className="text-orange-500"> +prev</span> : ""} ✎:
                        </span>
                        <Input
                          type="number"
                          className="h-6 w-24 text-xs border-amber-400"
                          placeholder={String(lastRow.effectiveTotal)}
                          value={partialAmounts.get(lastRow.key) ?? ""}
                          onChange={e => setPartialAmounts(prev => { const m = new Map(prev); m.set(lastRow.key, e.target.value); return m; })}
                        />
                        <span className="text-[10px] text-slate-400">/ {lastRow.effectiveTotal}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {prevDueSelected && prevYearDueBalance > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600">Prev Year Due:</span>
                  <Input
                    type="number"
                    className="h-6 w-24 text-xs"
                    placeholder={String(prevYearDueBalance)}
                    value={prevDuePartialAmt}
                    onChange={e => setPrevDuePartialAmt(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400">/ {prevYearDueBalance}</span>
                </div>
              )}
              {/* Partial amount inputs for selected prev year due months */}
              {prevDueSelectedMonths.size > 0 && Array.from(prevDueSelectedMonths).map(monthNum => {
                const monthBal = getPrevMonthBalance(monthNum);
                const mLabel = SCHOOL_MONTH_LABELS[SCHOOL_MONTHS_ORDER.indexOf(monthNum)];
                return (
                  <div key={`pyd-partial-${monthNum}`} className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-300 rounded px-2 py-0.5">
                    <span className="text-xs font-semibold text-yellow-800">{mLabel} Prev Due ✎:</span>
                    <Input
                      type="number"
                      className="h-6 w-24 text-xs border-yellow-400"
                      placeholder={String(monthBal)}
                      value={prevDueMonthPartialAmts.get(monthNum) ?? ""}
                      onChange={e => setPrevDueMonthPartialAmts(prev => { const m = new Map(prev); m.set(monthNum, e.target.value); return m; })}
                    />
                    <span className="text-[10px] text-slate-400">/ {monthBal}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Fee chart — dynamic months */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-auto">
        <table className="w-full text-xs min-w-[780px]">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">
              <th className="px-2 py-2.5 text-center w-8">
                <Checkbox
                  checked={selectableRows.length > 0 && selected.size === selectableRows.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2.5 text-left">Month</th>
              {tuitionStructs.map(struct => {
                const cat = categories.find((c: any) => c.id === struct.categoryId);
                return <th key={struct.categoryId} className="px-3 py-2.5 text-right whitespace-nowrap">{cat?.name ?? "Fee"} (₹)</th>;
              })}
              {admissionFeeAmount > 0 && <th className="px-3 py-2.5 text-right">Adm. Fee (₹)</th>}
              <th className="px-3 py-2.5 text-right">Transport (₹)</th>
              <th className="px-3 py-2.5 text-right">Total (₹)</th>
              <th className="px-3 py-2.5 text-right">Paid (₹)</th>
              <th className="px-3 py-2.5 text-right">Balance (₹)</th>
              <th className="px-3 py-2.5 text-left">Status</th>
              <th className="px-3 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Previous Year Due row — Total row with expand checkbox */}
            {prevYearDueAmount > 0 && (
              <>
                <tr className={`border-b border-slate-100 dark:border-slate-800 ${prevDueExpanded ? "bg-amber-50 dark:bg-amber-900/10" : prevYearDueClearedFull ? "bg-green-50/40 dark:bg-green-900/5" : prevYearDueIsPartial ? "bg-orange-50/40 dark:bg-orange-900/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}>
                  <td className="px-2 py-2 text-center">
                    {prevYearDueClearedFull
                      ? <button onClick={() => setPrevDueExpanded(v => !v)} title={prevDueExpanded ? "Hide payment history" : "View payment history"} className="text-green-500 text-sm font-bold hover:text-green-700 transition-colors cursor-pointer leading-none">✓</button>
                      : hasPrevYearMonthly
                        ? <Checkbox checked={prevDueExpanded} onCheckedChange={v => setPrevDueExpanded(!!v)} title="Expand to see month-wise breakdown" />
                        : <Checkbox checked={prevDueSelected} onCheckedChange={v => setPrevDueSelected(!!v)} />
                    }
                  </td>
                  <td className="px-3 py-2 font-semibold text-red-700 dark:text-red-400">
                    Total Previous Year Due Amount
                    {hasPrevYearMonthly && !prevYearDueClearedFull && (
                      <span className="ml-1.5 text-[9px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1">Tick to select months</span>
                    )}
                    {hasPrevYearMonthly && prevYearDueClearedFull && (
                      <span className="ml-1.5 text-[9px] text-green-600 bg-green-50 border border-green-200 rounded px-1">Click ✓ to {prevDueExpanded ? "hide" : "view"} receipts</span>
                    )}
                    {!hasPrevYearMonthly && prevYearDueIsPartial && <span className="ml-1.5 text-[9px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1">Partial — tick to pay remaining</span>}
                  </td>
                  {tuitionStructs.map(struct => <td key={struct.categoryId} className="px-3 py-2 text-right text-slate-600">—</td>)}
                  {admissionFeeAmount > 0 && <td className="px-3 py-2 text-right">—</td>}
                  <td className="px-3 py-2 text-right text-amber-600 font-medium">—</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">{prevYearDueAmount.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">{prevYearDuePaid > 0 ? prevYearDuePaid.toFixed(0) : "—"}</td>
                  <td className={`px-3 py-2 text-right font-bold ${prevYearDueBalance > 0 ? "text-red-600" : "text-green-600"}`}>{prevYearDueBalance.toFixed(0)}</td>
                  <td className="px-3 py-2">
                    {prevYearDueClearedFull
                      ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Paid ✓</Badge>
                      : prevYearDueIsPartial
                        ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Partial</Badge>
                        : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Unpaid</Badge>
                    }
                  </td>
                  <td className="px-3 py-2 text-center">—</td>
                </tr>

                {/* Monthly breakdown rows — shown when hasPrevYearMonthly and expanded */}
                {hasPrevYearMonthly && prevDueExpanded && SCHOOL_MONTHS_ORDER.map((monthNum, midx) => {
                  const monthAmt = prevYearMonthlyAmounts[monthNum] || 0;
                  if (monthAmt === 0) return null;
                  const monthPayments = getPrevMonthPayments(monthNum);
                  const monthPaid = monthPayments.reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
                  const monthBalance = Math.max(0, monthAmt - monthPaid);
                  const monthIsPaid = monthAmt > 0 && monthBalance <= 0;
                  const isSelected = prevDueSelectedMonths.has(monthNum);
                  const monthLabel = SCHOOL_MONTH_LABELS[midx];
                  return (
                    <>
                      <tr key={`pyd-month-${monthNum}`} className={`border-b border-slate-100 dark:border-slate-800 ${isSelected ? "bg-amber-50 dark:bg-amber-900/10" : monthIsPaid ? "bg-green-50/40 dark:bg-green-900/5" : "hover:bg-red-50/30 dark:hover:bg-red-900/10"}`}>
                        <td className="px-2 py-2 text-center">
                          {monthIsPaid
                            ? <span className="text-green-500 text-sm font-bold">✓</span>
                            : <Checkbox
                                checked={isSelected}
                                onCheckedChange={v => {
                                  setPrevDueSelectedMonths(prev => {
                                    const s = new Set(prev);
                                    if (v) s.add(monthNum); else s.delete(monthNum);
                                    return s;
                                  });
                                }}
                              />
                          }
                        </td>
                        <td className="px-3 py-2 text-sm text-red-600 dark:text-red-400 pl-8">
                          {monthLabel}
                        </td>
                        {tuitionStructs.map(struct => <td key={struct.categoryId} className="px-3 py-2 text-right text-slate-600">—</td>)}
                        {admissionFeeAmount > 0 && <td className="px-3 py-2 text-right">—</td>}
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">{monthAmt.toFixed(0)}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{monthPaid > 0 ? monthPaid.toFixed(0) : "—"}</td>
                        <td className={`px-3 py-2 text-right font-bold ${monthBalance > 0 ? "text-red-600" : "text-green-600"}`}>{monthBalance.toFixed(0)}</td>
                        <td className="px-3 py-2">
                          {monthIsPaid
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Paid ✓</Badge>
                            : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Unpaid</Badge>
                          }
                        </td>
                        <td className="px-3 py-2 text-center">—</td>
                      </tr>
                      {/* Payment history bars for this month — yellow */}
                      {monthPayments.map((pydPay: any, pidx: number) => {
                        const paidAmt = parseFloat(String(pydPay.paidAmount ?? "0"));
                        const payTime = pydPay.createdAt ? new Date(pydPay.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
                        const shortReceipt = pydPay.receiptNo ? pydPay.receiptNo.split("-").slice(-2).join("-") : `PYD-${monthLabel}-${pidx + 1}`;
                        const isMonthPartialPay = pydPay.status === "partial";
                        const runningPyd = monthPayments.slice(0, pidx + 1).reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0);
                        const remainingAfterThis = Math.max(0, monthAmt - runningPyd);
                        return (
                          <tr key={`pyd-hist-${pydPay.id ?? pidx}-${monthNum}`} className="bg-yellow-400 dark:bg-yellow-500">
                            <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1.5">
                              <div className="flex items-center gap-3 text-yellow-900 text-[10px] font-medium flex-wrap">
                                <span className="font-bold text-[11px]">#{pidx + 1} {monthLabel}</span>
                                <span>Paid <strong>₹{paidAmt.toFixed(2)}</strong></span>
                                <span>on <strong>{formatDate(pydPay.paymentDate) || "—"}</strong>{payTime && <> at <strong>{payTime}</strong></>}</span>
                                <span>via <strong className="capitalize">{pydPay.paymentMethod || "Cash"}</strong></span>
                                <span className="font-mono opacity-80">Receipt: <strong>{shortReceipt}</strong></span>
                                {isMonthPartialPay
                                  ? <span className="border-l border-yellow-600 pl-3 text-yellow-800 font-bold">⊘ Partial — ₹{remainingAfterThis.toFixed(0)} remaining</span>
                                  : remainingAfterThis <= 0
                                    ? <span className="border-l border-yellow-600 pl-3 text-green-800 font-bold">✓ Month Cleared</span>
                                    : <span className="border-l border-yellow-600 pl-3 text-yellow-800">Remaining: ₹{remainingAfterThis.toFixed(0)}</span>
                                }
                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    onClick={() => printPrevYearDueReceipt(
                                      pydPay, { ...student, className: cls?.name, sectionName: sec?.name },
                                      monthAmt, remainingAfterThis, monthLabel
                                    )}
                                    className="flex items-center gap-1 bg-yellow-700/30 hover:bg-yellow-700/50 rounded px-1.5 py-0.5 transition-colors"
                                    title="Print this receipt"
                                  >
                                    <Printer className="h-3 w-3" /> Print
                                  </button>
                                  {student.whatsappNumber && (
                                    <button
                                      onClick={() => openWhatsAppForPrevDue(pydPay)}
                                      className="flex items-center gap-1 bg-green-700/40 hover:bg-green-700/60 rounded px-1.5 py-0.5 transition-colors"
                                      title="Send on WhatsApp"
                                    >
                                      <MessageCircle className="h-3 w-3" /> WhatsApp
                                    </button>
                                  )}
                                  {canDelete("fees") && (
                                    <button
                                      onClick={() => handleDeletePrevYearDuePayment(pydPay, monthLabel)}
                                      className="flex items-center gap-1 bg-red-700/40 hover:bg-red-700/60 text-red-900 dark:text-red-100 rounded px-1.5 py-0.5 transition-colors font-bold"
                                      title="Delete this receipt"
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}

                {/* Payment history bars for old single-amount mode (non-monthly) — yellow */}
                {!hasPrevYearMonthly && prevYearDuePayments.length > 0 && prevYearDuePayments.map((pydPay: any, idx: number) => {
                  const paidAmt = parseFloat(String(pydPay.paidAmount ?? "0"));
                  const runningPaid = prevYearDuePayments
                    .slice(0, idx + 1)
                    .reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0);
                  const remainingAfter = Math.max(0, prevYearDueAmount - runningPaid);
                  const payTime = pydPay.createdAt ? new Date(pydPay.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
                  const shortReceipt = pydPay.receiptNo ? pydPay.receiptNo.split("-").slice(-2).join("-") : `PYD-${idx + 1}`;
                  return (
                    <tr key={`pyd-hist-${pydPay.id ?? idx}`} className="bg-yellow-400 dark:bg-yellow-500">
                      <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1.5">
                        <div className="flex items-center gap-3 text-yellow-900 text-[10px] font-medium flex-wrap">
                          <span className="font-bold text-[11px]">#{idx + 1}</span>
                          <span>Paid <strong>₹{paidAmt.toFixed(2)}</strong></span>
                          <span>on <strong>{formatDate(pydPay.paymentDate) || "—"}</strong>{payTime && <> at <strong>{payTime}</strong></>}</span>
                          <span>via <strong className="capitalize">{pydPay.paymentMethod || "Cash"}</strong></span>
                          <span className="font-mono opacity-80">Receipt: <strong>{shortReceipt}</strong></span>
                          {remainingAfter > 0
                            ? <span className="border-l border-yellow-600 pl-3 text-yellow-800">Remaining: ₹{remainingAfter.toFixed(0)}</span>
                            : <span className="border-l border-yellow-600 pl-3 text-green-800 font-bold">✓ Fully Cleared</span>
                          }
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              onClick={() => printPrevYearDueReceipt(
                                pydPay, { ...student, className: cls?.name, sectionName: sec?.name },
                                prevYearDueAmount, remainingAfter, prevYearDueRemarks
                              )}
                              className="flex items-center gap-1 bg-yellow-700/30 hover:bg-yellow-700/50 rounded px-1.5 py-0.5 transition-colors"
                              title="Print this receipt"
                            >
                              <Printer className="h-3 w-3" /> Print
                            </button>
                            {student.whatsappNumber && (
                              <button
                                onClick={() => openWhatsAppForPrevDue(pydPay)}
                                className="flex items-center gap-1 bg-green-700/40 hover:bg-green-700/60 rounded px-1.5 py-0.5 transition-colors"
                                title="Send on WhatsApp"
                              >
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </button>
                            )}
                            {canDelete("fees") && (
                              <button
                                onClick={() => handleDeletePrevYearDuePayment(pydPay, `Prev Year Due #${idx + 1}`)}
                                className="flex items-center gap-1 bg-red-700/40 hover:bg-red-700/60 text-red-900 dark:text-red-100 rounded px-1.5 py-0.5 transition-colors font-bold"
                                title="Delete this receipt"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
            {monthRows.map((row, rowIdx) => {
              const isSelected = selected.has(row.key);
              const payDate = formatDate(row.payments[0]?.paymentDate);
              const payMethod = row.payments[0]?.paymentMethod;
              const payTime = row.payments[0]?.createdAt;
              const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(row.m);
              return (
                <>
                  <tr key={row.key} className={`transition-colors border-b border-slate-100 dark:border-slate-800 ${isSelected ? "bg-amber-50 dark:bg-amber-900/10" : row.isPaid ? "bg-green-50/40 dark:bg-green-900/5" : row.isPartial ? "bg-orange-50/40 dark:bg-orange-900/5" : (isPromoted && !row.isPaid) ? "bg-slate-100/60 dark:bg-slate-800/20 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}>
                    <td className="px-2 py-2 text-center">
                      {/* Promoted students: all unpaid months are locked — must pay in the new session */}
                      {/* Partial months are locked — no checkbox; due auto-carries to next month */}
                      {isPromoted && !row.isPaid && row.totalAmount > 0 ? (
                        <span title="Student promoted — collect dues in the new academic session" className="text-slate-400 text-base leading-none select-none">🔒</span>
                      ) : row.isPartial ? (
                        <span title="Partial payment done — due will carry to next month automatically" className="text-orange-400 text-base leading-none select-none">⊘</span>
                      ) : !row.isPaid && row.totalAmount > 0 ? (
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(row.key)} />
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                      {row.label}
                      <span className="text-[10px] text-slate-400 ml-1 font-normal">{row.mYear}</span>
                      {row.carryoverDue > 0 && (
                        <span className="ml-1.5 text-[9px] text-orange-500 font-medium bg-orange-50 border border-orange-200 rounded px-1">+prev due</span>
                      )}
                    </td>
                    {tuitionStructs.map(struct => {
                      const baseAmt = parseFloat(String(struct.amount)) || 0;
                      const freq = (struct.frequency || "monthly").toLowerCase();
                      let amt = 0;
                      if (!isRTE) {
                        if (freq === "monthly") {
                          amt = baseAmt;
                        } else if (freq === "quarterly") {
                          amt = schoolYearIdx % 3 === 0 ? baseAmt : 0;
                        } else if (freq === "annually") {
                          amt = schoolYearIdx === 0 ? baseAmt : 0;
                        } else if (freq === "one-time") {
                          if (rowIdx === 0) {
                            const paid = ownPayments.some(
                              (p: any) => p.categoryId === struct.categoryId && !p.isPreviousDue
                            );
                            amt = paid ? 0 : baseAmt;
                          }
                        } else {
                          amt = baseAmt;
                        }
                      }
                      return (
                        <td key={struct.categoryId} className="px-3 py-2 text-right text-slate-600">
                          {isRTE ? <span className="text-blue-400 text-[10px]">RTE</span> : amt > 0 ? amt.toFixed(0) : "—"}
                        </td>
                      );
                    })}
                    {admissionFeeAmount > 0 && (
                      <td className="px-3 py-2 text-right text-purple-600 font-medium">
                        {row.admissionFee > 0 ? row.admissionFee.toFixed(0) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-amber-600 font-medium">
                      {(() => {
                        if (row.transportAmount > 0) return row.transportAmount.toFixed(0);
                        const oldTransportPaid = row.payments
                          .filter((p: any) => { const cn = (p.categoryName ?? "").toLowerCase(); return cn.includes("transport") || cn.includes("bus"); })
                          .reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
                        return oldTransportPaid > 0
                          ? <span title="Transport was paid when route was active (now inactive)" className="text-slate-400">{oldTransportPaid.toFixed(0)}</span>
                          : "—";
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                      {row.totalAmount > 0 ? (
                        row.carryoverDue > 0
                          ? <span title={`₹${row.totalAmount.toFixed(0)} monthly fee + ₹${row.carryoverDue.toFixed(0)} carry-forward due from ${row.carryoverFromLabel}`}>
                              {row.totalAmount.toFixed(0)}
                            </span>
                          : row.totalAmount.toFixed(0)
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">
                      {row.paidTotal > 0 ? (
                        <span>
                          {row.paidTotal.toFixed(0)}
                          {(row.carryoverPaid ?? 0) > 0 && (
                            <span className="text-teal-600 text-[9px] font-normal ml-0.5" title={`₹${(row.carryoverPaid ?? 0).toFixed(0)} carry-forward cleared`}>(+{(row.carryoverPaid ?? 0).toFixed(0)})</span>
                          )}
                          {row.isPartial && stuckMonthKeys.has(row.key) && row.balance > 0 && (
                            <span className="text-red-500 text-[9px] font-normal ml-0.5" title={`₹${row.balance.toFixed(0)} stuck — next month already paid`}>(stuck: {row.balance.toFixed(0)})</span>
                          )}
                          {row.isPartial && !stuckMonthKeys.has(row.key) && row.balance > 0 && (
                            <span className="text-orange-500 text-[9px] font-normal ml-0.5" title={`₹${row.balance.toFixed(0)} carry-forward to next month`}>(cf: {row.balance.toFixed(0)})</span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${row.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                      {row.totalAmount > 0 ? row.balance.toFixed(0) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.totalAmount === 0
                        ? <Badge variant="outline" className="text-[10px] text-slate-400">N/A</Badge>
                        : row.isPaid
                          ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Paid ✓</Badge>
                          : row.isPartial
                            ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Partial ⊘</Badge>
                            : isPromoted
                              ? <Badge className="bg-slate-100 text-slate-500 border-slate-300 text-[10px]">Promoted 🔒</Badge>
                              : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Unpaid</Badge>
                      }
                    </td>
                    <td className="px-3 py-2 text-center">
                      {/* Promoted student — show redirect message instead of collect buttons */}
                      {isPromoted && !row.isPaid && row.totalAmount > 0 ? (
                        <span className="text-[9px] text-slate-400 italic leading-tight block text-left">
                          For payment of this month,<br/>go to promoted academic session
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* WhatsApp — show for paid AND partial months */}
                          {student.whatsappNumber && (row.isPaid || row.isPartial) && (
                            <button
                              onClick={() => openWhatsApp(row)}
                              className="text-green-600 hover:text-green-700 transition-colors"
                              title={row.isPartial ? `WhatsApp — due: ₹${row.balance.toFixed(0)}` : "Send WhatsApp receipt"}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                          {/* Print — show for paid AND partial months */}
                          {(row.isPaid || row.isPartial) && (
                            <button
                              onClick={() => printFeeReceipt(row, { ...student, className: cls?.name, sectionName: sec?.name }, ownPayments as any[])}
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                              title={row.isPartial ? "Print Receipt (partial — with due amount)" : "Print Receipt"}
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {/* Status bar below each row */}
                  {row.isPaid ? (
                    // PAID bar — teal if due was cleared via carryover, red otherwise
                    <tr key={`${row.key}-paid-bar`} className={row.carryoverPaid > 0 ? "bg-teal-600 dark:bg-teal-700" : "bg-red-600 dark:bg-red-700"}>
                      <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1">
                        <div className="flex items-center gap-4 text-white text-[10px] font-medium flex-wrap">
                          {row.carryoverPaid > 0 ? (() => {
                            const cfNowPays = (row.carryoverPayments as any[]).filter((p: any) => String(p.receiptNo ?? "").includes("-CFNOW"));
                            const isCfNow = cfNowPays.length > 0;
                            const cfNowAmt = cfNowPays.reduce((s: number, p: any) => s + parseFloat(String(p.paidAmount ?? "0")), 0);
                            // Online/UPI partial-balance top-ups (paid by the parent through the
                            // Parent Portal or public website) use the same -CFNOW record shape as
                            // the admin's manual "settle carry-forward now" flow, but are tagged
                            // with collectedBy "Online (UPI)". They get a Receipt button like any
                            // other CF clearance, but never a delete button — deleting an online
                            // payment the parent already completed via Razorpay isn't a valid admin
                            // action, unlike a manually-recorded in-person clearance.
                            // Use .some() rather than inspecting only the first element so that
                            // any mix of CFNOW rows (e.g. an earlier manual one followed by an
                            // online one) is classified correctly — if ANY row is online-origin,
                            // suppress the delete button for the entire group.
                            const isOnlineCfNow = cfNowPays.some((p: any) => p.collectedBy === "Parent (UPI)" || p.collectedBy === "Online (UPI)");
                            return isCfNow ? (
                              <>
                                <span>✓ Paid ₹<strong>{row.paidTotal.toFixed(2)}</strong> on <strong>{payDate || "—"}</strong></span>
                                {payTime && <span>at <strong>{new Date(payTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                                <span className="border-l border-teal-300 pl-3">+ {isOnlineCfNow ? "Balance" : "Carry"} ₹<strong>{cfNowAmt.toFixed(2)}</strong> {isOnlineCfNow ? "paid online" : "cleared directly"} on <strong>{formatDate(cfNowPays[0]?.paymentDate) || "—"}</strong></span>
                                <button
                                  onClick={() => printCarryNowReceipt(row, cfNowPays[0], { ...student, className: cls?.name, sectionName: sec?.name })}
                                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                  title={isOnlineCfNow ? "Print receipt for the online balance payment" : "Print combined receipt (original + carry-forward clearance)"}
                                >
                                  <Printer className="h-3 w-3" /> Receipt
                                </button>
                                {!isOnlineCfNow && canDelete("fees") && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Delete carry-forward clearance receipt for ${row.label} ${row.mYear}?\n\nThis will revert this month to "Partial" status. The original payment stays.\n\nThis cannot be undone.`)) return;
                                      for (const p of cfNowPays) await deletePayment.mutateAsync({ id: p.id });
                                      toast({ title: `Carry-forward receipt deleted — ${row.label} reverted to partial` });
                                      onCollected();
                                    }}
                                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                    title="Delete carry-forward clearance receipt only (reverts month to partial)"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete CF Receipt
                                  </button>
                                )}
                              </>
                            ) : (() => {
                              const stlmtPaysInBar = (row.carryoverPayments as any[]).filter((p: any) => String(p.receiptNo ?? "").includes("-STLMT"));
                              return stlmtPaysInBar.length > 0 ? (
                                <>
                                  <span>✓ Paid ₹<strong>{row.paidTotal.toFixed(2)}</strong> on <strong>{payDate || "—"}</strong></span>
                                  {payTime && <span>at <strong>{new Date(payTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                                  <span className="border-l border-teal-300 pl-3">+ Stuck ₹<strong>{row.carryoverPaid.toFixed(2)}</strong> settled directly on <strong>{formatDate(stlmtPaysInBar[0]?.paymentDate) || "—"}</strong></span>
                                  <button
                                    onClick={() => printCarryNowReceipt(row, stlmtPaysInBar[0], { ...student, className: cls?.name, sectionName: sec?.name }, "STLMT")}
                                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                    title="Print stuck due settlement receipt"
                                  >
                                    <Printer className="h-3 w-3" /> Receipt
                                  </button>
                                  {canDelete("fees") && (
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm(`Delete stuck due settlement receipt for ${row.label} ${row.mYear}?\n\nThis will revert to "Partial" status. The original payment stays.\n\nThis cannot be undone.`)) return;
                                        for (const p of stlmtPaysInBar) await deletePayment.mutateAsync({ id: p.id });
                                        toast({ title: `Stuck due receipt deleted — ${row.label} reverted to partial` });
                                        onCollected();
                                      }}
                                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                      title="Delete stuck due settlement receipt only (reverts to partial)"
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete STLMT Receipt
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span>✓ Paid ₹<strong>{row.paidTotal.toFixed(2)}</strong> on <strong>{payDate || "—"}</strong></span>
                                  {payTime && <span>at <strong>{new Date(payTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                                  <span>+ Due ₹<strong>{row.carryoverPaid.toFixed(2)}</strong> cleared with next month's fees on <strong>{formatDate(row.carryoverPayments[0]?.paymentDate) || payDate}</strong></span>
                                  {row.carryoverPayments[0]?.createdAt && (
                                    <span>at <strong>{new Date(row.carryoverPayments[0].createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                                  )}
                                </>
                              );
                            })();
                          })() : (
                            <>
                              <span>✓ Paid on <strong>{payDate || "—"}</strong></span>
                              {payTime && <span>at <strong>{new Date(payTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                              <span>via <strong className="capitalize">{payMethod || "Cash"}</strong></span>
                              <span>Amount: <strong>₹{row.paidTotal.toFixed(2)}</strong></span>
                              {row.receiptNo && <span className="font-mono opacity-80">Receipt: {row.receiptNo.split("-").slice(-2).join("-")}</span>}
                            </>
                          )}
                          {canDelete("fees") && (row.payments as any[])?.length > 0 && (
                            <button
                              onClick={() => handleDeleteMonthPayments(row)}
                              className="ml-auto flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                              title="Delete fee receipt"
                            >
                              <Trash2 className="h-3 w-3" /> Delete Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : row.isPartial ? (
                    // PARTIAL bar — orange for normal carry-forward, red for stuck (next month already paid)
                    <>
                      <tr key={`${row.key}-partial-bar`} className={stuckMonthKeys.has(row.key) ? "bg-red-600 dark:bg-red-700" : "bg-orange-500 dark:bg-orange-600"}>
                        <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1">
                          <div className="flex items-center gap-3 text-white text-[10px] font-medium flex-wrap">
                            <span>⊘ Partial — paid <strong>₹{row.paidTotal.toFixed(2)}</strong> on <strong>{payDate || "—"}</strong></span>
                            {payTime && <span>at <strong>{new Date(payTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                            {stuckMonthKeys.has(row.key) ? (
                              <>
                                <span className="font-bold border-l border-red-400 pl-3 text-yellow-200">⚠ Stuck — ₹{row.balance.toFixed(2)} cannot carry forward (next month already paid)</span>
                                <button
                                  onClick={() => { setStuckPayRow(row); setStuckPayAmount(row.balance.toFixed(0)); setStuckPayMode("cash"); }}
                                  className="ml-auto flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-red-900 font-bold rounded px-2 py-0.5 text-[10px] transition-colors border border-yellow-200 shrink-0"
                                >
                                  <IndianRupee className="h-3 w-3" /> Pay Remaining ₹{row.balance.toFixed(0)}
                                </button>
                                <button
                                  onClick={() => printFeeReceipt(row, { ...student, className: cls?.name, sectionName: sec?.name }, ownPayments as any[])}
                                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                  title="Print partial receipt"
                                >
                                  <Printer className="h-3 w-3" /> Receipt
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="font-bold border-l border-orange-300 pl-3">due amount in {row.label} = ₹{row.balance.toFixed(2)} — auto-carry to next month</span>
                                <button
                                  onClick={() => { setCarryPayRow(row); setCarryPayMode("cash"); setCarryUtrLast4(""); }}
                                  className="flex items-center gap-1 bg-white/25 hover:bg-white/45 text-white border border-white/40 rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0"
                                  title="Pay this carry-forward due amount now instead of carrying it to next month"
                                >
                                  <IndianRupee className="h-3 w-3" /> Click if want to pay now
                                </button>
                              </>
                            )}
                            {canDelete("fees") && (row.payments as any[])?.length > 0 && (
                              <button
                                onClick={() => handleDeleteMonthPayments(row)}
                                className="ml-auto flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors shrink-0 border border-white/30"
                                title="Delete fee receipt"
                              >
                                <Trash2 className="h-3 w-3" /> Delete Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {stuckMonthKeys.has(row.key) && (
                        <tr key={`${row.key}-stuck-detail`} className="bg-yellow-100 dark:bg-yellow-900/40">
                          <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1.5">
                            <div className="flex items-center gap-4 text-yellow-900 dark:text-yellow-200 text-[10px] font-medium flex-wrap">
                              <span className="font-bold text-yellow-800 dark:text-yellow-300">⚠ Stuck Balance — {row.label} {row.mYear}</span>
                              <span className="border-l border-yellow-400 pl-3">Monthly fee: <strong>₹{row.totalAmount.toFixed(0)}</strong></span>
                              <span className="border-l border-yellow-400 pl-3">Paid: <strong className="text-green-700 dark:text-green-400">₹{row.paidTotal.toFixed(0)}</strong></span>
                              <span className="border-l border-yellow-400 pl-3">Remaining: <strong className="text-red-700 dark:text-red-400">₹{row.balance.toFixed(0)}</strong></span>
                              <span className="border-l border-yellow-400 pl-3 text-yellow-700 dark:text-yellow-400 italic">Next month already paid — carry-forward blocked. Click <strong>Pay Remaining</strong> above to settle this directly.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ) : row.totalAmount > 0 ? (
                    // UNPAID bar — grey for promoted students, red for normal unpaid
                    isPromoted ? (
                      <tr key={`${row.key}-due-bar`} className="bg-slate-500 dark:bg-slate-600">
                        <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1">
                          <div className="flex items-center gap-2 text-white text-[10px] font-semibold flex-wrap">
                            <span>🔒 ₹{row.totalAmount.toFixed(2)} due — student promoted to next academic session</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={`${row.key}-due-bar`} className="bg-red-700 dark:bg-red-800">
                        <td colSpan={tuitionStructs.length + 9 + (admissionFeeAmount > 0 ? 1 : 0)} className="px-4 py-1">
                          <div className="flex items-center gap-2 text-white text-[10px] font-semibold flex-wrap">
                            <span>monthly fee for {row.label} = ₹{row.totalAmount.toFixed(2)}</span>
                            {row.carryoverDue > 0 && (
                              <span className="opacity-80 font-normal">+ ₹{row.carryoverDue.toFixed(2)} carry-forward from {row.carryoverFromLabel} (total to collect: ₹{row.effectiveTotal.toFixed(2)})</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {monthRows.every(r => r.totalAmount === 0 || r.isPaid) && totalDue > 0 && (
        <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm">
          <CheckCircle2 className="h-5 w-5" /> All months paid for this student!
        </div>
      )}
      {totalDue === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No fee structures defined for this class. Add structures in the Settings tab.
        </div>
      )}

      {/* Stuck Partial Payment Dialog */}
      <Dialog open={!!stuckPayRow} onOpenChange={open => { if (!open) { setStuckPayRow(null); setStuckPayAmount(""); setStuckUtrLast4(""); setStuckPayMode("cash"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <IndianRupee className="h-5 w-5" />
              Pay Remaining — {stuckPayRow?.label} {stuckPayRow?.mYear}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-900">
              <p className="font-semibold">⚠ Stuck Balance</p>
              <p className="text-xs mt-0.5">This partial payment couldn't carry forward because the next month is already paid. Collect the remaining amount directly here.</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total due for {stuckPayRow?.label}</span>
              <span className="font-bold">₹{stuckPayRow?.totalAmount?.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Already paid</span>
              <span className="font-bold text-green-700">₹{stuckPayRow?.paidTotal?.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="font-semibold text-red-700">Remaining balance</span>
              <span className="font-bold text-red-700">₹{stuckPayRow?.balance?.toFixed(0)}</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Amount to collect</label>
              <Input
                type="number"
                min={1}
                max={stuckPayRow?.balance}
                value={stuckPayAmount}
                onChange={e => setStuckPayAmount(e.target.value)}
                placeholder={`Max ₹${stuckPayRow?.balance?.toFixed(0)}`}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-slate-500">Leave at default to collect full remaining amount</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Payment mode</label>
              <Select value={stuckPayMode} onValueChange={v => { setStuckPayMode(v); if (v !== "online") setStuckUtrLast4(""); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="dd">DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {stuckPayMode === "online" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">UTR last 4 digits</label>
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 select-none">UTR</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={stuckUtrLast4}
                      onChange={e => setStuckUtrLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="_ _ _ _"
                      className="h-8 text-sm pl-10 font-mono tracking-widest"
                    />
                  </div>
                  {stuckUtrLast4.length === 4 && !stuckUtrDuplicate && (
                    <span className="text-[10px] text-green-600 font-semibold whitespace-nowrap">✓ UTR OK</span>
                  )}
                </div>
                {stuckUtrDuplicate && (
                  <div className="bg-red-50 border border-red-200 rounded px-2 py-1.5 text-xs">
                    <p className="font-semibold text-red-700">⛔ Duplicate UTR detected!</p>
                    <p className="text-red-600 mt-0.5">
                      UTR ****{stuckUtrLast4} already used in receipt <strong>{stuckUtrDuplicate.receiptNo}</strong> for <strong>{stuckUtrDuplicate.studentName}</strong> on {formatDate(stuckUtrDuplicate.paymentDate)}.
                    </p>
                  </div>
                )}
                {stuckPayMode === "online" && stuckUtrLast4.length < 4 && (
                  <p className="text-[10px] text-slate-500">Enter last 4 digits of UTR / transaction reference</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setStuckPayRow(null); setStuckPayAmount(""); setStuckUtrLast4(""); setStuckPayMode("cash"); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handlePayStuck}
              disabled={isSubmitting || !!stuckUtrDuplicate || (stuckPayMode === "online" && stuckUtrLast4.length < 4)}
              title={stuckUtrDuplicate ? `UTR ****${stuckUtrLast4} already used in receipt ${stuckUtrDuplicate.receiptNo}` : stuckPayMode === "online" && stuckUtrLast4.length < 4 ? "Enter UTR last 4 digits to proceed" : undefined}
            >
              {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <IndianRupee className="h-4 w-4 mr-1" />}
              {stuckUtrDuplicate ? "⛔ Duplicate UTR" : stuckPayMode === "online" && stuckUtrLast4.length < 4 ? "Enter UTR to Collect" : `Collect ₹${stuckPayAmount || stuckPayRow?.balance?.toFixed(0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carry-Forward Pay Now Dialog */}
      <Dialog open={!!carryPayRow} onOpenChange={open => { if (!open) { setCarryPayRow(null); setCarryPayMode("cash"); setCarryUtrLast4(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <IndianRupee className="h-5 w-5" />
              Pay Carry-Forward Due — {carryPayRow?.label} {carryPayRow?.mYear}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-900">
              <p className="font-semibold">💰 Carry-Forward Clearance</p>
              <p className="text-xs mt-0.5">Pay the remaining carry-forward balance now. A combined receipt will be generated showing the original payment and this clearance.</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total due for {carryPayRow?.label}</span>
              <span className="font-bold">₹{carryPayRow?.totalAmount?.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Already paid</span>
              <span className="font-bold text-green-700">₹{carryPayRow?.paidTotal?.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="font-semibold text-orange-700">Carry-forward balance to clear</span>
              <span className="font-bold text-orange-700">₹{carryPayRow?.balance?.toFixed(0)}</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Payment mode</label>
              <Select value={carryPayMode} onValueChange={v => { setCarryPayMode(v); if (v !== "online") setCarryUtrLast4(""); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="dd">DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {carryPayMode === "online" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">UTR last 4 digits</label>
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 select-none">UTR</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={carryUtrLast4}
                      onChange={e => setCarryUtrLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="_ _ _ _"
                      className="h-8 text-sm pl-10 font-mono tracking-widest"
                    />
                  </div>
                  {carryUtrLast4.length === 4 && !carryUtrDuplicate && (
                    <span className="text-[10px] text-green-600 font-semibold whitespace-nowrap">✓ UTR OK</span>
                  )}
                </div>
                {carryUtrDuplicate && (
                  <div className="bg-red-50 border border-red-200 rounded px-2 py-1.5 text-xs">
                    <p className="font-semibold text-red-700">⛔ Duplicate UTR detected!</p>
                    <p className="text-red-600 mt-0.5">
                      UTR ****{carryUtrLast4} already used in receipt <strong>{carryUtrDuplicate.receiptNo}</strong> for <strong>{carryUtrDuplicate.studentName}</strong> on {formatDate(carryUtrDuplicate.paymentDate)}.
                    </p>
                  </div>
                )}
                {carryPayMode === "online" && carryUtrLast4.length < 4 && (
                  <p className="text-[10px] text-slate-500">Enter last 4 digits of UTR / transaction reference</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setCarryPayRow(null); setCarryPayMode("cash"); setCarryUtrLast4(""); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handlePayCarryNow}
              disabled={isSubmitting || !!carryUtrDuplicate || (carryPayMode === "online" && carryUtrLast4.length < 4)}
              title={carryUtrDuplicate ? `UTR ****${carryUtrLast4} already used in receipt ${carryUtrDuplicate.receiptNo}` : carryPayMode === "online" && carryUtrLast4.length < 4 ? "Enter UTR last 4 digits to proceed" : undefined}
            >
              {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <IndianRupee className="h-4 w-4 mr-1" />}
              {carryUtrDuplicate ? "⛔ Duplicate UTR" : carryPayMode === "online" && carryUtrLast4.length < 4 ? "Enter UTR to Collect" : `Collect ₹${carryPayRow?.balance?.toFixed(0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Fee Collection Tab
// ─────────────────────────────────────────────────────────────────────────────

function FeeCollectionTab({ session }: { session: string }) {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(() => sessionYearStart(session));
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [detailStudent, setDetailStudent] = useState<any>(null);
  const [showStuckPanel, setShowStuckPanel] = useState(false);

  // Keep year in sync when the active academic session changes (e.g. user switches session)
  useEffect(() => { setYear(sessionYearStart(session)); }, [session]);

  // ── Reminder state ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderMonth, setReminderMonth] = useState<number>(new Date().getMonth() + 1);
  const [reminderYear, setReminderYear] = useState<number>(() => sessionYearStart(session));
  const [reminderResult, setReminderResult] = useState<{ sent: number; failed: number; results: any[] } | null>(null);
  const [reminderSending, setReminderSending] = useState(false);

  // ── Bulk collection state ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState<number>(new Date().getMonth() + 1);
  const [bulkPayMode, setBulkPayMode] = useState("cash");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; skipped: number; failed: number } | null>(null);

  const sendReminders = useSendFeeReminders();

  // Fetch all payments for the session — staleTime avoids refetching on every tab switch
  const { data: allPayments = [], refetch: refetchPayments } = useListFeePayments(
    { session },
    { query: { queryKey: getListFeePaymentsQueryKey({ session }), staleTime: 30_000 } }
  );
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: students = [], isLoading: studentsLoading } = useListStudents({
    classId: filterClass !== "all" ? parseInt(filterClass) : undefined,
    sectionId: filterSection !== "all" ? parseInt(filterSection) : undefined,
  });
  // All students across all classes — needed for sibling detection in the detail view
  const { data: allStudents = [] } = useListStudents({});
  const { data: categories = [] } = useListFeeCategories();
  const { data: structures = [] } = useListFeeStructures({ session });
  const queryClient = useQueryClient();
  const collectFee = useCollectFee({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFeePaymentsQueryKey(), exact: false }) } });

  const filteredSections = (() => {
    if (filterClass === "all") return sections;
    const byClass = sections.filter(s => s.classId === parseInt(filterClass));
    if (byClass.length > 0) return byClass;
    return sections; // sections are global (no classId) — show all
  })();

  // ── Performance: precompute payment lookups once instead of per-student ──
  const paymentsByStudent = useMemo(() => {
    const map = new Map<number, typeof allPayments>();
    for (const p of allPayments) {
      if (p.studentId == null) continue;
      const arr = map.get(p.studentId) ?? [];
      arr.push(p);
      map.set(p.studentId, arr);
    }
    return map;
  }, [allPayments]);

  // Set of "month-year" keys paid per student (excludes isPreviousDue carryovers)
  const paidMonthKeysByStudent = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const p of allPayments) {
      if (p.studentId == null || p.isPreviousDue) continue;
      if (!map.has(p.studentId)) map.set(p.studentId, new Set());
      map.get(p.studentId)!.add(`${p.month}-${p.year}`);
    }
    return map;
  }, [allPayments]);

  function getStudentTotalPaid(studentId: number) {
    return (paymentsByStudent.get(studentId) ?? []).reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  }
  function getStudentGenerated(studentId: number, classId: number, prevYearDue: number, stu?: any) {
    const _genTypeLC = (stu?.studentType ?? "").toLowerCase();
    const isRTE = _genTypeLC.includes("rte");
    const isNew = _genTypeLC.includes("new");
    const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
    const admStruct = admCat ? structures.find((s: any) => s.categoryId === admCat.id && s.classId === classId) : null;
    const admFeeAmount = (isNew && admStruct) ? parseFloat(String(admStruct.amount)) || 0 : 0;

    // Transport: per-month active window so inactive/re-assigned students preserve history
    const hasTransportRoute = !!(stu?.transportRouteId && stu?.transportRoutePricePerMonth);
    const transportPricePerMonth = hasTransportRoute
      ? parseFloat(String(stu.transportRoutePricePerMonth)) || 0 : 0;
    const transportFromM: number = stu?.transportFromMonth ?? 4;
    const transportStopM: number | null = stu?.transportStopMonth ?? null;
    const transportFromIdx = SCHOOL_MONTHS_ORDER.indexOf(transportFromM);
    const transportStopIdx = transportStopM !== null ? SCHOOL_MONTHS_ORDER.indexOf(transportStopM) : -1;

    // Tuition structures (transport and admission excluded — handled separately).
    // For RTE students all tuition is waived — use empty array (mirrors individual view line `if (isRTE) return 0`).
    const tuitionStructsForGen = isRTE ? [] : structures.filter((s: any) => {
      if (s.classId !== classId) return false;
      const cat = categories.find((c: any) => c.id === s.categoryId);
      const cn = (cat?.name ?? "").toLowerCase();
      if (cn.includes("admission")) return false;
      if (cn.includes("transport") || cn.includes("bus")) return false;
      return true;
    });

    const startIdx = stu?.feeFromApril === false && stu?.admissionDate
      ? (() => {
          const parts = String(stu.admissionDate).split("-");
          const m = parseInt(parts[1] || "0");
          const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
          return idx >= 0 ? idx : 0;
        })()
      : 0;
    let generatedTotal = 0;
    for (let i = startIdx; i < SCHOOL_MONTHS_ORDER.length; i++) {
      const m = SCHOOL_MONTHS_ORDER[i];
      const mYear = m >= 4 ? year : year + 1;
      if (new Date(mYear, m - 1, 1) > today) break;
      // Compute tuition for this month respecting each category's frequency
      // (matches the per-month detail view: quarterly=Apr/Jul/Oct/Jan, annually=Apr only, one-time=first month)
      const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m); // 0=Apr … 11=Mar
      const monthTuition = tuitionStructsForGen.reduce((sum: number, st: any) => {
        const amt = parseFloat(String(st.amount)) || 0;
        const freq = ((st.frequency as string) || "monthly").toLowerCase();
        if (freq === "monthly") return sum + amt;
        if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
        if (freq === "annually")  return schoolYearIdx === 0 ? sum + amt : sum;
        if (freq === "one-time")  return i === startIdx ? sum + amt : sum;
        return sum + amt;
      }, 0);
      // Apply transport fee only for months within the active transport window
      let monthTransport = 0;
      if (hasTransportRoute && transportPricePerMonth > 0 && transportFromIdx >= 0) {
        const afterFrom = i >= transportFromIdx;
        const beforeStop = transportStopIdx < 0 || i < transportStopIdx;
        if (afterFrom && beforeStop) monthTransport = transportPricePerMonth;
      }
      generatedTotal += monthTuition + monthTransport + (i === startIdx ? admFeeAmount : 0);
    }

    // Preserve historical transport fees for re-assigned students:
    // if transportFromMonth was reset to a later month, check for transport payments
    // in earlier months and include them in generated so the totals stay accurate.
    if (hasTransportRoute && transportPricePerMonth > 0 && transportFromIdx > startIdx) {
      const studentPayments = paymentsByStudent.get(studentId) ?? [];
      for (let i = startIdx; i < transportFromIdx; i++) {
        const m = SCHOOL_MONTHS_ORDER[i];
        const mYear = m >= 4 ? year : year + 1;
        if (new Date(mYear, m - 1, 1) > today) break;
        const hasTransPayment = studentPayments.some((p: any) => {
          const cn = (p.categoryName ?? "").toLowerCase();
          return p.month === m && p.year === mYear && (cn.includes("transport") || cn.includes("bus"));
        });
        if (hasTransPayment) generatedTotal += transportPricePerMonth;
      }
    }

    return generatedTotal + (prevYearDue || 0);
  }

  const today = new Date();

  function getDueMonthStartIdx(stu: any): number {
    return stu.feeFromApril === false && stu.admissionDate
      ? (() => {
          const parts = String(stu.admissionDate).split("-");
          const m = parseInt(parts[1] || "0");
          const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
          return idx >= 0 ? idx : 0;
        })()
      : 0;
  }

  function getDueMonthCount(studentId: number, stu: any): number {
    const paidSet = paidMonthKeysByStudent.get(studentId) ?? new Set<string>();
    const startMonth = getDueMonthStartIdx(stu);
    let dueCount = 0;
    for (let i = startMonth; i < SCHOOL_MONTHS_ORDER.length; i++) {
      const m = SCHOOL_MONTHS_ORDER[i];
      const mYear = m >= 4 ? year : year + 1;
      if (new Date(mYear, m - 1, 1) > today) break;
      if (!paidSet.has(`${m}-${mYear}`)) dueCount++;
    }
    return dueCount;
  }

  function getDueMonthNames(studentId: number, stu: any): string {
    const paidSet = paidMonthKeysByStudent.get(studentId) ?? new Set<string>();
    const startMonth = getDueMonthStartIdx(stu);
    const names: string[] = [];
    for (let i = startMonth; i < SCHOOL_MONTHS_ORDER.length; i++) {
      const m = SCHOOL_MONTHS_ORDER[i];
      const mYear = m >= 4 ? year : year + 1;
      if (new Date(mYear, m - 1, 1) > today) break;
      if (!paidSet.has(`${m}-${mYear}`)) names.push(SCHOOL_MONTH_LABELS[i]);
    }
    return names.join(", ");
  }

  function getStudentDueAmount(studentId: number, stu: any): number {
    const paidSet = paidMonthKeysByStudent.get(studentId) ?? new Set<string>();
    const startMonth = getDueMonthStartIdx(stu);
    const _stuDueTC = (stu.studentType ?? "").toLowerCase();
    const isNewStudent = _stuDueTC.includes("new");
    const isRTEStudent = _stuDueTC.includes("rte");

    // Admission category + structure for this class
    const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
    const admStruct = admCat
      ? structures.find((s: any) => s.categoryId === admCat.id && s.classId === stu.classId)
      : null;
    const admFee = (isNewStudent && admStruct) ? parseFloat(String(admStruct.amount)) || 0 : 0;

    // Tuition-only monthly fee (transport excluded — calculated per-month below).
    // RTE students have all tuition waived — return 0 directly (mirrors individual view).
    const tuitionFeeFromStructs = isRTEStudent ? 0 : structures.filter((s: any) => {
      if (s.classId !== stu.classId) return false;
      const cat = categories.find((c: any) => c.id === s.categoryId);
      const cn = (cat?.name ?? "").toLowerCase();
      if (cn.includes("admission") || cn.includes("transport") || cn.includes("bus")) return false;
      return true;
    }).reduce((sum: number, st: any) => sum + (parseFloat(String(st.amount)) || 0), 0);

    // Transport: per-month active window (consistent with getStudentGenerated)
    const hasTransportRoute = !!(stu.transportRouteId && stu.transportRoutePricePerMonth);
    const transportPricePerMonth = hasTransportRoute
      ? parseFloat(String(stu.transportRoutePricePerMonth)) || 0 : 0;
    const transportFromM: number = stu.transportFromMonth ?? 4;
    const transportStopM: number | null = stu.transportStopMonth ?? null;
    const transportFromIdx = SCHOOL_MONTHS_ORDER.indexOf(transportFromM);
    const transportStopIdx = transportStopM !== null ? SCHOOL_MONTHS_ORDER.indexOf(transportStopM) : -1;

    let dueAmt = 0;
    for (let i = startMonth; i < SCHOOL_MONTHS_ORDER.length; i++) {
      const m = SCHOOL_MONTHS_ORDER[i];
      const mYear = m >= 4 ? year : year + 1;
      if (new Date(mYear, m - 1, 1) > today) break;
      if (!paidSet.has(`${m}-${mYear}`)) {
        let monthTransport = 0;
        if (hasTransportRoute && transportPricePerMonth > 0 && transportFromIdx >= 0) {
          const afterFrom = i >= transportFromIdx;
          const beforeStop = transportStopIdx < 0 || i < transportStopIdx;
          if (afterFrom && beforeStop) monthTransport = transportPricePerMonth;
        }
        dueAmt += tuitionFeeFromStructs + monthTransport;
        // Admission fee: only for new students, only the first applicable month
        if (i === startMonth && admFee > 0) dueAmt += admFee;
      }
    }

    // Add outstanding previous year due balance
    const prevYearDueTotal = parseFloat(String(stu.previousYearDue || "0")) || 0;
    if (prevYearDueTotal > 0) {
      const prevDuePaid = (paymentsByStudent.get(studentId) ?? [])
        .filter((p: any) => p.isPreviousDue === true && p.month === 0)
        .reduce((s: number, p: any) => s + (p.paidAmount ?? 0), 0);
      dueAmt += Math.max(0, prevYearDueTotal - prevDuePaid);
    }

    return dueAmt;
  }

  function getStudentOverdueInfo(studentId: number, stu: any): { daysOverdue: number; earliestOverdueLabel: string } {
    const paidSet = paidMonthKeysByStudent.get(studentId) ?? new Set<string>();
    const startMonth = getDueMonthStartIdx(stu);
    const classDueDays = structures
      .filter((s: any) => s.classId === stu.classId)
      .map((s: any) => s.dueDay ?? 10);
    const classDueDay = classDueDays.length > 0 ? Math.min(...classDueDays) : 10;
    let earliestDaysOverdue = 0;
    let earliestOverdueLabel = "";
    for (let i = startMonth; i < SCHOOL_MONTHS_ORDER.length; i++) {
      const m = SCHOOL_MONTHS_ORDER[i];
      const mYear = m >= 4 ? year : year + 1;
      if (new Date(mYear, m - 1, 1) > today) break;
      if (!paidSet.has(`${m}-${mYear}`)) {
        const dueDate = new Date(mYear, m - 1, classDueDay);
        if (today > dueDate) {
          const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (earliestDaysOverdue === 0) {
            earliestDaysOverdue = days;
            earliestOverdueLabel = SCHOOL_MONTH_LABELS[i];
          } else if (days > earliestDaysOverdue) {
            earliestDaysOverdue = days;
          }
        }
      }
    }
    return { daysOverdue: earliestDaysOverdue, earliestOverdueLabel };
  }

  const studentSummaries = useMemo(() => {
    return students.map(s => {
      const prevDue = parseFloat(String((s as any).previousYearDue || "0")) || 0;
      const generated = getStudentGenerated(s.id, s.classId!, prevDue, s);
      const paid = getStudentTotalPaid(s.id);
      const dueMonths = getDueMonthCount(s.id, s);
      const dueMonthNames = getDueMonthNames(s.id, s);
      const dueAmount = getStudentDueAmount(s.id, s);
      const { daysOverdue, earliestOverdueLabel } = getStudentOverdueInfo(s.id, s);
      return { ...s, generated, paid, remaining: generated - paid, dueMonths, dueMonthNames, dueAmount, daysOverdue, earliestOverdueLabel };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, structures, allPayments, year]);

  // ── Stuck Dues computation ──────────────────────────────────────────────────
  // A "stuck" month is a partial payment where the NEXT month is already paid,
  // so the carry-forward cannot apply and the balance is stranded.
  const stuckDuesInfo = useMemo(() => {
    // Build per-student month maps.
    // Regular payments (isPreviousDue=false) → contribute to BOTH amount and paid.
    // Carry-clearance payments (isPreviousDue=true) → contribute to paid ONLY for their
    // month, because they represent the settlement of that month's remaining balance.
    // Excluding them caused months whose carry was later cleared to appear "stuck".
    const byStudentMap = new Map<number, { regular: any[]; carry: any[] }>();
    for (const p of allPayments) {
      if (!p.studentId) continue;
      if (!byStudentMap.has(p.studentId)) byStudentMap.set(p.studentId, { regular: [], carry: [] });
      const bucket = byStudentMap.get(p.studentId)!;
      if (p.isPreviousDue) bucket.carry.push(p);
      else bucket.regular.push(p);
    }
    const stuckStudentIds = new Set<number>();
    const stuckBalanceByStudent = new Map<number, number>();
    let totalStuckBalance = 0;
    for (const [studentId, { regular, carry }] of byStudentMap) {
      // monthMap keyed by "YYYY-MM" — amount from regular payments, paid from both
      const monthMap = new Map<string, { amount: number; paid: number }>();
      for (const p of regular) {
        if (!p.month || !p.year) continue;
        const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
        if (!monthMap.has(key)) monthMap.set(key, { amount: 0, paid: 0 });
        const e = monthMap.get(key)!;
        e.amount += Number(p.amount ?? 0);
        e.paid += Number(p.paidAmount ?? 0);
      }
      // Add carry-clearance paid amounts to the month they settled
      for (const p of carry) {
        if (!p.month || !p.year) continue;
        const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
        if (!monthMap.has(key)) continue; // no regular payment for this month → skip
        monthMap.get(key)!.paid += Number(p.paidAmount ?? 0);
      }
      for (const [key, totals] of monthMap) {
        // After including carry clearances, truly partial means balance still > ₹0.50
        const isPartialMonth = totals.paid > 0 && totals.paid < totals.amount - 0.5;
        if (!isPartialMonth) continue;
        const [yearStr, monthStr] = key.split("-");
        const m = parseInt(monthStr);
        const y = parseInt(yearStr);
        const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
        if (idx < 0 || idx >= SCHOOL_MONTHS_ORDER.length - 1) continue;
        const nextM = SCHOOL_MONTHS_ORDER[idx + 1];
        const nextY = nextM >= 4 ? (m >= 4 ? y : y - 1) : (m >= 4 ? y + 1 : y);
        const nextKey = `${nextY}-${String(nextM).padStart(2, "0")}`;
        if (monthMap.has(nextKey)) {
          const stuck = Math.max(0, totals.amount - totals.paid);
          stuckStudentIds.add(studentId);
          stuckBalanceByStudent.set(studentId, (stuckBalanceByStudent.get(studentId) ?? 0) + stuck);
          totalStuckBalance += stuck;
        }
      }
    }
    const stuckStudents = studentSummaries
      .filter(s => stuckStudentIds.has(s.id))
      .map(s => ({ ...s, stuckBalance: stuckBalanceByStudent.get(s.id) ?? 0 }));
    return { count: stuckStudentIds.size, totalBalance: totalStuckBalance, students: stuckStudents };
  }, [allPayments, studentSummaries]);

  const filtered = useMemo(() => {
    if (!searchStudent.trim()) return studentSummaries;
    const q = searchStudent.toLowerCase();
    return studentSummaries.filter(s =>
      s.studentName?.toLowerCase().includes(q) ||
      (s as any).fatherName?.toLowerCase().includes(q) ||
      String((s as any).rollNo ?? "").includes(q)
    );
  }, [studentSummaries, searchStudent]);

  const totalGenSummary = filtered.reduce((s, x) => s + x.generated, 0);
  const totalPaidSummary = filtered.reduce((s, x) => s + x.paid, 0);
  const totalRemSummary = filtered.reduce((s, x) => s + Math.max(0, x.remaining), 0);

  const overdueStudents = filtered.filter(s => (s as any).dueMonths > 0);
  const allOverdueSelected = overdueStudents.length > 0 && overdueStudents.every(s => selectedIds.has(s.id));

  function toggleSelectStudent(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAllOverdue() {
    if (allOverdueSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(overdueStudents.map(s => s.id)));
  }

  function downloadCSV() {
    const headers = ["#", "Student Name", "Roll No", "Father Name", "Class", "Section", "Type", "Due Months", "Generated", "Paid", "Remaining", "Status", "Email", "WhatsApp"];
    const rows = filtered.map((s, i) => {
      const cls = classes.find((c: any) => c.id === s.classId);
      const sec = sections.find((x: any) => x.id === (s as any).sectionId);
      const rowStatus = s.paid === 0 ? "Pending" : s.paid >= s.generated ? "Paid" : "Partial";
      return [
        i + 1, s.studentName ?? "", (s as any).rollNo ?? "", (s as any).fatherName ?? "",
        cls?.name ?? "", sec?.name ?? "", (s as any).studentType ?? "",
        (s as any).dueMonths ?? 0, s.generated.toFixed(0), s.paid.toFixed(0),
        Math.max(0, s.remaining).toFixed(0), rowStatus,
        (s as any).parentEmail ?? "", (s as any).whatsappNumber ?? "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fee-collection-${session}-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendReminders() {
    if (selectedIds.size === 0) return;
    setReminderSending(true);
    setReminderResult(null);
    try {
      const result = await sendReminders.mutateAsync({
        data: {
          studentIds: Array.from(selectedIds),
          month: reminderMonth,
          year: reminderYear,
          session,
          customMessage: reminderMsg.trim() || undefined,
        } as any,
      });
      setReminderResult(result as any);
      toast({ title: `Reminders sent: ${(result as any).sent} ok, ${(result as any).failed} failed` });
    } catch (err: any) {
      toast({ title: "Failed to send reminders", description: err?.message ?? "Check Gmail settings", variant: "destructive" });
    } finally {
      setReminderSending(false);
    }
  }

  async function handleBulkCollect() {
    if (selectedIds.size === 0 || bulkSubmitting) return;
    setBulkSubmitting(true);
    setBulkResult(null);
    const payDate = new Date().toISOString().split("T")[0];
    const bulkMYear = bulkMonth >= 4 ? year : year + 1;
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const selectedStudents = filtered.filter(s => selectedIds.has(s.id));
    for (const stu of selectedStudents) {
      const paidSet = paidMonthKeysByStudent.get(stu.id) ?? new Set<string>();
      if (paidSet.has(`${bulkMonth}-${bulkMYear}`)) { skippedCount++; continue; }

      const isRTE = (stu.studentType ?? "").toLowerCase().includes("rte");
      const tuitionStructs = structures.filter((s: any) => {
        if (s.classId !== stu.classId) return false;
        const cat = categories.find((c: any) => c.id === s.categoryId);
        const cn = (cat?.name ?? "").toLowerCase();
        if (cn.includes("admission")) return false;
        if (isRTE && (cn.includes("tuition") || cn.includes("tution"))) return false;
        return true;
      });
      const hasTransport = stu.hasVehicle && (stu as any).transportRouteId && (stu as any).transportRoutePricePerMonth;
      const transportAmt = hasTransport ? parseFloat(String((stu as any).transportRoutePricePerMonth)) || 0 : 0;

      const sharedBase = `RCP-${Date.now()}-${stu.id}`;
      try {
        for (let i = 0; i < tuitionStructs.length; i++) {
          const struct = tuitionStructs[i];
          const amt = parseFloat(String(struct.amount)) || 0;
          await collectFee.mutateAsync({
            data: {
              studentId: stu.id, categoryId: struct.categoryId,
              amount: amt, paidAmount: amt, discount: 0, fine: 0, status: "paid",
              month: bulkMonth, year: bulkMYear, session, paymentDate: payDate,
              paymentMethod: bulkPayMode, receiptNo: `${sharedBase}-T${i}`,
              remarks: "Bulk collection", isPreviousDue: false, sendReceipt: false,
            } as any,
          });
        }
        if (hasTransport && transportAmt > 0) {
          const transCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("transport"));
          if (transCat) {
            await collectFee.mutateAsync({
              data: {
                studentId: stu.id, categoryId: transCat.id,
                amount: transportAmt, paidAmount: transportAmt, discount: 0, fine: 0, status: "paid",
                month: bulkMonth, year: bulkMYear, session, paymentDate: payDate,
                paymentMethod: bulkPayMode, receiptNo: `${sharedBase}-TR`,
                remarks: "Bulk collection - Transport", isPreviousDue: false, sendReceipt: false,
              } as any,
            });
          }
        }
        successCount++;
      } catch {
        errorCount++;
      }
    }

    await refetchPayments();
    setBulkResult({ success: successCount, skipped: skippedCount, failed: errorCount });
    setBulkSubmitting(false);
    if (errorCount === 0) {
      toast({ title: `Bulk collection done! ${successCount} student${successCount !== 1 ? "s" : ""} paid${skippedCount > 0 ? `, ${skippedCount} already paid` : ""}` });
      if (successCount > 0) { setBulkOpen(false); setSelectedIds(new Set()); }
    } else {
      toast({ title: `Collection done with errors`, description: `${successCount} paid, ${errorCount} failed, ${skippedCount} skipped`, variant: "destructive" });
    }
  }

  if (detailStudent) {
    return (
      <StudentFeeDetailView
        student={detailStudent}
        session={session}
        year={year}
        categories={categories}
        structures={structures}
        allPayments={allPayments}
        classes={classes}
        sections={sections}
        allStudents={allStudents}
        onBack={() => setDetailStudent(null)}
        onCollected={() => refetchPayments()}
        onNavigateToStudent={(s) => setDetailStudent(s)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Reminder dialog */}
      <Dialog open={reminderOpen} onOpenChange={o => { setReminderOpen(o); if (!o) setReminderResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-amber-500" /> Send Fee Reminders</DialogTitle>
          </DialogHeader>
          {reminderResult ? (
            <div className="space-y-3">
              <div className={`rounded-lg p-4 flex items-center gap-3 ${reminderResult.failed === 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <CheckCircle2 className={`h-6 w-6 ${reminderResult.failed === 0 ? "text-green-600" : "text-amber-600"}`} />
                <div>
                  <p className="font-semibold text-sm">{reminderResult.sent} reminder{reminderResult.sent !== 1 ? "s" : ""} sent successfully</p>
                  {reminderResult.failed > 0 && <p className="text-xs text-red-600">{reminderResult.failed} failed (no email / send error)</p>}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100 text-xs">
                {reminderResult.results.map((r: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-1.5 ${r.ok ? "text-slate-600" : "text-red-500"}`}>
                    <span>{r.studentName}</span>
                    <span>{r.ok ? "✓ Sent" : `✗ ${r.error ?? "Failed"}`}</span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => { setReminderOpen(false); setReminderResult(null); setSelectedIds(new Set()); }}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                <strong>{selectedIds.size}</strong> student{selectedIds.size !== 1 ? "s" : ""} selected
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Fee Month</label>
                  <Select value={String(reminderMonth)} onValueChange={v => setReminderMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTH_NUMS.map(m => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Year</label>
                  <Select value={String(reminderYear)} onValueChange={v => setReminderYear(parseInt(v))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{[sessionYearStart(session) - 1, sessionYearStart(session), sessionYearStart(session) + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Custom Message <span className="text-slate-400">(optional)</span></label>
                <textarea
                  value={reminderMsg}
                  onChange={e => setReminderMsg(e.target.value)}
                  placeholder="Dear Parent, your fee for [month] is pending. Please pay at the earliest."
                  className="w-full h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>
              <p className="text-xs text-slate-400">Reminders are sent by email to parents with an email address on file. Configure Gmail in Settings → Security tab.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSendReminders}
                  disabled={reminderSending || selectedIds.size === 0}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                >
                  {reminderSending ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…</> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send {selectedIds.size} Reminder{selectedIds.size !== 1 ? "s" : ""}</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk collection dialog */}
      <Dialog open={bulkOpen} onOpenChange={o => { setBulkOpen(o); if (!o) setBulkResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-600" /> Bulk Fee Collection
            </DialogTitle>
          </DialogHeader>
          {bulkResult ? (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 flex items-center gap-3 ${bulkResult.failed === 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                <CheckCircle2 className={`h-6 w-6 ${bulkResult.failed === 0 ? "text-green-600" : "text-amber-600"}`} />
                <div>
                  <p className="font-semibold text-sm">{bulkResult.success} student{bulkResult.success !== 1 ? "s" : ""} collected successfully</p>
                  {bulkResult.skipped > 0 && <p className="text-xs text-slate-500">{bulkResult.skipped} already paid (skipped)</p>}
                  {bulkResult.failed > 0 && <p className="text-xs text-red-600">{bulkResult.failed} failed</p>}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setBulkOpen(false); setBulkResult(null); setSelectedIds(new Set()); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm text-teal-800">
                <strong>{selectedIds.size}</strong> student{selectedIds.size !== 1 ? "s" : ""} selected — collect fees for the same month for all
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Fee Month</label>
                  <Select value={String(bulkMonth)} onValueChange={v => setBulkMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTH_NUMS.map(m => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Payment Mode</label>
                  <Select value={bulkPayMode} onValueChange={setBulkPayMode}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="neft">NEFT/RTGS</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-slate-400">Students already paid for this month will be skipped automatically. Transport fee is included if the student has a transport route assigned.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleBulkCollect}
                  disabled={bulkSubmitting || selectedIds.size === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                >
                  {bulkSubmitting
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Collecting…</>
                    : <><DollarSign className="h-3.5 w-3.5 mr-1.5" /> Collect for {selectedIds.size} Student{selectedIds.size !== 1 ? "s" : ""}</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Filters + search */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Year</label>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[sessionYearStart(session) - 1, sessionYearStart(session), sessionYearStart(session) + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Class</label>
          <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSection("all"); }}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Section</label>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-28 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {filteredSections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-xs text-slate-500">Search Student</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              placeholder="Name, father, roll no…"
              className="h-8 text-sm pl-8"
            />
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 items-end pb-0.5">
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs border-slate-300 text-slate-600"
            onClick={downloadCSV}
            title="Download fee list as CSV"
          >
            <ChevronDown className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button
            size="sm"
            className={`h-8 text-xs font-semibold ${selectedIds.size > 0 ? "bg-teal-600 hover:bg-teal-700 text-white" : "bg-slate-100 text-slate-400 cursor-default"}`}
            onClick={() => selectedIds.size > 0 && setBulkOpen(true)}
            title="Collect fees for all selected students at once"
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {selectedIds.size > 0 ? `Collect (${selectedIds.size})` : "Bulk Collect"}
          </Button>
          <Button
            size="sm"
            className={`h-8 text-xs font-semibold ${selectedIds.size > 0 ? "bg-amber-500 hover:bg-amber-600 text-black" : "bg-slate-100 text-slate-400 cursor-default"}`}
            onClick={() => selectedIds.size > 0 && setReminderOpen(true)}
            title="Send fee reminders to selected students"
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            {selectedIds.size > 0 ? `Remind (${selectedIds.size})` : "Remind"}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-500 font-medium">Total Generated</div>
          <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{currencyFmt(totalGenSummary)}</div>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-lg p-3">
          <div className="text-xs text-teal-600 font-medium">Total Collected</div>
          <div className="text-lg font-bold text-teal-700 dark:text-teal-400">{currencyFmt(totalPaidSummary)}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-3">
          <div className="text-xs text-red-600 font-medium">Total Remaining</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-400">{currencyFmt(totalRemSummary)}</div>
        </div>
        {/* Stuck Dues card — clickable */}
        <div
          className={`rounded-lg p-3 border transition-all select-none ${stuckDuesInfo.count > 0 ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 cursor-pointer hover:shadow-md hover:border-yellow-400" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
          onClick={() => stuckDuesInfo.count > 0 && setShowStuckPanel(p => !p)}
          title={stuckDuesInfo.count > 0 ? "Click to view students with stuck dues" : undefined}
        >
          <div className={`text-xs font-medium flex items-center gap-1 ${stuckDuesInfo.count > 0 ? "text-yellow-700 dark:text-yellow-400" : "text-slate-500"}`}>
            {stuckDuesInfo.count > 0 ? "⚠ Stuck Dues" : "Stuck Dues"}
            {stuckDuesInfo.count > 0 && <span className="ml-auto text-[10px] text-yellow-500">{showStuckPanel ? "▲ hide" : "▼ view"}</span>}
          </div>
          <div className={`text-lg font-bold mt-0.5 ${stuckDuesInfo.count > 0 ? "text-yellow-800 dark:text-yellow-300" : "text-slate-400"}`}>
            {stuckDuesInfo.count > 0 ? currencyFmt(stuckDuesInfo.totalBalance) : "—"}
          </div>
          <div className={`text-[10px] mt-0.5 ${stuckDuesInfo.count > 0 ? "text-yellow-600 dark:text-yellow-500" : "text-slate-400"}`}>
            {stuckDuesInfo.count > 0
              ? `${stuckDuesInfo.count} student${stuckDuesInfo.count !== 1 ? "s" : ""} — click to view`
              : "No stuck payments"}
          </div>
        </div>
      </div>

      {/* Stuck Dues detail panel — shown on card click */}
      {showStuckPanel && stuckDuesInfo.count > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
            <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              Stuck Dues — {stuckDuesInfo.count} Student{stuckDuesInfo.count !== 1 ? "s" : ""} · Total {currencyFmt(stuckDuesInfo.totalBalance)}
            </span>
            <span className="ml-auto text-xs text-yellow-600 dark:text-yellow-500">Click a student row to open their collection page</span>
          </div>
          <div className="rounded-lg overflow-hidden border border-yellow-200 dark:border-yellow-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-yellow-100 dark:bg-yellow-900/40">
                  <th className="text-left px-3 py-2 font-semibold text-yellow-800">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-yellow-800">Student</th>
                  <th className="text-left px-3 py-2 font-semibold text-yellow-800">Class</th>
                  <th className="text-right px-3 py-2 font-semibold text-yellow-800">Stuck Amount</th>
                  <th className="text-center px-3 py-2 font-semibold text-yellow-800">Action</th>
                </tr>
              </thead>
              <tbody>
                {stuckDuesInfo.students.map((s: any, idx: number) => (
                  <tr
                    key={s.id}
                    className="border-t border-yellow-100 dark:border-yellow-800 bg-white dark:bg-slate-800 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 cursor-pointer transition-colors"
                    onClick={() => { setShowStuckPanel(false); setDetailStudent(s); }}
                    title="Click to open this student's fee collection page"
                  >
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{s.studentName}</td>
                    <td className="px-3 py-2 text-slate-500">{(s as any).className || "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-600">₹{((s as any).stuckBalance ?? 0).toFixed(0)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 text-yellow-700 hover:text-yellow-900 font-medium">
                        <Eye className="h-3 w-3" /> Open
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student list */}
      {studentsLoading ? (
        <div className="text-center py-8 text-slate-400">Loading students…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{searchStudent ? "No students match your search." : "No students found. Select a class or add students."}</p>
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="w-8 text-center">
                  <Checkbox
                    checked={allOverdueSelected}
                    onCheckedChange={toggleSelectAllOverdue}
                    title="Select all overdue students"
                    aria-label="Select all overdue"
                  />
                </TableHead>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Due Months</TableHead>
                <TableHead className="text-right">Generated</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s, idx) => {
                const cls = classes.find((c: any) => c.id === s.classId);
                const sec = sections.find((x: any) => x.id === s.sectionId);
                const pct = s.generated > 0 ? Math.round((s.paid / s.generated) * 100) : 0;
                const rowStatus = s.paid === 0 ? "pending" : s.paid >= s.generated ? "paid" : "partial";
                const isRTE = (s as any).studentType?.toLowerCase() === "rte";
                const dueMonths = (s as any).dueMonths ?? 0;
                const daysOverdue = (s as any).daysOverdue ?? 0;
                const earliestOverdueLabel = (s as any).earliestOverdueLabel ?? "";
                const isChecked = selectedIds.has(s.id);
                return (
                  <TableRow key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer ${isChecked ? "bg-amber-50/60 dark:bg-amber-900/10" : daysOverdue > 0 ? "bg-red-50/60 dark:bg-red-900/10" : ""}`} onClick={() => setDetailStudent(s)}>
                    <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                      {dueMonths > 0 && (
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelectStudent(s.id)}
                          aria-label={`Select ${s.studentName}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(s as any).photoUrl
                          ? <img src={(s as any).photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                          : <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-600">{s.studentName?.[0]}</div>
                        }
                        <div>
                          <div className="font-medium text-sm">{s.studentName}</div>
                          <div className="text-xs text-slate-400">Roll: {(s as any).rollNo ?? "—"}</div>
                          {getSessionStatus((s as any).studentType) && (
                            <div className="mt-0.5">
                              <SessionStatusBadge studentType={(s as any).studentType} />
                            </div>
                          )}
                          {daysOverdue > 0 && (
                            <div className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-300 rounded px-1.5 mt-0.5 inline-block whitespace-nowrap">
                              ⚠ Defaulter · {daysOverdue}d overdue since {earliestOverdueLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{cls?.name} {sec?.name}</TableCell>
                    <TableCell>
                      {isRTE
                        ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">RTE</Badge>
                        : <span className="text-xs text-slate-500">{(s as any).studentType || "—"}</span>
                      }
                    </TableCell>
                    <TableCell className="text-center max-w-[160px]">
                      {dueMonths > 0
                        ? <span className="text-[10px] text-red-700 font-medium leading-tight">{(s as any).dueMonthNames}</span>
                        : <span className="text-[10px] text-slate-400">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{currencyFmt(s.generated)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-teal-700 dark:text-teal-400">{currencyFmt(s.paid)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-red-600 dark:text-red-400">{currencyFmt(Math.max(0, s.remaining))}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {statusBadge(rowStatus)}
                        <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {dueMonths > 0 && (s as any).whatsappNumber && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-green-300 text-green-700 hover:bg-green-50 text-xs px-2"
                            title={`WhatsApp reminder to ${(s as any).whatsappNumber}`}
                            onClick={e => {
                              e.stopPropagation();
                              const ph = String((s as any).whatsappNumber ?? "").replace(/\D/g, "");
                              const num = ph.length === 10 ? `91${ph}` : ph;
                              const monthNames = (s as any).dueMonthNames ?? "";
                              const msg = `Dear Parent of ${s.studentName}, your school fee of ₹${Math.max(0, s.remaining).toFixed(0)} is pending for: ${monthNames}. Please pay at the earliest. Thank you.`;
                              window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
                            }}
                          >
                            <MessageCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" className="h-7 bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold" onClick={e => { e.stopPropagation(); setDetailStudent(s); }}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary — prevents a tab section crash from wiping the whole screen
// ─────────────────────────────────────────────────────────────────────────────

class FeeTabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error?.message ?? error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center border border-red-100 rounded-xl bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <div className="text-red-600 font-semibold mb-2">Something went wrong loading this section.</div>
          <div className="text-xs text-slate-400 mb-4 font-mono break-all">{this.state.error}</div>
          <button
            className="text-xs text-teal-600 underline hover:text-teal-800"
            onClick={() => this.setState({ hasError: false, error: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Dashboard Tab
// ─────────────────────────────────────────────────────────────────────────────

function FeeSummaryTab({ session }: { session: string }) {
  const [filterClass, setFilterClass] = useState<string>("all");
  const [year, setYear] = useState<number>(() => sessionYearStart(session));
  useEffect(() => { setYear(sessionYearStart(session)); }, [session]);
  const { data: classes = [] } = useListClasses();
  const { data: students = [] } = useListStudents({});
  const { data: categories = [] } = useListFeeCategories();
  const { data: structures = [] } = useListFeeStructures({ session });
  const { data: allPayments = [], isLoading } = useListFeePayments(
    { session },
    { query: { queryKey: getListFeePaymentsQueryKey({ session }), staleTime: 30_000 } }
  );

  const todayDate = useMemo(() => new Date(), []);

  // Per-student expected fee + actual paid — mirrors FeeCollectionTab.getStudentGenerated exactly
  const studentSummaries = useMemo(() => {
    const filteredStudents = filterClass !== "all"
      ? students.filter(s => String(s.classId) === filterClass)
      : students;

    return filteredStudents.map(stu => {
      const classId = stu.classId;
      if (!classId) return null;
      const isRTE = ((stu as any).studentType ?? "").toLowerCase() === "rte";
      const isNew = ((stu as any).studentType ?? "").toLowerCase().includes("new");
      const prevYearDue = parseFloat(String((stu as any).previousYearDue || "0")) || 0;
      // Admission fee
      const admCat = categories.find((c: any) => (c.name ?? "").toLowerCase().includes("admission"));
      const admStruct = admCat
        ? structures.find((st: any) => st.categoryId === admCat.id && st.classId === classId)
        : null;
      const admFeeAmount = isNew && admStruct ? parseFloat(String(admStruct.amount)) || 0 : 0;
      // Transport fee from student's route (not from structures — avoids double-counting)
      const transportFee =
        (stu as any).hasVehicle && (stu as any).transportRouteId && (stu as any).transportRoutePricePerMonth
          ? parseFloat(String((stu as any).transportRoutePricePerMonth)) || 0
          : 0;
      // Tuition structures (transport and admission excluded — handled separately)
      const tuitionStructsForSummary = structures.filter((st: any) => {
        if (st.classId !== classId) return false;
        const cat = categories.find((c: any) => c.id === st.categoryId);
        const cn = (cat?.name ?? "").toLowerCase();
        if (cn.includes("admission") || cn.includes("transport") || cn.includes("bus")) return false;
        if (isRTE && (cn.includes("tuition") || cn.includes("tution"))) return false;
        return true;
      });
      // Start month index (for mid-year admissions)
      const startIdx = (stu as any).feeFromApril === false && (stu as any).admissionDate
        ? (() => {
            const parts = String((stu as any).admissionDate).split("-");
            const m = parseInt(parts[1] || "0");
            const idx = SCHOOL_MONTHS_ORDER.indexOf(m);
            return idx >= 0 ? idx : 0;
          })()
        : 0;
      // Count months generated so far — respects each category's frequency
      let generatedTotal = 0;
      for (let i = startIdx; i < SCHOOL_MONTHS_ORDER.length; i++) {
        const m = SCHOOL_MONTHS_ORDER[i];
        const mYear = m >= 4 ? year : year + 1;
        if (new Date(mYear, m - 1, 1) > todayDate) break;
        const schoolYearIdx = SCHOOL_MONTHS_ORDER.indexOf(m);
        const monthTuition = tuitionStructsForSummary.reduce((sum: number, st: any) => {
          const amt = parseFloat(String(st.amount)) || 0;
          const freq = ((st.frequency as string) || "monthly").toLowerCase();
          if (freq === "monthly") return sum + amt;
          if (freq === "quarterly") return schoolYearIdx % 3 === 0 ? sum + amt : sum;
          if (freq === "annually")  return schoolYearIdx === 0 ? sum + amt : sum;
          if (freq === "one-time")  return i === startIdx ? sum + amt : sum;
          return sum + amt;
        }, 0);
        generatedTotal += monthTuition + transportFee + (i === startIdx ? admFeeAmount : 0);
      }
      const generated = generatedTotal + prevYearDue;
      // Actual paid from payment records
      const paid = allPayments
        .filter(p => p.studentId === stu.id)
        .reduce((s, p) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
      return { studentId: stu.id, classId, generated, paid };
    }).filter((x): x is { studentId: number; classId: number; generated: number; paid: number } => x !== null);
  }, [students, structures, categories, allPayments, filterClass, year, todayDate]);

  const totalGenerated = useMemo(() => studentSummaries.reduce((s, r) => s + r.generated, 0), [studentSummaries]);
  const totalPaid = useMemo(() => studentSummaries.reduce((s, r) => s + r.paid, 0), [studentSummaries]);
  // Sum per-student remainders so overpayments by one student don't cancel out another's balance
  const totalPending = useMemo(() => studentSummaries.reduce((s, r) => s + Math.max(0, r.generated - r.paid), 0), [studentSummaries]);
  const collectionRate = totalGenerated > 0 ? Math.round((totalPaid / totalGenerated) * 100) : 0;

  // Monthly bar chart from payment records grouped by month-year
  const byMonth = useMemo(() => {
    const filteredIds = filterClass !== "all"
      ? new Set(students.filter(s => String(s.classId) === filterClass).map(s => s.id))
      : null;
    const map = new Map<string, { month: number; yr: number; paid: number; pending: number }>();
    for (const p of allPayments) {
      if (!p.month || !p.year) continue;
      if (filteredIds && !filteredIds.has(p.studentId!)) continue;
      const key = `${p.year}-${p.month}`;
      if (!map.has(key)) map.set(key, { month: p.month!, yr: p.year!, paid: 0, pending: 0 });
      const entry = map.get(key)!;
      const amt = parseFloat(String(p.amount ?? "0")) || 0;
      const paidAmt = parseFloat(String(p.paidAmount ?? "0")) || 0;
      if (p.status === "paid") entry.paid += paidAmt;
      else entry.pending += Math.max(0, amt - paidAmt);
    }
    return Array.from(map.values())
      .sort((a, b) => a.yr !== b.yr ? a.yr - b.yr : a.month - b.month)
      .map(m => ({ name: MONTHS[(m.month - 1)].slice(0, 3), paid: m.paid, pending: m.pending }));
  }, [allPayments, filterClass, students]);

  const pieData = useMemo(() => [
    { name: "Paid", value: totalPaid, color: "#0f766e" },
    { name: "Pending", value: totalPending, color: "#ef4444" },
  ].filter(d => d.value > 0), [totalPaid, totalPending]);

  // Class-wise breakdown computed from studentSummaries
  const classwiseSummary = useMemo(() => {
    const map = new Map<number, { classId: number; className: string; generated: number; paid: number }>();
    for (const item of studentSummaries) {
      const cls = classes.find(c => c.id === item.classId);
      const clsName = cls?.name ?? `Class ${item.classId}`;
      if (!map.has(item.classId)) map.set(item.classId, { classId: item.classId, className: clsName, generated: 0, paid: 0 });
      const entry = map.get(item.classId)!;
      entry.generated += item.generated;
      entry.paid += item.paid;
    }
    return Array.from(map.values()).sort((a, b) => a.className.localeCompare(b.className));
  }, [studentSummaries, classes]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 font-medium">Session: <span className="text-slate-700 font-semibold">{session}</span></span>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-slate-400">Year</label>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[sessionYearStart(session) - 1, sessionYearStart(session), sessionYearStart(session) + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-1">Computed from fee structures — same logic as Collection tab</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading summary…</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Collected", value: currencyFmt(totalPaid), color: "green" },
              { label: "Total Generated (So Far)", value: currencyFmt(totalGenerated), color: "amber" },
              { label: "Pending", value: currencyFmt(totalPending), color: "red" },
              { label: "Collection Rate", value: `${collectionRate}%`, color: "blue" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-100 dark:border-${color}-800 rounded-xl p-3`}>
                <div className={`text-[11px] text-${color}-600 font-medium`}>{label}</div>
                <div className={`text-xl font-bold text-${color}-700 dark:text-${color}-400 mt-0.5`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Collection rate progress bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Overall Collection Progress</span>
              <span className="text-sm font-bold text-teal-700">{collectionRate}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(collectionRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Collected: {currencyFmt(totalPaid)}</span>
              <span>Due so far: {currencyFmt(totalGenerated)}</span>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monthly Collection vs Pending</CardTitle>
              </CardHeader>
              <CardContent className="px-1 pb-4">
                {byMonth.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-sm">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byMonth} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => currencyFmt(v)} />
                      <Bar dataKey="paid" name="Collected" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="pending" name="Pending" fill="#fca5a5" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Collection Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center pb-4 pt-2">
                {pieData.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-sm">No payments recorded yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData} cx="50%" cy="50%" outerRadius={75}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false} fontSize={11}
                      >
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => currencyFmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Class-wise breakdown */}
          {classwiseSummary.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Class-wise Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                        <TableHead className="pl-4">Class</TableHead>
                        <TableHead>Total Generated (So Far)</TableHead>
                        <TableHead>Collected</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classwiseSummary.map(c => {
                        const rate = c.generated > 0 ? Math.round((c.paid / c.generated) * 100) : 0;
                        const pending = Math.max(0, c.generated - c.paid);
                        return (
                          <TableRow key={c.classId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <TableCell className="pl-4 font-medium">{c.className}</TableCell>
                            <TableCell className="text-slate-600">{currencyFmt(c.generated)}</TableCell>
                            <TableCell className="text-green-700 font-medium">{currencyFmt(c.paid)}</TableCell>
                            <TableCell className="text-red-600">{currencyFmt(pending)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
                                </div>
                                <span className="text-xs font-medium">{rate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders Tab
// ─────────────────────────────────────────────────────────────────────────────

function FeeRemindersTab({ session }: { session: string }) {
  const { toast } = useToast();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(() => sessionYearStart(session));
  useEffect(() => { setYear(sessionYearStart(session)); }, [session]);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const classIdParam = filterClass !== "all" ? parseInt(filterClass) : undefined;
  const sectionIdParam = filterSection !== "all" ? parseInt(filterSection) : undefined;

  const { data: rawPending = [], isLoading, error, refetch } = useGetPendingStudents(
    { month, year, session, classId: classIdParam, sectionId: sectionIdParam },
    { query: { queryKey: getGetPendingStudentsQueryKey({ month, year, session, classId: classIdParam, sectionId: sectionIdParam }), staleTime: 15_000 } }
  );
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const filteredSections = (() => {
    if (filterClass === "all") return sections;
    const byClass = sections.filter(s => s.classId === parseInt(filterClass));
    if (byClass.length > 0) return byClass;
    return sections; // sections are global (no classId) — show all
  })();

  // Client-side search on top of API results
  const pending = useMemo(() => {
    if (!searchQ.trim()) return rawPending;
    const q = searchQ.toLowerCase();
    return rawPending.filter((s: any) =>
      String(s.studentName ?? "").toLowerCase().includes(q) ||
      String(s.fatherName ?? "").toLowerCase().includes(q) ||
      String(s.className ?? "").toLowerCase().includes(q)
    );
  }, [rawPending, searchQ]);

  const sendRemindersMutation = useSendFeeReminders({
    mutation: {
      onSuccess: (data: any) => {
        const sent = data?.sent ?? 0;
        const failed = data?.failed ?? 0;
        toast({ title: `Done! ${sent} reminder${sent !== 1 ? "s" : ""} sent${failed > 0 ? `, ${failed} failed` : ""}` });
        setSelected(new Set());
        setSending(false);
      },
      onError: (err: any) => {
        toast({ title: "Failed to send reminders", description: String(err?.message ?? "Unknown error"), variant: "destructive" });
        setSending(false);
      },
    },
  });

  const allIds = useMemo(() => new Set(rawPending.map((p: any) => p.studentId as number)), [rawPending]);
  const allSelected = selected.size > 0 && [...allIds].every(id => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }
  function toggleOne(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function handleSendEmail() {
    if (selected.size === 0) return;
    setSending(true);
    sendRemindersMutation.mutate({
      data: { studentIds: Array.from(selected), month, year, session, customMessage: customMessage.trim() || undefined },
    });
  }

  function handleWhatsapp(s: any) {
    const phone = String(s.whatsappNumber ?? "").replace(/\D/g, "");
    if (!phone) { toast({ title: "No WhatsApp number on file" }); return; }
    const num = phone.length === 10 ? `91${phone}` : phone;
    const msg = customMessage.trim() ||
      `Dear Parent of ${s.studentName ?? "student"}, your school fee for ${MONTHS[month - 1]} ${year} amounting to ₹${s.balance ?? 0} is pending. Please pay at the earliest. Thank you.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const totalBalance = useMemo(() => rawPending.reduce((sum: number, s: any) => sum + (s.balance ?? 0), 0), [rawPending]);

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
          <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_NUMS.map(m => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[sessionYearStart(session) - 1, sessionYearStart(session), sessionYearStart(session) + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSection("all"); }}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSection} onValueChange={setFilterSection}>
          <SelectTrigger className="w-24 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filteredSections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search student…" className="h-8 text-sm pl-8" />
        </div>
      </div>

      {/* Custom message box */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1">Custom Reminder Message (optional)</label>
        <textarea
          className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="Leave blank to use the default message…"
          value={customMessage}
          onChange={e => setCustomMessage(e.target.value)}
        />
      </div>

      {/* Stats bar + action buttons */}
      {rawPending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            {rawPending.length} student{rawPending.length !== 1 ? "s" : ""} pending — Total balance: {currencyFmt(totalBalance)}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm" className="h-7 bg-amber-600 hover:bg-amber-700 text-white text-xs"
              disabled={selected.size === 0 || sending || sendRemindersMutation.isPending}
              onClick={handleSendEmail}
            >
              <Mail className="h-3 w-3 mr-1" />
              {sending ? "Sending…" : `Email (${selected.size})`}
            </Button>
          </div>
        </div>
      )}

      {/* Select all / count row */}
      {rawPending.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox id="remind-select-all" checked={allSelected} onCheckedChange={toggleAll} />
          <label htmlFor="remind-select-all" className="text-sm text-slate-600 cursor-pointer select-none">
            Select all {rawPending.length} students
          </label>
          {selected.size > 0 && <span className="text-xs text-amber-600 font-medium ml-1">({selected.size} selected)</span>}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-10 text-slate-400">Loading pending students…</div>
      ) : error ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-red-500 text-sm">Failed to load pending students.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : rawPending.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="text-base font-medium">All fees collected for {MONTHS[month - 1]} {year}!</p>
          <p className="text-sm mt-1">No pending students for this month.</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No students match your search.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="w-10 pl-3"></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((s: any) => (
                  <TableRow key={s.studentId} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${selected.has(s.studentId) ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                    <TableCell className="pl-3">
                      <Checkbox checked={selected.has(s.studentId)} onCheckedChange={() => toggleOne(s.studentId)} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{s.studentName}</div>
                      <div className="text-xs text-slate-400">{s.fatherName || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{s.className} {s.sectionName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-red-600 border-red-200 text-xs">
                        {s.pendingMonths ?? "?"} mo
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-600 text-sm">{currencyFmt(s.balance ?? 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                          disabled={!s.whatsappNumber}
                          onClick={() => handleWhatsapp(s)}
                          title={s.whatsappNumber ? `WhatsApp ${s.whatsappNumber}` : "No WhatsApp number"}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> WA
                        </Button>
                        {s.parentEmail && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            disabled={sending || sendRemindersMutation.isPending}
                            onClick={() => {
                              setSending(true);
                              sendRemindersMutation.mutate({
                                data: { studentIds: [s.studentId], month, year, session, customMessage: customMessage.trim() || undefined },
                              });
                            }}
                            title={`Send email to ${s.parentEmail}`}
                          >
                            <Mail className="h-3 w-3 mr-1" /> Email
                          </Button>
                        )}
                      </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Receipts Tab
// ─────────────────────────────────────────────────────────────────────────────

function FeeReceiptsTab({ session }: { session: string }) {
  const { toast } = useToast();
  const todayStr = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState<string>(monthStart);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [filterClass, setFilterClass] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [utrSearch, setUtrSearch] = useState("");
  const [filterCollectedBy, setFilterCollectedBy] = useState<string>("all");
  const [staffUsers, setStaffUsers] = useState<{ id: number; name: string; role: string }[]>([]);

  const classIdParam = filterClass !== "all" ? parseInt(filterClass) : undefined;
  const { data: allPmts = [], isLoading, error } = useListFeePayments(
    { session, classId: classIdParam },
    { query: { queryKey: getListFeePaymentsQueryKey({ session, classId: classIdParam }), staleTime: 60_000 } }
  );
  const { data: classes = [] } = useListClasses();

  useEffect(() => {
    const t = getAdminToken();
    const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
    fetch("/api/staff-users", { headers })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setStaffUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const sendReceipt = useSendFeeReceipt({
    mutation: {
      onSuccess: (data: any) => toast({ title: data?.message || "Receipt sent to parent" }),
      onError: (err: any) => toast({ title: "Failed to send receipt", description: String(err?.message ?? ""), variant: "destructive" }),
    },
  });

  // Group payments by shared receipt base (RCP-{timestamp}) — multi-month collections share one base.
  // Exception: payments generated online (parent portal / public website quick-access fee payment,
  // both tagged collectedBy="Online (UPI)" by the Razorpay routes) are grouped by student instead,
  // so every fee item paid together in ONE checkout (one Razorpay transaction, whether from the
  // parent portal or the public quick-access flow) becomes ONE row — same as an admin/staff
  // transaction groups by its receipt-number base. Separate checkout sessions (even for the same
  // student) stay as separate rows, exactly like separate admin-collected transactions do.
  const receiptRows = useMemo(() => {
    type ReceiptRow = {
      key: string; studentId: number; studentName: string; rollNo: any; fatherName: any;
      className: any; sectionName: any; parentEmail: any;
      months: string[];
      paymentDate: string; paymentMethod: string; collectedBy: string;
      payments: any[]; totalPaid: number; totalAmount: number; status: string;
      firstPaymentId: number; receiptNo: string; receiptNos: string[];
    };
    const map = new Map<string, ReceiptRow>();
    for (const p of allPmts) {
      if (!p.studentId) continue;
      const rawRcpt = p.receiptNo ?? `RCP-${p.id}`;
      // Extract the shared transaction base so multiple fee-line-item rows from the SAME checkout
      // collapse into one row: admin/staff receipts look like "RCP-{timestamp}-{suffix}", online
      // receipts look like "UPI-{razorpay_payment_id}-{lineIndex}".
      const rcptBase =
        rawRcpt.match(/^(RCP-\d+)/)?.[1] ??
        rawRcpt.match(/^(UPI-.+)-\d+$/)?.[1] ??
        rawRcpt;
      const key = `${p.studentId}-${rcptBase}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          studentId: p.studentId,
          studentName: p.studentName ?? "Unknown",
          rollNo: p.rollNo,
          fatherName: p.fatherName,
          className: p.className,
          sectionName: p.sectionName,
          parentEmail: p.parentEmail,
          months: [],
          paymentDate: p.paymentDate ?? "",
          paymentMethod: p.paymentMethod ?? "cash",
          collectedBy: p.collectedBy ?? "",
          payments: [],
          totalPaid: 0,
          totalAmount: 0,
          status: "pending",
          firstPaymentId: p.id,
          receiptNo: rcptBase,
          receiptNos: [rcptBase],
        });
      }
      const row = map.get(key)!;
      row.payments.push(p);
      row.totalPaid += Number(p.paidAmount ?? 0);
      row.totalAmount += Number(p.amount ?? 0);
      if (!row.receiptNos.includes(rcptBase)) row.receiptNos.push(rcptBase);
      if (p.paymentDate && (!row.paymentDate || p.paymentDate > row.paymentDate)) {
        row.paymentDate = p.paymentDate;
        row.paymentMethod = p.paymentMethod ?? "cash";
        if (p.collectedBy) row.collectedBy = p.collectedBy;
        row.receiptNo = rcptBase;
      }
      if (p.month && p.year && !p.isPreviousDue) {
        const mLabel = `${MONTHS[(p.month - 1)]} ${p.year}`;
        if (!row.months.includes(mLabel)) row.months.push(mLabel);
      }
    }
    for (const row of map.values()) {
      if (row.totalAmount > 0 && row.totalPaid >= row.totalAmount) row.status = "paid";
      else if (row.totalPaid > 0) row.status = "partial";
      else row.status = "pending";
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.paymentDate && a.paymentDate) return b.paymentDate.localeCompare(a.paymentDate);
      return a.studentName.localeCompare(b.studentName);
    });
  }, [allPmts]);

  // Filter by date range, search, and UTR
  const filtered = useMemo(() => {
    return receiptRows.filter(r => {
      if (fromDate && r.paymentDate && r.paymentDate < fromDate) return false;
      if (toDate && r.paymentDate && r.paymentDate > toDate) return false;
      if (utrSearch.trim()) {
        const utr = utrSearch.trim();
        const hasUtr = r.payments.some((p: any) =>
          p.remarks && String(p.remarks).includes(`UTR:****${utr}`)
        );
        if (!hasUtr) return false;
      }
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        return (
          r.studentName.toLowerCase().includes(q) ||
          String(r.rollNo ?? "").includes(q) ||
          r.receiptNo.toLowerCase().includes(q) ||
          String(r.fatherName ?? "").toLowerCase().includes(q)
        );
      }
      if (filterCollectedBy !== "all") {
        if (filterCollectedBy === "Administrator") {
          if (r.collectedBy !== "Administrator" && r.collectedBy !== "Admin Panel" && r.collectedBy !== "") return false;
        } else if (filterCollectedBy === "Parent (UPI)") {
          if (r.collectedBy !== "Parent (UPI)" && r.collectedBy !== "Online (UPI)") return false;
        } else {
          if (r.collectedBy !== filterCollectedBy) return false;
        }
      }
      return true;
    });
  }, [receiptRows, fromDate, toDate, searchQ, utrSearch, filterCollectedBy]);

  const totalCollected = useMemo(() => filtered.reduce((s, r) => s + r.totalPaid, 0), [filtered]);

  const modeTotals = useMemo(() => {
    const t = { cash: 0, online: 0, cheque: 0, dd: 0 };
    for (const r of filtered) {
      const m = (r.paymentMethod ?? "cash").toLowerCase();
      if (m === "cash") t.cash += r.totalPaid;
      else if (m === "online") t.online += r.totalPaid;
      else if (m === "cheque") t.cheque += r.totalPaid;
      else if (m === "dd") t.dd += r.totalPaid;
      else t.cash += r.totalPaid;
    }
    return t;
  }, [filtered]);

  function handlePrintAll() {
    if (filtered.length === 0) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { alert("Allow popups to print all receipts."); return; }
    const schoolName = (document.querySelector('meta[name="school-name"]') as HTMLMetaElement)?.content || "School";
    const rows = filtered.map(row => {
      const breakdown = row.payments
        .filter((p: any) => !p.isPreviousDue)
        .map((p: any) => `<tr><td>${p.categoryName ?? "Fee"}</td><td>₹${Number(p.amount ?? 0).toFixed(0)}</td><td>₹${Number(p.paidAmount ?? 0).toFixed(0)}</td></tr>`)
        .join("");
      const carryoverRows = row.payments.filter((p: any) => p.isPreviousDue).map((p: any) =>
        `<tr style="color:#d97706;"><td>Carry-fwd (${MONTHS[(p.month ?? 1) - 1] ?? ""})</td><td>₹${Number(p.amount ?? 0).toFixed(0)}</td><td>₹${Number(p.paidAmount ?? 0).toFixed(0)}</td></tr>`
      ).join("");
      return `
        <div class="receipt">
          <div class="rcpt-header">
            <div class="school-name">${schoolName}</div>
            <div class="rcpt-title">FEE RECEIPT</div>
          </div>
          <table class="info-table">
            <tr><td><b>Receipt No:</b></td><td>${row.receiptNo}</td><td><b>Date:</b></td><td>${formatDate(row.paymentDate) || "—"}</td></tr>
            <tr><td><b>Student:</b></td><td>${row.studentName}</td><td><b>Roll No:</b></td><td>${row.rollNo ?? "—"}</td></tr>
            <tr><td><b>Father:</b></td><td>${row.fatherName ?? "—"}</td><td><b>Class:</b></td><td>${row.className ?? ""} ${row.sectionName ?? ""}</td></tr>
            <tr><td><b>Month(s):</b></td><td colspan="3">${row.months.join(", ") || "—"}</td></tr>
            <tr><td><b>Method:</b></td><td>${row.paymentMethod ?? "cash"}</td><td><b>Status:</b></td><td><b>${row.status.toUpperCase()}</b></td></tr>
          </table>
          <table class="fee-table">
            <thead><tr><th>Category</th><th>Amount</th><th>Paid</th></tr></thead>
            <tbody>${breakdown}${carryoverRows}</tbody>
            <tfoot><tr><th colspan="2">Total Paid</th><th>₹${Number(row.totalPaid).toFixed(0)}</th></tr></tfoot>
          </table>
          <div class="rcpt-footer">Authorized Signature ___________________</div>
        </div>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Fee Receipts</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:10px;}
        .receipt{border:2px solid #333;padding:12px;margin-bottom:16px;page-break-inside:avoid;max-width:700px;margin-left:auto;margin-right:auto;}
        .rcpt-header{text-align:center;border-bottom:1px solid #999;margin-bottom:8px;padding-bottom:6px;}
        .school-name{font-size:16px;font-weight:bold;}
        .rcpt-title{font-size:12px;color:#555;letter-spacing:2px;text-transform:uppercase;}
        .info-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
        .info-table td{padding:2px 6px;vertical-align:top;}
        .fee-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
        .fee-table th,.fee-table td{border:1px solid #ccc;padding:3px 6px;text-align:left;}
        .fee-table thead{background:#f5f5f5;}
        .fee-table tfoot{background:#eef8ee;font-weight:bold;}
        .fee-table tfoot th:last-child{font-size:13px;color:#166534;}
        .rcpt-footer{text-align:right;margin-top:10px;font-size:10px;color:#555;}
        @media print{body{margin:0;}.receipt{margin-bottom:10px;break-inside:avoid;}}
      </style></head><body>${rows}<script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  }

  function handlePrintSummary() {
    if (filtered.length === 0) return;
    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) { alert("Allow popups to print the summary."); return; }
    const schoolName = (document.querySelector('meta[name="school-name"]') as HTMLMetaElement)?.content || "School";
    const dateRange = (fromDate || toDate) ? `${fromDate || "Start"} → ${toDate || "Today"}` : "All Dates";

    const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const modeCards = [
      { label: "Cash",   value: modeTotals.cash,   color: "#166534" },
      { label: "Online", value: modeTotals.online,  color: "#1d4ed8" },
      { label: "Cheque", value: modeTotals.cheque,  color: "#6b21a8" },
      { label: "DD",     value: modeTotals.dd,      color: "#c2410c" },
      { label: "Total",  value: totalCollected,     color: "#0f766e", bold: true },
    ].map(({ label, value, color, bold }) => `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 18px;text-align:center;min-width:110px;background:#f8fafc;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
        <div style="font-size:${bold ? "16px" : "14px"};font-weight:${bold ? "800" : "700"};color:${color};">${fmt(value)}</div>
      </div>`).join("");

    const tableRows = filtered.map((row, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const statusColor = row.status === "paid" ? "#166534" : row.status === "partial" ? "#92400e" : "#334155";
      const statusBg   = row.status === "paid" ? "#dcfce7"  : row.status === "partial" ? "#fef9c3"  : "#f1f5f9";
      // Extract UTR last-4 from any payment's remarks (stored as UTR:****XXXX)
      const utrMatch = row.payments
        .map((p: any) => String(p.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/))
        .find(Boolean);
      const utrSuffix = utrMatch ? ` <span style="font-size:9px;color:#1d4ed8;font-weight:600;">(UTR:****${utrMatch[1]})</span>` : "";
      return `
        <tr style="background:${bg};">
          <td>${row.receiptNo}</td>
          <td><b>${row.studentName}</b></td>
          <td>${(row.className ?? "") + (row.sectionName ? " " + row.sectionName : "")}</td>
          <td>${row.months.length > 0 ? row.months.join(", ") : "—"}</td>
          <td style="text-align:right;font-weight:600;">${fmt(row.totalPaid)}</td>
          <td>${formatDate(row.paymentDate) || "—"}</td>
          <td style="text-transform:capitalize;">${row.paymentMethod ?? "cash"}${utrSuffix}</td>
          <td>${row.collectedBy || "—"}</td>
          <td><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;">${row.status}</span></td>
        </tr>`;
    }).join("");

    // ── Per-user breakdown boxes (only when "All" is selected in Generated By filter) ──
    let userBreakdownHtml = "";
    if (filterCollectedBy === "all") {
      // Build a map: collectedBy → { cash, online, cheque, dd, total }
      type UserTotals = { cash: number; online: number; cheque: number; dd: number; total: number };
      const userMap = new Map<string, UserTotals>();
      for (const row of filtered) {
        const user = row.collectedBy || "Unknown";
        if (!userMap.has(user)) userMap.set(user, { cash: 0, online: 0, cheque: 0, dd: 0, total: 0 });
        const u = userMap.get(user)!;
        const m = (row.paymentMethod ?? "cash").toLowerCase();
        if (m === "cash")        u.cash   += row.totalPaid;
        else if (m === "online") u.online += row.totalPaid;
        else if (m === "cheque") u.cheque += row.totalPaid;
        else if (m === "dd")     u.dd     += row.totalPaid;
        u.total += row.totalPaid;
      }

      if (userMap.size > 0) {
        const userCards = Array.from(userMap.entries()).map(([user, t]) => {
          const rows = [
            { label: "Cash",   value: t.cash,   color: "#166534" },
            { label: "Online", value: t.online,  color: "#1d4ed8" },
            { label: "Cheque", value: t.cheque,  color: "#6b21a8" },
            { label: "DD",     value: t.dd,      color: "#c2410c" },
            { label: "Total",  value: t.total,   color: "#0f766e" },
          ].map(({ label, value, color }) => `
            <tr>
              <td style="padding:3px 8px;color:#475569;font-size:10px;">${label}</td>
              <td style="padding:3px 8px;text-align:right;font-weight:700;color:${color};font-size:10px;">${fmt(value)}</td>
            </tr>`).join("");
          return `
            <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;min-width:180px;flex:1;max-width:220px;">
              <div style="background:#1e293b;color:#fff;padding:6px 10px;font-size:11px;font-weight:700;text-align:center;letter-spacing:.03em;">${user}</div>
              <table style="width:100%;border-collapse:collapse;background:#fff;">
                ${rows}
              </table>
            </div>`;
        }).join("");

        userBreakdownHtml = `
          <div style="margin-top:22px;border-top:2px solid #e2e8f0;padding-top:16px;">
            <div style="font-size:11px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Collection by Staff</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px;">${userCards}</div>
          </div>`;
      }
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Collection Summary</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px;}
        .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #334155;padding-bottom:12px;}
        .school{font-size:18px;font-weight:800;color:#0f172a;}
        .subtitle{font-size:11px;color:#64748b;margin-top:3px;}
        .mode-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;justify-content:center;}
        table{width:100%;border-collapse:collapse;font-size:10.5px;}
        th{background:#1e293b;color:#fff;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;}
        td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}
        tfoot td{background:#f0fdf4;font-weight:800;font-size:11px;border-top:2px solid #166534;color:#166534;}
        .footer{margin-top:14px;font-size:9px;color:#94a3b8;text-align:center;}
        @media print{body{padding:10px;}@page{margin:10mm;size:A4 landscape;}}
      </style></head><body>
      <div class="header">
        <div class="school">${schoolName}</div>
        <div class="subtitle">Collection Summary &nbsp;·&nbsp; ${dateRange} &nbsp;·&nbsp; ${filtered.length} receipt${filtered.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="mode-row">${modeCards}</div>
      <table>
        <thead>
          <tr>
            <th>Receipt No.</th><th>Student Name</th><th>Class</th><th>Months Paid</th>
            <th style="text-align:right;">Paid Amount</th><th>Date</th><th>Method</th><th>Generated By</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4"><b>Total (${filtered.length} receipts)</b></td>
            <td style="text-align:right;">${fmt(totalCollected)}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>
      ${userBreakdownHtml}
      <div class="footer">Printed on ${new Date().toLocaleString("en-IN")} &nbsp;·&nbsp; ${schoolName}</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap">From:</label>
          <input
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-sm h-8 bg-white dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap">To:</label>
          <input
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-sm h-8 bg-white dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCollectedBy} onValueChange={setFilterCollectedBy}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Generated by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (Generated by)</SelectItem>
            <SelectItem value="Administrator">Administrator</SelectItem>
            <SelectItem value="Parent (UPI)">Parent (UPI)</SelectItem>
            {staffUsers.map(u => (
              <SelectItem key={u.id} value={`${u.name} (${u.role})`}>
                {u.name} <span className="text-slate-400 capitalize">({u.role})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Name, roll, receipt…" className="h-8 text-sm pl-8" />
        </div>
        <div className="relative min-w-[130px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 select-none">UTR</span>
          <Input
            value={utrSearch}
            onChange={e => setUtrSearch(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="last 4 digits"
            maxLength={4}
            className={`h-8 text-sm pl-9 font-mono ${utrSearch.length > 0 ? "border-blue-400 ring-1 ring-blue-200" : ""}`}
          />
          {utrSearch.length > 0 && (
            <button
              onClick={() => setUtrSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear UTR search"
            >✕</button>
          )}
        </div>
        <Button
          variant="outline" size="sm" className="h-8 text-xs"
          onClick={() => { setFromDate(""); setToDate(""); setUtrSearch(""); setSearchQ(""); setFilterCollectedBy("all"); }}
          title="Clear all filters"
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>

      {/* Stats bar */}
      {filtered.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2">
            <span className="text-sm text-slate-600">
              <strong>{filtered.length}</strong> receipt{filtered.length !== 1 ? "s" : ""}
              {(fromDate || toDate) ? ` · ${fromDate || "start"} → ${toDate || "today"}` : " · all dates"}
              {filterClass !== "all" && ` · ${classes.find(c => String(c.id) === filterClass)?.name ?? ""}`}
            </span>
            <Button
              onClick={handlePrintAll}
              size="sm"
              className="ml-auto h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print All {filtered.length} Receipts
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5">
            {[
              { label: "Cash", value: modeTotals.cash, color: "text-emerald-700 dark:text-emerald-400" },
              { label: "Online", value: modeTotals.online, color: "text-blue-700 dark:text-blue-400" },
              { label: "Cheque", value: modeTotals.cheque, color: "text-violet-700 dark:text-violet-400" },
              { label: "DD", value: modeTotals.dd, color: "text-orange-700 dark:text-orange-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">{label}:</span>
                <span className={`text-sm font-semibold whitespace-nowrap ${color}`}>{currencyFmt(value)}</span>
                <span className="text-slate-300 dark:text-slate-600 text-xs select-none">|</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Total:</span>
              <span className="text-sm font-bold text-green-700 dark:text-green-400 whitespace-nowrap">{currencyFmt(totalCollected)}</span>
            </div>
            <Button
              onClick={handlePrintSummary}
              size="sm"
              variant="outline"
              className="ml-auto h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Collection Summary
            </Button>
          </div>
        </>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-slate-400">Loading receipts…</div>
      ) : error ? (
        <div className="text-center py-10 text-red-400 text-sm">Failed to load. Please try again.</div>
      ) : receiptRows.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No receipts found for this session</p>
          <p className="text-sm mt-1">Collect fees first to see receipts here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No receipts match the selected date range or search.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="whitespace-nowrap pl-4">Receipt No.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Class</TableHead>
                  <TableHead>Months Paid</TableHead>
                  <TableHead className="hidden md:table-cell">Fee Breakdown</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="hidden sm:table-cell whitespace-nowrap">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell whitespace-nowrap">Generated by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <TableRow key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 align-top">
                    <TableCell className="pl-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {row.receiptNo}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{row.studentName}</div>
                      <div className="text-[11px] text-slate-400">Roll: {row.rollNo ?? "—"}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{row.className} {row.sectionName}</TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-600 max-w-[130px]">
                        {row.months.length > 0 ? row.months.join(", ") : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-xs space-y-0.5 max-w-[180px]">
                        {(() => {
                          // A row can be entirely carry-forward/stuck-due settlement payments
                          // (CFNOW/STLMT), which are tagged isPreviousDue=true — fall back to
                          // those so the breakdown column isn't left blank for such rows.
                          const regular = row.payments.filter((p: any) => !p.isPreviousDue);
                          const breakdownPays = regular.length > 0 ? regular : row.payments.filter((p: any) => p.isPreviousDue);
                          const isCarryForward = regular.length === 0;
                          return (
                            <>
                              {breakdownPays.slice(0, 6).map((p: any) => (
                                <div key={p.id} className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-500 truncate">
                                    {isCarryForward
                                      ? (String(p.receiptNo ?? "").includes("-STLMT") ? "Stuck Due Settlement" : "Carry-Forward Due")
                                      : (p.categoryName ?? "Fee")}:
                                  </span>
                                  <span className="font-medium text-slate-700">₹{Number(p.paidAmount ?? 0).toFixed(0)}</span>
                                  {p.status === "partial" && <span className="text-orange-500 text-[10px]">(partial)</span>}
                                </div>
                              ))}
                              {breakdownPays.length > 6 && (
                                <div className="text-slate-400 text-[10px]">+ {breakdownPays.length - 6} more…</div>
                              )}
                            </>
                          );
                        })()}
                        {row.payments.some((p: any) => p.remarks?.includes("UTR")) && (
                          <div className="text-[10px] text-blue-500 font-mono">
                            {row.payments.find((p: any) => p.remarks?.includes("UTR"))?.remarks}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                      {currencyFmt(row.totalPaid)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(row.paymentDate) || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs capitalize">{row.paymentMethod}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-slate-500">{row.collectedBy || "—"}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                          onClick={() => {
                            // Carry-forward = isPreviousDue + month > 0 (previous month shortfall, not prev year)
                            const carryPays = row.payments.filter((p: any) => p.isPreviousDue === true && p.month && p.month !== 0);
                            const carryAmt = Math.round(carryPays.reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0));
                            const carryFromMonth = carryPays.length > 0 ? (carryPays[0].month as number) : 0;
                            const carryFromLabel = carryFromMonth > 0 ? MONTHS[carryFromMonth - 1] : "";
                            // Sort months chronologically (Apr → Mar school year order) so carry-forward
                            // only appears in the earliest month, matching the auto-print receipt.
                            const sortedMonthLabels = [...row.months].sort((a: string, b: string) => {
                              const [ma, ya] = a.split(" ");
                              const [mb, yb] = b.split(" ");
                              const numA = (parseInt(ya || "0") * 12) + (MONTHS.indexOf(ma) + 1);
                              const numB = (parseInt(yb || "0") * 12) + (MONTHS.indexOf(mb) + 1);
                              return numA - numB;
                            });
                            const monthsList: any[] = sortedMonthLabels.map((ml: string, mapIdx: number) => {
                              const [mn, yr] = ml.split(" ");
                              const mPays = row.payments.filter((p: any) => MONTHS[(p.month - 1)] === mn && !p.isPreviousDue);
                              const mRegPaid = mPays.reduce((s: number, p: any) => s + parseFloat(p.paidAmount ?? "0"), 0);
                              const mDue = mPays.reduce((s: number, p: any) => s + parseFloat(p.amount ?? "0"), 0);
                              // Carry-forward belongs only to the first (earliest) month in the receipt
                              const isFirst = mapIdx === 0;
                              const monthCarry = isFirst ? carryAmt : 0;
                              return {
                                month: mn, mYear: parseInt(yr || "0"),
                                totalPaid: mRegPaid + monthCarry,
                                payments: mPays,
                                carryoverDue: isFirst && carryAmt > 0 ? carryAmt : undefined,
                                carryoverFromLabel: isFirst ? (carryFromLabel || undefined) : undefined,
                                monthlyDue: mDue + monthCarry,
                                balanceDue: Math.max(0, mDue - mRegPaid),
                              };
                            });
                            // Previous Year Due section (isPreviousDue=true, month=0) — add as separate receipt section
                            const pydPays = row.payments.filter((p: any) => p.isPreviousDue === true && (!p.month || p.month === 0));
                            if (pydPays.length > 0) {
                              const pydPaid = pydPays.reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
                              const pydAmt = pydPays.reduce((s: number, p: any) => s + (parseFloat(String(p.amount ?? "0")) || 0), 0);
                              monthsList.push({
                                month: "Prev Year Due", mYear: 0,
                                totalPaid: pydPaid,
                                payments: pydPays,
                                monthlyDue: pydAmt || pydPaid,
                                balanceDue: Math.max(0, (pydAmt || pydPaid) - pydPaid),
                              });
                            }
                            const monthsForReceipt = monthsList.length > 0 ? monthsList : [{ month: "—", mYear: 0, totalPaid: row.totalPaid, payments: row.payments }];
                            const _utrMatch = String(row.payments?.[0]?.remarks ?? "").match(/UTR:\*{0,4}(\w{1,4})/);
                            printCombinedReceipt(
                              monthsForReceipt,
                              { studentName: row.studentName, fatherName: row.fatherName ?? "", uniqueId: "", className: row.className ?? "", sectionName: row.sectionName ?? "" },
                              row.receiptNo,
                              row.paymentMethod,
                              row.paymentDate,
                              _utrMatch ? _utrMatch[1] : undefined,
                            ).catch(() => {});
                          }}
                          title="Print Receipt"
                        >
                          <Printer className="h-3 w-3 mr-1" /> Print
                        </Button>
                        {row.parentEmail && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title={`Email to ${row.parentEmail}`}
                            onClick={async () => {
                              // Detect special receipt rows: CFNOW (carry-forward clearance) and
                              // STLMT (settlement of stuck due). Both have isPreviousDue=true + month != 0.
                              const stlmtPay = row.payments.find((p: any) =>
                                String(p.receiptNo ?? "").includes("-STLMT")
                              );
                              const cfNowPay = !stlmtPay
                                ? (row.payments.find((p: any) =>
                                    String(p.receiptNo ?? "").includes("-CFNOW")
                                  ) ?? (
                                    row.payments.length > 0 &&
                                    row.payments.every((p: any) => p.isPreviousDue === true && p.month && p.month !== 0)
                                      ? row.payments[0]
                                      : null
                                  ))
                                : null;

                              const specialPay = stlmtPay ?? cfNowPay;
                              if (specialPay) {
                                const kindLabel: "Settlement of Stuck Due" | "Carry-Forward Clearance" =
                                  stlmtPay ? "Settlement of Stuck Due" : "Carry-Forward Clearance";
                                const cfAmt = row.totalPaid;
                                const cfReceiptNo = (specialPay as any).receiptNo || row.receiptNo;
                                const cfMonth = (specialPay as any).month as number;
                                const cfYear = (specialPay as any).year ?? "";
                                const monthLabel = cfMonth ? `${MONTHS[cfMonth - 1]} ${cfYear}` : "—";
                                const ok = await emailCarryNowReceipt(
                                  row.parentEmail!,
                                  { studentName: row.studentName, fatherName: row.fatherName ?? "", uniqueId: "", className: row.className ?? "", sectionName: row.sectionName ?? "" },
                                  cfReceiptNo,
                                  cfAmt,
                                  row.paymentDate,
                                  row.paymentMethod,
                                  monthLabel,
                                  kindLabel,
                                );
                                if (ok) toast({ title: `Receipt emailed to ${row.parentEmail}` });
                                else toast({ title: "Failed to send email — check Gmail settings in Settings → Security", variant: "destructive" });
                                return;
                              }

                              // Regular receipt: use ALL payments for this student in the covered months
                              const studentAllPmts = allPmts.filter((p: any) => p.studentId === row.studentId);

                              // Which month+year combinations does this receipt cover?
                              const receiptMonthKeys = new Set(
                                row.payments
                                  .filter((p: any) => !p.isPreviousDue && p.month && p.year)
                                  .map((p: any) => `${p.month}-${p.year}`)
                              );

                              // All regular payments for this student in those months (all categories)
                              const allMonthPmts = studentAllPmts.filter((p: any) =>
                                !p.isPreviousDue && p.month && p.year &&
                                receiptMonthKeys.has(`${p.month}-${p.year}`)
                              );

                              // Carryover cleared alongside this receipt (isPreviousDue + real month)
                              // Scope to THIS receipt's base number(s) to avoid mixing with other receipts —
                              // merged online rows carry multiple bases (one per checkout session).
                              const rcptBases = row.receiptNos.length > 0 ? row.receiptNos : [row.receiptNo];
                              const carryPays = studentAllPmts.filter((p: any) =>
                                p.isPreviousDue === true && p.month && p.month !== 0 &&
                                rcptBases.some((rb: string) => String(p.receiptNo ?? "").startsWith(rb))
                              );
                              const carryAmt = Math.round(carryPays.reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0));
                              const carryFromMonth = carryPays.length > 0 ? (carryPays[0].month as number) : 0;
                              const carryFromLabel = carryFromMonth > 0 ? MONTHS[carryFromMonth - 1] : "";

                              // Build sorted unique month list
                              const monthLabels = [...receiptMonthKeys]
                                .map(key => {
                                  const [m, y] = key.split("-");
                                  return { month: MONTHS[parseInt(m) - 1] ?? "", mYear: parseInt(y) };
                                })
                                .sort((a, b) => a.mYear - b.mYear || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

                              const monthsList: any[] = monthLabels.map(({ month: mn, mYear }) => {
                                const mPays = allMonthPmts.filter((p: any) =>
                                  MONTHS[(p.month - 1)] === mn && p.year === mYear
                                );
                                const mRegPaid = mPays.reduce((s: number, p: any) => s + parseFloat(p.paidAmount ?? "0"), 0);
                                const mDue = mPays.reduce((s: number, p: any) => s + parseFloat(p.amount ?? "0"), 0);
                                return {
                                  month: mn, mYear,
                                  totalPaid: mRegPaid + carryAmt,
                                  payments: mPays,
                                  carryoverDue: carryAmt > 0 ? carryAmt : undefined,
                                  carryoverFromLabel: carryFromLabel || undefined,
                                  monthlyDue: mDue + carryAmt,
                                  balanceDue: Math.max(0, mDue + carryAmt - (mRegPaid + carryAmt)),
                                };
                              });

                              // Previous Year Due entries — scoped to THIS receipt's base number
                              const pydPays = row.payments.filter((p: any) => p.isPreviousDue === true && (!p.month || p.month === 0));
                              if (pydPays.length > 0) {
                                const pydPaid = pydPays.reduce((s: number, p: any) => s + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0);
                                const pydAmt = pydPays.reduce((s: number, p: any) => s + (parseFloat(String(p.amount ?? "0")) || 0), 0);
                                monthsList.push({
                                  month: "Prev Year Due", mYear: 0,
                                  totalPaid: pydPaid,
                                  payments: pydPays,
                                  monthlyDue: pydAmt || pydPaid,
                                  balanceDue: Math.max(0, (pydAmt || pydPaid) - pydPaid),
                                });
                              }

                              const monthsForReceipt = monthsList.length > 0
                                ? monthsList
                                : [{ month: "—", mYear: 0, totalPaid: row.totalPaid, payments: row.payments }];

                              const ok = await emailReceiptToParent(
                                row.parentEmail!,
                                monthsForReceipt,
                                { studentName: row.studentName, fatherName: row.fatherName ?? "", uniqueId: "", className: row.className ?? "", sectionName: row.sectionName ?? "" },
                                row.receiptNo,
                                row.paymentMethod,
                                row.paymentDate,
                              );
                              if (ok) toast({ title: `Receipt emailed to ${row.parentEmail}` });
                              else toast({ title: "Failed to send email — check Gmail settings in Settings → Security", variant: "destructive" });
                            }}
                          >
                            <Mail className="h-3 w-3 mr-1" /> Email
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex justify-between items-center">
            <span className="text-xs text-slate-500">{filtered.length} receipt{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-sm font-bold text-teal-700 dark:text-teal-400">Total: {currencyFmt(totalCollected)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee Ledger / Account Statement Tab
// ─────────────────────────────────────────────────────────────────────────────

function FeeLedgerTab({ session }: { session: string }) {
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: students = [], isLoading: studentsLoading } = useListStudents({
    classId: filterClass !== "all" ? parseInt(filterClass) : undefined,
    sectionId: filterSection !== "all" ? parseInt(filterSection) : undefined,
  });

  const filteredSections = (() => {
    if (filterClass === "all") return sections;
    const byClass = sections.filter(s => s.classId === parseInt(filterClass));
    if (byClass.length > 0) return byClass;
    return sections; // sections are global (no classId) — show all
  })();

  const filteredStudents = useMemo(() => {
    if (!searchQ.trim()) return students;
    const q = searchQ.toLowerCase();
    return students.filter((s: any) =>
      String(s.studentName ?? "").toLowerCase().includes(q) ||
      String(s.fatherName ?? "").toLowerCase().includes(q) ||
      String(s.rollNo ?? "").includes(q) ||
      String(s.uniqueId ?? "").toLowerCase().includes(q)
    );
  }, [students, searchQ]);

  return (
    <div className="space-y-4">
      {selectedStudent ? (
        <StudentLedgerView
          student={selectedStudent}
          session={session}
          onBack={() => setSelectedStudent(null)}
        />
      ) : (
        <>
          <div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">Fee Account Statement</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select a student to view their complete payment ledger.</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSection("all"); setSelectedStudent(null); }}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="w-24 h-8 text-sm"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {filteredSections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Name, roll no, admission no…" className="h-8 text-sm pl-8" />
            </div>
          </div>

          {studentsLoading ? (
            <div className="text-center py-10 text-slate-400">Loading students…</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-slate-400">No students found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStudents.map((s: any) => {
                const cls = classes.find((c: any) => c.id === s.classId);
                const sec = sections.find((sec: any) => sec.id === s.sectionId);
                return (
                  <button
                    key={s.id}
                    className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:border-teal-400 hover:shadow-sm transition-all group"
                    onClick={() => setSelectedStudent(s)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-sm font-bold text-teal-600 shrink-0">
                        {String(s.studentName ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-teal-700">{s.studentName}</div>
                        <div className="text-[11px] text-slate-500 truncate">{cls?.name ?? "—"} {sec?.name ?? ""} · Roll {s.rollNo ?? "—"}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StudentLedgerView({ student, session, onBack }: { student: any; session: string; onBack: () => void }) {
  const { data: allPayments = [], isLoading } = useListFeePayments(
    { studentId: student.id, session } as any,
    { query: { queryKey: getListFeePaymentsQueryKey({ studentId: student.id, session } as any), staleTime: 20_000 } }
  );

  // Sort payments chronologically
  const ledgerRows = useMemo(() => {
    const pmts = [...allPayments].sort((a, b) => {
      const da = a.paymentDate ?? "1970-01-01";
      const db = b.paymentDate ?? "1970-01-01";
      if (da !== db) return da.localeCompare(db);
      return (a.id ?? 0) - (b.id ?? 0);
    });

    let runningPaid = 0;
    return pmts.map(p => {
      runningPaid += Number(p.paidAmount ?? 0);
      const monthLabel = p.month ? `${MONTHS[(p.month - 1)]} ${p.year ?? ""}` : "—";
      return { ...p, monthLabel, runningPaid };
    });
  }, [allPayments]);

  const totalPaid = useMemo(() => allPayments.reduce((s, p) => s + Number(p.paidAmount ?? 0), 0), [allPayments]);
  const totalAmount = useMemo(() => allPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0), [allPayments]);

  function handlePrintLedger() {
    const lines = ledgerRows.map(r =>
      `${formatDate(r.paymentDate) ?? "—"}  |  ${r.monthLabel.padEnd(12)}  |  ${(r.categoryName ?? "Fee").padEnd(15)}  |  ₹${Number(r.amount ?? 0).toFixed(0).padStart(7)}  |  ₹${Number(r.paidAmount ?? 0).toFixed(0).padStart(7)}  |  ${r.paymentMethod ?? "—"}`
    ).join("\n");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Fee Ledger — ${student.studentName}</title>
      <style>body{font-family:monospace;padding:24px;font-size:13px}h2{margin-bottom:4px}p{margin:2px 0;color:#555}pre{margin-top:16px;border-top:1px solid #ccc;padding-top:12px;line-height:1.7}footer{margin-top:24px;font-size:11px;color:#999}</style>
      </head><body>
      <h2>Fee Ledger — ${student.studentName}</h2>
      <p>Father: ${student.fatherName ?? "—"} &nbsp;|&nbsp; Session: ${session}</p>
      <p>Total Charged: ₹${totalAmount.toFixed(0)} &nbsp;|&nbsp; Total Paid: ₹${totalPaid.toFixed(0)} &nbsp;|&nbsp; Balance: ₹${Math.max(0, totalAmount - totalPaid).toFixed(0)}</p>
      <pre>Date        |  Month         |  Category       |   Amount  |  Paid Amt  |  Method\n${"─".repeat(80)}\n${lines}</pre>
      <footer>Printed on ${new Date().toLocaleString()}</footer>
      </body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </button>

      {/* Student info + summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{student.studentName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Father: {student.fatherName ?? "—"} · Session: {session} · Adm: {student.uniqueId ?? "—"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={handlePrintLedger}>
            <Printer className="h-3 w-3 mr-1" /> Print
          </Button>
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex-1 text-center">
            <div className="text-[10px] text-slate-400 uppercase">Total Charged</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{currencyFmt(totalAmount)}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-green-500 uppercase">Total Paid</div>
            <div className="text-sm font-bold text-green-700 dark:text-green-400">{currencyFmt(totalPaid)}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-[10px] text-red-500 uppercase">Balance Due</div>
            <div className="text-sm font-bold text-red-700 dark:text-red-400">{currencyFmt(Math.max(0, totalAmount - totalPaid))}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-slate-400">Loading ledger…</div>
      ) : ledgerRows.length === 0 ? (
        <div className="text-center py-10 text-slate-400">No payment records found for this student in {session}.</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-4">Running Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.map((row, idx) => (
                  <TableRow key={row.id ?? idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${row.isPreviousDue ? "bg-orange-50/40 dark:bg-orange-900/10" : ""}`}>
                    <TableCell className="pl-4 text-xs text-slate-500 whitespace-nowrap">{formatDate(row.paymentDate) ?? "—"}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {row.monthLabel}
                      {row.isPreviousDue && <span className="ml-1 text-[10px] text-orange-500">(prev due)</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{row.categoryName ?? "Fee"}</TableCell>
                    <TableCell className="text-right text-sm text-slate-600">{currencyFmt(Number(row.amount ?? 0))}</TableCell>
                    <TableCell className="text-right font-medium text-green-700 dark:text-green-400">{currencyFmt(Number(row.paidAmount ?? 0))}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs capitalize text-slate-500">{row.paymentMethod ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-[11px] text-slate-400">{row.receiptNo ?? "—"}</TableCell>
                    <TableCell>{statusBadge(row.status ?? "pending")}</TableCell>
                    <TableCell className="text-right pr-4 font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                      {currencyFmt(row.runningPaid)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex justify-between items-center">
            <span className="text-xs text-slate-500">{ledgerRows.length} transaction{ledgerRows.length !== 1 ? "s" : ""}</span>
            <span className="text-sm font-bold text-teal-700 dark:text-teal-400">Total paid: {currencyFmt(totalPaid)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee WhatsApp Bulk Notify Tab
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_WA = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SCHOOL_MONTHS_ORDER_WA = [4,5,6,7,8,9,10,11,12,1,2,3];

function FeeWhatsAppNotifyTab({ session }: { session: string }) {
  const now = new Date();
  // Multi-month selection instead of single month
  const [sessionYear, setSessionYear] = useState(() => sessionYearStart(session));

  // Sync to actual academic session whenever it changes
  useEffect(() => { setSessionYear(sessionYearStart(session)); }, [session]);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(new Set([now.getMonth() + 1]));
  const [selectedPrevDue, setSelectedPrevDue] = useState(false);
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [customMsg, setCustomMsg] = useState(
    "Dear parent of {name} (Class {class}),\n\nFee reminder for: {months}\nAmount Due: {due}\nAmount Paid: {paid}\nStatus: {status}\n\nPlease clear dues at the earliest.\n\nThank you."
  );
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [sendAllProgress, setSendAllProgress] = useState(0);
  const [sendAllRunning, setSendAllRunning] = useState(false);

  const { data: classes = [] } = useListClasses();
  const { data: allSections = [] } = useListSections({});
  const { data: allStudents = [] } = useListStudents({});
  const { data: allPayments = [] } = useListFeePayments(
    { session } as any,
    { query: { queryKey: ["listFeePayments", { session }], staleTime: 0 } }
  );
  const { data: structures = [] } = useListFeeStructures({ session });
  const { data: categories = [] } = useListFeeCategories();

  // Show sections matching selected class OR global sections (no classId)
  const filteredSections = useMemo(() =>
    filterClassId === "all"
      ? allSections
      : (allSections as any[]).filter((s: any) => !s.classId || Number(s.classId) === parseInt(filterClassId)),
    [allSections, filterClassId]
  );

  function toggleMonth(m: number) {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
    setCurrentIndex(-1); setSentIds(new Set()); setSkippedIds(new Set());
  }

  function selectAllMonths() {
    setSelectedMonths(new Set(SCHOOL_MONTHS_ORDER_WA));
    setCurrentIndex(-1); setSentIds(new Set()); setSkippedIds(new Set());
  }
  function clearAllMonths() {
    setSelectedMonths(new Set());
    setSelectedPrevDue(false);
    setCurrentIndex(-1); setSentIds(new Set()); setSkippedIds(new Set());
  }

  type WaTarget = {
    id: number;
    studentName: string;
    className: string;
    whatsappNumber: string;
    status: string;
    due: number;
    paid: number;
    monthLabels: string[];
  };

  const targets: WaTarget[] = useMemo(() => {
    const noneSelected = selectedMonths.size === 0 && !selectedPrevDue;
    return (allStudents as any[])
      .filter((s: any) => {
        if (filterClassId !== "all" && s.classId !== parseInt(filterClassId)) return false;
        if (filterSectionId !== "all" && s.sectionId !== parseInt(filterSectionId)) return false;
        return true;
      })
      .map((s: any) => {
        const cls = (classes as any[]).find((c: any) => c.id === s.classId);
        const isRTE = (s.studentType ?? "").toLowerCase() === "rte";

        // Compute monthly fee from structures for this student's class
        const monthlyFee = (structures as any[])
          .filter((st: any) => {
            if (st.classId !== s.classId) return false;
            const cat = (categories as any[]).find((c: any) => c.id === st.categoryId);
            const cn = (cat?.name ?? "").toLowerCase();
            if (cn.includes("admission")) return false;
            if (isRTE && (cn.includes("tuition") || cn.includes("tution"))) return false;
            return true;
          })
          .reduce((sum: number, st: any) => sum + (parseFloat(String(st.amount)) || 0), 0);

        let totalDue = 0;
        let totalPaid = 0;
        const monthLabels: string[] = [];

        // Check each selected month
        for (const m of SCHOOL_MONTHS_ORDER_WA) {
          if (!selectedMonths.has(m)) continue;
          const mYear = m >= 4 ? sessionYear : sessionYear + 1;
          monthLabels.push(MONTHS_WA[m - 1] + " " + mYear);

          const normalPays = (allPayments as any[]).filter((p: any) =>
            p.studentId === s.id && p.month === m && p.year === mYear && !p.isPreviousDue
          );
          const carryPays = (allPayments as any[]).filter((p: any) =>
            p.studentId === s.id && p.month === m && p.year === mYear && p.isPreviousDue
          );
          // Due from payment records; fall back to fee structure amount when not yet collected
          const mDue = normalPays.length > 0
            ? normalPays.reduce((sum: number, p: any) => sum + (parseFloat(String(p.amount ?? "0")) || 0), 0)
            : monthlyFee;
          const mPaid = [...normalPays, ...carryPays].reduce(
            (sum: number, p: any) => sum + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0
          );
          totalDue += mDue;
          totalPaid += mPaid;
        }

        // Include previous year due if selected
        if (selectedPrevDue) {
          const prevDueAmt = parseFloat(String(s.previousYearDue || "0")) || 0;
          if (prevDueAmt > 0) {
            const prevPays = (allPayments as any[]).filter((p: any) =>
              p.studentId === s.id && p.isPreviousDue === true && p.month === 0
            );
            const prevPaid = prevPays.reduce(
              (sum: number, p: any) => sum + (parseFloat(String(p.paidAmount ?? "0")) || 0), 0
            );
            totalDue += prevDueAmt;
            totalPaid += Math.min(prevPaid, prevDueAmt);
            monthLabels.unshift("Prev Year Due");
          }
        }

        const remaining = Math.max(0, totalDue - totalPaid);
        const status = noneSelected ? "not-selected"
          : totalDue === 0 ? "not-generated"
          : totalPaid === 0 ? "pending"
          : remaining <= 0 ? "paid"
          : "partial";

        return {
          id: s.id,
          studentName: s.studentName ?? "",
          className: cls?.name ?? "—",
          whatsappNumber: String(s.whatsappNumber ?? "").trim(),
          status,
          due: totalDue,
          paid: totalPaid,
          monthLabels,
        };
      })
      .filter((t: WaTarget) => {
        if (t.status === "not-selected") return false;
        if (filterStatus === "all") return t.status !== "not-generated";
        return t.status === filterStatus;
      });
  }, [allStudents, allPayments, classes, structures, categories, filterClassId, filterSectionId, selectedMonths, selectedPrevDue, sessionYear, filterStatus]);

  const currentTarget = currentIndex >= 0 && currentIndex < targets.length ? targets[currentIndex] : null;
  const isComplete = currentIndex >= targets.length && targets.length > 0;

  function buildMsg(t: WaTarget) {
    const monthsLabel = t.monthLabels.join(", ") || "—";
    return customMsg
      .replace(/{name}/g, t.studentName)
      .replace(/{class}/g, t.className)
      .replace(/{months}/g, monthsLabel)
      .replace(/{month}/g, monthsLabel)
      .replace(/{year}/g, String(sessionYear))
      .replace(/{status}/g, t.status === "paid" ? "Paid ✓" : t.status === "partial" ? "Partially Paid" : "Pending ✗")
      .replace(/{due}/g, currencyFmt(t.due))
      .replace(/{paid}/g, currencyFmt(t.paid));
  }

  function openWhatsApp(t: WaTarget) {
    const ph = t.whatsappNumber.replace(/\D/g, "");
    if (!ph) return;
    window.open(`https://wa.me/${ph}?text=${encodeURIComponent(buildMsg(t))}`, "_blank");
  }

  function handleStartSending() { setCurrentIndex(0); setSentIds(new Set()); setSkippedIds(new Set()); }
  function handleSendNext() {
    if (!currentTarget) return;
    openWhatsApp(currentTarget);
    setSentIds(prev => new Set(prev).add(currentTarget.id));
    setCurrentIndex(i => i + 1);
  }
  function handleSkip() {
    if (!currentTarget) return;
    setSkippedIds(prev => new Set(prev).add(currentTarget.id));
    setCurrentIndex(i => i + 1);
  }
  function resetSession() { setCurrentIndex(-1); setSentIds(new Set()); setSkippedIds(new Set()); setSendAllProgress(0); }

  async function handleSendAll() {
    const withPhone = targets.filter(t => t.whatsappNumber);
    if (withPhone.length === 0) return;

    setSendAllRunning(true); setSendAllProgress(0);
    for (let i = 0; i < withPhone.length; i++) {
      openWhatsApp(withPhone[i]);
      setSendAllProgress(i + 1);
      await new Promise(r => setTimeout(r, 600));
    }
    setSendAllRunning(false);
  }

  const selectedMonthLabels = SCHOOL_MONTHS_ORDER_WA
    .filter(m => selectedMonths.has(m))
    .map(m => MONTHS_WA[m - 1]);
  const selectionLabel = selectedPrevDue
    ? ["Prev Due", ...selectedMonthLabels].join(", ")
    : selectedMonthLabels.join(", ") || "None selected";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">WhatsApp Bulk Notify</h3>
          <p className="text-xs text-slate-500 mt-0.5">Select months → filter students who haven't paid → send reminders</p>
        </div>
      </div>

      {/* Month selector — checkboxes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Months</label>
            <Select value={String(sessionYear)} onValueChange={v => setSessionYear(parseInt(v))}>
              <SelectTrigger className="w-20 h-6 text-xs border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[sessionYearStart(session)-1, sessionYearStart(session), sessionYearStart(session)+1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAllMonths} className="text-[10px] text-teal-600 hover:underline font-medium">All</button>
            <span className="text-slate-300">|</span>
            <button onClick={clearAllMonths} className="text-[10px] text-red-400 hover:underline font-medium">Clear</button>
          </div>
        </div>

        {/* Prev Year Due checkbox */}
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none text-xs font-medium transition-colors
          bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400">
          <input
            type="checkbox"
            checked={selectedPrevDue}
            onChange={e => { setSelectedPrevDue(e.target.checked); setCurrentIndex(-1); setSentIds(new Set()); setSkippedIds(new Set()); }}
            className="accent-orange-500"
          />
          Prev Year Due
        </label>

        {/* 12 month checkboxes in school order */}
        <div className="flex flex-wrap gap-2">
          {SCHOOL_MONTHS_ORDER_WA.map(m => {
            const checked = selectedMonths.has(m);
            return (
              <label
                key={m}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer select-none text-xs font-medium transition-colors ${
                  checked
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMonth(m)}
                  className="sr-only"
                />
                {MONTHS_WA[m - 1]}
              </label>
            );
          })}
        </div>

        {/* Summary of selection */}
        <p className="text-[11px] text-slate-400">
          Selected: <span className="text-slate-600 font-medium">{selectionLabel}</span>
        </p>
      </div>

      {/* Class / Section / Status filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <Select value={filterClassId} onValueChange={v => { setFilterClassId(v); setFilterSectionId("all"); setCurrentIndex(-1); }}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {(classes as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSectionId} onValueChange={v => { setFilterSectionId(v); setCurrentIndex(-1); }} disabled={filterClassId === "all" && (filteredSections as any[]).length === 0}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Sections" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {(filteredSections as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentIndex(-1); }}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (Generated)</SelectItem>
            <SelectItem value="pending">Pending (not paid)</SelectItem>
            <SelectItem value="partial">Partial (partly paid)</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-slate-400 self-center font-medium">{targets.length} students</span>
      </div>

      {/* Message template */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Message Template</label>
          <span className="text-[10px] text-slate-400">Placeholders: {"{name}"} {"{class}"} {"{months}"} {"{status}"} {"{due}"} {"{paid}"}</span>
        </div>
        <textarea
          value={customMsg}
          onChange={e => setCustomMsg(e.target.value)}
          rows={5}
          className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* Send panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Send Notifications</h4>

        <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
          <div className="text-center"><div className="text-[10px] text-slate-400 uppercase">Target</div><div className="text-lg font-bold text-slate-700">{targets.length}</div></div>
          <div className="text-center"><div className="text-[10px] text-slate-400 uppercase">Sent</div><div className="text-lg font-bold text-green-600">{sentIds.size}</div></div>
          <div className="text-center"><div className="text-[10px] text-slate-400 uppercase">Skipped</div><div className="text-lg font-bold text-slate-400">{skippedIds.size}</div></div>
        </div>

        {currentTarget && !isComplete && (
          <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-xs text-green-600 font-medium mb-1">Sending to ({currentIndex + 1}/{targets.length})</p>
            <p className="font-semibold text-slate-900 dark:text-white">{currentTarget.studentName} — {currentTarget.className}</p>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{currentTarget.whatsappNumber || <span className="text-red-400">No number</span>}</p>
          </div>
        )}

        {isComplete && (
          <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 rounded-lg text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-700">Done! {sentIds.size} sent, {skippedIds.size} skipped.</p>
          </div>
        )}

        {currentIndex === -1 ? (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 p-4">
              <p className="text-xs text-green-700 mb-3">
                <strong>One-click:</strong> Opens WhatsApp for each student automatically (one every 0.6s). Allow popups when prompted.
              </p>
              {sendAllRunning && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-green-700 mb-1"><span>Opening chats…</span><span>{sendAllProgress}/{targets.filter(t => t.whatsappNumber).length}</span></div>
                  <div className="h-2 bg-green-200 rounded-full"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(sendAllProgress / Math.max(targets.filter(t => t.whatsappNumber).length, 1)) * 100}%` }} /></div>
                </div>
              )}
              {sendAllProgress > 0 && !sendAllRunning && (
                <p className="text-xs text-green-700 font-semibold mb-2">✓ {sendAllProgress} chats opened!</p>
              )}
              <Button onClick={handleSendAll} disabled={targets.length === 0 || sendAllRunning} className="w-full h-11 font-bold bg-green-600 hover:bg-green-700 text-white">
                <Send className="h-4 w-4 mr-2" />
                {sendAllRunning ? `Opening ${sendAllProgress}/${targets.filter(t => t.whatsappNumber).length}…` : `Send All ${targets.filter(t => t.whatsappNumber).length} at Once`}
              </Button>
            </div>

            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /><span className="text-xs text-slate-400">or one by one</span><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /></div>

            <Button onClick={handleStartSending} disabled={targets.length === 0} className="w-full h-11 font-bold bg-slate-800 hover:bg-slate-900 text-white">
              <MessageCircle className="h-4 w-4 mr-2" />Step-by-step ({targets.length} students)
            </Button>
          </div>
        ) : isComplete ? (
          <Button variant="outline" onClick={resetSession} className="w-full h-11"><RefreshCw className="h-4 w-4 mr-2" />Restart Session</Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleSendNext} disabled={!currentTarget?.whatsappNumber} className="h-12 font-bold bg-green-600 hover:bg-green-700 text-white">
              <Send className="h-4 w-4 mr-2" />Send ({currentIndex + 1}/{targets.length})
            </Button>
            <Button variant="outline" onClick={handleSkip} className="h-12 font-semibold border-slate-300 text-slate-600 hover:bg-slate-50">
              <AlertCircle className="h-4 w-4 mr-2" />Skip
            </Button>
          </div>
        )}
      </div>

      {/* Student list */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Students — {selectionLabel}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-8">St</TableHead>
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Class</TableHead>
                <TableHead className="text-xs">WhatsApp</TableHead>
                <TableHead className="text-xs text-right">Paid / Due</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-400 text-sm">
                    {selectedMonths.size === 0 && !selectedPrevDue
                      ? "Select at least one month above to see students."
                      : "No students match the current filter."}
                  </TableCell>
                </TableRow>
              ) : targets.map((t, idx) => (
                <TableRow key={t.id} className={idx === currentIndex ? "bg-green-50 dark:bg-green-900/10" : sentIds.has(t.id) ? "bg-slate-50/50" : ""}>
                  <TableCell className="pl-3">
                    {sentIds.has(t.id) ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : skippedIds.has(t.id) ? <AlertCircle className="h-4 w-4 text-slate-300" /> : <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded-full" />}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{t.studentName}</TableCell>
                  <TableCell className="text-xs text-slate-500">{t.className}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{t.whatsappNumber || <span className="text-slate-300 italic">none</span>}</TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="text-green-700 font-medium">{currencyFmt(t.paid)}</span>
                    {t.due > 0 && <span className="text-slate-400"> / {currencyFmt(t.due)}</span>}
                  </TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Fees Tab
// ─────────────────────────────────────────────────────────────────────────────

export default function FeesTab() {
  const thisYear = new Date().getFullYear();
  const [session, setSession] = useState(`${thisYear}-${(thisYear + 1).toString().slice(2)}`);

  // Sync session to the actual current academic session as soon as we get it from the API.
  // This fixes the bug where the session defaults to the calendar year (e.g. "2026-27")
  // even when a different academic session (e.g. "2027-28") is active.
  useEffect(() => {
    fetch("/api/academic-sessions/status")
      .then(r => r.json())
      .then((data: { currentSession?: { name: string } | null }) => {
        if (data?.currentSession?.name) {
          setSession(data.currentSession.name);
        }
      })
      .catch(() => { /* keep default */ });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-teal-600" />
            Fee Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage fee categories, structures, monthly collection, reminders, and receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Session:</label>
          <input
            className="border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-28"
            value={session}
            onChange={e => setSession(e.target.value)}
            placeholder="2025-26"
            data-testid="input-global-session"
          />
        </div>
      </div>

      <Tabs defaultValue="collection" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl h-auto gap-1 flex-wrap">
          <TabsTrigger value="collection" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-teal-600 data-[state=active]:shadow-sm">
            <DollarSign className="h-3.5 w-3.5 mr-1" /> Collection
          </TabsTrigger>
          <TabsTrigger value="summary" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-teal-600 data-[state=active]:shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Summary
          </TabsTrigger>
          <TabsTrigger value="receipts" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            <Receipt className="h-3.5 w-3.5 mr-1" /> Receipts
          </TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 data-[state=active]:shadow-sm">
            <FileText className="h-3.5 w-3.5 mr-1" /> Ledger
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-teal-600 data-[state=active]:shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Reports
          </TabsTrigger>
          <TabsTrigger value="whatsapp-notify" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-green-600 data-[state=active]:shadow-sm">
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collection" className="mt-4 focus-visible:outline-none">
          <FeeCollectionTab session={session} />
        </TabsContent>
        <TabsContent value="summary" className="mt-4 focus-visible:outline-none">
          <FeeTabErrorBoundary>
            <FeeSummaryTab session={session} />
          </FeeTabErrorBoundary>
        </TabsContent>
        <TabsContent value="receipts" className="mt-4 focus-visible:outline-none">
          <FeeReceiptsTab session={session} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4 focus-visible:outline-none">
          <FeeLedgerTab session={session} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4 focus-visible:outline-none">
          <Tabs defaultValue="fee-reports" className="w-full">
            <TabsList className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl h-auto gap-1 mb-4">
              <TabsTrigger value="fee-reports" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-teal-600 data-[state=active]:shadow-sm">
                <FileText className="h-3.5 w-3.5 mr-1" /> Fee Reports
              </TabsTrigger>
              <TabsTrigger value="transport-manager" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                <Bus className="h-3.5 w-3.5 mr-1" /> Transport Manager
              </TabsTrigger>
            </TabsList>
            <TabsContent value="fee-reports" className="focus-visible:outline-none">
              <FeeTabErrorBoundary>
                <FeeReportsTab session={session} />
              </FeeTabErrorBoundary>
            </TabsContent>
            <TabsContent value="transport-manager" className="focus-visible:outline-none">
              <TransportManagerTab session={session} />
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="whatsapp-notify" className="mt-4 focus-visible:outline-none">
          <FeeWhatsAppNotifyTab session={session} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
