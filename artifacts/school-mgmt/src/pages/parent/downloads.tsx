import { useState, useEffect } from "react";
import ParentLayout from "@/components/ParentLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Download, BookOpen, User, Calendar, Search,
  File, Loader2, ShieldCheck,
} from "lucide-react";
import { parentApi } from "@/lib/jwt-api";
import { useToast } from "@/hooks/use-toast";

interface TeacherDoc {
  id: number;
  title: string;
  subject: string;
  description: string;
  fileUrl: string;
  fileType: string;
  teacherName: string;
  className: string;
  createdAt: string;
}

interface AdminDownload {
  id: number;
  title: string;
  category: string;
  description: string;
  fileUrl: string;
  fileType: string;
  isFeatured: boolean;
  createdAt: string;
}

interface ParentDocsResponse {
  teacherDocs: TeacherDoc[];
  adminDownloads: AdminDownload[];
}

function getFileIcon(fileType: string) {
  const t = fileType?.toLowerCase();
  if (t === "pdf") return "📄";
  if (t === "doc" || t === "docx") return "📝";
  if (t === "xls" || t === "xlsx") return "📊";
  if (t === "ppt" || t === "pptx") return "📊";
  if (t?.startsWith("image")) return "🖼️";
  return "📎";
}

export default function ParentDownloads() {
  const { toast } = useToast();
  const [teacherDocs, setTeacherDocs] = useState<TeacherDoc[]>([]);
  const [adminDownloads, setAdminDownloads] = useState<AdminDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await parentApi.get<ParentDocsResponse>("/teacher-documents/for-parent");
        setTeacherDocs(data.teacherDocs);
        setAdminDownloads(data.adminDownloads);
      } catch {
        toast({ title: "Failed to load documents", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = search.toLowerCase();

  const filteredTeacherDocs = teacherDocs.filter(
    (d) =>
      d.title.toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q) ||
      d.teacherName.toLowerCase().includes(q),
  );

  const filteredAdminDownloads = adminDownloads.filter(
    (d) =>
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q),
  );

  const total = filteredTeacherDocs.length + filteredAdminDownloads.length;

  return (
    <ParentLayout title="Downloads">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-slate-800">School Documents</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Study materials from teachers and official documents from the school
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by title, subject or teacher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : total === 0 && search ? (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No documents match "{search}"</p>
          </div>
        ) : total === 0 ? (
          <div className="text-center py-20">
            <File className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No documents available yet</p>
            <p className="text-sm text-slate-400 mt-1">Check back when your teachers upload study materials</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Teacher Documents */}
            {filteredTeacherDocs.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-semibold text-slate-800">Subject Materials</h3>
                  <Badge variant="secondary" className="text-xs">{filteredTeacherDocs.length}</Badge>
                </div>
                <div className="grid gap-3">
                  {filteredTeacherDocs.map((doc) => (
                    <Card key={doc.id} className="border border-slate-200 hover:shadow-sm transition-shadow">
                      <CardContent className="py-3 px-4 flex items-start gap-3">
                        <span className="text-2xl mt-0.5 shrink-0">{getFileIcon(doc.fileType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{doc.title}</p>
                              {doc.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {doc.subject && (
                                  <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">
                                    {doc.subject}
                                  </Badge>
                                )}
                                {doc.className && (
                                  <Badge variant="outline" className="text-xs">
                                    Class {doc.className}
                                  </Badge>
                                )}
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {doc.teacherName}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Admin / School Downloads */}
            {filteredAdminDownloads.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <h3 className="text-base font-semibold text-slate-800">School Downloads</h3>
                  <Badge variant="secondary" className="text-xs">{filteredAdminDownloads.length}</Badge>
                </div>
                <div className="grid gap-3">
                  {filteredAdminDownloads.map((doc) => (
                    <Card key={doc.id} className="border border-slate-200 hover:shadow-sm transition-shadow">
                      <CardContent className="py-3 px-4 flex items-start gap-3">
                        <span className="text-2xl mt-0.5 shrink-0">{getFileIcon(doc.fileType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{doc.title}</p>
                              {doc.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {doc.category && (
                                  <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 capitalize">
                                    {doc.category}
                                  </Badge>
                                )}
                                {doc.isFeatured && (
                                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                                    Featured
                                  </Badge>
                                )}
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Admin
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </ParentLayout>
  );
}
