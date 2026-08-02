import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError } from "@/lib/jwt-api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Lock, UserPlus, Loader2, Clock, CheckCircle2,
  Camera, Mail, BadgeCheck, X, Upload, Video, Bus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionStatusBadge } from "@/components/session-status-badge";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Teacher {
  id: number; name: string;
  classAssigned: number | null; sectionAssigned: number | null;
  className?: string; sectionName?: string;
}

interface PermStatus {
  isLocked: boolean;
  expiresAt: string | null;
  grantedAt: string | null;
  effectivelyLocked: boolean;
}

interface ClassOption { id: number; name: string; }
interface SectionOption { id: number; name: string; }
interface VehicleOption { id: number; name: string; }
interface TripOption { id: number; name: string; }
interface TransportRouteOption { id: number; name: string; pricePerMonth: number; }

const PREV_YEAR_MONTHS = [
  { num: 4, label: "April" }, { num: 5, label: "May" }, { num: 6, label: "June" },
  { num: 7, label: "July" }, { num: 8, label: "August" }, { num: 9, label: "September" },
  { num: 10, label: "October" }, { num: 11, label: "November" }, { num: 12, label: "December" },
  { num: 1, label: "January" }, { num: 2, label: "February" }, { num: 3, label: "March" },
];

function calcPrevYearTotal(amounts: Record<number, string>): number {
  return Object.values(amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
}

const TRANSPORT_FROM_MONTH_OPTIONS = [
  { value: "April", label: "April" }, { value: "May", label: "May" },
  { value: "June", label: "June" }, { value: "July", label: "July" },
  { value: "August", label: "August" }, { value: "September", label: "September" },
  { value: "October", label: "October" }, { value: "November", label: "November" },
  { value: "December", label: "December" }, { value: "January", label: "January" },
  { value: "February", label: "February" }, { value: "March", label: "March" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getAutoSession() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
}

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
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
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onChange(await compressImage(file)); } catch { /* ignore */ }
    e.target.value = "";
  }, [onChange]);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setShowWebcam(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { galleryRef.current?.click(); }
  }, []);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    onChange(canvas.toDataURL("image/jpeg", 0.8));
    stopWebcam();
  }, [onChange, stopWebcam]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
        {value
          ? <img src={value} alt="Student" className="w-full h-full object-cover rounded-xl" />
          : <Camera className="h-8 w-8 text-slate-300" />
        }
      </div>
      {showWebcam && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Take Photo</span>
              <button onClick={stopWebcam}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black aspect-video" />
            <Button type="button" onClick={capture} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900">
              <Camera className="h-4 w-4 mr-2" /> Capture Photo
            </Button>
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => galleryRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" /> Upload
        </Button>
        <Button type="button" size="sm" variant="outline" className="text-xs h-7 px-2" onClick={startWebcam}>
          <Video className="h-3 w-3 mr-1" /> Camera
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 px-2 text-red-500" onClick={() => onChange("")}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Form Schema ────────────────────────────────────────────────────────────────
const studentSchema = z.object({
  studentName: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  photoUrl: z.string().optional(),
  admissionDate: z.string().optional(),
  studentType: z.string().optional(),
  session: z.string().optional(),
  dateOfBirth: z.string().optional(),
  motherName: z.string().optional(),
  aadharNumber: z.string().max(12).regex(/^\d{0,12}$/).optional().or(z.literal("")),
  panNumber: z.string().optional(),
  gender: z.string().optional(),
  previousSchool: z.string().optional(),
  whatsappNumber: z.string().optional(),
  parentEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  emergencyContact: z.string().optional(),
  feeFromApril: z.boolean().default(false),
  hasVehicle: z.boolean().default(false),
  vehicleId: z.string().optional(),
  tripId: z.string().optional(),
  transportRouteId: z.string().optional(),
  transportFromMonth: z.string().optional(),
});
type StudentFormValues = z.infer<typeof studentSchema>;

// ── Locked Screen ──────────────────────────────────────────────────────────────
function LockedScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-5">
        <Lock className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Tab is Locked</h2>
      <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
        The Student Records tab is currently locked by the admin. Please contact your administrator to get access.
      </p>
    </div>
  );
}

