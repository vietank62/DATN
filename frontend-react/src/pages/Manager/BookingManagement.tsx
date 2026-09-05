import { BOOKING_STATUS_LABEL as STATUS_LABEL } from "../../utils/status";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useState } from 'react';
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

const canCompleteBooking = (booking: BookingDetail) => {
  const scheduledTime = new Date(`${booking.date}T${booking.time}`);

  return !Number.isNaN(scheduledTime.getTime()) && scheduledTime <= new Date();
};

export default function BookingManagement() {
  const qc = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [reportBookingId, setReportBookingId] = useState<number | null>(null);

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
  const cancelMut = useMutation({
    mutationFn: (id: number) => api.put(`/v1/bookings/${id}/cancel`),
    onSuccess: () => { toast.success('Đã huỷ đặt bàn'); invalidate(); },
    onError: () => toast.error('Lỗi huỷ'),
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
  const filtered = statusFilter === 'active'
    ? allBookings.filter(b => b.status === 'pending' || b.status === 'confirmed')
    : statusFilter === 'all' ? allBookings
    : allBookings.filter(b => b.status === statusFilter);

  const isBusy = confirmMut.isPending || cancelMut.isPending || completeMut.isPending;

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
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors border-b-2
                ${statusFilter === f.key
                  ? 'border-amber-500 text-amber-700 bg-amber-50/60'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                  ${statusFilter === f.key ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
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
                      <p className="font-semibold text-gray-800">{b.contactName}</p>
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
                      <div className="flex items-center justify-end gap-2">
                        {b.status === 'pending' && (
                          <>
                            <button onClick={() => { setConfirmingId(b.bookingId); confirmMut.mutate(b.bookingId); }} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition disabled:opacity-40">
                              {confirmMut.isPending && confirmingId === b.bookingId ? '...' : '✓ Xác nhận'}
                            </button>
                            <button onClick={() => cancelMut.mutate(b.bookingId)} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition disabled:opacity-40">
                              ✕ Huỷ
                            </button>
                            <button onClick={() => setReportBookingId(b.bookingId)} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-medium transition hover:bg-red-50 disabled:opacity-40">
                              Báo cáo khách
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
                            <button onClick={() => cancelMut.mutate(b.bookingId)} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition disabled:opacity-40">
                              ✕ Huỷ
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
      {reportBookingId && <ViolationReportModal bookingId={reportBookingId} target="customer" onClose={() => setReportBookingId(null)} onSuccess={invalidate} />}
    </div>
  );
}
