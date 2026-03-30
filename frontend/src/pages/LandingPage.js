import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UtensilsCrossed, ChefHat, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [tapCount, setTapCount] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const tapTimer = useRef(null);

  const handleLogoTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 2000);

    if (newCount >= 5) {
      setShowSecret((prev) => !prev);
      setTapCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5EF] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div
            className="cursor-pointer select-none active:scale-95 transition-transform"
            data-testid="app-logo"
            onClick={handleLogoTap}
          >
            <img
              src="https://customer-assets.emergentagent.com/job_smart-lunch-1/artifacts/9p036in8_WhatsApp%20Image%202026-03-30%20at%202.07.00%20AM.jpeg"
              alt="CampusBite"
              className="object-contain mx-auto rounded-2xl drop-shadow-lg"
              style={{ width: '284px', height: '284px' }}
              draggable={false}
            />
          </div>
          {/* Subtle tap hint — only visible after 2 taps */}
          {tapCount >= 2 && tapCount < 5 && (
            <p className="text-[10px] text-gray-300 font-bold animate-pulse">
              {5 - tapCount} more...
            </p>
          )}
        </div>

        {/* Student Card — always visible */}
        <div className="space-y-4">
          <button
            onClick={() => navigate("/student/login")}
            className="w-full card-brutal p-5 flex items-center gap-4 text-left hover:translate-y-[-2px] transition-all duration-150 btn-brutal"
            data-testid="role-student"
          >
            <div className="w-14 h-14 bg-[#F59218] border-[3px] border-[#2B4798] rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(43,71,152,1)] flex-shrink-0">
              <UtensilsCrossed className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Order Food
              </h3>
              <p className="text-sm text-gray-500 font-medium">Browse menu, place order & track your token</p>
            </div>
            <div className="text-gray-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </button>
        </div>

        {/* Secret Admin/Staff Cards — revealed after 5 taps */}
        {showSecret && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 text-center">
              Staff Access
            </p>
            <button
              onClick={() => navigate("/canteen/login")}
              className="w-full card-brutal p-4 flex items-center gap-4 text-left hover:translate-y-[-2px] transition-all duration-150 btn-brutal"
              data-testid="role-canteen"
            >
              <div className="w-12 h-12 bg-pink-400 border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
                <ChefHat className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Canteen Staff
                </h3>
                <p className="text-xs text-gray-500 font-medium">Manage orders & tokens</p>
              </div>
              <div className="text-gray-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => navigate("/admin/login")}
              className="w-full card-brutal p-4 flex items-center gap-4 text-left hover:translate-y-[-2px] transition-all duration-150 btn-brutal"
              data-testid="role-admin"
            >
              <div className="w-12 h-12 bg-yellow-300 border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
                <ShieldCheck className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Super Admin
                </h3>
                <p className="text-xs text-gray-500 font-medium">Manage canteens & staff</p>
              </div>
              <div className="text-gray-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 font-semibold uppercase tracking-widest">
          AIT College Canteen System
        </p>
      </div>
    </div>
  );
}
