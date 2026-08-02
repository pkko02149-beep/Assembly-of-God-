import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import {
  Search, CheckCircle2, XCircle, Clock, Eye, Download, Save, FileText,
  MessageSquare, Trash2, ChevronDown, ChevronUp, IndianRupee, Bus, Shirt,
  Plus, GraduationCap, Loader2, RefreshCw,
} from "lucide-react";

function authHeader() {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...authHeader(), ...(opts?.headers as Record<string, string> | undefined ?? {}) } as HeadersInit });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Application {
  id: number; studentName: string; dateOfBirth: string; gender: string;
  fatherName: string; motherName: string; phone: string; alternatePhone: string;
  email: string; address: string; classApplied: string; previousSchool: string;
  previousClass: string; category: string; religion: string; message: string;
  status: string; remarks: string; createdAt: string; updatedAt: string;
}
interface FeeColumn { id: string; header: string; }
interface FeeRow { id: string; classGroup: string; values: Record<string, string>; }
interface TimingRow { id: string; day: string; time: string; }
interface TransportData { routes: { id: string; name: string; price: string }[]; features: { id: string; text: string }[]; }
interface UniformData { boys18: { id: string; text: string }[]; girls18: { id: string; text: string }[]; senior: { id: string; text: string }[]; sports: { id: string; text: string }[]; }

function uid() { return Math.random().toString(36).slice(2); }

const DEFAULT_FEE_COLS: FeeColumn[] = [
  { id: "fc1", header: "Admission Fee" },
  { id: "fc2", header: "Monthly Tuition" },
  { id: "fc3", header: "Annual Charges" },
];
const DEFAULT_FEE_ROWS: FeeRow[] = [
  { id: uid(), classGroup: "Nursery / LKG", values: { fc1: "₹2,000", fc2: "₹600/month", fc3: "₹1,500" } },
  { id: uid(), classGroup: "Class 1–5", values: { fc1: "₹2,500", fc2: "₹800/month", fc3: "₹2,000" } },
  { id: uid(), classGroup: "Class 6–8", values: { fc1: "₹3,000", fc2: "₹1,000/month", fc3: "₹2,500" } },
  { id: uid(), classGroup: "Class 9–10", values: { fc1: "₹3,500", fc2: "₹1,200/month", fc3: "₹3,000" } },
  { id: uid(), classGroup: "Class 11–12", values: { fc1: "₹4,000", fc2: "₹1,500/month", fc3: "₹3,500" } },
];
const DEFAULT_TIMING_ROWS: TimingRow[] = [
  { id: uid(), day: "Monday – Friday", time: "8:00 AM – 2:30 PM" },
  { id: uid(), day: "Saturday", time: "9:00 AM – 12:30 PM" },
  { id: uid(), day: "Office Hours", time: "9:00 AM – 4:00 PM (Mon–Sat)" },
  { id: uid(), day: "Summer Timing", time: "7:00 AM – 12:30 PM (Apr–Jun)" },
];
const DEFAULT_TRANSPORT: TransportData = {
  routes: [
    { id: uid(), name: "Route A: North Zone", price: "₹600/month" },
    { id: uid(), name: "Route B: South Zone", price: "₹700/month" },
    { id: uid(), name: "Route C: East Zone", price: "₹800/month" },
    { id: uid(), name: "Route D: West Zone", price: "₹750/month" },
  ],
  features: [
    { id: uid(), text: "GPS-monitored buses for real-time tracking" },
    { id: uid(), text: "Trained and verified drivers and attendants" },
    { id: uid(), text: "Door-step pickup and drop facility" },
    { id: uid(), text: "Covered routes across all major areas" },
    { id: uid(), text: "Emergency contact for every bus route" },
    { id: uid(), text: "Monthly pass and term pass available" },
  ],
};
const DEFAULT_UNIFORM: UniformData = {
  boys18: [
    { id: uid(), text: "White shirt with school emblem" },
    { id: uid(), text: "Navy blue trousers" },
    { id: uid(), text: "Black shoes and white socks" },
    { id: uid(), text: "School tie and belt" },
  ],
  girls18: [
    { id: uid(), text: "Navy blue salwar kameez with school dupatta" },
    { id: uid(), text: "Navy blue dress (winters)" },
    { id: uid(), text: "Black shoes and white socks" },
    { id: uid(), text: "School tie and ribbon" },
  ],
  senior: [
    { id: uid(), text: "White shirt/kurta with school badge" },
    { id: uid(), text: "Navy blue trousers/salwar" },
    { id: uid(), text: "Formal black shoes" },
    { id: uid(), text: "School blazer (winters)" },
  ],
  sports: [
    { id: uid(), text: "House colour T-shirt" },
    { id: uid(), text: "White track pants" },
    { id: uid(), text: "Sports shoes" },
  ],
};

