import { useState, useEffect } from "react";
import { useGetLiveStatus, useListVehicles, useListClasses } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Clock, Users, Wifi, CalendarDays, Filter, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
}

export default function LiveScanTab() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [vehicleFilter, setVehicleFilter] = useState<number | "">("");
  const [classFilter, setClassFilter] = useState<number | "">("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [tick, setTick] = useState(0);

  const { data: allStudents = [], dataUpdatedAt } = useGetLiveStatus(
    {} as any,
    { query: { refetchInterval: 8000, queryKey: [`/api/attendance/live-status`, { date: selectedDate }] } }
  );
  const { data: vehicles = [] } = useListVehicles();
  const { data: classes = [] } = useListClasses();

  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const filtered = allStudents.filter(s => {
    if (vehicleFilter !== "" && s.vehicleId !== vehicleFilter) return false;
    if (classFilter !== "" && s.classId !== classFilter) return false;
    return true;
  });

  const present = filtered.filter(s => s.status === "present");
  const absent = filtered.filter(s => s.status === "absent");
  const unmarked = filtered.filter(s => s.status === "unmarked");
  const total = filtered.length;
  const presentPct = total > 0 ? Math.round((present.length / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wifi className="h-6 w-6 text-green-500 animate-pulse" />
            Live Scan Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Auto-refreshes every 8 seconds · Last updated{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {timeAgo(lastRefreshed)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={vehicleFilter}
          onChange={e => setVehicleFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Vehicles</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(vehicleFilter !== "" || classFilter !== "") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setVehicleFilter(""); setClassFilter(""); }}
            className="h-8 text-slate-500 hover:text-slate-700 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{total}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Present</span>
          </div>
          <p className="text-3xl font-bold text-green-700 dark:text-green-400">{present.length}</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">{presentPct}%</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Absent</span>
          </div>
          <p className="text-3xl font-bold text-red-700 dark:text-red-400">{absent.length}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Missing</span>
          </div>
          <p className="text-3xl font-bold text-slate-500">{unmarked.length}</p>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">Scan Progress</span>
            <span className="text-slate-500">{present.length + absent.length} / {total} marked</span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {present.length > 0 && (
              <div
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${(present.length / total) * 100}%` }}
              />
            )}
            {absent.length > 0 && (
              <div
                className="bg-red-500 h-full transition-all duration-500"
                style={{ width: `${(absent.length / total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Present</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Absent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />Unmarked</span>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <Users className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No students found</h3>
          <p className="text-slate-500 mt-1 text-sm">Add students in the Records tab first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Present list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-green-50 dark:bg-green-900/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
                Scanned Present ({present.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
              {present.length === 0 ? (
                <p className="px-4 py-6 text-center text-slate-400 text-sm">No students marked present yet.</p>
              ) : (
                present.map(s => (
                  <div key={s.studentId} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.studentName}</p>
                      <p className="text-xs text-slate-500">
                        {s.className} · {s.sectionName}
                        {s.vehicleName && <span className="ml-1">· <Bus className="h-3 w-3 inline" /> {s.vehicleName}</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Present
                      </span>
                      {s.scannedAt && (
                        <span className="text-xs text-slate-400">{formatTime(s.scannedAt)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missing + Absent list */}
          <div className="space-y-4">
            {/* Unmarked */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Not Yet Scanned ({unmarked.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto">
                {unmarked.length === 0 ? (
                  <p className="px-4 py-5 text-center text-slate-400 text-sm">All students have been scanned!</p>
                ) : (
                  unmarked.map(s => (
                    <div key={s.studentId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{s.studentName}</p>
                        <p className="text-xs text-slate-400">
                          {s.className} · {s.sectionName}
                          {s.vehicleName && <span className="ml-1">· {s.vehicleName}</span>}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex-shrink-0">
                        Roll #{s.rollNo}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Absent */}
            {absent.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-red-50 dark:bg-red-900/10">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Marked Absent ({absent.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[220px] overflow-y-auto">
                  {absent.map(s => (
                    <div key={s.studentId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{s.studentName}</p>
                        <p className="text-xs text-slate-400">
                          {s.className} · {s.sectionName}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                        <XCircle className="h-3 w-3" /> Absent
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
