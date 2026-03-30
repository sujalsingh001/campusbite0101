import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChefHat, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CanteenLogin() {
  const navigate = useNavigate();
  const { staffLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    setLoading(true);
    setError("");
    try {
      await staffLogin(email.trim(), password);
      navigate("/canteen/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-black transition-colors" data-testid="canteen-back-to-home">
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />Back
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-pink-400 border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <ChefHat className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="canteen-login-title">Canteen Staff</h1>
          <p className="text-base text-gray-600 font-medium">Sign in with your staff credentials</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-700">Email</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="e.g. maincanteen@ait.edu" className="input-brutal" data-testid="canteen-email-input" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-700">Password</label>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Enter password" className="input-brutal" data-testid="canteen-password-input" />
          </div>

          {error && <p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2" data-testid="canteen-login-error">{error}</p>}

          <button onClick={handleLogin} disabled={loading} className="w-full btn-pink text-center text-lg flex items-center justify-center gap-2 disabled:opacity-50" data-testid="canteen-login-submit">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <div className="flex items-center gap-3 justify-center pt-2">
          <div className="w-3 h-3 bg-lime-400 border-2 border-black rounded-full" />
          <div className="w-3 h-3 bg-pink-400 border-2 border-black rounded-full" />
          <div className="w-3 h-3 bg-yellow-300 border-2 border-black rounded-full" />
        </div>
      </div>
    </div>
  );
}
