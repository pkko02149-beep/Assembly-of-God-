// Shared PDF receipt generator used by the parent portal and the public
// fee-payment quick-access flow. Both surfaces only ever produce an
// informal, self-service copy — the school office issues the sealed
// original — so the wording here must make that distinction explicit.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ReceiptLineItem {
  categoryId: number;
  categoryName?: string;
  amount: string | number;
  discount?: string | number;
  paidAmount: string | number;
  month: number;
  year: number;
}

export interface ReceiptOptions {
  studentName: string;
  className?: string;
  sectionName?: string;
  receiptNo: string;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  payments: ReceiptLineItem[];
  /** File name without extension. */
  fileName?: string;
}

export function generateReceiptPdf(opts: ReceiptOptions) {
  const { studentName, className, sectionName, receiptNo, payments } = opts;
  const doc = new jsPDF();
  const payDate = opts.paymentDate ? format(new Date(opts.paymentDate), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy");
  const payMethod = opts.paymentMethod || "";
  const today = format(new Date(), "dd MMM yyyy");

  const num = (v: string | number | undefined) => parseFloat(String(v ?? "0")) || 0;
  const totalAmount = payments.reduce((s, p) => s + num(p.amount) - num(p.discount), 0);
  const totalPaid = payments.reduce((s, p) => s + num(p.paidAmount), 0);

  // Header band
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FEE RECEIPT", 105, 13, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("School Management System", 105, 21, { align: "center" });
  doc.text(`Generated: ${today}`, 105, 28, { align: "center" });

  // Receipt no box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(135, 36, 62, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Receipt No.", 166, 42, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text(receiptNo, 166, 50, { align: "center" });

  // Student info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Student Details", 14, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Name: ${studentName}`, 14, 51);
  if (className) doc.text(`Class: ${className}${sectionName ? " — Sec " + sectionName : ""}`, 14, 57);
  doc.text(`Payment Date: ${payDate}${payMethod ? " · Method: " + payMethod : ""}`, 14, 63);

  // Items table
  autoTable(doc, {
    startY: 72,
    head: [["Fee Category", "Period", "Amount (₹)", "Discount (₹)", "Paid (₹)"]],
    body: payments.map(p => [
      p.categoryName || `Category #${p.categoryId}`,
      p.month > 0 ? `${MONTHS[p.month]} ${p.year}` : "Previous Session",
      num(p.amount).toFixed(0),
      num(p.discount).toFixed(0),
      num(p.paidAmount).toFixed(0),
    ]),
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    foot: [["", "TOTAL", totalAmount.toFixed(0), "", totalPaid.toFixed(0)]],
    footStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 9 },
  });

  // Paid stamp
  const finalY = (doc as any).lastAutoTable?.finalY ?? 140;
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(14, finalY + 8, 60, 16, 2, 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(21, 128, 61);
  doc.text(`₹${totalPaid.toFixed(0)} RECEIVED`, 44, finalY + 19, { align: "center" });

  // Official-copy notice
  const noticeY = finalY + 34;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(252, 211, 77);
  doc.roundedRect(14, noticeY, 182, 20, 2, 2, "FD");
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("This is a self-service copy for your reference only, not a valid financial document.", 105, noticeY + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Please collect the original receipt bearing the school seal from the school office.", 105, noticeY + 15, { align: "center" });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This is a computer generated document.", 105, 285, { align: "center" });

  const fileName = opts.fileName || `Receipt-${receiptNo}-${studentName.replace(/\s+/g, "-")}`;
  doc.save(`${fileName}.pdf`);
}
