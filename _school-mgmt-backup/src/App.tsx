import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAdminToken } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import PublicRoster from "@/pages/public-roster";
import DownloadCenter from "@/pages/downloads";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import AdminDashboard from "@/pages/admin";
import ScanPage from "@/pages/scan";
import ScannerPage from "@/pages/scanner";
import AdmissionPage from "@/pages/admission";
import AcademicsPage from "@/pages/academics";
import ContactPage from "@/pages/contact";
import ResultsPage from "@/pages/results";
import AdmitCardPublicPage from "@/pages/admit-card-public";
import AboutPage from "@/pages/about";
import GalleryPage from "@/pages/gallery";
import HomeworkPage from "@/pages/homework-public";
import VerifyCertificatePage from "@/pages/verify";
import StudentProfilePage from "@/pages/student-profile";
import FeePaymentSearch from "@/pages/fee-payment";
import FeePaymentStudent from "@/pages/fee-payment-student";

// Teacher Portal
import TeacherLogin from "@/pages/teacher/login";
import TeacherDashboard from "@/pages/teacher/index";
import TeacherStudents from "@/pages/teacher/students";
import TeacherAttendance from "@/pages/teacher/attendance";
import TeacherHomework from "@/pages/teacher/homework";
import TeacherMarks from "@/pages/teacher/marks";
import TeacherTimetable from "@/pages/teacher/timetable";
import TeacherNotices from "@/pages/teacher/notices";
import TeacherLeave from "@/pages/teacher/leave";
import TeacherFir from "@/pages/teacher/fir";
import TeacherIncidents from "@/pages/teacher/incidents";
import TeacherScanner from "@/pages/teacher/scanner";
import TeacherPromotion from "@/pages/teacher/promotion";
import TeacherStudentRecords from "@/pages/teacher/student-records";
import TeacherAiAssistant from "@/pages/teacher/ai-assistant";
import TeacherChangePassword from "@/pages/teacher/change-password";
import TeacherDownloads from "@/pages/teacher/downloads";
import TeacherOccasionalCollection from "@/pages/teacher/occasional-collection";

// Parent Portal
import ParentLogin from "@/pages/parent/login";
import ParentDashboard from "@/pages/parent/index";
import ParentAttendance from "@/pages/parent/attendance";
import ParentHomework from "@/pages/parent/homework";
import ParentResults from "@/pages/parent/results";
import ParentFees from "@/pages/parent/fees";
import ParentNotices from "@/pages/parent/notices";
import ParentLeave from "@/pages/parent/leave";
import ParentFir from "@/pages/parent/fir";
import ParentIncidents from "@/pages/parent/incidents";
import ParentAdmitCard from "@/pages/parent/admit-card";
import ParentTimetable from "@/pages/parent/timetable";
import ParentAiAssistant from "@/pages/parent/ai-assistant";
import ParentChangePassword from "@/pages/parent/change-password";
import ParentDownloads from "@/pages/parent/downloads";

setAuthTokenGetter(() => Promise.resolve(getAdminToken()));

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={HomePage} />
      <Route path="/roster" component={PublicRoster} />
      <Route path="/downloads" component={DownloadCenter} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/scan" component={ScanPage} />
      <Route path="/scanner" component={ScannerPage} />
      <Route path="/admission" component={AdmissionPage} />
      <Route path="/academics" component={AcademicsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/results" component={ResultsPage} />
      <Route path="/admit-card" component={AdmitCardPublicPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/homework" component={HomeworkPage} />
      <Route path="/verify" component={VerifyCertificatePage} />
      <Route path="/student/:enrollmentId" component={StudentProfilePage} />
      <Route path="/fee-payment/student/:studentId" component={FeePaymentStudent} />
      <Route path="/fee-payment" component={FeePaymentSearch} />

      {/* Teacher Portal */}
      <Route path="/teacher/login" component={TeacherLogin} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/teacher/students" component={TeacherStudents} />
      <Route path="/teacher/attendance" component={TeacherAttendance} />
      <Route path="/teacher/homework" component={TeacherHomework} />
      <Route path="/teacher/marks" component={TeacherMarks} />
      <Route path="/teacher/timetable" component={TeacherTimetable} />
      <Route path="/teacher/notices" component={TeacherNotices} />
      <Route path="/teacher/leave" component={TeacherLeave} />
      <Route path="/teacher/fir" component={TeacherFir} />
      <Route path="/teacher/incidents" component={TeacherIncidents} />
      <Route path="/teacher/scanner" component={TeacherScanner} />
      <Route path="/teacher/promotion" component={TeacherPromotion} />
      <Route path="/teacher/student-records" component={TeacherStudentRecords} />
      <Route path="/teacher/downloads" component={TeacherDownloads} />
      <Route path="/teacher/ai-assistant" component={TeacherAiAssistant} />
      <Route path="/teacher/change-password" component={TeacherChangePassword} />
      <Route path="/teacher/occasional-collection" component={TeacherOccasionalCollection} />

      {/* Parent Portal */}
      <Route path="/parent/login" component={ParentLogin} />
      <Route path="/parent" component={ParentDashboard} />
      <Route path="/parent/attendance" component={ParentAttendance} />
      <Route path="/parent/homework" component={ParentHomework} />
      <Route path="/parent/results" component={ParentResults} />
      <Route path="/parent/fees" component={ParentFees} />
      <Route path="/parent/notices" component={ParentNotices} />
      <Route path="/parent/leave" component={ParentLeave} />
      <Route path="/parent/fir" component={ParentFir} />
      <Route path="/parent/incidents" component={ParentIncidents} />
      <Route path="/parent/admit-card" component={ParentAdmitCard} />
      <Route path="/parent/timetable" component={ParentTimetable} />
      <Route path="/parent/downloads" component={ParentDownloads} />
      <Route path="/parent/ai-assistant" component={ParentAiAssistant} />
      <Route path="/parent/change-password" component={ParentChangePassword} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
