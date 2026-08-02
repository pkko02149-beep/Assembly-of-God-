import { useState, useRef, useEffect } from "react";
import { useListStudents, useListClasses, useListVehicles } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer, CreditCard, Users, Filter, Upload, X, Settings, ExternalLink,
  GraduationCap, Hash, Calendar, Phone, Mail, MapPin, Bus, Globe,
  AlertCircle, Info, ShieldAlert, FileText,
} from "lucide-react";

/* ─── PALETTE ─────────────────────────────────────────────────────────── */
const NAVY  = "#1a2b6b";
const NAVY2 = "#243580";
const GOLD  = "#c49a1a";

/* ─── HELPERS ─────────────────────────────────────────────────────────── */
async function compressImage(file: File, maxPx = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = url;
  });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}
function getScanUrl(uid: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/scan?id=${encodeURIComponent(uid)}`;
}

/* ─── TYPES ───────────────────────────────────────────────────────────── */
interface SchoolInfo {
  schoolName: string; schoolMotto: string; logoUrl: string;
  schoolAddress: string; schoolPhone: string; schoolEmail: string; schoolWebsite: string;
}
interface CardSettings {
  session: string; issueDate: string; validUntil: string;
  principalSig: string; instructions: string;
}

/* ─── SVG EMBEDS ──────────────────────────────────────────────────────── */
function SchoolCrest({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain" }}/>;
  }
  return (
    <svg viewBox="0 0 80 80" style={{ width:"100%", height:"100%" }}>
      <path d="M40 4 L72 16 L72 44 C72 62 40 76 40 76 C40 76 8 62 8 44 L8 16 Z"
        fill="none" stroke={GOLD} strokeWidth="3"/>
      <path d="M40 4 L72 16 L72 44 C72 62 40 76 40 76 C40 76 8 62 8 44 L8 16 Z"
        fill="rgba(196,154,26,0.08)"/>
      <path d="M40 18 L40 62" stroke={GOLD} strokeWidth="1.5" strokeDasharray="3 2"/>
      <path d="M22 36 L58 36" stroke={GOLD} strokeWidth="1.5"/>
      <circle cx="40" cy="36" r="8" fill="none" stroke={GOLD} strokeWidth="1.5"/>
      <path d="M36 36 L44 36 M40 32 L40 40" stroke={GOLD} strokeWidth="1.5"/>
      <circle cx="40" cy="20" r="4" fill="none" stroke={GOLD} strokeWidth="1.5"/>
      <path d="M38 18 L40 16 L42 18" stroke={GOLD} strokeWidth="1" fill="none"/>
      <path d="M20 50 Q40 58 60 50" stroke={GOLD} strokeWidth="1" fill="none" strokeDasharray="2 2"/>
    </svg>
  );
}

function QRCodeSVG({ value }: { value: string }) {
  /* deterministic simple QR-like pattern from value hash */
  const hash = Array.from(value).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const cells: boolean[] = Array(49).fill(false).map((_, i) => ((hash >> (i % 32)) & 1) === 1);
  return (
    <svg viewBox="0 0 60 60" style={{ width:"100%", height:"100%" }}>
      {/* fixed position markers */}
      <rect x="2" y="2" width="22" height="22" rx="2" fill="none" stroke={NAVY} strokeWidth="2.5"/>
      <rect x="7" y="7" width="12" height="12" rx="1" fill={NAVY}/>
      <rect x="36" y="2" width="22" height="22" rx="2" fill="none" stroke={NAVY} strokeWidth="2.5"/>
      <rect x="41" y="7" width="12" height="12" rx="1" fill={NAVY}/>
      <rect x="2" y="36" width="22" height="22" rx="2" fill="none" stroke={NAVY} strokeWidth="2.5"/>
      <rect x="7" y="41" width="12" height="12" rx="1" fill={NAVY}/>
      {/* data cells */}
      {cells.map((on, i) => on && (
        <rect key={i} x={36 + (i % 7) * 4} y={36 + Math.floor(i / 7) * 4}
          width="3" height="3" fill={NAVY}/>
      ))}
    </svg>
  );
}

function BarcodeStrip({ text }: { text: string }) {
  const bars = [3,1,2,1,3,1,1,2,1,2,1,1,3,1,2,1,1,2,3,1,1,2,1,3,1,1,2,1];
  const mod = text.length % 3;
  return (
    <div style={{ display:"flex", alignItems:"stretch", height:"100%", gap:"1px" }}>
      {bars.map((w, i) => (
        <div key={i} style={{
          background: NAVY, height:"100%", width:`${w * 2.5}px`,
          opacity: (i + mod) % 2 === 0 ? 1 : 0,
        }}/>
      ))}
    </div>
  );
}

/* ─── CARD IFRAME PREVIEW ─────────────────────────────────────────────── */
// One renderer for both preview and print → always identical.
const PREVIEW_SCALE = 1.55;
const CR80_W = Math.round(53.98 * 3.7795); // 204 px at 96 dpi
const CR80_H = Math.round(85.60 * 3.7795); // 323 px at 96 dpi

function CardIframe({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"/>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}${PRINT_CSS}</style>
    </head><body>${html}</body></html>`);
    doc.close();
  }, [html]);
  return (
    <div style={{ width:Math.round(CR80_W*PREVIEW_SCALE), height:Math.round(CR80_H*PREVIEW_SCALE),
      overflow:"hidden", borderRadius:10, flexShrink:0,
      boxShadow:"0 8px 32px rgba(26,43,107,0.22)" }}>
      <iframe ref={iframeRef} scrolling="no"
        style={{ width:CR80_W, height:CR80_H, border:"none", display:"block",
          transform:`scale(${PREVIEW_SCALE})`, transformOrigin:"0 0" }}/>
    </div>
  );
}

