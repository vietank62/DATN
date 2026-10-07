import { lazy, Suspense, useLayoutEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { CustomerFacingRoute } from "./components/CustomerFacingRoute";
import { ScrollToTop } from "./components/ScrolltoTop/ScrolltoTop";
import { LocationProvider } from "./context/LocationProvider";
import { useTranslation } from "react-i18next";
import AdminLayout from "./layouts/AdminLayout";
import MainLayout from "./layouts/MainLayout";
import ManagerLayout from "./layouts/ManagerLayout";
import CashierMenu from "./pages/Manager/CashierMenu";
import CashierBookings from "./pages/Manager/CashierBookings";
import ManagementGate from "./components/ManagementGate";
import PasswordSettings from "./pages/Manager/PasswordSettings";
import CashierLayout from "./layouts/CashierLayout";
import { AdminTableIncidents } from "./components/TableConflictPanel";
import "./App.css";

const BookingFees = lazy(() => import("./components/BookingFees"));
const HomePage = lazy(() => import("./pages/Home/HomePage"));
const RestaurantDetail = lazy(() =>
  import("./pages/RestaurantDetail/resDetail").then(({ RestaurantDetail }) => ({
    default: RestaurantDetail,
  })),
);
const SearchRestaurants = lazy(() =>
  import("./pages/Search/search").then(({ SearchRestaurants }) => ({
    default: SearchRestaurants,
  })),
);
const NearbyRestaurantsMap = lazy(() => import("./pages/Map/NearbyRestaurantsMap"));
const PartnerRegister = lazy(() => import("./pages/Manager/PartnerRegister"));
const PartnerPolicy = lazy(() => import("./pages/Manager/PartnerPolicy"));
const AccountProfile = lazy(() => import("./pages/Account/AccountProfile"));
const BookingRefund = lazy(() => import("./pages/Account/BookingRefund"));
const Favorites = lazy(() => import("./pages/Account/Favorites"));
const BookingPage = lazy(() => import("./pages/Account/booking"));
const ChatPage = lazy(() => import("./pages/Chat/ChatPage"));
const ViolationReports = lazy(() => import("./pages/ViolationReports"));
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/Admin/UserManagement"));
const RestaurantManagement = lazy(() =>
  import("./pages/Admin/RestaurantManagement"),
);
const PartnerApprovals = lazy(() => import("./pages/Admin/PartnerApprovals"));
const AdminStats = lazy(() => import("./pages/Admin/AdminStats"));
const ApprovalHistory = lazy(() => import("./pages/Admin/ApprovalHistory"));
const WithdrawalManagement = lazy(() =>
  import("./pages/Admin/WithdrawalManagement"),
);
const ManagerDashboard = lazy(() => import("./pages/Manager/ManagerDashboard"));
const ManagerPortal = lazy(() => import("./pages/Manager/ManagerPortal"));
const CashierPOS = lazy(() => import("./pages/Manager/CashierPOS"));
const TableManagement = lazy(() => import("./pages/Manager/TableManagement"));
const ShiftHistory = lazy(() => import("./pages/Manager/ShiftHistory"));
const DiscountManagement = lazy(() => import("./pages/Manager/DiscountManagement"));
const BookingManagement = lazy(() =>
  import("./pages/Manager/BookingManagement"),
);
const MenuManagement = lazy(() => import("./pages/Manager/MenuManagement"));
const PartnerProfile = lazy(() => import("./pages/Manager/PartnerProfile"));
const ApprovalStatus = lazy(() => import("./pages/Manager/ApprovalStatus"));
const RestaurantSettings = lazy(() =>
  import("./pages/Manager/RestaurantSettings"),
);
const DepositFinance = lazy(() => import("./pages/Manager/DepositFinance"));
const PublicInfo = lazy(() => import("./pages/PublicInfo"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (
          error as { response?: { status?: number } }
        ).response?.status;

        // Retrying validation/permission errors only makes the UI wait longer.
        // A single retry is still useful for transient network and server errors.
        return (status === undefined || status >= 500) && failureCount < 1;
      },
      retryDelay: 750,
    },
  },
});

function TypographyScope() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.body.classList.toggle("customer-typography", !/^\/(manager|admin)(\/|$)/.test(pathname));
    return () => document.body.classList.remove("customer-typography");
  }, [pathname]);
  return null;
}

function PageLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-normal text-gray-500">
      {t("page.loading")}
    </div>
  );
}

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
          <TypographyScope />
          <ScrollToTop />
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route element={<CustomerFacingRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/restaurant/:id" element={<RestaurantDetail />} />
                <Route path="/search" element={<SearchRestaurants />} />
                <Route path="/map" element={<NearbyRestaurantsMap />} />
                <Route path="/about" element={<PublicInfo />} />
                <Route path="/booking-guide" element={<PublicInfo />} />
                <Route path="/contact" element={<PublicInfo />} />
                <Route path="/policies/terms" element={<PublicInfo />} />
                <Route path="/policies/privacy" element={<PublicInfo />} />
                <Route path="/policies/payment-refund" element={<PublicInfo />} />
                <Route path="/partner/register" element={<PartnerRegister />} />
                <Route path="/partner/policy" element={<PartnerPolicy />} />
                <Route element={<ProtectedRoute allowedRoles={["customer"]} />}>
                  <Route path="/account/profile" element={<AccountProfile />} />
                  <Route path="/account/favorites" element={<Favorites />} />
                  <Route path="/account/bookings" element={<BookingPage />} />
                  <Route path="/account/bookings/:bookingId/refund" element={<BookingRefund />} />
                  <Route
                    path="/account/bookings/:bookingId"
                    element={<BookingPage />}
                  />
                  <Route
                    path="/account/violation-reports"
                    element={<ViolationReports />}
                  />
                  <Route path="/chat/:restaurantId?" element={<ChatPage />} />
                </Route>
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
                  <Route path="/admin/booking-fees" element={<BookingFees admin />} />
                  <Route path="/admin/stats" element={<AdminStats />} />
                  <Route
                    path="/admin/approval-history"
                    element={<ApprovalHistory />}
                  />
                  <Route
                    path="/admin/violation-reports"
                    element={<ViolationReports />}
                  />
                  <Route
                    path="/admin/withdrawals"
                    element={<WithdrawalManagement />}
                  />
                  <Route path="/admin/table-incidents" element={<AdminTableIncidents />} />
                </Route>
              </Route>

              {/* === Manager === */}
              <Route element={<ProtectedRoute allowedRoles={["manager"]} />}>
                <Route path="/manager" element={<ManagerPortal />} />
                <Route element={<CashierLayout />}>
                  <Route path="/manager/cashier" element={<CashierPOS />} />
                  <Route path="/manager/cashier/menu" element={<CashierMenu />} />
                  <Route path="/manager/cashier/bookings" element={<CashierBookings />} />
                  <Route path="/manager/cashier/shift" element={<CashierPOS />} />
                  <Route path="/manager/cashier/invoices" element={<CashierPOS />} />
                  <Route path="/manager/cashier/payment-settings" element={<CashierPaymentSettings />} />
                  <Route path="/manager/cashier/bill/:billId" element={<CashierPOS />} />
                  <Route path="/manager/cashier/table/:tableId" element={<CashierPOS />} />
                </Route>
                <Route element={<ManagementGate><ManagerLayout /></ManagementGate>}>
                  <Route path="/manager/password-settings" element={<PasswordSettings />} />
                  <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                  <Route path="/manager/tables" element={<TableManagement />} />
                  <Route path="/manager/shifts" element={<ShiftHistory />} />
                  <Route path="/manager/shifts/:shiftId" element={<ShiftHistory />} />
                  <Route path="/manager/shifts/:shiftId/bill/:billId" element={<CashierPOS />} />
                  <Route path="/manager/discounts" element={<DiscountManagement />} />
                  <Route
                    path="/manager/bookings"
                    element={<BookingManagement />}
                  />
                  <Route path="/manager/menu" element={<MenuManagement />} />
                  <Route path="/manager/chat" element={<ChatPage />} />
                  <Route path="/manager/partner" element={<PartnerProfile />} />
                  <Route
                    path="/manager/approval-status"
                    element={<ApprovalStatus />}
                  />
                  <Route
                    path="/manager/violation-reports"
                    element={<ViolationReports />}
                  />
                  <Route
                    path="/manager/restaurant-settings"
                    element={<RestaurantSettings />}
                  />
                  <Route path="/manager/finance" element={<DepositFinance />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </Router>
        </LocationProvider>
    </QueryClientProvider>
  );
}

export default App;
import CashierPaymentSettings from "./pages/Manager/CashierPaymentSettings";
