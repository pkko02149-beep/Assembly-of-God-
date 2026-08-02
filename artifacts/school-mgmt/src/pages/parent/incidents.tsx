import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Users } from "lucide-react";
import { format } from "date-fns";

interface FirRecord {
  id: number;
  studentId: number;
  studentName: string;
  className: string;
  teacherName: string;
  incidentDate: string;
  description: string;
  actionTaken: string;
  severity: string;
  status: string;
  createdAt: string;
}
interface Parent {
  id: number;
  fatherName: string;
  motherName: string;
  students: { studentId: number; studentName: string }[];
}

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  minor:    { label: "Minor",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  major:    { label: "Major",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-200" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  open:     { label: "Open",     icon: Clock,         className: "bg-amber-100 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", icon: CheckCircle2,  className: "bg-green-100 text-green-700 border-green-200" },
};

export default function ParentIncidents() {
  const [, navigate] = useLocation();
  const [parentData, setParentData] = useState<Parent | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [records, setRecords] = useState<FirRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(false);

  const loadIncidentsForIdx = useCallback(async (p: Parent, idx: number) => {
    const student = p.students?.[idx];
    if (!student) { setRecords([]); return; }
    const firs = await parentApi.get<FirRecord[]>(`/fir?studentId=${student.studentId}`);
    setRecords(firs);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    (async () => {
      try {
        const p = await parentApi.get<Parent>("/auth/parent/me");
        setParentData(p);
        await loadIncidentsForIdx(p, 0);
      } catch {
        navigate("/parent/login");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reload when child changes
  useEffect(() => {
    if (!parentData || loading) return;
    (async () => {
      setChildLoading(true);
      setRecords([]);
      try { await loadIncidentsForIdx(parentData, selectedIdx); }
      catch { /* ignore */ }
      finally { setChildLoading(false); }
    })();
  }, [selectedIdx]);

  if (loading) return (
    <ParentLayout title="Incident Records">
      <div className="flex justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" />
      </div>
    </ParentLayout>
  );

  const students = parentData?.students ?? [];
  const studentName = students[selectedIdx]?.studentName || "";
  const openCount = records.filter(r => r.status === "open").length;
  const resolvedCount = records.filter(r => r.status === "resolved").length;

  return (
    <ParentLayout title="Incident Records">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">FIR / Incident Records</h2>
            <p className="text-sm text-slate-500">
              {studentName ? `Incidents reported for ${studentName}` : "All incident records"}
            </p>
          </div>
        </div>

        {/* Child selector */}
        {students.length > 1 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500 shrink-0">Child:</span>
            {students.map((s, i) => (
              <button
                key={s.studentId}
                onClick={() => setSelectedIdx(i)}
                disabled={childLoading}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  i === selectedIdx
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {s.studentName}
              </button>
            ))}
            {childLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          </div>
        )}

        {/* Summary badges */}
        {!childLoading && records.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5">
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">{records.length} Total</span>
            </div>
            {openCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">{openCount} Open</span>
              </div>
            )}
            {resolvedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{resolvedCount} Resolved</span>
              </div>
            )}
          </div>
        )}
      </div>

      {childLoading ? (
        <div className="flex justify-center h-40 items-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        </div>
      ) : records.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No incidents on record</p>
            <p className="text-slate-400 text-sm mt-1">
              {studentName ? `${studentName} has a clean incident record.` : "Clean record — no incidents reported."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {records.map(record => {
            const severityConfig = SEVERITY_CONFIG[record.severity] ?? SEVERITY_CONFIG.minor;
            const statusConfig = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.open;
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={record.id} className="border-0 shadow-sm overflow-hidden">
                {/* Top accent bar by severity */}
                <div className={`h-1 w-full ${
                  record.severity === "critical" ? "bg-red-500" :
                  record.severity === "major" ? "bg-orange-400" : "bg-yellow-400"
                }`} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs font-semibold border ${severityConfig.className}`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {severityConfig.label}
                      </Badge>
                      <Badge className={`text-xs font-medium border ${statusConfig.className}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 mt-0.5">
                      {format(new Date(record.incidentDate), "dd MMM yyyy")}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Incident Description</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{record.description}</p>
                    </div>

                    {record.actionTaken && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Action Taken</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{record.actionTaken}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="text-xs text-slate-400">
                      {record.teacherName && <span>Reported by <span className="font-medium text-slate-500">{record.teacherName}</span></span>}
                      {record.className && <span className="ml-2">· Class <span className="font-medium text-slate-500">{record.className}</span></span>}
                    </div>
                    <span className="text-xs text-slate-400">#{record.id}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ParentLayout>
  );
}
