import { useState, useEffect, useCallback, Component, type ReactNode } from "react";
import { useLocation } from "wouter";
import { getAuthStatus, setAuthStatus, setAdminToken, isAdmin, canAccessTab, getStaffUser, clearStaffUser } from "@/lib/auth";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  LogOut, Users, Settings, Shield, MessageSquare, CalendarCheck, QrCode, ScanLine,
  Mail, ClipboardList, CreditCard, IndianRupee, UserCheck, FileText, TrendingDown,
  GraduationCap, BookOpen, Calendar, Globe, ClipboardCheck, ShieldAlert, CalendarRange,
  Menu, X, Sparkles, Download, Gift,
} from "lucide-react";
import SetupWizard from "./setup-wizard";
import RecordsTab from "./records-tab";
import RecordListTab from "./record-list-tab";
import SettingsTab from "./settings-tab";
import SecurityTab from "./security-tab";
import BulkNotifyTab from "./bulk-notify-tab";
import BulkEmailTab from "./bulk-email-tab";
import QrCodesTab from "./qr-codes-tab";
import IdCardsTab from "./id-cards-tab";
import FeesTab from "./fees-tab";
import StudentStatusTab from "./student-status-tab";
import StudentPanelTab from "./student-panel-tab";
import ExpenditureTab from "./expenditure-tab";
import AttendanceGroupTab from "./attendance-group-tab";
import TeacherManagementTab from "./teacher-management-tab";
import ExamManagementTab from "./exam-management-tab";
import ParentsTab from "./parents-tab";
import TimetableManagementTab from "./timetable-management-tab";
import WebsiteSetupTab, { DownloadsTab } from "./website-setup-tab";
import AdmissionTab from "./admission-tab";
import FirTab from "./fir-tab";
import AcademicSessionsTab from "./academic-sessions-tab";
import CreateSessionModal from "@/components/CreateSessionModal";
import AdminAiAssistantTab from "./ai-assistant-tab";
import HomeworkStatusTab from "./homework-status-tab";
import OccasionalCollectionTab from "./occasional-collection-tab";

// ─── Error Boundary ───────────────────────────────────────────────────────────
class TabErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown, info: unknown) {
    console.error("Tab render error:", err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 text-center space-y-2">
          <p className="font-semibold text-red-700 dark:text-red-400">Something went wrong loading this tab</p>
          <p className="text-sm text-red-500 font-mono">{this.state.error}</p>
          <button
            className="mt-2 px-4 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700"
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ALL_TABS = [
  "fees", "records", "record-list", "student-status", "student-panel",
  "expenditure", "bulk-email", "notify", "qr-codes", "id-cards",
  "attendance-group", "teacher-management", "exam-management", "timetable", "homework-status", "parents",
  "admission", "incidents", "website-setup", "downloads", "settings", "security", "academic-sessions",
  "ai-assistant", "occasional-collection",
];

interface SessionStatus {
  hasSessions: boolean;
  currentSession: { id: number; name: string; schemaName: string } | null;
  sessions: Array<{ id: number; name: string; isCurrent: boolean }>;
}

// ─── Nav item definitions ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { value: "fees",               label: "Fee Collection & Details", Icon: IndianRupee,   color: "text-teal-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "records",            label: "Take Admission",           Icon: Users,         color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "record-list",        label: "Record List",              Icon: ClipboardList, color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "student-status",     label: "Student Status",           Icon: UserCheck,     color: "text-indigo-400", check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "student-panel",      label: "Certificates",             Icon: FileText,      color: "text-violet-400", check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "admission",          label: "Admission Inquiry",        Icon: ClipboardCheck,color: "text-green-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "expenditure",        label: "Expenditure",              Icon: TrendingDown,  color: "text-rose-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "bulk-email",         label: "Bulk Email",               Icon: Mail,          color: "text-blue-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "notify",             label: "Bulk Notify",              Icon: MessageSquare, color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "qr-codes",           label: "QR Codes & Scanner",       Icon: QrCode,        color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "id-cards",           label: "ID Cards",                 Icon: CreditCard,    color: "text-blue-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "attendance-group",   label: "Attendance",               Icon: CalendarCheck, color: "text-green-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "teacher-management", label: "Teacher Management",       Icon: GraduationCap, color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "exam-management",    label: "Exam Management",          Icon: BookOpen,      color: "text-purple-400", check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "timetable",          label: "Timetable",                Icon: Calendar,      color: "text-teal-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "homework-status",   label: "Homework Status",          Icon: BookOpen,      color: "text-violet-400", check: (admin: boolean, _tab: string) => admin },
  { value: "parents",            label: "Parents Management",       Icon: Users,         color: "text-blue-400",   check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "incidents",          label: "Incidents",                Icon: ShieldAlert,   color: "text-rose-400",   check: (admin: boolean, _tab: string) => admin },
  { value: "website-setup",      label: "Website Setup",            Icon: Globe,         color: "text-yellow-400", check: (admin: boolean, _tab: string) => admin },
  { value: "downloads",          label: "Downloads",                Icon: Download,      color: "text-orange-400", check: (admin: boolean, _tab: string) => admin },
  { value: "settings",           label: "Settings",                 Icon: Settings,      color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "security",           label: "Security",                 Icon: Shield,        color: "text-amber-400",  check: (admin: boolean, tab: string) => admin || canAccessTab(tab) },
  { value: "academic-sessions",  label: "Academic Sessions",        Icon: CalendarRange, color: "text-amber-400",  check: (admin: boolean, _tab: string) => admin },
  { value: "ai-assistant",       label: "AI Assistant",             Icon: Sparkles,      color: "text-violet-400", check: (admin: boolean, _tab: string) => admin },
  { value: "occasional-collection", label: "Occasional Collection",  Icon: Gift,          color: "text-fuchsia-400", check: (admin: boolean, _tab: string) => admin },
] as const;

export default function AdminDashboard() {
  const [location, setLocation] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showWizard, setShowWizard] = useState<boolean | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");

