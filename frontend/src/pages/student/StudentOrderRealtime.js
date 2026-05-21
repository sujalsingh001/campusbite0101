import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Check, Package, Bell, ChefHat, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToStudentOrder, updateOrderStatus } from "@/lib/ordersDataSource";
import { toast } from "@/hooks/use-toast";

const ACTIVE_STATUSES = [
  { key: "pending", label: "Order Pending", icon: Package, description: "Your order has been placed successfully" },
  { key: "preparing", label: "Preparing", icon: ChefHat, description: "Your order is being prepared right now" },
  { key: "completed", label: "Completed", icon: Check, description: "Your order is ready for pickup" },
];

const CANCELLED_STATUSES = [
  { key: "pending", label: "Order Pending", icon: Package, description: "Your order reached the canteen" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, description: "This order was cancelled by the canteen" },
];

function formatDateTime(value) {
  return value ? value.toLocaleString() : "Saving...";
}

function getStatusColor(key) {
  return ({
    pending: "bg-yellow-300",
    preparing: "bg-blue-400",
    completed: "bg-lime-400",
    cancelled: "bg-red-300",
  }[key] || "bg-gray-200");
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function StudentOrderRealtime() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user, currentUser, loading } = useAuth();
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryTrigger, setRetryTrigger] = useState(0);
  const activeUser = currentUser?.role === "student"
    ? currentUser
    : (user?.role === "student" ? user : null);
  const hasBackendSession = typeof window !== "undefined" && Boolean(localStorage.getItem("campusbite_token"));
  const canLoadOrder = Boolean(activeUser?.uid || (activeUser?.role === "student" && hasBackendSession));

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    if (!canLoadOrder || !orderId) {
      setOrderLoading(false);
      return undefined;
    }

    setOrderLoading(true);
    setLoadError("");
    console.log("[StudentOrder] subscribing", { orderId });

    const loadFailsafe = window.setTimeout(() => {
      console.warn("[StudentOrder] load timed out after 8s", { orderId });
      setOrderLoading(false);
      setLoadingTimeout(true);
    }, 8000);

    const unsubscribe = subscribeToStudentOrder(
      activeUser,
      orderId,
      (data) => {
        console.log("[StudentOrder] loaded", { orderId, found: Boolean(data) });
        setOrder(data || null);
        setLoadError("");
        setOrderLoading(false);
        setLoadingTimeout(false);
      },
      (err) => {
        console.error("[StudentOrder] subscription error:", err?.response?.status || err?.code || err?.message || err);
        setOrder(null);
        setOrderLoading(false);
        setLoadingTimeout(false);
        if (err?.response?.status === 404) {
          setLoadError("not_found");
        } else if (err?.response?.status >= 400 && err?.response?.status < 600) {
          setLoadError("failed");
        }
      },
    );

    return () => {
      window.clearTimeout(loadFailsafe);
      unsubscribe();
    };
  }, [activeUser, canLoadOrder, loading, orderId, retryTrigger]);

  useEffect(() => {
    let timer;
    if (loading || orderLoading) {
      timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000);
    } else {
      setLoadingTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [loading, orderLoading]);

  const handleRetry = () => {
    setLoadingTimeout(false);
    setLoadError("");
    setOrder(null);
    setOrderLoading(true);
    setRetryTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    try {
      if (!order?.createdAt) {
        setSecondsLeft(0);
        return undefined;
      }

      if (!["new", "pending"].includes((order.status || "").toLowerCase())) {
        setSecondsLeft(0);
        return undefined;
      }

      const updateSecondsLeft = () => {
        try {
          const createdAtMs = order.createdAt instanceof Date
            ? order.createdAt.getTime()
            : new Date(order.createdAt).getTime();

          if (Number.isNaN(createdAtMs)) {
            setSecondsLeft(0);
            return 0;
          }

          const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
          const nextSecondsLeft = Math.max(0, 120 - elapsedSeconds);
          setSecondsLeft(nextSecondsLeft);
          return nextSecondsLeft;
        } catch (e) {
          console.error("Error updating countdown seconds left:", e);
          setSecondsLeft(0);
          return 0;
        }
      };

      const initialSecondsLeft = updateSecondsLeft();
      if (initialSecondsLeft <= 0) {
        return undefined;
      }

      const intervalId = window.setInterval(() => {
        try {
          const nextSecondsLeft = updateSecondsLeft();
          if (nextSecondsLeft <= 0) {
            window.clearInterval(intervalId);
          }
        } catch (e) {
          console.error("Error in countdown timer interval:", e);
          setSecondsLeft(0);
          window.clearInterval(intervalId);
        }
      }, 1000);

      return () => {
        window.clearInterval(intervalId);
      };
    } catch (e) {
      console.error("Error setting up countdown timer:", e);
      setSecondsLeft(0);
      return undefined;
    }
  }, [order?.createdAt, order?.status]);

  let canCancelOrder = false;
  try {
    canCancelOrder = ["new", "pending"].includes((order?.status || "").toLowerCase()) && secondsLeft > 0;
  } catch (e) {
    canCancelOrder = false;
  }

  const handleCancelOrder = async () => {
    if (!order?.orderId || !activeUser || isCancelling) {
      return;
    }

    setIsCancelling(true);
    try {
      const updatedOrder = await updateOrderStatus(order.orderId, "cancelled", {
        activeUser,
        role: activeUser.role || "student",
      });
      setOrder((current) => ({
        ...current,
        ...updatedOrder,
        status: "cancelled",
      }));
      setSecondsLeft(0);
    } catch (error) {
      toast({
        title: "Could not cancel, please contact canteen",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (loadingTimeout && (loading || orderLoading)) {
    return (
      <div className="mobile-wrapper flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="card-brutal p-6 bg-red-100 border-[3px] border-black rounded-xl mb-4 max-w-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-xl font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>Loading Timeout</h2>
          <p className="text-sm font-semibold text-gray-700">The order details are taking too long to load. Please try again.</p>
        </div>
        <button onClick={handleRetry} className="btn-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (loading || orderLoading) {
    return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-black border-t-lime-400 rounded-full" /></div>;
  }

  if (!canLoadOrder) {
    return (
      <div className="mobile-wrapper flex items-center justify-center min-h-screen p-6 text-center">
        <div>
          <p className="font-bold text-gray-500 mb-4">Please login first</p>
          <button onClick={() => navigate("/student/login")} className="btn-primary">Login</button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mobile-wrapper flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="font-bold text-gray-500 mb-4" data-testid="order-not-found-msg">
          {loadError === "failed" ? "Unable to load order right now" : "Order not found"}
        </p>
        {loadError === "failed" && (
          <button onClick={handleRetry} className="btn-primary mb-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="retry-btn">
            Retry
          </button>
        )}
        <button onClick={() => navigate("/student/menu")} className="btn-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="back-to-menu-btn">Back to Menu</button>
      </div>
    );
  }

  const statusSteps = order.status === "cancelled" ? CANCELLED_STATUSES : ACTIVE_STATUSES;
  const currentIdx = statusSteps.findIndex((status) => status.key === order.status);

  return (
    <div className="mobile-wrapper pb-8">
      <div className="sticky top-0 bg-[#FEFCE8] z-40 border-b-[3px] border-black px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/student/menu")} className="w-10 h-10 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="back-from-order">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Order Tracking</h1>
            <p className="text-xs font-semibold text-gray-500">{order.canteenName || "CampusBite Order"}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className={`card-brutal ${getStatusColor(order.status)} p-6 text-center relative overflow-hidden`} data-testid="token-card">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/60 mb-1">Your Token</p>
            <h2 className="text-7xl font-black tracking-tighter leading-none" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="token-number">
              #{order.tokenNumber || (order.orderId || "").slice(-4).toUpperCase()}
            </h2>
            <div className="mt-3 inline-flex items-center gap-2">
              <span className="badge-brutal bg-white/80">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse-dot inline-block" />TRACKING
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
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Order Time</p>
            <p className="text-lg font-black" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="estimated-time">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <h3 className="text-lg font-black mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Order Status</h3>
        <div className="space-y-0">
          {statusSteps.map((status, idx) => {
            const isActive = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const StatusIcon = status.icon;
            return (
              <div key={status.key} className="flex gap-4" data-testid={`status-step-${status.key}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-xl border-[3px] border-black flex items-center justify-center flex-shrink-0 ${isCurrent ? `${getStatusColor(status.key)} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]` : isActive ? "bg-lime-300" : "bg-gray-100"}`}>
                    <StatusIcon className={`w-5 h-5 ${isActive ? "text-black" : "text-gray-400"}`} strokeWidth={2.5} />
                  </div>
                  {idx < statusSteps.length - 1 && <div className={`w-[3px] h-10 ${isActive ? "bg-black" : "bg-gray-300"}`} />}
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
            {(order.items || []).map((item, index) => (
              <div key={`${item.item_id || item.name}-${index}`} className="flex justify-between items-center text-sm font-medium">
                <span className="text-gray-700">{item.name} x {item.qty}</span>
                <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{item.price * item.qty}</span>
              </div>
            ))}
            {(!order.items || order.items.length === 0) && (
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-gray-700">{order.itemName} x {order.quantity}</span>
                <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{order.totalAmount}</span>
              </div>
            )}
            <div className="border-t-2 border-dashed border-black pt-2 flex justify-between items-center mt-2">
              <span className="font-bold">Total</span>
              <span className="font-black text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="order-total">₹{order.totalAmount}</span>
            </div>
            <div className="border-t-2 border-dashed border-black pt-2 flex justify-between items-center mt-2 text-sm font-medium">
              <span className="text-gray-700">Transaction ID</span>
              <span className="font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{order.transactionId || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      {canCancelOrder && (
        <div className="px-5 mt-4">
          <button
            onClick={handleCancelOrder}
            disabled={isCancelling}
            className="w-full bg-red-300 border-[3px] border-black rounded-xl p-4 text-center font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal disabled:opacity-50"
            data-testid="cancel-order-btn"
          >
            {isCancelling ? "Cancelling..." : `Cancel order (${formatCountdown(secondsLeft)} remaining)`}
          </button>
        </div>
      )}

      {(order.status === "pending" || order.status === "preparing") && (
        <div className="px-5 mt-4">
          <div className="bg-blue-100 border-2 border-black rounded-lg p-3 flex items-start gap-2">
            <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-800">Status updates automatically in your order history.</p>
          </div>
        </div>
      )}

      {order.status === "completed" && (
        <div className="px-5 mt-4">
          <div className="bg-lime-200 border-2 border-black rounded-lg p-3 flex items-start gap-2">
            <Check className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-800">Your order is ready for pickup.</p>
          </div>
        </div>
      )}

      {order.status === "cancelled" && (
        <div className="px-5 mt-4">
          <div className="bg-red-200 border-2 border-black rounded-lg p-3 flex items-start gap-2">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-800">This order was cancelled by the canteen.</p>
          </div>
        </div>
      )}
    </div>
  );
}
