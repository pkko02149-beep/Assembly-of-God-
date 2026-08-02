import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, GraduationCap } from "lucide-react";

interface CertData {
  studentName: string;
  admissionNumber: string;
  certificateType: string;
  status: string;
  issuedAt: string | null;
  remarks: string | null;
  schoolName?: string;
}

const CERT_LABEL: Record<string, string> = {
  bonafide: "Bonafide Certificate",
  character: "Character Certificate",
  leaving: "School Leaving Certificate",
};

export default function VerifyCertificatePage() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const adm = params.get("adm") || "";
  const type = params.get("type") || "";
  const certNo = params.get("no") || "";
  const displayName = params.get("name") || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CertData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!adm || !type) {
      setError("Invalid verification link — missing certificate details.");
      setLoading(false);
      return;
    }
    fetch(`/api/verify/certificate?adm=${encodeURIComponent(adm)}&type=${encodeURIComponent(type)}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          setData(json.data);
        } else {
          setError(json.error || "Certificate not found in school records.");
        }
      })
      .catch(() => setError("Unable to reach school server. Please try again."))
      .finally(() => setLoading(false));
  }, [adm, type]);

  function fmt(ts: string | null) {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }); }
    catch { return ts; }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-5 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-blue-200 flex-shrink-0" />
          <div>
            <h1 className="text-white font-bold text-xl">Certificate Verification</h1>
            <p className="text-blue-200 text-sm">Official School Record Lookup</p>
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 text-sm">Verifying certificate…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-14 w-14 text-red-500" />
              <h2 className="text-xl font-bold text-red-700">Not Verified</h2>
              <p className="text-slate-500 text-sm max-w-sm">{error}</p>
              {certNo && (
                <p className="text-xs text-slate-400 mt-1">Certificate No: <span className="font-mono">{certNo}</span></p>
              )}
            </div>
          )}

          {!loading && data && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
                <h2 className="text-xl font-bold text-green-700">Certificate Verified ✓</h2>
                <p className="text-slate-500 text-sm text-center">
                  This certificate is recorded in the school's official register.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-sm">
                <Row label="Certificate Type" value={CERT_LABEL[data.certificateType] || data.certificateType} highlight />
                <Row label="Student Name" value={data.studentName || displayName || "—"} />
                <Row label="Admission No." value={data.admissionNumber} />
                {certNo && <Row label="Certificate No." value={certNo} />}
                <Row label="Status" value={data.status === "issued" ? "Issued ✓" : data.status} />
                <Row label="Issued On" value={fmt(data.issuedAt)} />
                {data.schoolName && <Row label="Issued By" value={data.schoolName} />}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                <GraduationCap className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  This record has been verified against the school's live database. 
                  If you believe this is incorrect, please contact the school office.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex px-4 py-3 gap-2 ${highlight ? "bg-blue-50" : ""}`}>
      <span className="text-slate-500 font-medium w-36 shrink-0">{label}</span>
      <span className={`font-semibold ${highlight ? "text-blue-800" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}
