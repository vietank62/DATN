import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import DashboardSidebar from "../components/DashboardSidebar/DashboardSidebar";
import type { NavItem } from "../components/DashboardSidebar/DashboardSidebar";
import { useAuth } from "../hooks/useAuth";
import {
  useCustomerNotifications,
  type CustomerNotification,
} from "../hooks/useCustomerNotifications";
import { api } from "../services/api";
import { adminNotificationDestination } from "../utils/notificationDestination";

const ADMIN_NAV: NavItem[] = [
  { label: "Tổng quan", to: "/admin", icon: "dashboard" },
  { label: "Người dùng", to: "/admin/users", icon: "users" },
  { label: "Nhà hàng", to: "/admin/restaurants", icon: "restaurant" },
  { label: "Duyệt đối tác", to: "/admin/partner-applications", icon: "approval" },
  { label: "Lịch sử duyệt", to: "/admin/approval-history", icon: "history" },
  { label: "Báo cáo vi phạm", to: "/admin/violation-reports", icon: "shield" },
  { label: "Rút tiền / Hoàn cọc", to: "/admin/withdrawals", icon: "wallet" },
  { label: "Phí dịch vụ", to: "/admin/booking-fees", icon: "receipt" },
  { label: "Thống kê", to: "/admin/stats", icon: "stats" },
  { label: "Xung đột bàn", to: "/admin/table-incidents", icon: "shield" },
];

const BREADCRUMB: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/users": "Quản lý người dùng",
  "/admin/restaurants": "Quản lý nhà hàng",
  "/admin/partner-applications": "Duyệt đối tác",
  "/admin/approval-history": "Lịch sử duyệt",
  "/admin/violation-reports": "Báo cáo vi phạm",
  "/admin/withdrawals": "Rút tiền và hoàn cọc",
  "/admin/booking-fees": "Phí dịch vụ",
  "/admin/stats": "Thống kê",
};


export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const crumb = BREADCRUMB[location.pathname] ?? "Admin";
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationsQuery = useCustomerNotifications(user?.userId, "admin-notifications");
  const notifications = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!isNotificationOpen) return;
    const closeWhenClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", closeWhenClickOutside);
    return () => document.removeEventListener("mousedown", closeWhenClickOutside);
  }, [isNotificationOpen]);

  const openNotification = async (notification: CustomerNotification) => {
    if (!notification.isRead) {
      try {
        await api.put(`/v1/notifications/${notification.id}/read`);
        await notificationsQuery.refetch();
      } catch {
        // The destination remains available even if the read-state update fails.
      }
    }
    setIsNotificationOpen(false);
    navigate(adminNotificationDestination(notification));
  };

  const markAllNotificationsRead = async () => {
    if (!unreadCount) return;
    try {
      await api.put("/v1/notifications/read-all");
      await notificationsQuery.refetch();
    } catch {
      // A later stream refresh retries the snapshot automatically.
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-800">
      <DashboardSidebar navItems={ADMIN_NAV} brandLabel="Admin Panel" variant="admin" />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-6">
          <div className="w-10 shrink-0 lg:hidden" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400">Admin</span>
            <svg className="h-3 w-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-normal text-gray-800">{crumb}</span>
          </div>

          <div ref={notificationRef} className="relative ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen((current) => !current);
                void notificationsQuery.refetch();
              }}
              className="relative cursor-pointer rounded-lg p-2 text-gray-600 transition hover:bg-red-50 hover:text-red-700"
              aria-label={`Thông báo, ${unreadCount} chưa đọc`}
              aria-expanded={isNotificationOpen}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <div className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-100" />
            <span className="hidden text-xs text-gray-400 sm:block">Hệ thống hoạt động</span>

            {isNotificationOpen && (
              <div className="absolute right-0 top-12 z-50 w-88 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-bold text-gray-900">Thông báo quản trị</p>
                  {unreadCount > 0 && (
                    <button type="button" onClick={() => void markAllNotificationsRead()} className="cursor-pointer text-xs font-semibold text-red-700 hover:text-red-900">
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsQuery.isPending && <p className="p-5 text-center text-sm text-gray-400">Đang tải thông báo...</p>}
                  {notificationsQuery.isError && <p className="p-5 text-center text-sm text-red-600">Chưa thể tải thông báo.</p>}
                  {!notificationsQuery.isPending && !notificationsQuery.isError && notifications.length === 0 && (
                    <p className="p-5 text-center text-sm text-gray-400">Chưa có thông báo.</p>
                  )}
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={`w-full cursor-pointer border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${notification.isRead ? "bg-white" : "bg-red-50/70"} hover:bg-gray-50`}
                    >
                      <p className="text-sm font-bold text-gray-800">{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{notification.message}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
