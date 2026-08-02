import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Trophy, Lock, AlertCircle, ChevronDown, ChevronUp, Printer, ArrowLeft, BookOpen, CheckCircle2, XCircle, CreditCard, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StudentInfo {
  id: number;
  studentName: string;
  rollNo?: number;
  fatherName: string;
  motherName: string;
  className: string;
  sectionName: string;
}

interface SubjectMark {
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  theoryMarks?: string | null;
  practicalMarks?: string | null;
  internalMarks?: string | null;
  totalMarks?: string | null;
  maxMarks?: string;
  maxTheoryMarks?: string;
  maxPracticalMarks?: string;
  maxInternalMarks?: string;
  grade?: string | null;
  percentage?: string | null;
  isAbsent?: boolean;
  remarks?: string | null;
}

interface ExamResult {
  examId: number;
  examName: string;
  examType?: string;
  session?: string;
  held: boolean;
  subjects?: SubjectMark[];
  totalMarks?: string;
  maxMarks?: string;
  percentage?: string;
  grade?: string;
  gradePoint?: string;
  passFail?: string;
}

interface ResultsData {
  found: boolean;
  student?: StudentInfo;
  exams?: ExamResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  if (["A1", "A2"].includes(grade)) return "text-green-700 bg-green-50 border-green-300";
  if (["B1", "B2"].includes(grade)) return "text-blue-700 bg-blue-50 border-blue-300";
  if (["C1", "C2"].includes(grade)) return "text-yellow-700 bg-yellow-50 border-yellow-300";
  if (grade === "D") return "text-orange-700 bg-orange-50 border-orange-300";
  return "text-red-700 bg-red-50 border-red-300";
}

