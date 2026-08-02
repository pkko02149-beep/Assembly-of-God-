import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, CalendarClock, CheckCircle, Users } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";

interface Homework { id: number; title: string; subject: string; description: string; dueDate: string; className: string; teacherName?: string; }
interface Parent { id: number; students: { studentId: number; studentName: string }[]; }
interface StudentInfo { studentId: number; classId: number; }

export default function ParentHomework() {
  const [, navigate] = useLocation();
  const [parentData, setParentData] = useState<Parent | null>(null);
  const [studs, setStuds] = useState<StudentInfo[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [childLoading, setChildLoading] = useState(false);

  const loadHomeworkForIdx = useCallback(async (studsData: StudentInfo[], idx: number) => {
    const s = studsData[idx];
    if (!s?.classId) { setHomework([]); return; }
    const hw = await parentApi.get<Homework[]>(`/homework?classId=${s.classId}`);
    setHomework(hw);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    (async () => {
      try {
        const p = await parentApi.get<Parent>("/auth/parent/me");
        setParentData(p);
        const s = await parentApi.get<StudentInfo[]>(`/parents/${p.id}/students`);
        setStuds(s);
        await loadHomeworkForIdx(s, 0);
      } catch { navigate("/parent/login"); }
      finally { setLoading(false); }
    })();
  }, []);

  // Reload when child changes
  useEffect(() => {
    if (!parentData || loading) return;
    (async () => {
      setChildLoading(true);
      setHomework([]);
      try { await loadHomeworkForIdx(studs, selectedIdx); }
      catch { /* ignore */ }
      finally { setChildLoading(false); }
    })();
  }, [selectedIdx]);

  function getDueBadge(dueDate: string) {
    const d = new Date(dueDate);
    if (isPast(d) && !isToday(d)) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
    if (isToday(d)) return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Due Today</Badge>;
    if (isTomorrow(d)) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Due Tomorrow</Badge>;
    return <Badge variant="outline">Due {format(d, "MMM d")}</Badge>;
  }

  const upcoming = homework.filter(h => !isPast(new Date(h.dueDate)) || isToday(new Date(h.dueDate)));
  const past = homework.filter(h => isPast(new Date(h.dueDate)) && !isToday(new Date(h.dueDate)));

  const subjectColors: Record<string, string> = {
    Mathematics: "bg-blue-100 text-blue-700", English: "bg-purple-100 text-purple-700",
    Science: "bg-green-100 text-green-700", Hindi: "bg-orange-100 text-orange-700",
    "Social Studies": "bg-amber-100 text-amber-700",
  };

  const students = parentData?.students ?? [];
  const selectedName = students[selectedIdx]?.studentName || "";

  if (loading) return (
    <ParentLayout title="Homework">
      <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div>
    </ParentLayout>
  );

  return (
    <ParentLayout title="Homework">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Homework Assignments</h2>
        {!childLoading && (
          <p className="text-sm text-slate-500">
            {selectedName && <span>{selectedName} · </span>}
            {homework.length} total · {upcoming.length} pending
          </p>
        )}
      </div>

      {/* Child selector */}
      {students.length > 1 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
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

      {childLoading ? (
        <div className="flex justify-center h-40 items-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        </div>
      ) : homework.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No homework assigned yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Pending ({upcoming.length})</h3>
              <div className="space-y-3">
                {upcoming.map(h => (
                  <Card key={h.id} className="border-0 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-400">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-slate-800">{h.title}</h4>
                            <Badge className={`text-xs ${subjectColors[h.subject] || "bg-slate-100 text-slate-600"}`}>{h.subject}</Badge>
                          </div>
                          {h.description && <p className="text-sm text-slate-500 mb-2">{h.description}</p>}
                          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />Due {format(new Date(h.dueDate), "EEEE, MMM d")}</span>
                            {h.teacherName && <span>by {h.teacherName}</span>}
                          </div>
                        </div>
                        {getDueBadge(h.dueDate)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Completed / Past ({past.length})</h3>
              <div className="space-y-3">
                {past.map(h => (
                  <Card key={h.id} className="border-0 shadow-sm opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700">{h.title}</p>
                          <p className="text-xs text-slate-400">{h.subject} · Was due {format(new Date(h.dueDate), "MMM d")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ParentLayout>
  );
}
