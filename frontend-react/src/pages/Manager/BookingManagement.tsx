import { BookingActions } from "../../components/BookingActions";
import { useSearchParams } from "react-router-dom";
import { BOOKING_STATUS_LABEL as STATUS_LABEL } from "../../utils/status";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import axios from 'axios';
import type { BookingDetail } from '../../types/booking';
import { ViolationReportModal } from '../../components/ViolationReportModal';

const STATUS_BADGE: Record<string, string> = {
  payment_expired: "bg-red-100 text-red-700",
  awaiting_payment: "bg-violet-100 text-violet-700",
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  expired: 'bg-red-100 text-red-700',
};

function BookingDetailModal({ booking, onClose }: { booking: BookingDetail; onClose: () => void }) {
  const itemTotal = booking.booking_items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const money = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

  return <div role="dialog" aria-modal="true" aria-label={`Chi tiết đơn #${booking.bookingId}`} onClick={onClose} className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <section onClick={(event) => event.stopPropagation()} className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-5">
        <div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Chi tiết đơn đặt bàn</p><h2 className="mt-1 text-xl font-bold text-gray-900">Đơn #{booking.bookingId} · {booking.contactName}</h2></div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết đơn" className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">✕</button>
      </header>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4"><div><p className="font-bold text-gray-900">{booking.date} · {booking.time}</p><p className="mt-1 text-sm text-gray-600">{booking.guestCount} khách · {booking.childCount} trẻ em · {booking.requestSeats} chỗ đã yêu cầu</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[booking.status] ?? booking.status}</span></div>
        <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-bold text-gray-900">Thông tin liên hệ</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Khách đặt bàn</dt><dd className="text-right font-semibold text-gray-900">{booking.contactName}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Điện thoại</dt><dd className="text-right font-semibold text-gray-900">{booking.contactPhone}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Email</dt><dd className="break-all text-right font-semibold text-gray-900">{booking.contactEmail}</dd></div></dl></section><section className="rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-bold text-gray-900">Đặt cọc</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Số tiền</dt><dd className="font-semibold text-gray-900">{money(booking.depositAmount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Trạng thái</dt><dd className="font-semibold text-gray-900">{booking.depositStatus === "paid" ? "Đã thanh toán" : booking.depositStatus === "refund_pending" ? "Đang hoàn cọc" : booking.depositStatus === "refunded" ? "Đã hoàn cọc" : booking.depositStatus === "not_required" ? "Không yêu cầu" : booking.depositStatus}</dd></div></dl></section></div>
        <section className="rounded-xl border border-gray-100 p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-gray-900">Món đã chọn</h3><span className="text-sm font-bold text-gray-700">{money(itemTotal)}</span></div>{booking.booking_items.length === 0 ? <p className="mt-3 text-sm text-gray-500">Khách chưa chọn món kèm theo.</p> : <div className="mt-3 divide-y divide-gray-100">{booking.booking_items.map((item) => <div key={item.bookingItemId} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-semibold text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.category}</p></div><p className="shrink-0 font-semibold text-gray-700">×{item.quantity}</p></div>)}</div>}</section>
        {booking.note && <section className="rounded-xl border border-gray-100 bg-slate-50 p-4"><h3 className="text-sm font-bold text-gray-900">Ghi chú từ khách</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{booking.note}</p></section>}
      </div>
      <footer className="flex justify-end border-t border-gray-100 bg-white p-5"><button type="button" onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800">Đóng</button></footer>
    </section>
  </div>;
}
const canReportCustomer = (booking: BookingDetail, now: number) => {
  const mealTime = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`).getTime();
  return ["confirmed", "completed"].includes(booking.status)
    && Number.isFinite(mealTime)
    && now >= mealTime
    && now <= mealTime + 7 * 24 * 60 * 60 * 1000;
};

const canCompleteBooking = (booking: BookingDetail) => {
  const scheduledTime = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`);

  return !Number.isNaN(scheduledTime.getTime()) && scheduledTime <= new Date();
};

