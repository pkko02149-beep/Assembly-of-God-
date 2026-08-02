import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, UserCog, Check, X } from "lucide-react";
import { getAdminToken } from "@/lib/auth";

function authHeader(): Record<string, string> {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const PERMISSION_TABS = [
  { key: "fees", label: "Fee Setup & Collection" },
  { key: "records", label: "Records" },
  { key: "record-list", label: "Record List" },
  { key: "student-status", label: "Student Status" },
  { key: "student-panel", label: "Certificates" },
  { key: "expenditure", label: "Expenditure" },
  { key: "bulk-email", label: "Bulk Email" },
  { key: "notify", label: "Bulk Notify" },
  { key: "qr-codes", label: "QR Codes" },
  { key: "scan", label: "Scan" },
  { key: "id-cards", label: "ID Cards" },
  { key: "attendance-group", label: "Attendance" },
  { key: "teacher-management", label: "Teacher Management" },
  { key: "exam-management", label: "Exam Management" },
  { key: "parents", label: "Parents Management" },
  { key: "settings", label: "Settings" },
  { key: "security", label: "Security" },
];

type TabPerm = { view: boolean; edit: boolean; delete: boolean };
type Permissions = Record<string, TabPerm>;

const DEFAULT_PERMISSIONS: Permissions = Object.fromEntries(
  PERMISSION_TABS.map(t => [t.key, { view: false, edit: false, delete: false }])
);

interface StaffUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string;
  active: boolean;
  createdAt: string;
}

export default function StaffUsersSection() {
  const { toast } = useToast();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);

  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("accountant");
  const [formPerms, setFormPerms] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/staff-users", { headers: authHeader() });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load staff users", variant: "destructive" });
      setUsers([]);
    } finally { setLoading(false); }
  }

  function openAdd() {
    setEditUser(null);
    setFormName(""); setFormUsername(""); setFormPassword("");
    setFormRole("accountant");
    setFormPerms({ ...DEFAULT_PERMISSIONS });
    setShowDialog(true);
  }

  function openEdit(user: StaffUser) {
    setEditUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role);
    let parsed: Permissions = { ...DEFAULT_PERMISSIONS };
    try { const p = JSON.parse(user.permissions || "{}"); parsed = { ...DEFAULT_PERMISSIONS, ...p }; } catch {}
    setFormPerms(parsed);
    setShowDialog(true);
  }

  function setTabPerm(tab: string, field: "view" | "edit" | "delete", val: boolean) {
    setFormPerms(prev => {
      const next = { ...prev, [tab]: { ...(prev[tab] ?? { view: false, edit: false, delete: false }), [field]: val } };
      if (field === "view" && !val) {
        next[tab].edit = false;
        next[tab].delete = false;
      }
      return next;
    });
  }

  function selectAll(val: boolean) {
    setFormPerms(Object.fromEntries(PERMISSION_TABS.map(t => [t.key, { view: val, edit: val, delete: val }])));
  }

  async function handleSave() {
    if (!formName.trim() || !formUsername.trim()) {
      toast({ title: "Name and username are required", variant: "destructive" }); return;
    }
    if (!editUser && !formPassword) {
      toast({ title: "Password is required for new user", variant: "destructive" }); return;
    }
    setFormSaving(true);
    try {
      const body: any = { name: formName.trim(), username: formUsername.trim(), role: formRole, permissions: formPerms };
      if (formPassword) body.password = formPassword;
      const url = editUser ? `/api/staff-users/${editUser.id}` : "/api/staff-users";
      const method = editUser ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "Failed to save", variant: "destructive" }); return; }
      toast({ title: editUser ? "Staff user updated" : "Staff user created" });
      setShowDialog(false);
      fetchUsers();
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setFormSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/staff-users/${id}`, { method: "DELETE", headers: authHeader() });
      if (res.status === 204) {
        toast({ title: "Staff user deleted" });
        fetchUsers();
      }
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  }

  async function handleToggleActive(user: StaffUser) {
    try {
      await fetch(`/api/staff-users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ active: !user.active }) });
      fetchUsers();
    } catch {}
  }

  function parsePerms(raw: string): Permissions {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }

  function permSummary(raw: string): string {
    const p = parsePerms(raw);
    const tabs = PERMISSION_TABS.filter(t => p[t.key]?.view);
    if (tabs.length === 0) return "No access";
    if (tabs.length === PERMISSION_TABS.length) return "All tabs";
    return `${tabs.length} tab${tabs.length > 1 ? "s" : ""}`;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-amber-500" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Staff Users</h3>
        </div>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Staff User
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No staff users yet. Add one to get started.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Username</th>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Role</th>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Access</th>
                <th className="px-4 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-950/30"}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{u.username}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={u.role === "accountant" ? "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20" : "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-900/20"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{permSummary(u.permissions)}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleToggleActive(u)} className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${u.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {u.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(u)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white dark:bg-slate-900">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {u.name}?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove their login access.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white dark:bg-slate-900 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser ? `Edit Staff User — ${editUser.name}` : "Add Staff User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name *</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Priya Sharma" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username *</label>
                <Input value={formUsername} onChange={e => setFormUsername(e.target.value)} placeholder="e.g. priya123" autoComplete="off" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password {editUser ? "(leave blank to keep)" : "*"}</label>
                <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder={editUser ? "Leave blank to keep current" : "Set password"} autoComplete="new-password" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tab Permissions</label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => selectAll(true)}>
                    <Check className="h-3 w-3 mr-1" /> All Access
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200" onClick={() => selectAll(false)}>
                    <X className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Tab</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 w-20">View</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 w-20">Edit</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 w-20">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_TABS.map((tab, i) => {
                      const p = formPerms[tab.key] ?? { view: false, edit: false, delete: false };
                      return (
                        <tr key={tab.key} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-950/30"}`}>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{tab.label}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={p.view} onChange={e => setTabPerm(tab.key, "view", e.target.checked)} className="h-4 w-4 accent-amber-500 cursor-pointer" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={p.edit} disabled={!p.view} onChange={e => setTabPerm(tab.key, "edit", e.target.checked)} className="h-4 w-4 accent-amber-500 cursor-pointer disabled:opacity-40" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={p.delete} disabled={!p.view} onChange={e => setTabPerm(tab.key, "delete", e.target.checked)} className="h-4 w-4 accent-amber-500 cursor-pointer disabled:opacity-40" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={formSaving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold">
                {formSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editUser ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
