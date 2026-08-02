import { useState, useRef } from "react";
import { useListStudents, useListClasses, useListSections } from "@workspace/api-client-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, QrCode, Users, Filter, X, Download, ScanLine, ChevronDown, ChevronUp } from "lucide-react";
import ScanTab from "./scan-tab";

function getScanUrl(uniqueId: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/scan?id=${encodeURIComponent(uniqueId)}`;
}

interface StudentQR {
  id: number;
  uniqueId: string;
  studentName: string;
  fatherName?: string;
  className: string;
  sectionName: string;
  vehicleName?: string | null;
  rollNo: number;
}

function getQrSvgString(url: string, size: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return url;
}

export default function QrCodesTab() {
  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [cardSize, setCardSize] = useState<"small" | "medium" | "large">("medium");
  const [scannerOpen, setScannerOpen] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: students = [], isLoading } = useListStudents({
    classId: classId !== "all" ? parseInt(classId) : undefined,
    sectionId: sectionId !== "all" ? parseInt(sectionId) : undefined,
  });
  const { data: classes = [] } = useListClasses();
  const { data: sections = [] } = useListSections();

  const sizeMap = { small: 90, medium: 120, large: 150 };
  const cardPx = sizeMap[cardSize];

  function handlePrint() {
    const today = new Date().toLocaleDateString("en-PK", {
      year: "numeric", month: "long", day: "numeric",
    });

    // Collect all SVG elements from the DOM
    const cards = printRef.current?.querySelectorAll("[data-qr-card]");
    if (!cards || cards.length === 0) return;

    let cardsHtml = "";
    cards.forEach((card) => {
      cardsHtml += card.outerHTML;
    });

    const colSize = cardSize === "small" ? 150 : cardSize === "medium" ? 195 : 240;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Student QR Codes — ${today}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #1e293b; }
    .page-header {
      text-align: center;
      padding: 12px 16px 8px;
      border-bottom: 2px solid #f59e0b;
      margin-bottom: 10px;
    }
    .page-header h1 { font-size: 16px; font-weight: bold; color: #1e293b; }
    .page-header p  { font-size: 10px; color: #64748b; margin-top: 2px; }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      justify-content: flex-start;
    }
    [data-qr-card] {
      width: ${colSize}px;
      border: 1.5px dashed #cbd5e1;
      border-radius: 8px;
      padding: 10px 8px;
      text-align: center;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      background: #fff;
    }
    .school-badge {
      font-size: 7px;
      font-weight: bold;
      color: #f59e0b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #fef3c7;
      border-radius: 3px;
      padding: 1px 5px;
      width: 100%;
    }
    .qr-wrap svg { display: block; }
    .name  { font-weight: bold; font-size: 11px; color: #0f172a; line-height: 1.25; word-break: break-word; }
    .uid   { font-size: 9px; color: #d97706; font-family: monospace; font-weight: 700; letter-spacing: 0.5px; }
    .info  { font-size: 8.5px; color: #475569; line-height: 1.4; }
    .divider { width: 100%; height: 1px; background: #e2e8f0; }
    .scan-hint { font-size: 7.5px; color: #94a3b8; font-style: italic; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 8mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>🚌 Student QR Attendance Cards</h1>
    <p>Printed on ${today} &nbsp;·&nbsp; ${students.length} student${students.length !== 1 ? "s" : ""} &nbsp;·&nbsp; Scan QR to mark attendance</p>
  </div>
  <div class="grid">${cardsHtml}</div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  function downloadSingleQr(student: StudentQR) {
    const url = getScanUrl(student.uniqueId || String(student.id));
    const svgEl = document.querySelector<SVGElement>(`[data-qr-svg="${student.id}"]`);
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `QR_${student.uniqueId || student.id}_${student.studentName.replace(/\s+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const hasFilters = classId !== "all" || sectionId !== "all";

  return (
    <div className="space-y-6">
      {/* Scanner Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => setScannerOpen(o => !o)}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <ScanLine className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900 dark:text-white text-sm">QR Attendance Scanner</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Point the camera at a student's QR card to mark attendance</p>
            </div>
          </div>
          {scannerOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {scannerOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800">
            <ScanTab />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="h-6 w-6 text-amber-500" />
            Student QR Codes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Print QR cards and give one to each student — they show it when boarding the bus
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={() => { setClassId("all"); setSectionId("all"); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear filters
            </Button>
          )}
          <Button
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            disabled={students.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print / Save PDF ({students.length})
          </Button>
        </div>
      </div>

      {/* How-to banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <QrCode className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold">How QR check-in works:</p>
          <ol className="mt-1 space-y-0.5 text-blue-700 dark:text-blue-400 list-decimal list-inside">
            <li>Print these cards and cut them out — give one to each student</li>
            <li>At the bus stop, the conductor opens <strong>Scanner Mode</strong> on their phone (Admin → Scanner Mode button)</li>
            <li>Each student holds their card in front of the camera → marked <strong>Present</strong> instantly</li>
            <li>OR: students can self-scan by opening the QR URL themselves on their phone</li>
          </ol>
        </div>
      </div>

      {/* Filters + size selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-slate-400" />
        <Select value={classId} onValueChange={v => { setClassId(v); setSectionId("all"); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sectionId} onValueChange={setSectionId}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All Sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Card size:</span>
          {(["small", "medium", "large"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setCardSize(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                cardSize === s
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span className="text-sm text-slate-500 ml-2">
            <Users className="h-4 w-4 inline mr-1 text-amber-500" />
            {students.length}
          </span>
        </div>
      </div>

      {/* QR Grid */}
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-slate-400">Loading students…</div>
      ) : students.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400">No students found. Add students in the Records tab first.</div>
      ) : (
        <div
          ref={printRef}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardPx + 60}px, 1fr))` }}
        >
          {students.map((student) => {
            const url = getScanUrl(student.uniqueId || String(student.id));
            return (
              <div
                key={student.id}
                data-qr-card
                className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow group relative"
              >
                {/* School badge */}
                <div className="w-full text-center text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded py-0.5 tracking-wider uppercase school-badge">
                  Bus Attendance Card
                </div>

                {/* QR code */}
                <div className="qr-wrap">
                  <QRCodeSVG
                    data-qr-svg={student.id}
                    value={url}
                    size={cardPx}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="M"
                    style={{ borderRadius: 4, display: "block" }}
                  />
                </div>

                {/* Info */}
                <div className="text-center space-y-0.5 w-full">
                  <div className="font-bold text-xs text-slate-900 dark:text-white leading-tight name" title={student.studentName}>
                    {student.studentName}
                  </div>
                  {(student as any).fatherName && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 info">
                      S/O {(student as any).fatherName}
                    </div>
                  )}
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 divider" />
                  <div className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uid">
                    {student.uniqueId}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 info">
                    {student.className} · {student.sectionName}
                    {student.rollNo ? ` · Roll #${student.rollNo}` : ""}
                  </div>
                  {student.vehicleName && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 info">🚌 {student.vehicleName}</div>
                  )}
                  <div className="text-[8px] text-slate-400 dark:text-slate-600 mt-1 scan-hint">
                    Scan QR to mark attendance
                  </div>
                </div>

                {/* Download individual button on hover */}
                <button
                  onClick={() => downloadSingleQr(student as StudentQR)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white rounded-md p-1.5"
                  title="Download this QR as SVG"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