export default function BookingManagement() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBookingId = Number(searchParams.get("booking")) || null;
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [reportBookingId, setReportBookingId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const bookingsQ = useQuery<BookingDetail[]>({
    queryKey: ['manager-bookings'],
    queryFn: () => api.get('/v1/bookings/manager/me').then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manager-bookings'] });
  };

  const confirmMut = useMutation({
    mutationFn: (id: number) => api.put(`/v1/bookings/${id}/confirm`),
    onSuccess: () => { toast.success('Đã xác nhận đặt bàn'); invalidate(); },
    onError: () => toast.error('Lỗi xác nhận'),
  });
  const completeMut = useMutation({
    mutationFn: (id: number) => api.put(`/v1/bookings/${id}/complete`),
    onSuccess: () => { toast.success('Đánh dấu hoàn thành'); invalidate(); },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : null;
      toast.error(message || 'Không thể hoàn thành đơn trước giờ dùng bữa.');
    },
  });

  const allBookings = bookingsQ.data ?? [];
  const effectiveFilter = searchParams.get('status') === 'all' ? 'all' : statusFilter;
  const filtered = effectiveFilter === 'active'
    ? allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed')
    : effectiveFilter === 'all' ? allBookings
    : allBookings.filter(b => b.status === effectiveFilter);

  const isBusy = confirmMut.isPending || completeMut.isPending;

  const FILTERS = [
    { key: 'active', label: 'Cần xử lý', count: allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length },
    { key: 'completed', label: 'Hoàn thành', count: allBookings.filter(b => b.status === 'completed').length },
    { key: 'cancelled', label: 'Đã huỷ', count: allBookings.filter(b => b.status === 'cancelled').length },
    { key: 'all', label: 'Tất cả', count: allBookings.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý đặt bàn</h1>
        <p className="text-sm text-gray-400 mt-0.5">Xem và xử lý các đơn đặt bàn của nhà hàng</p>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="flex border-b border-gray-100 px-2 pt-2 gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setSearchParams({}); setStatusFilter(f.key); }}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors border-b-2
                ${effectiveFilter === f.key
                  ? 'border-amber-500 text-amber-700 bg-amber-50/60'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                  ${effectiveFilter === f.key ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center pr-4 pb-2">
            <button onClick={invalidate} className="text-xs text-gray-400 hover:text-gray-600 transition">↻ Làm mới</button>
          </div>
        </div>

        {bookingsQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 font-medium">Không có đơn nào trong mục này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left">Khách hàng</th>
                  <th className="px-5 py-3 text-left">Thời gian</th>
                  <th className="px-5 py-3 text-center">Ghế</th>
                  <th className="px-5 py-3 text-center">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => (
                  <tr key={b.bookingId} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">Đơn #{b.bookingId} · {b.contactName}</p>
                      <p className="text-xs text-gray-400">{b.contactPhone}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-700">{b.date}</p>
                      <p className="text-xs text-gray-400">{b.time}</p>
                    </td>
                    <td className="px-5 py-3.5 text-center font-medium text-gray-700">{b.requestSeats}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button type="button" onClick={() => setSearchParams({ booking: String(b.bookingId) })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-amber-300 hover:bg-amber-50">Xem chi tiết</button><BookingActions booking={b} manager />
                        {canReportCustomer(b, now) && <button onClick={() => setReportBookingId(b.bookingId)} className="rounded border px-3 py-2 text-red-600">Báo cáo khách</button>}
                        {b.status === 'pending' && (
                          <>
                            <button onClick={() => { setConfirmingId(b.bookingId); confirmMut.mutate(b.bookingId); }} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition disabled:opacity-40">
                              {confirmMut.isPending && confirmingId === b.bookingId ? '...' : '✓ Xác nhận'}
                            </button>
                          </>
                        )}
                        {b.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => completeMut.mutate(b.bookingId)}
                              disabled={isBusy || !canCompleteBooking(b)}
                              title={
                                canCompleteBooking(b)
                                  ? 'Đánh dấu đơn hoàn thành'
                                  : 'Chỉ có thể hoàn thành sau giờ dùng bữa'
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ✓ Hoàn thành
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedBookingId && allBookings.find((booking) => booking.bookingId === selectedBookingId) && <BookingDetailModal booking={allBookings.find((booking) => booking.bookingId === selectedBookingId)!} onClose={() => { const params = new URLSearchParams(searchParams); params.delete("booking"); setSearchParams(params); }} />}
      {reportBookingId && <ViolationReportModal bookingId={reportBookingId} target="customer" onClose={() => setReportBookingId(null)} onSuccess={invalidate} />}
    </div>
  );
}
