import { Outlet, useLocation } from "react-router-dom";
import DashboardSidebar from "../components/DashboardSidebar/DashboardSidebar";
import type { NavItem } from "../components/DashboardSidebar/DashboardSidebar";

const ADMIN_NAV: NavItem[] = [
  { label: "Tổng quan", to: "/admin", icon: "dashboard" },
  { label: "Người dùng", to: "/admin/users", icon: "users" },
  { label: "Nhà hàng", to: "/admin/restaurants", icon: "restaurant" },
  {
    label: "Duyệt đối tác",
    to: "/admin/partner-applications",
    icon: "restaurant",
  },
  { label: "Lịch sử duyệt", to: "/admin/approval-history", icon: "stats" },
  { label: "Báo cáo vi phạm", to: "/admin/violation-reports", icon: "users" },
  { label: "Rút tiền", to: "/admin/withdrawals", icon: "stats" },
  { label: "Thống kê", to: "/admin/stats", icon: "stats" },
];

const BREADCRUMB: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/users": "Quản lý người dùng",
  "/admin/restaurants": "Quản lý nhà hàng",
  "/admin/partner-applications": "Duyệt đối tác",
  "/admin/approval-history": "Lịch sử duyệt",
  "/admin/violation-reports": "Báo cáo vi phạm",
  "/admin/withdrawals": "Duyệt rút tiền",
  "/admin/stats": "Thống kê",
};

export default function AdminLayout() {
  const location = useLocation();
  const crumb = BREADCRUMB[location.pathname] ?? "Admin";

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800 font-sans">
      <DashboardSidebar
        navItems={ADMIN_NAV}
        brandLabel="Admin Panel"
        variant="admin"
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 lg:px-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-10 lg:hidden flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400">Admin</span>
            <svg
              className="w-3 h-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span className="font-semibold text-gray-800">{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100 animate-pulse" />
            <span className="hidden sm:block text-xs text-gray-400">
              Hệ thống hoạt động
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