/* ─── FRONT CARD ──────────────────────────────────────────────────────── */
function FrontCard({ s, school, card }: { s: Record<string,any>; school: SchoolInfo; card: CardSettings }) {
  const scanUrl = getScanUrl(s.uniqueId || "preview");

  const infoRows = [
    { icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
      ), label:"Class & Section", value:`${s.className??""} – ${s.sectionName??""}` },
    { icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
          <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
        </svg>
      ), label:"Roll No.", value:String(s.rollNo??"—") },
    { icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ), label:"Enroll No.", value:s.uniqueId??"—" },
    { icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ), label:"Date of Birth", value:fmtDate(s.dateOfBirth) || "—" },
  ];

  return (
    <div style={{ width:320, height:508, background:"#fff", borderRadius:16, overflow:"hidden",
      display:"flex", flexDirection:"column", boxShadow:"0 8px 32px rgba(26,43,107,0.2)",
      border:"1px solid #e2e8f0", fontFamily:"'Poppins','Segoe UI',Arial,sans-serif" }}>

      {/* ── HEADER ── navy gradient with crest left + school name right next to it */}
      <div style={{ position:"relative", display:"flex", flexDirection:"row", alignItems:"center",
        justifyContent:"flex-start",
        paddingTop:10, paddingBottom:8, paddingLeft:16, paddingRight:16,
        overflow:"hidden", background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 60%,#1e3a8a 100%)`,
        flexShrink:0 }}>
        <div style={{ position:"absolute", right:0, top:0, height:"100%", width:80,
          background:`linear-gradient(135deg,transparent 40%,${GOLD} 100%)`, opacity:.1 }}/>
        {/* Left: logo crest */}
        <div style={{ width:46, height:46, position:"relative", zIndex:1, flexShrink:0 }}>
          <SchoolCrest logoUrl={school.logoUrl}/>
        </div>
        {/* Right: school text — name left-anchored, divider+motto centred */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", position:"relative", zIndex:1, paddingLeft:10 }}>
          <h2 style={{ fontWeight:900, color:"#fff", fontSize:"1.08rem", letterSpacing:"0.06em",
            margin:0, textAlign:"left", textTransform:"uppercase", lineHeight:1 }}>
            {school.schoolName || "ASSEMBLY OF GOD"}
          </h2>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
            <div style={{ height:1, width:20, background:GOLD }}/>
            <span style={{ fontWeight:700, fontSize:"0.65rem", letterSpacing:"0.15em", color:GOLD }}>SCHOOL</span>
            <div style={{ height:1, width:20, background:GOLD }}/>
          </div>
          <p style={{ fontSize:"0.5rem", letterSpacing:"0.15em", margin:"2px 0 0",
            color:"rgba(255,255,255,0.65)" }}>
            {school.schoolMotto || "LEARN · GROW · SERVE"}
          </p>
        </div>
      </div>

      {/* ── PHOTO + NAME ── side by side */}
      <div style={{ display:"flex", alignItems:"center", gap:12,
        paddingTop:12, paddingBottom:8, paddingLeft:16, paddingRight:16, flexShrink:0 }}>
        <div style={{ width:88, height:108, borderRadius:12, overflow:"hidden",
          border:`2.5px solid ${NAVY}`, boxShadow:"0 4px 14px rgba(26,43,107,0.15)",
          background:"#dbeafe", flexShrink:0 }}>
          {s.photoUrl
            ? <img src={s.photoUrl} alt="Student"
                style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }}/>
            : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center",
                justifyContent:"center", background:"#dbeafe" }}>
                <svg viewBox="0 0 80 100" width="60" height="75">
                  <ellipse cx="40" cy="32" rx="20" ry="22" fill="#93c5fd"/>
                  <path d="M5 100 Q5 65 40 65 Q75 65 75 100Z" fill="#93c5fd"/>
                </svg>
              </div>
          }
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, flex:1 }}>
          <div style={{ display:"flex", flexDirection:"column" }}>
            <h3 style={{ fontWeight:900, color:NAVY, fontSize:"1.15rem", lineHeight:1.1,
              margin:0, textTransform:"uppercase" }}>
              {(s.studentName||"STUDENT NAME").split(" ")[0]}<br/>
              {(s.studentName||"").split(" ").slice(1).join(" ")}
            </h3>
            <span style={{ marginTop:8, fontSize:"0.6rem", fontWeight:700, padding:"4px 12px",
              borderRadius:6, textTransform:"uppercase", letterSpacing:"0.1em", color:"#fff",
              background:NAVY, display:"inline-block", width:"fit-content" }}>Student</span>
          </div>
          <span style={{ fontSize:"0.42rem", fontWeight:600, color:NAVY,
            writingMode:"vertical-rl" as const, textOrientation:"mixed" as const,
            transform:"rotate(180deg)", letterSpacing:"0.12em",
            whiteSpace:"nowrap", marginLeft:"auto", paddingRight:2, opacity:.7 }}>
            {card.session}
          </span>
        </div>
      </div>

      {/* ── INFO ROWS ── */}
      <div style={{ paddingLeft:16, paddingRight:16, flexShrink:0 }}>
        {infoRows.map((row, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px",
            borderRadius:8, marginBottom:2, background:i%2===0?"#f8faff":"transparent" }}>
            <div style={{ width:20, height:20, borderRadius:"50%", display:"flex",
              alignItems:"center", justifyContent:"center", background:GOLD, color:"#fff", flexShrink:0 }}>
              {row.icon}
            </div>
            <span style={{ flex:1, fontSize:"0.63rem", fontWeight:600, color:"#4a5568" }}>{row.label}</span>
            <span style={{ fontSize:"0.66rem", fontWeight:900, color:NAVY }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* ── QR + SIGNATURE ── */}
      <div style={{ margin:"8px 16px 0", flexShrink:0 }}>
        <div style={{ borderRadius:12, padding:"6px 12px", display:"flex",
          alignItems:"center", justifyContent:"space-between", gap:8,
          background:"#f8faff", border:"1px solid #e2e8f0" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:36, height:36 }}>
              <QRCodeSVG value={scanUrl}/>
            </div>
            <span style={{ fontSize:"0.38rem", fontWeight:700, marginTop:2,
              color:NAVY, letterSpacing:1 }}>SCAN TO VERIFY</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
            {card.principalSig
              ? <img src={card.principalSig} alt="sig"
                  style={{ height:32, maxWidth:112, objectFit:"contain",
                    borderBottom:`1px solid #c0c8dc`, paddingBottom:2 }}/>
              : <span style={{ fontFamily:"'Brush Script MT',cursive", fontSize:"1.2rem",
                  color:NAVY, borderBottom:"1px solid #c0c8dc", paddingBottom:2,
                  width:112, textAlign:"center" }}>Principal</span>
            }
            <span style={{ fontSize:"0.42rem", fontWeight:700, letterSpacing:"0.12em",
              marginTop:4, textTransform:"uppercase", color:NAVY }}>Principal</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── two-column layout matching reference design */}
      <div style={{ padding:"8px 14px", display:"flex", flexDirection:"row", alignItems:"stretch",
        marginTop:"auto", flexShrink:0,
        background:`linear-gradient(135deg,${NAVY} 0%,#1a2f7a 60%,#1e3a8a 100%)` }}>
        {/* Left: address */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:6, flex:"0 0 55%", paddingRight:10 }}>
          <MapPin size={10} style={{ color:"#fff", marginTop:2, flexShrink:0 }}/>
          <span style={{ fontSize:"0.5rem", color:"#fff", lineHeight:1.5, fontWeight:700 }}>
            {school.schoolAddress || "45 Education Lane, Greenfield City, Springfield, CA 90210"}
          </span>
        </div>
        {/* Vertical divider */}
        <div style={{ width:1, background:"rgba(255,255,255,0.35)", flexShrink:0, margin:"2px 0" }}/>
        {/* Right: email + phone */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:5, paddingLeft:10, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Mail size={8} style={{ color:"#fff", flexShrink:0 }}/>
            <span style={{ fontSize:"0.48rem", color:"#fff", fontWeight:700 }}>
              {school.schoolEmail || "info@aogschool.edu"}
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <Phone size={8} style={{ color:"#fff", flexShrink:0 }}/>
            <span style={{ fontSize:"0.48rem", color:"#fff", fontWeight:700 }}>
              {school.schoolPhone || "+1 555 123 4567"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── BACK CARD ───────────────────────────────────────────────────────── */
function BackCard({ s, school, card }: { s: Record<string,any>; school: SchoolInfo; card: CardSettings }) {
  const cardId = s.enrollmentNo || s.uniqueId || "GIS2024-0156";

  const contactRows = [
    { label:"Father's Name",  value:s.fatherName       || "—" },
    { label:"Mother's Name",  value:s.motherName        || "—" },
    { label:"Parent Mobile",  value:s.whatsappNumber    || "—" },
    { label:"Alt. Contact",   value:s.emergencyContact  || "—" },
    { label:"Gmail",          value:s.parentEmail       || "—" },
    { label:"Home Address",   value:s.address           || "—" },
  ];
  const infoGrid = [
    { label:"Transport Route", value:s.vehicleName            || "—" },
    { label:"Bus No.",         value:s.vehicleName ? `Bus No. ${s.vehicleName}` : "—" },
    { label:"Blood Group",     value:s.bloodGroup             || "—",  highlight:true },
    { label:"Aadhar No.",       value:s.aadharNumber            || "—" },
    { label:"Issue Date",      value:card.issueDate },
    { label:"Valid Until",     value:card.validUntil },
  ];
  const instrLines = (card.instructions ||
    "This card must be carried every day.\nThis card is valid only for the academic session mentioned on the front.\nLoss of this card should be immediately reported to the school office.\nIf found, please return to the school address."
  ).split("\n").filter(Boolean);

  const sectStyle: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
    borderRadius:8, background:`linear-gradient(90deg,${NAVY} 0%,${NAVY2} 100%)`,
  };

  return (
    <div style={{ width:320, height:508, background:"#fff", borderRadius:16, overflow:"hidden",
      display:"flex", flexDirection:"column", boxShadow:"0 8px 32px rgba(26,43,107,0.2)",
      border:"1px solid #e2e8f0", fontFamily:"'Poppins','Segoe UI',Arial,sans-serif" }}>

      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, padding:12, overflow:"hidden" }}>

        {/* Emergency Contact */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <div style={sectStyle}>
            <AlertCircle size={11} style={{ color:GOLD }}/>
            <span style={{ fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", color:"#fff" }}>
              EMERGENCY CONTACT DETAILS
            </span>
          </div>
          <div style={{ paddingLeft:4, paddingRight:4 }}>
            {contactRows.map((r, i) => (
              <div key={i} style={{ display:"flex", fontSize:"0.62rem", gap:4, marginBottom:2 }}>
                <span style={{ width:88, flexShrink:0, fontWeight:600, color:NAVY }}>{r.label}:</span>
                <span style={{ flex:1, fontWeight:700, color:"#1f2937", lineHeight:1.3 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Information */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <div style={sectStyle}>
            <Info size={11} style={{ color:GOLD }}/>
            <span style={{ fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", color:"#fff" }}>
              STUDENT INFORMATION
            </span>
          </div>
          <div style={{ paddingLeft:4, paddingRight:4, display:"grid",
            gridTemplateColumns:"1fr 1fr", gap:"2px 8px" }}>
            {infoGrid.map((r, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column" }}>
                <span style={{ fontSize:"0.5rem", fontWeight:600, textTransform:"uppercase",
                  letterSpacing:"0.05em", color:NAVY }}>{r.label}</span>
                <span style={{ fontSize:"0.65rem", fontWeight:900, lineHeight:1.3,
                  color:r.highlight?"#dc2626":"#1f2937" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <div style={sectStyle}>
            <ShieldAlert size={11} style={{ color:GOLD }}/>
            <span style={{ fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", color:"#fff" }}>
              INSTRUCTIONS
            </span>
          </div>
          <ul style={{ paddingLeft:16, margin:0 }}>
            {instrLines.map((item, i) => (
              <li key={i} style={{ fontSize:"0.55rem", color:"#374151", lineHeight:1.5, marginBottom:1 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Building placeholder + Barcode */}
      <div style={{ padding:"0 12px 8px", display:"flex", alignItems:"flex-end",
        justifyContent:"space-between", gap:8 }}>
        {/* School building image */}
        <div style={{ width:170, height:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img
            src={`${import.meta.env.BASE_URL}school-building.png`}
            alt="School Building"
            style={{ width:"100%", height:"100%", objectFit:"contain" }}
          />
        </div>
        {/* Barcode */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
          <div style={{ height:32, width:112, overflow:"hidden" }}>
            <BarcodeStrip text={cardId}/>
          </div>
          <span style={{ fontSize:"0.55rem", fontWeight:700, marginTop:2,
            letterSpacing:"0.1em", color:NAVY }}>{cardId}</span>
        </div>
      </div>

      {/* Footer — website ONLY on back */}
      <div style={{ height:36, display:"flex", alignItems:"center", justifyContent:"center",
        gap:8, background:`linear-gradient(135deg,${NAVY} 0%,#1e3a8a 100%)` }}>
        <Globe size={12} style={{ color:GOLD }}/>
        <span style={{ fontSize:"0.65rem", fontWeight:600, letterSpacing:"0.05em", color:"#fff" }}>
          {school.schoolWebsite || "www.aogschool.edu"}
        </span>
      </div>
    </div>
  );
}

/* ─── PRINT CSS (CR80 = 53.98 × 85.60 mm) ────────────────────────────── */
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
@page { size:A4 portrait; margin:8mm; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Poppins',sans-serif; background:#fff;
  -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
.page-grid { display:grid; grid-template-columns:repeat(3,53.98mm); gap:4mm 5mm;
  justify-content:center; margin-bottom:10mm; }

/* card shell — max-height + overflow:hidden hard-clips content to card boundary */
.idc { width:53.98mm; height:85.60mm; max-height:85.60mm !important;
  font-family:'Poppins',sans-serif;
  background:#fff; border-radius:3.5mm; overflow:hidden !important;
  page-break-inside:avoid;
  box-shadow:0 .5mm 3mm rgba(0,0,0,.2); display:flex; flex-direction:column; }

/* ── FRONT ── */
.fc-hdr { display:flex; flex-direction:row; align-items:center;
  justify-content:flex-start;
  padding:1.5mm 3mm .8mm; flex-shrink:0;
  background:linear-gradient(135deg,#1a2b6b 0%,#243580 60%,#1e3a8a 100%); }
.fc-hdr-text { display:flex; flex-direction:column; align-items:center; padding-left:2mm; }
.fc-logo { width:13mm; height:13mm; flex-shrink:0; }
.fc-logo img { width:100%; height:100%; object-fit:contain; }
.fc-sname { font-size:7.5pt; font-weight:900; color:#fff; text-transform:uppercase;
  letter-spacing:.8px; text-align:left; line-height:1; white-space:nowrap; }
.fc-sdiv { display:flex; align-items:center; gap:1.5mm; margin:.4mm 0; }
.fc-sdiv-ln { width:5mm; height:.3mm; background:#c49a1a; }
.fc-sdiv-tx { font-size:5pt; font-weight:700; color:#c49a1a; letter-spacing:2px; }
.fc-motto { font-size:3.2pt; color:rgba(255,255,255,.7); letter-spacing:1.8px; }

.fc-mid { display:flex; align-items:center; gap:2.5mm;
  padding:1.5mm 3mm 1mm; flex-shrink:0; }
.fc-photo { width:17mm; height:21mm; border-radius:2.5mm; overflow:hidden;
  border:1.5px solid #1a2b6b; background:#dbeafe; flex-shrink:0; }
.fc-photo img { width:100%; height:100%; object-fit:cover; object-position:top; }
.fc-nameblock { display:flex; flex-direction:row; flex:1; align-items:flex-start; gap:1.5mm; }
.fc-namecol { display:flex; flex-direction:column; align-items:flex-start; }
.fc-name { font-size:8.5pt; font-weight:900; color:#1a2b6b; text-transform:uppercase;
  line-height:1.15; }
.fc-badge { margin-top:1mm; font-size:4.5pt; font-weight:700; padding:.8mm 2mm;
  border-radius:1.5mm; text-transform:uppercase; letter-spacing:.8px;
  color:#fff; background:#1a2b6b; display:inline-block; }
.fc-session { writing-mode:vertical-rl; text-orientation:mixed; transform:rotate(180deg);
  font-size:3.5pt; font-weight:600; color:#1a2b6b; opacity:.7; letter-spacing:.8px;
  white-space:nowrap; margin-left:auto; padding-right:.5mm; }

.fc-rows { padding:0 2.5mm; flex-shrink:0; }
.fc-row { display:flex; align-items:center; gap:1.5mm; padding:.8mm 1.5mm;
  border-radius:2mm; margin-bottom:.3mm; }
.fc-row-even { background:#f8faff; }
.fc-row-icon { width:4mm; height:4mm; border-radius:50%;
  background:#c49a1a; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.fc-row-lbl { flex:1; font-size:4pt; font-weight:600; color:#4a5568; }
.fc-row-val { font-size:4.5pt; font-weight:900; color:#1a2b6b; }

.fc-qrsig { margin:1mm 2.5mm 0; border-radius:2.5mm; padding:1mm 2mm;
  display:flex; align-items:center; justify-content:space-between; gap:1.5mm;
  background:#f8faff; border:1px solid #e2e8f0; flex-shrink:0; }
.fc-qr { display:flex; flex-direction:column; align-items:center; }
.fc-qr img { width:8mm; height:8mm; }
.fc-scan { font-size:3pt; font-weight:700; color:#1a2b6b; letter-spacing:.5px; margin-top:.4mm; }
.fc-sig-wrap { display:flex; flex-direction:column; align-items:center; flex:1; }
.fc-sig-img { height:6mm; max-width:22mm; object-fit:contain;
  border-bottom:1px solid #c0c8dc; padding-bottom:.5mm; }
.fc-sig-ph { font-family:'Brush Script MT',cursive; font-size:8pt; color:#1a2b6b;
  border-bottom:1px solid #c0c8dc; padding-bottom:.5mm; width:22mm; text-align:center; }
.fc-sig-lbl { font-size:3pt; font-weight:700; letter-spacing:.8px;
  text-transform:uppercase; color:#1a2b6b; margin-top:.8mm; }

.fc-footer { padding:1.2mm 2.5mm; display:flex; flex-direction:row; align-items:stretch;
  margin-top:auto; flex-shrink:0;
  background:linear-gradient(135deg,#1a2b6b 0%,#1a2f7a 60%,#1e3a8a 100%); }
.fc-footer-left { display:flex; align-items:flex-start; gap:1mm; flex:0 0 55%; padding-right:2mm; }
.fc-footer-divider { width:.3mm; background:rgba(255,255,255,.35); flex-shrink:0; margin:.5mm 0; }
.fc-footer-right { display:flex; flex-direction:column; justify-content:center; gap:.8mm; padding-left:2mm; flex:1; }
.fc-fl { display:flex; align-items:center; gap:1mm; overflow:hidden; }
.fc-fi { color:#fff; font-size:4pt; flex-shrink:0; }
.fc-ft { font-size:3.2pt; color:#fff; line-height:1.4;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-ft-bold { font-weight:700; white-space:normal; }

/* ── BACK ── */
.bc-body { flex:1; display:flex; flex-direction:column; gap:1mm;
  padding:2mm; overflow:hidden; }
.bc-sect { display:flex; flex-direction:column; gap:.7mm; }
.bc-head { display:flex; align-items:center; gap:1.2mm; padding:1mm 1.8mm;
  border-radius:2mm; background:linear-gradient(90deg,#1a2b6b 0%,#243580 100%); }
.bc-hi { color:#c49a1a; font-size:6pt; }
.bc-ht { font-size:4.5pt; font-weight:700; letter-spacing:.6px; color:#fff; text-transform:uppercase; }
.bc-rows { padding-left:.8mm; padding-right:.8mm; }
.bc-r { display:flex; font-size:3.6pt; gap:1mm; margin-bottom:.7mm; }
.bc-rl { width:14mm; flex-shrink:0; font-weight:600; color:#1a2b6b; }
.bc-rv { flex:1; font-weight:700; color:#1f2937; line-height:1.3; }
.bc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.8mm 2mm; padding:0 .8mm; }
.bc-gc { display:flex; flex-direction:column; }
.bc-gl { font-size:3.2pt; font-weight:600; text-transform:uppercase; letter-spacing:.3px; color:#1a2b6b; }
.bc-gv { font-size:4pt; font-weight:900; line-height:1.3; color:#1f2937; }
.bc-gv-red { color:#dc2626; }
.bc-instr { padding-left:2.5mm; }
.bc-li { font-size:3.4pt; color:#374151; line-height:1.45; margin-bottom:.3mm; }

.bc-btm { padding:0 2mm 1.2mm; display:flex; align-items:flex-end;
  justify-content:space-between; gap:1.5mm; }
.bc-bldg { width:30mm; height:14mm; opacity:.3; }
.bc-barcode { display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
.bc-barcode-strip { height:6mm; width:20mm; overflow:hidden; display:flex; gap:1px; align-items:stretch; }
.bc-bar { background:#1a2b6b; height:100%; }
.bc-bc-id { font-size:3.5pt; font-weight:700; color:#1a2b6b; letter-spacing:.8px; margin-top:.4mm; }

.bc-footer { height:6.5mm; display:flex; align-items:center; justify-content:center;
  gap:1.5mm; background:linear-gradient(135deg,#1a2b6b 0%,#1e3a8a 100%); flex-shrink:0; }
.bc-wfi { color:#c49a1a; font-size:6pt; }
.bc-wft { font-size:4.5pt; font-weight:600; letter-spacing:.4px; color:#fff; }
`;

/* ─── BUILD FRONT HTML ─────────────────────────────────────────────────── */
function buildFrontHtml(s: Record<string,any>, school: SchoolInfo, card: CardSettings): string {
  const logoHtml = school.logoUrl
    ? `<div class="fc-logo"><img src="${school.logoUrl}" alt="logo"/></div>`
    : `<div class="fc-logo"><svg viewBox="0 0 80 80" style="width:100%;height:100%;">
        <path d="M40 4 L72 16 L72 44 C72 62 40 76 40 76 C40 76 8 62 8 44 L8 16 Z" fill="none" stroke="#c49a1a" stroke-width="3"/>
        <circle cx="40" cy="36" r="8" fill="none" stroke="#c49a1a" stroke-width="1.5"/>
        <path d="M36 36 L44 36 M40 32 L40 40" stroke="#c49a1a" stroke-width="1.5"/>
       </svg></div>`;
  const photoHtml = s.photoUrl
    ? `<img src="${s.photoUrl}" alt="Student" style="width:100%;height:100%;object-fit:cover;object-position:top;"/>`
    : `<svg viewBox="0 0 80 100" style="width:100%;height:100%;"><ellipse cx="40" cy="32" rx="20" ry="22" fill="#93c5fd"/><path d="M5 100 Q5 65 40 65 Q75 65 75 100Z" fill="#93c5fd"/></svg>`;
  const sigHtml = card.principalSig
    ? `<img class="fc-sig-img" src="${card.principalSig}" alt="sig"/>`
    : `<div class="fc-sig-ph">Principal</div>`;
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(getScanUrl(s.uniqueId))}`;

  const iconClass  = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`;
  const iconGrad   = `${iconClass}<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
  const iconHash   = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
  const iconFile   = `${iconClass}<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  const iconCal    = `${iconClass}<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  const rows = [
    { icon:iconGrad, lbl:"Class &amp; Section", val:`${s.className??""} – ${s.sectionName??""}`, even:true },
    { icon:iconHash, lbl:"Roll No.",            val:String(s.rollNo??"—"),                        even:false },
    { icon:iconFile, lbl:"Enroll No.",          val:s.uniqueId??"—",                              even:true },
    { icon:iconCal,  lbl:"Date of Birth",       val:fmtDate(s.dateOfBirth)||"—",                  even:false },
  ];

  return `<div class="idc">
  <div class="fc-hdr">
    ${logoHtml}
    <div class="fc-hdr-text">
      <div class="fc-sname">${(school.schoolName||"ASSEMBLY OF GOD SCHOOL").replace(/\bSCHOOL\b\s*$/i,"").trim()||"ASSEMBLY OF GOD"}</div>
      <div class="fc-sdiv"><div class="fc-sdiv-ln"></div><span class="fc-sdiv-tx">SCHOOL</span><div class="fc-sdiv-ln"></div></div>
      <div class="fc-motto">${school.schoolMotto||"LEARN · GROW · SERVE"}</div>
    </div>
  </div>
  <div class="fc-mid">
    <div class="fc-photo">${photoHtml}</div>
    <div class="fc-nameblock">
      <div class="fc-namecol">
        <div class="fc-name">${(s.studentName||"STUDENT").split(" ")[0]}<br/>${(s.studentName||"").split(" ").slice(1).join(" ")}</div>
        <div class="fc-badge">Student</div>
      </div>
      <div class="fc-session">${card.session}</div>
    </div>
  </div>
  <div class="fc-rows">
    ${rows.map(r=>`<div class="fc-row ${r.even?"fc-row-even":""}">
      <div class="fc-row-icon">${r.icon}</div>
      <span class="fc-row-lbl">${r.lbl}</span>
      <span class="fc-row-val">${r.val}</span>
    </div>`).join("")}
  </div>
  <div class="fc-qrsig">
    <div class="fc-qr">
      <img src="${qrApi}" width="9mm" height="9mm" alt="QR"/>
      <div class="fc-scan">SCAN TO VERIFY</div>
    </div>
    <div class="fc-sig-wrap">${sigHtml}<div class="fc-sig-lbl">Principal</div></div>
  </div>
  <div class="fc-footer">
    <div class="fc-footer-left">
      <svg class="fc-fi" width="7" height="9" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-top:0.3mm"><path d="M7 0C4.24 0 2 2.24 2 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 7 3.5a1.5 1.5 0 0 1 0 3z" fill="#ff5252"/></svg>
      <span class="fc-ft fc-ft-bold">${school.schoolAddress||"45 Education Lane, Greenfield City, Springfield, CA 90210"}</span>
    </div>
    <div class="fc-footer-divider"></div>
    <div class="fc-footer-right">
      <div class="fc-fl">
        <svg class="fc-fi" width="8" height="6" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><rect x="1" y="1" width="18" height="12" rx="2" stroke="white" stroke-width="1.8"/><path d="M1 3l9 5 9-5" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span class="fc-ft fc-ft-bold">${school.schoolEmail||"info@aogschool.edu"}</span>
      </div>
      <div class="fc-fl">
        <svg class="fc-fi" width="7" height="7" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><path d="M3 2h3.5l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L13 11l4 1.5V16a1 1 0 0 1-1 1C7.16 17 2 11.84 2 3a1 1 0 0 1 1-1z" fill="white"/></svg>
        <span class="fc-ft fc-ft-bold">${school.schoolPhone||"+1 555 123 4567"}</span>
      </div>
    </div>
  </div>
</div>`;
}

/* ─── BUILD BACK HTML ──────────────────────────────────────────────────── */
function buildBackHtml(s: Record<string,any>, school: SchoolInfo, card: CardSettings): string {
  const cardId = s.enrollmentNo || s.uniqueId || "GIS2024-0156";
  const instrLines = (card.instructions||"This card must be carried every day.\nThis card is valid only for the academic session mentioned on the front.\nLoss of this card should be immediately reported to the school office.\nIf found, please return to the school address.").split("\n").filter(Boolean);
  const bars = [3,1,2,1,3,1,1,2,1,2,1,1,3,1,2,1,1,2,3,1,1,2,1,3,1,1,2,1];
  const barHtml = bars.map((w,i)=>`<div class="bc-bar" style="width:${w*1.5}px;opacity:${i%2===0?1:0};"></div>`).join("");

  const buildingUrl = `${window.location.origin}${import.meta.env.BASE_URL}school-building.png`;
  const bldg = `<img src="${buildingUrl}" alt="School Building" style="width:36mm;height:17mm;object-fit:contain;"/>`;

  return `<div class="idc">
  <div class="bc-body">
    <div class="bc-sect">
      <div class="bc-head"><svg class="bc-hi" width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#c49a1a" stroke="#c49a1a" stroke-width="1"/><line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="white"/></svg><span class="bc-ht">Emergency Contact Details</span></div>
      <div class="bc-rows">
        ${[
          ["Father's Name", s.fatherName||"—"],
          ["Mother's Name", s.motherName||"—"],
          ["Parent Mobile", s.whatsappNumber||"—"],
          ["Alt. Contact",  s.emergencyContact||"—"],
          ["Gmail",         s.parentEmail||"—"],
          ["Home Address",  s.address||"—"],
        ].map(([l,v])=>`<div class="bc-r"><span class="bc-rl">${l}:</span><span class="bc-rv">${v}</span></div>`).join("")}
      </div>
    </div>
    <div class="bc-sect">
      <div class="bc-head"><svg class="bc-hi" width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1a2b6b" stroke="white" stroke-width="1.5"/><line x1="12" y1="11" x2="12" y2="17" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="8" r="1.2" fill="white"/></svg><span class="bc-ht">Student Information</span></div>
      <div class="bc-grid">
        <div class="bc-gc"><span class="bc-gl">Transport Route</span><span class="bc-gv">${s.vehicleName||"—"}</span></div>
        <div class="bc-gc"><span class="bc-gl">Bus No.</span><span class="bc-gv">${s.vehicleName?`Bus No. ${s.vehicleName}`:"—"}</span></div>
        <div class="bc-gc"><span class="bc-gl">Blood Group</span><span class="bc-gv bc-gv-red">${s.bloodGroup||"—"}</span></div>
        <div class="bc-gc"><span class="bc-gl">Aadhar No.</span><span class="bc-gv">${s.aadharNumber||"—"}</span></div>
        <div class="bc-gc"><span class="bc-gl">Issue Date</span><span class="bc-gv">${card.issueDate}</span></div>
        <div class="bc-gc"><span class="bc-gl">Valid Until</span><span class="bc-gv">${card.validUntil}</span></div>
      </div>
    </div>
    <div class="bc-sect">
      <div class="bc-head"><svg class="bc-hi" width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#1a2b6b" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><polyline points="9 12 11 14 15 10" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="bc-ht">Instructions</span></div>
      <ul class="bc-instr">
        ${instrLines.map(t=>`<li class="bc-li">${t}</li>`).join("")}
      </ul>
    </div>
  </div>
  <div class="bc-btm">
    <div class="bc-bldg">${bldg}</div>
    <div class="bc-barcode">
      <div class="bc-barcode-strip">${barHtml}</div>
      <div class="bc-bc-id">${cardId}</div>
    </div>
  </div>
  <div class="bc-footer">
    <svg class="bc-wfi" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#c49a1a" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    <span class="bc-wft">${school.schoolWebsite||"www.aogschool.edu"}</span>
  </div>
</div>`;
}

/* ─── MAIN TAB ─────────────────────────────────────────────────────────── */
export default function IdCardsTab() {
  const [classId,   setClassId]   = useState("all");
  const [sectionId, setSectionId] = useState("all");
  const [sections,  setSections]  = useState<any[]>([]);
  const [printMode, setPrintMode] = useState<"both"|"front"|"back">("both");
  const [school, setSchool] = useState<SchoolInfo>({
    schoolName:"Assembly of God", schoolMotto:"LEARN · GROW · SERVE",
    logoUrl:"", schoolAddress:"", schoolPhone:"", schoolEmail:"", schoolWebsite:"",
  });
  const [card, setCard] = useState<CardSettings>({
    session:`${new Date().getFullYear()}-${(new Date().getFullYear()+1).toString().slice(2)}`,
    issueDate:new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
    validUntil:`31 Mar ${new Date().getFullYear()+1}`,
    principalSig:"",
    instructions:"This card must be carried every day.\nThis card is valid only for the academic session mentioned on the front.\nLoss of this card should be immediately reported to the school office.\nIf found, please return to the school address.",
  });
  const [schoolLoading, setSchoolLoading] = useState(true);

  // Fetch real academic session and sync card defaults
  useEffect(() => {
    fetch("/api/academic-sessions/status")
      .then(r => r.json())
      .then(d => {
        const name: string = d?.currentSession ?? "";
        if (!name) return;
        // "2027-2028" → session label "2027-28", endYear for validUntil
        const parts = name.split("-");
        const startYear = parts[0];
        const endYear   = parts[parts.length - 1];
        const sessionLabel = `${startYear}-${endYear.slice(-2)}`;
        setCard(prev => ({
          ...prev,
          session:    sessionLabel,
          validUntil: `31 Mar ${endYear}`,
        }));
      })
      .catch(() => {/* keep calendar-year defaults */});
  }, []);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/school-info").then(r=>r.json()).then(d=>{
      setSchool({
        schoolName:    d.schoolName    || "Assembly of God",
        schoolMotto:   d.schoolMotto   || "LEARN · GROW · SERVE",
        logoUrl:       d.logoUrl       || "",
        schoolAddress: d.address       || "",
        schoolPhone:   d.contactNumber || "",
        schoolEmail:   d.schoolGmail   || "",
        schoolWebsite: d.schoolWebsite || "",
      });
      setSchoolLoading(false);
    }).catch(()=>setSchoolLoading(false));
  },[]);

  useEffect(()=>{
    const url = classId!=="all" ? `/api/sections?classId=${classId}` : "/api/sections";
    fetch(url).then(r=>r.json()).then(d=>setSections(Array.isArray(d)?d:[])).catch(()=>setSections([]));
  },[classId]);

  const { data:rawStudents=[], isLoading } = useListStudents({
    classId:   classId!=="all"   ? parseInt(classId)   : undefined,
    sectionId: sectionId!=="all" ? parseInt(sectionId) : undefined,
  });
  const { data:classes=[] }  = useListClasses();
  const { data:vehicles=[] } = useListVehicles();

  function enrich(st: any) {
    return {
      ...st,
      className:   (classes  as any[]).find((c:any)=>c.id===st.classId)?.name  ?? "",
      sectionName: (sections as any[]).find((sec:any)=>sec.id===st.sectionId)?.name ?? st.sectionName ?? "",
      vehicleName: st.hasVehicle ? ((vehicles as any[]).find((v:any)=>v.id===st.vehicleId)?.name??"") : "",
    };
  }
  const students = (rawStudents as any[]).map(enrich);

  async function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const data = await compressImage(file,300); setCard(p=>({...p,principalSig:data})); }
    catch { alert("Failed to load signature image."); }
    e.target.value = "";
  }

  function handlePrint() {
    if (!students.length) return;
    const fronts = students.map(s=>buildFrontHtml(s,school,card)).join("\n");
    const backs  = students.map(s=>buildBackHtml(s,school,card)).join("\n");
    const win = window.open("","_blank"); if (!win) return;
    let body = "";
    if      (printMode==="front") body = `<div class="page-grid">${fronts}</div>`;
    else if (printMode==="back")  body = `<div class="page-grid">${backs}</div>`;
    else body = `<div class="page-grid">${fronts}</div><div class="page-grid">${backs}</div>`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>ID Cards — ${school.schoolName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>${PRINT_CSS}</style></head><body>${body}
      <script>setTimeout(function(){window.print();},1800);<\/script></body></html>`);
    win.document.close();
  }

  const inp = "border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 w-full";

  /* demo student shown before any real students load */
  const demo: Record<string,any> = {
    studentName:"ARJUN SHARMA", uniqueId:"demo", enrollmentNo:"GIS2024-0156",
    className:"10", sectionName:"A", rollNo:23, photoUrl:"",
    bloodGroup:"O+", dateOfBirth:"2009-05-15",
    fatherName:"Rajesh Sharma", motherName:"Priya Sharma",
    whatsappNumber:"+1 555 987 6543", emergencyContact:"+1 555 456 7890",
    address:"123 Greenfield Road, Springfield, CA 90210",
    vehicleName:"12", hasVehicle:true,
  };
  const preview = students[0] ?? demo;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color:NAVY }}/>
            Student ID Cards
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">CR80 Portrait · 53.98 × 85.60 mm · 3 per A4 row</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={printMode} onValueChange={v=>setPrintMode(v as any)}>
            <SelectTrigger className="w-36 text-sm border-slate-200 bg-white dark:bg-slate-900"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Front + Back</SelectItem>
              <SelectItem value="front">Front Only</SelectItem>
              <SelectItem value="back">Back Only</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} disabled={!students.length}
            style={{ background:NAVY }} className="text-white hover:opacity-90">
            <Printer className="h-4 w-4 mr-2"/>Print All Cards
          </Button>
        </div>
      </div>

      {/* school banner */}
      {!schoolLoading && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          {school.logoUrl
            ? <img src={school.logoUrl} alt="logo" className="h-10 w-10 object-contain rounded-full bg-white p-0.5 flex-shrink-0" style={{ border:`2px solid ${GOLD}` }}/>
            : <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0" style={{ background:NAVY }}>{school.schoolName.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color:NAVY }}>{school.schoolName}</p>
            <p className="text-xs truncate" style={{ color:GOLD }}>{school.schoolMotto}</p>
          </div>
        </div>
      )}

      {/* options */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Filter className="h-4 w-4"/>Card Options &amp; Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          {/* signature */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40">
            {card.principalSig
              ? <div className="relative flex-shrink-0">
                  <img src={card.principalSig} alt="sig" className="w-24 h-12 object-contain rounded border border-slate-200 bg-white p-1"/>
                  <button onClick={()=>setCard(p=>({...p,principalSig:""}))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600">
                    <X className="h-2.5 w-2.5"/>
                  </button>
                </div>
              : <div className="w-24 h-12 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-white">
                  <Upload className="h-4 w-4 text-slate-400"/>
                </div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Principal Signature</p>
              <p className="text-xs text-slate-500">Printed on front of each card</p>
              <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={handleSigUpload}/>
              <Button variant="outline" size="sm" className="mt-1.5 h-7 text-xs" onClick={()=>sigInputRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1"/>{card.principalSig?"Replace":"Upload"}
              </Button>
            </div>
          </div>

          {/* session / dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {label:"Academic Session", key:"session",    ph:"2025-26"},
              {label:"Issue Date",       key:"issueDate",  ph:"01 Apr 2025"},
              {label:"Valid Until",      key:"validUntil", ph:"31 Mar 2026"},
            ].map(({label,key,ph})=>(
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">{label}</label>
                <input className={inp} value={(card as any)[key]} placeholder={ph}
                  onChange={e=>setCard(p=>({...p,[key]:e.target.value}))}/>
              </div>
            ))}
          </div>

          {/* instructions */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Card Instructions (one per line)</label>
            <textarea className={`${inp} resize-none`} rows={4} value={card.instructions}
              onChange={e=>setCard(p=>({...p,instructions:e.target.value}))}/>
          </div>

          {/* filters */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-700">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Filter by Class</label>
              <Select value={classId} onValueChange={v=>{setClassId(v);setSectionId("all");}}>
                <SelectTrigger className="text-sm bg-white dark:bg-slate-900 border-slate-200"><SelectValue placeholder="All Classes"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {(classes as any[]).map((c:any)=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 font-medium">Filter by Section</label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="text-sm bg-white dark:bg-slate-900 border-slate-200"><SelectValue placeholder="All Sections"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((sec:any)=><SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* count */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
          <Users className="h-3 w-3 mr-1"/>{students.length} students
        </Badge>
        {isLoading && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
      </div>

      {/* card previews */}
      {students.length===0 && !isLoading ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 text-center italic">
            Sample preview — add students to generate real cards
          </p>
          <div className="flex flex-wrap gap-8 justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold tracking-widest px-5 py-1 rounded-full text-white" style={{ background:NAVY }}>FRONT</span>
              <CardIframe html={buildFrontHtml(preview,school,card)}/>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold tracking-widest px-5 py-1 rounded-full text-white" style={{ background:NAVY }}>BACK</span>
              <CardIframe html={buildBackHtml(preview,school,card)}/>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {students.slice(0,6).map(st => (
            <div key={st.id??st.uniqueId} className="flex flex-wrap gap-8 justify-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold tracking-widest px-5 py-1 rounded-full text-white" style={{ background:NAVY }}>FRONT</span>
                <CardIframe html={buildFrontHtml(st,school,card)}/>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold tracking-widest px-5 py-1 rounded-full text-white" style={{ background:NAVY }}>BACK</span>
                <CardIframe html={buildBackHtml(st,school,card)}/>
              </div>
            </div>
          ))}
          {students.length>6 && (
            <p className="text-center text-xs text-slate-400">Showing 6 of {students.length} — all will print</p>
          )}
        </div>
      )}
    </div>
  );
}
