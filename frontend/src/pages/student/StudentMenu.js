import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Search, Leaf, Clock, Star, LogOut } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import API from "@/lib/api";

export default function StudentMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addItem, removeItem, items: cartItems, count: cartCount, canteenId: cartCanteenId } = useCart();

  const [canteens, setCanteens] = useState([]);
  const [activeCanteen, setActiveCanteen] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/student/login"); return; }
    API.get("/canteens").then(res => {
      setCanteens(res.data);
      if (res.data.length > 0) setActiveCanteen(res.data[0].canteen_id);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user, navigate]);

  useEffect(() => {
    if (!activeCanteen) return;
    API.get(`/canteens/${activeCanteen}/menu`).then(res => setMenuItems(res.data)).catch(console.error);
  }, [activeCanteen]);

  const getItemQty = (itemId) => {
    if (cartCanteenId !== activeCanteen) return 0;
    return cartItems.find(i => i.item_id === itemId)?.qty || 0;
  };

  const handleAdd = (item) => {
    const cName = canteens.find(c => c.canteen_id === activeCanteen)?.name || "";
    addItem({ item_id: item.item_id, name: item.name, price: item.price, image: item.image }, activeCanteen, cName);
  };

  const handleRemove = (itemId) => removeItem(itemId);

  const categories = ["all", ...new Set(menuItems.map(i => i.category || "general"))];
  
  const filteredItems = menuItems.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || i.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleLogout = () => { logout(); navigate("/"); };

  if (loading) return <div className="mobile-wrapper flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-black border-t-lime-400 rounded-full" /></div>;

  return (
    <div className="mobile-wrapper pb-24">
      <div className="sticky top-0 bg-[#FEFCE8] z-40 border-b-[3px] border-black">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500" data-testid="greeting-text">
                {user?.auid || "Student"}
              </p>
              <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="menu-title">
                What's cooking?
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate("/student/orders")} className="w-11 h-11 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="orders-history-btn">
                <Clock className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <button onClick={handleLogout} className="w-11 h-11 bg-white border-[3px] border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center btn-brutal" data-testid="logout-btn">
                <LogOut className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={2.5} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search for food..." className="input-brutal pl-12" data-testid="search-input" />
          </div>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-2 px-5 pb-4">
            {canteens.map(c => (
              <button key={c.canteen_id} onClick={() => setActiveCanteen(c.canteen_id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full border-[2.5px] border-black font-bold text-sm transition-all btn-brutal ${activeCanteen === c.canteen_id ? "bg-black text-white shadow-none" : "bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"}`}
                data-testid={`canteen-tab-${c.canteen_id}`}>
                {c.name}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Category Filter */}
        {categories.length > 1 && (
          <ScrollArea className="w-full mt-2">
            <div className="flex gap-2 px-5">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full border-2 border-black font-medium text-xs transition-all ${selectedCategory === cat ? "bg-lime-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-white text-gray-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]"}`}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="badge-brutal bg-lime-300"><Star className="w-3 h-3 mr-1" strokeWidth={3} fill="currentColor" />4.5</div>
          <span className="text-sm font-semibold text-gray-500">{canteens.find(c => c.canteen_id === activeCanteen)?.description}</span>
        </div>
      </div>

      <div className="px-5 py-3 grid grid-cols-2 gap-3">
        {filteredItems.map(item => {
          const qty = getItemQty(item.item_id);
          return (
            <div key={item.item_id} className="card-brutal-sm overflow-hidden" data-testid={`menu-item-${item.item_id}`}>
              <div className="relative h-28 overflow-hidden border-b-[2px] border-black">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                {item.veg && <div className="absolute top-2 left-2 w-6 h-6 bg-green-500 border-2 border-black rounded-md flex items-center justify-center"><Leaf className="w-3.5 h-3.5 text-white" strokeWidth={3} /></div>}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm leading-tight mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>{item.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="font-black text-base" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{item.price}</span>
                  {qty > 0 ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleRemove(item.item_id)} className="w-7 h-7 bg-pink-400 border-2 border-black rounded-lg flex items-center justify-center btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-testid={`remove-${item.item_id}`}>
                        <Minus className="w-3.5 h-3.5" strokeWidth={3} />
                      </button>
                      <span className="w-6 text-center font-black text-sm" data-testid={`qty-${item.item_id}`}>{qty}</span>
                      <button onClick={() => handleAdd(item)} className="w-7 h-7 bg-lime-400 border-2 border-black rounded-lg flex items-center justify-center btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-testid={`add-more-${item.item_id}`}>
                        <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleAdd(item)} className="w-8 h-8 bg-lime-400 border-2 border-black rounded-lg flex items-center justify-center btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-testid={`add-to-cart-${item.item_id}`}>
                      <Plus className="w-4 h-4" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-md mx-auto px-5 pb-5">
            <button onClick={() => navigate("/student/cart")} className="w-full bg-black text-white border-[3px] border-black rounded-xl p-4 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.15)] btn-brutal" data-testid="view-cart-btn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-lime-400 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-black" strokeWidth={2.5} /></div>
                <span className="font-bold text-lg">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
              </div>
              <span className="font-black text-lg" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>View Cart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
