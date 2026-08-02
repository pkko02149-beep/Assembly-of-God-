import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Image as ImageIcon, X, ChevronLeft, ChevronRight,
  Calendar, Menu, ArrowLeft, ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAVY = "#1e3a6e";
const DARK = "#0f2045";
const GOLD = "#f97316";

const GRADIENTS = [
  "from-blue-600 to-blue-900",
  "from-emerald-600 to-emerald-900",
  "from-purple-600 to-purple-900",
  "from-rose-600 to-rose-900",
  "from-amber-500 to-orange-800",
  "from-cyan-600 to-cyan-900",
];

interface GalleryAlbum {
  id: number;
  name: string;
  description: string;
  coverImageUrl: string;
  albumDate: string | null;
}

interface GalleryPhoto {
  id: number;
  albumId: number;
  imageUrl: string;
  caption: string;
  displayOrder: number;
}

interface Branding {
  school_name: string;
  school_logo_url: string;
  school_tagline: string;
}

function NavBar({ branding }: { branding?: Branding }) {
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
    { l: "Gallery", h: "/gallery" }, { l: "Downloads", h: "/downloads" }, { l: "Contact", h: "/contact" },
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-300 ${scrolled ? "shadow-xl" : "shadow-sm"} border-b border-gray-100`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => go("/")} className="flex items-center gap-3 group">
            {branding?.school_logo_url
              ? <img src={branding.school_logo_url} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
              : <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: `linear-gradient(135deg, ${NAVY}, ${DARK})` }}>{(branding?.school_name || "S")[0]}</div>
            }
            <div className="text-left">
              <div className="font-bold text-sm leading-tight" style={{ color: NAVY }}>{branding?.school_name || "School Management System"}</div>
              <div className="text-xs text-slate-500 leading-tight">{branding?.school_tagline || "Excellence in Education"}</div>
            </div>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ l, h }) => (
              <button key={l} onClick={() => go(h)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${l === "Gallery" ? "text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
                style={l === "Gallery" ? { backgroundColor: NAVY } : {}}>
                {l}
              </button>
            ))}
          </nav>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ l, h }) => (
                <button key={l} onClick={() => go(h)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  {l}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function LightBox({ photos, startIndex, onClose }: { photos: GalleryPhoto[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx(i => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [photos.length, onClose]);

  const photo = photos[idx];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
        <X className="h-6 w-6" />
      </button>
      <button onClick={e => { e.stopPropagation(); setIdx(i => Math.max(0, i - 1)); }}
        disabled={idx === 0}
        className="absolute left-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors disabled:opacity-20">
        <ChevronLeft className="h-7 w-7" />
      </button>
      <div className="max-w-5xl max-h-screen px-16 py-16 flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <img src={photo.imageUrl} alt={photo.caption || `Photo ${idx + 1}`}
          className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl" />
        {photo.caption && (
          <p className="text-white/80 text-sm text-center max-w-lg">{photo.caption}</p>
        )}
        <p className="text-white/40 text-xs">{idx + 1} / {photos.length}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); setIdx(i => Math.min(photos.length - 1, i + 1)); }}
        disabled={idx === photos.length - 1}
        className="absolute right-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors disabled:opacity-20">
        <ChevronRight className="h-7 w-7" />
      </button>
    </motion.div>
  );
}

function AlbumView({ album, onBack }: { album: GalleryAlbum; onBack: () => void }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const { data: photos = [], isLoading } = useQuery<GalleryPhoto[]>({
    queryKey: ["galleryPhotos", album.id],
    queryFn: () => fetch(`/api/website/gallery/albums/${album.id}/photos`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80 transition-opacity" style={{ color: NAVY }}>
          <ArrowLeft className="h-4 w-4" /> Back to Albums
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {album.coverImageUrl && (
            <img src={album.coverImageUrl} alt={album.name} className="w-24 h-24 rounded-xl object-cover shadow-md shrink-0" />
          )}
          <div>
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>{album.name}</h2>
            {album.description && <p className="text-slate-500 mt-1">{album.description}</p>}
            {album.albumDate && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-400">
                <Calendar className="h-4 w-4" />
                {new Date(album.albumDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-slate-200 animate-pulse" />)}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No photos in this album yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, i) => (
            <motion.div key={photo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="group relative rounded-xl overflow-hidden aspect-square cursor-pointer shadow-sm hover:shadow-lg transition-shadow"
              onClick={() => setLightboxIdx(i)}>
              <img src={photo.imageUrl} alt={photo.caption || `Photo ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-white text-xs leading-snug line-clamp-2">{photo.caption}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightboxIdx !== null && (
          <LightBox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GalleryPage() {
  const [, setLocation] = useLocation();
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);

  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => fetch("/api/website/branding").then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const { data: albums = [], isLoading } = useQuery<GalleryAlbum[]>({
    queryKey: ["galleryAlbums"],
    queryFn: () => fetch("/api/website/gallery/albums").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <NavBar branding={branding} />

      {/* Page Hero */}
      <div className="py-10 px-4" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${DARK} 100%)` }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
            <button onClick={() => setLocation("/")} className="hover:text-white transition-colors">Home</button>
            <span>/</span>
            <span className="text-white">Gallery</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Photo Gallery</h1>
          <p className="text-white/70">Explore moments from our school events and activities</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {selectedAlbum ? (
          <AlbumView album={selectedAlbum} onBack={() => setSelectedAlbum(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">All Albums</h2>
              <span className="text-sm text-slate-500">{albums.length} album{albums.length !== 1 ? "s" : ""}</span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="h-48 bg-slate-200 animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : albums.length === 0 ? (
              <div className="text-center py-24 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                <ImageIcon className="h-14 w-14 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium text-slate-500">No albums yet</p>
                <p className="text-sm mt-1">Albums will appear here once added from the admin panel.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {albums.map((album, i) => (
                  <motion.div key={album.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group border border-slate-100"
                    onClick={() => setSelectedAlbum(album)}>
                    <div className="relative h-48 overflow-hidden">
                      {album.coverImageUrl
                        ? <img src={album.coverImageUrl} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-center justify-center`}>
                            <ImageIcon className="h-12 w-12 text-white/40" />
                          </div>
                      }
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-slate-800 group-hover:text-[#1e3a6e] transition-colors line-clamp-1">{album.name}</h3>
                      {album.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{album.description}</p>
                      )}
                      {album.albumDate && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(album.albumDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: GOLD }}>
                        View Photos <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 py-8 px-4 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} {branding?.school_name || "School Management System"}. All rights reserved.</p>
          <button onClick={() => setLocation("/")} className="text-sm flex items-center gap-1.5 font-medium hover:opacity-80 transition-opacity" style={{ color: NAVY }}>
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>
        </div>
      </footer>
    </div>
  );
}
