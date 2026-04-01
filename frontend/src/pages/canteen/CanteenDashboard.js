import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, ChefHat, Package, Clock, Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import API from "@/lib/api";

const STATUS_COLS = [
  { key: "placed", label: "New Orders", color: "bg-yellow-300", icon: Package },
  { key: "preparing", label: "Preparing", color: "bg-blue-400", icon: ChefHat },
  { key: "ready", label: "Ready", color: "bg-lime-400", icon: Check },
];

export default function CanteenDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeTab, setActiveTab] = useState("orders");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    API.get("/staff/orders").then(res => { setOrders(res.data); setLoading(false); }).catch(err => {
      if (err.response?.status === 401 || err.response?.status === 403) { logout(); navigate("/canteen/login"); }
      setLoading(false);
    });
  }, [logout, navigate]);

  const fetchMenuItems = useCallback(() => {
    API.get("/staff/menu-items").then(res => setMenuItems(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || user.role !== "canteen_staff") { navigate("/canteen/login"); return; }
    fetchOrders();
    fetchMenuItems();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchOrders, fetchMenuItems]);

  const moveOrder = async (orderId, newStatus) => {
    try {
      await API.patch(`/staff/orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
    } catch (err) {
      // Status update failed - will retry on next fetch
    }
  };

  const toggleAvailability = async (itemId) => {
    try {
      await API.patch(`/staff/menu-items/${itemId}/availability`);
      fetchMenuItems();
    } catch (err) {
      // Toggle failed
    }
  };

  const handleLogout = () => { logout(); navigate("/"); };

  const todayOrders = orders.length;
  const activeCount = orders.filter(o => o.status !== "ready").length;
  const readyCount = orders.filter(o => o.status === "ready").length;

  if (loading) return <div className="min-h-screen bg-[#F0FDF4] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-black border-t-pink-400 rounded-full" /></div>;

  const formatTime = (isoStr) => {
    try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4]">
      <div className="bg-white border-b-[3px] border-black px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-400 border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <ChefHat className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="canteen-dashboard-title">{user?.canteen_name || "Canteen"}</h1>
              <p className="text-xs font-semibold text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="w-10 h-10 bg-white border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal" data-testid="canteen-logout-btn">
              <LogOut className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b-[3px] border-black bg-white/50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-4 overflow-x-auto">
          {[
            { label: "Total Today", value: todayOrders, color: "bg-white" },
            { label: "Active", value: activeCount, color: "bg-yellow-200" },
            { label: "Completed", value: readyCount, color: "bg-lime-200" },
          ].map(stat => (
            <div key={stat.label} className={`flex-shrink-0 ${stat.color} border-2 border-black rounded-lg px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{stat.label}</p>
              <p className="text-xl font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b-[3px] border-black bg-white">
        <div className="max-w-7xl mx-auto px-6 flex gap-2">
          <button onClick={() => setActiveTab("orders")} className={`px-4 py-3 font-bold text-sm border-b-[3px] transition-colors ${activeTab === "orders" ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            Orders
          </button>
          <button onClick={() => setActiveTab("menu")} className={`px-4 py-3 font-bold text-sm border-b-[3px] transition-colors ${activeTab === "menu" ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            Menu Items
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "orders" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUS_COLS.map(col => {
              const colOrders = orders.filter(o => o.status === col.key);
              const ColIcon = col.icon;
              return (
                <div key={col.key} data-testid={`column-${col.key}`}>
                  <div className={`${col.color} border-[3px] border-black rounded-xl p-3 mb-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                    <div className="flex items-center gap-2"><ColIcon className="w-5 h-5" strokeWidth={2.5} /><span className="font-black text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{col.label}</span></div>
                    <span className="bg-black text-white text-xs font-black px-2 py-0.5 rounded-full" data-testid={`count-${col.key}`}>{colOrders.length}</span>
                  </div>
                  <div className="space-y-3">
                    {colOrders.map(order => (
                      <div key={order.order_id} className="card-brutal p-4 space-y-3" data-testid={`admin-order-${order.order_id}`}>
                        <div className="flex items-start justify-between">
                          <div className={`${col.color} border-2 border-black rounded-lg px-3 py-1`}>
                            <span className="text-2xl font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid={`admin-token-${order.order_id}`}>#{order.token_number}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500"><Clock className="w-3.5 h-3.5" strokeWidth={2.5} /><span className="text-xs font-bold">{formatTime(order.created_at)}</span></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-200 border-2 border-black rounded-lg flex items-center justify-center"><span className="text-xs font-black">{order.student_auid?.[0] || "S"}</span></div>
                          <p className="text-[10px] font-semibold text-gray-400 font-mono">{order.student_auid}</p>
                        </div>
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-2.5">
                          {order.items.map((item) => (
                            <div key={item.item_id} className="flex justify-between text-sm font-medium"><span>{item.name} x{item.qty}</span><span className="font-bold font-mono">₹{item.price * item.qty}</span></div>
                          ))}
                          <div className="border-t border-gray-300 mt-1.5 pt-1.5 flex justify-between"><span className="text-sm font-bold">Total</span><span className="text-sm font-black font-mono">₹{order.total}</span></div>
                        </div>
                        {col.key === "placed" && (
                          <button onClick={() => moveOrder(order.order_id, "preparing")} className="w-full btn-primary flex items-center justify-center gap-2 text-sm" data-testid={`start-btn-${order.order_id}`}>
                            <ChefHat className="w-4 h-4" strokeWidth={2.5} />Start Preparing<ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        )}
                        {col.key === "preparing" && (
                          <button onClick={() => moveOrder(order.order_id, "ready")} className="w-full btn-pink flex items-center justify-center gap-2 text-sm" data-testid={`ready-btn-${order.order_id}`}>
                            <Check className="w-4 h-4" strokeWidth={2.5} />Mark Ready<ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        )}
                        {col.key === "ready" && (
                          <Badge className="w-full justify-center py-2 bg-lime-100 text-lime-800 border-2 border-lime-400 font-bold text-sm"><Check className="w-4 h-4 mr-1" strokeWidth={2.5} />Order Complete</Badge>
                        )}
                      </div>
                    ))}
                    {colOrders.length === 0 && (
                      <div className="card-brutal-sm p-8 text-center"><ColIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" strokeWidth={2} /><p className="text-sm font-bold text-gray-400">No orders here</p></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "menu" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map(item => (
              <div key={item.item_id} className="card-brutal p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg border-2 border-black object-cover" />
                  <div className="flex-1">
                    <h3 className="font-black text-sm">{item.name}</h3>
                    <p className="text-xs text-gray-500 font-semibold">{item.category}</p>
                    <p className="text-lg font-black font-mono mt-1">₹{item.price}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t-2 border-gray-200">
                  <span className="text-xs font-bold text-gray-600">Available:</span>
                  <button onClick={() => toggleAvailability(item.item_id)} className={`px-3 py-1 text-xs font-bold border-2 border-black rounded-lg transition-colors ${item.available ? "bg-lime-400 text-black" : "bg-gray-300 text-gray-600"}`}>
                    {item.available ? "✓ Active" : "✕ Hidden"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
