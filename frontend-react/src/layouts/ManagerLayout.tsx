import { translateBookingNotification } from "../utils/status";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import DashboardSidebar from "../components/DashboardSidebar/DashboardSidebar";
import type { NavItem } from "../components/DashboardSidebar/DashboardSidebar";
import { api } from "../services/api";
import TableConflictPanel from "../components/TableConflictPanel";
import { useAuth } from "../hooks/useAuth";
import { useCustomerNotifications } from "../hooks/useCustomerNotifications";
import { toast } from "sonner";

const MANAGER_NAV: NavItem[] = [
  { label: "Thống kê", to: "/manager/dashboard", icon: "stats" },
  { label: "Đặt bàn", to: "/manager/bookings", icon: "booking" },
  { label: "Tin nhắn", to: "/manager/chat", icon: "message" },
  { label: "Thực đơn", to: "/manager/menu", icon: "menu" },
  { label: "Mã giảm giá", to: "/manager/discounts", icon: "receipt" },
  { label: "Tiền đặt cọc", to: "/manager/finance", icon: "wallet" },
  { label: "Sơ đồ bàn", to: "/manager/tables", icon: "booking" },
  { label: "Lịch sử ca", to: "/manager/shifts", icon: "receipt" },
  {
    label: "Cài đặt nhà hàng",
    to: "/manager/restaurant-settings",
    icon: "settings",
  },
  { label: "Hồ sơ đối tác", to: "/manager/partner", icon: "partner" },
  {
    label: "Trạng thái xét duyệt",
    to: "/manager/approval-status",
    icon: "approval",
  },
  { label: "Vi phạm", to: "/manager/violation-reports", icon: "shield" },
  { label: "Thay đổi mật khẩu", to: "/manager/password-settings", icon: "settings" },
];

const BREADCRUMB: Record<string, string> = {
  "/manager/password-settings": "Thay đổi mật khẩu",
  "/manager": "Chọn khu vực làm việc",
  "/manager/dashboard": "Quản trị nhà hàng",
  "/manager/cashier": "Thu ngân",
  "/manager/tables": "Sơ đồ bàn",
  "/manager/shifts": "Lịch sử ca",
  "/manager/bookings": "Quản lý đặt bàn",
  "/manager/chat": "Tin nhắn",
  "/manager/menu": "Quản lý thực đơn",
  "/manager/discounts": "Mã giảm giá",
  "/manager/finance": "Tiền đặt cọc & rút tiền",
  "/manager/restaurant-settings": "Cài đặt nhà hàng",
  "/manager/partner": "Hồ sơ đối tác",
  "/manager/approval-status": "Trạng thái xét duyệt",
  "/manager/violation-reports": "Vi phạm",
};

type ManagerNotification = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
  type: string;
  bookingId?: number | null;
  conversationId?: number | null;
};

export default function ManagerLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const crumb = BREADCRUMB[location.pathname] ?? "Manager";
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const restaurantQuery = useQuery<{ id: number; is_active: boolean; approval_status: string } | null>({
    queryKey: ["partner-application"],
    queryFn: () =>
      api.get("/v1/partners/application/me").then((response) => response.data),
  });
  const notificationsQuery = useCustomerNotifications(user?.userId, "manager-notifications");
  const isRestaurantActive = restaurantQuery.data?.is_active === true;
  const notifications = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!isNotificationOpen) {
      return;
    }

    const closeWhenClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", closeWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickOutside);
    };
  }, [isNotificationOpen]);

  const openNotification = (notification: ManagerNotification) => {
    if (!notification.isRead) {
      void api.put(`/v1/notifications/${notification.id}/read`)
        .then(() => notificationsQuery.refetch()).catch(() => toast.error("Không thể đánh dấu thông báo đã đọc."));
    }
    setIsNotificationOpen(false);
    if (notification.type === "chat_message") {
      navigate(`/manager/chat?conversation=${notification.conversationId ?? ""}`);
    } else if (notification.type.startsWith("withdrawal_") || notification.type === "booking_fee") {
      navigate("/manager/finance");
    } else if (notification.type.startsWith("approval_")) {
      navigate("/manager/approval-status");
    } else if (notification.type === "violation_warning" || notification.type === "late_response_warning") {
      navigate("/manager/violation-reports");
    } else {
      navigate(notification.bookingId
        ? `/manager/bookings?booking=${notification.bookingId}`
        : "/manager/bookings?status=all");
    }
  };

  const markAllNotificationsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      await api.put("/v1/notifications/read-all");
      await notificationsQuery.refetch();
    } catch { toast.error("Không thể đánh dấu thông báo đã đọc."); }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800 font-sans">
      <DashboardSidebar
        navItems={MANAGER_NAV}
        brandLabel="Manager Panel"
        variant="manager"
        footerLink={{
          label: "Chọn khu vực làm việc",
          to: "/manager",
          icon: "dashboard",
        }}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 lg:px-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="w-10 lg:hidden flex-shrink-0" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400">Manager</span>
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
            <span className="font-normal text-gray-800">{crumb}</span>
          </div>
          <div
            ref={notificationRef}
            className="relative ml-auto flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => { setIsNotificationOpen((current) => !current); if (!isNotificationOpen) void notificationsQuery.refetch(); }}
              className="relative cursor-pointer rounded-lg p-2 text-gray-600 transition hover:bg-red-50 hover:text-red-700"
              aria-label="Thông báo"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-normal text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <div
              className={`h-2 w-2 rounded-full ring-2 ${
                isRestaurantActive
                  ? "bg-emerald-500 ring-emerald-100"
                  : "bg-gray-400 ring-gray-100"
              }`}
            />
            <span
              className={`hidden text-xs font-normal sm:block ${
                isRestaurantActive ? "text-emerald-700" : "text-gray-500"
              }`}
            >
              {isRestaurantActive
                ? "Nhà hàng đang hoạt động"
                : "Nhà hàng không hoạt động"}
            </span>
            {isNotificationOpen && (
              <div className="absolute right-0 top-12 z-50 w-88 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-normal text-gray-900">Thông báo</p>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="cursor-pointer text-xs font-normal text-red-700 hover:text-red-900"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationOpen(false);
                        navigate("/manager/approval-status");
                      }}
                      className="cursor-pointer text-xs font-normal text-red-700"
                    >
                      Xem lịch sử
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsQuery.isError && <p role="alert" className="p-5 text-sm text-red-700">Không tải được thông báo. <button onClick={()=>void notificationsQuery.refetch()} className="underline">Thử lại</button></p>}
                  {notificationsQuery.isLoading && <p className="p-5 text-sm text-gray-500">Đang tải thông báo...</p>}
                  {!notificationsQuery.isError && !notificationsQuery.isLoading && !notifications.length && (
                    <p className="p-5 text-center text-sm text-gray-400">
                      Chưa có thông báo.
                    </p>
                  )}
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={`w-full cursor-pointer border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                        notification.isRead ? "bg-white" : "bg-red-50/70"
                      } hover:bg-gray-50`}
                    >
                      <p className="text-sm font-normal text-gray-800">
                        {notification.type === "booking_status" ? translateBookingNotification(notification.title) : notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                        {notification.type === "booking_status" ? translateBookingNotification(notification.message) : notification.message}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {restaurantQuery.data?.id && restaurantQuery.data.is_active && restaurantQuery.data.approval_status === "approved" ? <TableConflictPanel /> : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
