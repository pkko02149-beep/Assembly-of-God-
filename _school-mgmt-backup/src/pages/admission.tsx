import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ArrowLeft, Phone, Mail, MapPin, Clock,
  CheckCircle2, FileText, GraduationCap, Users, BookOpen,
  Bus, IndianRupee, HelpCircle, Award, Star,
  ChevronDown, ChevronUp, Send, User, Search, Loader2,
  Clock3, AlertCircle, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const NAVY = "#1e3a6e";
const GOLD = "#c9a84c";
const DARK = "#0f2045";

const CLASSES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];

// ─── Data types (must match admission-tab.tsx) ────────────────────────────────
interface FeeColumn { id: string; header: string; }
interface FeeRow { id: string; classGroup: string; values: Record<string, string>; }
interface TimingRow { id: string; day: string; time: string; }
interface TransportData { routes: { id: string; name: string; price: string }[]; features: { id: string; text: string }[]; }
interface UniformData { boys18: { id: string; text: string }[]; girls18: { id: string; text: string }[]; senior: { id: string; text: string }[]; sports: { id: string; text: string }[]; }

interface AdmissionInfo {
  admission_fee_info: string;
  admission_timing: string;
  admission_transport: string;
  admission_uniform: string;
}

interface SchoolBranding {
  school_name: string;
  school_address: string;
  school_contact_number: string;
  school_email: string;
}