  const refreshSessionStatus = useCallback(() => {
    fetch("/api/academic-sessions/status")
      .then((r) => r.json())
      .then((data: SessionStatus) => {
        setSessionStatus(data);
        if (!data.hasSessions) {
          setShowCreateSession(true);
        }
      })
      .catch(() => {
        setSessionStatus({ hasSessions: true, currentSession: null, sessions: [] });
      });
  }, []);

  useEffect(() => {
    if (!getAuthStatus()) {
      setLocation("/login");
      return;
    }
    setShowWizard(false);

    fetch("/api/settings/school-info")
      .then((r) => r.json())
      .then((d) => { if (d?.schoolName) setSchoolName(d.schoolName); })
      .catch(() => {});

    if (!isAdmin()) {
      setSessionStatus({ hasSessions: true, currentSession: null, sessions: [] });
      return;
    }

    refreshSessionStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, setLocation]);

  if (!getAuthStatus()) return null;

  const confirmLogout = () => {
    setAuthStatus(false);
    setAdminToken(null);
    clearStaffUser();
    setLocation("/login");
  };

  if (showWizard === null || sessionStatus === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (showWizard) {
    return <SetupWizard onComplete={() => setShowWizard(false)} />;
  }

  const admin = isAdmin();
  const staffUser = !admin ? getStaffUser() : null;
  const defaultTab = admin ? "fees" : (ALL_TABS.find(t => canAccessTab(t)) ?? "fees");
  const currentTab = activeTab ?? defaultTab;
  const currentSessionName = sessionStatus?.currentSession?.name ?? null;
  const SESSION = currentSessionName ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  // Visible nav items for this user
  const visibleItems = NAV_ITEMS.filter(item => item.check(admin, item.value));
  const currentNavItem = visibleItems.find(item => item.value === currentTab);

  const handleTabSelect = (value: string) => {
    setActiveTab(value);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* First-time session creation modal */}
      <CreateSessionModal
        open={showCreateSession}
        onCreated={(session) => {
          setShowCreateSession(false);
          setSessionStatus((prev) => ({
            hasSessions: true,
            currentSession: session as any,
            sessions: prev?.sessions ?? [],
          }));
        }}
      />

      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

          {/* Left: hamburger + title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5 text-slate-300" />
            </button>

            {/* Logo + title */}
            <div className="h-8 w-8 bg-amber-500 rounded flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-slate-900" />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <div className="flex flex-col leading-tight">
                {schoolName && (
                  <span className="text-sm font-bold text-amber-400 uppercase tracking-widest truncate max-w-[200px] sm:max-w-xs">
                    {schoolName}
                  </span>
                )}
                <h1 className="text-xs font-normal tracking-tight whitespace-nowrap text-slate-400">Admin Console</h1>
              </div>
              {staffUser && (
                <span className="text-sm text-amber-400 font-normal whitespace-nowrap">
                  — {staffUser.name}
                  <span className="ml-1 text-xs text-slate-400 capitalize">({staffUser.role})</span>
                </span>
              )}
              {currentSessionName && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {currentSessionName}
                </span>
              )}
              {!currentSessionName && admin && (
                <span className="inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                  No active session
                </span>
              )}
            </div>
          </div>

