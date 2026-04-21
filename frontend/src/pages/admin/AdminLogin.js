import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { adminLogin } = useAuth();
  const [email, setEmail] = useState("sujalsinghrathore52@gmail.com");
  const [password, setPassword] = useState("Sujal@2004");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Email and password required"); return; }
    setLoading(true);
    setError("");
    try {
      await adminLogin(email.trim(), password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors" data-testid="admin-back-to-home">
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />Back
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-300 border-[3px] border-white rounded-xl shadow-[4px_4px_0px_0px_rgba(253,224,71,0.4)]">
            <ShieldCheck className="w-8 h-8 text-black" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="admin-login-title">Super Admin</h1>
          <p className="text-base text-gray-400 font-medium">Access the admin control panel</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-300">Email</label>
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="admin@campusbite.com" className="input-brutal bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:ring-yellow-400/50" data-testid="admin-email-input" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-300">Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Enter password" className="input-brutal bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:ring-yellow-400/50 pr-12" data-testid="admin-password-input" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white" data-testid="toggle-password-visibility">
                {showPass ? <EyeOff className="w-5 h-5" strokeWidth={2.5} /> : <Eye className="w-5 h-5" strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm font-bold text-red-400 bg-red-900/30 border-2 border-red-500/50 rounded-lg p-2" data-testid="admin-login-error">{error}</p>}

          <button onClick={handleLogin} disabled={loading} className="w-full btn-yellow text-center text-lg flex items-center justify-center gap-2 disabled:opacity-50" data-testid="admin-login-submit" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? "Signing in..." : "Login to Dashboard"}
          </button>
        </div>

        <div className="flex items-center gap-3 justify-center pt-4">
          <div className="w-3 h-3 bg-lime-400 border-2 border-gray-600 rounded-full" />
          <div className="w-3 h-3 bg-pink-400 border-2 border-gray-600 rounded-full" />
          <div className="w-3 h-3 bg-yellow-300 border-2 border-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}
