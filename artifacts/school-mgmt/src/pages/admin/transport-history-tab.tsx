import { useState, useMemo } from "react";
import {
  useListStudents,
  useListFeeCategories,
  useListFeePayments,
  useListVehicles,
  useListClasses,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bus, Search, CheckCircle2, Clock, XCircle, Minus, IndianRupee } from "lucide-react";

const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const defaultAcadYear = currentMonth >= 4 ? currentYear : currentYear - 1;
const YEARS = [defaultAcadYear - 1, defaultAcadYear, defaultAcadYear + 1];

function sessionFromYear(y: number) {
  return `${y}-${y + 1}`;
}

function yearFromSession(s: string) {
  return parseInt(s.split("-")[0], 10);
}

function monthYear(month: number, acadYear: number): number {
  return month >= 4 ? acadYear : acadYear + 1;
}

function currencyFmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TransportHistoryTab() {
  const [acadYear, setAcadYear] = useState(defaultAcadYear);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const session = sessionFromYear(acadYear);

  const { data: allStudents = [] } = useListStudents({});
  const { data: categories = [] } = useListFeeCategories();
  const { data: vehicles = [] } = useListVehicles();
  const { data: classes = [] } = useListClasses();
  const { data: allPayments = [] } = useListFeePayments({ session });

  const transportCatId = useMemo(() => {
    const cat = categories.find(c => {
      const n = c.name.toLowerCase();
      return n.includes("transport") || n.includes("bus");
    });
    return cat?.id ?? null;
  }, [categories]);

  const transportStudents = useMemo(() => {
    return allStudents.filter(s => {
      const hasHistory = (s.transportFromMonth != null) && (s.hasVehicle || s.transportStopMonth != null || s.vehicleId != null);
      return hasHistory;
    });
  }, [allStudents]);

  const transportPayments = useMemo(() => {
    if (!transportCatId) return allPayments.filter(p => {
      const n = (p.categoryName ?? "").toLowerCase();
      return n.includes("transport") || n.includes("bus");
    });
    return allPayments.filter(p => p.categoryId === transportCatId);
  }, [allPayments, transportCatId]);

  const paymentMap = useMemo(() => {
    const map = new Map<string, typeof transportPayments[0]>();
    for (const p of transportPayments) {
      map.set(`${p.studentId}-${p.month}-${p.year}`, p);
    }
    return map;
  }, [transportPayments]);

  const filtered = useMemo(() => {
    let list = transportStudents;
    if (vehicleFilter !== "all") list = list.filter(s => String(s.vehicleId) === vehicleFilter);
    if (classFilter !== "all") list = list.filter(s => String(s.classId) === classFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.studentName.toLowerCase().includes(q) || s.fatherName?.toLowerCase().includes(q));
    }
    return list;
  }, [transportStudents, vehicleFilter, classFilter, search]);

  function getMonthStatus(studentId: number, month: number) {
    const year = monthYear(month, acadYear);
    const key = `${studentId}-${month}-${year}`;
    return paymentMap.get(key) ?? null;
  }

  function isActiveMonth(student: any, month: number): boolean {
    const fromM: number = student.transportFromMonth ?? 4;
    const stopM: number | null = student.transportStopMonth ?? null;
    const fromIdx = SCHOOL_MONTHS_ORDER.indexOf(fromM);
    const mIdx = SCHOOL_MONTHS_ORDER.indexOf(month);
    if (fromIdx < 0 || mIdx < 0) return false;
    if (mIdx < fromIdx) return false;
    if (stopM !== null) {
      const stopIdx = SCHOOL_MONTHS_ORDER.indexOf(stopM);
      if (stopIdx >= 0 && mIdx >= stopIdx) return false;
    }
    return true;
  }

  const totalCollected = useMemo(() => {
    return filtered.reduce((sum, s) => {
      return sum + SCHOOL_MONTHS_ORDER.reduce((ms, m) => {
        const p = getMonthStatus(s.id, m);
        return ms + (p ? parseFloat(String(p.paidAmount ?? 0)) : 0);
      }, 0);
    }, 0);
  }, [filtered, paymentMap, acadYear]);

  const totalDue = useMemo(() => {
    return filtered.reduce((sum, s) => {
      return sum + SCHOOL_MONTHS_ORDER.reduce((ms, m) => {
        if (!isActiveMonth(s, m)) return ms;
        const p = getMonthStatus(s.id, m);
        return ms + (p ? parseFloat(String(p.amount ?? 0)) : 0);
      }, 0);
    }, 0);
  }, [filtered, paymentMap, acadYear]);

  const paidCount = useMemo(() => {
    let c = 0;
    for (const s of filtered) {
      for (const m of SCHOOL_MONTHS_ORDER) {
        if (!isActiveMonth(s, m)) continue;
        const p = getMonthStatus(s.id, m);
        if (p?.status === "paid") c++;
      }
    }
    return c;
  }, [filtered, paymentMap, acadYear]);

  const pendingCount = useMemo(() => {
    let c = 0;
    for (const s of filtered) {
      for (const m of SCHOOL_MONTHS_ORDER) {
        if (!isActiveMonth(s, m)) continue;
        const p = getMonthStatus(s.id, m);
        if (!p || p.status === "pending") c++;
      }
    }
    return c;
  }, [filtered, paymentMap, acadYear]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <Bus className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transport Fee History</h2>
          <p className="text-sm text-slate-500">Month-by-month transport payment log for all students</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 mb-1">Students with Transport</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 mb-1">Total Collected</div>
            <div className="text-2xl font-bold text-teal-600">{currencyFmt(totalCollected)}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 mb-1">Months Paid</div>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500 mb-1">Months Pending</div>
            <div className="text-2xl font-bold text-red-500">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search student or father name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={String(acadYear)} onValueChange={v => setAcadYear(Number(v))}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => (
                  <SelectItem key={y} value={String(y)}>{sessionFromYear(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Paid</span>
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-yellow-500" /> Partial</span>
        <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-red-400" /> Pending</span>
        <span className="flex items-center gap-1.5"><Minus className="h-3.5 w-3.5 text-slate-300" /> Not active</span>
      </div>

      {/* Grid table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Bus className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No transport students found</p>
              <p className="text-xs mt-1">Assign students to a vehicle to see history here</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 min-w-[200px]">
                    Student
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 dark:text-slate-400 min-w-[80px] whitespace-nowrap">
                    Vehicle
                  </th>
                  {SCHOOL_MONTHS_ORDER.map(m => (
                    <th key={m} className="px-2 py-3 font-medium text-slate-600 dark:text-slate-400 text-center min-w-[56px]">
                      {MONTH_SHORT[m]}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium text-slate-600 dark:text-slate-400 text-right min-w-[90px]">
                    Collected
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, idx) => {
                  const rowCollected = SCHOOL_MONTHS_ORDER.reduce((sum, m) => {
                    const p = getMonthStatus(student.id, m);
                    return sum + (p ? parseFloat(String(p.paidAmount ?? 0)) : 0);
                  }, 0);

                  return (
                    <tr
                      key={student.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-900/50"}`}
                    >
                      <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                        <div className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">{student.studentName}</div>
                        <div className="text-xs text-slate-400">{student.className} · {student.sectionName}</div>
                        {student.transportStopMonth != null && !student.hasVehicle && (
                          <Badge className="mt-0.5 text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-200">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-slate-500 whitespace-nowrap">{student.vehicleName ?? "—"}</span>
                      </td>
                      {SCHOOL_MONTHS_ORDER.map(m => {
                        const active = isActiveMonth(student, m);
                        const p = getMonthStatus(student.id, m);

                        if (!active) {
                          return (
                            <td key={m} className="px-2 py-2.5 text-center">
                              <Minus className="h-3.5 w-3.5 text-slate-200 dark:text-slate-700 mx-auto" />
                            </td>
                          );
                        }

                        if (!p || p.status === "pending") {
                          return (
                            <td key={m} className="px-2 py-2.5 text-center">
                              <span title="Pending">
                                <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                              </span>
                            </td>
                          );
                        }

                        if (p.status === "partial") {
                          return (
                            <td key={m} className="px-2 py-2.5 text-center">
                              <span title={`Partial: ${currencyFmt(parseFloat(String(p.paidAmount ?? 0)))}`}>
                                <Clock className="h-4 w-4 text-yellow-500 mx-auto" />
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={m} className="px-2 py-2.5 text-center">
                            <span title={`Paid: ${currencyFmt(parseFloat(String(p.paidAmount ?? 0)))}`}>
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-medium text-teal-700 dark:text-teal-400 whitespace-nowrap">
                        {currencyFmt(rowCollected)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800/50" colSpan={2}>
                    Total ({filtered.length} students)
                  </td>
                  {SCHOOL_MONTHS_ORDER.map(m => {
                    const monthPaid = filtered.reduce((sum, s) => {
                      const p = getMonthStatus(s.id, m);
                      return sum + (p ? parseFloat(String(p.paidAmount ?? 0)) : 0);
                    }, 0);
                    return (
                      <td key={m} className="px-2 py-3 text-center text-xs font-medium text-teal-700 dark:text-teal-400">
                        {monthPaid > 0 ? currencyFmt(monthPaid) : ""}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right font-bold text-teal-700 dark:text-teal-400">
                    {currencyFmt(totalCollected)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
