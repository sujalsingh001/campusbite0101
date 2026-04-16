import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToUserOrders } from "@/lib/firestoreOrders";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-300", badgeColor: "#FDE047", icon: Package },
  completed: { label: "Completed", color: "bg-lime-400", badgeColor: "#A3E635", icon: Check },
};

function formatDateTime(value) {
  return value ? value.toLocaleString() : "Saving...";
}

export default function StudentOrders() {
  const navigate = useNavigate();
  const { user, currentUser, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const activeUser = currentUser || (user?.role === "student" ? user : null);

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    if (!activeUser?.uid) {
      setOrdersLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToUserOrders(
      activeUser.uid,
      (data) => {
        setOrders(data);
        setError("");
        setOrdersLoading(false);
      },
      () => {
        setError("Unable to load orders right now");
        setOrdersLoading(false);
      },
    );

    return unsubscribe;
  }, [activeUser, loading]);

  if (loading || ordersLoading) {
    return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-black border-t-lime-400 rounded-full" /></div>;
  }

  if (!activeUser?.uid) {
    return (
      <div className="mobile-wrapper flex items-center justify-center min-h-screen p-6 text-center">
        <div>
          <p className="font-bold text-gray-500 mb-4">Please login first</p>
          <button onClick={() => navigate("/student/login")} className="btn-primary">Login</button>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((order) => order.status !== "completed");
  const completedOrders = orders.filter((order) => order.status === "completed");

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

      {error && (
        <div className="px-5 pt-4">
          <p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2">{error}</p>
        </div>
      )}

      {orders.length === 0 && !error && (
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
            {activeOrders.map((order) => {
              const config = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <button key={order.orderId} onClick={() => navigate(`/student/order/${order.orderId}`)} className="w-full card-brutal p-4 text-left hover:translate-y-[-2px] transition-all btn-brutal" data-testid={`order-card-${order.orderId}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 ${config.color} border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}>
                      <span className="text-2xl font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{order.tokenNumber || order.orderId.slice(-4).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>{order.canteenName || "CampusBite Order"}</h3>
                        <span className="badge-brutal" style={{ backgroundColor: config.badgeColor }}>
                          <StatusIcon className="w-3 h-3 mr-1" strokeWidth={3} />{config.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">{order.itemName}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">Qty: {order.quantity} | Txn: {order.transactionId || "N/A"}</p>
                      <p className="text-xs text-gray-500 font-medium">{formatDateTime(order.createdAt)}</p>
                      <span className="font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{order.totalAmount}</span>
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
            {completedOrders.map((order) => (
              <div key={order.orderId} className="card-brutal-sm p-4 opacity-75" data-testid={`completed-order-${order.orderId}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 border-2 border-gray-300 rounded-xl flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>#{order.tokenNumber || order.orderId.slice(-4).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-gray-600" style={{ fontFamily: "'Outfit', sans-serif" }}>{order.canteenName || "CampusBite Order"}</h3>
                      <div className="flex items-center gap-1 text-green-600"><Check className="w-4 h-4" strokeWidth={3} /><span className="text-xs font-bold">Completed</span></div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">{order.itemName}</p>
                    <p className="text-xs text-gray-400 font-medium">Qty: {order.quantity} | Txn: {order.transactionId || "N/A"}</p>
                    <p className="text-xs text-gray-400 font-medium">{formatDateTime(order.createdAt)}</p>
                    <span className="font-bold text-sm text-gray-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{order.totalAmount}</span>
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
