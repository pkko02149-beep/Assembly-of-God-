import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  useListStudents, useCreateStudent, useDeleteStudent, useUpdateStudent,
  useListVehicles, useListTrips, useListClasses, useListSections,
  useGetNextRoll, getGetNextRollQueryKey,
  getListStudentsQueryKey,
  useGetMonthlyStats, getGetMonthlyStatsQueryKey,
  type StudentMonthlyStats,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatWhatsappNumber, isAdmin, canEdit, canDelete } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash2, MessageCircle, Pencil, RotateCcw, Users, Bus, Phone, PhoneMissed, Download, BadgeCheck, ChevronLeft, ChevronRight, TrendingUp, Mail, ChevronDown, Camera, UserCircle2, Video, X, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentImportTab from "./student-import-tab";
import { SessionStatusBadge, getSessionStatus } from "@/components/session-status-badge";

const studentSchema = z.object({
  studentName: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  hasVehicle: z.boolean().default(false),
  vehicleId: z.string().optional(),
  hasTrip: z.boolean().default(false),
  tripId: z.string().optional(),
  transportRouteId: z.string().optional(),
  transportFromMonth: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1, "Section is required"),
  whatsappNumber: z.string().optional(),
  parentEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  // Extended fields
  photoUrl: z.string().optional(),
  admissionDate: z.string().optional(),
  studentType: z.string().optional(),
  session: z.string().optional(),
  dateOfBirth: z.string().optional(),
  motherName: z.string().optional(),
  aadharNumber: z.string().max(12, "Must be 12 digits").regex(/^\d{0,12}$/, "Numbers only").optional().or(z.literal("")),
  panNumber: z.string().optional(),
  gender: z.string().optional(),
  previousSchool: z.string().optional(),
  previousYearDue: z.string().optional(),
  previousYearDueRemarks: z.string().optional(),
  feeFromApril: z.boolean().default(false),
  category: z.string().optional(),
  religion: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  emergencyContact: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

const TRANSPORT_FROM_MONTH_OPTIONS = [
  { value: "4", label: "April" }, { value: "5", label: "May" },
  { value: "6", label: "June" }, { value: "7", label: "July" },
  { value: "8", label: "August" }, { value: "9", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" },
  { value: "12", label: "December" }, { value: "1", label: "January" },
  { value: "2", label: "February" }, { value: "3", label: "March" },
];

interface EditTarget {
  id: number;
  studentName: string;
  fatherName: string;
  hasVehicle: boolean;
  vehicleId: number | null;
  hasTrip: boolean;
  tripId: number | null;
  transportRouteId?: number | null;
  transportFromMonth?: number;
  classId: number;
  sectionId: number;
  whatsappNumber: string;
  parentEmail: string;
  address: string;
  photoUrl: string;
  admissionDate: string;
  studentType: string;
  session: string;
  dateOfBirth: string;
  motherName: string;
  aadharNumber: string;
  panNumber: string;
  gender: string;
  previousSchool: string;
  previousYearDue: string;
  previousYearDueRemarks: string;
  feeFromApril?: boolean;
  category?: string;
  religion?: string;
  bloodGroup?: string;
  nationality?: string;
  emergencyContact?: string;
}

function getAutoSession() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PREV_YEAR_MONTHS = [
  { num: 4, label: "April" }, { num: 5, label: "May" }, { num: 6, label: "June" },
  { num: 7, label: "July" }, { num: 8, label: "August" }, { num: 9, label: "September" },
  { num: 10, label: "October" }, { num: 11, label: "November" }, { num: 12, label: "December" },
  { num: 1, label: "January" }, { num: 2, label: "February" }, { num: 3, label: "March" },
];

function calcPrevYearTotal(amounts: Record<number, string>): number {
  return Object.values(amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
}

function parsePrevYearMonthlyAmounts(remarks: string): Record<number, string> {
  try {
    if (remarks && remarks.startsWith("{")) {
      const parsed = JSON.parse(remarks) as Record<string, number>;
      const result: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[parseInt(k)] = String(v);
      }
      return result;
    }
  } catch { /* ignore */ }
  return {};
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PhotoUpload({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch { /* ignore */ }
    e.target.value = "";
  }, [onChange]);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setShowWebcam(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      cameraRef.current?.click();
    }
  }, []);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }, []);

  const snapPhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const MAX = 200;
    let w = video.videoWidth, h = video.videoHeight;
    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
    else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    onChange(canvas.toDataURL("image/jpeg", 0.82));
    stopWebcam();
  }, [onChange, stopWebcam]);

  useEffect(() => { return () => { streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      {showWebcam ? (
        <div className="relative w-36 h-40 rounded-lg overflow-hidden border-2 border-amber-400 bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-2 px-1">
            <Button type="button" size="sm" className="h-7 bg-amber-500 hover:bg-amber-600 text-black text-xs px-2" onClick={snapPhoto}>
              <Camera className="h-3.5 w-3.5 mr-1" />Snap
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs px-2" onClick={stopWebcam}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="w-24 h-28 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500 transition-colors"
          onClick={() => galleryRef.current?.click()}
          title="Click to upload from gallery"
        >
          {value ? (
            <img src={value} alt="Student" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-amber-400">
              <UserCircle2 className="h-10 w-10" />
              <span className="text-[10px] text-amber-500 font-medium">Upload photo</span>
            </div>
          )}
        </div>
      )}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <div className="flex gap-1.5 flex-wrap justify-center">
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2 border-amber-300 text-amber-700" onClick={() => galleryRef.current?.click()}>
          Gallery
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2 border-amber-300 text-amber-700" onClick={startWebcam}>
          <Video className="h-2.5 w-2.5 mr-0.5" />Webcam
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2 border-amber-300 text-amber-700" onClick={() => cameraRef.current?.click()}>
          <Camera className="h-2.5 w-2.5 mr-0.5" />Camera
        </Button>
      </div>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="text-xs text-red-500 h-6 px-2" onClick={() => { onChange(""); }}>
          Remove
        </Button>
      )}
      <span className="text-[10px] text-slate-400">Auto-compressed on upload</span>
    </div>
  );
}

