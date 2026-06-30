import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/Home/HomePage';
import { LocationProvider } from './context/LocationProvider';
import { Toaster } from 'sonner';
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

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <Toaster position="top-right" richColors />
        <Router>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
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
