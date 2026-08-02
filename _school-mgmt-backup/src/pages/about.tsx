import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Phone, Mail, MapPin, Globe, GraduationCap, Calendar, Award,
  BookOpen, Target, Eye, Menu, X, ChevronDown, LayoutDashboard,
  User, UserCircle, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

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
  school_affiliation: string;
  school_vision: string;
  school_mission: string;
  school_facebook: string;
  school_twitter: string;
  school_instagram: string;
  school_youtube: string;
  school_short_name: string;
}

function TeacherIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function NavBar({ branding }: { branding?: Branding }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, setLocation] = useLocation();
  const go = (href: string) => { setMenuOpen(false); setLocation(href); };
  useEffect(() => { const h = () => setScrolled(window.scrollY > 50); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);

  const navLinks = [
    { l: "Home", h: "/" }, { l: "About", h: "/about" }, { l: "Admission", h: "/admission" },
    { l: "Gallery", h: "/gallery" }, { l: "Downloads", h: "/downloads" }, { l: "Contact", h: "/contact" },
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-300 ${scrolled ? "shadow-xl" : "shadow-sm"} border-b border-gray-100`}>
      <div style={{ backgroundColor: NAVY }} className="text-white hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            {branding?.school_contact_number && <a href={`tel:${branding.school_contact_number}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Phone className="h-3 w-3" />{branding.school_contact_number}</a>}
            {branding?.school_email && <a href={`mailto:${branding.school_email}`} className="flex items-center gap-1.5 hover:text-[#f97316] transition-colors"><Mail className="h-3 w-3" />{branding.school_email}</a>}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => go("/")}>
            {branding?.school_logo_url ? (
              <img src={branding.school_logo_url} alt="Logo" className="h-11 w-11 rounded-full object-cover border-2" style={{ borderColor: GOLD }} />
            ) : (
              <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>
                {branding?.school_name?.[0] ?? "S"}
              </div>
            )}
            <div className="hidden sm:block">
              <div className="font-bold text-base leading-tight" style={{ color: NAVY }}>{branding?.school_name || "School Management System"}</div>
              <div className="text-xs text-gray-500">{branding?.school_motto || "Excellence in Education"}</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(({ l, h }) => (
              <button key={l} onClick={() => go(h)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${l === "About" ? "text-[#1e3a6e] bg-blue-50" : "text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50"}`}>
                {l}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => go("/login")} className="text-white font-semibold text-xs hover:opacity-90 shadow-md hidden lg:flex" style={{ backgroundColor: GOLD }}>
              Login
            </Button>
            <button className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="lg:hidden border-t border-gray-100 bg-white shadow-lg overflow-hidden">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(({ l, h }) => (
                <button key={l} onClick={() => go(h)}
                  className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-colors ${l === "About" ? "text-[#1e3a6e] bg-blue-50 font-semibold" : "text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e]"}`}>
                  {l}
                </button>
              ))}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Login As</p>
                {[
                  { label: "Admin Panel", icon: LayoutDashboard, href: "/login", color: "text-[#1e3a6e]", bg: "hover:bg-blue-50" },
                  { label: "Teacher Panel", icon: TeacherIcon as any, href: "/login?role=teacher", color: "text-emerald-700", bg: "hover:bg-emerald-50" },
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

function InfoRow({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  if (!value) return null;
  const content = (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${NAVY}12` }}>
        <Icon className="h-4 w-4" style={{ color: NAVY }} />
      </div>
      <div>
        <div className="text-xs text-gray-500 font-medium mb-0.5">{label}</div>
        <div className="text-sm font-semibold text-gray-800">{value}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-blue-50/50 rounded-lg px-1 -mx-1 transition-colors">{content}</a>;
  return <div className="px-1 -mx-1">{content}</div>;
}

export default function AboutPage() {
  const [, setLocation] = useLocation();
  const { data: branding, isLoading, isError } = useQuery<Branding>({
    queryKey: ["websiteBranding"],
    queryFn: () => fetch("/api/website/branding").then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  const name = branding?.school_name;
  const logo = branding?.school_logo_url;
  const address = branding?.school_address;
  const phone = branding?.school_contact_number;
  const email = branding?.school_email;
  const website = branding?.school_website;
  const principal = branding?.school_principal_name;
  const established = branding?.school_established;
  const affiliation = branding?.school_affiliation;
  const motto = branding?.school_motto;
  const vision = branding?.school_vision;
  const mission = branding?.school_mission;

  const hasContactInfo = !!(address || phone || email || website);
  const hasSchoolDetails = !!(established || affiliation || motto || principal);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <NavBar branding={branding} />

      {/* Hero Banner */}
      <div className="py-14 px-4 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent)` }} />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent)` }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          {logo ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              src={logo}
              alt={name || "School Logo"}
              className="h-24 w-24 rounded-full object-cover mx-auto mb-5 border-4 shadow-xl"
              style={{ borderColor: GOLD }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : !isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl font-bold shadow-xl border-4"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e65c00)`, borderColor: GOLD, color: DARK }}
            >
              {name?.[0] ?? "S"}
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px w-10" style={{ backgroundColor: GOLD }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>About Us</span>
              <div className="h-px w-10" style={{ backgroundColor: GOLD }} />
            </div>
            {isLoading ? (
              <div className="h-10 w-72 bg-white/10 rounded-xl mx-auto animate-pulse mb-2" />
            ) : (
              <h1 className="text-3xl md:text-5xl font-bold mb-3">
                {name || "Our School"}
              </h1>
            )}
            {motto && <p className="text-lg md:text-xl text-white/80 italic">"{motto}"</p>}
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-3/4 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="text-red-400 mb-2"><ShieldCheck className="h-10 w-10 mx-auto" /></div>
            <p className="text-red-700 font-semibold">Unable to load school information</p>
            <p className="text-sm text-red-500 mt-1">Please try refreshing the page.</p>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* School Details */}
            {hasSchoolDetails && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: NAVY }}>
                  <Award className="h-5 w-5" style={{ color: GOLD }} /> School Details
                </h2>
                <div className="divide-y divide-gray-100">
                  <InfoRow icon={Calendar} label="Establishment Year" value={established || ""} />
                  <InfoRow icon={GraduationCap} label="Affiliation / Board" value={affiliation || ""} />
                  <InfoRow icon={BookOpen} label="School Motto" value={motto || ""} />
                  <InfoRow icon={UserCircle} label="Principal" value={principal || ""} />
                </div>
              </motion.div>
            )}

            {/* Contact Information */}
            {hasContactInfo && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: NAVY }}>
                  <Phone className="h-5 w-5" style={{ color: GOLD }} /> Contact Information
                </h2>
                <div className="divide-y divide-gray-100">
                  <InfoRow icon={MapPin} label="Address" value={address || ""} />
                  <InfoRow icon={Phone} label="Phone Number" value={phone || ""} href={phone ? `tel:${phone}` : undefined} />
                  <InfoRow icon={Mail} label="Email Address" value={email || ""} href={email ? `mailto:${email}` : undefined} />
                  <InfoRow icon={Globe} label="Website" value={website || ""} href={website || undefined} />
                </div>
              </motion.div>
            )}

            {/* Vision */}
            {vision && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="rounded-2xl p-6 border-l-4 shadow-sm" style={{ backgroundColor: `${NAVY}08`, borderColor: NAVY }}>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                  <Eye className="h-5 w-5" style={{ color: GOLD }} /> Our Vision
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{vision}</p>
              </motion.div>
            )}

            {/* Mission */}
            {mission && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="rounded-2xl p-6 border-l-4 shadow-sm" style={{ backgroundColor: `${GOLD}0D`, borderColor: GOLD }}>
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: NAVY }}>
                  <Target className="h-5 w-5" style={{ color: GOLD }} /> Our Mission
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{mission}</p>
              </motion.div>
            )}

            {/* Empty state */}
            {!hasSchoolDetails && !hasContactInfo && !vision && !mission && (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">School information is being set up.</p>
                <p className="text-sm text-gray-400 mt-1">Please check back soon or contact the administrator.</p>
              </div>
            )}
          </>
        )}

        {/* Back to Home */}
        <div className="flex justify-center pt-2">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:text-[#1e3a6e] hover:border-blue-200 transition-all shadow-sm" style={{ color: NAVY }}>
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>
        </div>
      </div>

      {/* Footer strip */}
      <div className="py-6 px-4 mt-4 text-center text-xs text-white/60" style={{ backgroundColor: DARK }}>
        <p>© {new Date().getFullYear()} {name || "School Management System"}. All rights reserved.</p>
      </div>
    </div>
  );
}
