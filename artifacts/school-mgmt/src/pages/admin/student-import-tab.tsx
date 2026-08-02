import { useState, useRef } from "react";
import { useListClasses, useListSections } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListStudentsQueryKey } from "@workspace/api-client-react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  Users,
} from "lucide-react";

interface ParsedStudent {
  studentName: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  whatsappNumber?: string;
  parentEmail?: string;
  address?: string;
  vehicleName?: string;
  tripName?: string;
  gender?: string;
  dateOfBirth?: string;
  motherName?: string;
}

interface ImportResult {
  studentName: string;
  ok: boolean;
  error?: string;
}

function parseCSV(text: string): ParsedStudent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const fieldMap: Record<string, keyof ParsedStudent> = {
    studentname: "studentName",
    name: "studentName",
    student: "studentName",
    fathername: "fatherName",
    father: "fatherName",
    class: "className",
    classname: "className",
    section: "sectionName",
    sectionname: "sectionName",
    whatsapp: "whatsappNumber",
    phone: "whatsappNumber",
    mobile: "whatsappNumber",
    whatsappnumber: "whatsappNumber",
    email: "parentEmail",
    parentemail: "parentEmail",
    address: "address",
    vehicle: "vehicleName",
    vehiclename: "vehicleName",
    bus: "vehicleName",
    trip: "tripName",
    tripname: "tripName",
    gender: "gender",
    dob: "dateOfBirth",
    dateofbirth: "dateOfBirth",
    mother: "motherName",
    mothername: "motherName",
  };

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: any = {};
    headers.forEach((h, i) => {
      const field = fieldMap[h];
      if (field && values[i]) row[field] = values[i];
    });
    return row as ParsedStudent;
  }).filter((r) => r.studentName && r.className && r.sectionName);
}

export default function StudentImportTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState("");

  const { data: classesRaw } = useListClasses();
  const { data: sectionsRaw } = useListSections();
  const classes = Array.isArray(classesRaw) ? classesRaw : [];
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setError(
          "No valid rows found. Make sure the CSV has headers: studentName, className, sectionName (and optionally fatherName, whatsappNumber, parentEmail, address, gender, vehicleName, tripName).",
        );
        setParsed([]);
      } else {
        setParsed(rows);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function downloadTemplate() {
    const header =
      "studentName,fatherName,className,sectionName,whatsappNumber,parentEmail,address,gender,dateOfBirth,motherName,vehicleName,tripName";
    const sample =
      "Ali Ahmed,Ahmed Khan,1,A,03001234567,parent@email.com,House 5 Block A,Male,2015-06-15,Fatima Bibi,Bus 1,Morning";
    const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (parsed.length === 0) return;
    setImporting(true);
    setResults(null);

    const classMap = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));
    const sectionMap = new Map(
      sections.map((s) => [`${s.classId}-${s.name.toLowerCase()}`, s.id]),
    );

    const importResults: ImportResult[] = [];

    for (const row of parsed) {
      const classId = classMap.get(row.className.toLowerCase());
      if (!classId) {
        importResults.push({ studentName: row.studentName, ok: false, error: `Class "${row.className}" not found` });
        continue;
      }
      const sectionKey = `${classId}-${row.sectionName.toLowerCase()}`;
      const sectionId = sectionMap.get(sectionKey);
      if (!sectionId) {
        importResults.push({ studentName: row.studentName, ok: false, error: `Section "${row.sectionName}" not found in class "${row.className}"` });
        continue;
      }

      try {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: row.studentName,
            fatherName: row.fatherName || "",
            classId: classId.toString(),
            sectionId: sectionId.toString(),
            whatsappNumber: row.whatsappNumber || "",
            parentEmail: row.parentEmail || "",
            address: row.address || "",
            gender: row.gender || "",
            dateOfBirth: row.dateOfBirth || "",
            motherName: row.motherName || "",
            hasVehicle: false,
            hasTrip: false,
          }),
        });
        if (res.ok) {
          importResults.push({ studentName: row.studentName, ok: true });
        } else {
          const data = await res.json();
          importResults.push({ studentName: row.studentName, ok: false, error: data.error || "Server error" });
        }
      } catch (err: any) {
        importResults.push({ studentName: row.studentName, ok: false, error: err.message });
      }
    }

    setResults(importResults);
    setImporting(false);
    const succeeded = importResults.filter((r) => r.ok).length;
    const failed = importResults.filter((r) => !r.ok).length;

    if (succeeded > 0) {
      await qc.invalidateQueries({ queryKey: getListStudentsQueryKey({}) });
      setParsed([]);
    }

    toast({
      title: `${succeeded} student${succeeded !== 1 ? "s" : ""} imported`,
      description: failed > 0 ? `${failed} failed — check details below.` : "All students added successfully.",
      variant: failed > 0 ? "destructive" : "default",
    });
  }

  const succeeded = results ? results.filter((r) => r.ok).length : 0;
  const failed = results ? results.filter((r) => !r.ok).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
          <Upload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Import Students</h2>
          <p className="text-sm text-slate-500">
            Upload a CSV file to bulk-add students. Classes and sections must already exist.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> How to import
        </p>
        <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Download the CSV template below and fill in your student data.</li>
          <li>Required columns: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">studentName</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">className</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">sectionName</code>.</li>
          <li>Class and section names must match exactly what you've created in Settings.</li>
          <li>Upload the filled CSV and click Import.</li>
        </ol>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="mt-2 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
        >
          <Download className="h-4 w-4 mr-2" />
          Download CSV Template
        </Button>
      </div>

      {/* Upload zone */}
      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Click to upload CSV file
        </p>
        <p className="text-xs text-slate-400 mt-1">Only .csv files are supported</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Preview — {parsed.length} students ready to import
            </span>
            <Button
              onClick={handleImport}
              disabled={importing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 px-5 text-sm"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {parsed.length} Students
                </>
              )}
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950/80">
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Student Name</TableHead>
                  <TableHead className="text-xs">Father</TableHead>
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Section</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-slate-400">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{s.studentName}</TableCell>
                    <TableCell className="text-xs text-slate-500">{s.fatherName || "—"}</TableCell>
                    <TableCell className="text-xs">{s.className}</TableCell>
                    <TableCell className="text-xs">{s.sectionName}</TableCell>
                    <TableCell className="text-xs text-slate-500">{s.whatsappNumber || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{s.parentEmail || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <span className="font-semibold text-slate-900 dark:text-white text-sm">Import Results</span>
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" /> {succeeded} imported
            </span>
            {failed > 0 && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <XCircle className="h-4 w-4" /> {failed} failed
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-950/80">
                <TableRow>
                  <TableHead className="w-10 text-xs">Status</TableHead>
                  <TableHead className="text-xs">Student</TableHead>
                  <TableHead className="text-xs">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.studentName}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {r.ok ? "Added successfully" : r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
