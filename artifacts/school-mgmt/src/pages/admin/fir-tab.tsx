import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, RefreshCw, Search, CheckCircle2, Clock, AlertTriangle, Flame, Pencil, Trash2, X, CheckCheck, RotateCcw, CalendarCheck } from "lucide-react";
import { format, isValid } from "date-fns";

function safeFormat(dateStr: string | null | undefined, fmt: string, fallback = "—"): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt) : fallback;
}

interface FirRecord {
  id: number;
  studentId: number;
  classId: number;
  incidentDate: string;
  description: string;
  actionTaken: string;
  severity: string;
  status: string;
  resolvedAt: string | null;
  reportedById: number;
  createdAt: string;
  studentName: string | null;
  fatherName: string | null;
  className: string | null;
  teacherName: string | null;
}

async function api(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error || "Request failed");
  }
  return res.json();
}

const SEVERITY_CONFIG = {
  minor:    { label: "Minor",    color: "bg-blue-100 text-blue-700 border-blue-200",       icon: AlertTriangle, dot: "bg-blue-400" },
  moderate: { label: "Moderate", color: "bg-amber-100 text-amber-700 border-amber-200",    icon: AlertTriangle, dot: "bg-amber-400" },
  major:    { label: "Major",    color: "bg-orange-100 text-orange-700 border-orange-200", icon: Flame,         dot: "bg-orange-500" },
  severe:   { label: "Severe",   color: "bg-orange-100 text-orange-700 border-orange-200", icon: Flame,         dot: "bg-orange-500" },
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200",          icon: Flame,         dot: "bg-red-600" },
} as const;

