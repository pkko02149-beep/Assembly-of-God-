import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, IndianRupee, TrendingDown, Receipt, Download } from "lucide-react";
import { downloadExcelFile } from "@/lib/excel-export";

const EXP_CATEGORIES = [
  { value: "salary", label: "Salary" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "maintenance", label: "Maintenance" },
  { value: "stationary", label: "Stationary" },
  { value: "utilities", label: "Utilities" },
  { value: "transport", label: "Transport" },
  { value: "events", label: "Events" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

const PAY_METHODS = ["cash", "cheque", "online", "upi", "bank_transfer", "card"];

function fmt(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const todayStr = new Date().toISOString().split("T")[0];
const monthStart = todayStr.substring(0, 7) + "-01";

export default function ExpenditureTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(todayStr);
  const [filterCat, setFilterCat] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "", amount: "", category: "general", paymentMethod: "cash",
    date: todayStr, description: "", billNo: "", paidTo: "",
  });

  const queryKey = ["expenditures", fromDate, toDate, filterCat];
  const { data: expenditures = [], isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (filterCat !== "all") params.set("category", filterCat);
      const res = await fetch(`/api/expenditures?${params}`);
      if (!res.ok) throw new Error("Failed to fetch expenditures");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create expenditure");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenditures"] }); toast({ title: "Expenditure added" }); setShowDialog(false); resetForm(); },
    onError: () => toast({ title: "Failed to add expenditure", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/expenditures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update expenditure");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenditures"] }); toast({ title: "Expenditure updated" }); setShowDialog(false); resetForm(); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/expenditures/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenditures"] }); toast({ title: "Expenditure deleted" }); setDeleteId(null); },
  });

  function resetForm() {
    setForm({ title: "", amount: "", category: "general", paymentMethod: "cash", date: todayStr, description: "", billNo: "", paidTo: "" });
    setEditItem(null);
  }

  function openAdd() { resetForm(); setShowDialog(true); }
  function openEdit(item: any) {
    setEditItem(item);
    setForm({ title: item.title, amount: String(item.amount), category: item.category, paymentMethod: item.paymentMethod, date: item.date, description: item.description || "", billNo: item.billNo || "", paidTo: item.paidTo || "" });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.amount || !form.date) {
      toast({ title: "Title, amount and date are required", variant: "destructive" }); return;
    }
    const data = { ...form, amount: parseFloat(form.amount) };
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  }

  const totalAmount = useMemo(() => expenditures.reduce((s, r) => s + (r.amount || 0), 0), [expenditures]);
  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    expenditures.forEach(r => { map[r.category] = (map[r.category] || 0) + r.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenditures]);

  async function exportExcel() {
    await downloadExcelFile(
      [
        {
          name: "Expenditures",
          rows: expenditures.map((r, i) => ({
            "#": i + 1, Date: r.date, Title: r.title, Category: r.category,
            "Amount (₹)": r.amount, "Bill No": r.billNo, "Paid To": r.paidTo,
            "Payment Method": r.paymentMethod, Description: r.description,
          })),
        },
      ],
      `Expenditures_${fromDate}_to_${toDate}.xlsx`
    );
  }

  const catLabel = (v: string) => EXP_CATEGORIES.find(c => c.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-rose-500" /> Expenditure Ledger
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and manage all school expenses</p>
        </div>
        <Button onClick={openAdd} className="bg-rose-600 hover:bg-rose-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> Add Expenditure
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">From Date</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">To Date</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Category</label>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {EXP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportExcel} className="ml-auto">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <IndianRupee className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{fmt(totalAmount)}</div>
              <div className="text-xs text-slate-500">Total Expenditure</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">{expenditures.length}</div>
              <div className="text-xs text-slate-500">Total Entries</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">By Category</div>
            <div className="space-y-1">
              {byCat.slice(0, 4).map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{catLabel(cat)}</span>
                  <span className="font-medium">{fmt(amt)}</span>
                </div>
              ))}
              {byCat.length === 0 && <div className="text-sm text-slate-400">No data</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Expenditure Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>
          ) : expenditures.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No expenditures found for the selected period</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="text-xs pl-4 w-8">#</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Title / Paid To</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Bill No</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenditures.map((r, i) => (
                  <TableRow key={r.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-900/10">
                    <TableCell className="pl-4 text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.title}</div>
                      {r.paidTo && <div className="text-[10px] text-slate-400">Paid to: {r.paidTo}</div>}
                      {r.description && <div className="text-[10px] text-slate-400">{r.description}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{catLabel(r.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{r.billNo || "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{r.paymentMethod?.replace("_", " ")}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-700 dark:text-rose-400">{fmt(r.amount)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-rose-50 dark:bg-rose-900/20 font-semibold">
                  <TableCell colSpan={6} className="pl-4 text-sm">Total ({expenditures.length} entries)</TableCell>
                  <TableCell className="text-right text-rose-700 dark:text-rose-400">{fmt(totalAmount)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Expenditure" : "Add Expenditure"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input placeholder="e.g. Office Supplies" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount (₹) <span className="text-red-500">*</span></label>
                <Input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Date <span className="text-red-500">*</span></label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAY_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Bill No</label>
                <Input placeholder="e.g. INV-2024-001" value={form.billNo} onChange={e => setForm(f => ({ ...f, billNo: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Paid To</label>
                <Input placeholder="Vendor/person name" value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Optional notes" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="bg-rose-600 hover:bg-rose-700 text-white">
              {editItem ? "Update" : "Add Expenditure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Expenditure?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
