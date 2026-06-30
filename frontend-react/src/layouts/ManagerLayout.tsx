import { Outlet, useLocation } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar';
import type { NavItem } from '../components/DashboardSidebar/DashboardSidebar';

const MANAGER_NAV: NavItem[] = [
  { label: 'Tổng quan',  to: '/manager',          icon: 'dashboard' },
  { label: 'Đặt bàn',    to: '/manager/bookings', icon: 'booking' },
  { label: 'Thực đơn',   to: '/manager/menu',     icon: 'menu' },
  { label: 'Thống kê',   to: '/manager/stats',    icon: 'stats' },
];

const BREADCRUMB: Record<string, string> = {
  '/manager':          'Tổng quan',
  '/manager/bookings': 'Quản lý đặt bàn',
  '/manager/menu':     'Quản lý thực đơn',
  '/manager/stats':    'Thống kê',
};

export default function ManagerLayout() {
  const location = useLocation();
  const crumb = BREADCRUMB[location.pathname] ?? 'Manager';

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800 font-sans">
      <DashboardSidebar navItems={MANAGER_NAV} brandLabel="Manager Panel" variant="manager" />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 lg:px-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-10 lg:hidden flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400">Manager</span>
            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-gray-800">{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100 animate-pulse" />
            <span className="hidden sm:block text-xs text-gray-400">Hệ thống hoạt động</span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}