import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useCustomerNotifications } from "../hooks/useCustomerNotifications";

type Notification = { id: number; title: string; message: string; isRead: boolean; type: string };

export default function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["admin-notifications", user?.userId];
  const notifications = useCustomerNotifications(user?.userId, "admin-notifications");
  const markRead = useMutation({
    mutationFn: (id: number | null) => api.put(id === null ? "/v1/notifications/read-all" : `/v1/notifications/${id}/read`),
    onSuccess: () => { void client.invalidateQueries({ queryKey }); },
    onError: () => toast.error("Không thể đánh dấu thông báo đã đọc."),
  });
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const unread = notifications.data?.unreadCount ?? 0;
  const openNotification = (item: Notification) => {
    if (!item.isRead) markRead.mutate(item.id);
    setOpen(false);
    if (item.type === "table_conflict") navigate("/admin/table-incidents");
    else if (item.type.startsWith("withdrawal") || item.type.includes("refund")) navigate("/admin/withdrawals");
    else if (item.type.startsWith("approval") || item.type.includes("partner")) navigate("/admin/partner-applications");
    else if (item.type.includes("violation") || item.type.includes("report")) navigate("/admin/violation-reports");
    else if (item.type.includes("fee")) navigate("/admin/booking-fees");
  };
  return <div ref={container} className="relative">
    <button type="button" aria-label="Thông báo quản trị viên" aria-expanded={open} aria-controls="admin-notifications-panel" onClick={() => { setOpen(value => !value); if (!open) void notifications.refetch(); }} className="relative rounded-lg p-2 text-gray-600 transition hover:bg-red-50 hover:text-red-700">
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div id="admin-notifications-panel" className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <p className="text-sm text-gray-900">Thông báo</p>
        {unread > 0 && <button type="button" disabled={markRead.isPending} onClick={() => markRead.mutate(null)} className="text-xs text-red-700 disabled:opacity-50">Đánh dấu tất cả đã đọc</button>}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.isLoading ? <p className="p-5 text-sm text-gray-500">Đang tải thông báo...</p> : notifications.isError ? <div className="p-5 text-sm text-gray-500">Không tải được thông báo. <button type="button" onClick={() => void notifications.refetch()} className="text-red-600">Thử lại</button></div> : !notifications.data?.items.length ? <p className="p-5 text-center text-sm text-gray-400">Chưa có thông báo.</p> : notifications.data.items.map(item => <button key={item.id} type="button" onClick={() => openNotification(item)} className={`w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 ${item.isRead ? "bg-white" : "bg-red-50/70"}`}>
          <p className="text-sm text-gray-800">{item.title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">{item.message}</p>
        </button>)}
      </div>
    </div>}
  </div>;
}
