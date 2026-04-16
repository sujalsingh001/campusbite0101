import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { NotificationProvider } from "@/contexts/FirebaseNotificationContext";
import LandingPage from "@/pages/LandingPage";
import StudentLogin from "@/pages/student/StudentLogin";
import StudentMenu from "@/pages/student/StudentMenu";
import StudentCart from "@/pages/student/StudentCart";
import StudentOrder from "@/pages/student/StudentOrderRealtime";
import StudentOrders from "@/pages/student/StudentOrdersRealtime";
import CanteenLogin from "@/pages/canteen/CanteenLogin";
import CanteenDashboard from "@/pages/canteen/CanteenDashboardRealtime";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function SplashScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-400 via-yellow-300 to-pink-300 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-black border-[4px] border-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)]">
          <span className="text-4xl font-black text-white">C</span>
        </div>
        <h1 className="text-3xl font-black text-black mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>CampusBite</h1>
        <Loader2 className="w-8 h-8 animate-spin text-black mx-auto" strokeWidth={3} />
      </div>
    </div>
  );
}

function AppContent() {
  const { loading } = useAuth();
  
  if (loading) return <SplashScreen />;

  return (
    <>
      <Toaster
              position="top-center"
              richColors
              toastOptions={{
                style: {
                  border: '3px solid black',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                },
              }}
            />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/student/menu" element={<StudentMenu />} />
              <Route path="/student/cart" element={<StudentCart />} />
              <Route path="/student/order/:orderId" element={<StudentOrder />} />
              <Route path="/student/orders" element={<StudentOrders />} />
              <Route path="/canteen/login" element={<CanteenLogin />} />
              <Route path="/canteen/dashboard" element={<CanteenDashboard />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
