import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import LandingPage from "@/pages/LandingPage";
import StudentLogin from "@/pages/student/StudentLogin";
import StudentMenu from "@/pages/student/StudentMenu";
import StudentCart from "@/pages/student/StudentCart";
import StudentOrder from "@/pages/student/StudentOrder";
import StudentOrders from "@/pages/student/StudentOrders";
import CanteenLogin from "@/pages/canteen/CanteenLogin";
import CanteenDashboard from "@/pages/canteen/CanteenDashboard";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <NotificationProvider>
          <BrowserRouter>
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
          </BrowserRouter>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
