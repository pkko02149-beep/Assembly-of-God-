import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  BookOpen, FlaskConical, Library, Calendar, Monitor, Trophy, FileText,
  ClipboardList, Layers, ChevronDown, ChevronRight, GraduationCap,
  Phone, Mail, MapPin, Facebook, Twitter, Instagram, Youtube,
  Menu, X, Users, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

interface SchoolInfo { schoolName: string; address: string; contactNumber: string; logoUrl: string; schoolGmail: string; }
interface Branding {
  school_name: string; school_logo_url: string; school_motto: string;
  school_facebook: string; school_twitter: string; school_instagram: string; school_youtube: string;
  school_address: string; school_contact_number: string; school_email: string; school_established: string;
}

const SUBMENU_ITEMS = [
  { id: "curriculum", label: "Curriculum", icon: BookOpen },
  { id: "methodology", label: "Teaching Methodology", icon: GraduationCap },
  { id: "examination", label: "Examination & Assessment", icon: ClipboardList },
  { id: "calendar", label: "Academic Calendar", icon: Calendar },
  { id: "library", label: "Library", icon: Library },
  { id: "laboratories", label: "Laboratories", icon: FlaskConical },
  { id: "results", label: "Results", icon: Trophy },
  { id: "homework", label: "Homework & Assignments", icon: FileText },
  { id: "resources", label: "Learning Resources", icon: Layers },
];