// ── Countdown Badge ────────────────────────────────────────────────────────────
function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState(() => formatCountdown(expiresAt));
  useEffect(() => {
    const interval = setInterval(() => setLabel(formatCountdown(expiresAt)), 30_000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 gap-1.5">
      <Clock className="w-3 h-3" /> {label}
    </Badge>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TeacherStudentRecords() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [permStatus, setPermStatus] = useState<PermStatus | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRouteOption[]>([]);
  const [nextRoll, setNextRoll] = useState<{ rollNo: number; uniqueId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPrevYearMonths, setShowPrevYearMonths] = useState(false);
  const [prevMonthAmounts, setPrevMonthAmounts] = useState<Record<number, string>>({});
  const [recentStudents, setRecentStudents] = useState<{ id: number; studentName: string; rollNo: number; uniqueId: string }[]>([]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      studentName: "", fatherName: "", photoUrl: "", admissionDate: "",
      studentType: "New", session: getAutoSession(),
      dateOfBirth: "", motherName: "", aadharNumber: "", panNumber: "",
      gender: "", previousSchool: "", whatsappNumber: "", parentEmail: "",
      address: "", category: "", religion: "", bloodGroup: "",
      nationality: "", emergencyContact: "", feeFromApril: false,
      hasVehicle: false, vehicleId: "", tripId: "", transportRouteId: "", transportFromMonth: "",
    },
  });

  const hasVehicle = form.watch("hasVehicle");

  // Load everything on mount
  useEffect(() => {
    const token = localStorage.getItem("teacher_token");
    if (!token) { navigate("/teacher/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, perm, cls, secs, veh, trp, routes] = await Promise.all([
        teacherApi.get<Teacher>("/auth/teacher/me"),
        teacherApi.get<PermStatus>("/teacher-admission-permission/my-status"),
        fetch("/api/classes").then(r => r.json()),
        fetch("/api/sections").then(r => r.json()),
        fetch("/api/vehicles").then(r => r.json()),
        fetch("/api/trips").then(r => r.json()),
        fetch("/api/transport-routes").then(r => r.json()),
      ]);
      setTeacher(t);
      setPermStatus(perm);
      setClasses(cls);
      setSections(secs);
      setVehicles(Array.isArray(veh) ? veh : []);
      setTrips(Array.isArray(trp) ? trp : []);
      setTransportRoutes(Array.isArray(routes) ? routes : []);

      // Load next roll if teacher has class/section assigned
      if (t.classAssigned && t.sectionAssigned && !perm.effectivelyLocked) {
        loadNextRoll(t.classAssigned, t.sectionAssigned);
        loadRecentStudents(t.classAssigned, t.sectionAssigned);
      }
    } catch (err) {
      if (isAuthError(err)) navigate("/teacher/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadNextRoll(classId: number, sectionId: number) {
    try {
      const data = await teacherApi.get<{ rollNo: number; uniqueId: string }>(
        `/students/next-roll?classId=${classId}&sectionId=${sectionId}`
      );
      setNextRoll(data);
    } catch { /* non-fatal */ }
  }

  async function loadRecentStudents(classId: number, sectionId: number) {
    try {
      const token = localStorage.getItem("teacher_token");
      const res = await fetch(`/api/students?classId=${classId}&sectionId=${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecentStudents(data.slice(-5).reverse());
      }
    } catch { /* non-fatal */ }
  }

  async function onSubmit(values: StudentFormValues) {
    if (!teacher?.classAssigned || !teacher?.sectionAssigned) {
      toast({ title: "No class/section assigned", description: "Contact admin to assign you a class.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("teacher_token");
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentName: values.studentName,
          fatherName: values.fatherName?.trim() || "",
          classId: teacher.classAssigned,
          sectionId: teacher.sectionAssigned,
          photoUrl: values.photoUrl || "",
          admissionDate: values.admissionDate || "",
          studentType: values.studentType || "New",
          session: values.session || getAutoSession(),
          dateOfBirth: values.dateOfBirth || "",
          motherName: values.motherName?.trim() || "",
          aadharNumber: values.aadharNumber?.trim() || "",
          panNumber: values.panNumber?.trim() || "",
          gender: values.gender || "",
          previousSchool: values.previousSchool?.trim() || "",
          whatsappNumber: values.whatsappNumber?.trim() || "",
          parentEmail: values.parentEmail?.trim() || "",
          address: values.address?.trim() || "",
          category: values.category || "",
          religion: values.religion || "",
          bloodGroup: values.bloodGroup?.trim() || "",
          nationality: values.nationality?.trim() || "",
          emergencyContact: values.emergencyContact?.trim() || "",
          feeFromApril: values.feeFromApril ?? false,
          hasVehicle: values.hasVehicle ?? false,
          hasTrip: values.hasVehicle ?? false,
          vehicleId: values.hasVehicle && values.vehicleId ? values.vehicleId : null,
          tripId: values.hasVehicle && values.tripId ? values.tripId : null,
          transportRouteId: values.hasVehicle && values.transportRouteId ? values.transportRouteId : null,
          transportFromMonth: values.hasVehicle && values.transportFromMonth ? values.transportFromMonth : null,
          previousYearDue: showPrevYearMonths ? calcPrevYearTotal(prevMonthAmounts) : 0,
          previousYearDueRemarks: showPrevYearMonths
            ? JSON.stringify(Object.fromEntries(Object.entries(prevMonthAmounts).map(([k, v]) => [k, parseFloat(v) || 0])))
            : "",
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // JSON parse failed — check HTTP status to decide outcome
      }

      if (!res.ok) {
        const errMsg = data?.error || "Failed to add student";
        toast({ title: errMsg, variant: "destructive" });
        if (res.status === 403) {
          // Refresh permission status
          setPermStatus({ isLocked: true, expiresAt: null, grantedAt: null, effectivelyLocked: true });
        }
        return;
      }

      toast({ title: "Student added successfully!", description: data?.studentName ? `${data.studentName} — ID: ${data.uniqueId}` : "Student has been added." });
      form.reset({
        studentName: "", fatherName: "", photoUrl: "", admissionDate: "",
        studentType: "New", session: getAutoSession(),
        dateOfBirth: "", motherName: "", aadharNumber: "", panNumber: "",
        gender: "", previousSchool: "", whatsappNumber: "", parentEmail: "",
        address: "", category: "", religion: "", bloodGroup: "",
        nationality: "", emergencyContact: "", feeFromApril: false,
        hasVehicle: false, vehicleId: "", tripId: "", transportRouteId: "", transportFromMonth: "",
      });
      setShowPrevYearMonths(false);
      setPrevMonthAmounts({});

      // Refresh next roll and recent students
      loadNextRoll(teacher.classAssigned, teacher.sectionAssigned);
      loadRecentStudents(teacher.classAssigned, teacher.sectionAssigned);
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <TeacherLayout title="Student Records">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </TeacherLayout>
    );
  }

  // Show locked screen if permission not granted
  if (!permStatus || permStatus.effectivelyLocked) {
    return (
      <TeacherLayout title="Student Records">
        <LockedScreen />
      </TeacherLayout>
    );
  }

  const className = classes.find(c => c.id === teacher?.classAssigned)?.name || "—";
  const sectionName = sections.find(s => s.id === teacher?.sectionAssigned)?.name || "—";

  return (
    <TeacherLayout title="Student Records">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Add New Student</h2>
            <p className="text-sm text-slate-500 mt-0.5">Students will be added to your assigned class and section only.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
              Class: {className} – {sectionName}
            </Badge>
            {permStatus.expiresAt && !permStatus.effectivelyLocked && (
              <CountdownBadge expiresAt={permStatus.expiresAt} />
            )}
            {!permStatus.expiresAt && (
              <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100 gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Access Granted
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-800">Student Details</h3>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* Photo + Admission Date/Type/Session */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <FormField control={form.control} name="photoUrl" render={({ field }) => (
                    <FormItem className="flex flex-col items-center">
                      <FormLabel className="flex items-center gap-1.5 mb-1 text-xs">
                        <Camera className="h-3.5 w-3.5 text-amber-500" /> Student Photo
                      </FormLabel>
                      <FormControl>
                        <PhotoUpload value={field.value} onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <div className="flex-1 space-y-4">
                    <FormField control={form.control} name="admissionDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admission Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="studentType" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-500">Student Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="New / Old" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="New">New</SelectItem>
                              <SelectItem value="Old">Old</SelectItem>
                              <SelectItem value="RTE">RTE</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="session" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-500">Session <span className="text-[10px] text-green-600">(auto)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 2025-26" {...field} className="bg-green-50" />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>

                {/* Class/Section (read-only) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Class</label>
                    <div className="flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium">
                      {className}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Section</label>
                    <div className="flex items-center h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium">
                      {sectionName}
                    </div>
                  </div>
                </div>

                {/* Next Roll Preview */}
                {nextRoll && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <BadgeCheck className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <span className="text-xs text-amber-700 font-medium uppercase tracking-wide">Student ID</span>
                        <p className="text-sm font-mono font-bold text-amber-900">{nextRoll.uniqueId}</p>
                      </div>
                      <div>
                        <span className="text-xs text-amber-700 font-medium uppercase tracking-wide">Roll No</span>
                        <p className="text-sm font-mono font-bold text-amber-900">{nextRoll.rollNo}</p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 ml-auto">Auto-assigned on save</p>
                  </div>
                )}

                {/* Student Name */}
                <FormField control={form.control} name="studentName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input placeholder="Enter full student name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Father Name + Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="fatherName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">Father's Name</FormLabel>
                      <FormControl><Input placeholder="Enter father's name" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-500">Contact Number</FormLabel>
                      <FormControl><Input placeholder="9876543210" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Parent Email */}
                <FormField control={form.control} name="parentEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-blue-500" /> Parent Email <span className="text-xs font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl><Input type="email" placeholder="parent@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Address */}
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-500">Address</FormLabel>
                    <FormControl><Input placeholder="House no., street, area..." {...field} /></FormControl>
                  </FormItem>
                )} />

                {/* Assign Bus and Trip */}
                <div className="space-y-3">
                  <FormField control={form.control} name="hasVehicle" render={({ field }) => (
                    <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} id="assign-bus-trip" />
                      </FormControl>
                      <FormLabel htmlFor="assign-bus-trip" className="cursor-pointer font-semibold text-slate-800 mb-0">
                        Assign Bus and Trip
                      </FormLabel>
                    </FormItem>
                  )} />
                  {hasVehicle && (
                    <div className="ml-4 pl-2 border-l-2 border-amber-400 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="vehicleId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {vehicles.length === 0
                                  ? <SelectItem value="none" disabled>No vehicles — add in Settings</SelectItem>
                                  : vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)
                                }
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="tripId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Trip</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {trips.length === 0
                                  ? <SelectItem value="none" disabled>No trips — add in Settings</SelectItem>
                                  : trips.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)
                                }
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <FormField control={form.control} name="transportRouteId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-amber-800 font-semibold flex items-center gap-1.5">
                              <Bus className="h-3.5 w-3.5" /> Transport Route
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
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
                        <FormField control={form.control} name="transportFromMonth" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-amber-800 font-semibold">Fee From Month</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
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

                {/* Fee from April */}
                <FormField control={form.control} name="feeFromApril" render={({ field }) => (
                  <FormItem className="flex items-center gap-2.5 p-3 rounded-lg border border-teal-200 bg-teal-50 cursor-pointer">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} id="fee-from-april" />
                    </FormControl>
                    <div>
                      <FormLabel htmlFor="fee-from-april" className="cursor-pointer font-semibold text-teal-800 mb-0">
                        Fee From April
                      </FormLabel>
                      <p className="text-xs text-teal-600">If checked, fees are generated from April. Uncheck for mid-year admissions.</p>
                    </div>
                  </FormItem>
                )} />

                {/* More Details */}
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="w-full flex items-center px-4 py-3 bg-amber-500 text-slate-950 font-bold">
                    <span className="text-sm font-bold uppercase tracking-wide">More Details</span>
                  </div>
                  <div className="p-5 space-y-4 bg-amber-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Birth</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="motherName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mother's Name</FormLabel>
                            <FormControl><Input placeholder="Enter mother's name" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="aadharNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Aadhar Number</FormLabel>
                            <FormControl>
                              <Input placeholder="xxxx xxxx xxxx" maxLength={12} {...field}
                                onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 12))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="panNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>PEN Number</FormLabel>
                            <FormControl>
                              <Input placeholder="PEN1234567" {...field}
                                onChange={e => field.onChange(e.target.value.toUpperCase())} />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="gender" render={({ field }) => (
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
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="previousSchool" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Previous School</FormLabel>
                            <FormControl><Input placeholder="Previous school name" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="General">General</SelectItem>
                                <SelectItem value="OBC">OBC</SelectItem>
                                <SelectItem value="SC">SC</SelectItem>
                                <SelectItem value="ST">ST</SelectItem>
                                <SelectItem value="EWS">EWS</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="religion" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Religion</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Hindu">Hindu</SelectItem>
                                <SelectItem value="Muslim">Muslim</SelectItem>
                                <SelectItem value="Sikh">Sikh</SelectItem>
                                <SelectItem value="Ishai">Ishai</SelectItem>
                                <SelectItem value="Others">Others</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Blood Group</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => (
                                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="nationality" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl><Input placeholder="e.g. Indian" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact</FormLabel>
                          <FormControl><Input placeholder="Emergency contact number" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                </div>

                {/* Previous Year Due Amount */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-200 bg-red-50 cursor-pointer">
                    <Checkbox
                      id="prev-year-due"
                      checked={showPrevYearMonths}
                      onCheckedChange={(v) => {
                        setShowPrevYearMonths(!!v);
                        if (!v) setPrevMonthAmounts({});
                      }}
                    />
                    <label htmlFor="prev-year-due" className="cursor-pointer font-semibold text-red-700 text-sm">
                      Previous Year Due Amount
                    </label>
                  </div>
                  {showPrevYearMonths && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {PREV_YEAR_MONTHS.map(({ num, label }) => (
                          <div key={num} className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">{label}</label>
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

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-11"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding Student…</>
                    : <><UserPlus className="w-4 h-4 mr-2" /> Add Student</>
                  }
                </Button>
              </form>
            </Form>
          </div>
        </div>

        {/* Recent Students Sidebar */}
        <div>
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h4 className="font-semibold text-slate-700 text-sm mb-4">Recently Added</h4>
            {recentStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No students added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                      {s.rollNo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.studentName}</p>
                        <SessionStatusBadge studentType={(s as any).studentType} />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">{s.uniqueId}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1.5">How it works</p>
            <ul className="text-xs text-blue-600 space-y-1.5 list-disc list-inside">
              <li>Students are added to your assigned class &amp; section</li>
              <li>Roll number is assigned automatically</li>
              <li>Parent email creates a parent portal account</li>
              <li>Access expires automatically if a time limit is set by admin</li>
            </ul>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
