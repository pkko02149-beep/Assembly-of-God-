import { useState, useEffect } from "react";
import { Link } from "wouter";
import { BookOpen, Calendar, Filter, ChevronRight, Loader2, Search, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isBefore, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";

function Footer() {
  const { data: branding } = useQuery<any>({ queryKey: ["websiteBranding"], queryFn: () => fetch("/api/website/branding").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  return (
    <footer className="bg-slate-800 text-slate-400 text-sm text-center py-6 mt-12">
      <Link href="/" className="text-slate-300 hover:text-white transition-colors">← Back to {branding?.school_name || "School"} Website</Link>
    </footer>
  );
}

interface SchoolClass { id: number; name: string; }
interface Section { id: number; name: string; classId: number | null; }
interface HomeworkItem {
  id: number;
  className: string;
  sectionName: string | null;
  subject: string;
  title: string;
  description: string;
  titleHi: string;
  descriptionHi: string;
  dueDate: string;
  teacherName: string | null;
}

const SUBJECT_COLORS: Record<string, string> = {
  math: "bg-blue-100 text-blue-700",
  mathematics: "bg-blue-100 text-blue-700",
  science: "bg-green-100 text-green-700",
  english: "bg-purple-100 text-purple-700",
  hindi: "bg-orange-100 text-orange-700",
  social: "bg-rose-100 text-rose-700",
  history: "bg-amber-100 text-amber-700",
  geography: "bg-teal-100 text-teal-700",
  computer: "bg-indigo-100 text-indigo-700",
  physics: "bg-cyan-100 text-cyan-700",
  chemistry: "bg-yellow-100 text-yellow-700",
  biology: "bg-emerald-100 text-emerald-700",
};

function subjectColor(subject: string) {
  const key = subject.toLowerCase().split(" ")[0];
  return SUBJECT_COLORS[key] || "bg-slate-100 text-slate-700";
}

function dueBadge(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  if (isBefore(due, now)) return { label: "Overdue", cls: "bg-red-100 text-red-600" };
  if (isBefore(due, addDays(now, 1))) return { label: "Due Today", cls: "bg-orange-100 text-orange-700" };
  if (isBefore(due, addDays(now, 2))) return { label: "Due Tomorrow", cls: "bg-amber-100 text-amber-700" };
  return null;
}

function NavBar() {
  const { data: branding } = useQuery<any>({ queryKey: ["websiteBranding"], queryFn: () => fetch("/api/website/branding").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const schoolName = branding?.school_name || "School";
  const logoUrl = branding?.school_logo_url || "";
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} className="h-9 w-9 rounded-lg object-contain" alt="logo" /> : <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">{schoolName[0]}</div>}
          <span className="font-bold text-slate-800">{schoolName}</span>
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </nav>
  );
}

export default function HomeworkPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [searched, setSearched] = useState(false);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwError, setHwError] = useState("");

  const { data: classes = [] } = useQuery<SchoolClass[]>({
    queryKey: ["publicClasses"],
    queryFn: () => fetch("/api/website/classes").then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["publicSections", selectedClass],
    queryFn: () => selectedClass ? fetch(`/api/website/sections`).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedClass,
    staleTime: 10 * 60 * 1000,
  });

  // Unique subjects from loaded homework (for re-filter)
  const subjectOptions = [...new Set(homework.map(h => h.subject))].sort();

  async function search() {
    if (!selectedClass) return;
    setHwLoading(true);
    setHwError("");
    setSearched(true);
    try {
      const params = new URLSearchParams({ classId: selectedClass });
      if (selectedSection) params.set("sectionId", selectedSection);
      if (selectedSubject) params.set("subject", selectedSubject);
      if (selectedDate) params.set("dueDate", selectedDate);
      const res = await fetch(`/api/homework/public?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setHomework(await res.json());
    } catch {
      setHwError("Could not load homework. Please try again.");
    } finally {
      setHwLoading(false);
    }
  }

  // Auto-search when class changes (clear results)
  useEffect(() => { setSearched(false); setHomework([]); setSelectedSection(""); setSelectedSubject(""); }, [selectedClass]);

  const filteredHomework = selectedSubject
    ? homework.filter(h => h.subject === selectedSubject)
    : homework;

  const upcoming = filteredHomework.filter(h => !isBefore(new Date(h.dueDate), new Date()));
  const past = filteredHomework.filter(h => isBefore(new Date(h.dueDate), new Date()));

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-indigo-200 text-sm mb-3">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Homework</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Homework & Assignments</h1>
              <p className="text-indigo-200 mt-1">Select your class and date to view homework</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium text-sm">
            <Filter className="w-4 h-4" /> Filter Homework
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Date */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Due From</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            {/* Class */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Class *</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* Section */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Section</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:opacity-40">
                <option value="">All sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Subject (only shown after search) */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Subject</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={subjectOptions.length === 0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:opacity-40">
                <option value="">All subjects</option>
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Search button */}
            <div className="flex items-end">
              <Button onClick={search} disabled={!selectedClass || hwLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                {hwLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Search
              </Button>
            </div>
          </div>
          {!selectedClass && (
            <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Please select a class to view homework</p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {hwError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" /> {hwError}
          </div>
        )}

        {!searched && !hwLoading && (
          <div className="text-center py-20 text-slate-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a class and click Search</p>
            <p className="text-sm mt-1">to view homework assignments</p>
          </div>
        )}

        {searched && !hwLoading && filteredHomework.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No homework found</p>
            <p className="text-sm mt-1">Try changing the filters or date</p>
          </div>
        )}

        {filteredHomework.length > 0 && (
          <div className="space-y-8">
            {/* Summary row */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {filteredHomework.length} assignment{filteredHomework.length !== 1 ? "s" : ""}
                {selectedSubject ? ` · ${selectedSubject}` : ""}
              </h2>
              <div className="text-sm text-slate-400">
                {classes.find(c => c.id === Number(selectedClass))?.name}
                {sections.find(s => s.id === Number(selectedSection)) ? ` – ${sections.find(s => s.id === Number(selectedSection))?.name}` : ""}
              </div>
            </div>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Upcoming ({upcoming.length})</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map(h => {
                    const badge = dueBadge(h.dueDate);
                    return (
                      <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <Badge className={`${subjectColor(h.subject)} font-medium text-xs`}>{h.subject}</Badge>
                          {badge && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                        </div>
                        {/* English */}
                        <h4 className="font-semibold text-slate-800 mb-0.5 leading-snug">{h.title}</h4>
                        {h.description && <p className="text-sm text-slate-500 mb-2 whitespace-pre-wrap">{h.description}</p>}
                        {/* Hindi */}
                        {(h.titleHi || h.descriptionHi) && (
                          <div className="mt-2 pt-2 border-t border-orange-100">
                            {h.titleHi && <h4 className="font-semibold text-orange-700 mb-0.5 leading-snug text-sm">{h.titleHi}</h4>}
                            {h.descriptionHi && <p className="text-xs text-orange-600 whitespace-pre-wrap">{h.descriptionHi}</p>}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {format(new Date(h.dueDate), "MMM d, yyyy")}</span>
                          {h.teacherName && <span>{h.teacherName}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Past ({past.length})</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map(h => (
                    <div key={h.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 opacity-60">
                      <div className="mb-3">
                        <Badge className={`${subjectColor(h.subject)} font-medium text-xs`}>{h.subject}</Badge>
                      </div>
                      <h4 className="font-semibold text-slate-700 mb-0.5">{h.title}</h4>
                      {h.description && <p className="text-sm text-slate-400 mb-2 whitespace-pre-wrap">{h.description}</p>}
                      {(h.titleHi || h.descriptionHi) && (
                        <div className="mt-2 pt-2 border-t border-orange-100">
                          {h.titleHi && <h4 className="font-semibold text-orange-600 mb-0.5 text-sm">{h.titleHi}</h4>}
                          {h.descriptionHi && <p className="text-xs text-orange-500 whitespace-pre-wrap">{h.descriptionHi}</p>}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-2"><Calendar className="w-3 h-3" />Was due {format(new Date(h.dueDate), "MMM d, yyyy")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
