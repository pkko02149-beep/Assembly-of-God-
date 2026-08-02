import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, IndianRupee, Calendar, Gift, ChevronLeft,
  ChevronRight, Eye, Users, CheckCircle2, Clock, AlertCircle,
  GraduationCap, UserCheck,
} from "lucide-react";
import { getAdminToken } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OccasionalCollection {
  id: number;
  title: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface ClassSummary {
  classId: number;
  className: string;
  sections: { id: number; name: string }[];
  teachers: { name: string; sectionAssigned: number | null }[];
  totalStudents: number;
  paidCount: number;
  paidAmount: number;
  partialCount: number;
  partialAmount: number;
  unpaidCount: number;
  totalDue: number;
  totalCollected: number;
  collectionPct: number;
  perStudentAmount: number;
}

interface CollectionSummaryResponse {
  collection: OccasionalCollection;
  classes: ClassSummary[];
}

interface StudentPayment {
  studentId: number;
  studentName: string;
  rollNo: number;
  sectionId: number | null;
  sectionName: string | null;
  paymentId: number | null;
  paidAmount: number;
  status: "unpaid" | "partial" | "paid";
  totalAmount: number;
}

interface ClassPaymentsResponse {
  collection: OccasionalCollection;
  students: StudentPayment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OccasionalCollectionTabProps {
  session: string;
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data as T;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, paidAmount, totalAmount }: { status: string; paidAmount: number; totalAmount: number }) {
  if (status === "paid") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" /> Paid {fmt(paidAmount)}
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100 gap-1 text-xs">
        <Clock className="h-3 w-3" /> Partial {fmt(paidAmount)} / {fmt(totalAmount)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-100 gap-1 text-xs">
      <AlertCircle className="h-3 w-3" /> Unpaid
    </Badge>
  );
}

// ─── Student list view ────────────────────────────────────────────────────────

function StudentListView({
  collection,
  classId,
  className,
  onBack,
}: {
  collection: OccasionalCollection;
  classId: number;
  className: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useQuery<ClassPaymentsResponse>({
    queryKey: ["occasional-class-payments", collection.id, classId],
    queryFn: () =>
      adminFetch<ClassPaymentsResponse>(
        `/api/occasional-collections/${collection.id}/payments?classId=${classId}`,
      ),
  });

  const students = data?.students ?? [];
  const paid = students.filter((s) => s.status === "paid");
  const partial = students.filter((s) => s.status === "partial");
  const unpaid = students.filter((s) => s.status === "unpaid");
  const collected = paid.reduce((s, st) => s + st.paidAmount, 0)
    + partial.reduce((s, st) => s + st.paidAmount, 0);
  const totalDue = students.length * collection.amount;
  const pct = totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1 shrink-0">
          <ChevronLeft className="h-4 w-4" /> Back to Classes
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{collection.title}</p>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
            Class {className} — Student List
          </h3>
        </div>
        <Badge className="bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-100 font-semibold shrink-0">
          <IndianRupee className="h-3 w-3 mr-0.5" />
          {collection.amount.toLocaleString("en-IN")} / student
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paid", count: paid.length, amt: paid.reduce((s, st) => s + st.paidAmount, 0), color: "emerald" },
          { label: "Partial", count: partial.length, amt: partial.reduce((s, st) => s + st.paidAmount, 0), color: "amber" },
          { label: "Unpaid", count: unpaid.length, amt: unpaid.length * collection.amount, color: "slate" },
          { label: "Collection", count: `${pct}%`, amt: collected, color: "violet" },
        ].map(({ label, count, amt, color }) => (
          <Card key={label} className={`border border-${color}-200 bg-${color}-50 dark:bg-${color}-950/20 dark:border-${color}-800`}>
            <CardContent className="p-3">
              <p className={`text-xs text-${color}-600 dark:text-${color}-400 font-medium uppercase tracking-wide`}>{label}</p>
              <p className={`text-xl font-bold text-${color}-700 dark:text-${color}-300`}>{count}</p>
              <p className={`text-xs text-${color}-600 dark:text-${color}-400 font-medium`}>{fmt(amt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collection progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Collection Progress</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(collected)} / {fmt(totalDue)}</span>
        </div>
        <Progress value={pct} className="h-2.5" />
        <p className="text-xs text-slate-400 text-right">{pct}% collected</p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead className="w-28">Section</TableHead>
                <TableHead className="w-52">Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.studentId}>
                    <TableCell className="font-mono text-slate-400 text-sm">{s.rollNo}</TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">{s.studentName}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{s.sectionName ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} paidAmount={s.paidAmount} totalAmount={s.totalAmount} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Class summary cards view ─────────────────────────────────────────────────

function OccasionDetailView({
  collection,
  onBack,
}: {
  collection: OccasionalCollection;
  onBack: () => void;
}) {
  const [viewing, setViewing] = useState<{ classId: number; className: string } | null>(null);

  const { data, isLoading } = useQuery<CollectionSummaryResponse>({
    queryKey: ["occasional-class-summary", collection.id],
    queryFn: () =>
      adminFetch<CollectionSummaryResponse>(`/api/occasional-collections/${collection.id}/class-summary`),
  });

  if (viewing) {
    return (
      <StudentListView
        collection={collection}
        classId={viewing.classId}
        className={viewing.className}
        onBack={() => setViewing(null)}
      />
    );
  }

  const classes = data?.classes ?? [];
  const grandTotal = classes.reduce((s, c) => s + c.totalDue, 0);
  const grandCollected = classes.reduce((s, c) => s + c.totalCollected, 0);
  const grandPct = grandTotal > 0 ? Math.round((grandCollected / grandTotal) * 100) : 0;
  const totalPaid = classes.reduce((s, c) => s + c.paidCount, 0);
  const totalPartial = classes.reduce((s, c) => s + c.partialCount, 0);
  const totalUnpaid = classes.reduce((s, c) => s + c.unpaidCount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1 shrink-0">
          <ChevronLeft className="h-4 w-4" /> All Occasions
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-xl leading-tight truncate">
            {collection.title}
          </h3>
          {collection.description && (
            <p className="text-sm text-slate-400 mt-0.5">{collection.description}</p>
          )}
        </div>
        <Badge className="bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-100 font-semibold text-sm shrink-0">
          <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
          {collection.amount.toLocaleString("en-IN")} / student
        </Badge>
      </div>

      {/* School-wide summary */}
      {!isLoading && classes.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Paid", count: totalPaid, amt: classes.reduce((s, c) => s + c.paidAmount, 0), color: "emerald" },
              { label: "Partial", count: totalPartial, amt: classes.reduce((s, c) => s + c.partialAmount, 0), color: "amber" },
              { label: "Unpaid", count: totalUnpaid, amt: totalUnpaid * collection.amount, color: "slate" },
              { label: "Overall", count: `${grandPct}%`, amt: grandCollected, color: "violet" },
            ].map(({ label, count, amt, color }) => (
              <Card key={label} className={`border border-${color}-200 bg-${color}-50 dark:bg-${color}-950/20 dark:border-${color}-800`}>
                <CardContent className="p-4">
                  <p className={`text-xs text-${color}-600 dark:text-${color}-400 font-medium uppercase tracking-wide`}>{label}</p>
                  <p className={`text-2xl font-bold text-${color}-700 dark:text-${color}-300 mt-0.5`}>{count}</p>
                  <p className={`text-xs text-${color}-600 dark:text-${color}-400 font-medium mt-0.5`}>{fmt(amt)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">School-wide Collection Progress</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(grandCollected)} / {fmt(grandTotal)}</span>
            </div>
            <Progress value={grandPct} className="h-3" />
            <p className="text-xs text-slate-400 text-right">{grandPct}% of total amount collected across all classes</p>
          </div>
        </>
      )}

      {/* Class cards */}
      {isLoading ? (
        <div className="flex justify-center py-14">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-500">No classes with students yet</p>
            <p className="text-sm text-slate-400">Add students to classes to see collection status here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard
              key={cls.classId}
              cls={cls}
              onView={() => setViewing({ classId: cls.classId, className: cls.className })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Class card ───────────────────────────────────────────────────────────────

function ClassCard({ cls, onView }: { cls: ClassSummary; onView: () => void }) {
  const pctColor =
    cls.collectionPct === 100
      ? "text-emerald-600"
      : cls.collectionPct >= 60
      ? "text-amber-600"
      : "text-red-500";

  const progressColor =
    cls.collectionPct === 100
      ? "[&>div]:bg-emerald-500"
      : cls.collectionPct >= 60
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-red-400";

  const teacherNames = cls.teachers.map((t) => t.name).join(", ") || "—";
  const sectionNames = cls.sections.map((s) => s.name).join(", ") || "—";

  return (
    <Card className="border border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:shadow-md transition-all duration-150 flex flex-col">
      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        {/* Class header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold text-sm">
                {cls.className}
              </span>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-base leading-tight">Class {cls.className}</p>
                <p className="text-xs text-slate-400">Sections: {sectionNames}</p>
              </div>
            </div>
          </div>
          <span className={`text-xl font-black ${pctColor}`}>{cls.collectionPct}%</span>
        </div>

        {/* Teacher */}
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <UserCheck className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{teacherNames}</span>
        </div>

        {/* Students total */}
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <GraduationCap className="h-4 w-4 shrink-0 text-slate-400" />
          <span>{cls.totalStudents} students · {fmt(cls.totalDue)} total due</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={cls.collectionPct} className={`h-2 ${progressColor}`} />
          <div className="flex justify-between text-xs text-slate-400">
            <span>Collected {fmt(cls.totalCollected)}</span>
            <span>{cls.collectionPct}%</span>
          </div>
        </div>

        {/* Paid / Partial / Unpaid chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> {cls.paidCount} Paid · {fmt(cls.paidAmount)}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
            <Clock className="h-3 w-3" /> {cls.partialCount} Partial · {fmt(cls.partialAmount)}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400">
            <AlertCircle className="h-3 w-3" /> {cls.unpaidCount} Unpaid
          </span>
        </div>

        {/* View button */}
        <Button
          size="sm"
          variant="outline"
          onClick={onView}
          className="w-full mt-auto gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30"
        >
          <Eye className="h-4 w-4" /> View Students
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main tab (occasions list) ────────────────────────────────────────────────

export default function OccasionalCollectionTab({ session }: OccasionalCollectionTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selected, setSelected] = useState<OccasionalCollection | null>(null);
  const [form, setForm] = useState({ title: "", description: "", amount: "" });

  const { data: collections = [], isLoading } = useQuery<OccasionalCollection[]>({
    queryKey: ["occasional-collections", session],
    queryFn: () =>
      adminFetch<OccasionalCollection[]>(
        `/api/occasional-collections?session=${encodeURIComponent(session)}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; amount: number; session: string }) =>
      adminFetch<OccasionalCollection>("/api/occasional-collections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occasional-collections", session] });
      toast({ title: "Occasion created successfully" });
      setShowCreate(false);
      setForm({ title: "", description: "", amount: "" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch<void>(`/api/occasional-collections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["occasional-collections", session] });
      toast({ title: "Occasion deleted" });
      setDeleteId(null);
      if (selected && selected.id === deleteId) setSelected(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  function handleCreate() {
    if (!form.title.trim() || !form.amount) {
      toast({ title: "Title and amount are required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      session,
    });
  }

  // ── Drill-down view ──
  if (selected) {
    return (
      <div className="p-4 md:p-6">
        <OccasionDetailView
          collection={selected}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  // ── Occasions list ──
  const totalAmount = collections.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Occasional Collections</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Click any occasion to view class-wise collection status
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          New Occasion
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-violet-200 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-800">
          <CardContent className="p-4">
            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide">Total Occasions</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300 mt-1">{collections.length}</p>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">Per-Student Total</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{fmt(totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Occasions table / list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : collections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Gift className="h-10 w-10 text-slate-300" />
            <p className="text-slate-500 font-medium">No occasions yet</p>
            <p className="text-sm text-slate-400">Create your first occasion and teachers can start collecting</p>
            <Button size="sm" onClick={() => setShowCreate(true)} className="mt-2">
              <Plus className="h-4 w-4 mr-1" /> New Occasion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Occasion Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-36">Amount / Student</TableHead>
                <TableHead className="w-36">Created</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((c, i) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-violet-50/60 dark:hover:bg-violet-950/20 group"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="text-slate-400 text-sm">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                        {c.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-xs truncate">{c.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-semibold text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                      <IndianRupee className="h-3 w-3 mr-1" />{c.amount.toLocaleString("en-IN")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-violet-600 hover:text-violet-800 hover:bg-violet-50 gap-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400">Click any row to view class-wise collection status and student details</p>
          </div>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Occasion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Occasion Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Annual Day Contribution"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional details"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount per Student (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 500"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Occasion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this occasion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the occasion and all payment records for it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
