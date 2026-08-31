import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/Home/HomePage";
import { RestaurantDetail } from "./pages/RestaurantDetail/resDetail";
import { SearchRestaurants } from "./pages/Search/search";
import { LocationProvider } from "./context/LocationProvider";
import { Toaster } from "sonner";
import { ScrollToTop } from "./components/ScrolltoTop/ScrolltoTop";
import "./App.css";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import UserManagement from "./pages/Admin/UserManagement";
import RestaurantManagement from "./pages/Admin/RestaurantManagement";
import AdminStats from "./pages/Admin/AdminStats";
import ManagerLayout from "./layouts/ManagerLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ManagerDashboard from "./pages/Manager/ManagerDashboard";
import BookingManagement from "./pages/Manager/BookingManagement";
import MenuManagement from "./pages/Manager/MenuManagement";
import BookingPage from "./pages/Account/booking";
import PartnerProfile from "./pages/Manager/PartnerProfile";
import PartnerApprovals from "./pages/Admin/PartnerApprovals";
import RestaurantSettings from "./pages/Manager/RestaurantSettings";
import PartnerRegister from "./pages/Manager/PartnerRegister";
import PartnerPolicy from "./pages/Manager/PartnerPolicy";
import ApprovalHistory from "./pages/Admin/ApprovalHistory";
import ApprovalStatus from "./pages/Manager/ApprovalStatus";
import ChatPage from "./pages/Chat/ChatPage";
import ViolationReports from "./pages/ViolationReports";
import AccountProfile from "./pages/Account/AccountProfile";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <Toaster
          position="top-right"
          offset="60px"
          duration={2500}
          richColors
        />
        <Router>
          <ScrollToTop />
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/restaurant/:id" element={<RestaurantDetail />} />
              <Route path="/search" element={<SearchRestaurants />} />
              <Route path="/partner/register" element={<PartnerRegister />} />
              <Route path="/partner/policy" element={<PartnerPolicy />} />
              <Route element={<ProtectedRoute allowedRoles={["customer"]} />}>
                <Route path="/account/profile" element={<AccountProfile />} />
                <Route path="/account/bookings" element={<BookingPage />} />
                <Route
                  path="/account/bookings/:bookingId"
                  element={<BookingPage />}
                />
                <Route path="/account/violation-reports" element={<ViolationReports />} />
                <Route path="/chat/:restaurantId?" element={<ChatPage />} />
              </Route>
            </Route>

            {/* === Admin === */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UserManagement />} />
                <Route
                  path="/admin/restaurants"
                  element={<RestaurantManagement />}
                />
                <Route
                  path="/admin/partner-applications"
                  element={<PartnerApprovals />}
                />
                <Route path="/admin/stats" element={<AdminStats />} />
                <Route path="/admin/approval-history" element={<ApprovalHistory />} />
                <Route path="/admin/violation-reports" element={<ViolationReports />} />
              </Route>
            </Route>

            {/* === Manager === */}
            <Route element={<ProtectedRoute allowedRoles={["manager"]} />}>
              <Route element={<ManagerLayout />}>
                <Route path="/manager" element={<ManagerDashboard />} />
                <Route
                  path="/manager/bookings"
                  element={<BookingManagement />}
                />
                <Route path="/manager/menu" element={<MenuManagement />} />
                <Route path="/manager/chat" element={<ChatPage />} />
                <Route path="/manager/partner" element={<PartnerProfile />} />
                <Route path="/manager/approval-status" element={<ApprovalStatus />} />
                <Route path="/manager/violation-reports" element={<ViolationReports />} />
                <Route
                  path="/manager/restaurant-settings"
                  element={<RestaurantSettings />}
                />
              </Route>
            </Route>
          </Routes>
        </Router>
      </LocationProvider>
    </QueryClientProvider>
  );
}

export default App;
