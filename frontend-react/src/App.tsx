import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/Home/HomePage';
import { LocationProvider } from './context/LocationContext';
import { Toaster } from 'sonner';
import './App.css';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
// import AdminDashboard from './pages/Admin/AdminDashboard';
// import UserManagement from './pages/Admin/UserManagement';
// import RestaurantManagement from './pages/Admin/RestaurantManagement';
import ManagerLayout from './layouts/ManagerLayout';
// import ManagerDashboard from './pages/Manager/ManagerDashboard';
// import BookingManagement from './pages/Manager/BookingManagement';
// import MenuManagement from './pages/Manager/MenuManagement';

function App() {
  return (
    <LocationProvider>
      <Toaster position="top-right" richColors />
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            {/* Thêm các Route mới ở đây. Ví dụ: */}
            {/* <Route path="/about" element={<AboutPage />} /> */}
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              {/* <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/restaurants" element={<RestaurantManagement />} /> */}
            </Route>
          </Route>
          {/* === Trang Manager (ManagerLayout + chỉ role manager) === */}
          <Route element={<ProtectedRoute allowedRoles={['manager']} />}>
            <Route element={<ManagerLayout />}>
              {/* <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/manager/bookings" element={<BookingManagement />} />
              <Route path="/manager/menu" element={<MenuManagement />} /> */}
            </Route>
          </Route>
        </Routes>
      </Router>
    </LocationProvider>
  );
}

export default App;
