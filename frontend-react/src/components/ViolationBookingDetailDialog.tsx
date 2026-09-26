import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../services/api";

type BookingItem = {
  bookingItemId: number;
  name: string;
  quantity: number;
  price: number;
};

type BookingDetail = {
  bookingId: number;
  restaurantName?: string | null;
  date: string;
  time: string;
  guestCount: number;
  childCount: number;
  requestSeats: number;
  status: string;
  depositAmount: number;
  depositStatus: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note?: string | null;
  booking_items?: BookingItem[];
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Chờ thanh toán",
  payment_expired: "Thanh toán hết hạn",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  expired: "Đã hết hạn",
};

const DEPOSIT_LABEL: Record<string, string> = {
  not_required: "Không yêu cầu",
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  refund_pending: "Chờ hoàn cọc",
  refunded: "Đã hoàn cọc",
  forfeited: "Không hoàn cọc",
};

export function ViolationBookingDetailDialog({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const bookingQuery = useQuery<BookingDetail>({
    queryKey: ["violation-booking-detail", bookingId],
    queryFn: ({ signal }) => api.get(`/v1/bookings/${bookingId}`, { signal }).then((response) => response.data),
    staleTime: 0,
  });
  const booking = bookingQuery.data;
  const bookingItems = Array.isArray(booking?.booking_items) ? booking.booking_items : [];
  const itemTotal = bookingItems.reduce((total, item) => total + Number(item.price) * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="violation-booking-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-red-600">Hồ sơ báo cáo liên quan</p>
            <h2 id="violation-booking-title" className="mt-1 text-lg font-bold text-slate-900">Chi tiết đơn đặt bàn #{bookingId}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết đơn" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </header>

        <div className="p-5 sm:p-6">
          {bookingQuery.isPending && <p className="py-8 text-center text-sm text-slate-500">Đang tải thông tin đơn đặt bàn...</p>}
          {bookingQuery.isError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải chi tiết đơn. Đơn có thể đã bị xóa hoặc bạn không còn quyền truy cập.<button type="button" onClick={() => void bookingQuery.refetch()} className="ml-2 font-bold underline">Thử lại</button></div>}
          {booking && !bookingQuery.isError && <div className="space-y-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{booking.restaurantName || "Nhà hàng"}</p>
              <p className="mt-1 text-sm text-slate-600">{booking.date} · {booking.time}</p>
              <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{STATUS_LABEL[booking.status] || booking.status}</span>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Khách đặt bàn</dt><dd className="mt-1 font-semibold text-slate-900">{booking.contactName}</dd></div>
              <div><dt className="text-slate-500">Liên hệ</dt><dd className="mt-1 font-semibold text-slate-900">{booking.contactPhone}</dd><dd className="text-slate-700">{booking.contactEmail}</dd></div>
              <div><dt className="text-slate-500">Số khách</dt><dd className="mt-1 font-semibold text-slate-900">{booking.guestCount} người, {booking.childCount} trẻ em</dd></div>
              <div><dt className="text-slate-500">Số chỗ yêu cầu</dt><dd className="mt-1 font-semibold text-slate-900">{booking.requestSeats} chỗ</dd></div>
              <div><dt className="text-slate-500">Tiền đặt cọc</dt><dd className="mt-1 font-semibold text-slate-900">{Number(booking.depositAmount).toLocaleString("vi-VN")}đ · {DEPOSIT_LABEL[booking.depositStatus] || booking.depositStatus}</dd></div>
              <div><dt className="text-slate-500">Tổng tiền món đã chọn</dt><dd className="mt-1 font-semibold text-slate-900">{itemTotal.toLocaleString("vi-VN")}đ</dd></div>
            </dl>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Món ăn đã chọn</h3>
              {bookingItems.length === 0 ? <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Khách hàng chưa chọn món trước.</p> : <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">{bookingItems.map((item) => <li key={item.bookingItemId} className="flex justify-between gap-4 px-4 py-3 text-sm"><span className="font-medium text-slate-800">{item.name} × {item.quantity}</span><span className="shrink-0 text-slate-600">{(Number(item.price) * item.quantity).toLocaleString("vi-VN")}đ</span></li>)}</ul>}
            </div>
            {booking.note && <div><h3 className="text-sm font-bold text-slate-900">Ghi chú</h3><p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{booking.note}</p></div>}
          </div>}
        </div>
        <footer className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Đóng</button></footer>
      </section>
    </div>
  );
}
