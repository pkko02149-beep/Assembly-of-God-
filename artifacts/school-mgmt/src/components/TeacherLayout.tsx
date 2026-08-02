import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { clearToken, getUser } from "@/lib/jwt-api";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, ClipboardCheck, BookOpen,
  Bell, Calendar, LogOut, Menu, X, GraduationCap,
  FileText, ClipboardList, Trophy, ScanLine, ShieldAlert, Lock, ArrowUpCircle,
  UserPlus, Sparkles, KeyRound, FolderOpen, Gift,
} from "lucide-react";
import { teacherApi } from "@/lib/jwt-api";
import ForceChangePasswordModal from "@/components/ForceChangePasswordModal";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  locked?: boolean;
};

const baseNavItems: NavItem[] = [
  { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/students", label: "My Students", icon: Users },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/teacher/scanner", label: "Scan QR", icon: ScanLine },
  { href: "/teacher/homework", label: "Homework", icon: BookOpen },
  { href: "/teacher/marks", label: "Results", icon: Trophy },
  { href: "/teacher/timetable", label: "Timetable", icon: Calendar },
  { href: "/teacher/notices", label: "Notices", icon: Bell },
  { href: "/teacher/leave", label: "Leave Request", icon: FileText },
  { href: "/teacher/fir", label: "FIR Register", icon: ClipboardList },
  { href: "/teacher/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/teacher/occasional-collection", label: "Occasional Collection", icon: Gift },
  { href: "/teacher/downloads", label: "Downloads", icon: FolderOpen },
  { href: "/teacher/ai-assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/teacher/change-password", label: "Change Password", icon: KeyRound },
];

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function TeacherLayout({ children, title }: Props) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [promotionAuthorized, setPromotionAuthorized] = useState(false);
  const [promotionStatusLoaded, setPromotionStatusLoaded] = useState(false);
  const [admissionLocked, setAdmissionLocked] = useState(true);
  const [admissionStatusLoaded, setAdmissionStatusLoaded] = useState(false);
  const [showForceChange, setShowForceChange] = useState(false);

  function handleLogout() {
    clearToken("teacher");
    navigate("/teacher/login");
  }

  const teacher = (() => {
    try { return JSON.parse(localStorage.getItem("teacher_user") || "{}"); } catch { return {}; }
  })();

  // Show force-change modal if mustChangePassword is true
  useEffect(() => {
    const user = getUser<{ mustChangePassword?: boolean }>("teacher");
    if (user?.mustChangePassword) setShowForceChange(true);
  }, []);

  useEffect(() => {
    teacherApi.get<{ authorized: boolean }>("/teacher-promotion/status")
      .then((status) => setPromotionAuthorized(status.authorized))
      .catch(() => setPromotionAuthorized(false))
      .finally(() => setPromotionStatusLoaded(true));

    teacherApi.get<{ effectivelyLocked: boolean }>("/teacher-admission-permission/my-status")
      .then((status) => setAdmissionLocked(status.effectivelyLocked))
      .catch(() => setAdmissionLocked(true))
      .finally(() => setAdmissionStatusLoaded(true));
  }, []);

  const navItems = [
    ...baseNavItems.slice(0, 2),
    {
      href: "/teacher/student-records",
      label: "Student Records",
      icon: UserPlus,
      locked: admissionStatusLoaded && admissionLocked,
    },
    {
      href: "/teacher/promotion",
      label: "Year-End Promotion",
      icon: ArrowUpCircle,
      locked: promotionStatusLoaded && !promotionAuthorized,
    },
    ...baseNavItems.slice(2),
  ];

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Teacher Portal</p>
            <p className="text-sm font-semibold truncate max-w-[140px]">{teacher.name || "Teacher"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, locked }) => {
          const active = location === href;
          return (
            <button
              key={href}
              disabled={locked}
              title={locked ? "Promotion access has not been granted by an administrator" : undefined}
              onClick={() => {
                if (locked) return;
                navigate(href); setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? "bg-amber-500 text-slate-900"
                  : locked
                    ? "text-slate-500 cursor-not-allowed"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {locked && <Lock className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-slate-500">Subject</p>
          <p className="text-sm text-slate-300 font-medium">{teacher.subject || "—"}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
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
      <ForceChangePasswordModal
        role="teacher"
        open={showForceChange}
        onDone={() => setShowForceChange(false)}
      />

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 h-14 flex items-center gap-3 shrink-0">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-slate-800">{title || "Teacher Portal"}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
