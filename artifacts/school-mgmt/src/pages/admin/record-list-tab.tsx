import { useState, useMemo } from "react";
import {
  useListStudents, useDeleteStudent, useUpdateStudent,
  useListVehicles, useListTrips, useListClasses, useListSections,
  useListFeePayments,
  getListStudentsQueryKey,
} from "@workspace/api-client-react";

const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};
const MONTH_FULL: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December",
};
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash2, Pencil, ChevronLeft, ChevronRight, UserCircle2, Camera, ChevronDown, Mail, Download, Bus, Printer } from "lucide-react";
import { isAdmin, canEdit, canDelete } from "@/lib/auth";
import { QRCodeCanvas } from "qrcode.react";

// ── schema (mirrors records-tab) ──────────────────────────────────────────────
const editSchema = z.object({
  studentName: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  hasVehicle: z.boolean().default(false),
  vehicleId: z.string().optional(),
  hasTrip: z.boolean().default(false),
  tripId: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  whatsappNumber: z.string().optional(),
  parentEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  photoUrl: z.string().optional(),
  admissionDate: z.string().optional(),
  studentType: z.string().optional(),
  session: z.string().optional(),
  dateOfBirth: z.string().optional(),
  motherName: z.string().optional(),
  aadharNumber: z.string().max(12).optional().or(z.literal("")),
  panNumber: z.string().optional(),
  gender: z.string().optional(),
  previousSchool: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  emergencyContact: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ── photo helper ──────────────────────────────────────────────────────────────
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import { useRef, useCallback } from "react";
function PhotoUpload({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onChange(await compressImage(file)); } catch {}
  }, [onChange]);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-24 h-28 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <img src={value} alt="Student" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-amber-400">
            <UserCircle2 className="h-10 w-10" />
            <span className="text-[10px] text-amber-500 font-medium">Upload</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {value && (
        <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500 h-6 px-2" onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}>
          Remove
        </Button>
      )}
    </div>
  );
}

const PAGE_SIZE = 25;

