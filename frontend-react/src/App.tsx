import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/Home/HomePage';
import { RestaurantDetail } from './pages/RestaurantDetail/resDetail';
import { SearchRestaurants } from './pages/Search/search';
import { LocationProvider } from './context/LocationProvider';
import { Toaster } from 'sonner';
import { ScrollToTop } from './components/ScrolltoTop/ScrolltoTop';
import './App.css';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import RestaurantManagement from './pages/Admin/RestaurantManagement';
import AdminStats from './pages/Admin/AdminStats';
import ManagerLayout from './layouts/ManagerLayout';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import BookingManagement from './pages/Manager/BookingManagement';
import MenuManagement from './pages/Manager/MenuManagement';
import ManagerStats from './pages/Manager/ManagerStats';
import BookingPage from './pages/Account/booking';


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <Toaster position="top-right" richColors />
        <Router>
          <ScrollToTop />
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/restaurant/:id" element={<RestaurantDetail />} />
              <Route path="/search" element={<SearchRestaurants />} />
              <Route path="/account/bookings" element={<BookingPage />} />
              <Route path="/account/bookings/:bookingId" element={<BookingPage />} />
            </Route>

            {/* === Admin === */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin"             element={<AdminDashboard />} />
                <Route path="/admin/users"       element={<UserManagement />} />
                <Route path="/admin/restaurants" element={<RestaurantManagement />} />
                <Route path="/admin/stats"       element={<AdminStats />} />
              </Route>
            </Route>

            {/* === Manager === */}
            <Route element={<ProtectedRoute allowedRoles={['manager']} />}>
              <Route element={<ManagerLayout />}>
                <Route path="/manager"          element={<ManagerDashboard />} />
                <Route path="/manager/bookings" element={<BookingManagement />} />
                <Route path="/manager/menu"     element={<MenuManagement />} />
                <Route path="/manager/stats"    element={<ManagerStats />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </LocationProvider>
    </QueryClientProvider>
  );
}

export default App;
