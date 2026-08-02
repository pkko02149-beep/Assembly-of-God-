import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken } from "@/lib/auth";
import { CalendarRange, Loader2, GraduationCap, ArrowRight } from "lucide-react";

interface CreateSessionModalProps {
  open: boolean;
  onCreated: (session: { id: number; name: string; isCurrent: boolean }) => void;
}

export default function CreateSessionModal({ open, onCreated }: CreateSessionModalProps) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [yearStart, setYearStart] = useState(String(currentYear));
  const [yearEnd, setYearEnd] = useState(String(currentYear + 1));
  const [loading, setLoading] = useState(false);

  const handleYearStartChange = (val: string) => {
    setYearStart(val);
    const n = parseInt(val);
    if (!isNaN(n)) setYearEnd(String(n + 1));
  };

  async function handleCreate() {
    const ys = parseInt(yearStart);
    const ye = parseInt(yearEnd);
    if (isNaN(ys) || isNaN(ye) || ye !== ys + 1) {
      toast({ title: "Invalid year range", description: "End year must be start year + 1", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/academic-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({ yearStart: ys, yearEnd: ye }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to create session", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: `Session ${data.name} created!`, description: "You can now use the system with this academic year." });
      onCreated(data);
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="bg-slate-900 border border-slate-700 text-white max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Welcome! Set Up Academic Year</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-0.5">
                Create your first academic session to get started.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
            <p>Each academic year gets its own <span className="text-amber-400 font-medium">completely separate database</span>. 
            Students, fees, attendance, and all data will be isolated — switching years never mixes records.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Start Year</label>
              <Input
                type="number"
                value={yearStart}
                onChange={(e) => handleYearStartChange(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-center text-lg font-bold h-12"
                min={2000}
                max={2100}
              />
            </div>
            <div className="pt-6">
              <ArrowRight className="h-5 w-5 text-slate-500" />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">End Year</label>
              <Input
                type="number"
                value={yearEnd}
                readOnly
                className="bg-slate-800/50 border-slate-700 text-slate-400 text-center text-lg font-bold h-12 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <CalendarRange className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm text-amber-300 font-medium">
              Academic Session: {yearStart}-{yearEnd}
            </span>
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Session…</>
            ) : (
              <>Create Academic Session</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
