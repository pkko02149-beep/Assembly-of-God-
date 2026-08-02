import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { getListStudentsQueryKey } from "@workspace/api-client-react";
import {
  CalendarRange, Plus, CheckCircle2, Clock, Loader2,
  ArrowRight, Database, RefreshCw, Info, GraduationCap, Lock, Users, Save
} from "lucide-react";
import PromotionWizard from "./promotion-wizard";

interface AcademicSession {
  id: number;
  name: string;
  yearStart: number;
  yearEnd: number;
  isCurrent: boolean;
  schemaName: string;
  createdAt: string;
}

interface PromotionTeacher {
  id: number;
  employeeId: string;
  name: string;
  classAssigned: number | null;
  sectionAssigned: number | null;
}

interface PromotionConfigResponse {
  config: {
    id: number;
    sourceSessionId: number;
    targetSessionId: number;
    windowHours: number;
    windowOpenedAt: string;
    windowEndsAt: string;
    teacherIds: number[];
  } | null;
  sourceSession: AcademicSession | null;
  targetSession: AcademicSession | null;
  teachers: PromotionTeacher[];
}

export default function AcademicSessionsTab({ onSessionChange }: { onSessionChange?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const now = new Date().getFullYear();
  const [yearStart, setYearStart] = useState(String(now));
  const [yearEnd, setYearEnd] = useState(String(now + 1));
  const [showForm, setShowForm] = useState(false);
  const [promotionConfig, setPromotionConfig] = useState<PromotionConfigResponse | null>(null);
  const [promotionSourceId, setPromotionSourceId] = useState("");
  const [promotionTargetId, setPromotionTargetId] = useState("");
  const [promotionWindowHours, setPromotionWindowHours] = useState("72");
  const [promotionTeacherIds, setPromotionTeacherIds] = useState<number[]>([]);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionSaving, setPromotionSaving] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/academic-sessions", {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json();
      const nextSessions = Array.isArray(data) ? data as AcademicSession[] : [];
      setSessions(nextSessions);
      const current = nextSessions.find(session => session.isCurrent);
      if (current) {
        await fetchPromotionConfig(current.id, nextSessions);
      }
    } catch {
      toast({ title: "Failed to load sessions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function fetchPromotionConfig(sourceId?: number, sessionRows = sessions) {
    const source = sourceId ?? sessionRows.find(session => session.isCurrent)?.id;
    if (!source) return;
    setPromotionLoading(true);
    try {
      const res = await fetch(`/api/teacher-promotion/config?sourceSessionId=${source}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json() as PromotionConfigResponse;
      setPromotionConfig(data);
      setPromotionSourceId(String(data.sourceSession?.id ?? source));
      setPromotionTargetId(String(data.config?.targetSessionId ?? data.targetSession?.id ?? ""));
      setPromotionWindowHours(String(data.config?.windowHours ?? 72));
      setPromotionTeacherIds(data.config?.teacherIds ?? []);
    } catch {
      toast({ title: "Failed to load teacher promotion settings", variant: "destructive" });
    } finally {
      setPromotionLoading(false);
    }
  }

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleYearStartChange = (val: string) => {
    setYearStart(val);
    const n = parseInt(val);
    if (!isNaN(n)) setYearEnd(String(n + 1));
  };

  async function handleCreate() {
    const ys = parseInt(yearStart);
    const ye = parseInt(yearEnd);
    if (isNaN(ys) || isNaN(ye) || ye !== ys + 1) {
      toast({ title: "End year must be start year + 1", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/academic-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ yearStart: ys, yearEnd: ye }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to create", variant: "destructive" });
        return;
      }
      toast({ title: `Session ${data.name} created`, description: "Isolated database schema provisioned." });
      setShowForm(false);
      fetchSessions();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleSetCurrent(id: number, name: string) {
    setSwitching(id);
    try {
      const res = await fetch(`/api/academic-sessions/${id}/set-current`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to switch", variant: "destructive" });
        return;
      }
      toast({
        title: `Switched to ${name}`,
        description: "All portals will now use this academic year's data.",
      });
      // Refresh local session list
      fetchSessions();
      // Tell the parent dashboard to update the header badge
      onSessionChange?.();
      // Invalidate student queries so enrollment numbers re-fetch with the new session
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSwitching(null);
    }
  }

  const current = sessions.find((s) => s.isCurrent);
  const availableTargetSessions = sessions.filter(session => String(session.id) !== promotionSourceId);

  async function savePromotionConfig() {
    const sourceSessionId = Number(promotionSourceId);
    const targetSessionId = Number(promotionTargetId);
    const windowHours = Number(promotionWindowHours);
    if (!sourceSessionId || !targetSessionId || sourceSessionId === targetSessionId) {
      toast({ title: "Choose different source and target sessions", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 8760) {
      toast({ title: "Window duration must be between 1 and 8760 hours", variant: "destructive" });
      return;
    }
    setPromotionSaving(true);
    try {
      const res = await fetch("/api/teacher-promotion/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ sourceSessionId, targetSessionId, windowHours, teacherIds: promotionTeacherIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save promotion settings");
      toast({ title: "Teacher promotion settings saved", description: "The selected teachers can now use the promotion tab until the window closes." });
      await fetchPromotionConfig(sourceSessionId, sessions);
    } catch (error) {
      toast({ title: "Could not save promotion settings", description: (error as Error).message, variant: "destructive" });
    } finally {
      setPromotionSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Academic Sessions</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Each academic year runs in its own isolated database schema — student records, fees,
            attendance, and exam data are completely separate.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </div>
      </div>

      {/* Active session banner */}
      {current && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Active Session: {current.name}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
              All portals (Admin, Teacher, Parent) are working with this year's data.
            </p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-amber-500" />
            Create New Academic Session
          </h3>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex gap-2 text-sm">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <span className="text-blue-700 dark:text-blue-300">
              A new PostgreSQL schema will be created with isolated tables for students, fees,
              attendance, exams and more. This takes a few seconds.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Start Year</label>
              <Input
                type="number"
                value={yearStart}
                onChange={(e) => handleYearStartChange(e.target.value)}
                className="text-center font-bold text-lg h-11 bg-slate-50 dark:bg-slate-800"
                min={2000}
                max={2100}
              />
            </div>
            <div className="pt-5">
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">End Year</label>
              <Input
                type="number"
                value={yearEnd}
                readOnly
                className="text-center font-bold text-lg h-11 bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowForm(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                <>Create {yearStart}-{yearEnd}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No sessions yet</p>
          <p className="text-sm mt-1">Create your first academic session above.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {[...sessions].reverse().map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 transition-all ${
                session.isCurrent
                  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  session.isCurrent
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}>
                  <CalendarRange className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-lg">
                      {session.name}
                    </span>
                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-xs font-bold px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    schema: {session.schemaName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {session.isCurrent ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Currently active
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-slate-300 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 hover:text-amber-600"
                    disabled={switching !== null}
                    onClick={() => handleSetCurrent(session.id, session.name)}
                  >
                    {switching === session.id ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Switching…</>
                    ) : (
                      <>Set as Active</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-500 space-y-1.5">
        <p className="font-medium text-slate-700 dark:text-slate-300">How session isolation works</p>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li>Each year's <strong>students, fees, attendance, exams</strong> live in a separate database schema.</li>
          <li><strong>Classes, teachers, staff, and school settings</strong> are shared across all years.</li>
          <li>Switching the active session takes effect immediately — no restart needed.</li>
          <li>Old sessions remain accessible in the database — data is never deleted.</li>
        </ul>
      </div>

      {/* Year-end Promotion Wizard */}
      {sessions.length >= 2 && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden">
          <div className="bg-violet-50 dark:bg-violet-900/20 px-5 py-3 flex items-center gap-2 border-b border-violet-200 dark:border-violet-800">
            <GraduationCap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">Year-End Promotion</span>
          </div>
          <div className="p-5 bg-white dark:bg-slate-900">
            <PromotionWizard sessions={sessions} />
          </div>
        </div>
      )}

      {sessions.length < 2 && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/50 dark:bg-violet-900/10 flex items-center gap-3 text-sm text-violet-700 dark:text-violet-400">
          <GraduationCap className="h-5 w-5 shrink-0" />
          <span>Create at least <strong>two</strong> academic sessions to use the Year-End Promotion Wizard.</span>
        </div>
      )}

      {/* Teacher promotion configuration */}
      {sessions.length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <Lock className="h-4 w-4 text-amber-600" />
            <div>
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Teacher Promotion Access</span>
              <p className="text-xs text-amber-700/80 dark:text-amber-400">Configure the source/target year, open duration, and teachers who may submit decisions.</p>
            </div>
          </div>
          <div className="space-y-5 bg-white p-5 dark:bg-slate-900">
            {promotionLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-amber-500" /></div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Source session</label>
                    <select
                      value={promotionSourceId}
                      onChange={async (event) => {
                        const next = event.target.value;
                        setPromotionSourceId(next);
                        setPromotionTargetId("");
                        await fetchPromotionConfig(Number(next), sessions);
                      }}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Select source session</option>
                      {sessions.map(session => <option key={session.id} value={session.id}>{session.name}{session.isCurrent ? " (current)" : ""}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Target session</label>
                    <select
                      value={promotionTargetId}
                      onChange={event => setPromotionTargetId(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Select target session</option>
                      {availableTargetSessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Window duration (hours)</label>
                    <Input type="number" min={1} max={8760} value={promotionWindowHours} onChange={event => setPromotionWindowHours(event.target.value)} className="h-10" />
                    <p className="text-[11px] text-slate-400">Example: 72 hours = 3 days from saving.</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Teachers with access</p>
                    <span className="text-xs text-slate-400">({promotionTeacherIds.length} selected)</span>
                  </div>
                  {promotionConfig?.teachers.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {promotionConfig.teachers.map(teacher => {
                        const checked = promotionTeacherIds.includes(teacher.id);
                        return (
                          <label key={teacher.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setPromotionTeacherIds(prev => checked ? prev.filter(id => id !== teacher.id) : [...prev, teacher.id])}
                              className="h-4 w-4 accent-amber-500"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{teacher.name}</span>
                              <span className="block truncate text-xs text-slate-500">{teacher.employeeId} · {teacher.classAssigned ? `Class ${teacher.classAssigned}` : "No class assigned"}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">No teachers are available in the selected source session.</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="text-xs text-slate-500">
                    {promotionConfig?.config?.windowEndsAt
                      ? `Current window closes ${new Date(promotionConfig.config.windowEndsAt).toLocaleString()}. Saving reopens it.`
                      : "Saving opens a new teacher promotion window."}
                  </p>
                  <Button onClick={savePromotionConfig} disabled={promotionSaving || promotionLoading} className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400">
                    {promotionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save teacher access
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
