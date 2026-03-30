import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Check, ChefHat, Package, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";

const STATUSES = [
  { key: "placed", label: "Order Placed", icon: Package, description: "Your order has been received" },
  { key: "preparing", label: "Preparing", icon: ChefHat, description: "The kitchen is working on your order" },
  { key: "ready", label: "Ready!", icon: Check, description: "Collect your order from the counter" },
];

export default function StudentOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/student/login"); return; }
    if (!orderId) return;
    const fetchOrder = () => {
      API.get(`/orders/${orderId}`).then(res => { setOrder(res.data); setLoading(false); }).catch(() => setLoading(false));
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [orderId, user, navigate]);

  if (loading) return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-black border-t-lime-400 rounded-full" /></div>;
  if (!order) return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><p className="font-bold text-gray-500">Order not found</p></div>;

  const currentIdx = STATUSES.findIndex(s => s.key === order.status);
  const getStatusColor = (key) => ({ placed: "bg-yellow-300", preparing: "bg-blue-400", ready: "bg-lime-400" }[key] || "bg-gray-200");

  return (
    <div className="mobile-wrapper pb-8">
      <div className="sticky top-0 bg-[#FEFCE8] z-40 border-b-[3px] border-black px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/student/menu")} className="w-10 h-10 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="back-from-order">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Order Tracking</h1>
            <p className="text-xs font-semibold text-gray-500">{order.canteen_name}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className={`card-brutal ${getStatusColor(order.status)} p-6 text-center relative overflow-hidden`} data-testid="token-card">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/60 mb-1">Your Token</p>
            <h2 className="text-7xl font-black tracking-tighter leading-none" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="token-number">
              #{order.token_number}
            </h2>
            <div className="mt-3 inline-flex items-center gap-2">
              <span className="badge-brutal bg-white/80">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse-dot inline-block" />LIVE
              </span>
            </div>
          </div>
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="card-brutal-sm p-4 flex items-center gap-3 bg-white">
          <div className="w-12 h-12 bg-pink-400 border-2 border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <Clock className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Estimated Wait</p>
            <p className="text-2xl font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="estimated-time">~{order.estimated_time}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <h3 className="text-lg font-black mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Order Status</h3>
        <div className="space-y-0">
          {STATUSES.map((status, idx) => {
            const isActive = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const StatusIcon = status.icon;
            return (
              <div key={status.key} className="flex gap-4" data-testid={`status-step-${status.key}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-xl border-[3px] border-black flex items-center justify-center flex-shrink-0 ${isCurrent ? `${getStatusColor(status.key)} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]` : isActive ? "bg-lime-300" : "bg-gray-100"}`}>
                    <StatusIcon className={`w-5 h-5 ${isActive ? "text-black" : "text-gray-400"}`} strokeWidth={2.5} />
                  </div>
                  {idx < STATUSES.length - 1 && <div className={`w-[3px] h-10 ${isActive ? "bg-black" : "bg-gray-300"}`} />}
                </div>
                <div className={`pb-4 ${isCurrent ? "pt-1" : "pt-2"}`}>
                  <p className={`font-bold text-base ${isActive ? "text-black" : "text-gray-400"}`} style={{ fontFamily: "'Outfit', sans-serif" }}>{status.label}</p>
                  {isCurrent && <p className="text-sm text-gray-500 font-medium mt-0.5">{status.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="card-brutal-sm p-4">
          <h3 className="text-base font-black mb-3" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="order-items-title">Order Details</h3>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm font-medium">
                <span className="text-gray-700">{item.name} x {item.qty}</span>
                <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{item.price * item.qty}</span>
              </div>
            ))}
            <div className="border-t-2 border-dashed border-black pt-2 flex justify-between items-center mt-2">
              <span className="font-bold">Total</span>
              <span className="font-black text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="order-total">₹{order.total}</span>
            </div>
          </div>
        </div>
      </div>

      {order.status !== "ready" && (
        <div className="px-5 mt-4">
          <div className="bg-blue-100 border-2 border-black rounded-lg p-3 flex items-start gap-2">
            <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-800">Status updates automatically. Collect when ready!</p>
          </div>
        </div>
      )}

      {order.status === "ready" && (
        <div className="px-5 mt-4">
          <div className="bg-lime-200 border-2 border-black rounded-lg p-3 flex items-start gap-2">
            <Check className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-800">Your order is ready! Head to {order.canteen_name} counter to collect.</p>
          </div>
        </div>
      )}
    </div>
  );
}
