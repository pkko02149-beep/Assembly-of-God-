import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListStudents, useListClasses, useListSections } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Search, Award, BookOpen, GraduationCap, ClipboardList, CheckCircle, Clock, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { getAdminToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function authFetch(url: string, opts: RequestInit = {}) {
  const token = getAdminToken();
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const CERT_TYPES = [
  { value: "bonafide", label: "Bonafide Certificate" },
  { value: "character", label: "Character Certificate" },
  { value: "leaving", label: "School Leaving Certificate" },
];

interface CertRequest {
  id: number;
  admissionNumber: string;
  studentName: string;
  certificateType: string;
  status: string;
  requestedAt: string;
  issuedAt: string | null;
  remarks: string | null;
  certificateNumber: string | null;
  leavingDate: string | null;
  leavingReason: string | null;
  penNumber: string | null;
}

function GenerateCertificateTab() {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [certType, setCertType] = useState("bonafide");
  const [purpose, setPurpose] = useState("");
  const [leavingReason, setLeavingReason] = useState("");
  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().split("T")[0]);
  const [penNumber, setPenNumber] = useState("");

  const { data: students = [] } = useListStudents({});
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const filtered = (students as any[]).filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (s.uniqueId || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.rollNo || "").toString().includes(search)
  ).slice(0, 20);

  async function printCertificate() {
    if (!selectedStudent) return;
    let schoolName = "School";
    let schoolAddress = "";
    let schoolPhone = "";
    let logoUrl = "";
    let schoolGmail = "";
    let registrationNo = "";
    let udiseCode = "";
    try {
      const res = await fetch("/api/settings/school-info");
      if (res.ok) {
        const d = await res.json();
        schoolName = d.schoolName || schoolName;
        schoolAddress = d.address || "";
        schoolPhone = d.contactNumber || "";
        logoUrl = d.logoUrl || "";
        schoolGmail = d.schoolGmail || "";
        registrationNo = d.registrationNo || "";
        udiseCode = d.udiseCode || "";
      }
    } catch { /* ignore */ }

    const s = selectedStudent;
    const cls = (classes as any[]).find(c => c.id === s.classId);
    const sec = (sections as any[]).find(sc => sc.id === s.sectionId);
    const className = cls?.name || s.className || "";
    const sectionName = sec?.name || s.sectionName || "";
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const photoUrl = s.photoUrl || "";

    // Fetch a stable certificate number from the backend BEFORE printing
    // so every re-print of the same certificate uses the same serial number.
    let certNo = "";
    if (selectedStudent?.uniqueId) {
      try {
        const recRes = await authFetch("/api/website/certificate-requests/record-issued", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admissionNumber: selectedStudent.uniqueId,
            studentName: selectedStudent.studentName,
            certificateType: certType,
            leavingDate: certType === "leaving" ? leavingDate : undefined,
            leavingReason: certType === "leaving" ? leavingReason : undefined,
            penNumber: certType === "leaving" ? penNumber : undefined,
          }),
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          certNo = recData.certificateNumber || "";
        }
      } catch { /* ignore */ }
    }
    if (!certNo) certNo = `CERT-${Date.now().toString().slice(-6)}`;

    const photoHtml = `<div style="position:absolute;top:0;right:0;text-align:center">
  ${photoUrl
    ? `<img src="${photoUrl}" style="width:90px;height:110px;object-fit:cover;border:2px solid #334155;border-radius:4px;" onerror="this.parentElement.innerHTML='<div style=\\'width:90px;height:110px;border:2px solid #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8\\'>Photo</div>'" />`
    : `<div style="width:90px;height:110px;border:2px solid #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8">Photo</div>`}
  <div style="font-size:9px;color:#64748b;margin-top:3px">Photograph</div>
</div>`;

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:72px;width:auto;margin-right:16px;object-fit:contain;" />`
      : `<div style="height:72px;width:72px;margin-right:16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8">LOGO</div>`;

    const headerHtml = `
<div style="display:flex;align-items:center;border-bottom:3px double #334155;padding-bottom:16px;margin-bottom:20px;">
  ${logoHtml}
  <div style="flex:1">
    <div style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:0.5px">${schoolName}</div>
    ${registrationNo ? `<div style="font-size:12px;color:#64748b;margin-top:1px">Reg. No: ${registrationNo}</div>` : ""}
    ${udiseCode ? `<div style="font-size:12px;color:#64748b">U-DISE: ${udiseCode}</div>` : ""}
    ${schoolAddress ? `<div style="font-size:13px;color:#475569;margin-top:3px">${schoolAddress}</div>` : ""}
    <div style="font-size:12px;color:#475569;display:flex;gap:16px;flex-wrap:wrap;margin-top:2px">
      ${schoolPhone ? `<span>Ph: ${schoolPhone}</span>` : ""}
      ${schoolGmail ? `<span>Email: ${schoolGmail}</span>` : ""}
    </div>
  </div>
</div>`;

    let bodyHtml = "";

    if (certType === "bonafide") {
      bodyHtml = `
<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#1e40af;letter-spacing:1px">BONAFIDE CERTIFICATE</div>
<p style="font-size:14px;line-height:2;text-align:justify">
  This is to certify that <strong>${s.studentName}</strong> ${s.gender ? `S/D/O` : ""} of <strong>${s.fatherName || "—"}</strong> is a bonafide student of this institution,
  currently studying in Class <strong>${className} ${sectionName}</strong> during the academic session <strong>${s.session || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1)}</strong>.
  ${s.dateOfBirth ? `Date of Birth as per school records: <strong>${new Date(s.dateOfBirth).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</strong>.` : ""}
  ${purpose ? `<br><br>This certificate is being issued for the purpose of <strong>${purpose}</strong>.` : ""}
</p>`;
    } else if (certType === "character") {
      bodyHtml = `
<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#166534;letter-spacing:1px">CHARACTER CERTIFICATE</div>
<p style="font-size:14px;line-height:2;text-align:justify">
  This is to certify that <strong>${s.studentName}</strong>, Admission No. <strong>${s.uniqueId || "—"}</strong>, S/D/O <strong>${s.fatherName || "—"}</strong>,
  was a student of Class <strong>${className} ${sectionName}</strong> in this school.
  During the period of study, ${s.gender === "Female" ? "she" : "he"} has maintained excellent conduct and character.
  ${s.gender === "Female" ? "She" : "He"} is hardworking, disciplined and of good moral character.
  ${purpose ? `This certificate is issued for <strong>${purpose}</strong>.` : ""}
</p>`;
    } else if (certType === "leaving") {
      bodyHtml = `
<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#7c2d12;letter-spacing:1px">SCHOOL LEAVING CERTIFICATE</div>
<table style="width:100%;font-size:13px;border-collapse:collapse;line-height:2">
  <tr><td style="width:45%;font-weight:600;color:#475569;padding:4px 0">Student Name</td><td style="font-weight:700">${s.studentName}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Father's Name</td><td>${s.fatherName || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Mother's Name</td><td>${s.motherName || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Admission No.</td><td>${s.uniqueId || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Class</td><td>${className} ${sectionName}</td></tr>
  ${s.dateOfBirth ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Date of Birth</td><td>${new Date(s.dateOfBirth).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</td></tr>` : ""}
  ${s.category ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Category</td><td>${s.category}</td></tr>` : ""}
  ${s.religion ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Religion</td><td>${s.religion}</td></tr>` : ""}
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Session</td><td>${s.session || "—"}</td></tr>
  ${penNumber ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">PEN Number</td><td>${penNumber}</td></tr>` : ""}
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Date of Leaving</td><td>${new Date(leavingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</td></tr>
  ${leavingReason ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Reason for Leaving</td><td>${leavingReason}</td></tr>` : ""}
</table>
<p style="font-size:13px;line-height:1.8;margin-top:16px;text-align:justify">
  During ${s.gender === "Female" ? "her" : "his"} stay in this school, ${s.gender === "Female" ? "she" : "he"} has maintained good conduct and character. 
  We wish ${s.gender === "Female" ? "her" : "him"} all the best in future endeavours.
</p>`;
    }

    const verifyUrl = `${window.location.origin}/verify?adm=${encodeURIComponent(s.uniqueId || "")}&type=${encodeURIComponent(certType)}&no=${encodeURIComponent(certNo)}&name=${encodeURIComponent(s.studentName)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verifyUrl)}`;

    const html = `<!DOCTYPE html><html><head><title>${CERT_TYPES.find(c => c.value === certType)?.label || "Certificate"}</title>
<style>
  body { font-family: "Times New Roman", serif; padding: 48px; max-width: 720px; margin: 0 auto; color: #1e293b; }
  @media print { body { padding: 32px; } }
  .sig-row { display: flex; justify-content: space-between; margin-top: 64px; }
  .sig-col { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #334155; margin: 0 auto 4px; }
  .footer-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; font-size: 13px; color: #475569; }
  .qr-block { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .qr-label { font-size: 9px; color: #64748b; text-align: center; }
</style>
</head><body>
${headerHtml}
<div style="position:relative;padding-right:110px;min-height:120px">
${photoHtml}
${bodyHtml}
</div>
<div class="footer-bar">
  <div>
    <div>Certificate No: <strong>${certNo}</strong></div>
    <div>Date: ${today}</div>
  </div>
  <div class="qr-block">
    <img src="${qrUrl}" width="100" height="100" alt="Verify QR" style="border:1px solid #e2e8f0;border-radius:4px;" />
    <div class="qr-label">Scan to verify authenticity</div>
  </div>
</div>
<div class="sig-row">
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Class Teacher</div></div>
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Office Stamp</div></div>
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Principal</div></div>
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=780,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  const certIcon = certType === "bonafide" ? BookOpen : certType === "character" ? Award : GraduationCap;
  const CertIcon = certIcon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Search className="h-4 w-4" /> Select Student
            </h3>
            <Input
              placeholder="Search by name, Adm. No., or Roll No."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedStudent(null); }}
            />
            {search && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No students found</div>
                ) : filtered.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setSearch(""); }}
                    className={`w-full text-left px-4 py-3 hover:bg-violet-50 dark:hover:bg-violet-900/10 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors ${selectedStudent?.id === s.id ? "bg-violet-50 dark:bg-violet-900/10" : ""}`}
                  >
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{s.studentName}</div>
                    <div className="text-xs text-slate-500">{s.uniqueId} · {s.className} {s.sectionName} · Roll {s.rollNo}</div>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
                <div className="font-semibold text-violet-800 dark:text-violet-300">{selectedStudent.studentName}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedStudent.uniqueId} · {selectedStudent.className} {selectedStudent.sectionName} · Roll {selectedStudent.rollNo}
                  <br />Father: {selectedStudent.fatherName || "—"} · Gender: {selectedStudent.gender || "—"}
                  {selectedStudent.category ? ` · Cat: ${selectedStudent.category}` : ""}
                  {selectedStudent.religion ? ` · Religion: ${selectedStudent.religion}` : ""}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CertIcon className="h-4 w-4 text-violet-500" /> Certificate Options
            </h3>
            <div>
              <label className="text-sm font-medium">Certificate Type</label>
              <Select value={certType} onValueChange={setCertType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CERT_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(certType === "bonafide" || certType === "character") && (
              <div>
                <label className="text-sm font-medium">Purpose <span className="text-slate-400 text-xs">(optional)</span></label>
                <Input placeholder="e.g. Bank Account Opening, Scholarship" value={purpose} onChange={e => setPurpose(e.target.value)} className="mt-1" />
              </div>
            )}
            {certType === "leaving" && (
              <>
                <div>
                  <label className="text-sm font-medium">Date of Leaving</label>
                  <Input type="date" value={leavingDate} onChange={e => setLeavingDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">PEN Number <span className="text-slate-400 text-xs">(optional)</span></label>
                  <Input placeholder="Permanent Education Number" value={penNumber} onChange={e => setPenNumber(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason for Leaving <span className="text-slate-400 text-xs">(optional)</span></label>
                  <Input placeholder="e.g. Transfer, Family relocation" value={leavingReason} onChange={e => setLeavingReason(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <Button
              onClick={printCertificate}
              disabled={!selectedStudent}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              {selectedStudent ? `Print ${CERT_TYPES.find(c => c.value === certType)?.label}` : "Select a student to proceed"}
            </Button>
            {!selectedStudent && (
              <p className="text-xs text-slate-400 text-center">Search and select a student above, then choose a certificate type to print</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IssuedCertificatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: requests = [], isLoading, refetch } = useQuery<CertRequest[]>({
    queryKey: ["/api/website/certificate-requests"],
    queryFn: () => authFetch("/api/website/certificate-requests").then(r => r.ok ? r.json() : []),
  });
  const { data: students = [] } = useListStudents({});
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const issued = Array.isArray(requests) ? requests.filter(r => r.status === "issued") : [];

  async function printIssuedCert(r: CertRequest) {
    setPrintingId(r.id);
    try {
      let schoolName = "School", schoolAddress = "", schoolPhone = "", logoUrl = "", schoolGmail = "", registrationNo = "", udiseCode = "";
      try {
        const si = await fetch("/api/settings/school-info");
        if (si.ok) {
          const d = await si.json();
          schoolName = d.schoolName || schoolName;
          schoolAddress = d.address || "";
          schoolPhone = d.contactNumber || "";
          logoUrl = d.logoUrl || "";
          schoolGmail = d.schoolGmail || "";
          registrationNo = d.registrationNo || "";
          udiseCode = d.udiseCode || "";
        }
      } catch { /* ignore */ }

      const s = (students as any[]).find(st => (st.uniqueId || "").toLowerCase() === r.admissionNumber.toLowerCase()) || {
        studentName: r.studentName,
        uniqueId: r.admissionNumber,
        fatherName: "—",
        motherName: "—",
        gender: "",
        dateOfBirth: null,
        category: "",
        religion: "",
        session: "",
        classId: null,
        sectionId: null,
        className: "",
        sectionName: "",
        photoUrl: "",
      };
      const cls = (classes as any[]).find(c => c.id === s.classId);
      const sec = (sections as any[]).find(sc => sc.id === s.sectionId);
      const className = cls?.name || s.className || "";
      const sectionName = sec?.name || s.sectionName || "";
      const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
      const photoUrl = s.photoUrl || "";

      const photoHtml = `<div style="position:absolute;top:0;right:0;text-align:center">
  ${photoUrl
    ? `<img src="${photoUrl}" style="width:90px;height:110px;object-fit:cover;border:2px solid #334155;border-radius:4px;" onerror="this.parentElement.innerHTML='<div style=\\'width:90px;height:110px;border:2px solid #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8\\'>Photo</div>'" />`
    : `<div style="width:90px;height:110px;border:2px solid #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#94a3b8">Photo</div>`}
  <div style="font-size:9px;color:#64748b;margin-top:3px">Photograph</div>
</div>`;

      // Use the stable cert number stored in DB; if missing (legacy record), fetch it now
      let certNo = r.certificateNumber || "";
      if (!certNo) {
        try {
          const recRes = await authFetch("/api/website/certificate-requests/record-issued", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ admissionNumber: r.admissionNumber, studentName: r.studentName, certificateType: r.certificateType }),
          });
          if (recRes.ok) { const d = await recRes.json(); certNo = d.certificateNumber || ""; }
        } catch { /* ignore */ }
      }
      if (!certNo) certNo = `CERT-${r.id.toString().padStart(4, "0")}`;
      const certType = r.certificateType;

      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" style="height:72px;width:auto;margin-right:16px;object-fit:contain;" />`
        : `<div style="height:72px;width:72px;margin-right:16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8">LOGO</div>`;

      const headerHtml = `<div style="display:flex;align-items:center;border-bottom:3px double #334155;padding-bottom:16px;margin-bottom:20px;">
  ${logoHtml}
  <div style="flex:1">
    <div style="font-size:22px;font-weight:800;color:#1e293b">${schoolName}</div>
    ${registrationNo ? `<div style="font-size:12px;color:#64748b">Reg. No: ${registrationNo}</div>` : ""}
    ${udiseCode ? `<div style="font-size:12px;color:#64748b">U-DISE: ${udiseCode}</div>` : ""}
    ${schoolAddress ? `<div style="font-size:13px;color:#475569;margin-top:3px">${schoolAddress}</div>` : ""}
    <div style="font-size:12px;color:#475569;display:flex;gap:16px;margin-top:2px">
      ${schoolPhone ? `<span>Ph: ${schoolPhone}</span>` : ""}
      ${schoolGmail ? `<span>Email: ${schoolGmail}</span>` : ""}
    </div>
  </div>
</div>`;

      let bodyHtml = "";
      if (certType === "bonafide") {
        bodyHtml = `<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#1e40af;letter-spacing:1px">BONAFIDE CERTIFICATE</div>
<p style="font-size:14px;line-height:2;text-align:justify">
  This is to certify that <strong>${s.studentName}</strong> ${s.gender ? "S/D/O" : ""} of <strong>${s.fatherName || "—"}</strong> is a bonafide student of this institution,
  currently studying in Class <strong>${className} ${sectionName}</strong> during the academic session <strong>${s.session || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1)}</strong>.
  ${s.dateOfBirth ? `Date of Birth as per school records: <strong>${new Date(s.dateOfBirth).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</strong>.` : ""}
</p>`;
      } else if (certType === "character") {
        bodyHtml = `<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#166534;letter-spacing:1px">CHARACTER CERTIFICATE</div>
<p style="font-size:14px;line-height:2;text-align:justify">
  This is to certify that <strong>${s.studentName}</strong>, Admission No. <strong>${s.uniqueId || "—"}</strong>, S/D/O <strong>${s.fatherName || "—"}</strong>,
  was a student of Class <strong>${className} ${sectionName}</strong> in this school.
  During the period of study, ${s.gender === "Female" ? "she" : "he"} has maintained excellent conduct and character.
  ${s.gender === "Female" ? "She" : "He"} is hardworking, disciplined and of good moral character.
</p>`;
      } else {
        bodyHtml = `<div style="font-size:18px;font-weight:700;text-align:center;text-decoration:underline;margin-bottom:24px;color:#7c2d12;letter-spacing:1px">SCHOOL LEAVING CERTIFICATE</div>
<table style="width:100%;font-size:13px;border-collapse:collapse;line-height:2">
  <tr><td style="width:45%;font-weight:600;color:#475569;padding:4px 0">Student Name</td><td style="font-weight:700">${s.studentName}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Father's Name</td><td>${s.fatherName || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Mother's Name</td><td>${s.motherName || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Admission No.</td><td>${s.uniqueId || "—"}</td></tr>
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Class</td><td>${className} ${sectionName}</td></tr>
  ${s.dateOfBirth ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Date of Birth</td><td>${new Date(s.dateOfBirth).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</td></tr>` : ""}
  ${s.category ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Category</td><td>${s.category}</td></tr>` : ""}
  ${s.religion ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Religion</td><td>${s.religion}</td></tr>` : ""}
  <tr><td style="font-weight:600;color:#475569;padding:4px 0">Session</td><td>${s.session || "—"}</td></tr>
  ${r.penNumber ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">PEN Number</td><td>${r.penNumber}</td></tr>` : ""}
  ${r.leavingDate ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Date of Leaving</td><td>${new Date(r.leavingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</td></tr>` : ""}
  ${r.leavingReason ? `<tr><td style="font-weight:600;color:#475569;padding:4px 0">Reason for Leaving</td><td>${r.leavingReason}</td></tr>` : ""}
</table>
<p style="font-size:13px;line-height:1.8;margin-top:16px;text-align:justify">
  During ${s.gender === "Female" ? "her" : "his"} stay in this school, ${s.gender === "Female" ? "she" : "he"} has maintained good conduct and character.
  We wish ${s.gender === "Female" ? "her" : "him"} all the best in future endeavours.
</p>`;
      }

      const verifyUrlIssued = `${window.location.origin}/verify?adm=${encodeURIComponent(r.admissionNumber)}&type=${encodeURIComponent(certType)}&no=${encodeURIComponent(certNo)}&name=${encodeURIComponent(r.studentName)}`;
      const qrUrlIssued = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(verifyUrlIssued)}`;

      const html = `<!DOCTYPE html><html><head><title>${CERT_TYPES.find(c => c.value === certType)?.label || "Certificate"}</title>
<style>
  body { font-family: "Times New Roman", serif; padding: 48px; max-width: 720px; margin: 0 auto; color: #1e293b; }
  @media print { body { padding: 32px; } }
  .sig-row { display: flex; justify-content: space-between; margin-top: 64px; }
  .sig-col { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #334155; margin: 0 auto 4px; }
  .footer-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; font-size: 13px; color: #475569; }
  .qr-block { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .qr-label { font-size: 9px; color: #64748b; text-align: center; }
</style>
</head><body>
${headerHtml}
<div style="position:relative;padding-right:110px;min-height:120px">
${photoHtml}
${bodyHtml}
</div>
<div class="footer-bar">
  <div>
    <div>Certificate No: <strong>${certNo}</strong></div>
    <div>Date: ${today}</div>
  </div>
  <div class="qr-block">
    <img src="${qrUrlIssued}" width="100" height="100" alt="Verify QR" style="border:1px solid #e2e8f0;border-radius:4px;" />
    <div class="qr-label">Scan to verify authenticity</div>
  </div>
</div>
<div class="sig-row">
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Class Teacher</div></div>
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Office Stamp</div></div>
  <div class="sig-col"><div class="sig-line"></div><div style="font-size:12px">Principal</div></div>
</div>
</body></html>`;

      const win = window.open("", "_blank", "width=780,height=900");
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    } finally {
      setPrintingId(null);
    }
  }

  async function deleteIssued(id: number) {
    setDeletingId(id);
    try {
      await authFetch(`/api/website/certificate-requests/${id}`, { method: "DELETE" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/website/certificate-requests"] });
      toast({ title: "Record deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <div className="text-center py-12 text-slate-400">Loading issued certificates…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{issued.length} certificate{issued.length !== 1 ? "s" : ""} issued</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
      </div>
      {issued.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No certificates have been issued yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issued.map(r => (
            <Card key={r.id} className="border-emerald-100 dark:border-emerald-900">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.studentName || r.admissionNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Issued</span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>Adm. No: <span className="font-medium">{r.admissionNumber}</span> · {CERT_TYPES.find(c => c.value === r.certificateType)?.label || r.certificateType}</div>
                      {r.certificateNumber && <div>Cert. No: <span className="font-medium text-violet-700 dark:text-violet-400">{r.certificateNumber}</span></div>}
                      <div>Requested: {new Date(r.requestedAt).toLocaleDateString("en-IN")}</div>
                      {r.issuedAt && <div>Issued: {new Date(r.issuedAt).toLocaleDateString("en-IN")}</div>}
                      {r.remarks && <div>Remarks: {r.remarks}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-violet-200 text-violet-700 hover:bg-violet-50"
                      disabled={printingId === r.id}
                      onClick={() => printIssuedCert(r)}
                    >
                      {printingId === r.id
                        ? <><FileText className="h-3.5 w-3.5 mr-1 animate-pulse" />Printing…</>
                        : <><FileText className="h-3.5 w-3.5 mr-1" />Print</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                      disabled={deletingId === r.id}
                      onClick={() => deleteIssued(r.id)}
                      title="Delete this record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateRequestsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: requests = [], isLoading, refetch } = useQuery<CertRequest[]>({
    queryKey: ["/api/website/certificate-requests"],
    queryFn: () => authFetch("/api/website/certificate-requests").then(r => r.ok ? r.json() : []),
  });
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});

  const pending = Array.isArray(requests) ? requests.filter(r => r.status === "pending") : [];

  async function updateStatus(id: number, status: string) {
    setUpdatingId(id);
    try {
      await authFetch(`/api/website/certificate-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks: remarksMap[id] || "" }),
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/website/certificate-requests"] });
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteRequest(id: number) {
    setDeletingId(id);
    try {
      await authFetch(`/api/website/certificate-requests/${id}`, { method: "DELETE" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/website/certificate-requests"] });
      toast({ title: "Request deleted" });
    } catch {
      toast({ title: "Failed to delete request", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm("Delete ALL certificate requests? This cannot be undone.")) return;
    setClearingAll(true);
    try {
      await authFetch("/api/website/certificate-requests/all", { method: "DELETE" });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/website/certificate-requests"] });
      toast({ title: "All requests cleared" });
    } catch {
      toast({ title: "Failed to clear requests", variant: "destructive" });
    } finally {
      setClearingAll(false);
    }
  }

  const statusIcon = (s: string) => s === "issued" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : s === "rejected" ? <XCircle className="h-4 w-4 text-red-400" /> : <Clock className="h-4 w-4 text-amber-500" />;
  const statusBadge = (s: string) => s === "issued" ? "bg-emerald-100 text-emerald-700" : s === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";

  if (isLoading) return <div className="text-center py-12 text-slate-400">Loading requests…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">{pending.length} pending · {Array.isArray(requests) ? requests.length : 0} total</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
          {Array.isArray(requests) && requests.length > 0 && (
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={clearingAll} onClick={clearAll}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />{clearingAll ? "Clearing…" : "Clear All"}
            </Button>
          )}
        </div>
      </div>
      {!Array.isArray(requests) || requests.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No certificate requests yet. Students can request certificates from the Download Center.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <Card key={r.id} className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusIcon(r.status)}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.studentName || r.admissionNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(r.status)}`}>{r.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>Adm. No: <span className="font-medium">{r.admissionNumber}</span> · {CERT_TYPES.find(c => c.value === r.certificateType)?.label || r.certificateType}</div>
                      <div>Requested: {new Date(r.requestedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      {r.remarks && <div className="text-slate-400 italic">{r.remarks}</div>}
                    </div>
                    {r.status === "pending" && (
                      <Input
                        className="mt-2 text-xs h-7"
                        placeholder="Remarks (optional)"
                        value={remarksMap[r.id] || ""}
                        onChange={e => setRemarksMap(m => ({ ...m, [r.id]: e.target.value }))}
                      />
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={updatingId === r.id} onClick={() => updateStatus(r.id, "issued")}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Issue
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={updatingId === r.id} onClick={() => updateStatus(r.id, "rejected")}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500 hover:bg-red-50" disabled={deletingId === r.id} onClick={() => deleteRequest(r.id)} title="Delete this request">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentPanelTab() {
  const [activeTab, setActiveTab] = useState<"generate" | "issued" | "requests">("generate");

  const tabs = [
    { key: "generate" as const, label: "Generate Certificate", icon: FileText },
    { key: "issued" as const, label: "Issued Certificates", icon: CheckCircle },
    { key: "requests" as const, label: "Certificate Requests", icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-violet-500" /> Student Panel — Certificates
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generate certificates, view issued certificates, and manage student requests</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key ? "bg-white dark:bg-slate-700 shadow-sm text-violet-700 dark:text-violet-300" : "text-slate-600 dark:text-slate-400 hover:text-slate-800"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "generate" && <GenerateCertificateTab />}
      {activeTab === "issued" && <IssuedCertificatesTab />}
      {activeTab === "requests" && <CertificateRequestsTab />}
    </div>
  );
}
