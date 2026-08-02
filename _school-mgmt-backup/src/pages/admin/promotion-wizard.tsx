import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { useListClasses, useListSections } from "@workspace/api-client-react";
import {
  GraduationCap, ArrowRight, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, UserCheck, UserMinus, UserX,
  Info, RotateCcw, Filter, Users, AlertTriangle, IndianRupee, RefreshCw, Lock
} from "lucide-react";

interface AcademicSession {
  id: number;
  name: string;
  yearStart: number;
  yearEnd: number;
  isCurrent: boolean;
  schemaName: string;
}

interface StudentRow {
  id: number;
  uniqueId: string;
  rollNo: number;
  studentName: string;
  fatherName: string;
  classId: number;
  sectionId: number;
  className: string;
  sectionName: string;
  session: string;
  studentType: string;
  isPromoted: boolean;
  alreadyAction: "promote" | "detain" | "drop" | null;
  gender: string;
  previousYearDue: number;
  pendingFeeDue: number;
}

type Action = "promote" | "detain" | "drop" | null;

interface Decision {
  action: Action;
  toClassId?: number;
  toSectionId?: number;
}

const ACTION_LABELS: Record<NonNullable<Action>, string> = {
  promote: "Promote",
  detain: "Detain",
  drop: "Drop",
};

