import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { BookingDetail } from '../../types/booking';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function BookingPage() {
  const { bookingId } = useParams<{ bookingId?: string }>();
  const navigate = useNavigate();

  const bookingDetailQ = useQuery<BookingDetail>({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => api.get(`/v1/bookings/${bookingId}`).then((response) => response.data),
    enabled: !!bookingId,
  });

  const myBookingsQ = useQuery<BookingDetail[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/v1/bookings/me').then((response) => response.data),
    enabled: !bookingId,
  });

  const booking = bookingDetailQ.data;
  const bookings = myBookingsQ.data ?? [];

  if (bookingId && bookingDetailQ.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Đang tải chi tiết đơn đặt bàn...</p>
        </div>
      </div>
    );
  }

  if (bookingId && bookingDetailQ.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white border border-gray-100 rounded-3xl shadow-sm p-8">
          <p className="text-4xl mb-3">📋</p>
          <h1 className="text-xl font-bold text-gray-900">Không tìm thấy đơn đặt bàn</h1>
          <p className="text-sm text-gray-500 mt-2">Đơn này không tồn tại hoặc bạn không có quyền xem.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Đơn đặt bàn của tôi</h1>
            <p className="text-sm text-gray-500 mt-1">Theo dõi các đơn đang chờ, đã xác nhận và đã hoàn thành.</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
            {myBookingsQ.isLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Đang tải đơn đặt bàn...</div>
            ) : bookings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">🍽️</p>
                <p className="text-gray-500 font-medium">Bạn chưa có đơn đặt bàn nào.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bookings.map((item) => (
                  <button
                    key={item.bookingId}
                    onClick={() => navigate(`/account/bookings/${item.bookingId}`)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-gray-900">{item.restaurantName ?? `Nhà hàng #${item.restaurantId}`}</h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">#{item.bookingId} · {item.date} · {item.time} · {item.guestCount} khách</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600">Xem chi tiết</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const itemTotal = booking.booking_items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500 font-medium">Chi tiết đơn đặt bàn</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">#{booking.bookingId}</h1>
          </div>
          <span className={`inline-flex w-fit px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_BADGE[booking.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{booking.restaurantName ?? `Nhà hàng #${booking.restaurantId}`}</h2>
                <p className="text-sm text-gray-500 mt-1">Đặt lúc {booking.date} · {booking.time}</p>
              </div>
              <button
                onClick={() => navigate(`/restaurant/${booking.restaurantId}`)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Xem nhà hàng
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard label="Khách" value={`${booking.guestCount} người`} />
              <InfoCard label="Số bàn yêu cầu" value={`${booking.requestSeats} bàn`} />
              <InfoCard label="Bàn đã xếp" value={`${booking.assignedSeats} chỗ`} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Món đi kèm</h3>
              {booking.booking_items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                  Đơn này chưa chọn món đi kèm.
                </div>
              ) : (
                <div className="space-y-3">
                  {booking.booking_items.map((item) => (
                    <div key={item.bookingItemId} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{item.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">x{item.quantity}</p>
                        <p className="text-xs text-gray-500">{Number(item.price).toLocaleString('vi-VN')} đ</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {booking.note && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Ghi chú</h3>
                <div className="rounded-2xl bg-slate-50 border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-line">
                  {booking.note}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Thông tin liên hệ</h3>
              <DetailRow label="Họ tên" value={booking.contactName} />
              <DetailRow label="Email" value={booking.contactEmail} />
              <DetailRow label="SĐT" value={booking.contactPhone} />
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Trạng thái xử lý</h3>
              <DetailRow label="Ngày tạo" value={booking.createdAt ?? 'Chưa có'} />
              <DetailRow label="Đơn hàng" value={`#${booking.bookingId}`} />
              <DetailRow label="Trạng thái" value={STATUS_LABEL[booking.status] ?? booking.status} />
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Tạm tính</h3>
              <DetailRow label="Món đi kèm" value={`${itemTotal.toLocaleString('vi-VN')} đ`} />
              <DetailRow label="Tổng số món" value={`${booking.booking_items.length}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}