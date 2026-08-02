import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Phone, Mail, MapPin, Facebook, Twitter, Instagram, Youtube,
  ChevronLeft, ChevronRight, ChevronDown, Users, GraduationCap, Award, BookOpen,
  Download, FileText, Star, Quote, Menu, X, ArrowRight,
  Calendar, Bell, Trophy, Image as ImageIcon, MessageSquare,
  UserCircle, ShieldCheck, BookOpenCheck, CreditCard, FileCheck,
  Bus, Clock, LayoutDashboard, GraduationCap as TeacherIcon, User, Monitor, Globe, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const transportImg = "";
const scienceLabImg = "";
const artsImg = "";
const tourImg = "";
const computerLabImg = "";
const sportsImg = "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchoolInfo {
  schoolName: string;
  address: string;
  contactNumber: string;
  logoUrl: string;
  schoolGmail: string;
  mapsUrl: string;
}
interface Branding {
  school_name: string;
  school_logo_url: string;
  school_motto: string;
  school_tagline: string;
  school_established: string;
  school_principal_name: string;
  school_principal_photo: string;
  school_address: string;
  school_contact_number: string;
  school_email: string;
  school_website: string;
  school_facebook: string;
  school_twitter: string;
  school_instagram: string;
  school_youtube: string;
  school_short_name: string;
  school_affiliation: string;
  school_vision: string;
  school_mission: string;
  school_office_hours?: string;
  school_academic_year?: string;
}
interface Notice { id: number; title: string; content: string; createdAt: string; classId?: number | null; className?: string | null; }
interface Slide { id: number; title: string; subtitle: string; ctaText: string; ctaLink: string; bgGradient: string; imageUrl: string; }
interface Stats { students: number; teachers: number; yearsOfExcellence: number; }
interface Topper { id: number; studentName: string; className: string; marks: string; percentage: string; examType: string; session: string; rank: number; photoUrl: string; }
interface GalleryAlbum { id: number; name: string; description: string; coverImageUrl: string; }
interface Testimonial { id: number; name: string; designation: string; content: string; rating: number; photoUrl: string; }
interface DownloadItem { id: number; title: string; category: string; fileUrl: string; fileType: string; downloadCount: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

const DEFAULT_SLIDES = [
  { title: "Welcome to Our School", subtitle: "Nurturing Excellence · Building Character · Shaping Futures", ctaText: "Explore More", ctaLink: "#about", bgGradient: "from-[#0f2045] via-[#1e3a6e] to-[#0f2045]", imageUrl: "" },
  { title: "Excellence in Education", subtitle: "Award-winning curriculum and dedicated faculty committed to your child's success", ctaText: "View Results", ctaLink: "/parent/login", bgGradient: "from-[#163066] via-[#1e3a6e] to-[#0f2045]", imageUrl: "" },
  { title: "Admissions Open 2025–26", subtitle: "Join our prestigious school family. Limited seats available. Enroll today.", ctaText: "Apply Now", ctaLink: "/admission", bgGradient: "from-[#2d1b69] via-[#1e3a6e] to-[#0f2045]", imageUrl: "" },
];

const QUICK_ACCESS = [
  { title: "Parent Portal", desc: "Track attendance, fees & results", icon: Users, href: "/parent/login", bg: "bg-blue-600", light: "bg-blue-50", text: "text-blue-700" },
  { title: "Teacher Portal", desc: "Manage classes & marks", icon: GraduationCap, href: "/teacher/login", bg: "bg-emerald-600", light: "bg-emerald-50", text: "text-emerald-700" },
  { title: "Homework", desc: "View class homework & assignments", icon: BookOpen, href: "/homework", bg: "bg-indigo-600", light: "bg-indigo-50", text: "text-indigo-700" },
  { title: "View Results", desc: "Exam marks & report cards", icon: BookOpenCheck, href: "/results", bg: "bg-purple-600", light: "bg-purple-50", text: "text-purple-700" },
  { title: "Fee Payment", desc: "View & manage school fees", icon: CreditCard, href: "/fee-payment", bg: "bg-amber-600", light: "bg-amber-50", text: "text-amber-700" },
  { title: "Admit Card", desc: "Download exam admit cards", icon: FileCheck, href: "/admit-card", bg: "bg-rose-600", light: "bg-rose-50", text: "text-rose-700" },
  { title: "Student Roster", desc: "Public bus roster & QR verify", icon: Bus, href: "/roster", bg: "bg-teal-600", light: "bg-teal-50", text: "text-teal-700" },
  { title: "Certificate Request and Download Center", desc: "Forms, calendars & documents", icon: Download, href: "/downloads", bg: "bg-orange-600", light: "bg-orange-50", text: "text-orange-700" },
  { title: "Apply Admission", desc: "Apply for new admission online", icon: MessageSquare, href: "/admission", bg: "bg-pink-600", light: "bg-pink-50", text: "text-pink-700" },
];

const GALLERY_GRADIENTS = [
  "from-blue-400 to-blue-600", "from-purple-400 to-purple-600", "from-teal-400 to-teal-600",
  "from-rose-400 to-rose-600", "from-amber-400 to-amber-600", "from-emerald-400 to-emerald-600",
];
const GALLERY_PLACEHOLDERS = ["Annual Day", "Sports Day", "Science Fair", "Cultural Program", "Independence Day", "Teachers Day"];

const DEFAULT_TESTIMONIALS = [
  { id: 1, name: "Rahul Kumar", designation: "Parent of Class X student", content: "The school has been instrumental in my child's overall development. Dedicated teachers and excellent infrastructure. Highly recommend!", rating: 5, photoUrl: "" },
  { id: 2, name: "Priya Sharma", designation: "Parent of Class VII student", content: "Perfect blend of academics and extra-curricular activities. My daughter has grown tremendously since joining here.", rating: 5, photoUrl: "" },
  { id: 3, name: "Amit Singh", designation: "Alumni 2022", content: "The values and education I received here have shaped me into who I am today. Forever grateful to the faculty.", rating: 5, photoUrl: "" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, light = false }: { title: string; subtitle?: string; light?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className={`h-px w-16 ${light ? "bg-white/30" : "bg-[#c9a84c]/40"}`} />
        <span className="text-xs font-bold tracking-widest uppercase text-[#c9a84c]">{subtitle || "Our School"}</span>
        <div className={`h-px w-16 ${light ? "bg-white/30" : "bg-[#c9a84c]/40"}`} />
      </div>
      <h2 className={`text-3xl md:text-4xl font-bold ${light ? "text-white" : "text-[#1e3a6e]"}`}>{title}</h2>
    </motion.div>
  );
}

function CounterNumber({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);
  useEffect(() => {
    if (!started || !target) return;
    let cur = 0;
    const step = target / 60;
    const timer = setInterval(() => { cur += step; if (cur >= target) { setCount(target); clearInterval(timer); } else setCount(Math.floor(cur)); }, 33);
    return () => clearInterval(timer);
  }, [started, target]);
  return <span ref={ref}>{count.toLocaleString()}</span>;
}

// ─── Announcement Bar ─────────────────────────────────────────────────────────

function AnnouncementBar({ notices, currentSession }: { notices: Notice[]; currentSession?: string }) {
  const sessionLabel = currentSession ? `Admissions open for ${currentSession}` : "Admissions open";
  const text = notices.length ? notices.map(n => n.title).join("   •   ") : `Welcome to our school website   •   ${sessionLabel}   •   Excellence in Education`;
  return (
    <div style={{ backgroundColor: DARK }} className="text-white py-2 overflow-hidden border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
        <span className="text-xs font-bold px-3 py-1 rounded shrink-0 whitespace-nowrap" style={{ backgroundColor: GOLD, color: DARK }}>NOTICE</span>
        <div className="overflow-hidden flex-1"><div className="animate-marquee whitespace-nowrap text-sm opacity-90">{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}</div></div>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function NavBar({ schoolInfo, branding }: { schoolInfo: SchoolInfo | undefined; branding?: Branding }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [academicsOpen, setAcademicsOpen] = useState(false);
  const [mobileAcademicsOpen, setMobileAcademicsOpen] = useState(false);
  const [mobileAdmissionOpen, setMobileAdmissionOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [infoBarOpen, setInfoBarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const loginRef = useRef<HTMLDivElement>(null);
  const academicsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) setLoginOpen(false);
      if (academicsRef.current && !academicsRef.current.contains(e.target as Node)) setAcademicsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 50); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const go = (href: string) => { setMenuOpen(false); if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); else setLocation(href); };
  const navLinks = [{ l: "Home", h: "/" }, { l: "About", h: "/about" }, { l: "Admission", h: "/admission" }, { l: "Gallery", h: "/gallery" }, { l: "Notices", h: "#notices" }, { l: "Downloads", h: "/downloads" }, { l: "Roster", h: "/roster" }, { l: "Contact", h: "/contact" }];
  const academicsLinks = [
    { l: "Curriculum", h: "/academics#curriculum" }, { l: "Teaching Methodology", h: "/academics#methodology" },
    { l: "Examination & Assessment", h: "/academics#examination" }, { l: "Academic Calendar", h: "/academics#calendar" },
    { l: "Library", h: "/academics#library" }, { l: "Laboratories", h: "/academics#laboratories" },
    { l: "Results", h: "/academics#results" }, { l: "Homework & Assignments", h: "/academics#homework" },
    { l: "Learning Resources", h: "/academics#resources" },
  ];
  const admissionLinks = [
    { l: "Overview", h: "/admission" },
    { l: "Admission Procedure", h: "/admission#procedure" },
    { l: "Documents Required", h: "/admission#documents" },
    { l: "Fee Structure", h: "/admission#fee" },
    { l: "School Timings", h: "/admission#timings" },
    { l: "Transport Facility", h: "/admission#transport" },
    { l: "Uniform Guidelines", h: "/admission#uniform" },
    { l: "FAQs", h: "/admission#faqs" },
    { l: "Apply Now", h: "/admission#apply-form" },
  ];
  const socials = [
    { Icon: Facebook, href: branding?.school_facebook || "#" },
    { Icon: Twitter, href: branding?.school_twitter || "#" },
    { Icon: Instagram, href: branding?.school_instagram || "#" },
    { Icon: Youtube, href: branding?.school_youtube || "#" },
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-300 ${scrolled ? "shadow-xl" : "shadow-sm"} border-b border-gray-100`}>
      {/* Top bar */}
      <div style={{ backgroundColor: NAVY }} className="text-white hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            {schoolInfo?.contactNumber && <a href={`tel:${schoolInfo.contactNumber}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Phone className="h-3 w-3" />{schoolInfo.contactNumber}</a>}
            {schoolInfo?.schoolGmail && <a href={`mailto:${schoolInfo.schoolGmail}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Mail className="h-3 w-3" />{schoolInfo.schoolGmail}</a>}
            {schoolInfo?.address && <span className="flex items-center gap-1.5 opacity-70"><MapPin className="h-3 w-3" />{schoolInfo.address.slice(0, 50)}{schoolInfo.address.length > 50 ? "…" : ""}</span>}
          </div>
          <div className="flex items-center gap-3">
            {socials.map(({ Icon, href }, i) => <a key={i} href={href} target={href === "#" ? undefined : "_blank"} rel="noopener noreferrer" className="hover:text-[#f97316] transition-colors"><Icon className="h-3.5 w-3.5" /></a>)}
          </div>
        </div>
      </div>
      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => go("/")}>
            {schoolInfo?.logoUrl ? (
              <img src={schoolInfo.logoUrl} alt="Logo" className="h-14 w-14 sm:h-20 sm:w-20 object-contain shrink-0" />
            ) : (
              <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-xl flex items-center justify-center text-white font-bold text-2xl shrink-0" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>
                {schoolInfo?.schoolName?.[0] ?? "S"}
              </div>
            )}
            <div className="block min-w-0">
              <div className="font-bold text-sm sm:text-xl leading-tight truncate" style={{ color: NAVY }}>{schoolInfo?.schoolName || "School Management System"}</div>
              <div className="text-xs sm:text-sm text-gray-500">{branding?.school_motto || "Excellence in Education"}</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.slice(0, 3).map(({ l, h }) => (
              <button key={l} onClick={() => go(h)} className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-lg transition-colors">{l}</button>
            ))}
            <div className="relative" ref={academicsRef}>
              <button onClick={() => setAcademicsOpen(o => !o)} className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">
                Academics <ChevronDown className={`h-3.5 w-3.5 transition-transform ${academicsOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {academicsOpen && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {academicsLinks.map(({ l, h }) => (
                      <button key={l} onClick={() => { setAcademicsOpen(false); go(h); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] transition-colors border-b border-gray-50 last:border-0">
                        {l}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {navLinks.slice(3).map(({ l, h }) => (
              <button key={l} onClick={() => go(h)} className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50 rounded-lg transition-colors">{l}</button>
            ))}
          </nav>
          {/* Login + Hamburger (always on right) */}
          <div className="flex items-center gap-2">
            {(schoolInfo?.contactNumber || schoolInfo?.schoolGmail) && (
              <button
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => setInfoBarOpen(o => !o)}
                aria-label="School contact info"
              >
                <Info className={`h-5 w-5 transition-colors ${infoBarOpen ? "text-[#1e3a6e]" : ""}`} />
              </button>
            )}
            <div className="relative" ref={loginRef}>
              <Button size="sm" onClick={() => setLoginOpen(o => !o)} className="text-white font-semibold text-xs hover:opacity-90 flex items-center gap-1.5 shadow-md" style={{ backgroundColor: GOLD }}>
                Login <ChevronDown className={`h-3.5 w-3.5 transition-transform ${loginOpen ? "rotate-180" : ""}`} />
              </Button>
              <AnimatePresence>
                {loginOpen && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {[
                      { label: "Admin Panel", icon: LayoutDashboard, href: "/login", color: "text-[#1e3a6e]", bg: "hover:bg-blue-50" },
                      { label: "Teacher Panel", icon: TeacherIcon, href: "/teacher/login", color: "text-emerald-700", bg: "hover:bg-emerald-50" },
                      { label: "Parents Panel", icon: User, href: "/parent/login", color: "text-purple-700", bg: "hover:bg-purple-50" },
                    ].map(({ label, icon: Icon, href, color, bg }) => (
                      <button key={label} onClick={() => { setLoginOpen(false); go(href); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium ${color} ${bg} transition-colors border-b border-gray-50 last:border-0`}>
                        <Icon className="h-4 w-4 shrink-0" />{label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile collapsible info bar */}
      <AnimatePresence>
        {infoBarOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-blue-100"
            style={{ backgroundColor: "#1e3a6e" }}
          >
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {schoolInfo?.contactNumber && (
                <a href={`tel:${schoolInfo.contactNumber}`} className="flex items-center gap-3 text-white text-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 leading-none mb-0.5">Phone</div>
                    <div className="font-medium">{schoolInfo.contactNumber}</div>
                  </div>
                </a>
              )}
              {schoolInfo?.schoolGmail && (
                <a href={`mailto:${schoolInfo.schoolGmail}`} className="flex items-center gap-3 text-white text-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 leading-none mb-0.5">Email</div>
                    <div className="font-medium">{schoolInfo.schoolGmail}</div>
                  </div>
                </a>
              )}
              {schoolInfo?.address && (
                <div className="flex items-center gap-3 text-white text-sm">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-white/60 leading-none mb-0.5">Address</div>
                    <div className="font-medium">{schoolInfo.address}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="lg:hidden border-t border-gray-100 bg-white shadow-lg overflow-hidden">
            <div className="px-4 py-4 space-y-1">
              {navLinks.slice(0, 2).map(({ l, h }) => <button key={l} onClick={() => go(h)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>)}
              {/* Admission dropdown */}
              <div>
                <button onClick={() => setMobileAdmissionOpen(o => !o)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors flex items-center justify-between">
                  Admission <ChevronDown className={`h-4 w-4 transition-transform ${mobileAdmissionOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileAdmissionOpen && (
                  <div className="pl-4 space-y-0.5 mt-1">
                    {admissionLinks.map(({ l, h }) => (
                      <button key={l} onClick={() => { setMobileAdmissionOpen(false); go(h); }} className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Academics dropdown */}
              <div>
                <button onClick={() => setMobileAcademicsOpen(o => !o)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors flex items-center justify-between">
                  Academics <ChevronDown className={`h-4 w-4 transition-transform ${mobileAcademicsOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileAcademicsOpen && (
                  <div className="pl-4 space-y-0.5 mt-1">
                    {academicsLinks.map(({ l, h }) => (
                      <button key={l} onClick={() => { setMobileAcademicsOpen(false); go(h); }} className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {navLinks.slice(3).map(({ l, h }) => <button key={l} onClick={() => go(h)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>)}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Login As</p>
                {[
                  { label: "Admin Panel", icon: LayoutDashboard, href: "/login", color: "text-[#1e3a6e]", bg: "hover:bg-blue-50" },
                  { label: "Teacher Panel", icon: TeacherIcon, href: "/teacher/login", color: "text-emerald-700", bg: "hover:bg-emerald-50" },
                  { label: "Parents Panel", icon: User, href: "/parent/login", color: "text-purple-700", bg: "hover:bg-purple-50" },
                ].map(({ label, icon: Icon, href, color, bg }) => (
                  <button key={label} onClick={() => go(href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg ${color} ${bg} transition-colors`}>
                    <Icon className="h-4 w-4 shrink-0" />{label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Hero Slider ──────────────────────────────────────────────────────────────

function HeroSlider({ slides: db, branding, currentSession }: { slides: Slide[]; branding?: Branding; currentSession?: string }) {
  const [, setLocation] = useLocation();
  // When using default slides, replace the hardcoded admission slide title with
  // the live current academic session name so it always stays accurate.
  const defaultSlides = DEFAULT_SLIDES.map(s =>
    s.ctaLink === "/admission" && currentSession
      ? { ...s, title: `Admissions Open ${currentSession}` }
      : s
  );
  const all = db.length > 0 ? db : (defaultSlides as unknown as Slide[]);
  const [cur, setCur] = useState(0);
  useEffect(() => { const t = setInterval(() => setCur(p => (p + 1) % all.length), 5500); return () => clearInterval(t); }, [all.length]);
  const go = (href: string) => { if (!href) return; if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); else if (href.startsWith("http")) window.open(href, "_blank"); else setLocation(href); };

  return (
    <div className="relative h-[65vh] min-h-[420px] max-h-[680px] overflow-hidden">
      <AnimatePresence mode="wait">
        {(() => {
          const slide = all[cur];
          const imageOnly = slide?.bgGradient === "image-only";
          return (
        <motion.div key={cur} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}
          className={`absolute inset-0 ${imageOnly ? "bg-black" : `bg-gradient-to-br ${slide?.bgGradient || "from-[#0f2045] to-[#1e3a6e]"}`}`}>
          {imageOnly && slide?.imageUrl && (
            <img src={slide.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {imageOnly && <div className="absolute inset-0 bg-black/45" />}
          {!imageOnly && slide?.imageUrl && (
            <img src={slide.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-25" />
          )}
          {!imageOnly && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent)` }} />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent)` }} />
          </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="max-w-4xl mx-auto px-8 text-center text-white">
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}>
                <div className="inline-flex items-center gap-2 mb-5">
                  <div className="h-px w-12" style={{ backgroundColor: GOLD }} />
                  <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: GOLD }}>Est. {branding?.school_established || "2000"}</span>
                  <div className="h-px w-12" style={{ backgroundColor: GOLD }} />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight drop-shadow-lg">{all[cur]?.title}</h1>
                <p className="text-lg md:text-xl text-white/85 mb-9 max-w-2xl mx-auto leading-relaxed">{all[cur]?.subtitle}</p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {all[cur]?.ctaText && (
                    <Button onClick={() => go(all[cur].ctaLink)} className="font-semibold px-8 py-3 text-base" style={{ backgroundColor: GOLD, color: DARK }}>{all[cur].ctaText}</Button>
                  )}
                  <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#1e3a6e] px-8 py-3 text-base" onClick={() => document.getElementById("enquiry")?.scrollIntoView({ behavior: "smooth" })}>Enquire Now</Button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
          );
        })()}
      </AnimatePresence>
      <button onClick={() => setCur(p => (p - 1 + all.length) % all.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all backdrop-blur-sm"><ChevronLeft className="h-5 w-5" /></button>
      <button onClick={() => setCur(p => (p + 1) % all.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all backdrop-blur-sm"><ChevronRight className="h-5 w-5" /></button>
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
        {all.map((_, i) => <button key={i} onClick={() => setCur(i)} className={`h-2 rounded-full transition-all ${i === cur ? "w-8 bg-[#c9a84c]" : "w-2 bg-white/50"}`} />)}
      </div>
    </div>
  );
}

// ─── Our Main Services ────────────────────────────────────────────────────────

const SCHOOL_SERVICES = [
  { title: "Safe Transportation", desc: "We provide a safe transportation system for your child's safety, so you can use our transportation system.", img: transportImg },
  { title: "Science Lab", desc: "Our science lab is equipped with modern instruments to inspire curiosity and hands-on scientific discovery.", img: scienceLabImg },
  { title: "Arts and Crafts", desc: "We focus on arts and crafts educational system for your child to improve this type of knowledge.", img: artsImg },
  { title: "Educational Tour", desc: "We take children on educational tours where they can explore new things and learn outside the classroom.", img: tourImg },
  { title: "Computer Lab", desc: "Also we provide a smart computer lab for all students to improve computer knowledge.", img: computerLabImg },
  { title: "Sport and Game", desc: "We are focusing on games and sports like cricket, football, chess and badminton.", img: sportsImg },
];

function ServicesSection() {
  return (
    <section className="py-20 px-4 bg-white" id="services">
      <div className="max-w-5xl mx-auto">
        {/* Section heading inspired by the design */}
        <div className="flex items-center gap-3 mb-12">
          <div className="h-0.5 w-8 bg-[#1e3a6e]" />
          <h2 className="text-2xl font-bold text-gray-900">
            Our Main{" "}
            <span className="bg-[#1e3a6e] text-white px-3 py-0.5 rounded">Services</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 md:gap-14">
          {SCHOOL_SERVICES.map(({ title, desc, img }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.5 }}
              className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-2xl border-2 border-[#1e3a6e] overflow-hidden mb-4 shadow-md flex items-center justify-center bg-slate-100">
                {img ? <img src={img} alt={title} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-[#1e3a6e] opacity-40" />}
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 italic leading-relaxed max-w-xs">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Quick Access ─────────────────────────────────────────────────────────────

function QuickAccessSection() {
  const [, setLocation] = useLocation();
  const go = (href: string) => { if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); else setLocation(href); };
  return (
    <section className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Quick Access" subtitle="Portals & Services" />
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
          {QUICK_ACCESS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} whileHover={{ y: -5, scale: 1.02 }} onClick={() => go(item.href)}
                className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-xl border border-gray-100 cursor-pointer transition-all group">
                <div className={`${item.light} ${item.text} w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}><Icon className="h-6 w-6" /></div>
                <h3 className={`font-semibold text-sm ${item.text} mb-1`}>{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsSection({ stats, branding: _b }: { stats: Stats | undefined; branding?: Branding }) {
  const items = [
    { label: "Students Enrolled", value: stats?.students || 500, icon: Users, s: "+" },
    { label: "Qualified Teachers", value: stats?.teachers || 30, icon: GraduationCap, s: "+" },
    { label: "Years of Excellence", value: stats?.yearsOfExcellence || 24, icon: Award, s: "" },
    { label: "Academic Awards", value: 50, icon: Trophy, s: "+" },
  ];
  return (
    <section className="py-16 px-4" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${DARK} 100%)` }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Our Achievements in Numbers" subtitle="Statistics" light />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.label} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center text-white group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${GOLD}22`, border: `2px solid ${GOLD}` }}>
                  <Icon className="h-7 w-7" style={{ color: GOLD }} />
                </div>
                <div className="text-4xl font-bold text-white mb-1"><CounterNumber target={item.value} />{item.s}</div>
                <div className="text-sm text-white/70">{item.label}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection({ schoolInfo, branding }: { schoolInfo: SchoolInfo | undefined; branding?: Branding }) {
  const [, setLocation] = useLocation();
  return (
    <section id="about" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="h-1 w-8 rounded" style={{ backgroundColor: GOLD }} />
              <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: GOLD }}>About Us</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: NAVY }}>{schoolInfo?.schoolName || "Our School"}</h2>
            <p className="text-gray-600 leading-relaxed mb-4 text-lg">We are committed to providing quality education that nurtures the intellectual, moral, and social development of every student. Our school has been a beacon of excellence since its establishment.</p>
            <p className="text-gray-600 leading-relaxed mb-8">With a dedicated faculty, modern infrastructure, and a holistic curriculum, we prepare students to meet 21st-century challenges while remaining grounded in values of integrity, respect, and service.</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[{ l: "Established", v: branding?.school_established || "2000" }, { l: "Affiliation", v: "CBSE" }, { l: "Medium", v: "English" }].map(({ l, v }) => (
                <div key={l} className="text-center p-4 rounded-xl border-2 border-blue-50 bg-blue-50/50">
                  <div className="font-bold text-lg" style={{ color: NAVY }}>{v}</div>
                  <div className="text-xs text-gray-500 mt-1">{l}</div>
                </div>
              ))}
            </div>
            <Button style={{ backgroundColor: NAVY }} className="text-white hover:opacity-90" onClick={() => setLocation("/about")}>
              Learn More <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="space-y-5">
            <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>
              <Quote className="h-8 w-8 opacity-30 mb-4" style={{ color: GOLD }} />
              <p className="text-white/90 leading-relaxed mb-5 italic text-base">"Education is not merely about filling minds with knowledge, but about kindling the flames of curiosity, critical thinking, and character that will guide our students throughout their lives."</p>
              <div className="flex items-center gap-3">
                {branding?.school_principal_photo
                  ? <img src={branding.school_principal_photo} alt="Principal" className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: GOLD }} />
                  : <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center"><UserCircle className="h-7 w-7 text-white/60" /></div>}
                <div>
                  <div className="font-semibold text-sm">{branding?.school_principal_name || "School Principal"}</div>
                  <div className="text-xs" style={{ color: GOLD }}>{schoolInfo?.schoolName || "Our School"}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4 border-l-4 bg-amber-50" style={{ borderColor: GOLD }}><div className="font-bold text-sm mb-2" style={{ color: NAVY }}>🎯 Our Mission</div><p className="text-xs text-gray-600 leading-relaxed">To provide quality education that empowers students to excel academically and contribute positively to society.</p></div>
              <div className="rounded-xl p-4 border-l-4 bg-blue-50" style={{ borderColor: NAVY }}><div className="font-bold text-sm mb-2" style={{ color: NAVY }}>🔭 Our Vision</div><p className="text-xs text-gray-600 leading-relaxed">To be a centre of excellence fostering innovation, character, and lifelong learning for global citizenship.</p></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Notice Board ─────────────────────────────────────────────────────────────

function NoticeBoardSection({ notices }: { notices: Notice[] }) {
  const [, setLocation] = useLocation();
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section id="notices" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Notice Board" subtitle="Latest Announcements" />
        {notices.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Bell className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No notices available at the moment.</p></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notices.slice(0, 6).map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md border border-gray-100 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${NAVY}15` }}><Bell className="h-5 w-5" style={{ color: NAVY }} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{n.title}</h4>
                      {n.className && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${NAVY}15`, color: NAVY }}>{n.className}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{n.content}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400"><Calendar className="h-3 w-3" />{fmt(n.createdAt)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        <div className="text-center mt-8">
          <Button variant="outline" onClick={() => setLocation("/parent/login")} style={{ borderColor: NAVY, color: NAVY }} className="hover:bg-[#1e3a6e] hover:text-white">
            View All Notices <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Toppers ─────────────────────────────────────────────────────────────────

function ToppersSection({ toppers }: { toppers: Topper[] }) {
  const medalColor = (r: number) => r === 1 ? "#FFD700" : r === 2 ? "#C0C0C0" : "#CD7F32";
  return (
    <section id="toppers" className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Academic Toppers" subtitle="Hall of Fame" />
        {toppers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Academic toppers will appear here once added from the admin panel.</p>
          </div>
        ) : (
        <div className="flex gap-5 overflow-x-auto pb-4 justify-start md:justify-center">
          {toppers.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="shrink-0 w-44 text-center">
              <div className="relative mx-auto w-24 h-24 mb-3">
                {t.photoUrl ? <img src={t.photoUrl} alt={t.studentName} className="w-24 h-24 rounded-full object-cover border-4" style={{ borderColor: GOLD }} /> : (
                  <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center text-white text-2xl font-bold" style={{ borderColor: GOLD, background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>{t.studentName[0]}</div>
                )}
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: medalColor(t.rank), color: "#333" }}>#{t.rank}</div>
              </div>
              <h4 className="font-bold text-sm text-gray-800 truncate">{t.studentName}</h4>
              <p className="text-xs text-gray-500 mb-1">Class {t.className}</p>
              {t.percentage && <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: NAVY }}>{parseFloat(t.percentage).toFixed(1)}%</div>}
              <p className="text-xs text-gray-400 mt-1">{t.examType} {t.session}</p>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}

// ─── Birthdays ────────────────────────────────────────────────────────────────

type BirthdayStudent = { id: number; name: string; className?: string; photoUrl?: string };

function BirthdaysSection() {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { data: birthdays = [] } = useQuery<BirthdayStudent[]>({
    queryKey: ["/api/website/birthdays", mmdd],
    queryFn: () => fetch(`/api/website/birthdays`).then(r => r.json()),
    staleTime: 0,
    refetchOnMount: true,
  });
  return (
    <section className="py-14 px-4" style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-block text-4xl mb-2">🎂</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white">Birthday Wishes</h2>
          <p className="text-white/60 text-sm mt-1">Celebrating today's special students</p>
        </div>
        {birthdays.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-5xl block mb-3">🎈</span>
            <p className="text-white/50 text-sm">No student birthdays today. Check back tomorrow!</p>
          </div>
        ) : (
        <div className="flex flex-wrap justify-center gap-5">
          {birthdays.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              className="flex flex-col items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-5 text-center border border-white/20 hover:bg-white/20 transition-colors">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={s.name} className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold border-2 border-yellow-400" style={{ background: `rgba(249,115,22,0.4)` }}>{s.name[0]}</div>
              )}
              <div>
                <div className="text-white font-bold text-sm">🎉 {s.name}</div>
                {s.className && <div className="text-white/60 text-xs">{s.className}</div>}
                <div className="text-yellow-300 text-xs mt-1">Happy Birthday!</div>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

function GallerySection({ albums }: { albums: GalleryAlbum[] }) {
  return (
    <section id="gallery" className="py-16 px-4 bg-[#f8f9fc]">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Photo Gallery" subtitle="Events & Activities" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {albums.length === 0
            ? GALLERY_PLACEHOLDERS.map((name, i) => (
              <div key={name} className={`bg-gradient-to-br ${GALLERY_GRADIENTS[i]} rounded-xl h-48 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity group relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                <div className="relative text-white text-center"><ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-70" /><p className="font-semibold text-sm">{name}</p></div>
              </div>
            ))
            : albums.slice(0, 6).map((album, i) => (
              <motion.div key={album.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="rounded-xl h-48 overflow-hidden relative cursor-pointer group">
                {album.coverImageUrl ? <img src={album.coverImageUrl} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className={`w-full h-full bg-gradient-to-br ${GALLERY_GRADIENTS[i % GALLERY_GRADIENTS.length]}`} />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4"><p className="text-white font-semibold text-sm">{album.name}</p></div>
              </motion.div>
            ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection({ testimonials: db }: { testimonials: Testimonial[] }) {
  const all = db.length > 0 ? db : DEFAULT_TESTIMONIALS;
  const [cur, setCur] = useState(0);
  const perPage = 3;
  return (
    <section className="py-16 px-4" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${DARK} 100%)` }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="What Parents & Alumni Say" subtitle="Testimonials" light />
        <div className="grid md:grid-cols-3 gap-5">
          {all.slice(cur, cur + perPage).map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="flex mb-4">{[...Array(t.rating || 5)].map((_, si) => <Star key={si} className="h-4 w-4" style={{ color: GOLD }} fill={GOLD} />)}</div>
              <Quote className="h-6 w-6 mb-3 opacity-40" style={{ color: GOLD }} />
              <p className="text-white/90 text-sm leading-relaxed mb-5 italic">"{t.content}"</p>
              <div className="flex items-center gap-3">
                {t.photoUrl ? <img src={t.photoUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover" /> : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: `${GOLD}44` }}>{t.name[0]}</div>
                )}
                <div><div className="text-white font-semibold text-sm">{t.name}</div><div className="text-xs text-white/60">{t.designation}</div></div>
              </div>
            </motion.div>
          ))}
        </div>
        {all.length > perPage && (
          <div className="flex justify-center gap-3 mt-8">
            <button onClick={() => setCur(Math.max(0, cur - perPage))} disabled={cur === 0} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30 transition-all"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setCur(Math.min(all.length - perPage, cur + perPage))} disabled={cur + perPage >= all.length} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30 transition-all"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Downloads Preview ────────────────────────────────────────────────────────

function DownloadsPreview({ downloads }: { downloads: DownloadItem[] }) {
  const [, setLocation] = useLocation();
  if (!downloads.length) return null;
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Download Center" subtitle="Important Documents" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {downloads.slice(0, 6).map((item, i) => (
            <motion.a key={item.id} href={item.fileUrl} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
              className="text-center p-4 rounded-xl border border-gray-100 hover:border-[#c9a84c] hover:shadow-md transition-all group cursor-pointer">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${NAVY}15` }}>
                <FileText className="h-6 w-6" style={{ color: NAVY }} />
              </div>
              <p className="text-xs font-medium text-gray-700 line-clamp-2 leading-tight">{item.title}</p>
              <p className="text-xs text-gray-400 mt-1 uppercase">{item.fileType}</p>
            </motion.a>
          ))}
        </div>
        <div className="text-center">
          <Button onClick={() => setLocation("/downloads")} style={{ backgroundColor: NAVY }} className="text-white hover:opacity-90">View All Downloads <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      </div>
    </section>
  );
}

// ─── Admission Banner ─────────────────────────────────────────────────────────

function AdmissionBanner({ currentSession }: { currentSession?: string }) {
  const label = currentSession ? `Admissions Open for ${currentSession}` : "Admissions Open";
  return (
    <section className="py-12 px-4" style={{ backgroundColor: GOLD }}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: DARK }}>{label}</h2>
          <p style={{ color: `${DARK}bb` }}>Limited seats available. Apply now to secure your child's future.</p>
        </div>
        <Button className="shrink-0 font-semibold px-8 py-3 text-base text-white" style={{ backgroundColor: DARK }} onClick={() => window.location.href = "/admission#apply-form"}>Apply Now →</Button>
      </div>
    </section>
  );
}

// ─── Enquiry Form ─────────────────────────────────────────────────────────────

function EnquirySection({ schoolInfo, branding, currentSession }: { schoolInfo?: SchoolInfo; branding?: Branding; currentSession?: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", studentClass: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const address = schoolInfo?.address || branding?.school_address || "";
  const phone = schoolInfo?.contactNumber || branding?.school_contact_number || "";
  const email = schoolInfo?.schoolGmail || branding?.school_email || "";
  const officeHours = branding?.school_office_hours || "Mon–Sat: 8:00 AM – 4:00 PM";
  // Use the live current academic session name; fall back to static branding setting
  const academicYear = currentSession || branding?.school_academic_year || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { toast({ title: "Name and phone are required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setSubmitted(true); toast({ title: "Enquiry submitted! We'll contact you soon." }); setForm({ name: "", email: "", phone: "", studentClass: "", message: "" }); }
      else toast({ title: "Submission failed. Please try again.", variant: "destructive" });
    } catch { toast({ title: "Network error. Please try again.", variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  return (
    <section id="enquiry" className="py-20 px-4 bg-[#f8f9fc]">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Get in Touch" subtitle="Contact Us" />
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h3 className="text-xl font-bold mb-6" style={{ color: NAVY }}>School Information</h3>
            <div className="space-y-4">
              {[
                { Icon: MapPin, l: "Address", v: address },
                { Icon: Phone, l: "Phone", v: phone },
                { Icon: Mail, l: "Email", v: email },
                { Icon: Clock, l: "Office Hours", v: officeHours },
                { Icon: BookOpen, l: "Academic Year", v: academicYear },
              ].filter(({ v }) => !!v).map(({ Icon, l, v }) => (
                <div key={l} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${NAVY}15` }}><Icon className="h-5 w-5" style={{ color: NAVY }} /></div>
                  <div><div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{l}</div><div className="text-sm text-gray-700">{v}</div></div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="font-bold text-green-800 text-lg mb-2">Enquiry Submitted!</h3>
                <p className="text-green-700 text-sm">Thank you for reaching out. Our team will contact you within 24 hours.</p>
                <Button className="mt-5" variant="outline" onClick={() => setSubmitted(false)}>Submit Another</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>Help Enquiry</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Full Name *</label><Input placeholder="Your name" value={form.name} onChange={upd("name")} required /></div>
                  <div><label className="text-xs font-medium text-gray-500 mb-1 block">Phone *</label><Input placeholder="Phone number" value={form.phone} onChange={upd("phone")} required /></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Email</label><Input type="email" placeholder="Email address" value={form.email} onChange={upd("email")} /></div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Subject</label>
                  <Input placeholder="e.g. Admission Query, Fee, Transport…" value={form.studentClass} onChange={upd("studentClass")} />
                </div>
                <div><label className="text-xs font-medium text-gray-500 mb-1 block">Message</label><textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 h-24" placeholder="Your query..." value={form.message} onChange={upd("message")} /></div>
                <Button type="submit" disabled={submitting} className="w-full font-semibold text-white" style={{ backgroundColor: NAVY }}>
                  {submitting ? "Submitting…" : "Submit Enquiry"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ schoolInfo, branding }: { schoolInfo: SchoolInfo | undefined; branding?: Branding }) {
  const [, setLocation] = useLocation();
  const go = (href: string) => { if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); else setLocation(href); };
  return (
    <footer style={{ backgroundColor: DARK }} className="text-white">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              {schoolInfo?.logoUrl ? <img src={schoolInfo.logoUrl} alt="Logo" className="h-11 w-11 rounded-full object-cover border-2" style={{ borderColor: GOLD }} /> : (
                <div className="h-11 w-11 rounded-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: GOLD, color: DARK }}>{schoolInfo?.schoolName?.[0] ?? "S"}</div>
              )}
              <div><div className="font-bold text-sm">{schoolInfo?.schoolName || "Our School"}</div><div className="text-xs text-white/50">{branding?.school_motto || "Excellence in Education"}</div></div>
            </div>
            <p className="text-sm text-white/70 leading-relaxed mb-4">{branding?.school_tagline || "Committed to nurturing young minds and building tomorrow's leaders through quality education."}</p>
            <div className="flex gap-2">
              {([
                { Icon: Facebook, href: branding?.school_facebook },
                { Icon: Twitter, href: branding?.school_twitter },
                { Icon: Instagram, href: branding?.school_instagram },
                { Icon: Youtube, href: branding?.school_youtube },
              ] as { Icon: typeof Facebook; href?: string }[]).map(({ Icon, href }, i) => (
                <a key={i} href={href || "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#c9a84c] flex items-center justify-center transition-colors"><Icon className="h-3.5 w-3.5" /></a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm" style={{ color: GOLD }}>Quick Links</h4>
            <ul className="space-y-2">
              {[{ l: "Home", h: "/" }, { l: "About School", h: "/about" }, { l: "Gallery", h: "/gallery" }, { l: "Downloads", h: "/downloads" }, { l: "Notice Board", h: "#notices" }, { l: "Contact", h: "#enquiry" }].map(({ l, h }) => (
                <li key={l}><button onClick={() => go(h)} className="text-sm text-white/60 hover:text-[#c9a84c] transition-colors flex items-center gap-1.5"><ArrowRight className="h-3 w-3" />{l}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm" style={{ color: GOLD }}>Portals</h4>
            <ul className="space-y-2">
              {[{ l: "Parent Login", h: "/parent/login" }, { l: "Teacher Login", h: "/teacher/login" }, { l: "Admin Panel", h: "/login" }, { l: "Student Roster", h: "/roster" }, { l: "Download Center", h: "/downloads" }].map(({ l, h }) => (
                <li key={l}><button onClick={() => go(h)} className="text-sm text-white/60 hover:text-[#c9a84c] transition-colors flex items-center gap-1.5"><ArrowRight className="h-3 w-3" />{l}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-sm flex items-center gap-2" style={{ color: GOLD }}>
              <MapPin className="h-4 w-4" /> Find Us
            </h4>
            {schoolInfo?.mapsUrl ? (
              <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 200 }}>
                <iframe
                  title="School Location"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "grayscale(20%) contrast(1.05)" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={schoolInfo.mapsUrl}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 flex flex-col items-center justify-center gap-3 text-center px-4" style={{ height: 200 }}>
                <MapPin className="h-8 w-8 opacity-30" style={{ color: GOLD }} />
                {schoolInfo?.address ? (
                  <>
                    <p className="text-sm text-white/50 leading-snug">{schoolInfo.address}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schoolInfo.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors hover:bg-white/10"
                      style={{ borderColor: GOLD, color: GOLD }}
                    >
                      Open in Google Maps ↗
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-white/25">Set your Maps embed URL in Admin → Settings</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© {new Date().getFullYear()} {schoolInfo?.schoolName || "School Management System"}. All rights reserved.</p>
          <p>Designed with ❤️ for Excellence in Education</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: schoolInfo } = useQuery<SchoolInfo>({ queryKey: ["schoolInfo"], queryFn: () => fetch("/api/settings/school-info").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: branding } = useQuery<Branding>({ queryKey: ["websiteBranding"], queryFn: () => fetch("/api/website/branding").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: notices = [] } = useQuery<Notice[]>({ queryKey: ["websiteNews"], queryFn: () => fetch("/api/website/news").then(r => r.json()), staleTime: 2 * 60 * 1000 });
  const { data: slides = [] } = useQuery<Slide[]>({ queryKey: ["websiteSlider"], queryFn: () => fetch("/api/website/slider").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: stats } = useQuery<Stats>({ queryKey: ["websiteStats"], queryFn: () => fetch("/api/website/stats").then(r => r.json()), staleTime: 10 * 60 * 1000 });
  const { data: toppers = [] } = useQuery<Topper[]>({ queryKey: ["websiteToppers"], queryFn: () => fetch("/api/website/toppers").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: albums = [] } = useQuery<GalleryAlbum[]>({ queryKey: ["websiteGallery"], queryFn: () => fetch("/api/website/gallery/albums").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: testimonials = [] } = useQuery<Testimonial[]>({ queryKey: ["websiteTestimonials"], queryFn: () => fetch("/api/website/testimonials").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: featuredDls = [] } = useQuery<DownloadItem[]>({ queryKey: ["websiteFeaturedDls"], queryFn: () => fetch("/api/website/downloads?featured=true").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  // Fetch the live current academic session — short staleTime so it reflects
  // admin changes quickly without a page reload.
  const { data: sessionStatus } = useQuery<{ currentSession?: { name: string } | null }>({
    queryKey: ["academicSessionStatus"],
    queryFn: () => fetch("/api/academic-sessions/status").then(r => r.json()),
    staleTime: 60 * 1000,
  });
  const currentSession = sessionStatus?.currentSession?.name ?? undefined;

  // Merge branding into schoolInfo shape for backward compat
  const merged: SchoolInfo | undefined = schoolInfo ? {
    ...schoolInfo,
    schoolName: branding?.school_name || schoolInfo.schoolName,
    logoUrl: branding?.school_logo_url || schoolInfo.logoUrl,
    address: branding?.school_address || schoolInfo.address,
    contactNumber: branding?.school_contact_number || schoolInfo.contactNumber,
    schoolGmail: branding?.school_email || schoolInfo.schoolGmail,
  } : undefined;

  return (
    <div className="min-h-screen">
      <AnnouncementBar notices={notices} currentSession={currentSession} />
      <NavBar schoolInfo={merged} branding={branding} />
      <main>
        <HeroSlider slides={slides} branding={branding} currentSession={currentSession} />
        <QuickAccessSection />
        <StatsSection stats={stats} branding={branding} />
        <AboutSection schoolInfo={merged} branding={branding} />
        <NoticeBoardSection notices={notices} />
        <ToppersSection toppers={toppers} />
        <BirthdaysSection />
        <GallerySection albums={albums} />
        <TestimonialsSection testimonials={testimonials} />
        {featuredDls.length > 0 && <DownloadsPreview downloads={featuredDls} />}
        <AdmissionBanner currentSession={currentSession} />
        <ServicesSection />
        <EnquirySection schoolInfo={merged} branding={branding} currentSession={currentSession} />
      </main>
      <Footer schoolInfo={merged} branding={branding} />
    </div>
  );
}
