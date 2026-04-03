import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, CreditCard, Loader2, QrCode, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";

export default function StudentCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, canteenId, canteenName, total, addItem, removeItem, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [qrEnabled, setQrEnabled] = useState(false);
  const [utr, setUtr] = useState("");
  const [refId, setRefId] = useState("");

  useEffect(() => {
    // Generate unique reference ID for this cart session
    setRefId(`REF${Date.now()}`);
  }, []);

  useEffect(() => {
    if (canteenId) {
      API.get(`/canteens`).then(res => {
        const canteen = res.data.find(c => c.canteen_id === canteenId);
        if (canteen) {
          const upiIdValue = canteen.upi_id || "";
          setUpiId(upiIdValue);
          setQrEnabled(canteen.qr_enabled || false);
          
          // Generate QR dynamically from UPI ID if not already set
          let qrUrl = canteen.qr_code || "";
          if (!qrUrl && upiIdValue && total > 0) {
            // Create UPI payment link
            const upiLink = `upi://pay?pa=${upiIdValue}&pn=${encodeURIComponent(canteen.name)}&tn=Order-${refId}&am=${total}&cu=INR`;
            // Generate QR from UPI link
            qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
          } else if (!qrUrl && upiIdValue) {
            // Fallback QR without amount
            const upiLink = `upi://pay?pa=${upiIdValue}&pn=${encodeURIComponent(canteen.name)}`;
            qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;
          }
          setQrCode(qrUrl);
        }
      }).catch(() => {});
    }
  }, [canteenId, total, refId]);

  if (!user) { navigate("/student/login"); return null; }

  const handlePlaceOrder = async (paymentMethod = "none") => {
    if (items.length === 0) return;
    
    // Validate UTR if QR payment selected
    if (paymentMethod === "qr") {
      const trimmedUtr = utr.trim();
      if (!trimmedUtr) {
        setError("Please enter UTR (transaction ID)");
        return;
      }
      // UTR format validation: 12 digits
      if (!/^\d{12}$/.test(trimmedUtr)) {
        setError("UTR must be exactly 12 digits");
        return;
      }
    }
    
    setPlacing(true);
    setError("");
    try {
      const { data } = await API.post("/orders", {
        canteen_id: canteenId,
        items: items.map(i => ({ item_id: i.item_id, name: i.name, qty: i.qty, price: i.price })),
        payment_method: paymentMethod,
        utr: paymentMethod === "qr" ? utr.trim() : undefined,
      });
      clearCart();
      setShowQR(false);
      setUtr("");
      navigate(`/student/order/${data.order_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const handleAddMore = (item) => {
    addItem({ item_id: item.item_id, name: item.name, price: item.price, image: item.image }, canteenId, canteenName);
  };

  if (items.length === 0) {
    return (
      <div className="mobile-wrapper flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="text-6xl mb-4">🍽</div>
        <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>Cart is empty</h2>
        <p className="text-gray-500 font-medium mb-6">Add some items from the menu</p>
        <button onClick={() => navigate("/student/menu")} className="btn-primary" data-testid="go-to-menu-btn">Browse Menu</button>
      </div>
    );
  }

  return (
    <div className="mobile-wrapper pb-32">
      <div className="sticky top-0 bg-[#FEFCE8] z-40 border-b-[3px] border-black px-5 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/student/menu")} className="w-10 h-10 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="back-to-menu">
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="cart-title">Your Cart</h1>
            <p className="text-xs font-semibold text-gray-500">{canteenName}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {items.map(item => (
          <div key={item.item_id} className="card-brutal-sm p-4 flex items-center gap-4" data-testid={`cart-item-${item.item_id}`}>
            <div className="flex-1">
              <h3 className="font-bold text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>{item.name}</h3>
              <p className="font-black text-lg mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid={`cart-item-price-${item.item_id}`}>₹{item.price * item.qty}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => removeItem(item.item_id)} className={`w-8 h-8 border-2 border-black rounded-lg flex items-center justify-center btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${item.qty === 1 ? "bg-red-300" : "bg-pink-300"}`} data-testid={`cart-remove-${item.item_id}`}>
                {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Minus className="w-3.5 h-3.5" strokeWidth={3} />}
              </button>
              <span className="w-8 text-center font-black text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid={`cart-qty-${item.item_id}`}>{item.qty}</span>
              <button onClick={() => handleAddMore(item)} className="w-8 h-8 bg-lime-400 border-2 border-black rounded-lg flex items-center justify-center btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-testid={`cart-add-${item.item_id}`}>
                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5">
        <div className="card-brutal p-5 space-y-3">
          <h3 className="text-lg font-black" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="order-summary-title">Order Summary</h3>
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.item_id} className="flex justify-between text-sm font-medium text-gray-600">
                <span>{item.name} x{item.qty}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{item.price * item.qty}</span>
              </div>
            ))}
          </div>
          <div className="border-t-[2px] border-dashed border-black pt-3 flex justify-between items-center">
            <span className="font-bold text-base">Total</span>
            <span className="font-black text-2xl" style={{ fontFamily: "'IBM Plex Mono', monospace" }} data-testid="cart-total">₹{total}</span>
          </div>
        </div>
      </div>

      <div className="px-5 mt-3">
        <div className="bg-yellow-200 border-2 border-black rounded-lg p-3 flex items-start gap-2">
          <CreditCard className="w-5 h-5 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
          <p className="text-sm font-semibold text-gray-800">Pay at counter when collecting — or pay via UPI below</p>
        </div>
      </div>

      {error && <div className="px-5 mt-3"><p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2" data-testid="order-error">{error}</p></div>}

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto px-5 pb-5 space-y-2">
          {qrCode && qrEnabled && (
            <button onClick={() => setShowQR(true)} className="w-full bg-white border-[3px] border-black rounded-xl p-3 text-center font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" strokeWidth={2.5} />
              Pay via QR/UPI
            </button>
          )}
          <button onClick={() => handlePlaceOrder("none")} disabled={placing} className="w-full bg-lime-400 border-[3px] border-black rounded-xl p-4 text-center font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center justify-center gap-2 disabled:opacity-50" data-testid="place-order-btn" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {placing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {placing ? "Placing..." : `Place Order — ₹${total}`}
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-5" onClick={() => setShowQR(false)}>
          <div className="card-brutal max-w-sm w-full p-6 space-y-4 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 w-8 h-8 bg-gray-200 border-2 border-black rounded-lg flex items-center justify-center btn-brutal">
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <h3 className="text-xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Pay via UPI</h3>
            <div className="bg-white border-2 border-black rounded-lg p-4 flex flex-col items-center">
              {qrCode ? (
                <>
                  <img src={qrCode} alt="QR Code" className="w-64 h-64 border-2 border-black rounded-lg" onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300/f0f0f0/666?text=QR+Code+Error'; }} />
                  <p className="text-sm font-bold text-gray-600 mt-3">Scan with any UPI app</p>
                  {upiId && <p className="text-xs font-mono text-gray-500 mt-1">{upiId}</p>}
                  {upiId && (
                    <a href={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(canteenName || 'Canteen')}&tn=Order-${refId}&am=${total}&cu=INR`} className="mt-3 bg-white border-2 border-black rounded-lg px-4 py-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] btn-brutal">
                      Open in UPI App
                    </a>
                  )}
                </>
              ) : (
                <div className="w-64 h-64 border-2 border-black rounded-lg bg-gray-100 flex items-center justify-center">
                  <p className="text-sm text-gray-500 font-bold text-center px-4">QR code unavailable. Please use "Open in UPI App" below.</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 block">Enter UTR (12 digits)</label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="409123456789"
                maxLength={12}
                className="input-brutal w-full font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Find UTR/Transaction ID in your UPI app after payment</p>
            </div>
            <p className="text-xs font-semibold text-gray-600 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2">
              💡 After payment, enter the UTR and click "I have paid" below
            </p>
            <button onClick={() => handlePlaceOrder("qr")} disabled={placing || !utr.trim()} className="w-full bg-lime-400 border-[3px] border-black rounded-xl p-3 text-center font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center justify-center gap-2 disabled:opacity-50">
              {placing ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" strokeWidth={2.5} />}
              {placing ? "Confirming..." : "I have paid"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
