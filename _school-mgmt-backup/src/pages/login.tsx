import { useState } from "react";
import { useLocation, Link } from "wouter";
import { loginWithServer, staffLoginWithServer } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, ChevronDown } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [role, setRole] = useState<"admin" | "staff">("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast({ title: "Username and password are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    if (role === "admin") {
      const result = await loginWithServer(username.trim(), password);
      setLoading(false);
      if (result.ok) {
        setLocation("/admin");
      } else {
        toast({ title: "Invalid credentials", description: result.error || "Please check your username and password.", variant: "destructive" });
      }
    } else {
      const result = await staffLoginWithServer(username.trim(), password);
      setLoading(false);
      if (result.ok) {
        setLocation("/admin");
      } else {
        toast({ title: "Invalid credentials", description: result.error || "Please check your username and password.", variant: "destructive" });
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
            <Shield className="h-8 w-8 text-slate-950" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Admin Portal
          </h1>
          <p className="text-slate-400 mt-2">School Management System</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Login as</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(v => !v)}
                  className="w-full h-12 bg-slate-950 border border-slate-800 rounded-md px-3 flex items-center justify-between text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <span>{role === "admin" ? "Admin" : "Staff"}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showRoleDropdown ? "rotate-180" : ""}`} />
                </button>
                {showRoleDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setRole("admin"); setShowRoleDropdown(false); }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-800 transition-colors ${role === "admin" ? "text-amber-400 font-semibold" : "text-white"}`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRole("staff"); setShowRoleDropdown(false); }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-800 transition-colors border-t border-slate-800 ${role === "staff" ? "text-amber-400 font-semibold" : "text-white"}`}
                    >
                      Staff
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500 h-12"
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Password</label>
                {role === "admin" && (
                  <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors" data-testid="link-forgot-password">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="bg-slate-950 border-slate-800 text-white focus-visible:ring-amber-500 h-12"
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg"
              data-testid="button-login"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-slate-500 hover:text-white transition-colors" data-testid="link-public-roster">
            &larr; Back to Public Roster
          </Link>
        </div>
      </div>
    </div>
  );
}
