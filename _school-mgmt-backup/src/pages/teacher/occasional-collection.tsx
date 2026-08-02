import { useState } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { teacherApi, isAuthError, getUser } from "@/lib/jwt-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ChevronLeft, Gift, IndianRupee, CheckCircle2, Clock, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher {
  id: number;
  name: string;
  classAssigned: number | null;
  sectionAssigned: number | null;
}

interface OccasionalCollection {
  id: number;
  title: string;
  description: string;
  amount: number;
  createdAt: string;
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

interface CollectionDetail {
  collection: OccasionalCollection;
  students: StudentPayment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatusBadge({ student }: { student: StudentPayment }) {
  if (student.status === "paid") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Paid {fmt(student.paidAmount)}
      </Badge>
    );
  }
  if (student.status === "partial") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100 gap-1">
        <Clock className="h-3 w-3" />
        Partial {fmt(student.paidAmount)} / {fmt(student.totalAmount)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 gap-1">
      <AlertCircle className="h-3 w-3" />
      Unpaid
    </Badge>
  );
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────

function PaymentDialog({
  open,
  student,
  collection,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  student: StudentPayment | null;
  collection: OccasionalCollection | null;
  onClose: () => void;
  onSave: (studentId: number, addAmount: number) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState("");

  // Reset on open
  const prevOpen = open;
  if (!prevOpen && open) setAmount("");

  const remaining = student && collection ? collection.amount - student.paidAmount : 0;

  function handleSave() {
    if (!student || !amount) return;
    onSave(student.studentId, parseFloat(amount));
    setAmount("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setAmount(""); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Partial Payment</DialogTitle>
        </DialogHeader>
        {student && collection && (
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 space-y-1 text-sm">
              <p className="font-medium text-slate-800 dark:text-slate-200">{student.studentName}</p>
              <p className="text-slate-500">Occasion: <span className="font-medium text-slate-700 dark:text-slate-300">{collection.title}</span></p>
              <p className="text-slate-500">Total: <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(collection.amount)}</span></p>
              {student.paidAmount > 0 && (
                <p className="text-slate-500">Already paid: <span className="font-semibold text-amber-600">{fmt(student.paidAmount)}</span></p>
              )}
              <p className="text-slate-500">Remaining: <span className="font-semibold text-red-600">{fmt(remaining)}</span></p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount Received Now (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="1"
                max={remaining}
                placeholder={`Max ₹${remaining.toLocaleString("en-IN")}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              {amount && parseFloat(amount) > remaining && (
                <p className="text-xs text-red-500">Amount exceeds remaining balance</p>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAmount(""); onClose(); }}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !amount || parseFloat(amount) <= 0 || (student ? parseFloat(amount) > collection!.amount - student.paidAmount : false)}
          >
            {saving ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Collection Detail View ───────────────────────────────────────────────────

function CollectionDetail({
  collection,
  classId,
  onBack,
}: {
  collection: OccasionalCollection;
  classId: number;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [partialStudent, setPartialStudent] = useState<StudentPayment | null>(null);

  const qKey = ["occasional-collection-payments", collection.id, classId];
  const { data, isLoading, refetch } = useQuery<CollectionDetail>({
    queryKey: qKey,
    queryFn: () =>
      teacherApi.get<CollectionDetail>(
        `/occasional-collections/${collection.id}/payments?classId=${classId}`,
      ),
  });

  const paymentMutation = useMutation({
    mutationFn: (body: { studentId: number; addAmount?: number; markPaid?: boolean }) =>
      teacherApi.post(`/occasional-collections/${collection.id}/payments`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qKey });
      refetch();
      setPartialStudent(null);
      toast({ title: "Payment recorded" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  function handleStatusChange(student: StudentPayment, value: string) {
    if (value === "paid") {
      paymentMutation.mutate({ studentId: student.studentId, markPaid: true });
    } else if (value === "partial") {
      setPartialStudent(student);
    }
  }

  const students = data?.students ?? [];

  // Summary stats
  const paid = students.filter((s) => s.status === "paid");
  const partial = students.filter((s) => s.status === "partial");
  const unpaid = students.filter((s) => s.status === "unpaid");
  const paidAmt = paid.reduce((s, st) => s + st.paidAmount, 0);
  const partialAmt = partial.reduce((s, st) => s + st.paidAmount, 0);
  const unpaidAmt = unpaid.reduce((s, st) => s + st.totalAmount, 0);

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{collection.title}</h3>
          {collection.description && (
            <p className="text-sm text-slate-500">{collection.description}</p>
          )}
        </div>
        <Badge className="ml-auto bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-100 font-semibold">
          <IndianRupee className="h-3 w-3 mr-1" />
          {collection.amount.toLocaleString("en-IN")} / student
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="p-3">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">Paid</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{paid.length}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{fmt(paidAmt)}</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-3">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Partial</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{partial.length}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{fmt(partialAmt)}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Unpaid</p>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{unpaid.length}</p>
            <p className="text-xs text-slate-500 font-medium">{fmt(unpaidAmt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Student table */}
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
                <TableHead className="w-44">Status</TableHead>
                <TableHead className="w-44">Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No students found in this class
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-mono text-slate-500 text-sm">{student.rollNo}</TableCell>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{student.sectionName ?? "—"}</TableCell>
                    <TableCell>
                      {student.status === "paid" ? (
                        <span className="text-sm text-slate-400 italic">Fully paid</span>
                      ) : (
                        <Select
                          value={student.status}
                          onValueChange={(v) => handleStatusChange(student, v)}
                          disabled={paymentMutation.isPending}
                        >
                          <SelectTrigger className="h-8 text-sm w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge student={student} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Partial payment dialog */}
      <PaymentDialog
        open={partialStudent !== null}
        student={partialStudent}
        collection={collection}
        onClose={() => setPartialStudent(null)}
        onSave={(studentId, addAmount) =>
          paymentMutation.mutate({ studentId, addAmount })
        }
        saving={paymentMutation.isPending}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherOccasionalCollection() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const teacher = getUser<Teacher>("teacher");
  const [selected, setSelected] = useState<OccasionalCollection | null>(null);

  // Fetch the active academic session so we can filter collections by it
  const { data: sessionStatus } = useQuery<{ currentSession: { name: string } | null }>({
    queryKey: ["academic-sessions-status"],
    queryFn: async () => {
      const res = await fetch("/api/academic-sessions/status");
      if (!res.ok) return { currentSession: null };
      return res.json();
    },
    staleTime: 60_000,
  });

  const currentSession =
    sessionStatus?.currentSession?.name ??
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  const { data: collections = [], isLoading } = useQuery<OccasionalCollection[]>({
    queryKey: ["occasional-collections", currentSession],
    queryFn: async () => {
      try {
        return await teacherApi.get<OccasionalCollection[]>(
          `/occasional-collections?session=${encodeURIComponent(currentSession)}`,
        );
      } catch (err) {
        if (isAuthError(err)) navigate("/teacher/login");
        throw err;
      }
    },
    enabled: !!sessionStatus, // wait until we know the session
  });

  if (!teacher?.classAssigned) {
    return (
      <TeacherLayout title="Occasional Collection">
        <div className="p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Gift className="h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-600">No class assigned</p>
              <p className="text-sm text-slate-400">Ask the admin to assign you a class to manage collections.</p>
            </CardContent>
          </Card>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="Occasional Collection">
      <div className="p-4 md:p-6 space-y-5">
        {selected ? (
          <CollectionDetail
            collection={selected}
            classId={teacher.classAssigned}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Occasional Collections</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Select an occasion to record payments for your class
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
              </div>
            ) : collections.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Gift className="h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-500">No occasions created yet</p>
                  <p className="text-sm text-slate-400">The admin will create occasions here. Check back later.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-violet-400 hover:shadow-md transition-all duration-150 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors leading-tight">
                          {c.title}
                        </p>
                        {c.description && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{c.description}</p>
                        )}
                      </div>
                      <Badge className="bg-violet-100 text-violet-700 border border-violet-300 hover:bg-violet-100 shrink-0 font-semibold">
                        <IndianRupee className="h-3 w-3 mr-0.5" />
                        {c.amount.toLocaleString("en-IN")}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-3">
                      Created {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
