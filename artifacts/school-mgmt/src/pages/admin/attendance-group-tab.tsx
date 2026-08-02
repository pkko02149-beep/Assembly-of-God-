import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, CalendarCheck, BarChart2, UserSearch, Flame } from "lucide-react";
import LiveScanTab from "./live-scan-tab";
import AttendanceTab from "./attendance-tab";
import DailyReportTab from "./daily-report-tab";
import StudentHistoryTab from "./student-history-tab";
import AtRiskTab from "./at-risk-tab";

export default function AttendanceGroupTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Attendance</h2>
        <p className="text-sm text-slate-500 mt-0.5">Monitor live scans, mark attendance, view reports and at-risk students</p>
      </div>
      <Tabs defaultValue="live-scan" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-lg flex-wrap h-auto gap-1">
          <TabsTrigger value="live-scan" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm text-sm">
            <Wifi className="h-4 w-4 mr-1.5" />Live Scan
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-sm text-sm">
            <CalendarCheck className="h-4 w-4 mr-1.5" />Attendance
          </TabsTrigger>
          <TabsTrigger value="daily-report" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm text-sm">
            <BarChart2 className="h-4 w-4 mr-1.5" />Daily Reports
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm text-sm">
            <UserSearch className="h-4 w-4 mr-1.5" />History
          </TabsTrigger>
          <TabsTrigger value="at-risk" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm text-sm">
            <Flame className="h-4 w-4 mr-1.5" />At Risk
          </TabsTrigger>
        </TabsList>
        <TabsContent value="live-scan" className="focus-visible:outline-none mt-4">
          <LiveScanTab />
        </TabsContent>
        <TabsContent value="attendance" className="focus-visible:outline-none mt-4">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="daily-report" className="focus-visible:outline-none mt-4">
          <DailyReportTab />
        </TabsContent>
        <TabsContent value="history" className="focus-visible:outline-none mt-4">
          <StudentHistoryTab />
        </TabsContent>
        <TabsContent value="at-risk" className="focus-visible:outline-none mt-4">
          <AtRiskTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