// ── A4 Print helpers ──────────────────────────────────────────────────────────
const PRINT_STYLES = `<style>
  @page{size:A4 portrait;margin:10mm 12mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#1e293b;background:white;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  .sh{border:2.5px solid #1e293b;border-radius:6px;overflow:hidden;margin-bottom:10px;}
  .sh-top{background:#1e293b;color:white;padding:10px 14px;display:flex;align-items:center;
    justify-content:space-between;gap:12px;}
  .sh-logo{width:62px;height:62px;flex-shrink:0;}
  .sh-logo img{width:62px;height:62px;object-fit:contain;border-radius:4px;
    background:white;padding:2px;display:block;}
  .sh-init{width:62px;height:62px;border-radius:50%;background:#f59e0b;
    display:flex;align-items:center;justify-content:center;
    font-size:24pt;font-weight:900;color:#0f172a;flex-shrink:0;}
  .sh-info{flex:1;min-width:0;}
  .sh-name{font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:.5px;line-height:1.2;}
  .sh-addr{font-size:8.5pt;color:#cbd5e1;margin-top:2px;overflow:hidden;
    white-space:nowrap;text-overflow:ellipsis;}
  .sh-contacts{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:3px;
    font-size:8pt;color:#cbd5e1;}
  .sh-qr{background:white;padding:5px;border-radius:4px;flex-shrink:0;}
  .sh-qr img{width:76px;height:76px;display:block;}
  .sh-qr-ph{width:76px;height:76px;border:2px dashed #94a3b8;border-radius:4px;
    display:flex;align-items:center;justify-content:center;
    font-size:8pt;color:#94a3b8;text-align:center;line-height:1.3;}
  .sh-banner{background:#f59e0b;color:#0f172a;text-align:center;
    font-size:9pt;font-weight:900;padding:4px 0;letter-spacing:3px;text-transform:uppercase;}
  .crow{display:flex;gap:12px;margin-bottom:8px;}
  .pc{flex-shrink:0;text-align:center;}
  .pc img{width:92px;height:108px;object-fit:cover;border-radius:4px;
    border:2px solid #e2e8f0;display:block;}
  .pc-ph{width:92px;height:108px;border:2px dashed #e2e8f0;border-radius:4px;
    background:#f8fafc;display:flex;align-items:center;justify-content:center;
    font-size:8pt;color:#94a3b8;text-align:center;line-height:1.4;}
  .pc-lbl{font-size:7.5pt;color:#94a3b8;margin-top:3px;}
  .fg{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0 18px;}
  .fr{display:flex;align-items:baseline;border-bottom:1px solid #f1f5f9;
    padding:4px 0;gap:6px;}
  .fr.s2{grid-column:1/-1;}
  .fl{font-size:8.5pt;color:#64748b;flex-shrink:0;width:100px;}
  .fv{font-size:10pt;font-weight:600;color:#1e293b;flex:1;}
  .fv.hi{color:#b45309;font-weight:700;}
  .sc{border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;margin-bottom:7px;}
  .sc-t{background:#f1f5f9;padding:4px 10px;font-size:8pt;font-weight:700;
    text-transform:uppercase;letter-spacing:1px;color:#475569;
    border-bottom:1px solid #e2e8f0;}
  .sc-b{padding:5px 10px;display:grid;grid-template-columns:1fr 1fr;gap:0 18px;}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:14px;}
  .sl{border-bottom:1px solid #64748b;height:32px;margin-bottom:3px;}
  .slbl{text-align:center;font-size:8pt;color:#94a3b8;}
  .ftxt{text-align:center;font-size:8pt;color:#94a3b8;
    margin-top:8px;border-top:1px solid #e2e8f0;padding-top:5px;}
  .bul{border-bottom:1px solid #94a3b8;flex:1;min-height:16px;display:inline-block;}
  .pb{page-break-after:always;}
</style>`;

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fd(v: any): string { return (v!==null&&v!==undefined&&v!=="") ? String(v) : "—"; }
function fr(label: string, value: any, span2=false, hi=false): string {
  return `<div class="fr${span2?" s2":""}"><span class="fl">${label}:</span>` +
    `<span class="fv${hi?" hi":""}">${esc(fd(value))}</span></div>`;
}
function shHtml(school: any, qrSrc?: string): string {
  const logo = school.logoUrl
    ? `<div class="sh-logo"><img src="${esc(school.logoUrl)}" alt="logo" onerror="this.style.display='none'"/></div>`
    : `<div class="sh-init">${esc((school.schoolName||"S").charAt(0).toUpperCase())}</div>`;
  const qr = qrSrc
    ? `<div class="sh-qr"><img src="${esc(qrSrc)}" alt="QR"/></div>`
    : `<div class="sh-qr"><div class="sh-qr-ph">QR<br/>CODE</div></div>`;
  return `<div class="sh"><div class="sh-top">
    ${logo}
    <div class="sh-info">
      <div class="sh-name">${esc(school.schoolName||"School Name")}</div>
      ${school.address?`<div class="sh-addr">${esc(school.address)}</div>`:""}
      <div class="sh-contacts">
        ${school.contactNumber?`<span>&#128222; ${esc(school.contactNumber)}</span>`:""}
        ${school.schoolGmail?`<span>&#9993; ${esc(school.schoolGmail)}</span>`:""}
        ${school.registrationNo?`<span>Reg: ${esc(school.registrationNo)}</span>`:""}
        ${school.udiseCode?`<span>UDISE: ${esc(school.udiseCode)}</span>`:""}
      </div>
    </div>
    ${qr}
  </div><div class="sh-banner">Student Admission Form</div></div>`;
}
function studentBodyHtml(student: any, school: any, qrSrc: string, currentSession: string): string {
  const photo = student.photoUrl
    ? `<img src="${esc(student.photoUrl)}" alt="photo" onerror="this.style.display='none'"/>`
    : `<div class="pc-ph">No<br/>Photo</div>`;
  return `${shHtml(school, qrSrc)}
<div class="crow">
  <div class="pc">${photo}<div class="pc-lbl">Student Photo</div></div>
  <div class="fg">
    ${fr("Enrollment No.",student.uniqueId||"",false,true)}
    ${fr("Roll No.",student.rollNo)}
    ${fr("Session",student.session)}
    ${fr("Admission Date",student.admissionDate)}
    ${fr("Student Type",student.studentType)}
    ${fr("Class",student.className)}
    ${fr("Section",student.sectionName)}
    ${fr("Gender",student.gender)}
  </div>
</div>
<div class="sc"><div class="sc-t">Personal Information</div><div class="sc-b">
  ${fr("Student Name",student.studentName)}
  ${fr("Date of Birth",student.dateOfBirth)}
  ${fr("Father's Name",student.fatherName)}
  ${fr("Mother's Name",student.motherName)}
  ${fr("Aadhar Number",student.aadharNumber)}
  ${fr("PAN Number",student.panNumber)}
  ${fr("Category",student.category)}
  ${fr("Religion",student.religion)}
  ${fr("Blood Group",student.bloodGroup)}
  ${fr("Nationality",student.nationality)}
  ${fr("Previous School",student.previousSchool,true)}
</div></div>
<div class="sc"><div class="sc-t">Contact &amp; Address</div><div class="sc-b">
  ${fr("Contact No.",student.whatsappNumber)}
  ${fr("Parent Email",student.parentEmail)}
  ${student.emergencyContact?fr("Emergency Contact",student.emergencyContact,true):""}
  ${fr("Address",student.address,true)}
</div></div>
${student.hasVehicle?`<div class="sc"><div class="sc-t">Transport</div><div class="sc-b">
  ${fr("Vehicle",student.vehicleName)}${fr("Trip",student.tripName)}
</div></div>`:""}
<div class="sigs">
  <div><div class="sl"></div><div class="slbl">Parent/Guardian Signature</div></div>
  <div><div class="sl"></div><div class="slbl">Class Teacher Signature</div></div>
  <div><div class="sl"></div><div class="slbl">Principal Signature</div></div>
</div>
${school.receiptFooter?`<div class="ftxt">${esc(school.receiptFooter)}</div>`:""}`;
}
function openPrintWindow(htmlDoc: string) {
  const win = window.open("","_blank","width=860,height=680");
  if (!win) { alert("Please allow pop-ups for this site to enable printing."); return; }
  win.document.write(htmlDoc);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch(_){} setTimeout(()=>win.close(),1200); }, 700);
}

// ── School Header preview component (dialog only, not for print) ──────────────
function SchoolHeader({ school, qrContent }: { school: any; qrContent?: string }) {
  return (
    <div className="border-2 border-slate-800 rounded-lg overflow-hidden mb-3">
      <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded bg-white p-0.5 shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 text-xl font-black shrink-0">
              {(school.schoolName || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-black uppercase tracking-wide leading-tight truncate">
              {school.schoolName || "School Name"}
            </h1>
            {school.address && <p className="text-[10px] text-slate-300 mt-0.5 truncate">{school.address}</p>}
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
              {school.contactNumber && <span className="text-[10px] text-slate-300 whitespace-nowrap">📞 {school.contactNumber}</span>}
              {school.schoolGmail && <span className="text-[10px] text-slate-300 truncate max-w-[160px]">✉ {school.schoolGmail}</span>}
              {school.registrationNo && <span className="text-[10px] text-slate-300 whitespace-nowrap">Reg: {school.registrationNo}</span>}
              {school.udiseCode && <span className="text-[10px] text-slate-300 whitespace-nowrap">UDISE: {school.udiseCode}</span>}
            </div>
          </div>
        </div>
        <div className="shrink-0 bg-white p-1 rounded-lg">
          {qrContent ? (
            <QRCodeCanvas value={qrContent} size={64} level="M" />
          ) : (
            <div className="w-16 h-16 border-2 border-dashed border-slate-300 flex items-center justify-center rounded">
              <span className="text-[8px] text-slate-400 text-center leading-tight font-medium">QR<br/>CODE</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-amber-500 text-slate-950 text-center text-[10px] font-bold py-0.5 tracking-widest uppercase">
        Student Admission Form
      </div>
    </div>
  );
}

// ── Blank Form Dialog ─────────────────────────────────────────────────────────
function BlankFormPrintDialog({ onClose }: { onClose: () => void }) {
  const { data: schoolInfo } = useQuery<any>({
    queryKey: ["school-info-print"],
    queryFn: async () => {
      const res = await fetch("/api/settings/school-info");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
  const school = schoolInfo ?? {};

  function handlePrint() {
    function bfr(label: string, span2=false): string {
      return `<div class="fr${span2?" s2":""}"><span class="fl">${label}:</span><span class="bul">&nbsp;</span></div>`;
    }
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>Blank Admission Form</title>${PRINT_STYLES}</head><body>
      ${shHtml(school)}
      <div class="crow">
        <div class="pc"><div class="pc-ph">Paste<br/>Photo<br/>Here</div><div class="pc-lbl">Student Photo</div></div>
        <div class="fg">
          ${bfr("Enrollment No.")}${bfr("Roll No.")}
          ${bfr("Session")}${bfr("Admission Date")}
          ${bfr("Student Type")}${bfr("Class &amp; Section")}
          ${bfr("Gender")}${bfr("Date of Birth")}
        </div>
      </div>
      <div class="sc"><div class="sc-t">Personal Information</div><div class="sc-b">
        ${bfr("Student Name",true)}${bfr("Father's Name",true)}
        ${bfr("Mother's Name",true)}
        ${bfr("Aadhar Number")}${bfr("PAN Number")}
        ${bfr("Category")}${bfr("Religion")}
        ${bfr("Blood Group")}${bfr("Nationality")}
        ${bfr("Previous School",true)}
        ${bfr("Contact No.")}${bfr("Parent Email")}
        ${bfr("Emergency Contact",true)}
        ${bfr("Address",true)}
      </div></div>
      <div class="sigs">
        <div><div class="sl"></div><div class="slbl">Parent/Guardian Signature</div></div>
        <div><div class="sl"></div><div class="slbl">Class Teacher Signature</div></div>
        <div><div class="sl"></div><div class="slbl">Principal Signature</div></div>
      </div>
      ${school.receiptFooter?`<div class="ftxt">${esc(school.receiptFooter)}</div>`:""}
      </body></html>`;
    openPrintWindow(html);
  }

  const fields: { label: string; cols?: number }[] = [
    { label: "Enrollment No." }, { label: "Roll No." },
    { label: "Session" }, { label: "Admission Date" },
    { label: "Student Type" }, { label: "Class & Section" },
    { label: "Gender" }, { label: "Date of Birth" },
    { label: "Student Name", cols: 2 },
    { label: "Father's Name", cols: 2 },
    { label: "Mother's Name", cols: 2 },
    { label: "Aadhar Number" }, { label: "PAN Number" },
    { label: "Category" }, { label: "Religion" },
    { label: "Blood Group" }, { label: "Nationality" },
    { label: "Previous School", cols: 2 },
    { label: "Contact No." }, { label: "Parent Email" },
    { label: "Emergency Contact", cols: 2 },
    { label: "Address", cols: 2 },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blank Admission Form (Manual Entry)</DialogTitle>
        </DialogHeader>

        <div className="bg-white text-slate-900 p-2 border border-slate-100 rounded-lg">
          <SchoolHeader school={school} />
          <div className="flex gap-4 mb-3">
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-20 h-24 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center bg-slate-50">
                <span className="text-[10px] text-slate-400 text-center leading-tight">Paste<br/>Photo</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {fields.slice(0, 8).map(f => (
                <div key={f.label} className={`flex gap-1 items-end border-b border-slate-200 pb-0.5 ${f.cols===2?"col-span-2":""}`}>
                  <span className="text-[10px] text-slate-400 shrink-0">{f.label}:</span>
                  <span className="flex-1 min-h-[12px]" />
                </div>
              ))}
            </div>
          </div>
          <div className="border border-slate-100 rounded-lg overflow-hidden mb-2">
            <div className="bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">Personal Information</div>
            <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {fields.slice(8).map(f => (
                <div key={f.label} className={`flex gap-1 items-end border-b border-slate-200 pb-0.5 ${f.cols===2?"col-span-2":""}`}>
                  <span className="text-[10px] text-slate-400 shrink-0 w-24">{f.label}:</span>
                  <span className="flex-1 min-h-[12px]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-white">
            <Printer className="h-4 w-4 mr-2" />Print Blank Form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Print Dialog ─────────────────────────────────────────────────────────
function BulkPrintDialog({ students, onClose, session }: { students: any[]; onClose: () => void; session: string }) {
  const { data: schoolInfo } = useQuery<any>({
    queryKey: ["school-info-print"],
    queryFn: async () => {
      const res = await fetch("/api/settings/school-info");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
  const school = schoolInfo ?? {};

  function handleBulkPrint() {
    const origin = window.location.origin;
    const pages = students.map((student, i) => {
      const profileUrl = `${origin}/student/${encodeURIComponent(student.uniqueId || String(student.id))}`;
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=68x68&data=${encodeURIComponent(profileUrl)}`;
      const isLast = i === students.length - 1;
      return `<div${isLast?"":" class=\"pb\""}>${studentBodyHtml(student, school, qrSrc, session)}</div>`;
    });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>Bulk Print - ${students.length} Students</title>${PRINT_STYLES}</head>
      <body>${pages.join("")}</body></html>`;
    openPrintWindow(html);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Print — {students.length} Student{students.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-1">Each student form prints on a separate A4 page.</p>
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-56 overflow-y-auto text-xs space-y-1">
          {students.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 py-0.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-400 w-6 text-right shrink-0">{i + 1}.</span>
              <span className="font-medium text-slate-800">{s.studentName}</span>
              {s.fatherName && <span className="text-slate-500">— {s.fatherName}</span>}
              <span className="ml-auto text-slate-400">{s.className} {s.sectionName}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleBulkPrint} className="bg-slate-800 hover:bg-slate-700 text-white">
            <Printer className="h-4 w-4 mr-2" />Print All {students.length} Forms
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Print Form Dialog ─────────────────────────────────────────────────────────
function StudentPrintDialog({ student, onClose, session }: { student: any; onClose: () => void; session: string }) {
  const { data: schoolInfo } = useQuery<any>({
    queryKey: ["school-info-print"],
    queryFn: async () => {
      const res = await fetch("/api/settings/school-info");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const school = schoolInfo ?? {};
  const profileUrl = `${window.location.origin}/student/${encodeURIComponent(student.uniqueId || String(student.id))}`;
  const qrForPreview = profileUrl;

  function handlePrint() {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=68x68&data=${encodeURIComponent(profileUrl)}`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>${esc(school.schoolName||"School")} - ${esc(student.studentName)}</title>
      ${PRINT_STYLES}</head><body>${studentBodyHtml(student, school, qrSrc, session)}</body></html>`;
    openPrintWindow(html);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Admission Form — {student.studentName}</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="bg-white text-slate-900 p-2 border border-slate-100 rounded-lg">
          <SchoolHeader school={school} qrContent={qrForPreview} />

          <div className="flex gap-4 mb-3">
            <div className="shrink-0">
              {student.photoUrl ? (
                <img src={student.photoUrl} alt={student.studentName} className="w-20 h-24 object-cover rounded-lg border-2 border-slate-300" />
              ) : (
                <div className="w-20 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                  <UserCircle2 className="h-12 w-12 text-slate-300" />
                </div>
              )}
              <p className="text-center text-[9px] text-slate-400 mt-1">Photo</p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <PrintField label="Enrollment No." value={student.uniqueId||""} highlight />
              <PrintField label="Roll No." value={student.rollNo} />
              <PrintField label="Session" value={(student as any).session} />
              <PrintField label="Admission Date" value={(student as any).admissionDate} />
              <PrintField label="Student Type" value={(student as any).studentType} />
              <PrintField label="Class" value={student.className} />
              <PrintField label="Section" value={student.sectionName} />
              <PrintField label="Gender" value={(student as any).gender} />
            </div>
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden mb-2">
            <div className="bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">Personal Information</div>
            <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <PrintField label="Student Name" value={student.studentName} />
              <PrintField label="Date of Birth" value={(student as any).dateOfBirth} />
              <PrintField label="Father's Name" value={student.fatherName} />
              <PrintField label="Mother's Name" value={(student as any).motherName} />
              <PrintField label="Aadhar Number" value={(student as any).aadharNumber} />
              <PrintField label="PAN Number" value={(student as any).panNumber} />
              <PrintField label="Category" value={(student as any).category} />
              <PrintField label="Religion" value={(student as any).religion} />
              <div className="col-span-2"><PrintField label="Previous School" value={(student as any).previousSchool} /></div>
            </div>
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden mb-2">
            <div className="bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">Contact & Address</div>
            <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <PrintField label="Contact No." value={student.whatsappNumber} />
              <PrintField label="Parent Email" value={student.parentEmail} />
              <div className="col-span-2"><PrintField label="Address" value={(student as any).address} /></div>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 mt-1">
            🔗 QR links to: <span className="text-blue-500 break-all">{profileUrl}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-white">
            <Printer className="h-4 w-4 mr-2" />Print Form
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintField({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
  return (
    <div className="flex gap-1 items-baseline py-0.5 border-b border-slate-100">
      <span className="text-[11px] text-slate-500 shrink-0 w-32">{label}:</span>
      <span className={`text-[12px] font-medium flex-1 ${highlight ? "text-amber-700 font-bold" : "text-slate-800"}`}>
        {value || <span className="text-slate-300 text-[11px] italic">—</span>}
      </span>
    </div>
  );
}


export default function RecordListTab({ session }: { session: string }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<any | null>(null);
  const [reassignVehicleId, setReassignVehicleId] = useState("");
  const [reassignTripId, setReassignTripId] = useState("");
  const [reassignRouteId, setReassignRouteId] = useState("");
  const [reassignMonth, setReassignMonth] = useState<number | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [printTarget, setPrintTarget] = useState<any | null>(null);
  const [showBlankForm, setShowBlankForm] = useState(false);
  const [showBulkPrint, setShowBulkPrint] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allStudents = [], isLoading } = useListStudents({});
  const { data: vehicles = [] } = useListVehicles();
  const { data: trips = [] } = useListTrips();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: allPayments = [] } = useListFeePayments({ session });
  const { data: transportRoutes = [] } = useQuery<{ id: number; name: string; pricePerMonth: number }[]>({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await fetch("/api/transport-routes");
      if (!res.ok) throw new Error("Failed to fetch transport routes");
      return res.json();
    },
  });

  const studentPaidMonths = useMemo<Map<number, Set<number>>>(() => {
    const map = new Map<number, Set<number>>();
    for (const p of allPayments) {
      const catName = (p.categoryName ?? "").toLowerCase();
      if (
        (catName.includes("transport") || catName.includes("bus")) &&
        (p.status === "paid" || p.status === "partial") &&
        p.studentId != null &&
        (p as any).month != null
      ) {
        if (!map.has(p.studentId)) map.set(p.studentId, new Set());
        map.get(p.studentId)!.add((p as any).month as number);
      }
    }
    return map;
  }, [allPayments]);

  const filtered = useMemo(() => {
    let list = allStudents;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.studentName.toLowerCase().includes(q) ||
        (s.fatherName || "").toLowerCase().includes(q) ||
        ((s as any).motherName || "").toLowerCase().includes(q) ||
        (s.uniqueId || "").toLowerCase().includes(q)
      );
    }
    if (classFilter !== "all") list = list.filter(s => s.classId === parseInt(classFilter));
    if (sectionFilter !== "all") list = list.filter(s => s.sectionId === parseInt(sectionFilter));
    return list;
  }, [allStudents, search, classFilter, sectionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStudents = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const updateStudent = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student updated" });
        setEditTarget(null);
        setIsSaving(false);
      },
      onError: () => {
        toast({ title: "Failed to update", variant: "destructive" });
        setIsSaving(false);
      }
    }
  });

  const deleteStudent = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student deleted" });
      }
    }
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      studentName: "", fatherName: "", hasVehicle: false, vehicleId: "", hasTrip: false, tripId: "",
      classId: "", sectionId: "", whatsappNumber: "", parentEmail: "", address: "",
      photoUrl: "", admissionDate: "", studentType: "", session: "",
      dateOfBirth: "", motherName: "", aadharNumber: "", panNumber: "", gender: "", previousSchool: "",
      bloodGroup: "", nationality: "", emergencyContact: "",
    },
  });
  const editHasVehicle = editForm.watch("hasVehicle");

  function openEdit(student: any) {
    setEditTarget(student);
    editForm.reset({
      studentName: student.studentName || "",
      fatherName: student.fatherName || "",
      hasVehicle: student.hasVehicle || student.hasTrip || false,
      vehicleId: student.vehicleId?.toString() || "",
      hasTrip: student.hasVehicle || student.hasTrip || false,
      tripId: student.tripId?.toString() || "",
      classId: student.classId?.toString() || "",
      sectionId: student.sectionId?.toString() || "",
      whatsappNumber: student.whatsappNumber || "",
      parentEmail: student.parentEmail || "",
      address: student.address || "",
      photoUrl: student.photoUrl || "",
      admissionDate: student.admissionDate || "",
      studentType: student.studentType || "",
      session: student.session || "",
      dateOfBirth: student.dateOfBirth || "",
      motherName: student.motherName || "",
      aadharNumber: student.aadharNumber || "",
      panNumber: student.panNumber || "",
      gender: student.gender || "",
      previousSchool: student.previousSchool || "",
      bloodGroup: student.bloodGroup || "",
      nationality: student.nationality || "",
      emergencyContact: student.emergencyContact || "",
    });
    setShowMoreDetails(!!(student.dateOfBirth || student.motherName || student.aadharNumber || student.panNumber || student.gender || student.previousSchool || student.bloodGroup || student.nationality || student.emergencyContact));
  }

  function onSaveEdit(values: EditFormValues) {
    if (!editTarget) return;
    setIsSaving(true);
    updateStudent.mutate({
      id: editTarget.id,
      data: {
        studentName: values.studentName,
        fatherName: values.fatherName?.trim() || "",
        hasVehicle: values.hasVehicle,
        vehicleId: values.hasVehicle && values.vehicleId ? parseInt(values.vehicleId) : null,
        hasTrip: values.hasVehicle,
        tripId: values.hasVehicle && values.tripId ? parseInt(values.tripId) : null,
        // Preserve transport route fields from the original student record.
        // The edit form has no inputs for these — they are changed only via
        // the dedicated "Re-assign transport" dialog. Without passing them
        // here the API receives undefined → writes null → wiping the route.
        transportRouteId: values.hasVehicle ? (editTarget.transportRouteId ?? null) : null,
        transportFromMonth: values.hasVehicle ? (editTarget.transportFromMonth ?? 4) : 4,
        transportMonths: values.hasVehicle ? (editTarget.transportMonths ?? 12) : 12,
        transportStopMonth: values.hasVehicle ? (editTarget.transportStopMonth ?? null) : null,
        classId: parseInt(values.classId),
        sectionId: parseInt(values.sectionId),
        whatsappNumber: values.whatsappNumber?.trim() || "",
        parentEmail: values.parentEmail?.trim() || "",
        address: values.address?.trim() || "",
        photoUrl: values.photoUrl || "",
        admissionDate: values.admissionDate || "",
        studentType: values.studentType || "",
        session: values.session || "",
        dateOfBirth: values.dateOfBirth || "",
        motherName: values.motherName?.trim() || "",
        aadharNumber: values.aadharNumber?.trim() || "",
        panNumber: values.panNumber?.trim() || "",
        gender: values.gender || "",
        previousSchool: values.previousSchool?.trim() || "",
        bloodGroup: values.bloodGroup?.trim() || "",
        nationality: values.nationality?.trim() || "",
        emergencyContact: values.emergencyContact?.trim() || "",
        // The edit form has no inputs for previousYearDue — preserve the existing values
        // from editTarget so the PATCH never silently zeroes them out.
        previousYearDue: editTarget.previousYearDue ?? 0,
        previousYearDueRemarks: editTarget.previousYearDueRemarks ?? "",
        feeFromApril: editTarget.feeFromApril ?? false,
        category: editTarget.category ?? "",
        religion: editTarget.religion ?? "",
      } as any,
    });
  }

  function openReassign(student: any) {
    setReassignTarget(student);
    setReassignVehicleId(student.vehicleId ? String(student.vehicleId) : "");
    setReassignTripId(student.tripId ? String(student.tripId) : "");
    setReassignRouteId(student.transportRouteId ? String(student.transportRouteId) : "");
    setReassignMonth(null);
  }

  async function handleReassign() {
    if (!reassignTarget || !reassignVehicleId || !reassignRouteId || !reassignMonth) return;
    setIsReassigning(true);
    try {
      const selectedRoute = transportRoutes.find(r => r.id === parseInt(reassignRouteId));
      const res = await fetch(`/api/students/${reassignTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasVehicle: true,
          vehicleId: parseInt(reassignVehicleId),
          hasTrip: !!reassignTripId,
          tripId: reassignTripId ? parseInt(reassignTripId) : null,
          transportRouteId: parseInt(reassignRouteId),
          transportRoutePricePerMonth: selectedRoute?.pricePerMonth ?? null,
          transportFromMonth: reassignMonth,
          transportStopMonth: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to re-assign");
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: `${reassignTarget.studentName} re-assigned to transport from ${MONTH_FULL[reassignMonth]}` });
      setReassignTarget(null);
    } catch (err: any) {
      toast({ title: "Re-assign failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsReassigning(false);
    }
  }

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["Sr.No", "Enrollment No", "Roll No", "Student Name", "Father Name", "Mother Name", "DOB", "Gender", "Class", "Section", "Admission Date", "Session", "Student Type", "Aadhar No", "PAN No", "Previous School", "Contact", "Address"];
    const rows = filtered.map((s, i) => [
      i + 1,
      s.uniqueId || "",
      s.rollNo || "",
      s.studentName,
      s.fatherName || "",
      (s as any).motherName || "",
      (s as any).dateOfBirth || "",
      (s as any).gender || "",
      s.className || "",
      s.sectionName || "",
      (s as any).admissionDate || "",
      (s as any).session || "",
      (s as any).studentType || "",
      (s as any).aadharNumber || "",
      (s as any).panNumber || "",
      (s as any).previousSchool || "",
      s.whatsappNumber || "",
      s.address || "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-record-list-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-800 rounded-xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide uppercase">Student Admission Panel</h2>
          <p className="text-slate-400 text-sm mt-0.5">Showing {filtered.length} student{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={() => setShowBlankForm(true)} className="bg-slate-900 hover:bg-black text-white border border-slate-700">
            <Printer className="h-4 w-4 mr-2" />
            Blank Form
          </Button>
          <Button onClick={() => setShowBulkPrint(true)} disabled={filtered.length === 0} className="bg-purple-700 hover:bg-purple-800 text-white">
            <Printer className="h-4 w-4 mr-2" />
            Print All ({filtered.length})
          </Button>
          <Button onClick={exportCSV} disabled={filtered.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, father/mother, enrollment..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="w-full md:w-44">
          <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-44">
          <Select value={sectionFilter} onValueChange={(v) => { setSectionFilter(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Actions</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Photo</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Type</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Session</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Admission Date</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Enroll No</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Roll No</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[140px]">Student Name</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[120px]">Father Name</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[120px]">Mother Name</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Date of Birth</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Gender</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Class</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Section</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Contact No</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Parent Email</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[140px]">Address</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Aadhar No</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap">PAN No</th>
              <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap min-w-[140px]">Previous School</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr><td colSpan={22} className="py-16 text-center text-slate-400">Loading...</td></tr>
            ) : pageStudents.length === 0 ? (
              <tr><td colSpan={22} className="py-16 text-center text-slate-400">No students found.</td></tr>
            ) : pageStudents.map((student, idx) => (
              <tr key={student.id} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-950/50"}>
                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700"
                      onClick={() => setPrintTarget(student)}
                      title="Print Admission Form"
                    >
                      <Printer className="h-3 w-3 mr-1" />Print
                    </Button>
                    {canEdit("record-list") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700"
                        onClick={() => openEdit(student)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />Edit
                      </Button>
                    )}
                    {!student.hasVehicle && (student as any).transportRouteId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-teal-600 border-teal-300 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700"
                        onClick={() => openReassign(student)}
                        title="Re-assign to transport"
                      >
                        <Bus className="h-3 w-3 mr-1" />Bus
                      </Button>
                    )}
                    {canDelete("record-list") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700">
                            <Trash2 className="h-3 w-3 mr-1" />Del
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white dark:bg-slate-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {student.studentName}?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteStudent.mutate({ id: student.id })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </td>
                {/* Photo */}
                <td className="px-3 py-2">
                  {(student as any).photoUrl ? (
                    <img src={(student as any).photoUrl} alt={student.studentName} className="w-10 h-12 object-cover rounded border border-slate-200" />
                  ) : (
                    <div className="w-10 h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      <UserCircle2 className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                </td>
                {/* Type */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {(student as any).studentType ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(student as any).studentType === "New" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                      {(student as any).studentType}
                    </span>
                  ) : <span className="text-slate-300 dark:text-slate-600 italic text-xs">—</span>}
                </td>
                {/* Session */}
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                  {session || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Admission Date */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                  {(student as any).admissionDate || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Enrollment No — year suffix derived from student's own session */}
                <td className="px-3 py-2 font-mono text-xs text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap">
                  {student.uniqueId || "—"}
                </td>
                {/* Roll No */}
                <td className="px-3 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                  {student.rollNo || "—"}
                </td>
                {/* Student Name */}
                <td className="px-3 py-2 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                  {student.studentName}
                </td>
                {/* Father Name */}
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {student.fatherName || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Mother Name */}
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {(student as any).motherName || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* DOB */}
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {(student as any).dateOfBirth || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Gender */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {(student as any).gender ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(student as any).gender === "Male" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : (student as any).gender === "Female" ? "bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400" : "bg-slate-100 text-slate-600"}`}>
                      {(student as any).gender}
                    </span>
                  ) : <span className="text-slate-300 dark:text-slate-600 italic text-xs">—</span>}
                </td>
                {/* Class */}
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                    {student.className || "—"}
                  </span>
                </td>
                {/* Section */}
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                  {student.sectionName || "—"}
                </td>
                {/* Contact No */}
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {student.whatsappNumber || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Parent Email */}
                <td className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  {student.parentEmail || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Address */}
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                  {(student as any).address || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Aadhar No */}
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {(student as any).aadharNumber || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* PAN No */}
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {(student as any).panNumber || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
                {/* Previous School */}
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                  {(student as any).previousSchool || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />Previous
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p = i + 1;
              if (totalPages > 5) {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                p = start + i;
              }
              return (
                <Button
                  key={p}
                  variant={page === p ? "default" : "outline"}
                  size="sm"
                  className={`w-9 h-9 p-0 ${page === p ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-500" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student — {editTarget?.studentName}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="space-y-4 pt-2">

              {/* Photo + Admission info */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <FormField control={editForm.control} name="photoUrl" render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
                    <FormLabel className="flex items-center gap-1.5 mb-1"><Camera className="h-3.5 w-3.5 text-amber-500" />Photo</FormLabel>
                    <FormControl><PhotoUpload value={field.value} onChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <div className="flex-1 space-y-3">
                  <FormField control={editForm.control} name="admissionDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={editForm.control} name="studentType" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-500">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="New/Old" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Old">Old</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="session" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-500">Session</FormLabel>
                        <FormControl><Input placeholder="2025-26" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={editForm.control} name="studentName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="fatherName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Father's Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="classId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="sectionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-3">
                <FormField control={editForm.control} name="hasVehicle" render={({ field }) => (
                  <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="rl-edit-bus" /></FormControl>
                    <FormLabel htmlFor="rl-edit-bus" className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200 mb-0">Assign Bus and Trip</FormLabel>
                  </FormItem>
                )} />
                {editHasVehicle && (
                  <div className="ml-4 grid grid-cols-2 gap-4 pl-2 border-l-2 border-amber-400">
                    <FormField control={editForm.control} name="vehicleId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                          <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="tripId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trip</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                          <SelectContent>{trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={editForm.control} name="whatsappNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Contact No.</FormLabel>
                    <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Address</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="parentEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-500 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-500" />Parent Email
                  </FormLabel>
                  <FormControl><Input type="email" placeholder="parent@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* More Details collapsible */}
              <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors"
                >
                  <span className="text-sm font-bold uppercase tracking-wide">More Details</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showMoreDetails ? "rotate-180" : ""}`} />
                </button>
                {showMoreDetails && (
                  <div className="p-5 space-y-4 bg-amber-50 dark:bg-amber-900/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="dateOfBirth" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="motherName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother's Name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="aadharNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aadhar Number <span className="text-xs text-slate-400">(12 digits)</span></FormLabel>
                          <FormControl>
                            <Input maxLength={12} {...field} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 12))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="panNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number</FormLabel>
                          <FormControl>
                            <Input {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="previousSchool" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous School</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    {/* Additional Details */}
                    <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
                      <div className="bg-blue-500 text-white px-4 py-2 text-sm font-bold uppercase tracking-wide">Additional Details</div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={editForm.control} name="bloodGroup" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Blood Group</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="A+">A+</SelectItem>
                                  <SelectItem value="A-">A-</SelectItem>
                                  <SelectItem value="B+">B+</SelectItem>
                                  <SelectItem value="B-">B-</SelectItem>
                                  <SelectItem value="AB+">AB+</SelectItem>
                                  <SelectItem value="AB-">AB-</SelectItem>
                                  <SelectItem value="O+">O+</SelectItem>
                                  <SelectItem value="O-">O-</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={editForm.control} name="nationality" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nationality</FormLabel>
                              <FormControl><Input placeholder="e.g. Indian" {...field} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={editForm.control} name="emergencyContact" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Contact</FormLabel>
                            <FormControl><Input placeholder="Emergency contact name & number" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Blank Form Dialog */}
      {showBlankForm && <BlankFormPrintDialog onClose={() => setShowBlankForm(false)} />}

      {/* Bulk Print Dialog */}
      {showBulkPrint && <BulkPrintDialog students={filtered} onClose={() => setShowBulkPrint(false)} session={session} />}

      {/* Print Form Dialog */}
      {printTarget && (
        <StudentPrintDialog student={printTarget} onClose={() => setPrintTarget(null)} session={session} />
      )}

      {/* Re-assign to Transport Dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(open) => { if (!open) setReassignTarget(null); }}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-teal-600" />
              Re-assign to Transport — {reassignTarget?.studentName}
            </DialogTitle>
          </DialogHeader>
          {reassignTarget && (() => {
            const paidMonths = studentPaidMonths.get(reassignTarget.id) ?? new Set<number>();
            const availableMonths = SCHOOL_MONTHS_ORDER.filter(m => !paidMonths.has(m));
            return (
              <div className="space-y-4 pt-1">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Vehicle <span className="text-red-500">*</span></label>
                    <Select value={reassignVehicleId} onValueChange={setReassignVehicleId}>
                      <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
                      <SelectContent>
                        {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Trip <span className="text-slate-400 font-normal">(optional)</span></label>
                    <Select value={reassignTripId} onValueChange={setReassignTripId}>
                      <SelectTrigger><SelectValue placeholder="Select trip…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {trips.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Transport Route <span className="text-red-500">*</span></label>
                    <Select value={reassignRouteId} onValueChange={setReassignRouteId}>
                      <SelectTrigger><SelectValue placeholder="Select route…" /></SelectTrigger>
                      <SelectContent>
                        {transportRoutes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} — ₹{r.pricePerMonth}/mo</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Month picker — only unpaid months */}
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Start fee from month <span className="text-red-500">*</span>
                    <span className="ml-1 text-slate-400 font-normal">(already-paid months hidden)</span>
                  </label>
                  {availableMonths.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">All months have been paid — no unpaid months available.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableMonths.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setReassignMonth(m)}
                          className={`text-[12px] px-3 py-1 rounded-md border font-medium transition-colors ${
                            reassignMonth === m
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-teal-50 hover:border-teal-400"
                          }`}
                        >
                          {MONTH_SHORT[m]}
                        </button>
                      ))}
                    </div>
                  )}
                  {reassignMonth && (
                    <p className="mt-2 text-xs text-teal-700 dark:text-teal-400 font-medium">
                      ✓ Transport fee will generate from <strong>{MONTH_FULL[reassignMonth]}</strong> onwards.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setReassignTarget(null)} disabled={isReassigning}>Cancel</Button>
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={!reassignVehicleId || !reassignRouteId || !reassignMonth || isReassigning}
                    onClick={handleReassign}
                  >
                    {isReassigning ? "Saving…" : "Re-assign"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