          {/* Right: active tab label + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Current tab pill */}
            {currentNavItem && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
                <currentNavItem.Icon className={`h-3.5 w-3.5 ${currentNavItem.color}`} />
                {currentNavItem.label}
              </span>
            )}
            {admin && (
              <Button
                variant="ghost"
                className="text-amber-400 hover:text-amber-300 hover:bg-slate-800 border border-amber-700/40 hover:border-amber-600"
                onClick={() => setLocation("/scanner")}
              >
                <ScanLine className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Scanner Mode</span>
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hamburger drawer ── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-slate-900 border-slate-800 text-white p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white text-base font-semibold flex items-center gap-2">
                <div className="h-7 w-7 bg-amber-500 rounded flex items-center justify-center">
                  <Shield className="h-4 w-4 text-slate-900" />
                </div>
                Navigation
              </SheetTitle>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {currentSessionName && (
              <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full w-fit">
                <CalendarRange className="h-3.5 w-3.5" />
                {currentSessionName}
              </div>
            )}
          </SheetHeader>

          {/* Nav list */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
            {visibleItems.map(({ value, label, Icon, color }) => {
              const isActive = currentTab === value;
              return (
                <button
                  key={value}
                  onClick={() => handleTabSelect(value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? color : ""}`} />
                  <span>{label}</span>
                  {isActive && (
                    <span className={`ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 bg-current ${color}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom: sign out */}
          <div className="border-t border-slate-800 p-3">
            <button
              onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
          {/* All tab content panels — no TabsList here */}
          <TabsContent value="fees" className="focus-visible:outline-none">
            <FeesTab />
          </TabsContent>
          <TabsContent value="records" className="focus-visible:outline-none">
            <RecordsTab activeSession={currentSessionName} />
          </TabsContent>
          <TabsContent value="record-list" className="focus-visible:outline-none">
            <RecordListTab session={SESSION} />
          </TabsContent>
          <TabsContent value="student-status" className="focus-visible:outline-none">
            <StudentStatusTab />
          </TabsContent>
          <TabsContent value="student-panel" className="focus-visible:outline-none">
            <StudentPanelTab />
          </TabsContent>
          <TabsContent value="expenditure" className="focus-visible:outline-none">
            <ExpenditureTab />
          </TabsContent>
          <TabsContent value="bulk-email" className="focus-visible:outline-none">
            <BulkEmailTab />
          </TabsContent>
          <TabsContent value="notify" className="focus-visible:outline-none">
            <BulkNotifyTab />
          </TabsContent>
          <TabsContent value="qr-codes" className="focus-visible:outline-none">
            <QrCodesTab />
          </TabsContent>
          <TabsContent value="id-cards" className="focus-visible:outline-none">
            <IdCardsTab />
          </TabsContent>
          <TabsContent value="attendance-group" className="focus-visible:outline-none">
            <AttendanceGroupTab />
          </TabsContent>
          <TabsContent value="teacher-management" className="focus-visible:outline-none">
            <TeacherManagementTab />
          </TabsContent>
          <TabsContent value="exam-management" className="focus-visible:outline-none">
            <ExamManagementTab />
          </TabsContent>
          <TabsContent value="timetable" className="focus-visible:outline-none">
            <TabErrorBoundary>
              <TimetableManagementTab />
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="homework-status" className="focus-visible:outline-none">
            <TabErrorBoundary>
              <HomeworkStatusTab />
            </TabErrorBoundary>
          </TabsContent>
          <TabsContent value="parents" className="focus-visible:outline-none">
            <ParentsTab />
          </TabsContent>
          <TabsContent value="admission" className="focus-visible:outline-none">
            <AdmissionTab />
          </TabsContent>
          <TabsContent value="incidents" className="focus-visible:outline-none">
            <FirTab />
          </TabsContent>
          <TabsContent value="website-setup" className="focus-visible:outline-none">
            <WebsiteSetupTab />
          </TabsContent>
          <TabsContent value="downloads" className="focus-visible:outline-none">
            <DownloadsTab />
          </TabsContent>
          <TabsContent value="settings" className="focus-visible:outline-none">
            <SettingsTab />
          </TabsContent>
          <TabsContent value="security" className="focus-visible:outline-none">
            <SecurityTab />
          </TabsContent>
          <TabsContent value="academic-sessions" className="focus-visible:outline-none">
            <AcademicSessionsTab onSessionChange={refreshSessionStatus} />
          </TabsContent>
          <TabsContent value="ai-assistant" className="focus-visible:outline-none">
            <AdminAiAssistantTab />
          </TabsContent>
          <TabsContent value="occasional-collection" className="focus-visible:outline-none">
            <OccasionalCollectionTab session={SESSION} />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Admin Console?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the login page. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700 text-white">
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
