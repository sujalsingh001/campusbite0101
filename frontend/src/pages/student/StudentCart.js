import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, CreditCard, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import API from "@/lib/api";

export default function StudentCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, canteenId, canteenName, total, addItem, removeItem, clearCart } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  if (!user) { navigate("/student/login"); return null; }

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    setError("");
    try {
      const { data } = await API.post("/orders", {
        canteen_id: canteenId,
        items: items.map(i => ({ item_id: i.item_id, name: i.name, qty: i.qty, price: i.price })),
      });
      clearCart();
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
          <p className="text-sm font-semibold text-gray-800">Pay at the counter when collecting your order</p>
        </div>
      </div>

      {error && <div className="px-5 mt-3"><p className="text-sm font-bold text-red-500 bg-red-50 border-2 border-red-300 rounded-lg p-2" data-testid="order-error">{error}</p></div>}

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto px-5 pb-5">
          <button onClick={handlePlaceOrder} disabled={placing} className="w-full bg-lime-400 border-[3px] border-black rounded-xl p-4 text-center font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center justify-center gap-2 disabled:opacity-50" data-testid="place-order-btn" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {placing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {placing ? "Placing..." : `Place Order — ₹${total}`}
          </button>
        </div>
      </div>
    </div>
  );
}
