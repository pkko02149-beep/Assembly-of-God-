import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { Bot, Save, ShieldCheck, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Sparkles, GraduationCap, Users } from "lucide-react";

const GROQ_MODELS = [
  { value: "llama-3.3-70b-versatile",  label: "Llama 3.3 70B Versatile (Best Quality)" },
  { value: "llama-3.1-70b-versatile",  label: "Llama 3.1 70B Versatile (Powerful)" },
  { value: "llama-3.1-8b-instant",     label: "Llama 3.1 8B Instant (Fastest)" },
  { value: "mixtral-8x7b-32768",       label: "Mixtral 8x7B (Large Context)" },
  { value: "gemma2-9b-it",             label: "Gemma 2 9B (Balanced)" },
];

type ConfigId = "general" | "teacher" | "student";

interface AiConfig {
  enabled: boolean;
  apiKey: string;
  hasKey: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface ConfigCardProps {
  configId: ConfigId;
  title: string;
  description: string;
  usedFor: string[];
  icon: React.ReactNode;
  iconBg: string;
}

function ConfigCard({ configId, title, description, usedFor, icon, iconBg }: ConfigCardProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AiConfig>({
    enabled: false, apiKey: "", hasKey: false,
    model: "llama-3.3-70b-versatile", temperature: 0.7, maxTokens: 2048,
  });
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ ok: boolean; message: string } | null>(null);

  function authHeader() {
    const t = getAdminToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  useEffect(() => {
    fetch(`/api/settings/ai/${configId}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((data) => {
        setConfig({ ...data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [configId]);

  async function handleSave() {
    setSaving(true);
    setValidationResult(null);
    try {
      const res = await fetch(`/api/settings/ai/${configId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          enabled: config.enabled,
          apiKey: config.apiKey,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: `${title} settings saved` });
        const refreshed = await fetch(`/api/settings/ai/${configId}`, { headers: authHeader() }).then((r) => r.json());
        setConfig(refreshed);
      } else {
        toast({ title: data.error || "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch(`/api/settings/ai/${configId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ apiKey: config.apiKey, model: config.model }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ ok: false, message: "❌ Connection failed" });
    } finally {
      setValidating(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 ${iconBg} rounded-xl flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor={`ai-${configId}-enabled`} className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {config.enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id={`ai-${configId}-enabled`}
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Used for */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Used for:</p>
          <div className="flex flex-wrap gap-1.5">
            {usedFor.map((u) => (
              <span key={u} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                {u}
              </span>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            Groq API Key
            <span className="text-xs font-normal text-slate-400 ml-1">(stored encrypted)</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={config.hasKey ? "••••••••  (key saved — enter new key to update)" : "Enter Groq API Key (gsk_...)"}
                value={config.apiKey}
                onChange={(e) => { setConfig((c) => ({ ...c, apiKey: e.target.value })); setValidationResult(null); }}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={validating || (!config.apiKey || config.apiKey.startsWith("••"))}
              className="shrink-0"
            >
              {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Test</span>
            </Button>
          </div>
          {validationResult && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${validationResult.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
              {validationResult.ok
                ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              {validationResult.message}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Get your free API key at{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
              console.groq.com/keys
            </a>
          </p>
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Groq Model</Label>
          <Select value={config.model} onValueChange={(v) => setConfig((c) => ({ ...c, model: v }))}>
            <SelectTrigger className="bg-white dark:bg-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROQ_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Temperature + Max Tokens */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Temperature <span className="text-slate-400 font-normal">({config.temperature})</span>
            </Label>
            <Input
              type="number"
              min={0} max={2} step={0.1}
              value={config.temperature}
              onChange={(e) => setConfig((c) => ({ ...c, temperature: parseFloat(e.target.value) || 0.7 }))}
            />
            <p className="text-xs text-slate-400">0 = precise · 1 = creative · 2 = wild</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max Output Tokens</Label>
            <Input
              type="number"
              min={256} max={8192} step={256}
              value={config.maxTokens}
              onChange={(e) => setConfig((c) => ({ ...c, maxTokens: parseInt(e.target.value) || 2048 }))}
            />
            <p className="text-xs text-slate-400">Max 8192 tokens</p>
          </div>
        </div>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save {title} Settings
        </Button>
      </div>
    </div>
  );
}

export default function AiSettingsSection() {
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden col-span-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
            <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              🤖 AI Settings — Powered by Groq
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure separate Groq AI for different user roles. API keys are stored encrypted and never exposed to the frontend.
            </p>
          </div>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <strong>Security:</strong> Only Admin can view or edit AI settings. API keys are AES-256 encrypted before being stored. Teachers, students, and parents can only use the AI — they never see the keys.
          </p>
        </div>
      </div>

      {/* Three config cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ConfigCard
          configId="general"
          title="General AI"
          description="For admin tasks and general school communication"
          usedFor={["Notices", "Circulars", "Letters", "School Announcements", "General AI Assistant"]}
          icon={<Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
        />
        <ConfigCard
          configId="teacher"
          title="Teacher AI"
          description="For teachers to create educational content"
          usedFor={["Lesson Plan Generator", "Homework Generator", "Question Papers", "MCQ Generator", "Worksheets", "Classroom Activities"]}
          icon={<GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
        />
        <ConfigCard
          configId="student"
          title="Student & Parent AI"
          description="For students and parents to get academic help"
          usedFor={["Academic Assistant", "Homework Help", "Chapter Explanation", "Practice Questions", "Attendance Queries", "Fee Queries", "Report Card Explanation", "School Information"]}
          icon={<Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-100 dark:bg-teal-900/30"
        />
      </div>
    </div>
  );
}
