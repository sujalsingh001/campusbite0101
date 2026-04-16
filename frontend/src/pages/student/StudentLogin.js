import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, ArrowLeft, Loader2, Mail, Lock, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function StudentLogin() {
  const navigate = useNavigate();
  const { user, currentUser, studentLogin, registerStudent, sendOTP, verifyOTP, resetStudentPassword } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [auid, setAuid] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    if (user?.role === "student" && (activeTab === "login" || otpVerified || !phone.trim())) {
      navigate("/student/menu");
    }
  }, [activeTab, navigate, otpVerified, phone, user]);

  useEffect(() => {
    if (activeTab !== "register") {
      setOtpCode("");
      setOtpSent(false);
      setOtpVerified(false);
      setSuccess("");
      return;
    }

    if (currentUser?.phoneVerified) {
      setOtpVerified(true);
      setOtpSent(true);
      setSuccess("Phone number already verified");
    }
  }, [activeTab, currentUser?.phoneVerified]);

  const handleAuidChange = (e) => {
    const val = e.target.value.toUpperCase();
    setAuid(val);
    setError("");
    setSuccess("");
  };

  const isCollegeEmail = (value) => value.trim().toLowerCase().endsWith("@acharya.ac.in");

  const handleStudentLogin = async () => {
    setError("");
    setSuccess("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (!isCollegeEmail(trimmedEmail)) {
      setError("Use your @acharya.ac.in email");
      return;
    }

    setLoading(true);
    try {
      await studentLogin(trimmedEmail, password);
      navigate("/student/menu");
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    setSuccess("");

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (!isCollegeEmail(trimmedEmail)) {
      setError("Use your @acharya.ac.in email");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await registerStudent(trimmedEmail, password);
      if (phone.trim()) {
        setLoading(false);
        setSendingOtp(true);
        await sendOTP(phone);
        setOtpSent(true);
        setSuccess("OTP sent to your phone number");
        return;
      }
      navigate("/student/menu");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
      setSendingOtp(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setSuccess("");

    if (!phone.trim()) {
      setError("Enter your phone number first");
      return;
    }

    setSendingOtp(true);
    try {
      await sendOTP(phone);
      setOtpSent(true);
      setSuccess("OTP sent to your phone number");
    } catch (err) {
      setError(err.message || "Unable to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    setVerifyingOtp(true);
    try {
      await verifyOTP(otpCode);
      setOtpVerified(true);
      setSuccess("Phone number verified successfully");
      navigate("/student/menu");
    } catch (err) {
      setError(err.message || "Unable to verify OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your college email first");
      return;
    }

    if (!isCollegeEmail(trimmedEmail)) {
      setError("Use your @acharya.ac.in email");
      return;
    }

    setLoading(true);
    try {
      await resetStudentPassword(trimmedEmail);
      setSuccess("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err.message || "Unable to send password reset email");
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
            Use your college email to sign in
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-white p-1 border-[3px] border-black rounded-xl">
          <button
            onClick={() => { setActiveTab("login"); setError(""); setSuccess(""); }}
            className={`rounded-lg py-2 font-black text-lg ${activeTab === "login" ? "bg-white border-[3px] border-black" : "bg-black text-white"}`}
            data-testid="tab-login"
          >
            Login
          </button>
          <button
            onClick={() => { setActiveTab("register"); setError(""); setSuccess(""); }}
            className={`rounded-lg py-2 font-black text-lg ${activeTab === "register" ? "bg-white border-[3px] border-black" : "bg-black text-white"}`}
            data-testid="tab-register"
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4" strokeWidth={2.5} />
              College Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && (activeTab === "login" ? handleStudentLogin() : handleRegister())}
              placeholder="you@acharya.ac.in"
              className="input-brutal"
              data-testid="email-input"
            />
          </div>

          {activeTab === "register" && (
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-700">Your AUID</label>
              <input
                type="text"
                value={auid}
                onChange={handleAuidChange}
                placeholder="Your AUID"
                className="input-brutal"
                data-testid="auid-input"
              />
              <p className="text-xs text-gray-400 font-medium">Must be 7+ characters with letters & numbers</p>
            </div>
          )}

          {activeTab === "register" && (
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <Phone className="w-4 h-4" strokeWidth={2.5} />
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setError("");
                  setSuccess("");
                  setOtpCode("");
                  setOtpSent(false);
                  setOtpVerified(false);
                }}
                placeholder="e.g. 9876543210"
                className="input-brutal"
                data-testid="phone-input"
              />
              <p className="text-xs text-gray-400 font-medium">Enter your 10-digit mobile number</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <Lock className="w-4 h-4" strokeWidth={2.5} />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && (activeTab === "login" ? handleStudentLogin() : handleRegister())}
              placeholder={activeTab === "register" ? "Create a password" : "Enter your password"}
              className="input-brutal"
              data-testid="password-input"
            />
          </div>

          {activeTab === "register" && otpSent && (
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-gray-700">OTP Verification</label>
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} containerClassName="justify-start">
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-10 h-12 border-2 border-black bg-white" />
                  <InputOTPSlot index={1} className="w-10 h-12 border-2 border-black bg-white" />
                  <InputOTPSlot index={2} className="w-10 h-12 border-2 border-black bg-white" />
                  <InputOTPSlot index={3} className="w-10 h-12 border-2 border-black bg-white" />
                  <InputOTPSlot index={4} className="w-10 h-12 border-2 border-black bg-white" />
                  <InputOTPSlot index={5} className="w-10 h-12 border-2 border-black bg-white" />
                </InputOTPGroup>
              </InputOTP>
              <div className="flex gap-2">
                <button
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otpCode.length !== 6 || otpVerified}
                  className="flex-1 bg-white border-[3px] border-black rounded-xl p-3 text-center font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal disabled:opacity-50"
                  data-testid="verify-otp-button"
                >
                  {verifyingOtp ? "Verifying..." : (otpVerified ? "Verified" : "Verify OTP")}
                </button>
                <button
                  onClick={handleSendOtp}
                  disabled={sendingOtp || otpVerified}
                  className="flex-1 bg-white border-[3px] border-black rounded-xl p-3 text-center font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal disabled:opacity-50"
                  data-testid="resend-otp-button"
                >
                  {sendingOtp ? "Sending..." : "Resend OTP"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2" data-testid="auth-error">{error}</p>}
          {success && <p className="text-sm font-bold text-green-700 bg-green-50 border-2 border-green-300 rounded-lg p-2" data-testid="auth-success">{success}</p>}

          <button
            onClick={activeTab === "login" ? handleStudentLogin : handleRegister}
            disabled={loading || sendingOtp || (activeTab === "register" && otpSent && !otpVerified)}
            className="w-full btn-primary text-center text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="auth-submit-button"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading
              ? (activeTab === "login" ? "Logging in..." : "Creating account...")
              : (activeTab === "login" ? "Login" : (otpSent && !otpVerified ? "Awaiting OTP" : "Create Account"))}
          </button>

          {activeTab === "login" && (
            <button
              onClick={handleForgotPassword}
              className="w-full text-center text-sm font-bold text-gray-500 hover:text-black transition-colors"
              data-testid="forgot-password"
            >
              Forgot Password?
            </button>
          )}
        </div>

        <div id="recaptcha-container"></div>

        <div className="flex items-center gap-3 justify-center pt-4">
          <div className="w-3 h-3 bg-lime-400 border-2 border-[#2B4798] rounded-full" />
          <div className="w-3 h-3 bg-[#2B4798] border-2 border-[#2B4798] rounded-full" />
          <div className="w-3 h-3 bg-[#FFC947] border-2 border-[#2B4798] rounded-full" />
        </div>
      </div>
    </div>
  );
}