export default function RecordsTab({ activeSession }: { activeSession?: string | null }) {
  const effectiveSession = activeSession || getAutoSession();
  const [search, setSearch] = useState("");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [tripId, setTripId] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<any | null>(null);
  const [reassignVehicleId, setReassignVehicleId] = useState<string>("");
  const [reassignTripId, setReassignTripId] = useState<string>("");
  const [reassignRouteId, setReassignRouteId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showEditMoreDetails, setShowEditMoreDetails] = useState(false);

  // Previous Year Monthly Amount state
  const [showPrevYearMonths, setShowPrevYearMonths] = useState(false);
  const [prevMonthAmounts, setPrevMonthAmounts] = useState<Record<number, string>>({});
  const [showEditPrevYearMonths, setShowEditPrevYearMonths] = useState(false);
  const [editPrevMonthAmounts, setEditPrevMonthAmounts] = useState<Record<number, string>>({});

  const now = new Date();
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth() + 1);

  function prevMonth() {
    if (statsMonth === 1) { setStatsYear(y => y - 1); setStatsMonth(12); }
    else setStatsMonth(m => m - 1);
  }
  function nextMonth() {
    const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (statsMonth === 12) { setStatsYear(y => y + 1); setStatsMonth(1); }
    else setStatsMonth(m => m + 1);
  }

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useListStudents({
    search: search || undefined,
    vehicleId: vehicleId !== "all" ? parseInt(vehicleId) : undefined,
    tripId: tripId !== "all" ? parseInt(tripId) : undefined,
    classId: classId !== "all" ? parseInt(classId) : undefined,
    sectionId: sectionId !== "all" ? parseInt(sectionId) : undefined,
  });

  const { data: vehicles = [] } = useListVehicles();
  const { data: trips = [] } = useListTrips();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const { data: transportRoutes = [] } = useQuery<{ id: number; name: string; pricePerMonth: number }[]>({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await fetch("/api/transport-routes");
      if (!res.ok) throw new Error("Failed to fetch transport routes");
      return res.json();
    },
  });

  const monthStatsParams = { year: statsYear, month: statsMonth };
  const { data: monthlyStats = [] } = useGetMonthlyStats(
    monthStatsParams,
    { query: { queryKey: getGetMonthlyStatsQueryKey(monthStatsParams) } }
  );
  const statsById = useMemo<Map<number, StudentMonthlyStats>>(() => new Map(monthlyStats.map(s => [s.studentId, s])), [monthlyStats]);

  const withContact = useMemo(() => students.filter(s => s.whatsappNumber).length, [students]);
  const withoutContact = useMemo(() => students.filter(s => !s.whatsappNumber).length, [students]);
  const vehiclesRepresented = useMemo(() => new Set(students.map(s => s.vehicleId).filter(Boolean)).size, [students]);

  const hasActiveFilters = !!(search || vehicleId !== "all" || tripId !== "all" || classId !== "all" || sectionId !== "all");

  const createStudent = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student added successfully" });
        addForm.reset();
        setShowMoreDetails(false);
      },
    }
  });

  const updateStudent = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student updated" });
        setEditTarget(null);
        setIsSaving(false);
      },
      onError: () => {
        toast({ title: "Failed to update student", variant: "destructive" });
        setIsSaving(false);
      }
    }
  });

  const deleteStudent = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student deleted" });
      }
    }
  });

  const addForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      studentName: "", fatherName: "", hasVehicle: false, vehicleId: "", hasTrip: false, tripId: "",
      transportRouteId: "", transportFromMonth: "4",
      classId: "", sectionId: "", whatsappNumber: "", parentEmail: "", address: "",
      photoUrl: "", admissionDate: "", studentType: "New", session: effectiveSession,
      dateOfBirth: "", motherName: "", aadharNumber: "", panNumber: "", gender: "", previousSchool: "",
      previousYearDue: "0", previousYearDueRemarks: "", feeFromApril: false, category: "", religion: "",
      bloodGroup: "", nationality: "", emergencyContact: "",
    },
  });

  const editForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      studentName: "", fatherName: "", hasVehicle: false, vehicleId: "", hasTrip: false, tripId: "",
      transportRouteId: "", transportFromMonth: "4",
      classId: "", sectionId: "", whatsappNumber: "", parentEmail: "", address: "",
      photoUrl: "", admissionDate: "", studentType: "", session: effectiveSession,
      dateOfBirth: "", motherName: "", aadharNumber: "", panNumber: "", gender: "", previousSchool: "",
      previousYearDue: "0", previousYearDueRemarks: "", feeFromApril: false, category: "", religion: "",
      bloodGroup: "", nationality: "", emergencyContact: "",
    },
  });

  const addHasVehicle = addForm.watch("hasVehicle");
  const editHasVehicle = editForm.watch("hasVehicle");

  const watchClassId = addForm.watch("classId");
  const watchSectionId = addForm.watch("sectionId");

  const nextRollParams = { classId: parseInt(watchClassId || "0"), sectionId: parseInt(watchSectionId || "0") };
  const { data: nextRoll } = useGetNextRoll(
    nextRollParams,
    { query: { enabled: !!(watchClassId && watchSectionId), queryKey: getGetNextRollQueryKey(nextRollParams) } }
  );

  function onAdd(values: StudentFormValues) {
    createStudent.mutate({
      data: {
        studentName: values.studentName,
        fatherName: values.fatherName?.trim() || "",
        hasVehicle: values.hasVehicle,
        vehicleId: values.hasVehicle && values.vehicleId ? parseInt(values.vehicleId) : null,
        hasTrip: values.hasVehicle,
        tripId: values.hasVehicle && values.tripId ? parseInt(values.tripId) : null,
        transportRouteId: values.hasVehicle && values.transportRouteId ? parseInt(values.transportRouteId) : null,
        transportFromMonth: values.transportFromMonth ? parseInt(values.transportFromMonth) : 4,
        classId: parseInt(values.classId),
        sectionId: parseInt(values.sectionId),
        whatsappNumber: values.whatsappNumber?.trim() || "",
        parentEmail: values.parentEmail?.trim() || "",
        address: values.address?.trim() || "",
        photoUrl: values.photoUrl || "",
        admissionDate: values.admissionDate || "",
        studentType: values.studentType || "",
        session: values.session || effectiveSession,
        dateOfBirth: values.dateOfBirth || "",
        motherName: values.motherName?.trim() || "",
        aadharNumber: values.aadharNumber?.trim() || "",
        panNumber: values.panNumber?.trim() || "",
        gender: values.gender || "",
        previousSchool: values.previousSchool?.trim() || "",
        bloodGroup: values.bloodGroup?.trim() || "",
        nationality: values.nationality?.trim() || "",
        emergencyContact: values.emergencyContact?.trim() || "",
        previousYearDue: showPrevYearMonths ? calcPrevYearTotal(prevMonthAmounts) : parseFloat(values.previousYearDue || "0") || 0,
        previousYearDueRemarks: showPrevYearMonths
          ? JSON.stringify(Object.fromEntries(
              Object.entries(prevMonthAmounts)
                .map(([k, v]) => [k, parseFloat(v) || 0])
                .filter(([, v]) => (v as number) > 0)
            ))
          : values.previousYearDueRemarks?.trim() || "",
        feeFromApril: values.feeFromApril ?? false,
        category: values.category || "",
        religion: values.religion || "",
      } as any
    });
  }

  function openReassign(student: any) {
    setReassignTarget(student);
    setReassignVehicleId(student.vehicleId ? String(student.vehicleId) : "");
    setReassignTripId(student.tripId ? String(student.tripId) : "");
    setReassignRouteId(student.transportRouteId ? String(student.transportRouteId) : "");
  }

  async function handleReassign() {
    if (!reassignTarget || !reassignVehicleId || !reassignRouteId) return;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    setIsReassigning(true);
    try {
      const s = reassignTarget;
      const body = {
        studentName: s.studentName, fatherName: s.fatherName || "",
        hasVehicle: true, vehicleId: parseInt(reassignVehicleId),
        hasTrip: !!reassignTripId, tripId: reassignTripId ? parseInt(reassignTripId) : null,
        transportRouteId: parseInt(reassignRouteId),
        transportFromMonth: (() => {
          // If deactivated in this same month, start from NEXT month to avoid double-charging May
          const stopM: number | null = s.transportStopMonth ?? null;
          if (stopM !== null && stopM === currentMonth) return currentMonth === 12 ? 1 : currentMonth + 1;
          return currentMonth;
        })(),
        transportStopMonth: null,
        transportMonths: s.transportMonths ?? 12,
        classId: s.classId, sectionId: s.sectionId,
        whatsappNumber: s.whatsappNumber || "", parentEmail: s.parentEmail || "",
        address: s.address || "", photoUrl: s.photoUrl || "",
        admissionDate: s.admissionDate || "", studentType: s.studentType || "",
        session: s.session || "", dateOfBirth: s.dateOfBirth || "",
        motherName: s.motherName || "", aadharNumber: s.aadharNumber || "",
        panNumber: s.panNumber || "", gender: s.gender || "",
        previousSchool: s.previousSchool || "",
        previousYearDue: s.previousYearDue ?? 0, previousYearDueRemarks: s.previousYearDueRemarks || "",
        feeFromApril: s.feeFromApril ?? false, category: s.category || "", religion: s.religion || "",
      };
      const res = await fetch(`/api/students/${s.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: `${s.studentName} re-assigned to transport from ${new Date(now.getFullYear(), currentMonth - 1, 1).toLocaleString("default", { month: "long" })}` });
      setReassignTarget(null);
    } catch {
      toast({ title: "Failed to re-assign transport", variant: "destructive" });
    } finally {
      setIsReassigning(false);
    }
  }

  function openEdit(student: EditTarget) {
    setEditTarget(student);
    editForm.reset({
      studentName: student.studentName,
      fatherName: student.fatherName || "",
      hasVehicle: student.hasVehicle || student.hasTrip,
      vehicleId: student.vehicleId?.toString() || "",
      hasTrip: student.hasVehicle || student.hasTrip,
      tripId: student.tripId?.toString() || "",
      transportRouteId: student.transportRouteId?.toString() || "",
      transportFromMonth: String(student.transportFromMonth ?? 4),
      classId: student.classId.toString(),
      sectionId: student.sectionId.toString(),
      whatsappNumber: student.whatsappNumber || "",
      parentEmail: student.parentEmail || "",
      address: student.address || "",
      photoUrl: student.photoUrl || "",
      admissionDate: student.admissionDate || "",
      studentType: student.studentType || "",
      session: student.session || effectiveSession,
      dateOfBirth: student.dateOfBirth || "",
      motherName: student.motherName || "",
      aadharNumber: student.aadharNumber || "",
      panNumber: student.panNumber || "",
      gender: student.gender || "",
      previousSchool: student.previousSchool || "",
      previousYearDue: String(student.previousYearDue || "0"),
      previousYearDueRemarks: student.previousYearDueRemarks || "",
      feeFromApril: student.feeFromApril ?? false,
      category: (student as any).category || "",
      religion: (student as any).religion || "",
    });
    setShowEditMoreDetails(!!(student.dateOfBirth || student.motherName || student.aadharNumber || student.panNumber || student.gender || student.previousSchool));
    // Parse monthly breakdown if available
    const parsedMonthly = parsePrevYearMonthlyAmounts(student.previousYearDueRemarks || "");
    if (Object.keys(parsedMonthly).length > 0) {
      setShowEditPrevYearMonths(true);
      setEditPrevMonthAmounts(parsedMonthly);
    } else {
      setShowEditPrevYearMonths(false);
      setEditPrevMonthAmounts({});
    }
  }

  function onSaveEdit(values: StudentFormValues) {
    if (!editTarget) return;
    setIsSaving(true);
    updateStudent.mutate({
      id: editTarget.id,
      data: {
        studentName: values.studentName,
        fatherName: values.fatherName?.trim() || "",
        hasVehicle: values.hasVehicle,
        vehicleId: values.hasVehicle && values.vehicleId ? parseInt(values.vehicleId) : null,
        hasTrip: values.hasVehicle,
        tripId: values.hasVehicle && values.tripId ? parseInt(values.tripId) : null,
        transportRouteId: values.hasVehicle && values.transportRouteId ? parseInt(values.transportRouteId) : null,
        transportFromMonth: values.transportFromMonth ? parseInt(values.transportFromMonth) : 4,
        classId: parseInt(values.classId),
        sectionId: parseInt(values.sectionId),
        whatsappNumber: values.whatsappNumber?.trim() || "",
        parentEmail: values.parentEmail?.trim() || "",
        address: values.address?.trim() || "",
        photoUrl: values.photoUrl || "",
        admissionDate: values.admissionDate || "",
        studentType: values.studentType || "",
        session: values.session || effectiveSession,
        dateOfBirth: values.dateOfBirth || "",
        motherName: values.motherName?.trim() || "",
        aadharNumber: values.aadharNumber?.trim() || "",
        panNumber: values.panNumber?.trim() || "",
        gender: values.gender || "",
        previousSchool: values.previousSchool?.trim() || "",
        previousYearDue: showEditPrevYearMonths ? calcPrevYearTotal(editPrevMonthAmounts) : parseFloat(values.previousYearDue || "0") || 0,
        previousYearDueRemarks: showEditPrevYearMonths
          ? JSON.stringify(Object.fromEntries(
              Object.entries(editPrevMonthAmounts)
                .map(([k, v]) => [k, parseFloat(v) || 0])
                .filter(([, v]) => (v as number) > 0)
            ))
          : values.previousYearDueRemarks?.trim() || "",
        feeFromApril: values.feeFromApril ?? false,
        category: values.category || "",
        religion: values.religion || "",
      } as any
    });
  }

  const openWhatsapp = (number: string, name: string) => {
    if (!number) return;
    const formatted = formatWhatsappNumber(number);
    const msg = `Hello parent of ${name}, this is an update regarding their school bus trip.`;
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const resetFilters = () => {
    setSearch(""); setVehicleId("all"); setTripId("all");
    setClassId("all"); setSectionId("all");
  };

  function exportStudentsCSV() {
    if (students.length === 0) return;
    const headers = ["Roll No", "Student ID", "Student Name", "Father's Name", "Mother's Name", "Class", "Section", "Vehicle", "Trip", "WhatsApp", "Address", "Admission Date", "DOB", "Gender"];
    const rows = students.map(s => [
      s.rollNo ?? "",
      s.uniqueId ?? "",
      s.studentName,
      s.fatherName || "",
      (s as any).motherName || "",
      s.className || "",
      s.sectionName || "",
      s.hasVehicle && s.vehicleName ? s.vehicleName : "",
      s.hasTrip && s.tripName ? s.tripName : "",
      s.whatsappNumber || "",
      s.address || "",
      (s as any).admissionDate || "",
      (s as any).dateOfBirth || "",
      (s as any).gender || "",
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Tabs defaultValue="records" className="w-full">
      <TabsList className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl h-auto gap-1 mb-6">
        <TabsTrigger value="records" className="rounded-lg text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">
          <Users className="h-4 w-4 mr-2" /> Records &amp; Export
        </TabsTrigger>
        <TabsTrigger value="import" className="rounded-lg text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
          <Upload className="h-4 w-4 mr-2" /> Import
        </TabsTrigger>
      </TabsList>

      <TabsContent value="records" className="focus-visible:outline-none">
      <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Records</h2>
        <Button
          variant="outline"
          onClick={exportStudentsCSV}
          disabled={students.length === 0}
          className="bg-white dark:bg-slate-900 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV ({students.length})
        </Button>
      </div>

      {/* Add Student Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Add New Student</h3>
        <Form {...addForm}>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-4">

            {/* Photo + Admission Date + Type/Session row */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Photo upload */}
              <FormField control={addForm.control} name="photoUrl" render={({ field }) => (
                <FormItem className="flex flex-col items-center">
                  <FormLabel className="flex items-center gap-1.5 mb-1"><Camera className="h-3.5 w-3.5 text-amber-500" />Student Photo</FormLabel>
                  <FormControl>
                    <PhotoUpload value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex-1 space-y-4">
                {/* Admission Date */}
                <FormField control={addForm.control} name="admissionDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={addForm.control} name="studentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">Student Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="New / Old" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Old">Old</SelectItem>
                          <SelectItem value="RTE">RTE (Right to Education)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="session" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">Session <span className="text-[10px] font-normal text-green-600">(auto)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2025-26" {...field} className="bg-green-50 dark:bg-green-900/10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>

            <FormField
              control={addForm.control}
              name="studentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full student name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={addForm.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addForm.control} name="sectionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger></FormControl>
                    <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Unique ID / Roll preview */}
            {watchClassId && watchSectionId && nextRoll && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
                <BadgeCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wide">Student ID</span>
                    <p className="text-sm font-mono font-bold text-amber-900 dark:text-amber-200">{nextRoll.uniqueId}</p>
                  </div>
                  <div>
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wide">Roll No</span>
                    <p className="text-sm font-mono font-bold text-amber-900 dark:text-amber-200">{nextRoll.rollNo}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 ml-auto">Auto-assigned on save</p>
              </div>
            )}

            {/* Fee from April checkbox */}
            <FormField control={addForm.control} name="feeFromApril" render={({ field }) => (
              <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20 cursor-pointer">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} id="add-fee-from-april" />
                </FormControl>
                <div>
                  <FormLabel htmlFor="add-fee-from-april" className="cursor-pointer font-semibold text-teal-800 dark:text-teal-200 mb-0">
                    Fee From April
                  </FormLabel>
                  <p className="text-xs text-teal-600 dark:text-teal-400">If checked, fees are generated from April (start of school year). Uncheck for mid-year admissions.</p>
                </div>
              </FormItem>
            )} />

            {/* Assign Bus and Trip */}
            <div className="space-y-3">
              <FormField control={addForm.control} name="hasVehicle" render={({ field }) => (
                <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="add-assign-bus-trip" />
                  </FormControl>
                  <FormLabel htmlFor="add-assign-bus-trip" className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200 mb-0">
                    Assign Bus and Trip
                  </FormLabel>
                </FormItem>
              )} />
              {addHasVehicle && (
                <div className="ml-4 pl-2 border-l-2 border-amber-400 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="vehicleId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl>
                          <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="tripId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trip</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger></FormControl>
                          <SelectContent>{trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <FormField control={addForm.control} name="transportRouteId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                          <Bus className="h-3.5 w-3.5" /> Transport Route
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select route (optional)" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {transportRoutes.length === 0
                              ? <SelectItem value="none" disabled>No routes — add in Settings</SelectItem>
                              : transportRoutes.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — ₹{r.pricePerMonth}/mo</SelectItem>)
                            }
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="transportFromMonth" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-amber-800 dark:text-amber-300 font-semibold">Fee From Month</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TRANSPORT_FROM_MONTH_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={addForm.control} name="fatherName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-500">Father's Name <span className="text-xs font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Enter father's name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addForm.control} name="whatsappNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-500">Contact Number <span className="text-xs font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="9876543210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={addForm.control} name="parentEmail" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  Parent Email <span className="text-xs font-normal">(optional — for attendance notifications)</span>
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="parent@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={addForm.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-500">Address <span className="text-xs font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="House no., street, area..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* More Details collapsible */}
            <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMoreDetails(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                  More Details
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showMoreDetails ? "rotate-180" : ""}`} />
              </button>
              {showMoreDetails && (
                <div className="p-5 space-y-4 bg-amber-50 dark:bg-amber-900/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="dateOfBirth" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="motherName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mother's Name</FormLabel>
                        <FormControl><Input placeholder="Enter mother's name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="aadharNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aadhar Number <span className="text-xs font-normal text-slate-400">(12 digits)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="xxxx xxxx xxxx"
                            maxLength={12}
                            {...field}
                            onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="panNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>PEN Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="PEN1234567"
                            {...field}
                            onChange={e => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="previousSchool" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous School Name</FormLabel>
                        <FormControl><Input placeholder="Previous school name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={addForm.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="General">General</SelectItem>
                            <SelectItem value="OBC">OBC</SelectItem>
                            <SelectItem value="SC">SC</SelectItem>
                            <SelectItem value="ST">ST</SelectItem>
                            <SelectItem value="RTE">RTE</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="religion" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Religion</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Hindu">Hindu</SelectItem>
                            <SelectItem value="Muslim">Muslim</SelectItem>
                            <SelectItem value="Sikh">Sikh</SelectItem>
                            <SelectItem value="Ishai">Ishai</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  {/* Additional Details */}
                  <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
                    <div className="bg-blue-500 text-white px-4 py-2 text-sm font-bold uppercase tracking-wide">Additional Details</div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={addForm.control} name="bloodGroup" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Blood Group</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="A+">A+</SelectItem>
                                <SelectItem value="A-">A-</SelectItem>
                                <SelectItem value="B+">B+</SelectItem>
                                <SelectItem value="B-">B-</SelectItem>
                                <SelectItem value="AB+">AB+</SelectItem>
                                <SelectItem value="AB-">AB-</SelectItem>
                                <SelectItem value="O+">O+</SelectItem>
                                <SelectItem value="O-">O-</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={addForm.control} name="nationality" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl><Input placeholder="e.g. Indian" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={addForm.control} name="emergencyContact" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact</FormLabel>
                          <FormControl><Input placeholder="Emergency contact name & number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  {/* Previous Year New Amount — checkbox + 12 month inputs */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                      <Checkbox
                        id="add-prev-year-new-amount"
                        checked={showPrevYearMonths}
                        onCheckedChange={(v) => {
                          setShowPrevYearMonths(!!v);
                          if (!v) setPrevMonthAmounts({});
                        }}
                      />
                      <label htmlFor="add-prev-year-new-amount" className="cursor-pointer font-semibold text-red-700 dark:text-red-400 text-sm">
                        Previous Year Due Amount
                      </label>
                    </div>
                    {showPrevYearMonths && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {PREV_YEAR_MONTHS.map(({ num, label }) => (
                            <div key={num} className="space-y-1">
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
                              <Input
                                type="number" min="0" step="1" placeholder="0"
                                value={prevMonthAmounts[num] || ""}
                                onChange={e => setPrevMonthAmounts(prev => ({ ...prev, [num]: e.target.value }))}
                                className="h-8 text-sm border-red-200 focus-visible:ring-red-400"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 bg-red-600 text-white rounded-lg">
                          <span className="text-sm font-semibold">Total Previous Year Due Amount:</span>
                          <span className="text-lg font-bold">₹{calcPrevYearTotal(prevMonthAmounts).toFixed(0)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={createStudent.isPending} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8">
                {createStudent.isPending ? "Adding..." : "Add Student"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-slate-400" /><p className="text-xs text-slate-500 uppercase tracking-wide">Students</p></div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{students.length}</p>
          {hasActiveFilters && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Filtered view</p>}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Bus className="h-4 w-4 text-slate-400" /><p className="text-xs text-slate-500 uppercase tracking-wide">Vehicles</p></div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{vehiclesRepresented}</p>
          <p className="text-xs text-slate-400 mt-1">in this view</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Phone className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500 uppercase tracking-wide">With Contact</p></div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-500">{withContact}</p>
          <p className="text-xs text-slate-400 mt-1">have WhatsApp</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><PhoneMissed className="h-4 w-4 text-red-400" /><p className="text-xs text-slate-500 uppercase tracking-wide">No Contact</p></div>
          <p className="text-3xl font-bold text-red-500">{withoutContact}</p>
          <p className="text-xs text-slate-400 mt-1">missing number</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by student name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-slate-50 dark:bg-slate-950" />
        </div>
        <div className="w-full md:w-40">
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger><SelectValue placeholder="All Vehicles" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Vehicles</SelectItem>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <Select value={tripId} onValueChange={setTripId}>
            <SelectTrigger><SelectValue placeholder="All Trips" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Trips</SelectItem>{trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Sections</SelectItem>{sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={resetFilters} disabled={!hasActiveFilters} className="shrink-0 text-slate-600 dark:text-slate-400" title="Reset all filters">
          <RotateCcw className="h-4 w-4 mr-1" />Reset
        </Button>
      </div>

      {/* Student Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Month picker header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Monthly attendance rate:</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 min-w-[110px] text-center">
              {MONTH_NAMES[statsMonth - 1]} {statsYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-950/50">
            <TableRow>
              <TableHead className="font-semibold w-12">Photo</TableHead>
              <TableHead className="font-semibold w-16">#</TableHead>
              <TableHead className="font-semibold">ID</TableHead>
              <TableHead className="font-semibold">Student</TableHead>
              <TableHead className="font-semibold">Father's Name</TableHead>
              <TableHead className="font-semibold">Class / Sec</TableHead>
              <TableHead className="font-semibold text-center">This Month %</TableHead>
              <TableHead className="font-semibold">Vehicle</TableHead>
              <TableHead className="font-semibold">Trip</TableHead>
              <TableHead className="font-semibold">Contact</TableHead>
              <TableHead className="font-semibold">Address</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="h-32 text-center text-slate-500">Loading records...</TableCell></TableRow>
            ) : students.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="h-32 text-center text-slate-500">No student records found.</TableCell></TableRow>
            ) : (
              students.map((student) => {
                const sessionStatus = getSessionStatus((student as any).studentType);
                const isProcessed = !!(student as any).isPromoted;
                return (
                <TableRow key={student.id} className={isProcessed ? "opacity-60 bg-slate-50/80 dark:bg-slate-800/30" : ""}>
                  <TableCell>
                    {(student as any).photoUrl ? (
                      <img src={(student as any).photoUrl} alt={student.studentName} className="w-9 h-11 object-cover rounded-md border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-9 h-11 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <UserCircle2 className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400 font-mono text-xs">{student.rollNo || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400 font-semibold">{student.uniqueId || "—"}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    <div className="flex flex-col gap-1">
                      <span>{student.studentName}</span>
                      {sessionStatus && <SessionStatusBadge studentType={(student as any).studentType} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {student.fatherName || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                  </TableCell>
                  <TableCell>{student.className} - {student.sectionName}</TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const s = statsById.get(student.id);
                      if (!s || s.totalMarkedDays === 0) return <span className="text-xs text-slate-300 dark:text-slate-600 italic">No data</span>;
                      const pct = s.percentage;
                      const color = pct >= 75 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : pct >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>
                          <span className="text-[10px] text-slate-400">{s.presentDays}/{s.totalMarkedDays} days</span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {student.hasVehicle && student.vehicleName ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {student.vehicleName}
                      </span>
                    ) : (student as any).transportRouteId ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600">
                        removed
                      </span>
                    ) : <span className="text-slate-300 dark:text-slate-600 italic text-xs">none</span>}
                  </TableCell>
                  <TableCell>
                    {student.hasTrip && student.tripName ? student.tripName : <span className="text-slate-300 dark:text-slate-600 italic text-xs">none</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {student.whatsappNumber || <span className="text-slate-300 dark:text-slate-600 italic">not set</span>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[160px] truncate" title={student.address || ""}>
                    {student.address || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit("records") && (
                        <Button
                          variant="ghost" size="icon"
                          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          disabled={isProcessed}
                          title={isProcessed ? "Student session has been closed — cannot edit" : "Edit student"}
                          onClick={() => openEdit({
                            id: student.id,
                            studentName: student.studentName,
                            fatherName: student.fatherName || "",
                            hasVehicle: student.hasVehicle ?? false,
                            vehicleId: student.vehicleId ?? null,
                            hasTrip: student.hasTrip ?? false,
                            tripId: student.tripId ?? null,
                            transportRouteId: (student as any).transportRouteId ?? null,
                            transportFromMonth: (student as any).transportFromMonth ?? 4,
                            classId: student.classId!,
                            sectionId: student.sectionId!,
                            whatsappNumber: student.whatsappNumber || "",
                            parentEmail: (student as any).parentEmail || "",
                            address: student.address || "",
                            photoUrl: (student as any).photoUrl || "",
                            admissionDate: (student as any).admissionDate || "",
                            studentType: (student as any).studentType || "",
                            session: (student as any).session || "",
                            dateOfBirth: (student as any).dateOfBirth || "",
                            motherName: (student as any).motherName || "",
                            aadharNumber: (student as any).aadharNumber || "",
                            panNumber: (student as any).panNumber || "",
                            gender: (student as any).gender || "",
                            previousSchool: (student as any).previousSchool || "",
                            previousYearDue: String((student as any).previousYearDue || "0"),
                            previousYearDueRemarks: String((student as any).previousYearDueRemarks || ""),
                          })}
                          title="Edit student"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => openWhatsapp(student.whatsappNumber || "", student.studentName)}
                        disabled={!student.whatsappNumber}
                        title="Send WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      {canDelete("records") && !isProcessed && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white dark:bg-slate-900">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {student.studentName}?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteStudent.mutate({ id: student.id })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="space-y-4 pt-2">

              {/* Photo + Admission Date */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <FormField control={editForm.control} name="photoUrl" render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
                    <FormLabel className="flex items-center gap-1.5 mb-1"><Camera className="h-3.5 w-3.5 text-amber-500" />Photo</FormLabel>
                    <FormControl>
                      <PhotoUpload value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="flex-1 space-y-4">
                  <FormField control={editForm.control} name="admissionDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="studentType" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-500">Student Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="New / Old" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Old">Old</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="session" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-500">Session <span className="text-[10px] font-normal text-green-600">(auto)</span></FormLabel>
                        <FormControl><Input placeholder="e.g. 2025-26" {...field} className="bg-green-50 dark:bg-green-900/10" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={editForm.control} name="studentName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="fatherName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Father's Name</FormLabel>
                    <FormControl><Input placeholder="Father's name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="classId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="sectionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-3">
                <FormField control={editForm.control} name="hasVehicle" render={({ field }) => (
                  <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="edit-assign-bus-trip" /></FormControl>
                    <FormLabel htmlFor="edit-assign-bus-trip" className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200 mb-0">
                      Assign Bus and Trip
                    </FormLabel>
                  </FormItem>
                )} />
                {editHasVehicle && (
                  <div className="ml-4 pl-2 border-l-2 border-amber-400 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="vehicleId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl>
                            <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="tripId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trip</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger></FormControl>
                            <SelectContent>{trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                      <FormField control={editForm.control} name="transportRouteId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                            <Bus className="h-3.5 w-3.5" /> Transport Route
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select route (optional)" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {transportRoutes.length === 0
                                ? <SelectItem value="none" disabled>No routes — add in Settings</SelectItem>
                                : transportRoutes.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name} — ₹{r.pricePerMonth}/mo</SelectItem>)
                              }
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="transportFromMonth" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-amber-800 dark:text-amber-300 font-semibold">Fee From Month</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TRANSPORT_FROM_MONTH_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={editForm.control} name="whatsappNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Contact Number</FormLabel>
                    <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Address</FormLabel>
                    <FormControl><Input placeholder="House no., street, area..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="parentEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-500 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-500" />
                    Parent Email
                  </FormLabel>
                  <FormControl><Input type="email" placeholder="parent@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* More Details collapsible in edit */}
              <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowEditMoreDetails(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors"
                >
                  <span className="text-sm font-bold uppercase tracking-wide">More Details</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showEditMoreDetails ? "rotate-180" : ""}`} />
                </button>
                {showEditMoreDetails && (
                  <div className="p-5 space-y-4 bg-amber-50 dark:bg-amber-900/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="dateOfBirth" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="motherName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother's Name</FormLabel>
                          <FormControl><Input placeholder="Enter mother's name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="aadharNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aadhar Number <span className="text-xs font-normal text-slate-400">(12 digits)</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="xxxx xxxx xxxx"
                              maxLength={12}
                              {...field}
                              onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="panNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>PEN Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="PEN1234567"
                              {...field}
                              onChange={e => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="previousSchool" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previous School Name</FormLabel>
                          <FormControl><Input placeholder="Previous school name" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={editForm.control} name="category" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="General">General</SelectItem>
                              <SelectItem value="OBC">OBC</SelectItem>
                              <SelectItem value="SC">SC</SelectItem>
                              <SelectItem value="ST">ST</SelectItem>
                              <SelectItem value="RTE">RTE</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={editForm.control} name="religion" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religion</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Hindu">Hindu</SelectItem>
                              <SelectItem value="Muslim">Muslim</SelectItem>
                              <SelectItem value="Sikh">Sikh</SelectItem>
                              <SelectItem value="Ishai">Ishai</SelectItem>
                              <SelectItem value="Others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    {/* Previous Year New Amount — checkbox + 12 month inputs (Edit) */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                        <Checkbox
                          id="edit-prev-year-new-amount"
                          checked={showEditPrevYearMonths}
                          onCheckedChange={(v) => {
                            setShowEditPrevYearMonths(!!v);
                            if (!v) setEditPrevMonthAmounts({});
                          }}
                        />
                        <label htmlFor="edit-prev-year-new-amount" className="cursor-pointer font-semibold text-red-700 dark:text-red-400 text-sm">
                          Previous Year Due Amount
                        </label>
                      </div>
                      {showEditPrevYearMonths && (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            {PREV_YEAR_MONTHS.map(({ num, label }) => (
                              <div key={num} className="space-y-1">
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
                                <Input
                                  type="number" min="0" step="1" placeholder="0"
                                  value={editPrevMonthAmounts[num] || ""}
                                  onChange={e => setEditPrevMonthAmounts(prev => ({ ...prev, [num]: e.target.value }))}
                                  className="h-8 text-sm border-red-200 focus-visible:ring-red-400"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 bg-red-600 text-white rounded-lg">
                            <span className="text-sm font-semibold">Total Previous Year Due Amount:</span>
                            <span className="text-lg font-bold">₹{calcPrevYearTotal(editPrevMonthAmounts).toFixed(0)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Re-assign to Transport Dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(open) => { if (!open) setReassignTarget(null); }}>
        <DialogContent className="sm:max-w-sm bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-teal-600" />
              Re-assign to Transport
            </DialogTitle>
          </DialogHeader>
          {reassignTarget && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reassigning <strong>{reassignTarget.studentName}</strong> to transport.
                Fee will generate from <strong>{new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleString("default", { month: "long", year: "numeric" })}</strong>.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Vehicle <span className="text-red-500">*</span></label>
                  <Select value={reassignVehicleId} onValueChange={setReassignVehicleId}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Trip <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Select value={reassignTripId} onValueChange={setReassignTripId}>
                    <SelectTrigger><SelectValue placeholder="Select trip…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {trips.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Transport Route <span className="text-red-500">*</span></label>
                  <Select value={reassignRouteId} onValueChange={setReassignRouteId}>
                    <SelectTrigger><SelectValue placeholder="Select route…" /></SelectTrigger>
                    <SelectContent>
                      {transportRoutes.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name} — ₹{r.pricePerMonth}/mo</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setReassignTarget(null)} disabled={isReassigning}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={!reassignVehicleId || !reassignRouteId || isReassigning}
                  onClick={handleReassign}
                >
                  {isReassigning ? "Saving…" : "Re-assign"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>

      <TabsContent value="import" className="focus-visible:outline-none">
        <StudentImportTab />
      </TabsContent>
    </Tabs>
  );
}
