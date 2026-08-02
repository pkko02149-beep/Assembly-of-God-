import { useState, useMemo } from "react";
import {
  useListStudents,
  useListVehicles,
  useListTrips,
  useListClasses,
  useListSections,
  useListFeePayments,
  getListStudentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { Bus, RotateCcw, Users, IndianRupee, CalendarDays, Trash2, Square, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SCHOOL_MONTHS_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const MONTH_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
};
const MONTH_FULL: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December",
};

function getActiveTransportMonths(student: any): number[] {
  if (!student.vehicleId) return [];
  const fromM: number = student.transportFromMonth ?? 4;
  const stopM: number | null = student.transportStopMonth ?? null;
  const fromIdx = SCHOOL_MONTHS_ORDER.indexOf(fromM);
  if (fromIdx < 0) return [];

  if (student.hasVehicle) {
    return SCHOOL_MONTHS_ORDER.slice(fromIdx);
  }
  if (!student.hasVehicle && stopM !== null) {
    const stopIdx = SCHOOL_MONTHS_ORDER.indexOf(stopM);
    return stopIdx >= 0 ? SCHOOL_MONTHS_ORDER.slice(fromIdx, stopIdx) : [];
  }
  return SCHOOL_MONTHS_ORDER.slice(fromIdx);
}

