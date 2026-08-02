import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Phone, Mail, MapPin, Facebook, Twitter, Instagram, Youtube,
  Menu, X, Send, User, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

interface SchoolInfo { schoolName: string; address: string; contactNumber: string; logoUrl: string; schoolGmail: string; }
interface Branding {
  school_name: string; school_logo_url: string; school_motto: string; school_tagline: string;
  school_address: string; school_contact_number: string; school_email: string; school_website: string;
  school_facebook: string; school_twitter: string; school_instagram: string; school_youtube: string;
  school_whatsapp?: string;
}
interface ContactPerson { id: number; name: string; designation: string; phone: string; email: string; photoUrl: string; displayOrder: number; }

function NavBar({ schoolInfo, branding }: { schoolInfo: SchoolInfo | undefined; branding?: Branding }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [, setLocation] = useLocation();
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const go = (href: string) => { setMenuOpen(false); setLocation(href); };
  const navLinks = [
    { l: "Home", h: "/" }, { l: "About", h: "/about" }, { l: "Admission", h: "/admission" },
    { l: "Academics", h: "/academics" }, { l: "Gallery", h: "/gallery" },
    { l: "Downloads", h: "/downloads" }, { l: "Contact", h: "/contact" }
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
            {[
              { Icon: Facebook, href: branding?.school_facebook },
              { Icon: Twitter, href: branding?.school_twitter },
              { Icon: Instagram, href: branding?.school_instagram },
              { Icon: Youtube, href: branding?.school_youtube },
            ].map(({ Icon, href }, i) => (
              <a key={i} href={href || "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer" className="hover:text-[#f97316] transition-colors"><Icon className="h-3.5 w-3.5" /></a>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => go("/")}>
            {schoolInfo?.logoUrl ? <img src={schoolInfo.logoUrl} alt="Logo" className="h-11 w-11 rounded-full object-cover border-2" style={{ borderColor: GOLD }} /> : (
              <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>{schoolInfo?.schoolName?.[0] ?? "S"}</div>
            )}
            <div className="hidden sm:block">
              <div className="font-bold text-base leading-tight" style={{ color: NAVY }}>{schoolInfo?.schoolName || "School"}</div>
              <div className="text-xs text-gray-500">{branding?.school_motto || "Excellence in Education"}</div>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map(({ l, h }) => (
              <button key={l} onClick={() => go(h)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${l === "Contact" ? "bg-blue-50 text-[#1e3a6e]" : "text-gray-700 hover:text-[#1e3a6e] hover:bg-blue-50"}`}>
                {l}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => go("/login")} className="text-white font-semibold text-xs shadow-md hidden sm:flex" style={{ backgroundColor: GOLD }}>Login</Button>
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
            {navLinks.map(({ l, h }) => <button key={l} onClick={() => go(h)} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#1e3a6e] rounded-lg transition-colors">{l}</button>)}
          </div>
        </motion.div>
      )}
    </header>
  );
}

export default function ContactPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: schoolInfo } = useQuery<SchoolInfo>({ queryKey: ["schoolInfo"], queryFn: () => fetch("/api/settings/school-info").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: branding } = useQuery<Branding>({ queryKey: ["websiteBranding"], queryFn: () => fetch("/api/website/branding").then(r => r.json()), staleTime: 5 * 60 * 1000 });
  const { data: contacts = [] } = useQuery<ContactPerson[]>({ queryKey: ["websiteContacts"], queryFn: () => fetch("/api/website/contacts").then(r => r.json()), staleTime: 5 * 60 * 1000 });

  const merged = schoolInfo ? {
    ...schoolInfo,
    schoolName: branding?.school_name || schoolInfo.schoolName,
    logoUrl: branding?.school_logo_url || schoolInfo.logoUrl,
    address: branding?.school_address || schoolInfo.address,
    contactNumber: branding?.school_contact_number || schoolInfo.contactNumber,
    schoolGmail: branding?.school_email || schoolInfo.schoolGmail,
  } : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { toast({ title: "Name and phone are required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/website/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, phone: form.phone, email: form.email, message: `[${form.subject}] ${form.message}` }) });
      if (res.ok) { setSubmitted(true); toast({ title: "Message sent! We'll reply within 24 hours." }); setForm({ name: "", phone: "", email: "", subject: "", message: "" }); }
      else toast({ title: "Submission failed. Please try again.", variant: "destructive" });
    } catch { toast({ title: "Network error. Please try again.", variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const socials = [
    { icon: "whatsapp", href: branding?.school_whatsapp ? `https://wa.me/${branding.school_whatsapp.replace(/\D/g, "")}` : branding?.school_contact_number ? `https://wa.me/${branding.school_contact_number.replace(/\D/g, "")}` : "#", label: "WhatsApp", color: "bg-green-500 hover:bg-green-600" },
    { icon: "facebook", href: branding?.school_facebook || "#", label: "Facebook", color: "bg-blue-600 hover:bg-blue-700" },
    { icon: "instagram", href: branding?.school_instagram || "#", label: "Instagram", color: "bg-pink-500 hover:bg-pink-600" },
    { icon: "twitter", href: branding?.school_twitter || "#", label: "Twitter", color: "bg-sky-500 hover:bg-sky-600" },
    { icon: "youtube", href: branding?.school_youtube || "#", label: "YouTube", color: "bg-red-500 hover:bg-red-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar schoolInfo={merged} branding={branding} />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => window.location.href = "/"} className="hover:text-[#1e3a6e] transition-colors">Home</button>
          <span>→</span>
          <span className="font-medium text-gray-700">Contact Us</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* Quick Contacts */}
        {contacts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-0.5 w-8" style={{ backgroundColor: NAVY }} />
              <h2 className="text-xl font-bold text-gray-900">
                Quick <span className="px-3 py-0.5 rounded text-white" style={{ backgroundColor: NAVY }}>Contacts</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {contacts.map((person, i) => (
                <motion.div key={person.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="shrink-0">
                    {person.photoUrl ? (
                      <img src={person.photoUrl} alt={person.name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-gray-200" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>
                        {person.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 text-sm uppercase tracking-wide">{person.name}</div>
                    <div className="text-xs text-gray-500 mb-2 italic">{person.designation}</div>
                    {person.phone && (
                      <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#1e3a6e] transition-colors mb-1">
                        <Phone className="h-3 w-3 shrink-0" style={{ color: NAVY }} />{person.phone}
                      </a>
                    )}
                    {person.email && (
                      <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#1e3a6e] transition-colors">
                        <Mail className="h-3 w-3 shrink-0" style={{ color: NAVY }} />{person.email}
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Send Us A Message */}
        <div>
          <div className="flex items-center justify-end gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Send Us A <span className="px-3 py-0.5 rounded text-white" style={{ backgroundColor: NAVY }}>Message</span>
            </h2>
            <div className="h-0.5 w-8" style={{ backgroundColor: NAVY }} />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-5">
              {/* Left contact info */}
              <div className="md:col-span-2 p-6 space-y-6 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100">
                <p className="text-sm text-gray-500 leading-relaxed">
                  If you have any queries or suggestions related to our school or management, please do not hesitate to send us a message. We will reply within 24 hours.
                </p>
                <div className="space-y-4">
                  {merged?.address && (
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${NAVY}15` }}>
                        <MapPin className="h-5 w-5" style={{ color: NAVY }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-700">Address</div>
                        <div className="text-xs text-gray-500 mt-0.5">{merged.address}</div>
                      </div>
                    </div>
                  )}
                  {merged?.contactNumber && (
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${NAVY}15` }}>
                        <Phone className="h-5 w-5" style={{ color: NAVY }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-700">Phone</div>
                        <a href={`tel:${merged.contactNumber}`} className="text-xs text-gray-500 hover:text-[#1e3a6e] mt-0.5 block">{merged.contactNumber}</a>
                      </div>
                    </div>
                  )}
                  {merged?.schoolGmail && (
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${NAVY}15` }}>
                        <Mail className="h-5 w-5" style={{ color: NAVY }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-700">Email</div>
                        <a href={`mailto:${merged.schoolGmail}`} className="text-xs text-gray-500 hover:text-[#1e3a6e] mt-0.5 block">{merged.schoolGmail}</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right form */}
              <div className="md:col-span-3 p-6">
                {submitted ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="font-bold text-green-800 text-lg mb-2">Message Sent!</h3>
                    <p className="text-green-700 text-sm mb-4">Thank you for reaching out. Our team will contact you within 24 hours.</p>
                    <Button variant="outline" onClick={() => setSubmitted(false)}>Send Another</Button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-3">
                    <Input placeholder="Enter your name" value={form.name} onChange={upd("name")} required className="bg-gray-50 border-gray-200" />
                    <Input placeholder="Enter your 10 digit mobile number" value={form.phone} onChange={upd("phone")} required className="bg-gray-50 border-gray-200" />
                    <Input type="email" placeholder="Enter your email" value={form.email} onChange={upd("email")} className="bg-gray-50 border-gray-200" />
                    <Input placeholder="Subject" value={form.subject} onChange={upd("subject")} className="bg-gray-50 border-gray-200" />
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 h-28"
                      placeholder="Enter your message"
                      value={form.message}
                      onChange={upd("message")}
                    />
                    <Button type="submit" disabled={submitting} className="px-8 font-semibold text-white" style={{ backgroundColor: NAVY }}>
                      {submitting ? "Sending…" : "Send Now"}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Social Media */}
        <div className="flex justify-center gap-3 pb-4">
          {socials.map(({ icon, href, label, color }) => {
            const icons: Record<string, typeof Facebook> = { facebook: Facebook, twitter: Twitter, instagram: Instagram, youtube: Youtube, whatsapp: Phone };
            const Icon = icons[icon] || Phone;
            return (
              <a key={icon} href={href} target={href !== "#" ? "_blank" : undefined} rel="noopener noreferrer"
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 ${color}`}
                title={label}>
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      </div>

      <footer style={{ backgroundColor: DARK }} className="text-white py-6 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-white/70 mb-1">
            {merged?.schoolName || "School"} | {merged?.address || "Address"}
          </p>
          {merged?.schoolGmail && <p className="text-xs text-white/50">Email: {merged.schoolGmail}</p>}
          <p className="text-xs text-white/40 mt-3">© {new Date().getFullYear()} Copyright – All Rights Reserved &nbsp;·&nbsp; {merged?.schoolName || "School"}</p>
        </div>
      </footer>
    </div>
  );
}
