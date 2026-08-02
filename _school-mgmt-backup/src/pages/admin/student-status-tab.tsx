import { useState, useMemo } from "react";
import { useListStudents, useListClasses, useListSections } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Search, Download, UserCheck, UserX, Bus } from "lucide-react";
import { downloadExcelFile } from "@/lib/excel-export";

const CATEGORIES = ["all", "General", "OBC", "SC", "ST", "RTE"];
const GENDERS = ["all", "Male", "Female", "Other"];
const TYPES = ["all", "New", "Old", "RTE"];
const RELIGIONS = ["all", "Hindu", "Muslim", "Sikh", "Ishai", "Others"];

export default function StudentStatusTab() {
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterReligion, setFilterReligion] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: students = [] } = useListStudents({});
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const filteredStudents = useMemo(() => {
    return (students as any[]).filter(s => {
      if (search && !s.studentName.toLowerCase().includes(search.toLowerCase()) && !s.uniqueId?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterClass !== "all" && String(s.classId) !== filterClass) return false;
      if (filterSection !== "all" && String(s.sectionId) !== filterSection) return false;
      if (filterCategory !== "all" && (s.category || "").toLowerCase() !== filterCategory.toLowerCase()) return false;
      if (filterGender !== "all" && (s.gender || "").toLowerCase() !== filterGender.toLowerCase()) return false;
      if (filterReligion !== "all" && (s.religion || "").toLowerCase() !== filterReligion.toLowerCase()) return false;
      if (filterType !== "all" && (s.studentType || "").toLowerCase() !== filterType.toLowerCase()) return false;
      return true;
    });
  }, [students, search, filterClass, filterSection, filterCategory, filterGender, filterReligion, filterType]);

  const sectionsByClass = useMemo(() => {
    if (filterClass === "all") return sections as any[];
    return (sections as any[]).filter((s: any) => String(s.classId) === filterClass);
  }, [sections, filterClass]);

  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const withTransport = filteredStudents.filter(s => s.hasVehicle).length;
    const rte = filteredStudents.filter(s => (s.studentType || "").toLowerCase() === "rte").length;
    const male = filteredStudents.filter(s => (s.gender || "").toLowerCase() === "male").length;
    const female = filteredStudents.filter(s => (s.gender || "").toLowerCase() === "female").length;
    return { total, withTransport, rte, male, female };
  }, [filteredStudents]);

  async function exportExcel() {
    await downloadExcelFile(
      [
        {
          name: "Student Status",
          rows: filteredStudents.map((s, i) => ({
            "#": i + 1,
            "Adm. No.": s.uniqueId,
            "Roll No": s.rollNo,
            "Student Name": s.studentName,
            "Father Name": s.fatherName,
            "Mother Name": s.motherName,
            "Class": s.className,
            "Section": s.sectionName,
            "Gender": s.gender,
            "Category": s.category,
            "Religion": s.religion,
            "Student Type": s.studentType,
            "Transport": s.hasVehicle ? "Yes" : "No",
            "Route": s.transportRouteName || "",
            "Contact": s.whatsappNumber,
            "Admission Date": s.admissionDate,
            "Session": s.session,
          })),
        },
      ],
      "Student_Status.xlsx"
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-indigo-500" /> Student Status
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and filter students by category, religion, gender and more</p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export Excel
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "blue" },
          { label: "Male", value: stats.male, icon: UserCheck, color: "teal" },
          { label: "Female", value: stats.female, icon: UserCheck, color: "pink" },
          { label: "With Transport", value: stats.withTransport, icon: Bus, color: "amber" },
          { label: "RTE", value: stats.rte, icon: UserX, color: "rose" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className={`border-${color}-200 dark:border-${color}-900/30`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                <Icon className={`h-4 w-4 text-${color}-600`} />
              </div>
              <div>
                <div className={`text-xl font-bold text-${color}-700 dark:text-${color}-400`}>{value}</div>
                <div className="text-[10px] text-slate-500">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by name or Adm. No." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSection("all"); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {(classes as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Sections" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sectionsByClass.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterReligion} onValueChange={setFilterReligion}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Religion" /></SelectTrigger>
            <SelectContent>
              {RELIGIONS.map(r => <SelectItem key={r} value={r}>{r === "all" ? "All Religions" : r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterGender} onValueChange={setFilterGender}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Gender" /></SelectTrigger>
            <SelectContent>
              {GENDERS.map(g => <SelectItem key={g} value={g}>{g === "all" ? "All Genders" : g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">{filteredStudents.length} Students</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No students match the current filters</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="text-xs pl-4">#</TableHead>
                    <TableHead className="text-xs">Adm. No.</TableHead>
                    <TableHead className="text-xs">Student Name</TableHead>
                    <TableHead className="text-xs">Father Name</TableHead>
                    <TableHead className="text-xs">Class</TableHead>
                    <TableHead className="text-xs">Gender</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Religion</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Transport</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s, i) => (
                    <TableRow key={s.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                      <TableCell className="pl-4 text-xs text-slate-400">{i + 1}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">{s.uniqueId}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{s.studentName}</div>
                        <div className="text-[10px] text-slate-400">Roll: {s.rollNo}</div>
                      </TableCell>
                      <TableCell className="text-xs">{s.fatherName || "—"}</TableCell>
                      <TableCell className="text-xs">{s.className} {s.sectionName}</TableCell>
                      <TableCell className="text-xs">{s.gender || "—"}</TableCell>
                      <TableCell>
                        {s.category ? <Badge variant="outline" className="text-[10px]">{s.category}</Badge> : <span className="text-slate-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{s.religion || "—"}</TableCell>
                      <TableCell>
                        {s.studentType ? <Badge className={`text-[10px] ${s.studentType.toLowerCase() === "rte" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{s.studentType}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {s.hasVehicle ? <Badge className="bg-amber-100 text-amber-700 text-[10px]"><Bus className="h-2.5 w-2.5 mr-1" />{s.transportRouteName || "Yes"}</Badge> : <span className="text-slate-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{s.whatsappNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