const ACTION_COLORS: Record<NonNullable<Action>, string> = {
  promote: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  detain: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  drop: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

interface Props {
  sessions: AcademicSession[];
}

export default function PromotionWizard({ sessions }: Props) {
  const { toast } = useToast();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [fromSessionId, setFromSessionId] = useState<string>("");
  const [toSessionId, setToSessionId] = useState<string>("");

  // Step 2 state
  const [filterClassId, setFilterClassId] = useState<string>("");
  const [filterSectionId, setFilterSectionId] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Step 2-3: decisions per studentId
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  // Step 3 state
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; skipped: number; failed: number } | null>(null);

  // Recalculate state (sync stale previousYearDue for already-promoted students)
  const [recalculating, setRecalculating] = useState(false);

  // Filter sections by selected class.
  // Sections with no classId are "global" (shared across all classes) — always include them.
  const filteredSections = useMemo(() => {
    if (!filterClassId) return (sections as any[]);
    return (sections as any[]).filter(
      (s: any) => !s.classId || String(s.classId) === filterClassId,
    );
  }, [sections, filterClassId]);

  // Sections for a given class (used in decision rows). Same global-section logic.
  const sectionsForClass = useCallback(
    (classId: number | string) =>
      (sections as any[]).filter(
        (s: any) => !s.classId || String(s.classId) === String(classId),
      ),
    [sections],
  );

  /**
   * Auto-detect the next class in sequence (by id order) for a student,
   * and match their current section by name in that next class.
   * Returns undefined for toSectionId when no name-match exists — user must pick manually.
   */
  const getNextClassAndSection = useCallback(
    (student: StudentRow): { toClassId?: number; toSectionId?: number } => {
      const sorted = [...(classes as any[])].sort((a: any, b: any) => a.id - b.id);
      const currentIdx = sorted.findIndex((c: any) => c.id === student.classId);
      if (currentIdx < 0 || currentIdx >= sorted.length - 1) {
        // Already at the last class — no next class available
        return { toClassId: undefined, toSectionId: undefined };
      }
      const nextClass = sorted[currentIdx + 1];
      // Try to find a section with the same name in the next class
      const sectionsInNext = (sections as any[]).filter(
        (s: any) => !s.classId || String(s.classId) === String(nextClass.id),
      );
      const match = sectionsInNext.find(
        (s: any) => (s.name ?? "").toLowerCase() === (student.sectionName ?? "").toLowerCase(),
      );
      return { toClassId: nextClass.id, toSectionId: match?.id };
    },
    [classes, sections],
  );

  const loadStudents = useCallback(async () => {
    if (!fromSessionId) return;
    setLoadingStudents(true);
    setStudents([]);
    setDecisions({});
    try {
      const params = new URLSearchParams({ fromSessionId });
      if (toSessionId) params.append("toSessionId", toSessionId);
      if (filterClassId) params.append("classId", filterClassId);
      if (filterSectionId) params.append("sectionId", filterSectionId);

      const res = await fetch(`/api/academic-sessions/promote/students?${params}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: d.error || "Failed to load students", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setStudents(data);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoadingStudents(false);
    }
  }, [fromSessionId, filterClassId, filterSectionId, toast]);

  useEffect(() => {
    if (step === 2) loadStudents();
  }, [step, filterClassId, filterSectionId]); // eslint-disable-line

  function setDecision(studentId: number, action: Action, extraClass?: number, extraSection?: number) {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: {
        action,
        toClassId: extraClass,
        toSectionId: extraSection,
      },
    }));
  }

  function setDecisionField(studentId: number, field: "toClassId" | "toSectionId", value: number) {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { action: null }), [field]: value },
    }));
  }

  // Bulk assign — skip already-processed and fee-locked students
  function bulkSet(action: Action) {
    const bulk: Record<number, Decision> = {};
    for (const s of students) {
      if (s.alreadyAction !== null) continue; // already processed — do not overwrite
      if (s.previousYearDue > 0) continue; // unpaid previous-year due — cannot action
      if (action === "promote") {
        const { toClassId, toSectionId } = getNextClassAndSection(s);
        bulk[s.id] = { action, toClassId, toSectionId };
      } else {
        bulk[s.id] = { action, toClassId: undefined, toSectionId: undefined };
      }
    }
    setDecisions((prev) => ({ ...prev, ...bulk }));
  }

  // Recalculate previousYearDue for all already-promoted students (fixes stale values)
  async function handleRecalculate() {
    if (!fromSessionId || !toSessionId) return;
    setRecalculating(true);
    try {
      const res = await fetch("/api/academic-sessions/recalculate-dues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          fromSessionId: parseInt(fromSessionId),
          toSessionId: parseInt(toSessionId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Recalculation failed", variant: "destructive" });
        return;
      }
      toast({
        title: `Dues recalculated — ${data.updated} student(s) updated`,
        description: data.errors?.length
          ? `${data.errors.length} error(s): ${data.errors.slice(0, 2).join("; ")}`
          : data.skipped > 0
            ? `${data.skipped} student(s) skipped (no due balance or not yet in target session)`
            : "All promoted student dues are now up to date.",
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  }

  // Students already actioned in a previous promotion run — rows are locked/untouchable
  const alreadyProcessedStudents = students.filter((s) => s.alreadyAction !== null);
  // Students with unpaid previous-year due — locked until that balance is cleared
  const feeLockedStudents = students.filter(
    (s) => s.alreadyAction === null && s.previousYearDue > 0,
  );
  // Actionable students: no prior action AND no previous-year due outstanding
  const actionableStudents = students.filter(
    (s) => s.alreadyAction === null && s.previousYearDue === 0,
  );

  const decided = actionableStudents.filter((s) => decisions[s.id]?.action !== null && decisions[s.id]?.action !== undefined);
  const undecided = actionableStudents.filter((s) => !decisions[s.id]?.action);

  const promotedCount = decided.filter((s) => decisions[s.id]?.action === "promote").length;
  const detainedCount = decided.filter((s) => decisions[s.id]?.action === "detain").length;
  const droppedCount = decided.filter((s) => decisions[s.id]?.action === "drop").length;

  // Validate: promote/detain need toSectionId at minimum
  const invalidDecisions = decided.filter((s) => {
    const d = decisions[s.id];
    if (d?.action === "promote" && !d.toClassId) return true;
    if ((d?.action === "promote" || d?.action === "detain") && !d.toSectionId) return true;
    return false;
  });

  async function handleSubmit() {
    if (invalidDecisions.length > 0) {
      toast({ title: "Please fill target class/section for all promoted/detained students", variant: "destructive" });
      return;
    }
    if (decided.length === 0) {
      toast({ title: "No students have been assigned an action", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fromSessionId: parseInt(fromSessionId),
        toSessionId: parseInt(toSessionId),
        decisions: decided.map((s) => {
          const d = decisions[s.id];
          return {
            studentId: s.id,
            action: d.action,
            toClassId: d.toClassId,
            toSectionId: d.toSectionId,
          };
        }),
      };

      const res = await fetch("/api/academic-sessions/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Promotion failed", variant: "destructive" });
        return;
      }

      setResult({ succeeded: data.succeeded, skipped: data.skipped, failed: data.failed });
      setDone(true);
      toast({
        title: "Promotion complete",
        description: `${data.succeeded} students processed, ${data.failed} failed.`,
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1);
    setFromSessionId("");
    setToSessionId("");
    setFilterClassId("");
    setFilterSectionId("");
    setStudents([]);
    setDecisions({});
    setDone(false);
    setResult(null);
  }

  const fromSession = sessions.find((s) => String(s.id) === fromSessionId);
  const toSession = sessions.find((s) => String(s.id) === toSessionId);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">Year-End Promotion Wizard</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Promote, detain, or drop students for the next academic session
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === n
                  ? "bg-violet-600 text-white"
                  : step > n
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400"
              }`}
            >
              {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span
              className={`hidden sm:block text-xs font-medium ${
                step === n ? "text-violet-600 dark:text-violet-400" : "text-slate-400"
              }`}
            >
              {n === 1 ? "Select Sessions" : n === 2 ? "Assign Decisions" : "Confirm & Apply"}
            </span>
            {n < 3 && <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Session selection ── */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select the <strong>source</strong> (current) session and the <strong>target</strong> (next) session you want to promote students into.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">From Session</label>
              <Select value={fromSessionId} onValueChange={setFromSessionId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select source session…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} {s.isCurrent ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To Session</label>
              <Select
                value={toSessionId}
                onValueChange={setToSessionId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select target session…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    .filter((s) => String(s.id) !== fromSessionId)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fromSessionId && toSessionId && (
            <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-4 py-3 text-sm">
              <span className="font-semibold text-violet-700 dark:text-violet-300">{fromSession?.name}</span>
              <ArrowRight className="h-4 w-4 text-violet-400" />
              <span className="font-semibold text-violet-700 dark:text-violet-300">{toSession?.name}</span>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Promoted and detained students keep their enrollment number. Pending fee dues are carried forward as previous year due. Dropped students are marked and remain in the source session.
            </span>
          </div>

          {/* Recalculate dues for already-promoted students */}
          {fromSessionId && toSessionId && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Fix stale previous year due amounts</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    If students were promoted before a fee calculation update, their carried-forward due in{" "}
                    <strong>{toSession?.name}</strong> may show wrong amounts. Click below to recompute and sync all promoted students' dues from <strong>{fromSession?.name}</strong>.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 w-full"
                disabled={recalculating}
                onClick={handleRecalculate}
              >
                {recalculating
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Recalculating…</>
                  : <><RefreshCw className="h-3 w-3" /> Recalculate Carried-Forward Dues</>
                }
              </Button>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
              disabled={!fromSessionId || !toSessionId}
              onClick={() => setStep(2)}
            >
              Next: Select Students <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Filter + student decisions ── */}
      {step === 2 && !done && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Filter className="h-4 w-4 text-slate-400" />
              Filter Students
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Class</label>
                <Select
                  value={filterClassId}
                  onValueChange={(v) => {
                    setFilterClassId(v);
                    setFilterSectionId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All classes</SelectItem>
                    {(classes as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Section</label>
                <Select
                  value={filterSectionId}
                  onValueChange={setFilterSectionId}
                  disabled={!filterClassId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sections</SelectItem>
                    {filteredSections.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick-assign buttons */}
            {students.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Quick assign all:</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                  onClick={() => bulkSet("promote")}
                >
                  <UserCheck className="h-3 w-3" /> All Promote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                  onClick={() => bulkSet("detain")}
                >
                  <UserMinus className="h-3 w-3" /> All Detain
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                  onClick={() => bulkSet("drop")}
                >
                  <UserX className="h-3 w-3" /> All Drop
                </Button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {students.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                {decided.length}/{actionableStudents.length} actioned
                {promotedCount > 0 && (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">{promotedCount} promote</span>
                )}
                {detainedCount > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">{detainedCount} detain</span>
                )}
                {droppedCount > 0 && (
                  <span className="ml-2 text-red-600 dark:text-red-400">{droppedCount} drop</span>
                )}
                {undecided.length > 0 && (
                  <span className="ml-2 text-slate-400">{undecided.length} will be skipped</span>
                )}
              </span>
              {feeLockedStudents.length > 0 && (
                <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                  <Lock className="h-3 w-3" />
                  {feeLockedStudents.length} dues pending
                </span>
              )}
              {alreadyProcessedStudents.length > 0 && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Lock className="h-3 w-3" />
                  {alreadyProcessedStudents.length} already processed
                </span>
              )}
            </div>
          )}

          {/* Student list */}
          {loadingStudents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No students found. Adjust the filter above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const locked = student.alreadyAction !== null;
                const d = decisions[student.id];
                const action = d?.action ?? null;

                // ── Locked row (already promoted/detained/dropped) ─────────────
                if (locked) {
                  const lockedAction = student.alreadyAction!;
                  const LOCKED_BG: Record<NonNullable<Action>, string> = {
                    promote: "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40",
                    detain:  "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40",
                    drop:    "bg-red-50/60 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40",
                  };
                  return (
                    <div
                      key={student.id}
                      className={`border rounded-xl p-3 sm:p-4 opacity-70 select-none ${LOCKED_BG[lockedAction]}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm truncate">
                              {student.studentName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{student.uniqueId}</span>
                            <span className="text-xs text-slate-400">
                              {student.className} – {student.sectionName}
                            </span>
                            {/* Badge showing the action already taken */}
                            <Badge
                              className={`text-xs border ${ACTION_COLORS[lockedAction]}`}
                              variant="outline"
                            >
                              {lockedAction === "promote" ? "Already Promoted" : lockedAction === "detain" ? "Already Detained" : "Already Dropped"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>{student.fatherName}</span>
                          </div>
                        </div>
                        {/* Lock indicator */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                          <Lock className="h-3.5 w-3.5" />
                          <span>Locked</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Fee-locked row (unpaid previous-year due only) ────────────
                if (student.alreadyAction === null && student.previousYearDue > 0) {
                  return (
                    <div
                      key={student.id}
                      className="border rounded-xl p-3 sm:p-4 bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 select-none"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">
                              {student.studentName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{student.uniqueId}</span>
                            <span className="text-xs text-slate-400">
                              {student.className} – {student.sectionName}
                            </span>
                            <Badge
                              className="text-xs border border-red-300 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700 gap-0.5"
                              variant="outline"
                            >
                              <IndianRupee className="h-3 w-3" />
                              {student.previousYearDue.toFixed(0)} Prev. Year Due — Pay to Unlock
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-red-500 dark:text-red-400">
                            <span>{student.fatherName}</span>
                            <span>₹{student.previousYearDue.toFixed(0)} carried-forward balance unpaid</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400 shrink-0">
                          <Lock className="h-3.5 w-3.5" />
                          <span>Prev. Due Pending</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Normal actionable row ─────────────────────────────────────
                return (
                  <div
                    key={student.id}
                    className={`border rounded-xl p-3 sm:p-4 transition-all ${
                      action
                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Student info row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                            {student.studentName}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{student.uniqueId}</span>
                          <span className="text-xs text-slate-400">
                            {student.className} – {student.sectionName}
                          </span>
                          {action && (
                            <Badge
                              className={`text-xs border ${ACTION_COLORS[action]}`}
                              variant="outline"
                            >
                              {ACTION_LABELS[action]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{student.fatherName}</span>
                          {(student.pendingFeeDue > 0 || student.previousYearDue > 0) && (
                            <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400 font-medium">
                              <IndianRupee className="h-3 w-3" />
                              {(student.pendingFeeDue + student.previousYearDue).toFixed(0)} total due
                              {student.pendingFeeDue > 0 && (
                                <span className="text-red-400 font-normal ml-1">
                                  (₹{student.pendingFeeDue.toFixed(0)} this session)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(["promote", "detain", "drop"] as Action[]).map((a) => (
                          <button
                            key={a}
                            onClick={() => {
                              if (action === a) {
                                setDecision(student.id, null, undefined, undefined);
                              } else if (a === "promote") {
                                const { toClassId, toSectionId } = getNextClassAndSection(student);
                                setDecision(student.id, "promote", toClassId, toSectionId);
                              } else {
                                setDecision(student.id, a, undefined, undefined);
                              }
                            }}
                            className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                              action === a
                                ? ACTION_COLORS[a!]
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400"
                            }`}
                          >
                            {a === "promote" ? "Promote" : a === "detain" ? "Detain" : "Drop"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target class/section selectors for promote/detain */}
                    {(action === "promote" || action === "detain") && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                        {action === "promote" && (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">Target Class</label>
                            <Select
                              value={d?.toClassId ? String(d.toClassId) : ""}
                              onValueChange={(v) => {
                                setDecisionField(student.id, "toClassId", parseInt(v));
                                setDecisionField(student.id, "toSectionId", 0);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select class…" />
                              </SelectTrigger>
                              <SelectContent>
                                {(classes as any[]).map((c: any) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {action === "detain" && (
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">
                              Same Class ({student.className}) — stays
                            </label>
                            <div className="h-8 flex items-center px-2 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg">
                              {student.className}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-400">Target Section</label>
                          <Select
                            value={d?.toSectionId ? String(d.toSectionId) : ""}
                            onValueChange={(v) =>
                              setDecisionField(student.id, "toSectionId", parseInt(v))
                            }
                            disabled={action === "promote" && !d?.toClassId}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select section…" />
                            </SelectTrigger>
                            <SelectContent>
                              {sectionsForClass(
                                action === "promote" ? (d?.toClassId ?? 0) : student.classId,
                              ).map((s: any) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Drop info */}
                    {action === "drop" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                        <UserX className="h-3.5 w-3.5 shrink-0" />
                        Student will be marked as Dropped and stay in {fromSession?.name}. Transfer certificate can be issued.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
              disabled={actionableStudents.length === 0 || decided.length === 0 || invalidDecisions.length > 0}
              onClick={() => setStep(3)}
            >
              Next: Review <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {decided.length === 0 && actionableStudents.length > 0 && (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              <Info className="inline h-3 w-3 mr-1" />
              Select at least one student to action before proceeding
            </p>
          )}
          {undecided.length > 0 && decided.length > 0 && (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              <Info className="inline h-3 w-3 mr-1" />
              {undecided.length} student(s) with no action will be skipped
            </p>
          )}
          {invalidDecisions.length > 0 && (
            <p className="text-xs text-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="inline h-3 w-3 mr-1" />
              {invalidDecisions.length} student(s) need target class/section filled
            </p>
          )}
        </div>
      )}

      {/* ── Step 3: Review & confirm ── */}
      {step === 3 && !done && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="font-semibold text-slate-900 dark:text-white">Review Decisions</h4>

            <div className="flex items-center gap-3 text-sm font-medium bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-4 py-3">
              <span className="text-violet-700 dark:text-violet-300">{fromSession?.name}</span>
              <ArrowRight className="h-4 w-4 text-violet-400" />
              <span className="text-violet-700 dark:text-violet-300">{toSession?.name}</span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{promotedCount}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-0.5">Promoted</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{detainedCount}</div>
                <div className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-0.5">Detained</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{droppedCount}</div>
                <div className="text-xs text-red-600 dark:text-red-500 font-medium mt-0.5">Dropped</div>
              </div>
            </div>

            {/* Detail table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Student</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">From</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Action</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">To</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500">Due Carry-fwd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decided.map((student) => {
                      const d = decisions[student.id];
                      const toClass = (classes as any[]).find((c: any) => c.id === d?.toClassId);
                      const toSec = (sections as any[]).find((s: any) => s.id === d?.toSectionId);
                      const carryFwd = student.pendingFeeDue + student.previousYearDue;
                      return (
                        <tr key={student.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                            {student.studentName}
                            <span className="text-slate-400 font-normal ml-1">#{student.uniqueId}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {student.className} – {student.sectionName}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={`text-xs border ${ACTION_COLORS[d!.action!]}`}
                            >
                              {ACTION_LABELS[d!.action!]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {d?.action === "drop"
                              ? "—"
                              : d?.action === "detain"
                              ? `${student.className} – ${toSec?.name ?? "—"}`
                              : `${toClass?.name ?? "—"} – ${toSec?.name ?? "—"}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {d?.action !== "drop" && carryFwd > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                ₹{carryFwd.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              This action will create student records in the <strong>{toSession?.name}</strong> session. Students already copied there will be skipped. This cannot be automatically reversed.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setStep(2)} disabled={submitting}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-500 text-white gap-2 min-w-[140px]"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Applying…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Apply Promotion</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Done state ── */}
      {done && result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">Promotion Complete</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Students moved from <strong>{fromSession?.name}</strong> → <strong>{toSession?.name}</strong>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{result.succeeded}</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-500">Processed</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-xl font-bold text-slate-600 dark:text-slate-300">{result.skipped}</div>
              <div className="text-xs text-slate-500">Skipped</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="text-xl font-bold text-red-700 dark:text-red-400">{result.failed}</div>
              <div className="text-xs text-red-600 dark:text-red-500">Failed</div>
            </div>
          </div>
          <Button variant="outline" className="gap-2 mt-2" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Run Another Promotion
          </Button>
        </div>
      )}
    </div>
  );
}
