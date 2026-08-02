import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserCircle2, School, BookOpen, Calendar, Hash, User, Users } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-slate-800 flex-1">{value}</span>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams<{ enrollmentId: string }>();
  const enrollmentId = decodeURIComponent(params.enrollmentId || "");

  const { data: student, isLoading, isError } = useQuery<any>({
    queryKey: ["public-student", enrollmentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/public/${encodeURIComponent(enrollmentId)}`);
      if (!res.ok) throw new Error("Student not found");
      return res.json();
    },
    enabled: !!enrollmentId,
    retry: 1,
  });

  const { data: schoolInfo } = useQuery<any>({
    queryKey: ["school-info-public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/school-info");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 300_000,
  });

  const school = schoolInfo ?? {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading student profile…</p>
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle2 className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Student Not Found</h1>
          <p className="text-sm text-slate-500">No student found with enrollment ID <span className="font-mono font-semibold">{enrollmentId}</span>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* School header */}
      <div className="bg-slate-800 text-white">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded-full bg-white p-0.5 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 text-xl font-black shrink-0">
              {(school.schoolName || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-black uppercase tracking-wide text-sm leading-tight truncate">{school.schoolName || "School"}</h1>
            {school.address && <p className="text-[11px] text-slate-400 truncate">{school.address}</p>}
          </div>
        </div>
        <div className="bg-amber-500 text-slate-950 text-center text-[10px] font-bold tracking-widest uppercase py-0.5">
          Student Profile — Verified Record
        </div>
      </div>

      {/* Profile card */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Photo + name banner */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-5 py-5 flex items-center gap-4">
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.studentName}
                className="w-20 h-24 object-cover rounded-xl border-2 border-white/30 shrink-0"
              />
            ) : (
              <div className="w-20 h-24 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                <UserCircle2 className="w-12 h-12 text-white/40" />
              </div>
            )}
            <div>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-0.5">Student Name</p>
              <h2 className="text-lg font-black text-white leading-tight">{student.studentName}</h2>
              {student.fatherName && <p className="text-sm text-slate-300 mt-0.5">S/o {student.fatherName}</p>}
              <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-0.5">
                <Hash className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 text-xs font-bold">{student.uniqueId}</span>
              </div>
            </div>
          </div>

          {/* Academic details */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Academic Details</span>
            </div>
            <InfoRow label="Class" value={student.className} />
            <InfoRow label="Section" value={student.sectionName} />
            <InfoRow label="Roll Number" value={student.rollNo ? String(student.rollNo) : null} />
            <InfoRow label="Session" value={student.session} />
            <InfoRow label="Student Type" value={student.studentType} />
            <InfoRow label="Admission Date" value={student.admissionDate} />
          </div>
        </div>

        {/* Personal details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Personal Details</span>
          </div>
          <InfoRow label="Date of Birth" value={student.dateOfBirth} />
          <InfoRow label="Gender" value={student.gender} />
          <InfoRow label="Category" value={student.category} />
        </div>

        {/* Family details */}
        {(student.fatherName || student.motherName) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Family</span>
            </div>
            <InfoRow label="Father's Name" value={student.fatherName} />
            <InfoRow label="Mother's Name" value={student.motherName} />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 pb-4">
          <p>This profile is publicly visible via QR code scan.</p>
          {school.receiptFooter && <p className="mt-1">{school.receiptFooter}</p>}
        </div>
      </div>
    </div>
  );
}
