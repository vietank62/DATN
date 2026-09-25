import { useEffect, useId, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../services/api";
import { ROLE_LABEL } from "../utils/status";

type UserDetail = {
  userId: number; name: string; email: string; phone: string; role: string;
  createdAt: string | null; is_suspended: boolean; is_permanently_banned: boolean;
  report_strikes: number; restaurant: { id: number; name: string } | null;
};
type RestaurantDetail = {
  id: number; name: string; address: string; district: string; city: string | null;
  capacity: number; rating: number; review_count: number; is_active: boolean;
  is_report_suspended: boolean; approval_status: string; tax_code: string | null;
  booking_opening_time: string | null; booking_closing_time: string | null; created_at: string;
  manager: { userId: number; name: string; email: string; phone: string } | null;
};

function dateLabel(value: string | null) {
  if (!value) return "Chưa có thông tin";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có thông tin" : date.toLocaleDateString("vi-VN");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-gray-900">{children === null || children === undefined || children === "" ? "Chưa có thông tin" : children}</dd></div>;
}

function DetailDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/50">
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <h2 id={titleId} className="text-lg font-bold text-gray-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button>
      </div>
      {children}
      <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
        <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">Đóng</button>
      </div>
    </div>
  </dialog>;
}

function QueryStatus({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <p role="status" className="py-8 text-center text-sm text-gray-500">Đang tải thông tin...</p>;
  if (error) return <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
    Không thể tải chi tiết. Dữ liệu có thể đã bị xóa hoặc kết nối bị gián đoạn.
    <button type="button" onClick={retry} className="ml-2 font-bold underline">Thử lại</button>
  </div>;
  return null;
}

export function AdminUserDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useQuery<UserDetail>({ queryKey: ["admin-users", "detail", id],
    queryFn: ({ signal }) => api.get(`/v1/users/${id}/detail`, { signal }).then(r => r.data), staleTime: 0 });
  const user = query.data;
  return <DetailDialog title="Chi tiết người dùng" onClose={onClose}>
    <QueryStatus loading={query.isPending} error={query.isError} retry={() => void query.refetch()} />
    {user && !query.isError && <>
      <p className="text-xl font-bold text-gray-900">{user.name}</p>
      <p className="mt-1 text-xs text-gray-500">Mã người dùng #{user.userId}</p>
      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Email">{user.email}</Field><Field label="Số điện thoại">{user.phone}</Field>
        <Field label="Vai trò">{ROLE_LABEL[user.role] ?? user.role}</Field>
        <Field label="Trạng thái tài khoản"><span className={user.is_permanently_banned || user.is_suspended ? "text-red-700" : "text-emerald-700"}>
          {user.is_permanently_banned ? "Khóa vĩnh viễn" : user.is_suspended ? "Tạm khóa" : "Đang hoạt động"}</span></Field>
        <Field label="Ngày tạo">{dateLabel(user.createdAt)}</Field>
        <Field label="Số lần vi phạm">{user.report_strikes}</Field>
        {user.restaurant && <Field label="Nhà hàng quản lý">{user.restaurant.name} (#{user.restaurant.id})</Field>}
      </dl>
    </>}
  </DetailDialog>;
}

export function AdminRestaurantDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useQuery<RestaurantDetail>({ queryKey: ["admin-restaurants", "detail", id],
    queryFn: ({ signal }) => api.get(`/v1/restaurants/${id}/admin-detail`, { signal }).then(r => r.data), staleTime: 0 });
  const restaurant = query.data;
  const approvals: Record<string, string> = { approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Từ chối", draft: "Bản nháp" };
  return <DetailDialog title="Thông tin chính của nhà hàng" onClose={onClose}>
    <QueryStatus loading={query.isPending} error={query.isError} retry={() => void query.refetch()} />
    {restaurant && !query.isError && <>
      <p className="text-xl font-bold text-gray-900">{restaurant.name}</p>
      <p className="mt-1 text-xs text-gray-500">Mã nhà hàng #{restaurant.id}</p>
      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Trạng thái hoạt động">{restaurant.is_report_suspended ? "Tạm ngưng do vi phạm" : restaurant.is_active ? "Đang hoạt động" : "Tạm đóng"}</Field>
        <Field label="Trạng thái duyệt">{approvals[restaurant.approval_status] ?? restaurant.approval_status}</Field>
        <div className="sm:col-span-2"><Field label="Địa chỉ">{[restaurant.address, restaurant.district, restaurant.city].filter(Boolean).join(", ")}</Field></div>
        <Field label="Sức chứa">{restaurant.capacity} khách</Field>
        <Field label="Đánh giá">{restaurant.review_count > 0 ? `${restaurant.rating.toFixed(1)}/5 (${restaurant.review_count} đánh giá)` : "Chưa có đánh giá"}</Field>
        <Field label="Giờ nhận đặt bàn">{restaurant.booking_opening_time && restaurant.booking_closing_time ? `${restaurant.booking_opening_time} – ${restaurant.booking_closing_time}` : "Chưa thiết lập"}</Field>
        <Field label="Mã số thuế">{restaurant.tax_code}</Field>
        <Field label="Ngày tạo">{dateLabel(restaurant.created_at)}</Field>
      </dl>
      <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <h3 className="text-sm font-bold text-gray-900">Người quản lý</h3>
        {restaurant.manager ? <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Họ tên">{restaurant.manager.name} (#{restaurant.manager.userId})</Field>
          <Field label="Số điện thoại">{restaurant.manager.phone}</Field>
          <div className="sm:col-span-2"><Field label="Email">{restaurant.manager.email}</Field></div>
        </dl> : <p className="mt-2 text-sm text-gray-500">Chưa có người quản lý</p>}
      </div>
    </>}
  </DetailDialog>;
}