function safeParse<T>(val: string, fallback: T): T {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

const DEFAULT_FEE_COLS: FeeColumn[] = [
  { id: "fc1", header: "Admission Fee" },
  { id: "fc2", header: "Monthly Tuition" },
  { id: "fc3", header: "Annual Charges" },
];
const DEFAULT_FEE_ROWS: FeeRow[] = [
  { id: "1", classGroup: "Nursery / LKG", values: { fc1: "₹2,000", fc2: "₹600/month", fc3: "₹1,500" } },
  { id: "2", classGroup: "Class 1–5", values: { fc1: "₹2,500", fc2: "₹800/month", fc3: "₹2,000" } },
  { id: "3", classGroup: "Class 6–8", values: { fc1: "₹3,000", fc2: "₹1,000/month", fc3: "₹2,500" } },
  { id: "4", classGroup: "Class 9–10", values: { fc1: "₹3,500", fc2: "₹1,200/month", fc3: "₹3,000" } },
  { id: "5", classGroup: "Class 11–12", values: { fc1: "₹4,000", fc2: "₹1,500/month", fc3: "₹3,500" } },
];
const DEFAULT_TIMING_ROWS: TimingRow[] = [
  { id: "1", day: "Monday – Friday", time: "8:00 AM – 2:30 PM" },
  { id: "2", day: "Saturday", time: "9:00 AM – 12:30 PM" },
  { id: "3", day: "Office Hours", time: "9:00 AM – 4:00 PM (Mon–Sat)" },
  { id: "4", day: "Summer Timing", time: "7:00 AM – 12:30 PM (Apr–Jun)" },
];
const DEFAULT_TRANSPORT: TransportData = {
  routes: [
    { id: "1", name: "Route A: North Zone", price: "₹600/month" },
    { id: "2", name: "Route B: South Zone", price: "₹700/month" },
    { id: "3", name: "Route C: East Zone", price: "₹800/month" },
    { id: "4", name: "Route D: West Zone", price: "₹750/month" },
  ],
  features: [
    { id: "1", text: "GPS-monitored buses for real-time tracking" },
    { id: "2", text: "Trained and verified drivers and attendants" },
    { id: "3", text: "Door-step pickup and drop facility" },
    { id: "4", text: "Covered routes across all major areas" },
    { id: "5", text: "Emergency contact for every bus route" },
    { id: "6", text: "Monthly pass and term pass available" },
  ],
};
const DEFAULT_UNIFORM: UniformData = {
  boys18: [
    { id: "1", text: "White shirt with school emblem" },
    { id: "2", text: "Navy blue trousers" },
    { id: "3", text: "Black shoes and white socks" },
    { id: "4", text: "School tie and belt" },
  ],
  girls18: [
    { id: "1", text: "Navy blue salwar kameez with school dupatta" },
    { id: "2", text: "Navy blue dress (winters)" },
    { id: "3", text: "Black shoes and white socks" },
    { id: "4", text: "School tie and ribbon" },
  ],
  senior: [
    { id: "1", text: "White shirt/kurta with school badge" },
    { id: "2", text: "Navy blue trousers/salwar" },
    { id: "3", text: "Formal black shoes" },
    { id: "4", text: "School blazer (winters)" },
  ],
  sports: [
    { id: "1", text: "House colour T-shirt" },
    { id: "2", text: "White track pants" },
    { id: "3", text: "Sports shoes" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, light = false }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-10">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className={`h-px w-12 ${light ? "bg-white/30" : "bg-[#c9a84c]/40"}`} />
        <span className="text-xs font-bold tracking-widest uppercase text-[#c9a84c]">{subtitle || "Admissions"}</span>
        <div className={`h-px w-12 ${light ? "bg-white/30" : "bg-[#c9a84c]/40"}`} />
      </div>
      <h2 className={`text-2xl md:text-3xl font-bold ${light ? "text-white" : "text-[#1e3a6e]"}`}>{title}</h2>
    </motion.div>
  );
}

// ─── Section 1: Hero Banner ───────────────────────────────────────────────────
function AdmissionHero({ branding, currentSession }: { branding?: SchoolBranding; currentSession?: string }) {
  const [, setLocation] = useLocation();
  const sessionLabel = currentSession ? `Session ${currentSession}` : "Enrolling Now";
  return (
    <section className="relative overflow-hidden py-20 px-4" style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 60%, #2d1b69 100%)` }}>
      <div className="absolute inset-0 opacity-10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="absolute rounded-full border border-white/20"
            style={{ width: `${200 + i * 120}px`, height: `${200 + i * 120}px`, top: `${-60 + i * 20}px`, right: `${-80 + i * 30}px` }} />
        ))}
      </div>
      <div className="max-w-6xl mx-auto relative z-10 text-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white mb-5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Admissions Open — {sessionLabel}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Admissions Open
          </h1>
          <p className="text-white/80 text-base mb-8 max-w-xl mx-auto leading-relaxed">
            Join {branding?.school_name || "our school"} — where every child is nurtured, every talent celebrated, and every future shaped with care.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="font-bold px-8 text-[#0f2045]" style={{ backgroundColor: GOLD }}
              onClick={() => document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth" })}>
              Apply for Admission <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8"
              onClick={() => document.getElementById("contact-office")?.scrollIntoView({ behavior: "smooth" })}>
              Contact Admission Office
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Reference Number Search ──────────────────────────────────────────────────
interface ApplicationStatus {
  id: number;
  studentName: string;
  classApplied: string;
  status: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:  { label: "Under Review",  color: "#92400e", bg: "#fffbeb", border: "#fcd34d", icon: Clock3 },
  approved: { label: "Approved",      color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", icon: CheckCircle2 },
  rejected: { label: "Not Selected",  color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", icon: XCircle },
  waitlist: { label: "Waitlisted",    color: "#1e3a8a", bg: "#eff6ff", border: "#93c5fd", icon: AlertCircle },
};

function ReferenceSearch() {
  const [refNo, setRefNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = refNo.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/website/admission/status?refNo=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || "Application not found.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG["pending"]) : null;
  const StatusIcon = cfg?.icon ?? Clock3;
  const refLabel = (id: number) => `APP-${String(id).padStart(5, "0")}`;

  return (
    <section className="py-10 px-4 bg-[#f8f9fc] border-b border-gray-100">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px w-10 bg-[#c9a84c]/40" />
              <span className="text-xs font-bold tracking-widest uppercase text-[#c9a84c]">Track Application</span>
              <div className="h-px w-10 bg-[#c9a84c]/40" />
            </div>
            <h2 className="text-xl font-bold text-[#1e3a6e]">Check Application Status</h2>
            <p className="text-gray-500 text-sm mt-1">Enter the reference number received after submitting your application</p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={refNo}
                onChange={e => { setRefNo(e.target.value); setResult(null); setError(null); }}
                placeholder="e.g. APP-00001"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white shadow-sm"
                style={{ "--tw-ring-color": NAVY } as React.CSSProperties}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !refNo.trim()}
              className="px-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: NAVY }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </form>

          {/* Result */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 max-w-xl mx-auto flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </motion.div>
            )}

            {result && cfg && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 max-w-xl mx-auto rounded-2xl border shadow-sm overflow-hidden"
                style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}>
                {/* Status badge row */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: cfg.border }}>
                  <div className="flex items-center gap-2.5">
                    <StatusIcon className="h-5 w-5" style={{ color: cfg.color }} />
                    <span className="font-bold text-base" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-white/70 border" style={{ borderColor: cfg.border, color: cfg.color }}>
                    {refLabel(result.id)}
                  </span>
                </div>
                {/* Details */}
                <div className="px-5 py-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Student Name</span>
                    <span className="font-semibold text-gray-800">{result.studentName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Class Applied</span>
                    <span className="font-semibold text-gray-800">{result.classApplied}</span>
                  </div>
                  {result.remarks && result.remarks.trim() && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: cfg.border }}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Remarks from School</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.remarks}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section 2: Why Choose Us ─────────────────────────────────────────────────
function WhyChooseUs() {
  const reasons = [
    { icon: Award, title: "Academic Excellence", desc: "Consistent top results in board exams." },
    { icon: Users, title: "Qualified Teachers", desc: "Highly dedicated and experienced faculty." },
    { icon: BookOpen, title: "CBSE Curriculum", desc: "Holistic academics with co-curricular blend." },
    { icon: Star, title: "Safe Campus", desc: "Secure, welcoming environment for every child." },
    { icon: Bus, title: "Transport Facility", desc: "GPS-tracked buses on all major routes." },
    { icon: GraduationCap, title: "Extra-Curricular", desc: "Sports, music, art, drama, and debate." },
  ];
  return (
    <section id="why-choose-us" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Why Choose Our School?" subtitle="Our Strengths" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {reasons.map((r, i) => (
            <motion.div key={r.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all bg-white group">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${NAVY}12` }}>
                <r.icon className="h-6 w-6" style={{ color: NAVY }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-1">{r.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 3: Admission Procedure ──────────────────────────────────────────
function AdmissionProcedure() {
  const steps = [
    { title: "Registration / Application", desc: "Fill the online admission form with student and parent details.", icon: FileText },
    { title: "Document Submission", desc: "Submit required documents for verification at the school office.", icon: CheckCircle2 },
    { title: "Entrance Assessment", desc: "Age-appropriate interaction or written test by the school team.", icon: BookOpen },
    { title: "Fee Payment", desc: "Complete admission fee payment to confirm the enrollment.", icon: IndianRupee },
    { title: "Orientation & Joining", desc: "Attend orientation and receive schedule, books list and uniform details.", icon: GraduationCap },
    { title: "Admission Confirmed", desc: "Your child is officially enrolled — welcome to the school family!", icon: Award },
  ];
  return (
    <section id="procedure" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Admission Procedure" subtitle="Step by Step" />
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>{i + 1}</div>
                <s.icon className="h-4 w-4" style={{ color: GOLD }} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-1">{s.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 4: Documents Required ───────────────────────────────────────────
function DocumentsRequired() {
  const docs = [
    "Birth Certificate (Original + 2 Photocopies)",
    "Transfer Certificate from Previous School",
    "Last Class Mark Sheet / Progress Report",
    "Aadhaar Card of Student (Original + 1 Copy)",
    "Aadhaar Card of Father & Mother",
    "Passport Size Photographs — Student (4)",
    "Passport Size Photographs — Parents (2 each)",
    "Residence Proof (Electricity bill / Ration card)",
    "Caste Certificate (SC/ST/OBC if applicable)",
    "Medical Fitness Certificate",
  ];
  return (
    <section id="documents" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Documents Required" subtitle="Checklist" />
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-2 gap-3">
            {docs.map((doc, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{doc}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-amber-800 text-sm">📌 <strong>Note:</strong> All originals must be presented for verification. Photocopies will be retained by the school.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: Fee Information (Table) ──────────────────────────────────────
function FeeInformation({ info, currentSession }: { info?: AdmissionInfo; currentSession?: string }) {
  const parsed = safeParse(info?.admission_fee_info || "", { cols: DEFAULT_FEE_COLS, rows: DEFAULT_FEE_ROWS });
  const cols: FeeColumn[] = Array.isArray(parsed) ? DEFAULT_FEE_COLS : (parsed.cols ?? DEFAULT_FEE_COLS);
  const rows: FeeRow[] = Array.isArray(parsed) ? DEFAULT_FEE_ROWS : (parsed.rows ?? DEFAULT_FEE_ROWS);
  const thCls = "text-left text-white font-semibold px-5 py-3.5 text-xs uppercase tracking-wider";
  const yearLabel = currentSession ? `Academic Year ${currentSession}` : "Fee Structure";
  return (
    <section id="fee" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Fee Information" subtitle={yearLabel} />
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: NAVY }}>
                  <th className={thCls}>Class / Group</th>
                  {cols.map(col => (
                    <th key={col.id} className={thCls}>{col.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{row.classGroup}</td>
                    {cols.map(col => (
                      <td key={col.id} className="px-5 py-3.5 text-gray-700">{row.values[col.id] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">* Fees are subject to annual revision. Contact the school office for the most current fee structure.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section 6: School Timing ─────────────────────────────────────────────────
function SchoolTiming({ info }: { info?: AdmissionInfo }) {
  const rows: TimingRow[] = safeParse(info?.admission_timing || "", DEFAULT_TIMING_ROWS);
  return (
    <section id="timings" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="School Timing" subtitle="Academic Schedule" />
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {rows.map((row, i) => (
            <motion.div key={row.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="bg-[#f8f9fc] rounded-2xl p-5 border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${NAVY}15` }}>
                <Clock className="h-5 w-5" style={{ color: NAVY }} />
              </div>
              <div>
                <div className="font-semibold text-gray-800 text-sm">{row.day}</div>
                <div className="text-gray-500 text-xs mt-0.5">{row.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 7: Transport Facility ────────────────────────────────────────────
function TransportFacility({ info }: { info?: AdmissionInfo }) {
  const transport: TransportData = safeParse(info?.admission_transport || "", DEFAULT_TRANSPORT);
  return (
    <section id="transport" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Transport Facility" subtitle="School Bus Service" />
        <div className="grid md:grid-cols-2 gap-6">
          {/* Bus Routes */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: `${NAVY}08` }}>
              <Bus className="h-5 w-5" style={{ color: NAVY }} />
              <span className="font-bold text-gray-800">Bus Routes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {transport.routes.map(route => (
                <div key={route.id} className="flex items-center justify-between px-5 py-3 hover:bg-blue-50/30 transition-colors">
                  <span className="text-sm text-gray-700">{route.name}</span>
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{route.price}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Transport Features */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: `${NAVY}08` }}>
              <Award className="h-5 w-5" style={{ color: NAVY }} />
              <span className="font-bold text-gray-800">Transport Features</span>
            </div>
            <div className="p-5 space-y-3">
              {transport.features.map(feature => (
                <div key={feature.id} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{feature.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Section 8: Uniform Guidelines ───────────────────────────────────────────
function UniformGuidelines({ info }: { info?: AdmissionInfo }) {
  const uniform: UniformData = safeParse(info?.admission_uniform || "", DEFAULT_UNIFORM);
  const sections = [
    { key: "boys18" as keyof UniformData, label: "Boys (Class 1–8)", icon: User },
    { key: "girls18" as keyof UniformData, label: "Girls (Class 1–8)", icon: User },
    { key: "senior" as keyof UniformData, label: "Class 9–12 (All)", icon: GraduationCap },
    { key: "sports" as keyof UniformData, label: "Sports Uniform", icon: Award },
  ];
  return (
    <section id="uniform" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Uniform Guidelines" subtitle="School Dress Code" />
        <div className="grid md:grid-cols-2 gap-5">
          {sections.map(({ key, label, icon: Icon }, i) => (
            <motion.div key={key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-[#f8f9fc] rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5 bg-white">
                <Icon className="h-4 w-4" style={{ color: NAVY }} />
                <span className="font-bold text-gray-800 text-sm">{label}</span>
              </div>
              <ul className="p-5 space-y-2.5">
                {uniform[key].map(item => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <span className="text-[#c9a84c] font-bold shrink-0">•</span>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 9: FAQs ──────────────────────────────────────────────────────────
function FAQs() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q: "What is the age criterion for Nursery/LKG admission?", a: "A child must be at least 3 years old as of April 1st of the admission year for Nursery, and 4 years for LKG." },
    { q: "Is there an entrance test for admission?", a: "For Nursery to Class II, only an informal interaction. For Class III onwards, a basic assessment in English, Math, and relevant subjects is conducted." },
    { q: "When does the new academic session start?", a: "The academic session begins in April each year, following the CBSE calendar. Admissions are open from November to March." },
    { q: "Are mid-session admissions possible?", a: "Mid-session admissions are subject to seat availability. Please contact the admission office for current availability." },
    { q: "Is the registration fee refundable?", a: "The registration fee of ₹500 is non-refundable. The admission fee is refundable only if the application is not accepted by the school." },
    { q: "Does the school provide scholarships?", a: "Yes, merit-based scholarships and fee concessions are available for academically outstanding students and economically weaker sections." },
    { q: "How can I track my application status?", a: "After submitting, you will receive a confirmation. Contact the admission office with your reference number for status updates." },
    { q: "Are sibling discounts available?", a: "Yes, a 10% concession on tuition fees is provided for the second sibling enrolled in the school." },
  ];
  return (
    <section id="faqs" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Frequently Asked Questions" subtitle="FAQs" />
        <div className="max-w-3xl mx-auto space-y-2.5">
          {faqs.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}>
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: NAVY }} />
                  <span className="font-medium text-gray-800 text-sm">{faq.q}</span>
                </div>
                {open === i ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>
              {open === i && (
                <div className="px-5 pb-4 pt-3 text-sm text-gray-600 border-t border-gray-100 bg-blue-50/20 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 10a: Apply for Admission Form ────────────────────────────────────
function ApplyForm() {
  const { toast } = useToast();
  const EMPTY = {
    studentName: "", dateOfBirth: "", gender: "", fatherName: "", motherName: "",
    phone: "", alternatePhone: "", email: "", address: "", classApplied: "",
    previousSchool: "", previousClass: "", category: "General", religion: "", message: "",
  };
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentName.trim() || !form.phone.trim() || !form.classApplied) {
      toast({ title: "Student name, phone, and class applied are required.", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/admission/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) {
        const d = await res.json();
        const refNo = `APP-${String(d.id).padStart(5, "0")}`;
        setSubmittedRef(refNo);
        toast({ title: "Application submitted successfully!" });
        setForm(EMPTY);
      } else { const d = await res.json(); toast({ title: d.error || "Submission failed.", variant: "destructive" }); }
    } catch { toast({ title: "Network error. Please try again.", variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  return (
    <section id="apply-form" className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Apply for Admission" subtitle="Online Application" />
        <div className="max-w-3xl mx-auto">
          {submittedRef ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 border border-green-200 rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="font-bold text-green-800 text-xl mb-3">Application Submitted!</h3>
              <p className="text-green-700 text-sm mb-2">Our team will review and contact you within 2–3 working days.</p>
              <div className="inline-flex items-center gap-2 bg-white border border-green-300 rounded-xl px-5 py-3 mt-3 mb-6">
                <span className="text-sm text-gray-500">Your Reference Number:</span>
                <span className="font-mono font-bold text-lg text-green-700">{submittedRef}</span>
              </div>
              <p className="text-green-600 text-xs mb-6">Save this number to track your application status on the Admission page.</p>
              <Button variant="outline" className="border-green-600 text-green-700" onClick={() => setSubmittedRef(null)}>Submit Another</Button>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Student Details */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: `${NAVY}06` }}>
                <User className="h-4 w-4" style={{ color: NAVY }} />
                <span className="font-bold text-sm text-gray-700">Student Details</span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Student Full Name *</label><Input placeholder="As per birth certificate" value={form.studentName} onChange={upd("studentName")} required /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Date of Birth</label><Input type="date" value={form.dateOfBirth} onChange={upd("dateOfBirth")} /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Gender</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.gender} onChange={upd("gender")}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Class Applied For *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.classApplied} onChange={upd("classApplied")} required>
                    <option value="">Select Class</option>{CLASSES.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" value={form.category} onChange={upd("category")}>
                    <option>General</option><option>OBC</option><option>SC</option><option>ST</option><option>EWS</option>
                  </select></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Previous School</label><Input placeholder="If any" value={form.previousSchool} onChange={upd("previousSchool")} /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Last Class Attended</label><Input placeholder="e.g. Class 4" value={form.previousClass} onChange={upd("previousClass")} /></div>
              </div>

              {/* Parent Details */}
              <div className="px-6 py-4 border-y border-gray-100 flex items-center gap-2" style={{ backgroundColor: `${NAVY}06` }}>
                <Users className="h-4 w-4" style={{ color: NAVY }} />
                <span className="font-bold text-sm text-gray-700">Parent / Guardian Details</span>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Father's Name *</label><Input placeholder="Father's full name" value={form.fatherName} onChange={upd("fatherName")} required /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Mother's Name</label><Input placeholder="Mother's full name" value={form.motherName} onChange={upd("motherName")} /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Phone *</label><Input type="tel" placeholder="Mobile number" value={form.phone} onChange={upd("phone")} required /></div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Alternate Phone</label><Input type="tel" placeholder="Optional" value={form.alternatePhone} onChange={upd("alternatePhone")} /></div>
                <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Email</label><Input type="email" placeholder="Parent's email" value={form.email} onChange={upd("email")} /></div>
                <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Residential Address</label><Input placeholder="Full address" value={form.address} onChange={upd("address")} /></div>
                <div className="col-span-2"><label className="text-xs font-medium text-gray-500 mb-1 block">Message / Queries</label>
                  <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 h-20" placeholder="Any specific requirements..." value={form.message} onChange={upd("message")} /></div>
              </div>

              <div className="px-6 pb-6">
                <Button type="submit" disabled={submitting} className="w-full font-semibold text-white py-3" style={{ backgroundColor: NAVY }}>
                  {submitting ? "Submitting…" : <><Send className="h-4 w-4 mr-2 inline" /> Submit Application</>}
                </Button>
                <p className="text-xs text-gray-400 text-center mt-3">We'll contact you within 2–3 working days.</p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Section 10b: Contact Admission Office ────────────────────────────────────
function ContactOffice({ branding }: { branding?: SchoolBranding }) {
  return (
    <section id="contact-office" className="py-16 px-4" style={{ background: `linear-gradient(135deg, ${DARK}, ${NAVY})` }}>
      <div className="max-w-5xl mx-auto">
        <SectionHeader title="Contact Admission Office" subtitle="Get in Touch" light />
        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {[
            { icon: MapPin, label: "Address", value: branding?.school_address || "Visit Admin → Settings to update" },
            { icon: Phone, label: "Phone", value: branding?.school_contact_number || "Contact number" },
            { icon: Mail, label: "Email", value: branding?.school_email || "admin@school.edu" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${GOLD}30` }}>
                <Icon className="h-5 w-5" style={{ color: GOLD }} />
              </div>
              <div className="text-xs text-white/60 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-white text-sm font-medium">{value}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button size="lg" className="font-bold px-10 text-[#0f2045]" style={{ backgroundColor: GOLD }}
            onClick={() => document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth" })}>
            Apply Now
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdmissionPage() {
  const { data: info } = useQuery<AdmissionInfo>({
    queryKey: ["admissionInfo"],
    queryFn: () => fetch("/api/website/admission/info").then(r => r.json()),
  });
  const { data: branding } = useQuery<SchoolBranding>({
    queryKey: ["branding"],
    queryFn: () => fetch("/api/website/branding").then(r => r.json()),
  });
  const { data: sessionStatus } = useQuery<{ currentSession?: { name: string } | null }>({
    queryKey: ["academicSessionStatus"],
    queryFn: () => fetch("/api/academic-sessions/status").then(r => r.json()),
    staleTime: 60 * 1000,
  });
  const currentSession = sessionStatus?.currentSession?.name ?? undefined;

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky mini nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-13 py-2.5 flex items-center justify-between">
          <button className="font-bold text-base" style={{ color: NAVY }} onClick={() => window.location.href = "/"}>
            {branding?.school_name || "School Portal"}
          </button>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-gray-600 hover:text-[#1e3a6e] transition-colors">Home</a>
            <button className="text-sm font-medium text-white px-4 py-1.5 rounded-full"
              style={{ backgroundColor: NAVY }}
              onClick={() => document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth" })}>
              Apply Now
            </button>
          </div>
        </div>
      </nav>

      <AdmissionHero branding={branding} currentSession={currentSession} />
      <ReferenceSearch />
      <WhyChooseUs />
      <AdmissionProcedure />
      <DocumentsRequired />
      <FeeInformation info={info} currentSession={currentSession} />
      <SchoolTiming info={info} />
      <TransportFacility info={info} />
      <UniformGuidelines info={info} />
      <FAQs />
      <ApplyForm />
      <ContactOffice branding={branding} />
    </div>
  );
}
