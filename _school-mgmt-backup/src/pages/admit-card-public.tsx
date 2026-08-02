import { useState } from "react";
import { useLocation } from "wouter";
import {
  Search, Lock, AlertCircle, ArrowLeft, ClipboardList,
  Calendar, Clock, CheckCircle2, CreditCard, ChevronDown,
  ChevronUp, Printer, MapPin, GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentInfo {
  id: number;
  studentName: string;
  rollNo?: number;
  fatherName: string;
  motherName: string;
  className: string;
  sectionName: string;
  photoUrl?: string;
}

interface Schedule {
  subjectName: string;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
}

interface ExamCard {
  examId: number;
  examName: string;
  session?: string;
  type?: string;
  held: boolean;
  notPublished: boolean;
  schedules?: Schedule[];
}

interface AdmitCardData {
  found: boolean;
  student?: StudentInfo;
  exams?: ExamCard[];
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Single Exam Admit Card ───────────────────────────────────────────────────
function ExamAdmitCard({ exam, student, schoolInfo }: {
  exam: ExamCard;
  student: StudentInfo;
  schoolInfo: { schoolName: string; address: string; contactNumber: string; udiseCode: string; logoUrl: string };
}) {
  const [open, setOpen] = useState(true);

  if (exam.notPublished) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <div className="font-semibold text-gray-700">{exam.examName}</div>
            {exam.session && <div className="text-xs text-gray-400">Session: {exam.session}</div>}
          </div>
          <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200">Not Released</span>
        </div>
        <p className="text-xs text-slate-500 mt-3 ml-13 pl-13">
          Admit card not yet published by school admin. Please check back later.
        </p>
      </div>
    );
  }

  if (exam.held) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-800">{exam.examName}</div>
            {exam.session && <div className="text-xs text-gray-400">Session: {exam.session}</div>}
          </div>
          <span className="ml-auto text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full border border-red-200 font-medium">Held</span>
        </div>
        <p className="text-sm text-red-700 font-medium">Admit Card Withheld</p>
        <p className="text-xs text-red-600 mt-1">Your admit card has been held due to pending dues. Please contact the school office to clear outstanding fees.</p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700">
          <CreditCard className="h-3.5 w-3.5" />
          Clear dues to unlock admit card
        </div>
      </div>
    );
  }

  function handlePrint() {
    const sName = schoolInfo.schoolName || "School";
    const qrData = encodeURIComponent(`ADMIT:${student.id}:${exam.examId}:${exam.examName}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}`;

    const scheduleHtml = exam.schedules && exam.schedules.length > 0 ? `
      <table style="width:100%;margin-top:8px;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#1e3a5f;color:#fff">
            <th style="border:1px solid #1e3a5f;padding:5px 6px;text-align:left">Subject</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Date</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Time</th>
            <th style="border:1px solid #1e3a5f;padding:5px 6px">Room</th>
          </tr>
        </thead>
        <tbody>
          ${exam.schedules.map((sc, i) => `
            <tr style="background:${i % 2 === 0 ? "#f8f9fa" : "#fff"}">
              <td style="border:1px solid #dee2e6;padding:4px 6px">${sc.subjectName}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${formatDate(sc.examDate)}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.startTime && sc.endTime ? `${sc.startTime}–${sc.endTime}` : "—"}</td>
              <td style="border:1px solid #dee2e6;padding:4px 6px;text-align:center">${sc.room || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : "<p style='font-size:11px;color:#666;margin-top:6px'>Schedule will be announced. Arrive 30 minutes early.</p>";

    const html = `<!DOCTYPE html><html><head><title>Admit Card – ${student.studentName}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:24px;background:#f0f0f0}
  @media print{body{background:white;padding:0}@page{margin:12mm}}
</style></head><body>
<div style="border:2px solid #1e3a5f;border-radius:8px;overflow:hidden;max-width:720px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      ${schoolInfo.logoUrl ? `<img src="${schoolInfo.logoUrl}" width="48" height="48" style="border-radius:50%;object-fit:cover;background:#fff" />` : `<div style="width:48px;height:48px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M16 4L28 10V14C28 20.627 22.627 26.627 16 28C9.373 26.627 4 20.627 4 14V10L16 4Z" fill="#1e3a5f"/><path d="M16 8L24 12V15C24 19.418 20.418 23.418 16 24.5C11.582 23.418 8 19.418 8 15V12L16 8Z" fill="#f59e0b"/></svg></div>`}
      <div>
        <div style="font-size:16px;font-weight:bold;letter-spacing:0.5px">${sName.toUpperCase()}</div>
        ${schoolInfo.address ? `<div style="font-size:9px;opacity:0.8">${schoolInfo.address}</div>` : ""}
        <div style="font-size:9px;opacity:0.75">${schoolInfo.contactNumber ? `Tel: ${schoolInfo.contactNumber}` : ""}${schoolInfo.udiseCode ? ` | UDISE: ${schoolInfo.udiseCode}` : ""}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;background:#fff;color:#1e3a5f;padding:3px 10px;border-radius:12px;font-weight:bold">ADMIT CARD</div>
      <div style="font-size:12px;font-weight:bold;margin-top:4px">${exam.examName.toUpperCase()}</div>
      ${exam.session ? `<div style="font-size:9px;opacity:0.8">Session: ${exam.session}</div>` : ""}
    </div>
  </div>
  <div style="padding:14px 16px;display:flex;gap:14px">
    <div style="flex:1">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#555;padding:3px 0;width:130px">Student Name</td><td style="font-weight:bold;padding:3px 0">: ${student.studentName}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Roll Number</td><td style="font-weight:bold;padding:3px 0">: ${student.rollNo ?? "—"}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Class / Section</td><td style="font-weight:bold;padding:3px 0">: ${student.className} – ${student.sectionName}</td></tr>
        <tr><td style="color:#555;padding:3px 0">Father's Name</td><td style="padding:3px 0">: ${student.fatherName || "—"}</td></tr>
      </table>
      <div style="margin-top:8px;padding:6px 8px;background:#fff8e1;border-left:3px solid #f59e0b;font-size:10px;color:#555">
        Candidate must bring this card to every paper. Late entry not permitted.
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:88px">
      ${student.photoUrl ? `<img src="${student.photoUrl}" width="80" height="90" style="object-fit:cover;border:1px solid #ccc;border-radius:4px" />` : `<div style="width:80px;height:90px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#999;text-align:center;border-radius:4px">Photo<br>Here</div>`}
      <img src="${qrUrl}" width="80" height="80" style="border:1px solid #eee;border-radius:4px" alt="QR" />
      <div style="font-size:8px;color:#888;text-align:center">Scan to verify</div>
    </div>
  </div>
  <div style="padding:0 16px 8px">
    <div style="font-size:11px;font-weight:bold;color:#1e3a5f;border-bottom:1px solid #1e3a5f;margin-bottom:6px;padding-bottom:2px">EXAMINATION SCHEDULE</div>
    ${scheduleHtml}
  </div>
  <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb">
    <div style="text-align:center"><div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div><div style="font-size:10px;color:#555">Student Signature</div></div>
    <div style="text-align:center"><div style="border-top:1px solid #333;width:120px;margin-bottom:3px"></div><div style="font-size:10px;color:#555">Principal Signature & Stamp</div></div>
  </div>
</div></body></html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Please allow popups to print."); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  return (
    <div className="bg-white border-2 rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: NAVY }}>
      {/* Exam header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-50/50 transition-colors"
        style={{ background: open ? `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` : undefined }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${open ? "bg-white/20" : "bg-blue-100"}`}>
            <ClipboardList className={`h-5 w-5 ${open ? "text-white" : "text-blue-700"}`} />
          </div>
          <div className="text-left min-w-0">
            <div className={`font-semibold truncate ${open ? "text-white" : "text-gray-800"}`}>{exam.examName}</div>
            <div className={`text-xs ${open ? "text-white/70" : "text-gray-400"}`}>
              {[exam.type, exam.session].filter(Boolean).join(" · ") || "Exam"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${open ? "bg-green-400/20 border-green-300 text-green-100" : "bg-green-50 border-green-200 text-green-700"}`}>
            <CheckCircle2 className="h-3 w-3 inline mr-1" />Eligible
          </span>
          {open ? <ChevronUp className={`h-4 w-4 ${open ? "text-white/70" : "text-gray-400"}`} /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Student info */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Student Name</span>
                      <span className="font-bold text-gray-800">{student.studentName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Roll Number</span>
                      <span className="font-semibold text-gray-700">{student.rollNo ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Class / Section</span>
                      <span className="font-semibold text-gray-700">{student.className} – {student.sectionName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Father's Name</span>
                      <span className="text-gray-700">{student.fatherName || "—"}</span>
                    </div>
                  </div>
                  <div className="mt-3 px-3 py-2 bg-amber-50 border-l-4 border-amber-400 text-xs text-amber-800 rounded-r-lg">
                    Candidate must bring this card to every paper. Late entry not permitted.
                  </div>
                </div>
                {student.photoUrl && (
                  <img src={student.photoUrl} alt={student.studentName} className="w-20 h-24 object-cover border border-gray-200 rounded-lg flex-shrink-0" />
                )}
                {!student.photoUrl && (
                  <div className="w-20 h-24 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 flex-shrink-0 text-center">
                    Photo<br />Here
                  </div>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div className="px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                <Calendar className="h-3.5 w-3.5" />
                Examination Schedule
              </div>
              {exam.schedules && exam.schedules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-white" style={{ background: NAVY }}>
                        <th className="text-left px-3 py-2 rounded-tl-lg">Subject</th>
                        <th className="px-3 py-2"><Calendar className="h-3 w-3 inline mr-1" />Date</th>
                        <th className="px-3 py-2"><Clock className="h-3 w-3 inline mr-1" />Time</th>
                        <th className="px-3 py-2 rounded-tr-lg"><MapPin className="h-3 w-3 inline mr-1" />Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exam.schedules.map((sc, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-3 py-2 font-medium text-gray-800">{sc.subjectName}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{formatDate(sc.examDate)}</td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {sc.startTime && sc.endTime ? `${sc.startTime} – ${sc.endTime}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">{sc.room || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  Schedule will be announced. Arrive 30 minutes before exam time.
                </div>
              )}
            </div>

            {/* Signature + Print */}
            <div className="px-5 pb-4 flex items-end justify-between border-t border-gray-100 pt-3">
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="border-t border-gray-400 w-24 mb-1" />
                  <div className="text-xs text-gray-400">Student Signature</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-400 w-24 mb-1" />
                  <div className="text-xs text-gray-400">Principal Signature</div>
                </div>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4fa0)` }}
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdmitCardPublicPage() {
  const [, navigate] = useLocation();
  const [admissionNo, setAdmissionNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdmitCardData | null>(null);
  const [schoolInfo, setSchoolInfo] = useState({ schoolName: "School", address: "", contactNumber: "", udiseCode: "", logoUrl: "" });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const no = admissionNo.trim();
    if (!no) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const [res, si] = await Promise.all([
        fetch(`/api/website/admit-card?admissionNo=${encodeURIComponent(no)}`),
        fetch("/api/settings/school-info").then(r => r.json()).catch(() => ({})),
      ]);
      if (!res.ok) throw new Error("Server error. Please try again.");
      const json: AdmitCardData = await res.json();
      if (si?.schoolName) setSchoolInfo({
        schoolName: si.schoolName || "School",
        address: si.address || "",
        contactNumber: si.contactNumber || "",
        udiseCode: si.udiseCode || "",
        logoUrl: si.logoUrl || "",
      });
      setData(json);
      if (!json.found) setError("No student found with this admission number. Please check and try again.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch admit card. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const availableExams = data?.exams?.filter(e => !e.notPublished) ?? [];
  const notPublishedExams = data?.exams?.filter(e => e.notPublished) ?? [];

  return (
    <div className="min-h-screen" style={{ background: "#f8f9fc" }}>
      {/* Top bar */}
      <div className="text-white text-xs py-2 px-4 flex justify-between items-center" style={{ background: DARK }}>
        <span>Assembly of God School · Excellence in Education</span>
        <button onClick={() => navigate("/")} className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
          <ArrowLeft className="h-3 w-3" />
          Back to Home
        </button>
      </div>

      {/* Header */}
      <div className="text-white py-10 px-4" style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/20 mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Admit Card Portal</h1>
          <p className="text-white/70 text-sm max-w-lg mx-auto">
            Enter your Admission Number to download your exam admit card with the full examination schedule.
          </p>
        </div>
      </div>

      {/* Search box */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Search by Admission Number</span>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Your admission number (e.g. <span className="font-mono bg-gray-100 px-1 rounded">AG2024001</span>) is on your ID card or admission letter.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={admissionNo}
              onChange={e => setAdmissionNo(e.target.value)}
              placeholder="Enter Admission Number..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a6e]/30 focus:border-[#1e3a6e] transition-all"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !admissionNo.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4fa0)` }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Searching...
                </span>
              ) : (
                <span className="flex items-center gap-1.5"><Search className="h-4 w-4" />Search</span>
              )}
            </button>
          </form>

          {/* How-to steps */}
          {!data && !error && !loading && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">How to get your admit card</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: "1", label: "Enter Admission No.", desc: "Type your unique admission number above" },
                  { step: "2", label: "Click Search", desc: "Tap Search to fetch your admit card" },
                  { step: "3", label: "Print Card", desc: "View schedule and print your admit card" },
                ].map(s => (
                  <div key={s.step} className="text-center p-3 rounded-xl bg-gray-50">
                    <div className="h-7 w-7 rounded-full text-white text-xs font-bold flex items-center justify-center mx-auto mb-2" style={{ background: NAVY }}>
                      {s.step}
                    </div>
                    <div className="text-xs font-semibold text-gray-700">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              <p className="text-xs text-red-600 mt-1">If you believe this is a mistake, please contact the school office.</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {data?.found && data.student && (
        <div className="max-w-3xl mx-auto px-4 mt-4 pb-12 space-y-4">
          {/* Student info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              {data.student.photoUrl ? (
                <img src={data.student.photoUrl} alt={data.student.studentName} className="h-12 w-12 rounded-full object-cover border-2 border-blue-200 flex-shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${DARK}, ${NAVY})` }}>
                  {data.student.studentName[0]}
                </div>
              )}
              <div>
                <div className="font-bold text-gray-800 text-lg">{data.student.studentName}</div>
                <div className="text-sm text-gray-500">
                  {[data.student.className, data.student.sectionName].filter(Boolean).join(" – ")}
                  {data.student.rollNo ? ` · Roll No. ${data.student.rollNo}` : ""}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Admit cards */}
          {availableExams.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">
                  {availableExams.length} Admit Card{availableExams.length !== 1 ? "s" : ""} Available
                </span>
              </div>
              {availableExams.map((exam, i) => (
                <motion.div key={exam.examId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <ExamAdmitCard exam={exam} student={data.student!} schoolInfo={schoolInfo} />
                </motion.div>
              ))}
            </>
          )}

          {/* Not-yet-published exams */}
          {notPublishedExams.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-2">
                <ClipboardList className="h-4 w-4 text-gray-300" />
                <span className="text-sm font-semibold text-gray-400">Upcoming / Unreleased</span>
              </div>
              {notPublishedExams.map((exam, i) => (
                <motion.div key={exam.examId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <ExamAdmitCard exam={exam} student={data.student!} schoolInfo={schoolInfo} />
                </motion.div>
              ))}
            </>
          )}

          {data.exams?.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No upcoming exams scheduled</p>
              <p className="text-sm text-gray-400 mt-1">Admit cards will appear here once the school schedules an exam.</p>
            </div>
          )}
        </div>
      )}

      <div className="text-center text-xs text-gray-400 pb-8 mt-4">
        Having trouble? Contact the school office for assistance.
      </div>
    </div>
  );
}