function safeParse<T>(val: string, fallback: T): T {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  "under-review": { label: "Under Review", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Eye },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}><Icon className="h-3.5 w-3.5" /> {cfg.label}</span>;
}

// ─── Application Row ──────────────────────────────────────────────────────────
function ApplicationRow({ app, onUpdate, onDelete }: { app: Application; onUpdate: (id: number, data: { status?: string; remarks?: string }) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [remarks, setRemarks] = useState(app.remarks || "");
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3 shadow-sm">
      <div className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{app.studentName}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{app.classApplied}</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{app.category}</span>
          </div>
          <div className="text-sm text-slate-500 mt-0.5">Father: {app.fatherName} · 📞 {app.phone}{app.email && ` · ✉️ ${app.email}`}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={app.status} />
          <span className="text-xs text-slate-400">{new Date(app.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[{ l: "Date of Birth", v: app.dateOfBirth || "—" }, { l: "Gender", v: app.gender || "—" }, { l: "Mother's Name", v: app.motherName || "—" }, { l: "Alternate Phone", v: app.alternatePhone || "—" }, { l: "Previous School", v: app.previousSchool || "—" }, { l: "Last Class", v: app.previousClass || "—" }, { l: "Religion", v: app.religion || "—" }, { l: "Address", v: app.address || "—" }].map(({ l, v }) => (
              <div key={l} className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-400 mb-0.5">{l}</div><div className="text-slate-700 font-medium text-xs">{v}</div></div>
            ))}
          </div>
          {app.message && <div className="bg-blue-50 border border-blue-100 rounded-xl p-3"><div className="text-xs font-medium text-blue-600 mb-1">Message</div><p className="text-sm text-slate-700">{app.message}</p></div>}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Update Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(["pending", "under-review", "approved", "rejected"] as const).map(s => (
                  <Button key={s} size="sm" variant={app.status === s ? "default" : "outline"}
                    className={`text-xs ${app.status === s ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
                    onClick={e => { e.stopPropagation(); onUpdate(app.id, { status: s }); }}>
                    {STATUS_CONFIG[s].label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">Admin Remarks</label>
              <div className="flex gap-2">
                <textarea className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 h-20" placeholder="Internal remarks..." value={remarks} onClick={e => e.stopPropagation()} onChange={e => setRemarks(e.target.value)} />
                <Button size="sm" className="self-end bg-slate-700 hover:bg-slate-800 text-white" onClick={e => { e.stopPropagation(); onUpdate(app.id, { remarks }); }}><Save className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end"><Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={e => { e.stopPropagation(); if (confirm("Delete this application?")) onDelete(app.id); }}><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete</Button></div>
        </div>
      )}
    </div>
  );
}

// ─── Page Content Settings ────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#1e3a6e]/10 flex items-center justify-center"><Icon className="h-4 w-4 text-[#1e3a6e]" /></div>
        <span className="font-bold text-slate-800">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PageContentSettings({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [feeCols, setFeeCols] = useState<FeeColumn[]>(DEFAULT_FEE_COLS);
  const [feeRows, setFeeRows] = useState<FeeRow[]>(DEFAULT_FEE_ROWS);
  const [timingRows, setTimingRows] = useState<TimingRow[]>(DEFAULT_TIMING_ROWS);
  const [transport, setTransport] = useState<TransportData>(DEFAULT_TRANSPORT);
  const [uniform, setUniform] = useState<UniformData>(DEFAULT_UNIFORM);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch("/api/website/admission/info").then((info: Record<string, string>) => {
      if (info.admission_fee_info) {
        const parsed = safeParse(info.admission_fee_info, { cols: DEFAULT_FEE_COLS, rows: DEFAULT_FEE_ROWS });
        if (Array.isArray(parsed)) {
          setFeeRows(parsed);
        } else {
          setFeeCols(parsed.cols ?? DEFAULT_FEE_COLS);
          setFeeRows(parsed.rows ?? DEFAULT_FEE_ROWS);
        }
      }
      if (info.admission_timing) setTimingRows(safeParse(info.admission_timing, DEFAULT_TIMING_ROWS));
      if (info.admission_transport) setTransport(safeParse(info.admission_transport, DEFAULT_TRANSPORT));
      if (info.admission_uniform) setUniform(safeParse(info.admission_uniform, DEFAULT_UNIFORM));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/website/admission/info", {
        method: "POST",
        body: JSON.stringify({
          admission_fee_info: JSON.stringify({ cols: feeCols, rows: feeRows }),
          admission_timing: JSON.stringify(timingRows),
          admission_transport: JSON.stringify(transport),
          admission_uniform: JSON.stringify(uniform),
        }),
      });
      toast({ title: "Page content saved successfully!" });
      onSaved();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!loaded) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading content...</div>;

  // ── Fee Information ──────────────────────────────────────────────────────────
  const updateFeeClassGroup = (id: string, val: string) =>
    setFeeRows(rows => rows.map(r => r.id === id ? { ...r, classGroup: val } : r));
  const updateFeeCell = (rowId: string, colId: string, val: string) =>
    setFeeRows(rows => rows.map(r => r.id === rowId ? { ...r, values: { ...r.values, [colId]: val } } : r));
  const delFeeRow = (id: string) => setFeeRows(rows => rows.filter(r => r.id !== id));
  const updateFeeColHeader = (id: string, val: string) =>
    setFeeCols(cols => cols.map(c => c.id === id ? { ...c, header: val } : c));
  const delFeeCol = (id: string) => {
    setFeeCols(cols => cols.filter(c => c.id !== id));
    setFeeRows(rows => rows.map(r => { const v = { ...r.values }; delete v[id]; return { ...r, values: v }; }));
  };
  const addFeeCol = () => {
    const id = uid();
    setFeeCols(cols => [...cols, { id, header: "" }]);
    setFeeRows(rows => rows.map(r => ({ ...r, values: { ...r.values, [id]: "" } })));
  };
  const addFeeRow = () => {
    const values = Object.fromEntries(feeCols.map(c => [c.id, ""]));
    setFeeRows(rows => [...rows, { id: uid(), classGroup: "", values }]);
  };

  // ── Timing ───────────────────────────────────────────────────────────────────
  const updateTimingRow = (id: string, field: keyof TimingRow, val: string) =>
    setTimingRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  const delTimingRow = (id: string) => setTimingRows(rows => rows.filter(r => r.id !== id));
  const addTimingRow = () => setTimingRows(rows => [...rows, { id: uid(), day: "", time: "" }]);

  // ── Transport ────────────────────────────────────────────────────────────────
  const updateRoute = (id: string, field: "name" | "price", val: string) =>
    setTransport(t => ({ ...t, routes: t.routes.map(r => r.id === id ? { ...r, [field]: val } : r) }));
  const delRoute = (id: string) => setTransport(t => ({ ...t, routes: t.routes.filter(r => r.id !== id) }));
  const addRoute = () => setTransport(t => ({ ...t, routes: [...t.routes, { id: uid(), name: "", price: "" }] }));
  const updateFeature = (id: string, val: string) =>
    setTransport(t => ({ ...t, features: t.features.map(f => f.id === id ? { ...f, text: val } : f) }));
  const delFeature = (id: string) => setTransport(t => ({ ...t, features: t.features.filter(f => f.id !== id) }));
  const addFeature = () => setTransport(t => ({ ...t, features: [...t.features, { id: uid(), text: "" }] }));

  // ── Uniform ──────────────────────────────────────────────────────────────────
  type UniformSection = keyof UniformData;
  const updateUniformItem = (section: UniformSection, id: string, val: string) =>
    setUniform(u => ({ ...u, [section]: u[section].map(item => item.id === id ? { ...item, text: val } : item) }));
  const delUniformItem = (section: UniformSection, id: string) =>
    setUniform(u => ({ ...u, [section]: u[section].filter(item => item.id !== id) }));
  const addUniformItem = (section: UniformSection) =>
    setUniform(u => ({ ...u, [section]: [...u[section], { id: uid(), text: "" }] }));

  const thCls = "text-left text-xs font-bold uppercase tracking-wider text-slate-500 py-2 px-3 border-b border-slate-200";
  const tdCls = "px-3 py-2";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500">Edit fee info, timings, transport &amp; uniforms shown on the public admission page.</p>
        </div>
        <Button className="bg-[#1e3a6e] hover:bg-[#163066] text-white px-6" disabled={saving} onClick={save}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save All Changes"}
        </Button>
      </div>

      {/* ── Fee Information ── */}
      <SectionCard icon={IndianRupee} title="Fee Information">
        <div className="flex justify-end mb-3">
          <Button size="sm" className="bg-[#1e3a6e] hover:bg-[#163066] text-white text-xs" onClick={addFeeCol}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add New Fee Column
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCls}>Class / Group</th>
                {feeCols.map(col => (
                  <th key={col.id} className={thCls}>
                    <div className="flex items-center gap-1">
                      <Input
                        value={col.header}
                        onChange={e => updateFeeColHeader(col.id, e.target.value)}
                        placeholder="Column name"
                        className="h-7 text-xs font-bold uppercase tracking-wider border-dashed"
                      />
                      <button onClick={() => delFeeCol(col.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className={thCls + " w-10"}></th>
              </tr>
            </thead>
            <tbody>
              {feeRows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className={tdCls}><Input value={row.classGroup} onChange={e => updateFeeClassGroup(row.id, e.target.value)} placeholder="e.g. Class 1–5" className="h-8 text-xs" /></td>
                  {feeCols.map(col => (
                    <td key={col.id} className={tdCls}>
                      <Input value={row.values[col.id] ?? ""} onChange={e => updateFeeCell(row.id, col.id, e.target.value)} placeholder="e.g. ₹2,500" className="h-8 text-xs" />
                    </td>
                  ))}
                  <td className={tdCls}><button onClick={() => delFeeRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" className="mt-3 text-[#1e3a6e] hover:bg-blue-50 text-xs" onClick={addFeeRow}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row
        </Button>
      </SectionCard>

      {/* ── School Timing ── */}
      <SectionCard icon={Clock} title="School Timing">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCls}>Day / Session</th>
                <th className={thCls}>Time</th>
                <th className={thCls + " w-10"}></th>
              </tr>
            </thead>
            <tbody>
              {timingRows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className={tdCls}><Input value={row.day} onChange={e => updateTimingRow(row.id, "day", e.target.value)} placeholder="e.g. Monday – Friday" className="h-8 text-xs" /></td>
                  <td className={tdCls}><Input value={row.time} onChange={e => updateTimingRow(row.id, "time", e.target.value)} placeholder="e.g. 8:00 AM – 2:30 PM" className="h-8 text-xs" /></td>
                  <td className={tdCls}><button onClick={() => delTimingRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" className="mt-3 text-[#1e3a6e] hover:bg-blue-50 text-xs" onClick={addTimingRow}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row
        </Button>
      </SectionCard>

      {/* ── Transport Facility ── */}
      <SectionCard icon={Bus} title="Transport Facility">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Bus Routes */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Bus Routes</div>
            <div className="space-y-2">
              {transport.routes.map(r => (
                <div key={r.id} className="flex gap-2 items-center">
                  <Input value={r.name} onChange={e => updateRoute(r.id, "name", e.target.value)} placeholder="Route name" className="h-8 text-xs flex-1" />
                  <Input value={r.price} onChange={e => updateRoute(r.id, "price", e.target.value)} placeholder="₹600/month" className="h-8 text-xs w-32" />
                  <button onClick={() => delRoute(r.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3 text-[#1e3a6e] hover:bg-blue-50 text-xs" onClick={addRoute}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Route
            </Button>
          </div>
          {/* Transport Features */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Transport Features</div>
            <div className="space-y-2">
              {transport.features.map(f => (
                <div key={f.id} className="flex gap-2 items-center">
                  <Input value={f.text} onChange={e => updateFeature(f.id, e.target.value)} placeholder="Feature description" className="h-8 text-xs flex-1" />
                  <button onClick={() => delFeature(f.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-3 text-[#1e3a6e] hover:bg-blue-50 text-xs" onClick={addFeature}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Feature
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Uniform Guidelines ── */}
      <SectionCard icon={GraduationCap} title="Uniform Guidelines">
        <div className="grid md:grid-cols-2 gap-6">
          {([
            { key: "boys18" as UniformSection, label: "Boys (Class 1–8)" },
            { key: "girls18" as UniformSection, label: "Girls (Class 1–8)" },
            { key: "senior" as UniformSection, label: "Class 9–12 (All)" },
            { key: "sports" as UniformSection, label: "Sports Uniform" },
          ]).map(({ key, label }) => (
            <div key={key} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-3">{label}</div>
              <div className="space-y-2">
                {uniform[key].map(item => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <span className="text-slate-400 text-sm shrink-0">•</span>
                    <Input value={item.text} onChange={e => updateUniformItem(key, item.id, e.target.value)} placeholder="Uniform item" className="h-8 text-xs flex-1" />
                    <button onClick={() => delUniformItem(key, item.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-2 text-[#1e3a6e] hover:bg-blue-50 text-xs" onClick={() => addUniformItem(key)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end pt-2">
        <Button className="bg-[#1e3a6e] hover:bg-[#163066] text-white px-8" disabled={saving} onClick={save}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving…" : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Applications Tab ─────────────────────────────────────────────────────────
function ApplicationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ["admissionApplications"],
    queryFn: () => apiFetch("/api/website/admission/applications"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; remarks?: string } }) =>
      apiFetch(`/api/website/admission/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissionApplications"] }); toast({ title: "Application updated" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/admission/applications/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissionApplications"] }); toast({ title: "Application deleted" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = apps.filter(a => {
    const m = !search || a.studentName.toLowerCase().includes(search.toLowerCase()) || a.fatherName.toLowerCase().includes(search.toLowerCase()) || a.phone.includes(search) || a.classApplied.toLowerCase().includes(search.toLowerCase());
    return m && (statusFilter === "all" || a.status === statusFilter);
  });

  const counts = { all: apps.length, pending: apps.filter(a => a.status === "pending").length, "under-review": apps.filter(a => a.status === "under-review").length, approved: apps.filter(a => a.status === "approved").length, rejected: apps.filter(a => a.status === "rejected").length };

  const exportCSV = () => {
    const headers = ["ID", "Student Name", "Class", "Father Name", "Phone", "Email", "Status", "Applied On"];
    const rows = filtered.map(a => [a.id, a.studentName, a.classApplied, a.fatherName, a.phone, a.email, a.status, new Date(a.createdAt).toLocaleDateString()]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `admissions-${Date.now()}.csv`; a.click();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all", "pending", "under-review", "approved", "rejected"] as const).map(s => {
          const cfg = s === "all" ? { label: "All", color: "border-slate-300 bg-slate-50 text-slate-700" } : { label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].color };
          return <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-xl p-3 border text-center transition-all ${cfg.color} ${statusFilter === s ? "ring-2 ring-offset-1 ring-blue-500 shadow-md" : "hover:shadow-sm"}`}><div className="text-xl font-bold">{counts[s]}</div><div className="text-xs mt-0.5">{cfg.label}</div></button>;
        })}
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name, phone, class..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" variant="outline" onClick={exportCSV} className="shrink-0"><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
      </div>
      {isLoading ? <div className="h-40 flex items-center justify-center text-slate-400">Loading...</div>
        : filtered.length === 0 ? <div className="text-center py-16 text-slate-400"><FileText className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>{apps.length === 0 ? "No applications yet" : "No applications match your search"}</p></div>
          : filtered.map(app => <ApplicationRow key={app.id} app={app} onUpdate={(id, data) => updateMut.mutate({ id, data })} onDelete={id => deleteMut.mutate(id)} />)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdmissionTab() {
  const [activeTab, setActiveTab] = useState<"applications" | "content">("applications");
  const { data: apps = [] } = useQuery<Application[]>({ queryKey: ["admissionApplications"], queryFn: () => apiFetch("/api/website/admission/applications") });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Admissions Management</h2>
          <p className="text-sm text-slate-500">Manage applications, page content, and teacher admission permissions.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        <button onClick={() => setActiveTab("applications")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "applications" ? "bg-white shadow text-[#1e3a6e]" : "text-slate-500 hover:text-slate-700"}`}>
          <FileText className="h-4 w-4 inline mr-1.5" /> Applications
          {apps.length > 0 && <span className="ml-1.5 bg-[#1e3a6e] text-white text-xs rounded-full px-1.5 py-0.5">{apps.length}</span>}
        </button>
        <button onClick={() => setActiveTab("content")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "content" ? "bg-white shadow text-[#1e3a6e]" : "text-slate-500 hover:text-slate-700"}`}>
          <MessageSquare className="h-4 w-4 inline mr-1.5" /> Page Content Settings
        </button>
      </div>

      {activeTab === "applications" && <ApplicationsTab />}
      {activeTab === "content" && <PageContentSettings onSaved={() => {}} />}
    </div>
  );
}

