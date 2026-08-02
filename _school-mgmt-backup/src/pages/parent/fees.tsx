import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, Download, CheckCircle, AlertCircle, Clock, FileDown } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateReceiptPdf } from "@/lib/receipt";

interface FeePayment {
  id: number; categoryId: number; categoryName: string; amount: string; paidAmount: string;
  discount: string; fine: string; status: string; month: number; year: number;
  paymentDate?: string; createdAt?: string; paymentMethod: string; receiptNo: string; remarks: string; session: string;
  studentName?: string; className?: string; sectionName?: string;
}
interface Student { studentId: number; studentName: string; }

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ParentFees() {
  const [, navigate] = useLocation();
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    loadParent();
  }, []);

  useEffect(() => {
    if (selectedStudent) loadFees();
  }, [selectedStudent]);

  async function loadParent() {
    try {
      const p = await parentApi.get<{ id: number; students: Student[] }>("/auth/parent/me");
      setStudents(p.students || []);
      if (p.students?.length > 0) {
        setSelectedStudent(p.students[0].studentId);
        setSelectedStudentName(p.students[0].studentName);
      }
    } catch { navigate("/parent/login"); }
    finally { setLoading(false); }
  }

  async function loadFees() {
    if (!selectedStudent) return;
    try {
      const data = await parentApi.get<FeePayment[]>(`/fees/payments?studentId=${selectedStudent}`);
      setPayments(data);
    } catch { setPayments([]); }
  }

  function downloadReceipt(groupPayments: FeePayment[], receiptNo: string) {
    const studentName = selectedStudentName || groupPayments[0]?.studentName || "Student";
    generateReceiptPdf({
      studentName,
      className: groupPayments[0]?.className || "",
      sectionName: groupPayments[0]?.sectionName || "",
      receiptNo,
      paymentDate: groupPayments[0]?.paymentDate,
      paymentMethod: groupPayments[0]?.paymentMethod,
      payments: groupPayments,
    });
  }

  function downloadStatementPDF() {
    const doc = new jsPDF();
    const studentName = selectedStudentName || "Student";
    const today = format(new Date(), "dd MMM yyyy");

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Fee Payment Statement", 105, 13, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${today}`, 105, 22, { align: "center" });

    // Student info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Student: ${studentName}`, 14, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Records: ${payments.length}`, 14, 50);

    // Summary row
    const totalDue = payments.reduce((s, p) => s + (parseFloat(p.amount) - parseFloat(p.discount || "0")), 0);
    const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.paidAmount), 0);
    const totalPending = totalDue - totalPaid;

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, 54, 55, 18, 2, 2, "F");
    doc.roundedRect(74, 54, 55, 18, 2, 2, "F");
    doc.setFillColor(totalPending > 0 ? 254 : 240, totalPending > 0 ? 242 : 253, totalPending > 0 ? 242 : 244);
    doc.roundedRect(134, 54, 62, 18, 2, 2, "F");

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Total Fee", 41, 61, { align: "center" });
    doc.text("Total Paid", 101, 61, { align: "center" });
    doc.text("Pending", 165, 61, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text(`Rs. ${totalDue.toFixed(0)}`, 41, 68, { align: "center" });
    doc.setTextColor(21, 128, 61);
    doc.text(`Rs. ${totalPaid.toFixed(0)}`, 101, 68, { align: "center" });
    doc.setTextColor(totalPending > 0 ? 185 : 21, totalPending > 0 ? 28 : 128, totalPending > 0 ? 28 : 61);
    doc.text(`Rs. ${totalPending.toFixed(0)}`, 165, 68, { align: "center" });

    // Table
    autoTable(doc, {
      startY: 80,
      head: [["Period", "Amount (Rs.)", "Paid (Rs.)", "Discount", "Status", "Payment Date", "Receipt No."]],
      body: payments.map(p => [
        `${MONTHS[p.month]} ${p.year}`,
        parseFloat(p.amount).toFixed(0),
        parseFloat(p.paidAmount).toFixed(0),
        parseFloat(p.discount || "0").toFixed(0),
        p.status.toUpperCase(),
        p.paymentDate ? format(new Date(p.paymentDate), "dd MMM yyyy") : "—",
        p.receiptNo || "—",
      ]),
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28 },
        4: { fontStyle: "bold" },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const status = String(data.cell.raw).toLowerCase();
          if (status === "paid") data.cell.styles.textColor = [21, 128, 61];
          else if (status === "pending") data.cell.styles.textColor = [180, 83, 9];
          else data.cell.styles.textColor = [185, 28, 28];
        }
      },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount} — School Management System`, 105, 290, { align: "center" });
    }

    doc.save(`Fee-Statement-${studentName.replace(/\s+/g, "-")}-${today.replace(/\s/g, "-")}.pdf`);
  }

  // Group payments by receiptNo (one row per receipt)
  const receiptGroups = (() => {
    const groups = new Map<string, FeePayment[]>();
    for (const p of payments) {
      const key = p.receiptNo && p.receiptNo.trim() ? p.receiptNo.trim() : `_solo_${p.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    // Sort by most recent paymentDate desc
    return Array.from(groups.entries()).sort(([, a], [, b]) => {
      const da = a[0]?.paymentDate || a[0]?.createdAt || "";
      const db = b[0]?.paymentDate || b[0]?.createdAt || "";
      return db.localeCompare(da);
    });
  })();

  const totalDue = payments.reduce((s, p) => s + (parseFloat(p.amount) - parseFloat(p.discount || "0")), 0);
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.paidAmount), 0);
  const totalPending = totalDue - totalPaid;

  const groupStatus = (group: FeePayment[]): string => {
    if (group.every(p => p.status === "paid")) return "paid";
    if (group.some(p => parseFloat(p.paidAmount) > 0)) return "partial";
    return "pending";
  };

  const statusIcon = (status: string) => {
    if (status === "paid") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "pending") return <Clock className="w-4 h-4 text-amber-500" />;
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  if (loading) return <ParentLayout title="Fee Status"><div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div></ParentLayout>;

  return (
    <ParentLayout title="Fee Status">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Fee Status</h2>
          <p className="text-sm text-slate-500">{payments.length} fee entries</p>
        </div>
        <div className="flex items-center gap-2">
          {students.length > 1 && (
            <Select value={String(selectedStudent)} onValueChange={v => {
              setSelectedStudent(parseInt(v));
              setSelectedStudentName(students.find(s => s.studentId === parseInt(v))?.studentName || "");
            }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{students.map(s => <SelectItem key={s.studentId} value={String(s.studentId)}>{s.studentName}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {payments.length > 0 && (
            <Button variant="outline" className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={downloadStatementPDF}>
              <FileDown className="w-4 h-4" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Fee summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-blue-700">₹{totalDue.toFixed(0)}</p>
            <p className="text-xs text-blue-600">Total Fee</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-green-700">₹{totalPaid.toFixed(0)}</p>
            <p className="text-xs text-green-600">Paid</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${totalPending > 0 ? "bg-red-50" : "bg-green-50"}`}>
          <CardContent className="p-4 text-center">
            <p className={`text-xl font-bold ${totalPending > 0 ? "text-red-700" : "text-green-700"}`}>₹{totalPending.toFixed(0)}</p>
            <p className={`text-xs ${totalPending > 0 ? "text-red-600" : "text-green-600"}`}>Pending</p>
          </CardContent>
        </Card>
      </div>

      {receiptGroups.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No fee records found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Receipt No.</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Period / Items</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Paid</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptGroups.map(([key, group]) => {
                    const isSolo = key.startsWith("_solo_");
                    const receiptNo = isSolo ? "—" : key;
                    const status = groupStatus(group);
                    const amount = group.reduce((s, p) => s + parseFloat(p.amount) - parseFloat(p.discount || "0"), 0);
                    const paid = group.reduce((s, p) => s + parseFloat(p.paidAmount), 0);
                    const payDate = group[0]?.paymentDate;
                    const periods = [...new Set(group.map(p => `${MONTHS[p.month]} ${p.year}`))].join(", ");
                    return (
                      <tr key={key} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {isSolo
                            ? <span className="text-slate-400 text-xs">No Receipt</span>
                            : <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{receiptNo}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-700 text-xs">{periods}</p>
                          <p className="text-xs text-slate-400">{group.length} item{group.length !== 1 ? "s" : ""}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">₹{amount.toFixed(0)}</td>
                        <td className="px-4 py-3 text-green-700">₹{paid.toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {statusIcon(status)}
                            <Badge className={status === "paid" ? "bg-green-100 text-green-700 hover:bg-green-100" : status === "partial" ? "bg-orange-100 text-orange-700 hover:bg-orange-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                              {status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{payDate ? format(new Date(payDate), "MMM d, yyyy") : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {status !== "pending" && !isSolo && (
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => downloadReceipt(group, receiptNo)}>
                              <Download className="w-3.5 h-3.5 mr-1" /> PDF
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </ParentLayout>
  );
}
