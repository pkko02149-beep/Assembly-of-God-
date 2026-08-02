import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { uploadToCloudinary, uploadDocumentToCloudinary } from "@/lib/cloudinary";
import {
  Plus, Trash2, Globe, Image, MessageSquare, Trophy, Download,
  Mail, Star, RefreshCw, ExternalLink, FileText, LayoutDashboard, CheckCircle2, Clock,
  Palette, Save, School, Phone, AtSign, Link2, Facebook, Twitter, Instagram, Youtube, User, Contact, Upload, Images
} from "lucide-react";

// ─── ImageUploadInput ─────────────────────────────────────────────────────────

function ImageUploadInput({ value, onChange, placeholder = "Image URL" }: { value: string; onChange: (url: string) => void; placeholder?: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
      toast({ title: "Image uploaded!" });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex gap-1.5">
      <Input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="flex-1" />
      <Button type="button" size="sm" variant="outline" className="shrink-0 px-2 border-blue-200 text-blue-600 hover:bg-blue-50" disabled={uploading} onClick={() => inputRef.current?.click()} title="Upload image via Cloudinary">
        {uploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      </Button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...authHeader(), ...(opts?.headers ?? {}) } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

function SectionCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#1e3a6e]/10 flex items-center justify-center"><Icon className="h-5 w-5 text-[#1e3a6e]" /></div>
        <div><h3 className="font-bold text-slate-800">{title}</h3><p className="text-xs text-slate-500">{subtitle}</p></div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Slider Tab ───────────────────────────────────────────────────────────────

function SliderTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", subtitle: "", imageUrl: "", ctaText: "", ctaLink: "", bgGradient: "from-[#0f2045] via-[#1e3a6e] to-[#0f2045]", displayOrder: "0" });

  const { data: slides = [], isLoading } = useQuery({ queryKey: ["adminSlider"], queryFn: () => apiFetch("/api/website/slider") });

  const addMut = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/website/slider", { method: "POST", body: JSON.stringify({ ...data, displayOrder: Number(data.displayOrder) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminSlider"] }); toast({ title: "Slide added" }); setForm({ title: "", subtitle: "", imageUrl: "", ctaText: "", ctaLink: "", bgGradient: "from-[#0f2045] via-[#1e3a6e] to-[#0f2045]", displayOrder: "0" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/slider/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminSlider"] }); toast({ title: "Slide deleted" }); },
  });

  const GRADIENTS = [
    { label: "Navy Blue", value: "from-[#0f2045] via-[#1e3a6e] to-[#0f2045]" },
    { label: "Royal Blue", value: "from-[#163066] via-[#1e3a6e] to-[#0f2045]" },
    { label: "Indigo Purple", value: "from-[#2d1b69] via-[#1e3a6e] to-[#0f2045]" },
    { label: "Emerald Green", value: "from-[#064e3b] via-[#065f46] to-[#0f2045]" },
    { label: "Deep Teal", value: "from-[#0c4a6e] via-[#0369a1] to-[#0f2045]" },
  ];
  const isImageOnly = form.bgGradient === "image-only";

  return (
    <SectionCard title="Hero Slider" subtitle="Manage homepage banner slides" icon={Image}>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Add Form */}
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700">Add New Slide</h4>
          <Input placeholder="Slide title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Subtitle / tagline" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
          <ImageUploadInput placeholder="Image URL (optional)" value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="CTA Button text" value={form.ctaText} onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))} />
            <Input placeholder="CTA Link (e.g. #enquiry)" value={form.ctaLink} onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="imageOnly"
                checked={isImageOnly}
                onChange={e => setForm(f => ({ ...f, bgGradient: e.target.checked ? "image-only" : GRADIENTS[0].value }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
              />
              <label htmlFor="imageOnly" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                Image Only <span className="text-xs font-normal text-slate-400">(show full image, no gradient)</span>
              </label>
            </div>
            {!isImageOnly && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Background Gradient</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.bgGradient} onChange={e => setForm(f => ({ ...f, bgGradient: e.target.value }))}>
                  {GRADIENTS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            )}
            {isImageOnly && !form.imageUrl && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">⚠ Upload an image above to use Image Only mode</p>
            )}
          </div>
          <Input placeholder="Display order (0 = first)" type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
          <Button className="w-full bg-[#1e3a6e] text-white hover:bg-[#163066]" onClick={() => { if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; } addMut.mutate(form); }} disabled={addMut.isPending}>
            <Plus className="h-4 w-4 mr-2" />{addMut.isPending ? "Adding…" : "Add Slide"}
          </Button>
        </div>

        {/* List */}
        <div>
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Current Slides ({slides.length})</h4>
          {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : slides.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl"><Image className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No slides yet</p></div>
          ) : (
            <div className="space-y-2">
              {slides.map((slide: any) => (
                <div key={slide.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${slide.bgGradient || "from-blue-900 to-blue-700"} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{slide.title}</div>
                    <div className="text-xs text-slate-500 truncate">{slide.subtitle}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={() => delMut.mutate(slide.id)} disabled={delMut.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Gallery Tab ──────────────────────────────────────────────────────────────

function AlbumPhotoList({ albumId }: { albumId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["adminAlbumPhotos", albumId],
    queryFn: () => fetch(`/api/website/gallery/albums/${albumId}/photos`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
    staleTime: 0,
  });

  const delPhoto = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/gallery/photos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminAlbumPhotos", albumId] });
      toast({ title: "Photo deleted" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-xs text-slate-400 px-3 py-2">Loading photos…</div>;
  if (photos.length === 0) return <div className="text-xs text-slate-400 px-3 py-2 italic">No photos yet — add one below.</div>;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-3">
      {photos.map((photo: any) => (
        <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square border border-slate-200">
          <img src={photo.imageUrl} alt={photo.caption || "photo"} className="w-full h-full object-cover" />
          <button
            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow transition-colors z-10"
            onClick={() => delPhoto.mutate(photo.id)}
            disabled={delPhoto.isPending}
            title="Delete photo"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {photo.caption && (
            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1">
              <p className="text-white text-[10px] leading-tight line-clamp-2">{photo.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BulkUploadButton({ albumId, onDone }: { albumId: number; onDone: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    let done = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const imageUrl = await uploadToCloudinary(file);
        await fetch(`/api/website/gallery/albums/${albumId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify({ imageUrl, caption: "" }),
        });
        done++;
      } catch {
        failed++;
      }
      setProgress({ done: done + failed, total: files.length });
    }
    onDone();
    setProgress(null);
    e.target.value = "";
    if (failed === 0) toast({ title: `${done} photo${done !== 1 ? "s" : ""} uploaded!` });
    else toast({ title: `${done} uploaded, ${failed} failed`, variant: "destructive" });
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      {progress ? (
        <div className="flex items-center gap-2 px-1 py-1">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#1e3a6e] h-full rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-500 shrink-0">{progress.done}/{progress.total}</span>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="w-full border-dashed border-blue-200 text-blue-700 hover:bg-blue-50 text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
          <Images className="h-3.5 w-3.5" /> Select Multiple Photos at Once
        </Button>
      )}
    </div>
  );
}

function GalleryTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [albumForm, setAlbumForm] = useState({ name: "", description: "", coverImageUrl: "", albumDate: "" });
  const [photoForms, setPhotoForms] = useState<Record<number, { imageUrl: string; caption: string }>>({});

  const { data: albums = [], isLoading } = useQuery({ queryKey: ["adminGallery"], queryFn: () => apiFetch("/api/website/gallery/albums/all") });

  const addAlbum = useMutation({
    mutationFn: (data: typeof albumForm) => apiFetch("/api/website/gallery/albums", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminGallery"] }); toast({ title: "Album created" }); setAlbumForm({ name: "", description: "", coverImageUrl: "", albumDate: "" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const delAlbum = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/gallery/albums/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminGallery"] }); toast({ title: "Album deleted" }); },
  });

  const addPhoto = useMutation({
    mutationFn: ({ albumId, imageUrl, caption }: { albumId: number; imageUrl: string; caption: string }) =>
      apiFetch(`/api/website/gallery/albums/${albumId}/photos`, { method: "POST", body: JSON.stringify({ imageUrl, caption }) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["adminAlbumPhotos", vars.albumId] });
      toast({ title: "Photo added" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <SectionCard title="Photo Gallery" subtitle="Manage photo albums and images" icon={Image}>
      <div className="space-y-6">
        {/* Add Album */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Create New Album</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Album name *" value={albumForm.name} onChange={e => setAlbumForm(f => ({ ...f, name: e.target.value }))} />
            <ImageUploadInput placeholder="Cover image URL" value={albumForm.coverImageUrl} onChange={url => setAlbumForm(f => ({ ...f, coverImageUrl: url }))} />
            <Input placeholder="Description" value={albumForm.description} onChange={e => setAlbumForm(f => ({ ...f, description: e.target.value }))} />
            <Input type="date" value={albumForm.albumDate} onChange={e => setAlbumForm(f => ({ ...f, albumDate: e.target.value }))} />
          </div>
          <Button className="mt-3 bg-[#1e3a6e] text-white hover:bg-[#163066]" onClick={() => { if (!albumForm.name.trim()) { toast({ title: "Album name required", variant: "destructive" }); return; } addAlbum.mutate(albumForm); }} disabled={addAlbum.isPending}>
            <Plus className="h-4 w-4 mr-2" />{addAlbum.isPending ? "Creating…" : "Create Album"}
          </Button>
        </div>

        {/* Album List */}
        {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : albums.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl"><Image className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No albums yet</p></div>
        ) : (
          <div className="space-y-4">
            {albums.map((album: any) => (
              <div key={album.id} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Album header */}
                <div className="flex items-center gap-3 p-4 bg-slate-50">
                  {album.coverImageUrl ? <img src={album.coverImageUrl} alt={album.name} className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><Image className="h-5 w-5 text-white" /></div>}
                  <div className="flex-1"><div className="font-semibold text-sm">{album.name}</div><div className="text-xs text-slate-500">{album.description}</div></div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => delAlbum.mutate(album.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {/* Existing photos */}
                <div className="border-t border-slate-100 bg-white">
                  <AlbumPhotoList albumId={album.id} />
                </div>
                {/* Add photo */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-medium text-slate-500">Add photo to this album</p>
                  {/* Single photo row */}
                  <div className="flex gap-2">
                    <ImageUploadInput placeholder="Photo URL" value={photoForms[album.id]?.imageUrl || ""} onChange={url => setPhotoForms(f => ({ ...f, [album.id]: { ...f[album.id], imageUrl: url } }))} />
                    <Input placeholder="Caption (optional)" className="text-xs" value={photoForms[album.id]?.caption || ""} onChange={e => setPhotoForms(f => ({ ...f, [album.id]: { ...f[album.id], caption: e.target.value } }))} />
                    <Button size="sm" className="shrink-0 bg-[#1e3a6e] text-white" onClick={() => {
                      const pf = photoForms[album.id];
                      if (!pf?.imageUrl) { toast({ title: "Photo URL required", variant: "destructive" }); return; }
                      addPhoto.mutate({ albumId: album.id, imageUrl: pf.imageUrl, caption: pf.caption || "" });
                      setPhotoForms(f => ({ ...f, [album.id]: { imageUrl: "", caption: "" } }));
                    }} disabled={addPhoto.isPending}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Bulk upload row */}
                  <BulkUploadButton albumId={album.id} onDone={() => qc.invalidateQueries({ queryKey: ["adminAlbumPhotos", album.id] })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Testimonials Tab ─────────────────────────────────────────────────────────

function TestimonialsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", designation: "", content: "", rating: "5", photoUrl: "", displayOrder: "0" });

  const { data: items = [], isLoading } = useQuery({ queryKey: ["adminTestimonials"], queryFn: () => apiFetch("/api/website/testimonials") });

  const addMut = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/website/testimonials", { method: "POST", body: JSON.stringify({ ...data, rating: Number(data.rating), displayOrder: Number(data.displayOrder) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminTestimonials"] }); toast({ title: "Testimonial added" }); setForm({ name: "", designation: "", content: "", rating: "5", photoUrl: "", displayOrder: "0" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/testimonials/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminTestimonials"] }); toast({ title: "Deleted" }); },
  });

  return (
    <SectionCard title="Testimonials" subtitle="Parent & alumni reviews shown on homepage" icon={MessageSquare}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700">Add Testimonial</h4>
          <Input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Designation (e.g. Parent of Class X)" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Testimonial content *" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Rating (1–5)</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{"⭐".repeat(r)} ({r})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Display Order</label>
              <Input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
            </div>
          </div>
          <ImageUploadInput placeholder="Photo URL (optional)" value={form.photoUrl} onChange={url => setForm(f => ({ ...f, photoUrl: url }))} />
          <Button className="w-full bg-[#1e3a6e] text-white" onClick={() => { if (!form.name.trim() || !form.content.trim()) { toast({ title: "Name and content required", variant: "destructive" }); return; } addMut.mutate(form); }} disabled={addMut.isPending}>
            <Plus className="h-4 w-4 mr-2" />{addMut.isPending ? "Adding…" : "Add Testimonial"}
          </Button>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Current Testimonials ({items.length})</h4>
          {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl"><MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No testimonials yet</p></div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium text-slate-800">{item.name}</span>
                      <span className="text-xs text-amber-500">{"★".repeat(item.rating)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">{item.designation}</div>
                    <div className="text-xs text-slate-600 line-clamp-2 italic">"{item.content}"</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 shrink-0" onClick={() => delMut.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Toppers Tab ──────────────────────────────────────────────────────────────

function ToppersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ studentName: "", className: "", marks: "", percentage: "", examType: "Annual", session: "", rank: "1", photoUrl: "" });

  const { data: items = [], isLoading } = useQuery({ queryKey: ["adminToppers"], queryFn: () => apiFetch("/api/website/toppers") });

  const addMut = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/website/toppers", { method: "POST", body: JSON.stringify({ ...data, rank: Number(data.rank) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminToppers"] }); toast({ title: "Topper added" }); setForm({ studentName: "", className: "", marks: "", percentage: "", examType: "Annual", session: "", rank: "1", photoUrl: "" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/toppers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminToppers"] }); toast({ title: "Deleted" }); },
  });

  return (
    <SectionCard title="Academic Toppers" subtitle="Highlight top performing students on homepage" icon={Trophy}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700">Add Topper</h4>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Student name *" value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
            <Input placeholder="Class (e.g. X-A)" value={form.className} onChange={e => setForm(f => ({ ...f, className: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Marks (e.g. 490/500)" value={form.marks} onChange={e => setForm(f => ({ ...f, marks: e.target.value }))} />
            <Input placeholder="Percentage (e.g. 98.00)" type="number" step="0.01" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Exam Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}>
                {["Annual", "Half-Yearly", "Board", "Term 1", "Term 2", "Unit Test"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input placeholder="Session (e.g. 2024-25)" value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} />
            <Input placeholder="Rank" type="number" value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} />
          </div>
          <ImageUploadInput placeholder="Photo URL (optional)" value={form.photoUrl} onChange={url => setForm(f => ({ ...f, photoUrl: url }))} />
          <Button className="w-full bg-[#1e3a6e] text-white" onClick={() => { if (!form.studentName.trim()) { toast({ title: "Student name required", variant: "destructive" }); return; } addMut.mutate(form); }} disabled={addMut.isPending}>
            <Plus className="h-4 w-4 mr-2" />{addMut.isPending ? "Adding…" : "Add Topper"}
          </Button>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-slate-700 mb-3">Current Toppers ({items.length})</h4>
          {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl"><Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No toppers yet</p></div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: item.rank === 1 ? "#FFD700" : item.rank === 2 ? "#C0C0C0" : "#CD7F32", color: item.rank <= 2 ? "#333" : "#fff" }}>
                    #{item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{item.studentName}</div>
                    <div className="text-xs text-slate-500">Class {item.className} · {item.examType} {item.session} · {item.percentage}%</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 shrink-0" onClick={() => delMut.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Downloads Tab ────────────────────────────────────────────────────────────

const DL_CATEGORIES = [
  { v: "general", l: "General" }, { v: "prospectus", l: "Prospectus" }, { v: "admission", l: "Admission Forms" },
  { v: "academic", l: "Academic" }, { v: "circular", l: "Circulars" }, { v: "fee", l: "Fee Structure" },
  { v: "exam", l: "Exam Schedule" }, { v: "timetable", l: "Timetable" }, { v: "notice", l: "Notice" },
  { v: "magazine", l: "School Magazine" }, { v: "rules", l: "Rules & Regulations" }, { v: "event", l: "Events" },
  { v: "parent", l: "Parent Guidelines" }, { v: "student", l: "Student Handbook" }, { v: "annual_report", l: "Annual Report" },
];

export function DownloadsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", category: "general", description: "", fileUrl: "", fileType: "pdf", isFeatured: false });
  const [docUploading, setDocUploading] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["adminDownloads"], queryFn: () => apiFetch("/api/website/downloads") });

  const addMut = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/website/downloads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminDownloads"] }); toast({ title: "Download added" }); setForm({ title: "", category: "general", description: "", fileUrl: "", fileType: "pdf", isFeatured: false }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/downloads/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminDownloads"] }); toast({ title: "Deleted" }); },
  });

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    try {
      const url = await uploadDocumentToCloudinary(file);
      // Auto-detect file type from extension
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      setForm(f => ({ ...f, fileUrl: url, fileType: ext }));
      toast({ title: "File uploaded!", description: file.name });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  const FILE_TYPES = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "png", "zip"];

  return (
    <SectionCard title="Download Center" subtitle="Manage documents available for public download" icon={Download}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="font-semibold text-sm text-slate-700">Add Document</h4>
          <Input placeholder="Document title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Category</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {DL_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">File Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
                {FILE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          {/* File URL + Cloudinary upload */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 block">File (upload via Cloudinary or paste URL)</label>
            <div className="flex gap-1.5">
              <Input
                placeholder="File URL *"
                value={form.fileUrl}
                onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 px-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                disabled={docUploading}
                onClick={() => docFileRef.current?.click()}
                title="Upload document via Cloudinary"
              >
                {docUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </Button>
              <input
                ref={docFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                className="hidden"
                onChange={handleDocFile}
              />
            </div>
            {form.fileUrl && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> File ready
                <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 underline">preview</a>
              </p>
            )}
          </div>
          <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isFeatured} onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">Mark as Featured (shown on homepage)</span>
          </label>
          <Button className="w-full bg-[#1e3a6e] text-white" onClick={() => { if (!form.title.trim() || !form.fileUrl.trim()) { toast({ title: "Title and file required", variant: "destructive" }); return; } addMut.mutate(form); }} disabled={addMut.isPending}>
            <Plus className="h-4 w-4 mr-2" />{addMut.isPending ? "Adding…" : "Add Document"}
          </Button>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-slate-700 mb-3">All Documents ({items.length})</h4>
          {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl"><Download className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No documents yet</p></div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-lg shrink-0">{item.fileType === "pdf" ? "📄" : item.fileType?.includes("doc") ? "📝" : item.fileType?.includes("xls") ? "📊" : "📁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800 truncate">{item.title}</span>
                      {item.isFeatured && <Star className="h-3 w-3 text-amber-400 shrink-0" fill="#f59e0b" />}
                    </div>
                    <div className="text-xs text-slate-500">{DL_CATEGORIES.find(c => c.v === item.category)?.l || item.category} · {item.downloadCount} downloads</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><ExternalLink className="h-3.5 w-3.5" /></a>}
                    <button className="p-1.5 hover:bg-red-50 rounded text-red-500" onClick={() => delMut.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Enquiries Tab ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  admitted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

function EnquiriesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading, refetch } = useQuery({ queryKey: ["adminEnquiries"], queryFn: () => apiFetch("/api/website/enquiries") });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiFetch(`/api/website/enquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminEnquiries"] }); toast({ title: "Status updated" }); },
  });

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const newCount = items.filter((i: any) => i.status === "new").length;

  return (
    <SectionCard title="Help Enquiries" subtitle="Help enquiries submitted via the homepage form" icon={Mail}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {newCount > 0 && <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">{newCount} New</span>}
          <span className="text-sm text-slate-500">Total: {items.length}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="flex items-center gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? <div className="text-sm text-slate-400">Loading…</div> : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl"><Mail className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No enquiries yet</p><p className="text-xs mt-1">They will appear here when parents submit the form on the homepage</p></div>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto">
          {items.map((item: any) => (
            <div key={item.id} className={`border rounded-xl p-4 ${item.status === "new" ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50/50"}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1e3a6e]/10 flex items-center justify-center shrink-0 font-bold text-[#1e3a6e]">{item.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-600"}`}>{item.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {item.phone && <span>📞 {item.phone}</span>}
                    {item.email && <span>✉️ {item.email}</span>}
                    {item.studentClass && <span>🎓 Class: {item.studentClass}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(item.createdAt)}</span>
                  </div>
                  {item.message && <p className="text-xs text-slate-600 mt-2 italic">"{item.message}"</p>}
                </div>
                <div className="shrink-0">
                  <select
                    className="border rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                    value={item.status}
                    onChange={e => updateMut.mutate({ id: item.id, status: e.target.value })}
                  >
                    {["new", "contacted", "admitted", "closed"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Branding Tab ─────────────────────────────────────────────────────────────

function BrandingTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({
    school_name: "", school_short_name: "", school_logo_url: "", school_motto: "", school_tagline: "",
    school_established: "", school_principal_name: "", school_principal_photo: "",
    school_address: "", school_contact_number: "", school_email: "", school_website: "",
    school_facebook: "", school_twitter: "", school_instagram: "", school_youtube: "",
    school_affiliation: "", school_vision: "", school_mission: "",
  });
  const [loaded, setLoaded] = useState(false);

  const { data: branding, isLoading } = useQuery({
    queryKey: ["adminBranding"],
    queryFn: () => apiFetch("/api/website/branding"),
  });

  // Populate form from fetched data once
  useState(() => { if (branding && !loaded) { setForm(f => ({ ...f, ...branding })); setLoaded(true); } });
  if (branding && !loaded) { setForm(f => ({ ...f, ...branding })); setLoaded(true); }

  const saveMut = useMutation({
    mutationFn: (data: Record<string, string>) => apiFetch("/api/website/branding", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminBranding"] }); toast({ title: "Branding saved!", description: "Changes are live on the website." }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  if (isLoading) return <div className="text-sm text-slate-400 py-8 text-center">Loading branding settings…</div>;

  return (
    <div className="space-y-6">
      {/* Identity */}
      <SectionCard title="School Identity" subtitle="Core name, logo, and branding elements" icon={School}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">School Full Name</label>
            <Input placeholder="e.g. Delhi Public School, Gurgaon" value={form.school_name} onChange={set("school_name")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Short Name / Abbreviation</label>
            <Input placeholder="e.g. DPS Gurgaon" value={form.school_short_name} onChange={set("school_short_name")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">School Motto</label>
            <Input placeholder="e.g. Excellence in Education" value={form.school_motto} onChange={set("school_motto")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Homepage Tagline (hero subtitle)</label>
            <Input placeholder="e.g. Nurturing Excellence · Building Character" value={form.school_tagline} onChange={set("school_tagline")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Established Year</label>
            <Input placeholder="e.g. 1985" value={form.school_established} onChange={set("school_established")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Logo URL</label>
            <Input placeholder="https://…/logo.png" value={form.school_logo_url} onChange={set("school_logo_url")} />
          </div>
        </div>
        {form.school_logo_url && (
          <div className="mt-4 flex items-center gap-3">
            <img src={form.school_logo_url} alt="Logo preview" className="h-14 w-14 rounded-full object-cover border-2 border-[#f97316]" onError={e => (e.currentTarget.style.display = "none")} />
            <span className="text-xs text-slate-500">Logo preview</span>
          </div>
        )}
      </SectionCard>

      {/* Leadership */}
      <SectionCard title="School Leadership" subtitle="Principal information shown on the website" icon={User}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Principal's Name</label>
            <Input placeholder="e.g. Dr. Sunita Sharma" value={form.school_principal_name} onChange={set("school_principal_name")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Principal's Photo URL</label>
            <Input placeholder="https://…/principal.jpg" value={form.school_principal_photo} onChange={set("school_principal_photo")} />
          </div>
        </div>
      </SectionCard>

      {/* Contact */}
      <SectionCard title="Contact Information" subtitle="Shown in the header, footer, and contact section" icon={Phone}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Phone Number</label>
            <Input placeholder="e.g. +91-9876543210" value={form.school_contact_number} onChange={set("school_contact_number")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email Address</label>
            <Input type="email" placeholder="e.g. info@school.edu.in" value={form.school_email} onChange={set("school_email")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Website URL</label>
            <Input placeholder="e.g. https://www.school.edu.in" value={form.school_website} onChange={set("school_website")} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Full Address</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. Plot 12, Sector 45, Gurgaon, Haryana 122003" value={form.school_address} onChange={set("school_address")} />
          </div>
        </div>
      </SectionCard>

      {/* About Page Content */}
      <SectionCard title="About Page Content" subtitle="Affiliation, vision, and mission shown on the About page" icon={School}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Affiliation / Board</label>
            <Input placeholder="e.g. CBSE, ICSE, State Board" value={form.school_affiliation} onChange={set("school_affiliation")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">School Vision</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. To empower students with knowledge, skills, and values…" value={form.school_vision} onChange={set("school_vision")} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">School Mission</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. To provide quality education in a safe and supportive environment…" value={form.school_mission} onChange={set("school_mission")} />
          </div>
        </div>
      </SectionCard>

      {/* Social Media */}
      <SectionCard title="Social Media" subtitle="Links shown in the top bar and footer" icon={Link2}>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: "school_facebook", icon: Facebook, label: "Facebook", ph: "https://facebook.com/yourschool", color: "text-blue-600" },
            { key: "school_twitter", icon: Twitter, label: "Twitter / X", ph: "https://twitter.com/yourschool", color: "text-sky-500" },
            { key: "school_instagram", icon: Instagram, label: "Instagram", ph: "https://instagram.com/yourschool", color: "text-pink-500" },
            { key: "school_youtube", icon: Youtube, label: "YouTube", ph: "https://youtube.com/@yourschool", color: "text-red-500" },
          ].map(({ key, icon: Icon, label, ph, color }) => (
            <div key={key}>
              <label className={`text-xs font-medium mb-1.5 flex items-center gap-1.5 ${color}`}><Icon className="h-3.5 w-3.5" />{label}</label>
              <Input placeholder={ph} value={form[key]} onChange={set(key)} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Live Preview Strip */}
      <div className="rounded-2xl border-2 border-dashed border-[#f97316]/40 bg-[#0f2045] p-5 text-white">
        <div className="text-xs text-[#f97316] font-bold tracking-widest mb-3 uppercase">Live Preview — Header</div>
        <div className="flex items-center gap-3">
          {form.school_logo_url ? (
            <img src={form.school_logo_url} alt="logo" className="w-11 h-11 rounded-full object-cover border-2 border-[#f97316]" onError={e => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#f97316] flex items-center justify-center font-bold text-[#0f2045] text-lg">{(form.school_name || "S")[0]}</div>
          )}
          <div>
            <div className="font-bold text-sm">{form.school_name || "Your School Name"}</div>
            <div className="text-xs text-white/60">{form.school_motto || "Excellence in Education"}</div>
          </div>
        </div>
        {(form.school_facebook || form.school_twitter || form.school_instagram || form.school_youtube) && (
          <div className="flex gap-2 mt-3">
            {form.school_facebook && <a href={form.school_facebook} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Facebook className="h-3.5 w-3.5" /></a>}
            {form.school_twitter && <a href={form.school_twitter} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Twitter className="h-3.5 w-3.5" /></a>}
            {form.school_instagram && <a href={form.school_instagram} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Instagram className="h-3.5 w-3.5" /></a>}
            {form.school_youtube && <a href={form.school_youtube} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><Youtube className="h-3.5 w-3.5" /></a>}
          </div>
        )}
      </div>

      <Button className="w-full bg-[#1e3a6e] text-white hover:bg-[#163066] h-11 text-sm font-semibold" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
        <Save className="h-4 w-4 mr-2" />{saveMut.isPending ? "Saving…" : "Save All Branding Settings"}
      </Button>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: sliderData = [] } = useQuery({ queryKey: ["adminSlider"], queryFn: () => apiFetch("/api/website/slider") });
  const { data: galleryData = [] } = useQuery({ queryKey: ["adminGallery"], queryFn: () => apiFetch("/api/website/gallery/albums/all") });
  const { data: testimonialsData = [] } = useQuery({ queryKey: ["adminTestimonials"], queryFn: () => apiFetch("/api/website/testimonials") });
  const { data: toppersData = [] } = useQuery({ queryKey: ["adminToppers"], queryFn: () => apiFetch("/api/website/toppers") });
  const { data: downloadsData = [] } = useQuery({ queryKey: ["adminDownloads"], queryFn: () => apiFetch("/api/website/downloads") });
  const { data: enquiriesData = [] } = useQuery({ queryKey: ["adminEnquiries"], queryFn: () => apiFetch("/api/website/enquiries") });

  const counts = [
    { icon: Image, label: "Hero Slides", count: (sliderData as any[]).length, color: "text-blue-600 bg-blue-50" },
    { icon: ImageIcon, label: "Gallery Albums", count: (galleryData as any[]).length, color: "text-purple-600 bg-purple-50" },
    { icon: MessageSquare, label: "Testimonials", count: (testimonialsData as any[]).length, color: "text-green-600 bg-green-50" },
    { icon: Trophy, label: "Toppers", count: (toppersData as any[]).length, color: "text-amber-600 bg-amber-50" },
    { icon: FileText, label: "Downloads", count: (downloadsData as any[]).length, color: "text-orange-600 bg-orange-50" },
    { icon: Mail, label: "Enquiries", count: (enquiriesData as any[]).length, color: "text-red-600 bg-red-50" },
  ];

  const newEnquiries = (enquiriesData as any[]).filter((e: any) => e.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {counts.map(({ icon: Icon, label, count, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}><Icon className="h-5 w-5" /></div>
            <div className="text-2xl font-bold text-slate-800">{count}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {newEnquiries > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-blue-600 shrink-0" />
          <div>
            <div className="font-semibold text-blue-800">You have {newEnquiries} new enquir{newEnquiries === 1 ? "y" : "ies"}!</div>
            <div className="text-sm text-blue-600">Go to the Enquiries tab to view and respond to help queries.</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-3">Getting Started</h3>
        <div className="space-y-2 text-sm text-slate-600">
          {[
            "Add hero slides to customize the homepage banner",
            "Upload gallery albums and photos to showcase school events",
            "Add parent/alumni testimonials to build trust",
            "Highlight academic toppers to celebrate achievements",
            "Upload important documents in the Download Center",
            "Respond to help enquiries from parents",
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>{tip}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WebsiteSetupTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 flex items-center justify-center"><Globe className="h-6 w-6 text-[#f97316]" /></div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Website Setup</h2>
          <p className="text-sm text-slate-500">Manage content shown on the public school website homepage</p>
        </div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors">
          <ExternalLink className="h-4 w-4" /> View Website
        </a>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex-wrap h-auto gap-1 mb-6">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#f97316] data-[state=active]:shadow-sm text-xs"><Palette className="h-3.5 w-3.5 mr-1.5" />Branding</TabsTrigger>
          <TabsTrigger value="slider" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><Image className="h-3.5 w-3.5 mr-1.5" />Slider</TabsTrigger>
          <TabsTrigger value="gallery" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><Image className="h-3.5 w-3.5 mr-1.5" />Gallery</TabsTrigger>
          <TabsTrigger value="testimonials" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1.5" />Testimonials</TabsTrigger>
          <TabsTrigger value="toppers" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><Trophy className="h-3.5 w-3.5 mr-1.5" />Toppers</TabsTrigger>
          <TabsTrigger value="enquiries" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><Mail className="h-3.5 w-3.5 mr-1.5" />Enquiries</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#1e3a6e] data-[state=active]:shadow-sm text-xs"><Contact className="h-3.5 w-3.5 mr-1.5" />Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="branding"><BrandingTab /></TabsContent>
        <TabsContent value="slider"><SliderTab /></TabsContent>
        <TabsContent value="gallery"><GalleryTab /></TabsContent>
        <TabsContent value="testimonials"><TestimonialsTab /></TabsContent>
        <TabsContent value="toppers"><ToppersTab /></TabsContent>
        <TabsContent value="enquiries"><EnquiriesTab /></TabsContent>
        <TabsContent value="contacts"><ContactsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

type ContactPerson = { id: number; name: string; role: string; phone: string; email: string; department: string; availability: string; sortOrder: number };
const EMPTY_CONTACT = { name: "", role: "", phone: "", email: "", department: "", availability: "Mon–Sat, 8 AM – 4 PM", sortOrder: 0 };

function ContactsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: contacts = [], isLoading } = useQuery<ContactPerson[]>({ queryKey: ["/api/website/contacts"], queryFn: () => apiFetch("/api/website/contacts") });
  const [form, setForm] = useState(EMPTY_CONTACT);
  const [editing, setEditing] = useState<ContactPerson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const upd = (k: keyof typeof EMPTY_CONTACT) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: k === "sortOrder" ? Number(e.target.value) : e.target.value }));

  const saveMut = useMutation({
    mutationFn: () => editing
      ? apiFetch(`/api/website/contacts/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : apiFetch("/api/website/contacts", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/website/contacts"] }); toast({ title: editing ? "Contact updated" : "Contact added" }); setForm(EMPTY_CONTACT); setEditing(null); setShowForm(false); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/website/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/website/contacts"] }); toast({ title: "Contact deleted" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const startEdit = (c: ContactPerson) => { setEditing(c); setForm({ name: c.name, role: c.role, phone: c.phone, email: c.email, department: c.department, availability: c.availability, sortOrder: c.sortOrder }); setShowForm(true); };
  const cancel = () => { setEditing(null); setForm(EMPTY_CONTACT); setShowForm(false); };

  return (
    <div className="space-y-6">
      <SectionCard title="Quick Contacts" subtitle="Manage contacts shown on the public Contact page" icon={Contact}>
        <div className="p-6 space-y-4">
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-[#1e3a6e] hover:bg-[#0f2045] text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Add Contact Person
            </Button>
          )}
          {showForm && (
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
              <h4 className="font-semibold text-slate-700 text-sm">{editing ? "Edit Contact" : "New Contact Person"}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label><Input placeholder="Full Name" value={form.name} onChange={upd("name")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Role / Title</label><Input placeholder="e.g. Principal" value={form.role} onChange={upd("role")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label><Input placeholder="Phone number" value={form.phone} onChange={upd("phone")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Email</label><Input type="email" placeholder="Email address" value={form.email} onChange={upd("email")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Department</label><Input placeholder="e.g. Administration" value={form.department} onChange={upd("department")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Availability</label><Input placeholder="Mon–Sat, 8 AM – 4 PM" value={form.availability} onChange={upd("availability")} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Sort Order</label><Input type="number" placeholder="0" value={form.sortOrder} onChange={upd("sortOrder")} /></div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim()} className="bg-[#1e3a6e] text-white"><Save className="h-3.5 w-3.5 mr-1.5" />{saveMut.isPending ? "Saving…" : editing ? "Update" : "Add"}</Button>
                <Button size="sm" variant="outline" onClick={cancel}>Cancel</Button>
              </div>
            </div>
          )}
          {isLoading ? <p className="text-sm text-slate-400">Loading…</p> : contacts.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><Contact className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No contacts added yet.</p></div>
          ) : (
            <div className="space-y-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-4 bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm">{c.name}</div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.role && <span className="text-xs text-[#f97316] font-medium">{c.role}</span>}
                      {c.department && <span className="text-xs text-slate-400">{c.department}</span>}
                      {c.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.email && <span className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{c.availability}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"><Star className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(c.id)} disabled={deleteMut.isPending} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// Missing import – declare ImageIcon alias
const ImageIcon = Image;