function pctBar(pct: number) {
  const color = pct >= 60 ? "bg-green-500" : pct >= 33 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────
function ExamCard({ exam }: { exam: ExamResult }) {
  const [open, setOpen] = useState(false);

  if (exam.held) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-800">{exam.examName}</div>
            {exam.session && <div className="text-xs text-gray-500">Session: {exam.session}</div>}
          </div>
        </div>
        <p className="text-sm text-amber-800 font-medium">Result Withheld</p>
        <p className="text-xs text-amber-700 mt-1">Please contact the school office to clear pending dues and unlock this result.</p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-800">
          <CreditCard className="h-3.5 w-3.5" />
          Clear dues to unlock
        </div>
      </div>
    );
  }

  const pct = parseFloat(exam.percentage || "0");
  const passed = exam.passFail === "pass";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Exam header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4fa0)` }}>
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div className="text-left min-w-0">
            <div className="font-semibold text-gray-800 truncate">{exam.examName}</div>
            <div className="text-xs text-gray-500">
              {[exam.examType, exam.session].filter(Boolean).join(" · ") || "Published"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold" style={{ color: NAVY }}>{pct.toFixed(1)}%</div>
            <div className={`text-xs font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>
              {passed ? "PASS" : "FAIL"}
            </div>
          </div>
          {exam.grade && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${gradeColor(exam.grade)}`}>
              {exam.grade}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {open && exam.subjects && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Summary row */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: NAVY }}>{pct.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">Overall</div>
                <div className="mt-1">{pctBar(pct)}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-700">{exam.totalMarks}/{exam.maxMarks}</div>
                <div className="text-xs text-gray-500">Total Marks</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${passed ? "text-green-600" : "text-red-600"}`}>
                  {passed ? "PASS" : "FAIL"}
                </div>
                <div className="text-xs text-gray-500">Result</div>
                {exam.gradePoint && <div className="text-xs text-gray-400 mt-0.5">GPA {exam.gradePoint}</div>}
              </div>
            </div>

            {/* Subject table */}
            <div className="px-5 pb-5">
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-white" style={{ background: NAVY }}>
                      <th className="text-left px-3 py-2 rounded-tl-lg">Subject</th>
                      <th className="px-3 py-2">Theory</th>
                      <th className="px-3 py-2">Practical</th>
                      <th className="px-3 py-2">Internal</th>
                      <th className="px-3 py-2 font-bold">Total</th>
                      <th className="px-3 py-2">%</th>
                      <th className="px-3 py-2 rounded-tr-lg">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.subjects.map((s, i) => {
                      const sPct = parseFloat(s.percentage || "0");
                      const maxT = parseFloat(s.maxTheoryMarks || "0");
                      const maxP = parseFloat(s.maxPracticalMarks || "0");
                      const maxI = parseFloat(s.maxInternalMarks || "0");
                      return (
                        <tr key={s.subjectId} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {s.subjectName}
                            {s.subjectCode && <span className="text-gray-400 text-xs ml-1">({s.subjectCode})</span>}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {s.isAbsent ? <span className="text-orange-500 font-semibold">AB</span>
                              : maxT > 0 ? `${s.theoryMarks ?? "—"}/${maxT}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {s.isAbsent ? "—" : maxP > 0 ? `${s.practicalMarks ?? "—"}/${maxP}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">
                            {s.isAbsent ? "—" : maxI > 0 ? `${s.internalMarks ?? "—"}/${maxI}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-gray-800">
                            {s.isAbsent ? <span className="text-orange-500">AB</span> : (s.totalMarks ?? "—")}
                            <span className="text-gray-400 font-normal text-xs">/{s.maxMarks}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {s.isAbsent ? "—" : pctBar(sPct)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {s.grade && !s.isAbsent
                              ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColor(s.grade)}`}>{s.grade}</span>
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const [, navigate] = useLocation();
  const [admissionNo, setAdmissionNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResultsData | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const no = admissionNo.trim();
    if (!no) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/website/results?admissionNo=${encodeURIComponent(no)}`);
      if (!res.ok) throw new Error("Server error. Please try again.");
      const json: ResultsData = await res.json();
      setData(json);
      if (!json.found) setError("No student found with this admission number. Please check and try again.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch results. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Student Result Portal</h1>
          <p className="text-white/70 text-sm max-w-lg mx-auto">
            Enter your Admission Number to view your published exam results and subject-wise marks.
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
              Your admission number (e.g. <span className="font-mono bg-gray-100 px-1 rounded">AG2024001</span>) can be found on your ID card or admission letter.
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

          {/* How to use steps */}
          {!data && !error && !loading && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">How to check your result</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: "1", label: "Enter Admission No.", desc: "Type your unique admission number above" },
                  { step: "2", label: "Click Search", desc: "Tap the Search button to fetch your results" },
                  { step: "3", label: "View Results", desc: "Browse your marks exam-wise and subject-wise" },
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
          {/* Student info card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${DARK}, ${NAVY})` }}>
                {data.student.studentName[0]}
              </div>
              <div>
                <div className="font-bold text-gray-800 text-lg">{data.student.studentName}</div>
                <div className="text-sm text-gray-500">
                  {[data.student.className, data.student.sectionName].filter(Boolean).join(" – ")}
                  {data.student.rollNo ? ` · Roll No. ${data.student.rollNo}` : ""}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 border-t border-gray-100 pt-3">
              {data.student.fatherName && (
                <div><span className="text-gray-400">Father: </span>{data.student.fatherName}</div>
              )}
              {data.student.motherName && (
                <div><span className="text-gray-400">Mother: </span>{data.student.motherName}</div>
              )}
            </div>
          </motion.div>

          {/* Exam results */}
          {data.exams && data.exams.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-600">{data.exams.length} Published Exam{data.exams.length !== 1 ? "s" : ""} Found</span>
              </div>
              {data.exams.map((exam, i) => (
                <motion.div key={exam.examId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <ExamCard exam={exam} />
                </motion.div>
              ))}
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No published results yet</p>
              <p className="text-sm text-gray-400 mt-1">Results will appear here once the school publishes your exam results.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400 pb-8 mt-4">
        Having trouble? Contact the school office for assistance.
      </div>
    </div>
  );
}
