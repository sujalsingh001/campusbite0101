import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, ArrowLeft, Loader2, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function isValidAuid(val) {
  if (val.length <= 7) return false;
  const hasLetter = /[A-Za-z]/.test(val);
  const hasNumber = /[0-9]/.test(val);
  return hasLetter && hasNumber;
}

export default function StudentLogin() {
  const navigate = useNavigate();
  const { studentLogin } = useAuth();
  const [auid, setAuid] = useState("");
  const [phone, setPhone] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuidChange = (e) => {
    const val = e.target.value.toUpperCase();
    setAuid(val);
    setError("");
    if (usePhone) setUsePhone(false);
  };

  const handleLogin = async () => {
    setError("");

    if (usePhone) {
      const trimmedPhone = phone.trim();
      if (!trimmedPhone || trimmedPhone.length < 10) {
        setError("Please enter a valid 10-digit phone number");
        return;
      }
      setLoading(true);
      try {
        await studentLogin(null, trimmedPhone);
        navigate("/student/menu");
      } catch (err) {
        setError(err.response?.data?.detail || "Login failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmed = auid.trim();
    if (!trimmed) {
      setError("Please enter your AUID");
      return;
    }

    if (!isValidAuid(trimmed)) {
      setError("AUID must be more than 7 characters and contain both letters & numbers. Use phone number instead.");
      setUsePhone(true);
      return;
    }

    setLoading(true);
    try {
      await studentLogin(trimmed);
      navigate("/student/menu");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FEFCE8] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-black transition-colors"
          data-testid="back-to-home"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          Back
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-lime-400 border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <UtensilsCrossed className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="login-title">
            Hey there!
          </h1>
          <p className="text-base text-gray-600 font-medium">
            {usePhone ? "Enter your phone number to start ordering" : "Enter your AUID to start ordering"}
          </p>
        </div>

        <div className="space-y-4">
          {!usePhone ? (
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-700">Your AUID</label>
              <input
                type="text"
                value={auid}
                onChange={handleAuidChange}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="e.g. AIT24BEIS073"
                className="input-brutal"
                data-testid="auid-input"
              />
              <p className="text-xs text-gray-400 font-medium">Must be 7+ characters with letters & numbers</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-700">Your AUID</label>
                <input
                  type="text"
                  value={auid}
                  onChange={handleAuidChange}
                  placeholder="e.g. AIT24BEIS073"
                  className="input-brutal"
                  data-testid="auid-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" strokeWidth={2.5} />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="e.g. 9876543210"
                  className="input-brutal"
                  autoFocus
                  data-testid="phone-input"
                />
                <p className="text-xs text-gray-400 font-medium">Enter your 10-digit mobile number</p>
              </div>
            </div>
          )}

          {error && <p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2" data-testid="login-error">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full btn-primary text-center text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="login-submit-button"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? "Logging in..." : "Let's Eat"}
          </button>

          {usePhone && (
            <button
              onClick={() => { setUsePhone(false); setError(""); setPhone(""); }}
              className="w-full text-center text-sm font-bold text-gray-500 hover:text-black transition-colors"
              data-testid="back-to-auid"
            >
              Try with AUID instead
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 justify-center pt-4">
          <div className="w-3 h-3 bg-lime-400 border-2 border-[#2B4798] rounded-full" />
          <div className="w-3 h-3 bg-[#2B4798] border-2 border-[#2B4798] rounded-full" />
          <div className="w-3 h-3 bg-[#FFC947] border-2 border-[#2B4798] rounded-full" />
        </div>
      </div>
    </div>
  );
}