export default function TransportManagerTab({ session }: { session: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [filterTripId, setFilterTripId] = useState<string>("all");
  const [filterVehicleId, setFilterVehicleId] = useState<string>("all");
  const [activating, setActivating] = useState<Set<number>>(new Set());
  const [deactivating, setDeactivating] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data: allStudents = [], isLoading } = useListStudents({
    classId: filterClassId !== "all" ? parseInt(filterClassId) : undefined,
    sectionId: filterSectionId !== "all" ? parseInt(filterSectionId) : undefined,
    tripId: filterTripId !== "all" ? parseInt(filterTripId) : undefined,
    vehicleId: filterVehicleId !== "all" ? parseInt(filterVehicleId) : undefined,
  });
  const { data: vehicles = [] } = useListVehicles();
  const { data: trips = [] } = useListTrips();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections({
    classId: filterClassId !== "all" ? parseInt(filterClassId) : undefined,
  });
  const { data: allPayments = [] } = useListFeePayments({ session });

  const [removing, setRemoving] = useState(false);

  async function removeFromTransport(studentData: any) {
    if (!studentData) return;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    setRemoving(true);
    try {
      const body: any = {
        studentName: studentData.studentName,
        fatherName: studentData.fatherName || "",
        hasVehicle: false,
        vehicleId: null,
        hasTrip: false,
        tripId: null,
        transportRouteId: studentData.transportRouteId ?? null,
        transportMonths: studentData.transportMonths ?? 12,
        transportFromMonth: studentData.transportFromMonth ?? 4,
        transportStopMonth: currentMonth,
        classId: studentData.classId,
        sectionId: studentData.sectionId,
        whatsappNumber: studentData.whatsappNumber || "",
        parentEmail: studentData.parentEmail || "",
        address: studentData.address || "",
        photoUrl: studentData.photoUrl || "",
        admissionDate: studentData.admissionDate || "",
        studentType: studentData.studentType || "",
        session: studentData.session || session,
        dateOfBirth: studentData.dateOfBirth || "",
        motherName: studentData.motherName || "",
        aadharNumber: studentData.aadharNumber || "",
        panNumber: studentData.panNumber || "",
        gender: studentData.gender || "",
        previousSchool: studentData.previousSchool || "",
        previousYearDue: studentData.previousYearDue ?? 0,
        previousYearDueRemarks: studentData.previousYearDueRemarks || "",
        feeFromApril: studentData.feeFromApril ?? false,
        category: studentData.category || "",
        religion: studentData.religion || "",
      };
      const token = getAdminToken();
      const res = await fetch(`/api/students/${studentData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: `${studentData.studentName} removed from transport. Fee history preserved.` });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Failed to remove from transport", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  }

  const transportStudents = useMemo(
    () => allStudents.filter((s) => s.vehicleId !== null && s.vehicleId !== undefined),
    [allStudents]
  );

  const activeCount = useMemo(() => transportStudents.filter((s) => s.hasVehicle).length, [transportStudents]);
  const inactiveCount = useMemo(() => transportStudents.filter((s) => !s.hasVehicle).length, [transportStudents]);

  const paidByStudent = useMemo<Map<number, number>>(() => {
    const map = new Map<number, number>();
    for (const p of allPayments) {
      const catName = (p.categoryName ?? "").toLowerCase();
      if (catName.includes("transport") || catName.includes("bus")) {
        const sid = p.studentId;
        if (sid != null) {
          map.set(sid, (map.get(sid) ?? 0) + (p.paidAmount ?? 0));
        }
      }
    }
    return map;
  }, [allPayments]);

  const studentPaidMonths = useMemo<Map<number, Set<number>>>(() => {
    const map = new Map<number, Set<number>>();
    for (const p of allPayments) {
      const catName = (p.categoryName ?? "").toLowerCase();
      if (
        (catName.includes("transport") || catName.includes("bus")) &&
        (p.status === "paid" || p.status === "partial") &&
        p.studentId != null &&
        (p as any).month != null
      ) {
        if (!map.has(p.studentId)) map.set(p.studentId, new Set());
        map.get(p.studentId)!.add((p as any).month as number);
      }
    }
    return map;
  }, [allPayments]);

  const { totalGenerated, totalPaid } = useMemo(() => {
    let gen = 0, paid = 0;
    for (const s of transportStudents) {
      const price = parseFloat(String((s as any).transportRoutePricePerMonth ?? "0")) || 0;
      const activeMonths = getActiveTransportMonths(s);
      gen += price * activeMonths.length;
      paid += paidByStudent.get(s.id) ?? 0;
    }
    return { totalGenerated: gen, totalPaid: paid };
  }, [transportStudents, paidByStudent]);

  async function activateFromMonth(studentId: number, month: number, studentData: any) {
    setActivating((prev) => new Set(prev).add(studentId));
    try {
      const body: any = {
        studentName: studentData.studentName,
        fatherName: studentData.fatherName || "",
        hasVehicle: true,
        vehicleId: studentData.vehicleId,
        hasTrip: true,
        tripId: studentData.tripId ?? null,
        transportRouteId: studentData.transportRouteId ?? null,
        transportMonths: studentData.transportMonths ?? 12,
        transportFromMonth: month,
        transportStopMonth: null,
        classId: studentData.classId,
        sectionId: studentData.sectionId,
        whatsappNumber: studentData.whatsappNumber || "",
        parentEmail: studentData.parentEmail || "",
        address: studentData.address || "",
        photoUrl: studentData.photoUrl || "",
        admissionDate: studentData.admissionDate || "",
        studentType: studentData.studentType || "",
        session: studentData.session || session,
        dateOfBirth: studentData.dateOfBirth || "",
        motherName: studentData.motherName || "",
        aadharNumber: studentData.aadharNumber || "",
        panNumber: studentData.panNumber || "",
        gender: studentData.gender || "",
        previousSchool: studentData.previousSchool || "",
        previousYearDue: studentData.previousYearDue ?? 0,
        previousYearDueRemarks: studentData.previousYearDueRemarks || "",
        feeFromApril: studentData.feeFromApril ?? false,
        category: studentData.category || "",
        religion: studentData.religion || "",
      };
      const token = getAdminToken();
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: `Transport activated for ${studentData.studentName} from ${MONTH_FULL[month]}` });
    } catch {
      toast({ title: "Failed to activate transport", variant: "destructive" });
    } finally {
      setActivating((prev) => { const next = new Set(prev); next.delete(studentId); return next; });
    }
  }

  async function deactivateTransport(studentId: number, studentData: any) {
    const currentMonth = new Date().getMonth() + 1;
    setDeactivating((prev) => new Set(prev).add(studentId));
    try {
      const body: any = {
        studentName: studentData.studentName,
        fatherName: studentData.fatherName || "",
        hasVehicle: false,
        vehicleId: studentData.vehicleId,
        hasTrip: false,
        tripId: studentData.tripId ?? null,
        transportRouteId: studentData.transportRouteId ?? null,
        transportMonths: studentData.transportMonths ?? 12,
        transportFromMonth: studentData.transportFromMonth ?? 4,
        transportStopMonth: currentMonth,
        classId: studentData.classId,
        sectionId: studentData.sectionId,
        whatsappNumber: studentData.whatsappNumber || "",
        parentEmail: studentData.parentEmail || "",
        address: studentData.address || "",
        photoUrl: studentData.photoUrl || "",
        admissionDate: studentData.admissionDate || "",
        studentType: studentData.studentType || "",
        session: studentData.session || session,
        dateOfBirth: studentData.dateOfBirth || "",
        motherName: studentData.motherName || "",
        aadharNumber: studentData.aadharNumber || "",
        panNumber: studentData.panNumber || "",
        gender: studentData.gender || "",
        previousSchool: studentData.previousSchool || "",
        previousYearDue: studentData.previousYearDue ?? 0,
        previousYearDueRemarks: studentData.previousYearDueRemarks || "",
        feeFromApril: studentData.feeFromApril ?? false,
        category: studentData.category || "",
        religion: studentData.religion || "",
      };
      const token = getAdminToken();
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: `Transport stopped for ${studentData.studentName} from ${MONTH_FULL[currentMonth]}` });
    } catch {
      toast({ title: "Failed to stop transport", variant: "destructive" });
    } finally {
      setDeactivating((prev) => { const next = new Set(prev); next.delete(studentId); return next; });
    }
  }

  function resetFilters() {
    setFilterClassId("all");
    setFilterSectionId("all");
    setFilterTripId("all");
    setFilterVehicleId("all");
  }

  const hasActiveFilters =
    filterClassId !== "all" || filterSectionId !== "all" || filterTripId !== "all" || filterVehicleId !== "all";

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bus className="h-5 w-5 text-teal-600" />
            Transport Manager
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a month to activate fee from that month. Paid months are hidden automatically.
          </p>
        </div>
      </div>

      {/* Summary cards — row 1: counts */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{transportStudents.length}</div>
              <div className="text-xs text-slate-500">Total Transport</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Bus className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-green-700 dark:text-green-400">{activeCount}</div>
              <div className="text-xs text-slate-500">Fee Active</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <Bus className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{inactiveCount}</div>
              <div className="text-xs text-slate-500">Fee Inactive</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary cards — row 2: amounts */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{fmt(totalGenerated)}</div>
              <div className="text-xs text-slate-500">Total Generated Transport</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <div className="h-9 w-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(totalPaid)}</div>
              <div className="text-xs text-slate-500">Total Paid (Transport)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filters</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterClassId} onValueChange={(v) => { setFilterClassId(v); setFilterSectionId("all"); }}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterSectionId} onValueChange={setFilterSectionId}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterTripId} onValueChange={setFilterTripId}>
              <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="Trip" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trips</SelectItem>
                {trips.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Vehicle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button size="sm" variant="ghost" className="h-8 text-slate-500 hover:text-slate-700" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            )}

            <div className="ml-auto text-xs text-slate-500 font-medium">
              {transportStudents.length} student{transportStudents.length !== 1 ? "s" : ""} shown
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading…</div>
          ) : transportStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Bus className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No transport students found</p>
              <p className="text-xs mt-1">Students must have a vehicle assigned in Records.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold w-8">#</TableHead>
                  <TableHead className="text-xs font-semibold">Student</TableHead>
                  <TableHead className="text-xs font-semibold">Class</TableHead>
                  <TableHead className="text-xs font-semibold">Vehicle / Trip</TableHead>
                  <TableHead className="text-xs font-semibold">Rate/mo</TableHead>
                  <TableHead className="text-xs font-semibold">From → Stop</TableHead>
                  <TableHead className="text-xs font-semibold">
                    <div className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Transport Months</div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right">Generated</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Annual Total</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                  <TableHead className="text-xs font-semibold min-w-[260px]">Activate / Deactivate</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transportStudents.map((student, idx) => {
                  const isActive = !!student.hasVehicle;
                  const isActivating = activating.has(student.id);
                  const isDeactivating = deactivating.has(student.id);
                  const price = parseFloat(String((student as any).transportRoutePricePerMonth ?? "0")) || 0;
                  const activeMonths = getActiveTransportMonths(student);
                  const generatedAmt = price * activeMonths.length;
                  const annualAmt = price * 12;
                  const paidAmt = paidByStudent.get(student.id) ?? 0;
                  const fromM: number = (student as any).transportFromMonth ?? 4;
                  const stopM: number | null = (student as any).transportStopMonth ?? null;

                  const paidMonths = studentPaidMonths.get(student.id) ?? new Set<number>();
                  const availableMonths = SCHOOL_MONTHS_ORDER.filter((m) => !paidMonths.has(m));

                  // Promotion / detention / drop status — locks transport controls
                  const studentTypeLower = ((student as any).studentType ?? "").toLowerCase();
                  const isDropped = studentTypeLower.includes("dropped") || studentTypeLower.includes("drop");
                  const isPromoted = !!(student as any).isPromoted;
                  // isPromoted=true covers both "promoted" and "detained" (same flag set by promotion route)
                  const promotionStatus: "promoted" | "detained" | "dropped" | null =
                    isDropped ? "dropped" : isPromoted ? "promoted" : null;
                  const isLocked = promotionStatus !== null;

                  return (
                    <TableRow key={student.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!isActive ? "opacity-80" : ""} ${isLocked ? "bg-slate-50/60 dark:bg-slate-800/20" : ""}`}>
                      <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          {student.studentName}
                          {promotionStatus === "dropped" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700 whitespace-nowrap">
                              <Lock className="h-2.5 w-2.5" /> Dropped
                            </span>
                          )}
                          {promotionStatus === "promoted" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700 whitespace-nowrap">
                              <Lock className="h-2.5 w-2.5" /> Promoted
                            </span>
                          )}
                        </div>
                        {student.fatherName && <div className="text-xs text-slate-400">{student.fatherName}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {student.className || "—"}{student.sectionName ? ` / ${student.sectionName}` : ""}
                      </TableCell>
                      <TableCell>
                        {student.vehicleName ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-medium">
                              <Bus className="h-3 w-3 mr-1" />{student.vehicleName}
                            </Badge>
                            {student.tripName && <div className="text-xs text-slate-500">{student.tripName}</div>}
                          </div>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {price > 0 ? `₹${price.toLocaleString("en-IN")}/mo` : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className="text-teal-700 dark:text-teal-400 font-medium">{MONTH_SHORT[fromM]}</span>
                        {stopM !== null && (
                          <><span className="text-slate-400 mx-1">→</span><span className="text-red-500 font-medium">{MONTH_SHORT[stopM]}</span></>
                        )}
                        {isActive && stopM === null && <span className="text-slate-400 ml-1 text-[10px]">active</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {activeMonths.length === 0 ? (
                          <span className="text-slate-400 italic">none</span>
                        ) : (
                          <div className="flex flex-wrap gap-0.5">
                            {activeMonths.map(m => (
                              <span key={m} className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                {MONTH_SHORT[m]}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {generatedAmt > 0 ? fmt(generatedAmt) : <span className="text-slate-400 font-normal text-xs">₹0</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {annualAmt > 0 ? fmt(annualAmt) : <span className="text-slate-400 text-xs">₹0</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                        {paidAmt > 0 ? fmt(paidAmt) : <span className="text-slate-400 font-normal text-xs">₹0</span>}
                      </TableCell>

                      {/* Activate / Deactivate cell */}
                      <TableCell className="py-2">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-full border border-slate-300 dark:border-slate-600">
                            <Lock className="h-3 w-3" />
                            Locked — {promotionStatus === "dropped" ? "student dropped" : "session promoted"}
                          </span>
                        ) : isActive ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-200 dark:border-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                              Active
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isDeactivating}
                              onClick={() => deactivateTransport(student.id, student)}
                              className="h-6 px-2 text-[11px] text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                            >
                              <Square className="h-2.5 w-2.5 mr-1" />
                              {isDeactivating ? "…" : "Stop"}
                            </Button>
                          </div>
                        ) : availableMonths.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">All months paid</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 font-medium">Select month to activate from:</div>
                            <div className="flex flex-wrap gap-1">
                              {availableMonths.map((m) => (
                                <button
                                  key={m}
                                  disabled={isActivating}
                                  onClick={() => activateFromMonth(student.id, m, student)}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={`Activate transport from ${MONTH_FULL[m]}`}
                                >
                                  {MONTH_SHORT[m]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteTarget(student)}
                          title="Remove from transport"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 px-4 py-3 text-xs text-teal-800 dark:text-teal-300">
        <strong>How it works:</strong> For inactive students, click any <strong>unpaid month</strong> to activate fee from that month forward.
        Already-paid months are hidden so you can't accidentally re-charge them.
        To stop an active student's fee, click the <strong>Stop</strong> button — fee stops from the current month.
        Previously paid transport fees remain visible in the Fee Collection page even after re-activation or re-assignment.
      </div>

      {/* Remove from transport confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Transport?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.studentName}</strong> will be removed from the Transport Manager.
              <br /><br />
              Their student record, attendance, and all payment history will remain intact.
              Transport fee will stop generating from this month. Previously collected transport
              fee amounts will still be visible in the Fee Collection page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={removing}
              onClick={() => removeFromTransport(deleteTarget)}
            >
              {removing ? "Removing…" : "Remove from Transport"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
