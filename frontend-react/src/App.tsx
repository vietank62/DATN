import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrolltoTop/ScrolltoTop";
import { LocationProvider } from "./context/LocationProvider";
import { useTranslation } from "react-i18next";
import AdminLayout from "./layouts/AdminLayout";
import MainLayout from "./layouts/MainLayout";
import ManagerLayout from "./layouts/ManagerLayout";
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

function PageLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-gray-500">
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
          <ScrollToTop />
          <Suspense fallback={<PageLoading />}>
            <Routes>
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
