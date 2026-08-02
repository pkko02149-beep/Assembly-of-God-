import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, CreditCard, User, Hash, ChevronRight, Loader2, AlertCircle, GraduationCap, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";

interface ClassOption {
  id: number;
  name: string;
}

interface StudentResult {
  id: number;
  uniqueId: string;
  rollNo: number | null;
  studentName: string;
  fatherName: string;
  className: string | null;
  sectionName: string | null;
  classId: number | null;
  photoUrl: string | null;
  previousYearDue: string | null;
  previousYearDueRemarks: string | null;
  hasVehicle: boolean | null;
  transportFromMonth: number | null;
  transportStopMonth: number | null;
  transportRoutePricePerMonth: number | null;
  studentType: string | null;
}

type SearchMode = "admission" | "name";

export default function FeePaymentSearch() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<SearchMode>("admission");

  const [admissionNo, setAdmissionNo] = useState("");
  const [studentName, setStudentName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StudentResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then(setClasses).catch(() => {});
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      let url = "/api/students/public/search?";
      if (mode === "admission") {
        if (!admissionNo.trim()) { setError("Please enter an admission number."); setLoading(false); return; }
        url += `uniqueId=${encodeURIComponent(admissionNo.trim())}`;
      } else {
        if (!studentName.trim()) { setError("Please enter a student name."); setLoading(false); return; }
        url += `name=${encodeURIComponent(studentName.trim())}`;
        if (fatherName.trim()) url += `&fatherName=${encodeURIComponent(fatherName.trim())}`;
        if (classId) url += `&classId=${encodeURIComponent(classId)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Student not found.");
        return;
      }
      const data: StudentResult[] = await res.json();
      if (!data.length) {
        setError("No student found. Please check the details and try again.");
      } else {
        setResults(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#f8f9fc" }}>
      {/* Top bar */}
      <div className="text-white text-xs py-2 px-4 flex justify-between items-center" style={{ background: DARK }}>
        <span>School Fee Portal</span>
        <button onClick={() => navigate("/")} className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
          <ArrowLeft className="h-3 w-3" /> Back to Home
        </button>
      </div>

      {/* Hero */}
      <div className="text-white py-10 px-4" style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` }}>
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 border border-white/20 mb-4">
            <CreditCard className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">Fee Payment</h1>
          <p className="text-white/60 mt-1 text-sm">Search for your ward's fee details and pay online</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-5 pb-16">
        {/* Mode Toggle */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 mb-4 shadow-sm">
          <button
            onClick={() => { setMode("admission"); setResults(null); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "admission" ? "text-white shadow" : "text-slate-500 hover:text-slate-700"
            }`}
            style={mode === "admission" ? { background: NAVY } : {}}
          >
            <Hash className="w-4 h-4" />
            Admission No.
          </button>
          <button
            onClick={() => { setMode("name"); setResults(null); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === "name" ? "text-white shadow" : "text-slate-500 hover:text-slate-700"
            }`}
            style={mode === "name" ? { background: NAVY } : {}}
          >
            <User className="w-4 h-4" />
            Name &amp; Class
          </button>
        </div>

        {/* Search Form */}
        <Card className="border-0 shadow-md mb-5">
          <CardContent className="p-5">
            <form onSubmit={handleSearch} className="space-y-4">
              {mode === "admission" ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Admission / Enrollment Number
                  </label>
                  <input
                    type="text"
                    value={admissionNo}
                    onChange={e => setAdmissionNo(e.target.value)}
                    placeholder="e.g. X-A-001"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": NAVY } as any}
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1">Enter the enrollment ID printed on your fee receipt or ID card</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder="Enter student's full name"
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Father's Name <span className="text-slate-400 font-normal">(optional — helps narrow results)</span>
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={e => setFatherName(e.target.value)}
                      placeholder="Enter father's name"
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class <span className="text-slate-400 font-normal">(optional)</span></label>
                    <select
                      value={classId}
                      onChange={e => setClassId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                    >
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:bg-slate-300 disabled:text-slate-400 transition-colors"
                style={!loading ? { background: NAVY } : {}}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Searching…" : "Search Student"}
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {results && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              {results.length} student{results.length > 1 ? "s" : ""} found — tap to view fee details
            </p>
            {results.map(student => (
              <button
                key={student.id}
                onClick={() => {
                  sessionStorage.setItem(`fee_student_${student.id}`, JSON.stringify(student));
                  navigate(`/fee-payment/student/${student.id}`);
                }}
                className="w-full text-left"
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} alt={student.studentName} className="w-full h-full object-cover" />
                      ) : (
                        <GraduationCap className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{student.studentName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[student.className, student.sectionName].filter(Boolean).join(" — ")}
                        {student.rollNo ? ` · Roll ${student.rollNo}` : ""}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Father: {student.fatherName} · ID: {student.uniqueId}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
