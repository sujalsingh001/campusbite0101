import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, ShieldCheck, Store, UtensilsCrossed, Users, BarChart3,
  TrendingUp, Plus, Trash2, IndianRupee, ShoppingBag, Clock, ChefHat, Loader2, Pencil
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import API from "@/lib/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [canteens, setCanteens] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, canteensRes, menuRes, staffRes] = await Promise.all([
        API.get("/admin/stats"), API.get("/admin/canteens"),
        API.get("/admin/menu-items"), API.get("/admin/staff"),
      ]);
      setStats(statsRes.data);
      setCanteens(canteensRes.data);
      setMenuItems(menuRes.data);
      setStaff(staffRes.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { logout(); navigate("/admin/login"); }
    } finally { setLoading(false); }
  }, [logout, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") { navigate("/admin/login"); return; }
    fetchAll();
  }, [user, navigate, fetchAll]);

  const handleLogout = () => { logout(); navigate("/"); };

  if (loading) return <div className="min-h-screen bg-[#111827] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-yellow-300 rounded-full" /></div>;

  const canteenColors = ['bg-yellow-300', 'bg-pink-400', 'bg-lime-400', 'bg-blue-400'];

  return (
    <div className="min-h-screen bg-[#111827]">
      <div className="bg-gray-900 border-b-[3px] border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-300 border-[3px] border-white rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(253,224,71,0.3)]">
              <ShieldCheck className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }} data-testid="admin-dashboard-title">CampusBite Admin</h1>
              <p className="text-xs font-semibold text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 bg-gray-800 border-[3px] border-gray-600 rounded-xl flex items-center justify-center hover:bg-gray-700 transition-colors" data-testid="admin-logout-btn">
            <LogOut className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-gray-800 border-[3px] border-gray-600 rounded-xl p-1 mb-6 flex flex-wrap gap-1">
            {[
              { value: "overview", label: "Overview", icon: BarChart3 },
              { value: "canteens", label: "Canteens", icon: Store },
              { value: "menu", label: "Menu", icon: UtensilsCrossed },
              { value: "staff", label: "Staff", icon: Users },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="flex-1 data-[state=active]:bg-yellow-300 data-[state=active]:text-black data-[state=active]:font-black text-gray-400 font-bold rounded-lg py-2.5 transition-all data-[state=active]:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] data-[state=active]:border-[2px] data-[state=active]:border-black"
                data-testid={`tab-${tab.value}`}>
                <tab.icon className="w-4 h-4 mr-1.5" strokeWidth={2.5} />{tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6" data-testid="overview-content">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Orders", value: stats?.total_orders || 0, icon: ShoppingBag, color: "bg-yellow-300" },
                { label: "Active", value: stats?.active_orders || 0, icon: Clock, color: "bg-blue-400" },
                { label: "Completed", value: stats?.completed || 0, icon: ChefHat, color: "bg-lime-400" },
                { label: "Revenue", value: `₹${(stats?.revenue || 0).toLocaleString()}`, icon: IndianRupee, color: "bg-pink-400" },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-800 border-[3px] border-gray-600 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(75,85,99,0.5)]" data-testid={`stat-card-${stat.label.toLowerCase().replace(" ", "-")}`}>
                  <div className={`w-10 h-10 ${stat.color} border-2 border-black rounded-lg flex items-center justify-center mb-3`}><stat.icon className="w-5 h-5 text-black" strokeWidth={2.5} /></div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-black text-white mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-800 border-[3px] border-gray-600 rounded-xl p-5 shadow-[6px_6px_0px_0px_rgba(75,85,99,0.5)]">
              <h3 className="text-lg font-black text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>Canteen Performance</h3>
              <div className="space-y-3">
                {(stats?.canteen_stats || []).map((cs, i) => (
                  <div key={cs.canteen_id} className="flex items-center gap-4 bg-gray-900 border-2 border-gray-700 rounded-lg p-3">
                    <div className={`w-10 h-10 ${canteenColors[i % 4]} border-2 border-black rounded-lg flex items-center justify-center flex-shrink-0`}><Store className="w-5 h-5 text-black" strokeWidth={2.5} /></div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{cs.name}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs font-semibold text-gray-500"><span className="text-white font-bold font-mono">{cs.orders}</span> orders</span>
                        <span className="text-xs font-semibold text-gray-500"><span className="text-white font-bold font-mono">₹{cs.revenue.toLocaleString()}</span> revenue</span>
                      </div>
                    </div>
                    <TrendingUp className="w-5 h-5 text-lime-400" strokeWidth={2.5} />
                  </div>
                ))}
                {(stats?.canteen_stats || []).length === 0 && <p className="text-gray-500 text-sm font-medium text-center py-4">No order data yet</p>}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="canteens" className="space-y-4" data-testid="canteens-content">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>All Canteens</h3>
              <AddCanteenDialog onAdd={fetchAll} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canteens.map((c, i) => (
                <CanteenCard key={c.canteen_id} canteen={c} colorClass={canteenColors[i % 4]} onUpdate={fetchAll} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="menu" className="space-y-4" data-testid="menu-content">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Menu Items</h3>
              <AddMenuItemDialog canteens={canteens} onAdd={fetchAll} />
            </div>
            {canteens.map(canteen => {
              const cItems = menuItems.filter(i => i.canteen_id === canteen.canteen_id);
              if (cItems.length === 0) return null;
              return (
                <div key={canteen.canteen_id} className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 px-1">{canteen.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cItems.map(item => (
                      <div key={item.item_id} className="bg-gray-800 border-2 border-gray-600 rounded-xl p-3 flex items-center gap-3" data-testid={`admin-menu-item-${item.item_id}`}>
                        <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg border-2 border-gray-500" loading="lazy" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{item.name}</p>
                          <p className="font-black text-lime-400 text-sm" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>₹{item.price}</p>
                        </div>
                        <button onClick={async () => { await API.delete(`/admin/menu-items/${item.item_id}`); fetchAll(); }} className="w-7 h-7 bg-gray-700 border border-gray-500 rounded-md flex items-center justify-center hover:bg-red-900/50" data-testid={`delete-menu-${item.item_id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="staff" className="space-y-4" data-testid="staff-content">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Staff Members</h3>
              <AddStaffDialog canteens={canteens} onAdd={fetchAll} />
            </div>
            <div className="space-y-3">
              {staff.map((member, i) => (
                <div key={member.id} className="bg-gray-800 border-[3px] border-gray-600 rounded-xl p-4 flex items-center gap-4 shadow-[4px_4px_0px_0px_rgba(75,85,99,0.5)]" data-testid={`staff-card-${member.id}`}>
                  <div className={`w-12 h-12 ${canteenColors[i % 4]} border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`}><span className="text-lg font-black">{member.name[0]}</span></div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{member.name}</p>
                    <p className="text-xs text-gray-500 font-medium">{member.email}</p>
                    <Badge className="bg-gray-700 text-gray-300 border border-gray-600 font-bold text-[10px] mt-1">{member.canteen_id}</Badge>
                  </div>
                  <button onClick={async () => { await API.delete(`/admin/staff/${member.id}`); fetchAll(); }} className="w-8 h-8 bg-gray-700 border-2 border-gray-500 rounded-lg flex items-center justify-center hover:bg-red-900/50" data-testid={`delete-staff-${member.id}`}>
                    <Trash2 className="w-4 h-4 text-red-400" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function AddCanteenDialog({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ canteen_id: "", name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try { await API.post("/admin/canteens", form); setOpen(false); setForm({ canteen_id: "", name: "", description: "" }); onAdd(); } catch (e) { /* Error handled silently */ } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-yellow-300 border-[3px] border-black rounded-lg px-4 py-2 font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center gap-1.5" data-testid="add-canteen-btn"><Plus className="w-4 h-4" strokeWidth={2.5} />Add Canteen</button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-[3px] border-gray-600 text-white">
        <DialogHeader><DialogTitle className="text-white font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Add Canteen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input placeholder="Canteen ID (e.g. cafe)" value={form.canteen_id} onChange={e => setForm({ ...form, canteen_id: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-canteen-id" />
          <input placeholder="Canteen Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-canteen-name" />
          <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-canteen-desc" />
          <button onClick={handleSubmit} disabled={loading} className="w-full btn-yellow flex items-center justify-center gap-2" data-testid="submit-canteen-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Add Canteen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMenuItemDialog({ canteens, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", canteen_id: "", name: "", price: "", image: "", category: "", veg: true });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try { await API.post("/admin/menu-items", { ...form, price: parseInt(form.price) || 0 }); setOpen(false); setForm({ item_id: "", canteen_id: "", name: "", price: "", image: "", category: "", veg: true }); onAdd(); } catch (e) { /* Error handled silently */ } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-yellow-300 border-[3px] border-black rounded-lg px-4 py-2 font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center gap-1.5" data-testid="add-menu-item-btn"><Plus className="w-4 h-4" strokeWidth={2.5} />Add Item</button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-[3px] border-gray-600 text-white max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Add Menu Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input placeholder="Item ID (e.g. m7)" value={form.item_id} onChange={e => setForm({ ...form, item_id: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-item-id" />
          <select value={form.canteen_id} onChange={e => setForm({ ...form, canteen_id: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white" data-testid="new-item-canteen">
            <option value="">Select Canteen</option>
            {canteens.map(c => <option key={c.canteen_id} value={c.canteen_id}>{c.name}</option>)}
          </select>
          <input placeholder="Item Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-item-name" />
          <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-item-price" />
          <input placeholder="Image URL" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-item-image" />
          <input placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-item-category" />
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.veg} onChange={e => setForm({ ...form, veg: e.target.checked })} className="w-5 h-5" /> Vegetarian</label>
          <button onClick={handleSubmit} disabled={loading} className="w-full btn-yellow flex items-center justify-center gap-2" data-testid="submit-menu-item-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Add Item
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddStaffDialog({ canteens, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", canteen_id: "" });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try { await API.post("/admin/staff", form); setOpen(false); setForm({ email: "", password: "", name: "", canteen_id: "" }); onAdd(); } catch (e) { /* Error handled silently */ } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bg-yellow-300 border-[3px] border-black rounded-lg px-4 py-2 font-bold text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center gap-1.5" data-testid="add-staff-btn"><Plus className="w-4 h-4" strokeWidth={2.5} />Add Staff</button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-[3px] border-gray-600 text-white">
        <DialogHeader><DialogTitle className="text-white font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Add Staff Member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <input placeholder="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-staff-name" />
          <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-staff-email" />
          <input placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400" data-testid="new-staff-password" />
          <select value={form.canteen_id} onChange={e => setForm({ ...form, canteen_id: e.target.value })} className="input-brutal bg-gray-700 border-gray-500 text-white" data-testid="new-staff-canteen">
            <option value="">Assign Canteen</option>
            {canteens.map(c => <option key={c.canteen_id} value={c.canteen_id}>{c.name}</option>)}
          </select>
          <button onClick={handleSubmit} disabled={loading} className="w-full btn-yellow flex items-center justify-center gap-2" data-testid="submit-staff-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Add Staff
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CanteenCard({ canteen, colorClass, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(canteen.name);
  const [description, setDescription] = useState(canteen.description);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put(`/admin/canteens/${canteen.canteen_id}`, { name, description });
      setEditing(false);
      onUpdate();
    } catch (e) { /* Error handled silently */ }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    setName(canteen.name);
    setDescription(canteen.description);
    setEditing(false);
  };

  return (
    <div className="bg-gray-800 border-[3px] border-gray-600 rounded-xl p-5 shadow-[4px_4px_0px_0px_rgba(75,85,99,0.5)]" data-testid={`canteen-card-${canteen.canteen_id}`}>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 ${colorClass} border-[3px] border-black rounded-xl flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex-shrink-0`}>
          <Store className="w-6 h-6 text-black" strokeWidth={2.5} />
        </div>
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400 text-sm py-1.5"
              placeholder="Canteen Name"
              data-testid={`edit-canteen-name-${canteen.canteen_id}`}
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-brutal bg-gray-700 border-gray-500 text-white placeholder:text-gray-400 text-xs py-1.5"
              placeholder="Description"
              data-testid={`edit-canteen-desc-${canteen.canteen_id}`}
            />
          </div>
        ) : (
          <div className="flex-1">
            <h4 className="font-black text-white text-base" style={{ fontFamily: "'Outfit', sans-serif" }}>{canteen.name}</h4>
            <p className="text-xs text-gray-500 font-semibold">{canteen.description}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {editing ? (
          <>
            <button onClick={handleCancel} className="text-xs font-bold text-gray-400 hover:text-white px-3 py-1.5 border border-gray-600 rounded-lg transition-colors" data-testid={`cancel-edit-${canteen.canteen_id}`}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="bg-lime-400 text-black text-xs font-bold px-3 py-1.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] btn-brutal flex items-center gap-1" data-testid={`save-canteen-${canteen.canteen_id}`}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}Save
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 border border-gray-500 rounded-lg hover:bg-gray-600 flex items-center gap-1.5 transition-colors" data-testid={`edit-canteen-${canteen.canteen_id}`}>
            <Pencil className="w-3 h-3" strokeWidth={2.5} />Edit
          </button>
        )}
        <Badge className="bg-lime-400/20 text-lime-400 border border-lime-400/50 font-bold text-[10px] ml-auto">{canteen.status || "active"}</Badge>
      </div>
    </div>
  );
}
