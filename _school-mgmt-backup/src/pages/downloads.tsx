import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { FileText, Download, Search, ArrowLeft, Star, Clock, Filter, ExternalLink, File, Award, CheckCircle, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface DownloadItem {
  id: number;
  title: string;
  category: string;
  description: string;
  fileUrl: string;
  fileType: string;
  isFeatured: boolean;
  downloadCount: number;
  createdAt: string;
}

interface CertRequest {
  id: number;
  admissionNumber: string;
  studentName: string;
  certificateType: string;
  status: string;
  requestedAt: string;
  issuedAt: string | null;
  remarks: string | null;
}

const CATEGORIES: Record<string, string> = {
  all: "All Documents",
  prospectus: "Prospectus",
  admission: "Admission Forms",
  academic: "Academic",
  circular: "Circulars",
  notice: "Notices",
  certificate: "Certificates",
  fee: "Fee Structure",
  exam: "Exam Schedule",
  timetable: "Timetable",
  magazine: "School Magazine",
  annual_report: "Annual Reports",
  event: "Event Brochures",
  parent: "Parent Guidelines",
  student: "Student Handbook",
  rules: "Rules & Regulations",
  general: "General",
};

const CERT_TYPES = [
  { value: "bonafide", label: "Bonafide Certificate" },
  { value: "character", label: "Character Certificate" },
  { value: "leaving", label: "School Leaving Certificate" },
];

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

const FILE_ICONS: Record<string, string> = { pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊", ppt: "📊", pptx: "📊", jpg: "🖼️", jpeg: "🖼️", png: "🖼️", zip: "📦" };

function getIcon(type: string) { return FILE_ICONS[type?.toLowerCase()] || "📄"; }

function CertificateDownloadSection() {
  const { toast } = useToast();
  const [admNo, setAdmNo] = useState("");
  const [certType, setCertType] = useState("bonafide");
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState<CertRequest[] | null>(null);
  const [searched, setSearched] = useState(false);

  async function checkStatus() {
    const adm = admNo.trim();
    if (!adm) { toast({ title: "Please enter your Admission Number", variant: "destructive" }); return; }
    setChecking(true);
    setResult(null);
    setSearched(false);
    try {
      const res = await fetch(`/api/website/certificate-requests/check?admissionNumber=${encodeURIComponent(adm)}&certificateType=${encodeURIComponent(certType)}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data.results || []);
        setSearched(true);
      } else {
        toast({ title: "Could not check status. Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  }

  async function requestCertificate() {
    const adm = admNo.trim();
    if (!adm) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/website/certificate-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admissionNumber: adm, certificateType: certType }),
      });
      if (res.ok) {
        toast({ title: "Request submitted! The school will process it shortly." });
        checkStatus();
      } else {
        toast({ title: "Failed to submit request. Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setRequesting(false);
    }
  }

  const currentResult = result?.[0];
  const statusColor = currentResult?.status === "issued" ? "text-emerald-600" : currentResult?.status === "rejected" ? "text-red-500" : "text-amber-600";
  const statusBg = currentResult?.status === "issued" ? "bg-emerald-50 border-emerald-200" : currentResult?.status === "rejected" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200";
  const StatusIcon = currentResult?.status === "issued" ? CheckCircle : currentResult?.status === "rejected" ? XCircle : Clock;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${NAVY}08, ${GOLD}08)` }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NAVY}15` }}>
              <Award className="h-5 w-5" style={{ color: NAVY }} />
            </div>
            <div>
              <h2 className="font-bold text-lg" style={{ color: NAVY }}>Certificate Download</h2>
              <p className="text-xs text-gray-500">Check status or request a certificate using your admission number</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">Certificate Type</label>
            <div className="grid grid-cols-3 gap-2">
              {CERT_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => { setCertType(ct.value); setResult(null); setSearched(false); }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-center ${certType === ct.value ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                  style={certType === ct.value ? { backgroundColor: NAVY } : {}}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">Admission Number</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter your admission number"
                value={admNo}
                onChange={e => { setAdmNo(e.target.value); setResult(null); setSearched(false); }}
                onKeyDown={e => e.key === "Enter" && checkStatus()}
                className="flex-1"
              />
              <Button onClick={checkStatus} disabled={checking} style={{ backgroundColor: NAVY }} className="text-white shrink-0">
                {checking ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {searched && result !== null && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {currentResult ? (
                <div className={`rounded-xl p-4 border ${statusBg}`}>
                  <div className={`flex items-center gap-2 font-semibold mb-1 ${statusColor}`}>
                    <StatusIcon className="h-4 w-4" />
                    Certificate {currentResult.status === "issued" ? "Issued" : currentResult.status === "rejected" ? "Request Rejected" : "Request Pending"}
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {currentResult.studentName && <div>Student: <span className="font-medium">{currentResult.studentName}</span></div>}
                    <div>Type: {CERT_TYPES.find(c => c.value === currentResult.certificateType)?.label}</div>
                    <div>Requested on: {new Date(currentResult.requestedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
                    {currentResult.issuedAt && <div>Issued on: {new Date(currentResult.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>}
                    {currentResult.remarks && <div className="italic text-gray-500">{currentResult.remarks}</div>}
                  </div>
                  {currentResult.status === "issued" && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium">
                      ✅ Your certificate is ready. Please visit the school office to collect your certificate with your admission slip.
                    </div>
                  )}
                  {currentResult.status === "rejected" && (
                    <Button size="sm" className="mt-3 text-white" style={{ backgroundColor: NAVY }} onClick={requestCertificate} disabled={requesting}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Submit New Request
                    </Button>
                  )}
                  {currentResult.status === "pending" && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-100 text-amber-800 text-xs">
                      ⏳ Your request is being processed. Please check back later or contact the school office.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
                  <p className="text-sm text-blue-700 font-medium mb-1">No request found for this admission number</p>
                  <p className="text-xs text-blue-600 mb-3">You can submit a request and the school will process it for you.</p>
                  <Button size="sm" className="text-white" style={{ backgroundColor: NAVY }} onClick={requestCertificate} disabled={requesting}>
                    {requesting ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Request Certificate
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-600">How it works:</p>
        <p>1. Select the type of certificate you need above.</p>
        <p>2. Enter your admission number and click the search button.</p>
        <p>3. If already issued, you'll see the status. If not, click "Request Certificate".</p>
        <p>4. The school will process your request and notify you when it's ready to collect.</p>
      </div>
    </div>
  );
}

export default function DownloadCenterPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "certificate">("documents");

  const { data: downloads = [], isLoading } = useQuery<DownloadItem[]>({
    queryKey: ["allDownloads"],
    queryFn: () => fetch("/api/website/downloads").then(r => r.json()),
    staleTime: 3 * 60 * 1000,
  });

  const usedCategories = ["all", ...Array.from(new Set(downloads.map(d => d.category))).filter(Boolean)];

  const filtered = downloads.filter(d => {
    const matchCat = activeCategory === "all" || d.category === activeCategory;
    const matchSearch = !search.trim() || d.title.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered.filter(d => d.isFeatured);
  const regular = filtered.filter(d => !d.isFeatured);

  async function handleDownload(item: DownloadItem) {
    if (!item.fileUrl) return;
    setDownloading(item.id);
    try {
      await fetch(`/api/website/downloads/${item.id}/increment`, { method: "POST" });
      window.open(item.fileUrl, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  function DownloadCard({ item }: { item: DownloadItem }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={{ y: -3 }}
        className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg border transition-all group ${item.isFeatured ? "border-[#f97316] border-2" : "border-gray-100"}`}
      >
        {item.isFeatured && (
          <div className="flex items-center gap-1 text-[#f97316] text-xs font-bold mb-2">
            <Star className="h-3 w-3" fill="#f97316" /> Featured
          </div>
        )}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform"
            style={{ backgroundColor: `${NAVY}12` }}>
            {getIcon(item.fileType)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm leading-tight mb-1">{item.title}</h3>
            {item.description && <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{item.description}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><File className="h-3 w-3" />{item.fileType?.toUpperCase() || "PDF"}</span>
              <span className="flex items-center gap-1"><Download className="h-3 w-3" />{item.downloadCount || 0} downloads</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium capitalize">
                {CATEGORIES[item.category] || item.category}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-white font-medium"
            style={{ backgroundColor: NAVY }}
            onClick={() => handleDownload(item)}
            disabled={!item.fileUrl || downloading === item.id}
          >
            {downloading === item.id ? (
              <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Downloading…</span>
            ) : (
              <span className="flex items-center gap-2"><Download className="h-3.5 w-3.5" />Download</span>
            )}
          </Button>
          {item.fileUrl && (
            <Button size="sm" variant="outline" className="px-3" onClick={() => window.open(item.fileUrl, "_blank")} title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 100%)` }} className="text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" className="text-white/70 hover:text-white mb-6 -ml-2 hover:bg-white/10" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Button>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: GOLD }}>
              <Download className="h-7 w-7" style={{ color: DARK }} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Download Center</h1>
              <p className="text-white/70 mt-1">Access important school documents, forms, and resources</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-8">
            {[
              { label: "Total Files", value: downloads.length },
              { label: "Categories", value: usedCategories.length - 1 },
              { label: "Featured", value: downloads.filter(d => d.isFeatured).length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold" style={{ color: GOLD }}>{value}</div>
                <div className="text-xs text-white/60">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Top Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { key: "documents" as const, label: "Documents", icon: FileText },
            { key: "certificate" as const, label: "Certificate Download", icon: Award },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${activeTab === key ? "text-white border-transparent shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-200"}`}
              style={activeTab === key ? { backgroundColor: NAVY } : {}}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "certificate" && <CertificateDownloadSection />}

        {activeTab === "documents" && (
          <>
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search documents..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">{filtered.length} files</span>
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
              {usedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeCategory === cat
                    ? "text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                    }`}
                  style={activeCategory === cat ? { backgroundColor: NAVY } : {}}
                >
                  {CATEGORIES[cat] || cat}
                </button>
              ))}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="text-center py-16">
                <div className="h-8 w-8 rounded-full border-4 border-[#1e3a6e] border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading documents…</p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-20">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  {search ? "No documents match your search" : "No documents available"}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {search ? "Try a different search term or category" : "Documents will appear here once the admin uploads them"}
                </p>
                {(search || activeCategory !== "all") && (
                  <Button variant="outline" onClick={() => { setSearch(""); setActiveCategory("all"); }}>Clear Filters</Button>
                )}
              </div>
            )}

            {/* Featured Section */}
            {!isLoading && featured.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-5">
                  <Star className="h-5 w-5" style={{ color: GOLD }} fill={GOLD} />
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>Featured Documents</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featured.map(item => <DownloadCard key={item.id} item={item} />)}
                </div>
              </div>
            )}

            {/* All Documents */}
            {!isLoading && regular.length > 0 && (
              <div>
                {featured.length > 0 && (
                  <div className="flex items-center gap-2 mb-5">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-700">All Documents</h2>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regular.map(item => <DownloadCard key={item.id} item={item} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Back to home */}
        <div className="text-center mt-12 py-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm mb-3">Looking for something else?</p>
          <Button variant="outline" onClick={() => setLocation("/")} style={{ borderColor: NAVY, color: NAVY }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
