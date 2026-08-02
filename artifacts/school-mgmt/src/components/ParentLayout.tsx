import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { clearToken, getUser } from "@/lib/jwt-api";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, CalendarCheck, BookOpen, BarChart2,
  FileText, Bell, LogOut, Menu, Users, CreditCard, ClipboardList, Calendar, ShieldAlert, Receipt, Sparkles, KeyRound, FolderDown,
} from "lucide-react";
import ParentFirstLoginModal from "@/components/ParentFirstLoginModal";

const navItems = [
  { href: "/parent", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parent/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/parent/timetable", label: "Time Table", icon: Calendar },
  { href: "/parent/homework", label: "Homework", icon: BookOpen },
  { href: "/parent/results", label: "Exam Results", icon: BarChart2 },
  { href: "/parent/admit-card", label: "Admit Card", icon: ClipboardList },
  { href: "/parent/fees", label: "Fee Status", icon: CreditCard },
  { href: "/parent/fir", label: "Fee Register", icon: Receipt },
  { href: "/parent/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/parent/notices", label: "Notices", icon: Bell },
  { href: "/parent/downloads", label: "Downloads", icon: FolderDown },
  { href: "/parent/leave", label: "Leave Request", icon: FileText },
  { href: "/parent/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/parent/change-password", label: "Change Password", icon: KeyRound },
];

interface Props { children: React.ReactNode; title?: string; }

export default function ParentLayout({ children, title }: Props) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showForceChange, setShowForceChange] = useState(false);

  useEffect(() => {
    const user = getUser<{ mustChangePassword?: boolean }>("parent");
    if (user?.mustChangePassword) setShowForceChange(true);
  }, []);

  function handleLogout() {
    clearToken("parent");
    navigate("/parent/login");
  }

  const parent = (() => {
    try { return JSON.parse(localStorage.getItem("parent_user") || "{}"); } catch { return {}; }
  })();
  const displayName = parent.fatherName || parent.motherName || "Parent";

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-blue-950 text-white">
      <div className="p-5 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-400 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-950" />
          </div>
          <div>
            <p className="text-xs text-blue-300 font-medium uppercase tracking-wider">Student / Parent Portal</p>
            <p className="text-sm font-semibold truncate max-w-[140px]">{displayName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <button
              key={href}
              onClick={() => { navigate(href); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? "bg-blue-400 text-blue-950"
                  : "text-blue-200 hover:bg-blue-900 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-blue-800">
        {parent.students?.length > 0 && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-blue-400">Student(s)</p>
            {parent.students?.slice(0, 2).map((s: { studentId: number; studentName: string }) => (
              <p key={s.studentId} className="text-sm text-blue-200 font-medium truncate">{s.studentName}</p>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-blue-300 hover:text-white hover:bg-blue-900"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <ParentFirstLoginModal
        open={showForceChange}
        onDone={() => setShowForceChange(false)}
      />

      <div className="hidden md:flex w-60 shrink-0 flex-col border-r border-blue-900">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 h-14 flex items-center gap-3 shrink-0">
          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800">{title || "Student / Parent Portal"}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
