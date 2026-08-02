import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import AiSettingsSection from "./ai-settings-section";
import { 
  useListVehicles, useCreateVehicle, useDeleteVehicle, getListVehiclesQueryKey,
  useListTrips, useCreateTrip, useDeleteTrip, getListTripsQueryKey,
  useListClasses, useCreateClass, useDeleteClass, getListClassesQueryKey,
  useListSections, useCreateSection, useDeleteSection, getListSectionsQueryKey
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Save, RefreshCw, School, Phone, MapPin, Hash, Image, Bus, Pencil, X, Check, Layers, FileText, Mail, Building2, Cloud, Upload, CheckCircle, AlertCircle, Map, CreditCard, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FeeSetupTab } from "./fees-tab";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getAdminToken } from "@/lib/auth";

function authHeader(): Record<string, string> {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─────────────────────────────────────────────────────────────────────────────
// School Info Section
// ─────────────────────────────────────────────────────────────────────────────

function SchoolInfoSection() {
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState("");
  const [udiseCode, setUdiseCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [schoolGmail, setSchoolGmail] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolMotto, setSchoolMotto] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings/school-info")
      .then(r => r.json())
      .then(data => {
        setSchoolName(data.schoolName || "");
        setUdiseCode(data.udiseCode || "");
        setLogoUrl(data.logoUrl || "");
        setAddress(data.address || "");
        setContactNumber(data.contactNumber || "");
        setReceiptFooter(data.receiptFooter || "");
        setSchoolGmail(data.schoolGmail || "");
        setRegistrationNo(data.registrationNo || "");
        setSchoolWebsite(data.schoolWebsite || "");
        setSchoolMotto(data.schoolMotto || "");
        setMapsUrl(data.mapsUrl || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!schoolName.trim()) {
      toast({ title: "School name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/school-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, udiseCode, logoUrl, address, contactNumber, receiptFooter, schoolGmail, registrationNo, schoolWebsite, schoolMotto, mapsUrl }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: "School information saved successfully" });
      } else {
        toast({ title: "Failed to save school information", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden col-span-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center gap-3">
        <div className="h-9 w-9 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
          <School className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">School Information</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">School identity used as title and header throughout the system</p>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-slate-400 animate-pulse">Loading saved settings…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <School className="h-3.5 w-3.5 text-teal-600" />
                  School Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Delhi Public School"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-teal-600" />
                  U-DISE Code
                </label>
                <Input
                  placeholder="e.g. 09010101101"
                  value={udiseCode}
                  onChange={e => setUdiseCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  School Registration No.
                </label>
                <Input
                  placeholder="e.g. REG/2010/001234"
                  value={registrationNo}
                  onChange={e => setRegistrationNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-teal-600" />
                  Contact Number
                </label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-teal-600" />
                  School Gmail / Email
                </label>
                <Input
                  type="email"
                  placeholder="e.g. principal@schoolname.edu.in"
                  value={schoolGmail}
                  onChange={e => setSchoolGmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5 text-teal-600" />
                  School Website URL
                </label>
                <Input
                  type="url"
                  placeholder="e.g. www.schoolname.edu.in"
                  value={schoolWebsite}
                  onChange={e => setSchoolWebsite(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-teal-600" />
                  School Motto
                </label>
                <Input
                  placeholder="e.g. Knowledge • Values • Excellence"
                  value={schoolMotto}
                  onChange={e => setSchoolMotto(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-teal-600" />
                  School Logo
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Logo URL (auto-filled after upload)"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {logoUploading ? "" : " Upload"}
                  </Button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoUploading(true);
                      try {
                        const url = await uploadToCloudinary(file);
                        setLogoUrl(url);
                        toast({ title: "Logo uploaded to Cloudinary!" });
                      } catch (err: any) {
                        toast({ title: err.message || "Upload failed", variant: "destructive" });
                      } finally {
                        setLogoUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400">Click Upload to upload via Cloudinary, or paste a URL directly.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-teal-600" />
                Address
              </label>
              <Input
                placeholder="e.g. 123 School Road, New Delhi - 110001"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5 text-teal-600" />
                Google Maps Embed URL
              </label>
              <Input
                placeholder="Paste the src URL from Google Maps → Share → Embed a map"
                value={mapsUrl}
                onChange={e => setMapsUrl(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                In Google Maps: search your school → Share → Embed a map → copy only the <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">src="…"</code> URL from the iframe code. If left blank, the address above is used automatically.
              </p>
              {mapsUrl && (
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height: 180 }}>
                  <iframe
                    title="Map preview"
                    src={mapsUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-teal-600" />
                Receipt Footer Message
              </label>
              <textarea
                className="w-full border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={2}
                placeholder="e.g. Thank you for your payment. — Principal's Office"
                value={receiptFooter}
                onChange={e => setReceiptFooter(e.target.value)}
              />
              <p className="text-xs text-slate-400">This message appears at the bottom of all printed fee receipts. Leave blank to use the default.</p>
            </div>

            {logoUrl && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                <img
                  src={logoUrl}
                  alt="School logo preview"
                  className="h-12 w-auto max-w-[80px] object-contain rounded border border-slate-200 dark:border-slate-700 bg-white"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Logo preview</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">This logo appears on certificates and receipts.</p>
                </div>
              </div>
            )}

            <div className="pt-1">
              <Button
                onClick={handleSave}
                disabled={saving || !schoolName.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                {saving
                  ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</>
                  : <><Save className="h-4 w-4 mr-1.5" /> Save School Information</>
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport Fee Setup Section
// ─────────────────────────────────────────────────────────────────────────────

interface TransportRoute {
  id: number;
  name: string;
  pricePerMonth: number;
}

function TransportFeeSetupSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [routeName, setRouteName] = useState("");
  const [routePrice, setRoutePrice] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const { data: routes = [], isLoading } = useQuery<TransportRoute[]>({
    queryKey: ["transport-routes"],
    queryFn: async () => {
      const res = await fetch("/api/transport-routes");
      if (!res.ok) throw new Error("Failed to fetch transport routes");
      return res.json();
    },
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!routeName.trim() || !routePrice) return;
    try {
      const res = await fetch("/api/transport-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: routeName.trim(), pricePerMonth: parseFloat(routePrice) || 0 }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      setRouteName("");
      setRoutePrice("");
      toast({ title: "Transport route added" });
    } catch {
      toast({ title: "Failed to add route", variant: "destructive" });
    }
  }

  async function handleEdit(id: number) {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/transport-routes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), pricePerMonth: parseFloat(editPrice) || 0 }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      setEditId(null);
      toast({ title: "Route updated" });
    } catch {
      toast({ title: "Failed to update route", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/transport-routes/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
      toast({ title: "Route deleted" });
    } catch {
      toast({ title: "Failed to delete route", variant: "destructive" });
    }
  }

  function startEdit(route: TransportRoute) {
    setEditId(route.id);
    setEditName(route.name);
    setEditPrice(String(route.pricePerMonth));
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm overflow-hidden col-span-full">
      <div className="p-4 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-3">
        <div className="h-9 w-9 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
          <Bus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Transport Fee Setup</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Define transport routes and their monthly fee. Assign routes to students when adding/editing records.</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="text-sm text-slate-400 animate-pulse">Loading routes…</div>
        ) : routes.length === 0 ? (
          <div className="text-sm text-slate-400 py-2">No transport routes defined yet. Add your first route below.</div>
        ) : (
          <div className="space-y-2">
            {routes.map(route => (
              <div key={route.id} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800">
                {editId === route.id ? (
                  <>
                    <Input
                      className="h-8 text-sm flex-1"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Route name"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">₹</span>
                      <Input
                        className="h-8 text-sm w-28"
                        type="number"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        placeholder="Price/month"
                      />
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:text-green-700" onClick={() => handleEdit(route.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={() => setEditId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Bus className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{route.name}</span>
                    </div>
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                      ₹{route.pricePerMonth.toLocaleString("en-IN")}/month
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={() => startEdit(route)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(route.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new route */}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-amber-100 dark:border-amber-800">
          <Input
            placeholder="Route name (e.g. Zone A — Sector 12)"
            value={routeName}
            onChange={e => setRouteName(e.target.value)}
            className="flex-1 bg-white dark:bg-slate-900"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm text-slate-500 font-medium">₹</span>
            <Input
              type="number"
              placeholder="Price per month"
              value={routePrice}
              onChange={e => setRoutePrice(e.target.value)}
              className="w-36 bg-white dark:bg-slate-900"
              min="0"
              step="1"
            />
          </div>
          <Button
            type="submit"
            disabled={!routeName.trim() || !routePrice}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Route
          </Button>
        </form>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          After adding routes here, you can assign them to students in the Records tab when the bus option is enabled.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary Integration Section
// ─────────────────────────────────────────────────────────────────────────────

function CloudinarySection() {
  const { toast } = useToast();
  const [cloudName, setCloudName] = useState("");
  const [uploadPreset, setUploadPreset] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/settings/cloudinary")
      .then(r => r.json())
      .then(d => {
        setCloudName(d.cloudName || "");
        setUploadPreset(d.uploadPreset || "");
        if (d.configured) setStatus("ok");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      toast({ title: "Cloud Name and Upload Preset are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/cloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ cloudName, uploadPreset }),
      });
      if (res.ok) {
        toast({ title: "Cloudinary settings saved!" });
        setStatus("ok");
      } else {
        toast({ title: "Failed to save Cloudinary settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!cloudName.trim() || !uploadPreset.trim()) {
      toast({ title: "Save settings first", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: (() => {
          const fd = new FormData();
          const blob = new Blob(["test"], { type: "text/plain" });
          fd.append("file", blob, "test.txt");
          fd.append("upload_preset", uploadPreset);
          return fd;
        })(),
      });
      if (res.ok || res.status === 400) {
        setStatus("ok");
        toast({ title: "Cloudinary connection verified!" });
      } else {
        setStatus("error");
        toast({ title: "Cloudinary test failed — check your credentials", variant: "destructive" });
      }
    } catch {
      setStatus("error");
      toast({ title: "Could not reach Cloudinary", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl shadow-sm overflow-hidden col-span-full">
      <div className="p-4 border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-3">
        <div className="h-9 w-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            Cloudinary Integration
            {status === "ok" && <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" /> Connected</span>}
            {status === "error" && <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" /> Error</span>}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cloud image storage for logos, gallery, slider, and all website images</p>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="text-sm text-slate-400 animate-pulse">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">How to set up (free):</p>
              <p>1. Sign up free at <a href="https://cloudinary.com/signup" target="_blank" rel="noopener" className="underline font-medium">cloudinary.com/signup</a></p>
              <p>2. Copy your <strong>Cloud Name</strong> from the dashboard</p>
              <p>3. Go to <strong>Settings → Upload → Upload Presets</strong> and create an <strong>unsigned</strong> preset</p>
              <p>4. Paste both below and click Save — all image uploads will then use Cloudinary automatically</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cloud Name</label>
                <Input placeholder="e.g. my-school-cloud" value={cloudName} onChange={e => setCloudName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload Preset (unsigned)</label>
                <Input placeholder="e.g. school_uploads" value={uploadPreset} onChange={e => setUploadPreset(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-1.5" />Save Cloudinary Settings</>}
              </Button>
              <Button onClick={handleTest} disabled={testing || !cloudName || !uploadPreset} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                {testing ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Testing…</> : <><Cloud className="h-4 w-4 mr-1.5" />Test Connection</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payment Gateway Section
// ─────────────────────────────────────────────────────────────────────────────

function RazorpaySettingsSection() {
  const { toast } = useToast();
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [secretTouched, setSecretTouched] = useState(false); // only send secret if user explicitly changed it
  const [mode, setMode] = useState<"test" | "live">("test");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/settings/razorpay", { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setKeyId(data.keyId || "");
        setKeySecret(data.keySecret || ""); // will be "••••…" if already set
        setMode(data.mode === "live" ? "live" : "test");
        setConfigured(!!data.configured);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!keyId.trim()) {
      toast({ title: "Key ID is required", variant: "destructive" });
      return;
    }
    if (!configured && !secretTouched) {
      toast({ title: "Please enter the Key Secret to set up Razorpay", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Only include keySecret in payload if the user actually typed a new one
      const body: Record<string, string> = { keyId: keyId.trim(), mode };
      if (secretTouched && keySecret.trim()) body.keySecret = keySecret.trim();

      const res = await fetch("/api/settings/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfigured(true);
        setKeySecret("••••••••••••••••");
        toast({ title: "Razorpay settings saved successfully!" });
      } else {
        toast({ title: data.error || "Failed to save settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-xl shadow-sm overflow-hidden col-span-full">
      <div className="p-4 border-b border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 flex items-center gap-3">
        <div className="h-9 w-9 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
            Payment Gateway (Razorpay)
            {configured && <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><ShieldCheck className="h-3 w-3" /> Configured</span>}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enable UPI online fee collection from the parent portal · Get keys at{" "}
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener" className="underline text-violet-600">dashboard.razorpay.com</a>
          </p>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="text-sm text-slate-400 animate-pulse">Loading…</div>
        ) : (
          <div className="space-y-5">
            {/* Setup guide */}
            <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-xs text-violet-700 space-y-1">
              <p className="font-semibold">How to set up:</p>
              <p>1. Sign up / log in at <a href="https://razorpay.com" target="_blank" rel="noopener" className="underline font-medium">razorpay.com</a></p>
              <p>2. Go to <strong>Settings → API Keys</strong> — generate test keys first to try it out</p>
              <p>3. Paste the <strong>Key ID</strong> and <strong>Key Secret</strong> below</p>
              <p>4. Switch to <strong>Live</strong> mode and generate live keys when ready to go live</p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mode</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                <button
                  onClick={() => setMode("test")}
                  className={`px-4 py-1.5 font-medium transition-colors ${mode === "test" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  Test
                </button>
                <button
                  onClick={() => setMode("live")}
                  className={`px-4 py-1.5 font-medium transition-colors ${mode === "live" ? "bg-green-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  Live
                </button>
              </div>
              {mode === "test" && <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Test mode — no real money</span>}
              {mode === "live" && <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Live mode — real payments</span>}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Key ID <span className="text-slate-400 font-normal">(starts with rzp_test_ or rzp_live_)</span>
                </label>
                <Input
                  placeholder="rzp_test_xxxxxxxxxxxx"
                  value={keyId}
                  onChange={e => setKeyId(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Key Secret</label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    placeholder="Your Razorpay secret key"
                    value={keySecret}
                    onChange={e => { setKeySecret(e.target.value); setSecretTouched(true); }}
                    className="font-mono text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:text-slate-400 text-white transition-colors"
              >
                {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Razorpay Settings</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Tab
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsTab() {
  const thisYear = new Date().getFullYear();
  const [feeSession, setFeeSession] = useState(`${thisYear}-${(thisYear + 1).toString().slice(2)}`);

  // Sync fee session to the actual current academic session from the API
  useEffect(() => {
    fetch("/api/academic-sessions/status")
      .then(r => r.json())
      .then((data: { currentSession?: { name: string } | null }) => {
        if (data?.currentSession?.name) setFeeSession(data.currentSession.name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 col-span-full">
        <SchoolInfoSection />
      </div>
      <div className="grid grid-cols-1 col-span-full">
        <CloudinarySection />
      </div>
      <div className="grid grid-cols-1 col-span-full">
        <RazorpaySettingsSection />
      </div>
      <div className="grid grid-cols-1 col-span-full">
        <TransportFeeSetupSection />
      </div>

      {/* Fee Setup Section — moved from Fee Management tab */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden col-span-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <Layers className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Fee Setup</h3>
              <p className="text-sm text-slate-500">Configure fee categories and class-wise fee structures</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Session:</label>
            <input
              className="border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-28"
              value={feeSession}
              onChange={e => setFeeSession(e.target.value)}
              placeholder="2025-26"
            />
          </div>
        </div>
        <div className="p-5">
          <FeeSetupTab session={feeSession} />
        </div>
      </div>

      <div className="grid grid-cols-1 col-span-full">
        <AiSettingsSection />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <EntityManager
          title="Vehicles"
          useList={useListVehicles}
          useCreate={useCreateVehicle}
          useDelete={useDeleteVehicle}
          queryKey={getListVehiclesQueryKey()}
          placeholder="Add a new vehicle (e.g. Bus 1)"
        />
        <EntityManager
          title="Trips"
          useList={useListTrips}
          useCreate={useCreateTrip}
          useDelete={useDeleteTrip}
          queryKey={getListTripsQueryKey()}
          placeholder="Add a new trip (e.g. Morning Route)"
        />
        <EntityManager
          title="Classes"
          useList={useListClasses}
          useCreate={useCreateClass}
          useDelete={useDeleteClass}
          queryKey={getListClassesQueryKey()}
          placeholder="Add a new class (e.g. Grade 1)"
        />
        <EntityManager
          title="Sections"
          useList={useListSections}
          useCreate={useCreateSection}
          useDelete={useDeleteSection}
          queryKey={getListSectionsQueryKey()}
          placeholder="Add a new section (e.g. A)"
        />
      </div>
    </div>
  );
}

interface EntityManagerProps {
  title: string;
  useList: any;
  useCreate: any;
  useDelete: any;
  queryKey: any;
  placeholder: string;
}

function EntityManager({ title, useList, useCreate, useDelete, queryKey, placeholder }: EntityManagerProps) {
  const [newValue, setNewValue] = useState("");
  const { data: items = [], isLoading } = useList();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createItem = useCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
        setNewValue("");
        toast({ title: `${title.slice(0, -1)} added successfully` });
      }
    }
  });

  const deleteItem = useDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
        toast({ title: `${title.slice(0, -1)} deleted` });
      }
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    createItem.mutate({ data: { name: newValue.trim() } });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{title}</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="text-center text-slate-500 py-4">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-500 py-4">No {title.toLowerCase()} found.</div>
        ) : (
          items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800" data-testid={`item-${title.toLowerCase()}-${item.id}`}>
              <span className="font-medium">{item.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => deleteItem.mutate({ id: item.id })}
                data-testid={`btn-del-${title.toLowerCase()}-${item.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input 
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={placeholder}
            className="bg-white dark:bg-slate-900"
            data-testid={`input-add-${title.toLowerCase()}`}
          />
          <Button 
            type="submit" 
            disabled={createItem.isPending || !newValue.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950"
            data-testid={`btn-add-${title.toLowerCase()}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
