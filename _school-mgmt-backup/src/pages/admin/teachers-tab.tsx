import { useEffect, useState } from "react";
import { useListClasses } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Plus, Trash2, Pencil, Loader2, Search, Eye, EyeOff, KeyRound, Copy, Check, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Teacher {
  id: number; employeeId: string; name: string; email: string; mobile: string;
  classAssigned: number | null; className?: string;
  sectionAssigned: number | null; sectionName?: string;
  subject: string; createdAt: string;
}
interface Section { id: number; name: string; classId: number | null; }

interface ResetResult { name: string; employeeId: string; email: string; newPassword: string; }

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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

export default function TeachersTab() {
  const { toast } = useToast();
  const { data: classes = [] } = useListClasses();
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filtered, setFiltered] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    employeeId: "", name: "", email: "", mobile: "", password: "",
    classAssigned: "", sectionAssigned: "", subject: "",
  });

  // Reset password state
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [resetting, setResetting] = useState<number | null>(null);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [resetResults, setResetResults] = useState<ResetResult[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    loadTeachers();
    api("GET", "/sections").then(setSections).catch(() => {});
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(teachers.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.employeeId.toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q)
    ));
  }, [search, teachers]);

  async function loadTeachers() {
    setLoading(true);
    try {
      const data = await api("GET", "/teachers");
      setTeachers(data);
      setFiltered(data);
    } catch (e: any) {
      toast({ title: "Error loading teachers", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  function generateEmployeeId() {
    const nums = teachers
      .map(t => { const m = t.employeeId?.match(/^EMP(\d+)$/i); return m ? parseInt(m[1], 10) : 0; })
      .filter(n => n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `EMP${String(next).padStart(3, "0")}`;
  }

  function openAdd() {
    setEditTeacher(null);
    setNewSubjectInput("");
    setForm({ employeeId: generateEmployeeId(), name: "", email: "", mobile: "", password: "", classAssigned: "", sectionAssigned: "", subject: "" });
    setOpen(true);
  }

  function openEdit(t: Teacher) {
    setEditTeacher(t);
    setNewSubjectInput("");
    setForm({
      employeeId: t.employeeId, name: t.name, email: t.email,
      mobile: t.mobile || "", password: "",
      classAssigned: t.classAssigned ? String(t.classAssigned) : "",
      sectionAssigned: t.sectionAssigned ? String(t.sectionAssigned) : "",
      subject: t.subject || "",
    });
    setOpen(true);
  }

  function getSubjects(): string[] {
    return form.subject ? form.subject.split(",").map(s => s.trim()).filter(Boolean) : [];
  }
  function addSubject() {
    const s = newSubjectInput.trim();
    if (!s) return;
    const existing = getSubjects();
    if (!existing.includes(s)) {
      setForm(f => ({ ...f, subject: [...existing, s].join(", ") }));
    }
    setNewSubjectInput("");
  }
  function removeSubject(subj: string) {
    const updated = getSubjects().filter(s => s !== subj);
    setForm(f => ({ ...f, subject: updated.join(", ") }));
  }

  async function handleSave() {
    if (!form.name || !form.email) {
      toast({ title: "Error", description: "Name and email are required", variant: "destructive" }); return;
    }
    if (!editTeacher && !form.password) {
      toast({ title: "Error", description: "Password is required for new teachers", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name, email: form.email, mobile: form.mobile,
        subject: form.subject,
        classAssigned: form.classAssigned ? parseInt(form.classAssigned) : null,
        sectionAssigned: form.sectionAssigned ? parseInt(form.sectionAssigned) : null,
      };
      if (!editTeacher) { payload.employeeId = form.employeeId; payload.password = form.password; }
      else if (form.password) { payload.password = form.password; }

      if (editTeacher) {
        await api("PUT", `/teachers/${editTeacher.id}`, payload);
        toast({ title: "Updated", description: "Teacher updated successfully" });
      } else {
        await api("POST", "/teachers", payload);
        toast({ title: "Added", description: "Teacher account created" });
      }
      setOpen(false);
      loadTeachers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete teacher "${name}"? This cannot be undone.`)) return;
    try {
      await api("DELETE", `/teachers/${id}`);
      toast({ title: "Deleted" });
      loadTeachers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleResetOne(t: Teacher) {
    setResetting(t.id);
    try {
      const newPassword = randomPassword();
      await api("PUT", `/teachers/${t.id}`, { password: newPassword });
      setResetResults([{ name: t.name, employeeId: t.employeeId, email: t.email, newPassword }]);
      setResetDialogOpen(true);
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message, variant: "destructive" });
    } finally { setResetting(null); }
  }

  async function handleResetAll() {
    if (!confirm(`Reset passwords for all ${teachers.length} teachers? Each will receive a new random password.`)) return;
    setBulkResetting(true);
    const results: ResetResult[] = [];
    try {
      for (const t of teachers) {
        const newPassword = randomPassword();
        await api("PUT", `/teachers/${t.id}`, { password: newPassword });
        results.push({ name: t.name, employeeId: t.employeeId, email: t.email, newPassword });
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
    const text = resetResults.map(r => `${r.employeeId} | ${r.name} | ${r.email} | ${r.newPassword}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "All passwords copied to clipboard" });
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Teachers</h2>
          <p className="text-sm text-slate-500">{teachers.length} teachers registered</p>
        </div>
        <div className="flex items-center gap-2">
          {teachers.length > 0 && (
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
          <Button onClick={openAdd} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Add Teacher
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search teachers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Employee ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Subject</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Class / Section</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400">
                      <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      No teachers found
                    </td></tr>
                  )}
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono">{t.employeeId}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{t.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{t.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.subject
                            ? t.subject.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                                <Badge key={s} className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">{s}</Badge>
                              ))
                            : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {t.className || "—"}
                        {t.sectionName && <span className="ml-1 text-xs text-slate-400">· Sec {t.sectionName}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleResetOne(t)}
                            disabled={resetting === t.id}
                            className="text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                            title="Reset password"
                          >
                            {resetting === t.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <KeyRound className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id, t.name)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
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

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTeacher ? "Edit Teacher" : "Add Teacher"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {!editTeacher && (
                <div className="space-y-1.5">
                  <Label>Employee ID *</Label>
                  <Input placeholder="EMP001" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
                </div>
              )}
              <div className={`space-y-1.5 ${editTeacher ? "col-span-2" : ""}`}>
                <Label>Full Name *</Label>
                <Input placeholder="Teacher name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="teacher@school.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editTeacher} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input placeholder="+91 98765 43210" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subjects</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border bg-background">
                {getSubjects().map(subj => (
                  <span key={subj} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {subj}
                    <button type="button" onClick={() => removeSubject(subj)} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Mathematics"
                  value={newSubjectInput}
                  onChange={e => setNewSubjectInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubject(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addSubject}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class Assigned</Label>
                <Select value={form.classAssigned || "none"} onValueChange={v => setForm(f => ({ ...f, classAssigned: v === "none" ? "" : v, sectionAssigned: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(classes as { id: number; name: string }[]).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Section Assigned</Label>
              <Select value={form.sectionAssigned || "none"} onValueChange={v => setForm(f => ({ ...f, sectionAssigned: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sections
                    .filter(s => !form.classAssigned || s.classId === null || String(s.classId) === form.classAssigned)
                    .map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editTeacher ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder={editTeacher ? "Leave blank to keep current" : "Set login password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editTeacher ? "Update Teacher" : "Create Teacher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password reset result dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-500" />
              {resetResults.length === 1 ? "Password Reset" : `Passwords Reset — ${resetResults.length} Teachers`}
            </DialogTitle>
            <DialogDescription>
              Share these new passwords with the teachers. They won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {resetResults.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{r.name}</p>
                    <p className="text-xs text-slate-500 truncate">{r.email} · <span className="font-mono">{r.employeeId}</span></p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs shrink-0 bg-white dark:bg-slate-900">
                    {r.newPassword}
                  </Badge>
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