function getSeverityConfig(s: string) {
  return SEVERITY_CONFIG[s as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.minor;
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = getSeverityConfig(severity);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status, resolvedAt }: { status: string; resolvedAt?: string | null }) {
  if (status === "resolved") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3" /> Resolved
        </span>
        {resolvedAt && (
          <span className="text-[10px] text-green-600 flex items-center gap-1 pl-1">
            <CalendarCheck className="w-2.5 h-2.5" />
            {safeFormat(resolvedAt, "dd MMM yyyy")}
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-600 border-slate-200">
      <Clock className="w-3 h-3" /> Open
    </span>
  );
}

export default function FirTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<FirRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit dialog
  const [editRecord, setEditRecord] = useState<FirRecord | null>(null);
  const [editForm, setEditForm] = useState({ description: "", actionTaken: "", severity: "minor" });
  const [saving, setSaving] = useState(false);

  // Resolve dialog
  const [resolveRecord, setResolveRecord] = useState<FirRecord | null>(null);
  const [resolveDate, setResolveDate] = useState("");
  const [resolving, setResolving] = useState(false);

  // Reopen confirm
  const [reopenRecord, setReopenRecord] = useState<FirRecord | null>(null);
  const [reopening, setReopening] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api("GET", "/fir");
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load incidents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(r: FirRecord) {
    setEditRecord(r);
    setEditForm({ description: r.description, actionTaken: r.actionTaken, severity: r.severity });
  }

  async function saveEdit() {
    if (!editRecord) return;
    setSaving(true);
    try {
      const updated = await api("PUT", `/fir/${editRecord.id}`, editForm);
      setRecords(prev => prev.map(r => r.id === editRecord.id ? { ...r, ...updated } : r));
      setEditRecord(null);
      toast({ title: "Incident updated" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function openResolve(r: FirRecord) {
    setResolveRecord(r);
    setResolveDate(new Date().toISOString().split("T")[0]);
  }

  async function confirmResolve() {
    if (!resolveRecord) return;
    setResolving(true);
    try {
      const updated = await api("PUT", `/fir/${resolveRecord.id}`, {
        status: "resolved",
        resolvedAt: resolveDate || new Date().toISOString().split("T")[0],
      });
      setRecords(prev => prev.map(r => r.id === resolveRecord.id ? { ...r, ...updated } : r));
      setResolveRecord(null);
      toast({ title: "Incident marked as resolved" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  async function confirmReopen() {
    if (!reopenRecord) return;
    setReopening(true);
    try {
      const updated = await api("PUT", `/fir/${reopenRecord.id}`, { status: "open", resolvedAt: null });
      setRecords(prev => prev.map(r => r.id === reopenRecord.id ? { ...r, ...updated } : r));
      setReopenRecord(null);
      toast({ title: "Incident reopened" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setReopening(false);
    }
  }

  async function deleteRecord() {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await api("DELETE", `/fir/${deleteId}`);
      setRecords(prev => prev.filter(r => r.id !== deleteId));
      setDeleteId(null);
      toast({ title: "Incident deleted" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const classes = useMemo(() => {
    const seen = new Map<number, string>();
    records.forEach(r => { if (r.classId) seen.set(r.classId, r.className ?? String(r.classId)); });
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0]);
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (filterClass !== "all" && String(r.classId) !== filterClass) return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q) {
        return (
          (r.studentName ?? "").toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.teacherName ?? "").toLowerCase().includes(q) ||
          (r.className ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, filterClass, filterSeverity, filterStatus, search]);

  const stats = useMemo(() => ({
    total: records.length,
    open: records.filter(r => r.status === "open").length,
    resolved: records.filter(r => r.status === "resolved").length,
    critical: records.filter(r => r.severity === "critical" || r.severity === "major" || r.severity === "severe").length,
  }), [records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Incident Register
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">All FIR / disciplinary incidents reported by class teachers</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Total Incidents</p>
            <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-slate-500 mb-1">Open</p>
            <p className="text-3xl font-bold text-slate-700">{stats.open}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-green-600 mb-1">Resolved</p>
            <p className="text-3xl font-bold text-green-700">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-red-600 mb-1">Major / Critical</p>
            <p className="text-3xl font-bold text-red-700">{stats.critical}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search student, description, teacher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>Class {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            {(filterClass !== "all" || filterSeverity !== "all" || filterStatus !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500"
                onClick={() => { setSearch(""); setFilterClass("all"); setFilterSeverity("all"); setFilterStatus("all"); }}
              >
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-slate-50 py-3 px-4">
          <CardTitle className="text-sm font-medium text-slate-600">
            {filtered.length} incident{filtered.length !== 1 ? "s" : ""} {filtered.length !== records.length ? `(filtered from ${records.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No incidents found</p>
              {records.length > 0 && <p className="text-sm mt-1">Try adjusting the filters</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Student</th>
                    <th className="text-left px-4 py-3 font-medium">Class</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Severity</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Action Taken</th>
                    <th className="text-left px-4 py-3 font-medium">Reported By</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${r.status === "resolved" ? "bg-green-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.studentName ?? "—"}</p>
                        {r.fatherName && <p className="text-xs text-slate-400">{r.fatherName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-600">{r.className ? `Class ${r.className}` : "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {safeFormat(r.incidentDate, "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} resolvedAt={r.resolvedAt} />
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-slate-600 line-clamp-2">{r.description}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="text-slate-500 text-xs line-clamp-2">
                          {r.actionTaken || <span className="italic text-slate-300">None yet</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {r.teacherName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "open" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() => openResolve(r)}
                              title="Mark as Resolved"
                            >
                              <CheckCheck className="w-3.5 h-3.5 mr-1" />
                              Resolve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
                              onClick={() => setReopenRecord(r)}
                              title="Reopen Incident"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Reopen
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600" onClick={() => openEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => setDeleteId(r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve dialog */}
      <Dialog open={!!resolveRecord} onOpenChange={open => !open && setResolveRecord(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCheck className="w-5 h-5" />
              Resolve Incident
            </DialogTitle>
          </DialogHeader>
          {resolveRecord && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-50 border text-sm">
                <p className="font-medium text-slate-800">{resolveRecord.studentName}</p>
                <p className="text-slate-500">
                  {resolveRecord.className ? `Class ${resolveRecord.className}` : ""} ·{" "}
                  {safeFormat(resolveRecord.incidentDate, "dd MMM yyyy")}
                </p>
                <p className="text-slate-600 mt-1 text-xs line-clamp-2">{resolveRecord.description}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Resolution Date
                </Label>
                <Input
                  type="date"
                  value={resolveDate}
                  onChange={e => setResolveDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
                <p className="text-xs text-slate-400 mt-1">Select the date this incident was resolved.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveRecord(null)}>Cancel</Button>
            <Button
              onClick={confirmResolve}
              disabled={resolving || !resolveDate}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {resolving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen confirm */}
      <AlertDialog open={!!reopenRecord} onOpenChange={open => !open && setReopenRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status back to <strong>Open</strong> and clear the resolved date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReopen} disabled={reopening} className="bg-slate-700 hover:bg-slate-800 text-white">
              {reopening && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reopen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit modal */}
      <Dialog open={!!editRecord} onOpenChange={open => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Edit Incident
            </DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-50 border text-sm">
                <p className="font-medium text-slate-800">{editRecord.studentName}</p>
                <p className="text-slate-500">
                  {editRecord.className ? `Class ${editRecord.className}` : ""} ·{" "}
                  {safeFormat(editRecord.incidentDate, "dd MMM yyyy")}
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Severity</Label>
                <Select value={editForm.severity} onValueChange={v => setEditForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Action Taken</Label>
                <Textarea
                  value={editForm.actionTaken}
                  onChange={e => setEditForm(f => ({ ...f, actionTaken: e.target.value }))}
                  rows={3}
                  placeholder="Describe action taken by the school…"
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this incident record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the FIR record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRecord} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
