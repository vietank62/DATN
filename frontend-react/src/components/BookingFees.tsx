import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../services/api";
import { uploadImage } from "../services/upload";
import type { BookingDetail } from "../types/booking";

type Fee = {
  id: number;
  booking_id: number;
  restaurant_id: number;
  restaurantName: string;
  amount: number;
  settled_amount: number;
  deducted_amount: number;
  due_at: string;
  proof_url?: string;
};

type FeeSummary = {
  month: string;
  completedBookingsThisMonth: number;
  pendingBookings: number;
  depositBookingCount: number;
  heldDepositAmount: number;
  feesTotal: number;
  feesOutstanding: number;
  feesDeducted: number;
  feesDirectPaid: number;
};
const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const dueDate = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: "violet" | "amber" | "emerald" | "blue" }) {
  const tones = {
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
  };
  return <div className={`rounded-2xl p-4 ring-1 ${tones[tone]}`}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
    <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
  </div>;
}

export default function BookingFees({ admin = false }: { admin?: boolean }) {
  const queryClient = useQueryClient();
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const fees = useQuery<Fee[]>({
    queryKey: ["booking-fees"],
    queryFn: () => api.get("/v1/booking-fees").then((response) => response.data),
  });
  const summary = useQuery<FeeSummary>({
    queryKey: ["booking-fees-summary"],
    queryFn: () => api.get("/v1/booking-fees/summary").then((response) => response.data),
  });  const bookingDetail = useQuery<BookingDetail>({
    queryKey: ["booking-fee-detail", selectedFee?.booking_id],
    queryFn: ({ signal }) => api.get(`/v1/bookings/${selectedFee?.booking_id}`, { signal }).then((response) => response.data),
    enabled: !!selectedFee?.booking_id,
  });
  const paid = useMutation({
    mutationFn: ({ id, proof }: { id: number; proof: string }) => api.put(`/v1/booking-fees/${id}/paid`, { proof_url: proof }),
    onSuccess: () => {
      toast.success("Đã ghi nhận thanh toán phí dịch vụ.");
      void queryClient.invalidateQueries({ queryKey: ["booking-fees"] });
    },
    onError: () => toast.error("Không thể ghi nhận thanh toán. Vui lòng thử lại."),
  });

  const items = fees.data ?? [];
  const total = items.reduce((sum, fee) => sum + fee.amount, 0);
  const outstanding = items.reduce((sum, fee) => sum + Math.max(0, fee.amount - fee.settled_amount), 0);
  const deducted = items.reduce((sum, fee) => sum + fee.deducted_amount, 0);
  const directPaid = items.reduce((sum, fee) => sum + Math.max(0, fee.settled_amount - fee.deducted_amount), 0);
  const overview = summary.data;

  const uploadProof = async (fee: Fee, file?: File) => {
    if (!file) return;
    setUploadingId(fee.id);
    try {
      const proof = await uploadImage(file);
      paid.mutate({ id: fee.id, proof });
    } catch {
      toast.error("Không tải được ảnh minh chứng.");
    } finally {
      setUploadingId(null);
    }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-violet-600">TÀI CHÍNH NỀN TẢNG</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Phí dịch vụ đặt bàn</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Phí được tính theo từng đơn hoàn thành. Đến hạn đầu tháng kế tiếp, hệ thống khấu trừ từ số dư cọc khả dụng; phần chưa thanh toán tiếp tục được theo dõi.</p>
        </div>
        <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">{items.length} khoản phí</span>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4"><h2 className="text-sm font-bold text-gray-800">Tình hình đặt bàn {overview ? `tháng ${overview.month}` : ""}</h2><span className="text-xs text-gray-500">Cập nhật theo dữ liệu hiện tại</span></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatCard label="Đơn hoàn thành trong tháng" value={overview?.completedBookingsThisMonth ?? "—"} tone="emerald" />
          <StatCard label="Đơn chờ xác nhận" value={overview?.pendingBookings ?? "—"} tone="amber" />
          <StatCard label="Đơn đang giữ cọc" value={overview ? `${overview.depositBookingCount} đơn · ${money(overview.heldDepositAmount)}` : "—"} tone="blue" />
        </div>
      </div>
      <div className="mt-6 border-t border-gray-100 pt-6">
        <h2 className="text-sm font-bold text-gray-800">Chi tiết dòng tiền phí dịch vụ</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tổng phí phát sinh" value={money(overview?.feesTotal ?? total)} tone="violet" />
          <StatCard label="Còn cần thu" value={money(overview?.feesOutstanding ?? outstanding)} tone="amber" />
          <StatCard label="Đã khấu trừ cọc" value={money(overview?.feesDeducted ?? deducted)} tone="blue" />
          <StatCard label="Đã thu trực tiếp" value={money(overview?.feesDirectPaid ?? directPaid)} tone="emerald" />
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">Tổng phí phát sinh = đã khấu trừ cọc + đã thu trực tiếp + còn cần thu. Khoản cọc đang giữ là tổng cọc hợp lệ của các đơn đã xác nhận, hoàn thành hoặc bị giữ do vi phạm.</p>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Danh sách khoản phí</h2>
        <p className="text-sm text-gray-500">Theo dõi hạn thanh toán và số tiền đã được khấu trừ của từng đơn.</p>
      </div>

      {fees.isLoading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải dữ liệu phí dịch vụ…</div>
        : fees.isError ? <div className="p-10 text-center text-sm text-red-600">Không thể tải dữ liệu phí dịch vụ. Vui lòng tải lại trang.</div>
          : !items.length ? <div className="p-10 text-center text-sm text-gray-500">Chưa phát sinh khoản phí dịch vụ nào.</div>
            : <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Đơn / Nhà hàng</th>
                    <th className="px-6 py-3 font-semibold">Hạn thanh toán</th>
                    <th className="px-6 py-3 text-right font-semibold">Phí</th>
                    <th className="px-6 py-3 text-right font-semibold">Đã khấu trừ</th>
                    <th className="px-6 py-3 text-right font-semibold">Còn cần thu</th>
                    <th className="px-6 py-3 text-right font-semibold">Chi tiết</th>
                    {admin && <th className="px-6 py-3 text-right font-semibold">Xác nhận</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((fee) => {
                    const remaining = Math.max(0, fee.amount - fee.settled_amount);
                    const isSettled = remaining === 0;
                    const isUploading = uploadingId === fee.id;
                    return <tr key={fee.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">Đơn #{fee.booking_id}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{fee.restaurantName}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{dueDate(fee.due_at)}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-800">{money(fee.amount)}</td>
                      <td className="px-6 py-4 text-right text-blue-700">{money(fee.deducted_amount)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={isSettled ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{isSettled ? "Đã đủ" : money(remaining)}</span>
                      </td>
                      <td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelectedFee(fee)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Xem chi tiết</button></td>
                      {admin && <td className="px-6 py-4 text-right">
                        {isSettled ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Đã xác nhận</span>
                          : <label className="inline-flex cursor-pointer items-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100">
                            <input className="sr-only" type="file" accept="image/*" disabled={isUploading || paid.isPending} onChange={(event) => void uploadProof(fee, event.target.files?.[0])} />
                            {isUploading ? "Đang tải ảnh…" : "Tải minh chứng"}
                          </label>}
                      </td>}
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>}
    </section>

    {selectedFee && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="fee-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">CHI TIẾT KHOẢN PHÍ</p><h2 id="fee-detail-title" className="mt-1 text-xl font-bold text-gray-900">Đơn #{selectedFee.booking_id}</h2><p className="mt-1 text-sm text-gray-500">{selectedFee.restaurantName}</p></div><button type="button" onClick={() => setSelectedFee(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Đóng">✕</button></div><div className="mt-5 grid gap-3 rounded-xl bg-violet-50 p-4 text-sm sm:grid-cols-3"><div><p className="text-violet-600">Phí dịch vụ</p><p className="mt-1 font-bold text-violet-950">{money(selectedFee.amount)}</p></div><div><p className="text-violet-600">Đã khấu trừ cọc</p><p className="mt-1 font-bold text-violet-950">{money(selectedFee.deducted_amount)}</p></div><div><p className="text-violet-600">Còn cần thu</p><p className="mt-1 font-bold text-violet-950">{money(Math.max(0, selectedFee.amount - selectedFee.settled_amount))}</p></div></div>{bookingDetail.isLoading ? <p className="py-8 text-center text-sm text-gray-500">Đang tải chi tiết đơn đặt bàn…</p> : bookingDetail.isError ? <div className="py-8 text-center"><button type="button" onClick={() => void bookingDetail.refetch()} className="text-sm font-semibold text-violet-700 underline">Không tải được chi tiết đơn. Thử lại</button></div> : bookingDetail.data && <div className="mt-5 space-y-5"><section className="grid gap-4 rounded-xl border border-gray-100 p-4 text-sm sm:grid-cols-2"><div><p className="text-gray-500">Thời gian dùng bữa</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.date} · {bookingDetail.data.time.slice(0, 5)}</p></div><div><p className="text-gray-500">Số khách / chỗ ngồi</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.guestCount} người / {bookingDetail.data.requestSeats} chỗ</p></div><div><p className="text-gray-500">Khách đặt bàn</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.contactName}</p><p className="text-xs text-gray-600">{bookingDetail.data.contactPhone} · {bookingDetail.data.contactEmail}</p></div><div><p className="text-gray-500">Tiền đặt cọc</p><p className="mt-1 font-semibold text-gray-900">{money(bookingDetail.data.depositAmount)}</p></div>{bookingDetail.data.note && <div className="sm:col-span-2"><p className="text-gray-500">Ghi chú</p><p className="mt-1 text-gray-800">{bookingDetail.data.note}</p></div>}</section>{bookingDetail.data.booking_items.length > 0 && <section className="rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-bold text-gray-900">Món đã chọn</h3><ul className="mt-3 space-y-2 text-sm text-gray-700">{bookingDetail.data.booking_items.map((item) => <li key={item.bookingItemId} className="flex justify-between gap-4"><span>{item.name} × {item.quantity}</span><span className="font-medium">{money(item.price * item.quantity)}</span></li>)}</ul></section>}</div>}<div className="mt-6 flex justify-end"><button type="button" onClick={() => setSelectedFee(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700">Đóng</button></div></section></div>}
  </div>;
}