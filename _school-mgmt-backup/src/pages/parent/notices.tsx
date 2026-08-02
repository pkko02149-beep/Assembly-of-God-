import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import ParentLayout from "@/components/ParentLayout";
import { parentApi } from "@/lib/jwt-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2, Megaphone } from "lucide-react";
import { format } from "date-fns";

interface Notice {
  id: number; title: string; content: string; targetRole: string;
  authorRole: string; authorId?: number; teacherName?: string;
  classId?: number | null; isActive: boolean; createdAt: string;
}
interface StudentInfo { classId: number; }

export default function ParentNotices() {
  const [, navigate] = useLocation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("parent_token")) { navigate("/parent/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const parent = await parentApi.get<{ id: number; students: { studentId: number }[] }>("/auth/parent/me");

      // Fetch all active parent-targeted notices
      const all = await parentApi.get<Notice[]>("/notices?isActive=true&targetRole=parents");

      // Try to get student's classId so we can show class-specific teacher notices
      let studentClassId: number | null = null;
      if (parent.students?.length > 0) {
        try {
          const studs = await parentApi.get<StudentInfo[]>(`/parents/${parent.id}/students`);
          studentClassId = studs[0]?.classId ?? null;
        } catch { /* no students yet */ }
      }

      // Filtering rules:
      // 1. Admin notices: show if classId is null/undefined (all parents) OR classId matches student's class
      // 2. Teacher notices: show only if classId matches student's class (teacher sent to that specific class)
      const filtered = all.filter(n => {
        if (n.authorRole === "admin") {
          return !n.classId || n.classId === studentClassId;
        }
        if (n.authorRole === "teacher") {
          return studentClassId !== null && n.classId === studentClassId;
        }
        return false;
      });

      setNotices(filtered);
    } catch { navigate("/parent/login"); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <ParentLayout title="Notices">
      <div className="flex justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mt-20" /></div>
    </ParentLayout>
  );

  return (
    <ParentLayout title="Notices">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">School Notices</h2>
        <p className="text-sm text-slate-500">{notices.length} active notices</p>
      </div>

      {notices.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notices available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map(n => (
            <Card
              key={n.id}
              className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setExpanded(expanded === n.id ? null : n.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.authorRole === "teacher" ? "bg-amber-100" : "bg-blue-100"}`}>
                    <Bell className={`w-4 h-4 ${n.authorRole === "teacher" ? "text-amber-600" : "text-blue-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-slate-800">{n.title}</h4>
                      {n.authorRole === "teacher" ? (
                        <Badge className="bg-amber-50 text-amber-700 text-xs hover:bg-amber-50">Class Notice</Badge>
                      ) : (
                        <Badge className="bg-blue-50 text-blue-600 text-xs hover:bg-blue-50">
                          {n.classId ? "Class" : "All Parents"}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm text-slate-600 ${expanded === n.id ? "" : "line-clamp-2"}`}>{n.content}</p>
                    {n.content.length > 100 && (
                      <button className="text-xs text-blue-500 mt-1 hover:underline">
                        {expanded === n.id ? "Show less" : "Read more"}
                      </button>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{format(new Date(n.createdAt), "MMMM d, yyyy 'at' h:mm a")}</span>
                      {n.authorRole === "teacher"
                        ? <span>by Class Teacher{n.teacherName ? ` (${n.teacherName})` : ""}</span>
                        : <span>by Administration</span>
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ParentLayout>
  );
}
