import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChefHat, Check, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";

const statusConfig = {
  placed: { label: "Placed", color: "bg-yellow-300", badgeColor: "#FDE047", icon: Package },
  preparing: { label: "Preparing", color: "bg-blue-400", badgeColor: "#60A5FA", icon: ChefHat },
  ready: { label: "Ready", color: "bg-lime-400", badgeColor: "#A3E635", icon: Check },
};

export default function StudentOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/student/login"); return; }
    const fetchOrders = () => {
      API.get("/orders/my").then(res => { setOrders(res.data); setLoading(false); }).catch(() => setLoading(false));
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  if (loading) return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-black border-t-lime-400 rounded-full" /></div>;

  const activeOrders = orders.filter(o => o.status !== "ready");
  const completedOrders = orders.filter(o => o.status === "ready");

  return (
    <div className="mobile-wrapper pb-8">
      <div className="sticky top-0 bg-[#FEFCE8] z-40 border-b-[3px] border-black px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/student/menu")} className="w-10 h-10 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="back-from-orders">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="orders-title">My Orders</h1>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>No orders yet</h2>
          <p className="text-gray-500 font-medium mb-4">Place your first order from the menu</p>
          <button onClick={() => navigate("/student/menu")} className="btn-primary" data-testid="go-to-menu-btn">Browse Menu</button>
        </div>
      )}

      {activeOrders.length > 0 && (
        <div className="px-5 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Active</h3>
          <div className="space-y-3">
            {activeOrders.map(order => {
              const config = statusConfig[order.status];
              const StatusIcon = config.icon;
              return (
                <button key={order.order_id} onClick={() => navigate(`/student/order/${order.order_id}`)} className="w-full card-brutal p-4 text-left hover:translate-y-[-2px] transition-all btn-brutal" data-testid={`order-card-${order.order_id}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 ${config.color} border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}>
                      <span className="text-2xl font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{order.token_number}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>{order.canteen_name}</h3>
                        <span className="badge-brutal" style={{ backgroundColor: config.badgeColor }}>
                          <StatusIcon className="w-3 h-3 mr-1" strokeWidth={3} />{config.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">{order.items.map(i => `${i.name} x${i.qty}`).join(", ")}</p>
                      <span className="font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{order.total}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {completedOrders.length > 0 && (
        <div className="px-5 pt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Completed</h3>
          <div className="space-y-3">
            {completedOrders.map(order => (
              <div key={order.order_id} className="card-brutal-sm p-4 opacity-75" data-testid={`completed-order-${order.order_id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 border-2 border-gray-300 rounded-xl flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{order.token_number}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-gray-600" style={{ fontFamily: "'Outfit', sans-serif" }}>{order.canteen_name}</h3>
                      <div className="flex items-center gap-1 text-green-600"><Check className="w-4 h-4" strokeWidth={3} /><span className="text-xs font-bold">Collected</span></div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">{order.items.map(i => `${i.name} x${i.qty}`).join(", ")}</p>
                    <span className="font-bold text-sm text-gray-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{order.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
