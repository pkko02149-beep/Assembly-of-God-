import { useEffect, useState } from "react";
import { useListStudents, useListClasses, useListSections } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Trash2, Pencil, Loader2, Search, Eye, EyeOff, Link2, KeyRound,
  Copy, Check, RefreshCw, Bell, CalendarRange, CheckCircle2, XCircle, Megaphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";

interface Parent {
  id: number; fatherName: string; motherName: string; email: string; mobile: string; createdAt: string;
}
interface LinkedStudent { studentId: number; studentName: string; classId?: number; }
interface ResetResult { name: string; email: string; newPassword: string; }

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function ParentsListPanel() {
  const { toast } = useToast();
  const { data: allStudents = [] } = useListStudents();
  const [parents, setParents] = useState<Parent[]>([]);
  const [filtered, setFiltered] = useState<Parent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editParent, setEditParent] = useState<Parent | null>(null);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [studentToLink, setStudentToLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ fatherName: "", motherName: "", email: "", mobile: "", password: "" });

  // Reset password state
  const [resetting, setResetting] = useState<number | null>(null);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [resetResults, setResetResults] = useState<ResetResult[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => { loadParents(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(parents.filter(p =>
      (p.fatherName || "").toLowerCase().includes(q) ||
      (p.motherName || "").toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    ));
  }, [search, parents]);

  async function loadParents() {
    setLoading(true);
    try {
      const data = await api("GET", "/parents");
      setParents(data);
      setFiltered(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  function openAdd() {
    setEditParent(null);
    setForm({ fatherName: "", motherName: "", email: "", mobile: "", password: "" });
    setOpen(true);
  }

  function openEdit(p: Parent) {
    setEditParent(p);
    setForm({ fatherName: p.fatherName || "", motherName: p.motherName || "", email: p.email, mobile: p.mobile || "", password: "" });
    setOpen(true);
  }

  async function openLink(p: Parent) {
    setSelectedParent(p);
    try {
      const data = await api("GET", `/parents/${p.id}/students`);
      setLinkedStudents(data);
    } catch { setLinkedStudents([]); }
    setStudentToLink("");
    setLinkOpen(true);
  }

  async function handleSave() {
    if (!form.email) { toast({ title: "Error", description: "Email is required", variant: "destructive" }); return; }
    if (!editParent && !form.password) { toast({ title: "Error", description: "Password is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        fatherName: form.fatherName, motherName: form.motherName,
        email: form.email, mobile: form.mobile,
      };
      if (!editParent) payload.password = form.password;
      else if (form.password) payload.password = form.password;

      if (editParent) {
        await api("PUT", `/parents/${editParent.id}`, payload);
        toast({ title: "Updated" });
      } else {
        await api("POST", "/parents", payload);
        toast({ title: "Added", description: "Parent account created" });
      }
      setOpen(false);
      loadParents();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleLinkStudent() {
    if (!studentToLink || !selectedParent) return;
    try {
      await api("POST", `/parents/${selectedParent.id}/link-student`, { studentId: parseInt(studentToLink) });
      toast({ title: "Linked" });
      const data = await api("GET", `/parents/${selectedParent.id}/students`);
      setLinkedStudents(data);
      setStudentToLink("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this parent account? This cannot be undone.")) return;
    try {
      await api("DELETE", `/parents/${id}`);
      toast({ title: "Deleted" });
      loadParents();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  }

  async function handleResetOne(p: Parent) {
    setResetting(p.id);
    try {
      const newPassword = randomPassword();
      await api("PUT", `/parents/${p.id}`, { password: newPassword });
      setResetResults([{ name: p.fatherName || p.motherName || p.email, email: p.email, newPassword }]);
      setResetDialogOpen(true);
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    } finally { setResetting(null); }
  }

  async function handleResetAll() {
    if (!confirm(`Reset passwords for all ${parents.length} parents? Each will receive a new random password.`)) return;
    setBulkResetting(true);
    const results: ResetResult[] = [];
    try {
      for (const p of parents) {
        const newPassword = randomPassword();
        await api("PUT", `/parents/${p.id}`, { password: newPassword });
        results.push({ name: p.fatherName || p.motherName || p.email, email: p.email, newPassword });
      }
      setResetResults(results);
      setResetDialogOpen(true);
    } catch (e: any) {
      toast({ title: "Bulk reset error", description: e.message, variant: "destructive" });
    } finally { setBulkResetting(false); }
  }

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  function copyAllPasswords() {
    const text = resetResults.map(r => `${r.name} | ${r.email} | ${r.newPassword}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "All passwords copied to clipboard" });
    });
  }

  const displayName = (p: Parent) => p.fatherName || p.motherName || p.email;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Parent Accounts</h2>
          <p className="text-sm text-slate-500">{parents.length} parents registered</p>
        </div>
        <div className="flex items-center gap-2">
          {parents.length > 0 && (
            <Button
              variant="outline"
              onClick={handleResetAll}
              disabled={bulkResetting}
              className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
            >
              {bulkResetting
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <RefreshCw className="w-4 h-4 mr-2" />}
              Reset All Passwords
            </Button>
          )}
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Add Parent
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search parents..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Father's Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Mother's Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Mobile</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />No parents found
                    </td></tr>
                  )}
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.fatherName || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.motherName || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.email}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.mobile || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleResetOne(p)}
                            disabled={resetting === p.id}
                            className="text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                            title="Reset password"
                          >
                            {resetting === p.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <KeyRound className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openLink(p)} className="text-green-500 hover:text-green-700 hover:bg-green-50" title="Link students">
                            <Link2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editParent ? "Edit Parent" : "Add Parent"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Father's Name</Label>
                <Input placeholder="Father's name" value={form.fatherName} onChange={e => setForm(f => ({ ...f, fatherName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Mother's Name</Label>
                <Input placeholder="Mother's name" value={form.motherName} onChange={e => setForm(f => ({ ...f, motherName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="parent@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editParent} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input placeholder="+91 98765 43210" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{editParent ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} placeholder={editParent ? "Leave blank to keep current" : "Set login password"}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editParent ? "Update Parent" : "Create Parent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Students Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Students — {selectedParent && displayName(selectedParent)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Linked Students</Label>
              {linkedStudents.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No students linked yet</p>
              ) : (
                <div className="space-y-1">
                  {linkedStudents.map(s => (
                    <div key={s.studentId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">{s.studentName}</span>
                      <Badge variant="outline">ID: {s.studentId}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label>Link a Student</Label>
              <div className="flex gap-2">
                <Select value={studentToLink} onValueChange={setStudentToLink}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allStudents as { id: number; studentName: string }[])
                      .filter(s => !linkedStudents.some(ls => ls.studentId === s.id))
                      .map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.studentName}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <Button onClick={handleLinkStudent} disabled={!studentToLink} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Link2 className="w-4 h-4 mr-1" /> Link
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password reset result dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-500" />
              {resetResults.length === 1 ? "Password Reset" : `Passwords Reset — ${resetResults.length} Parents`}
            </DialogTitle>
            <DialogDescription>
              Share these new passwords with the parents. They won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {resetResults.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{r.name}</p>
                    <p className="text-xs text-slate-500 truncate">{r.email}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-orange-600 dark:text-orange-400">
                    {r.newPassword}
                  </code>
                  <Button
                    size="icon" variant="outline"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyToClipboard(r.newPassword, i)}
                    title="Copy password"
                  >
                    {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}

            {resetResults.length > 1 && (
              <Button variant="outline" className="w-full" onClick={copyAllPasswords}>
                <Copy className="w-4 h-4 mr-2" />
                Copy All as Text
              </Button>
            )}

            <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white" onClick={() => setResetDialogOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Student Leave Requests Panel ──────────────────────────────────────────────
interface StudentLeave {
  id: number; reason: string; fromDate: string; toDate: string;
  status: string; adminRemarks?: string; createdAt: string;
  studentName?: string; fatherName?: string; parentFather?: string;
  className?: string; sectionName?: string;
}

function StudentLeavePanel() {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<StudentLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api("GET", "/leave-requests?userType=parent");
      setLeaves(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Could not load leave requests", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function updateStatus(id: number, status: "approved" | "rejected") {
    setUpdating(id);
    try {
      await api("PUT", `/leave-requests/${id}`, { status });
      toast({ title: `Leave ${status}` });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setUpdating(null); }
  }

  const filtered = filterStatus === "all" ? leaves : leaves.filter(l => l.status === filterStatus);
  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Student Leave Requests</h3>
          <p className="text-xs text-slate-500">Submitted by parents for their children</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <CalendarRange className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{filterStatus === "pending" ? "No pending leave requests" : "No leave requests found"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const days = differenceInCalendarDays(new Date(r.toDate), new Date(r.fromDate)) + 1;
            const parentName = r.parentFather || r.fatherName;
            return (
              <Card key={r.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-slate-800">{r.studentName || "Student"}</span>
                        {r.className && (
                          <Badge variant="outline" className="text-xs">
                            {r.className}{r.sectionName ? ` – ${r.sectionName}` : ""}
                          </Badge>
                        )}
                        <Badge className={statusStyles[r.status] || "bg-slate-100 text-slate-600"}>{r.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <CalendarRange className="w-3 h-3" />
                        {format(new Date(r.fromDate), "MMM d")} – {format(new Date(r.toDate), "MMM d, yyyy")} · {days} day{days > 1 ? "s" : ""}
                      </div>
                      <p className="text-sm text-slate-600">{r.reason}</p>
                      {parentName && <p className="text-xs text-slate-400 mt-1">Parent: {parentName}</p>}
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" onClick={() => updateStatus(r.id, "approved")}
                          disabled={updating === r.id}
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "rejected")}
                          disabled={updating === r.id}
                          className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50">
                          <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Notices to Students (sent via parent portal) ─────────────────────────────
interface Notice { id: number; title: string; content: string; classId?: number; sectionId?: number; createdAt: string; isActive: boolean; }
interface SchoolClass { id: number; name: string; }
interface SchoolSection { id: number; name: string; classId?: number; }

function StudentNoticesPanel() {
  const { toast } = useToast();
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterClass, setFilterClass] = useState("all");
  const [form, setForm] = useState({ title: "", content: "", classId: "all", sectionId: "all" });

  useEffect(() => { loadNotices(); }, []);

  async function loadNotices() {
    setLoading(true);
    try {
      const data = await api("GET", "/notices?targetRole=parents");
      setNotices(Array.isArray(data) ? data : []);
    } catch { toast({ title: "Could not load notices", variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function handleSend() {
    if (!form.title || !form.content) {
      toast({ title: "Title and content required", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await api("POST", "/notices", {
        title: form.title, content: form.content, targetRole: "parents",
        classId: form.classId !== "all" ? parseInt(form.classId) : null,
        sectionId: form.sectionId !== "all" ? parseInt(form.sectionId) : null,
        isActive: true,
      });
      toast({ title: "Notice sent to parents" });
      setForm({ title: "", content: "", classId: "all", sectionId: "all" });
      loadNotices();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function deleteNotice(id: number) {
    if (!confirm("Delete this notice?")) return;
    await api("DELETE", `/notices/${id}`);
    toast({ title: "Deleted" });
    loadNotices();
  }

  const filteredSections = form.classId !== "all"
    ? (sections as SchoolSection[]).filter(s => !s.classId || s.classId === parseInt(form.classId))
    : sections as SchoolSection[];

  const displayedNotices = filterClass === "all" ? notices : notices.filter(n => n.classId === parseInt(filterClass));

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-800">Send Notice to Parents</h3>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Class Filter</Label>
              <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v, sectionId: "all" }))}>
                <SelectTrigger className="h-8"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes as SchoolClass[]).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Section Filter</Label>
              <Select value={form.sectionId} onValueChange={v => setForm(f => ({ ...f, sectionId: v }))} disabled={form.classId === "all"}>
                <SelectTrigger className="h-8"><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {filteredSections.map((s: SchoolSection) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input placeholder="Notice title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content *</Label>
            <Textarea placeholder="Notice content..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} />
          </div>
          <Button onClick={handleSend} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
            Send to {form.classId !== "all" ? `Class Parents${form.sectionId !== "all" ? " (Section)" : ""}` : "All Parents"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">Sent Notices</h4>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36 h-7"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {(classes as SchoolClass[]).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : displayedNotices.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No notices sent yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedNotices.map(n => {
            const cls = (classes as SchoolClass[]).find(c => c.id === n.classId);
            const sec = (sections as SchoolSection[]).find(s => s.id === n.sectionId);
            return (
              <Card key={n.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium text-sm text-slate-800">{n.title}</span>
                      {cls ? <Badge variant="outline" className="text-xs">{cls.name}{sec ? ` – ${sec.name}` : ""}</Badge>
                           : <Badge variant="outline" className="text-xs">All Parents</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.content}</p>
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(n.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                    onClick={() => deleteNotice(n.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main wrapper with sub-tabs ────────────────────────────────────────────────
export default function ParentsTab() {
  return (
    <Tabs defaultValue="parents" className="w-full">
      <TabsList className="mb-4 h-auto flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg">
        <TabsTrigger value="parents" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
          <Users className="h-4 w-4 mr-2" />Parents
        </TabsTrigger>
        <TabsTrigger value="student-leave" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
          <CalendarRange className="h-4 w-4 mr-2" />Student Leave Requests
        </TabsTrigger>
        <TabsTrigger value="notices" className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
          <Bell className="h-4 w-4 mr-2" />Notices to Parents
        </TabsTrigger>
      </TabsList>
      <TabsContent value="parents" className="focus-visible:outline-none"><ParentsListPanel /></TabsContent>
      <TabsContent value="student-leave" className="focus-visible:outline-none"><StudentLeavePanel /></TabsContent>
      <TabsContent value="notices" className="focus-visible:outline-none"><StudentNoticesPanel /></TabsContent>
    </Tabs>
  );
}