function NavBar({ schoolInfo, branding }: { schoolInfo: SchoolInfo | undefined; branding?: Branding }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [academicsOpen, setAcademicsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, setLocation] = useLocation();
  const academicsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (academicsRef.current && !academicsRef.current.contains(e.target as Node)) setAcademicsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (href: string) => { setMenuOpen(false); setAcademicsOpen(false); setLocation(href); };
  const navLinks = [
    { l: "Home", h: "/" }, { l: "About", h: "/about" }, { l: "Admission", h: "/admission" },
    { l: "Gallery", h: "/gallery" }, { l: "Downloads", h: "/downloads" }, { l: "Contact", h: "/contact" }
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-300 ${scrolled ? "shadow-xl" : "shadow-sm"} border-b border-gray-100`}>
      <div style={{ backgroundColor: NAVY }} className="text-white hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            {schoolInfo?.contactNumber && <a href={`tel:${schoolInfo.contactNumber}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Phone className="h-3 w-3" />{schoolInfo.contactNumber}</a>}
            {schoolInfo?.schoolGmail && <a href={`mailto:${schoolInfo.schoolGmail}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Mail className="h-3 w-3" />{schoolInfo.schoolGmail}</a>}
          </div>
          <div className="flex items-center gap-3">
            {[branding?.school_facebook, branding?.school_twitter, branding?.school_instagram, branding?.school_youtube].map((href, i) => {
              const icons = [Facebook, Twitter, Instagram, Youtube];
              const Icon = icons[i];
              return <a key={i} href={href || "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer" className="hover:text-[#f97316] transition-colors"><Icon className="h-3.5 w-3.5" /></a>;
            })}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => go("/")}>
            {schoolInfo?.logoUrl ? (
              <img src={schoolInfo.logoUrl} alt="Logo" className="h-11 w-11 rounded-full object-cover border-2" style={{ borderColor: GOLD }} />
            ) : (
              <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>
                {schoolInfo?.schoolName?.[0] ?? "S"}
              </div>
            )}
            <div className="hidden sm:block">
              <div className="font-bold text-base leading-tight" style={{ color: NAVY }}>{schoolInfo?.schoolName || "School"}</div>
              <div className="text-xs text-gray-500">{branding?.school_motto || "Excellence in Education"}</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(({ l, h }) => (
              <button key={l} onClick={() => go(h)} className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-lg transition-colors">{l}</button>
            ))}
            <div className="relative" ref={academicsRef}>
              <button onClick={() => setAcademicsOpen(o => !o)}
                className="px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 bg-blue-50"
                style={{ color: NAVY }}>
                Academics <ChevronDown className={`h-3.5 w-3.5 transition-transform ${academicsOpen ? "rotate-180" : ""}`} />
              </button>
              {academicsOpen && (
                <div className="absolute top-full left-0 mt-1 w-60 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {SUBMENU_ITEMS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => { setAcademicsOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] transition-colors border-b border-gray-50 last:border-0">
                      <Icon className="h-4 w-4 text-[#1e3a6e] shrink-0" />{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => go("/login")} className="text-white font-semibold text-xs hover:opacity-90 shadow-md hidden sm:flex" style={{ backgroundColor: GOLD }}>Login</Button>
            <button className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="lg:hidden border-t border-gray-100 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map(({ l, h }) => (
              <button key={l} onClick={() => go(h)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>
            ))}
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2">Academics</p>
              {SUBMENU_ITEMS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}
                  className="w-full flex items-center gap-2.5 px-6 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">
                  <Icon className="h-4 w-4 text-[#1e3a6e] shrink-0" />{label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </header>
  );
}

function SectionBlock({ id, icon: Icon, title, children, bg = "bg-white" }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; bg?: string }) {
  return (
    <motion.section id={id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
      className={`py-14 px-4 scroll-mt-28 ${bg}`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: NAVY }}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>{title}</h2>
            <div className="h-0.5 w-16 mt-1 rounded-full" style={{ backgroundColor: GOLD }} />
          </div>
        </div>
        {children}
      </div>
    </motion.section>
  );
}

export default function AcademicsPage() {
  const { data: schoolInfo } = useQuery<SchoolInfo>({ queryKey: ["schoolInfo"], queryFn: () => fetch("/api/settings/school-info").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: branding } = useQuery<Branding>({ queryKey: ["websiteBranding"], queryFn: () => fetch("/api/website/branding").then(r => r.json()), staleTime: 5 * 60 * 1000 });

  const merged = schoolInfo ? {
    ...schoolInfo,
    schoolName: branding?.school_name || schoolInfo.schoolName,
    logoUrl: branding?.school_logo_url || schoolInfo.logoUrl,
    address: branding?.school_address || schoolInfo.address,
    contactNumber: branding?.school_contact_number || schoolInfo.contactNumber,
    schoolGmail: branding?.school_email || schoolInfo.schoolGmail,
  } : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar schoolInfo={merged} branding={branding} />

      {/* Hero */}
      <div className="py-14 px-4 text-white text-center relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${DARK}, ${NAVY})` }}>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-xs font-semibold border border-white/20 bg-white/10">
            <BookOpen className="h-3.5 w-3.5" /><span style={{ color: GOLD }}>Academic Excellence</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Academics</h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-2xl mx-auto">
            Committed to providing quality education that promotes academic excellence, creativity, and character development.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {SUBMENU_ITEMS.map(({ id, label }) => (
              <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Quick Nav */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 py-2">
            {SUBMENU_ITEMS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shrink-0">
                <Icon className="h-3.5 w-3.5 shrink-0" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">

        {/* Curriculum */}
        <SectionBlock id="curriculum" icon={BookOpen} title="Curriculum" bg="bg-white">
          <p className="text-gray-600 leading-relaxed mb-6">
            The school follows the prescribed curriculum and offers a balanced education that includes all core subjects and extracurricular activities designed to help students achieve their full potential in a supportive and stimulating learning environment.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {["English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer Education", "General Knowledge", "Art & Craft", "Physical Education"].map((sub, i) => (
              <motion.div key={sub} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group cursor-default">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: NAVY }}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium text-gray-700">{sub}</span>
              </motion.div>
            ))}
          </div>
        </SectionBlock>

        {/* Teaching Methodology */}
        <SectionBlock id="methodology" icon={GraduationCap} title="Teaching Methodology" bg="bg-gray-50">
          <p className="text-gray-600 leading-relaxed mb-6">
            We use modern and interactive teaching methods to make learning enjoyable and effective. Our experienced teachers focus on the holistic development of every student.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Concept-based Learning", desc: "Deep understanding over rote memorization, building strong foundations in every subject." },
              { title: "Activity-oriented Teaching", desc: "Hands-on activities that make abstract concepts tangible, memorable, and engaging." },
              { title: "Smart Classroom Learning", desc: "Modern technology-enabled classrooms for interactive and digital education experiences." },
              { title: "Project Work & Practicals", desc: "Real-world applications through creative projects and experimental learning activities." },
              { title: "Individual Attention", desc: "Personalized focus on every student's unique learning pace, style, and strengths." },
              { title: "Collaborative Learning", desc: "Group activities and discussions that foster teamwork, communication, and critical thinking." },
            ].map(({ title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}20` }}>
                  <ChevronRight className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div><h4 className="font-semibold text-gray-800 mb-1">{title}</h4><p className="text-sm text-gray-500 leading-relaxed">{desc}</p></div>
              </motion.div>
            ))}
          </div>
        </SectionBlock>

        {/* Examination & Assessment */}
        <SectionBlock id="examination" icon={ClipboardList} title="Examination & Assessment" bg="bg-white">
          <p className="text-gray-600 leading-relaxed mb-6">
            Student progress is regularly monitored through a comprehensive assessment system that evaluates academic performance and overall development throughout the year.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Unit Tests", period: "Monthly", color: "bg-blue-50 border-blue-200 text-blue-700" },
              { name: "Periodic Assessments", period: "Quarterly", color: "bg-purple-50 border-purple-200 text-purple-700" },
              { name: "Half-Yearly Examinations", period: "Mid-Year", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
              { name: "Annual Examinations", period: "End of Year", color: "bg-amber-50 border-amber-200 text-amber-700" },
              { name: "Class Activities & Projects", period: "Continuous", color: "bg-rose-50 border-rose-200 text-rose-700" },
              { name: "Practical Assessments", period: "Term-wise", color: "bg-teal-50 border-teal-200 text-teal-700" },
            ].map(({ name, period, color }, i) => (
              <motion.div key={name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className={`p-4 rounded-xl border ${color}`}>
                <Trophy className="h-5 w-5 mb-2 opacity-70" />
                <div className="font-semibold text-sm mb-1">{name}</div>
                <div className="text-xs opacity-70">{period}</div>
              </motion.div>
            ))}
          </div>
        </SectionBlock>

        {/* Academic Calendar */}
        <SectionBlock id="calendar" icon={Calendar} title="Academic Calendar" bg="bg-gray-50">
          <p className="text-gray-600 leading-relaxed mb-6">
            The academic year follows a structured calendar ensuring balanced distribution of studies, assessments, co-curricular activities, and holidays.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { month: "April", event: "Academic Year Begins · Admission Process" },
              { month: "May–June", event: "First Unit Test · Summer Holidays" },
              { month: "July", event: "School Reopens · Mid-term Activities" },
              { month: "August", event: "Independence Day · Sports Events" },
              { month: "September", event: "Half-Yearly Examinations" },
              { month: "October", event: "Dussehra Holidays · Results Declaration" },
              { month: "November", event: "Second Periodic Assessment" },
              { month: "December", event: "Annual Function · Christmas Break" },
              { month: "January", event: "Republic Day · Science Fair" },
              { month: "February", event: "Second Unit Test · Cultural Programs" },
              { month: "March", event: "Annual Examinations" },
              { month: "March–April", event: "Results & Promotions" },
            ].map(({ month, event }) => (
              <div key={month} className="flex gap-3 p-3 bg-white rounded-lg border border-gray-100">
                <div className="w-24 shrink-0 text-xs font-bold py-1.5 px-2 rounded-lg text-center" style={{ backgroundColor: `${NAVY}15`, color: NAVY }}>{month}</div>
                <div className="text-sm text-gray-600 flex items-center">{event}</div>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* Library */}
        <SectionBlock id="library" icon={Library} title="Library" bg="bg-white">
          <p className="text-gray-600 leading-relaxed mb-6">
            Our school library is a well-equipped resource center with a vast collection of books, periodicals, reference materials, and digital resources to support learning beyond the classroom.
          </p>
          <div className="grid sm:grid-cols-3 gap-5 mb-6">
            {[
              { label: "Books Available", value: "5,000+", icon: BookOpen },
              { label: "Reference Books", value: "1,200+", icon: FileText },
              { label: "Magazines & Journals", value: "50+", icon: Layers },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center p-6 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${NAVY}15` }}>
                  <Icon className="h-7 w-7" style={{ color: NAVY }} />
                </div>
                <div className="text-2xl font-bold mb-1" style={{ color: NAVY }}>{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
            <strong>Library Hours:</strong> Monday to Saturday · 8:00 AM – 4:00 PM · Students may borrow up to 2 books at a time for 7 days.
          </div>
        </SectionBlock>

        {/* Laboratories */}
        <SectionBlock id="laboratories" icon={FlaskConical} title="Laboratories" bg="bg-gray-50">
          <p className="text-gray-600 leading-relaxed mb-6">
            Our school features well-equipped laboratories designed to foster scientific inquiry, hands-on experimentation, and practical skill development.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { name: "Science Laboratory", desc: "Fully equipped for Physics, Chemistry and Biology experiments with modern apparatus and safety equipment.", color: "from-emerald-400 to-teal-500" },
              { name: "Computer Laboratory", desc: "State-of-the-art computers with high-speed internet for digital education, coding, and online research.", color: "from-blue-400 to-blue-600" },
              { name: "Mathematics Lab", desc: "Interactive tools and geometric manipulatives to help students visualize and understand mathematical concepts.", color: "from-purple-400 to-purple-600" },
              { name: "Language Lab", desc: "Audio-visual equipment and software for improving language skills, pronunciation, and communication.", color: "from-rose-400 to-pink-500" },
            ].map(({ name, desc, color }, i) => (
              <motion.div key={name} initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white hover:shadow-lg transition-shadow">
                <div className={`h-2 bg-gradient-to-r ${color}`} />
                <div className="p-5">
                  <h4 className="font-bold text-gray-800 mb-2">{name}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionBlock>

        {/* Results */}
        <SectionBlock id="results" icon={Trophy} title="Results" bg="bg-white">
          <p className="text-gray-600 leading-relaxed mb-6">
            Our school consistently achieves excellent academic results. Parents can access their child's results through the Parent Portal after examinations are completed and results are declared.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Pass Rate", value: "98%+", sub: "Annual Examinations" },
              { label: "Distinction", value: "45%+", sub: "Students scoring 75%+" },
              { label: "Top Scorers", value: "15%+", sub: "Students scoring 90%+" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="text-center p-5 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-3xl font-bold mb-1" style={{ color: GOLD }}>{value}</div>
                <div className="font-semibold text-gray-700 text-sm mb-1">{label}</div>
                <div className="text-xs text-gray-400">{sub}</div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button onClick={() => window.location.href = "/parent/login"} className="text-white font-semibold" style={{ backgroundColor: NAVY }}>
              View My Child's Results &rarr;
            </Button>
          </div>
        </SectionBlock>

        {/* Homework & Assignments */}
        <SectionBlock id="homework" icon={FileText} title="Homework & Assignments" bg="bg-gray-50">
          <p className="text-gray-600 leading-relaxed mb-6">
            Regular homework and assignments are given to reinforce classroom learning and develop discipline, time management, and independent study habits in every student.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Daily Homework", desc: "Subject-specific exercises assigned daily to reinforce concepts taught in class and maintain study rhythm." },
              { title: "Weekly Assignments", desc: "Comprehensive assignments covering weekly topics for deeper understanding and revision." },
              { title: "Project Work", desc: "Creative projects that encourage research, collaboration, critical thinking, and presentation skills." },
              { title: "Holiday Homework", desc: "Structured vacation assignments to maintain learning continuity and prevent knowledge gaps during breaks." },
            ].map(({ title, desc }, i) => (
              <div key={title} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white" style={{ backgroundColor: GOLD }}>{i + 1}</div>
                <div><h4 className="font-semibold text-gray-800 mb-1 text-sm">{title}</h4><p className="text-xs text-gray-500 leading-relaxed">{desc}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <Button onClick={() => window.location.href = "/parent/login"} variant="outline" className="border-[#1e3a6e] text-[#1e3a6e] hover:bg-blue-50">
              Check Homework via Parent Portal
            </Button>
          </div>
        </SectionBlock>

        {/* Learning Resources */}
        <SectionBlock id="resources" icon={Layers} title="Learning Resources" bg="bg-white">
          <p className="text-gray-600 leading-relaxed mb-6">
            We provide a wide range of academic support resources to ensure every student has the tools, guidance, and environment they need to succeed academically and personally.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {[
              { title: "Remedial Classes", desc: "Extra classes for students who need additional help to grasp concepts and catch up with peers.", icon: GraduationCap },
              { title: "Doubt-Clearing Sessions", desc: "Dedicated sessions where students can ask questions and get personalized clarification from teachers.", icon: BookOpen },
              { title: "Parent-Teacher Meetings", desc: "Regular PTMs to discuss student progress, address concerns, and strengthen the school-home connection.", icon: Users },
              { title: "Career Guidance & Counseling", desc: "Professional guidance to help students explore their interests, strengths, and future academic and career paths.", icon: Trophy },
            ].map(({ title, desc, icon: Icon }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${NAVY}15` }}>
                  <Icon className="h-5 w-5" style={{ color: NAVY }} />
                </div>
                <div><h4 className="font-semibold text-gray-800 mb-1 text-sm">{title}</h4><p className="text-xs text-gray-500 leading-relaxed">{desc}</p></div>
              </motion.div>
            ))}
          </div>
        </SectionBlock>

        {/* Goal Banner */}
        <div className="py-16 px-4 text-white text-center" style={{ background: `linear-gradient(135deg, ${DARK}, ${NAVY})` }}>
          <div className="max-w-3xl mx-auto">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl font-bold mb-4">Our Goal</h2>
            <p className="text-white/85 text-lg leading-relaxed">
              Our aim is to nurture confident, responsible, and lifelong learners who are prepared to meet future challenges and contribute positively to society.
            </p>
          </div>
        </div>
      </div>

      <footer style={{ backgroundColor: DARK }} className="text-white py-8 px-4 text-center text-sm text-white/50">
        <p>© {new Date().getFullYear()} {merged?.schoolName || "Our School"}. All rights reserved.</p>
      </footer>
    </div>
  );
}
