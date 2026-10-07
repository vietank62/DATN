import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../services/api";
import type { BookingDetail } from "../types/booking";
import { BOOKING_STATUS_LABEL } from "../utils/status";

const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;
const depositLabels: Record<string, string> = { paid: "Đã thanh toán", pending: "Chờ thanh toán", not_required: "Không yêu cầu", refunded: "Đã hoàn cọc", refund_pending: "Chờ hoàn cọc", forfeited: "Không hoàn cọc", expired: "Hết hạn" };

export default function CashierBookingDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useQuery<BookingDetail & { tables: { name: string }[] }>({ queryKey: ["cashier-booking-detail", id], queryFn: () => api.get(`/v1/cashier/bookings/${id}`).then(response => response.data) });
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = before; document.removeEventListener("keydown", escape); };
  }, [onClose]);
  const booking = detail.data;
  const field = (label: string, value: string) => <div><p className="text-gray-400">{label}</p><p className="mt-1 break-words text-gray-800">{value || "—"}</p></div>;
  return createPortal(<div role="dialog" aria-modal="true" aria-labelledby="online-booking-detail" onClick={onClose} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
    <section onClick={event => event.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-[11px] shadow-xl">
      <header className="flex items-center justify-between border-b border-gray-100 p-5"><div><h2 id="online-booking-detail" className="text-xs font-normal text-gray-900">Chi tiết đặt bàn #{id}</h2>{booking && <p className="mt-1 text-red-600">{BOOKING_STATUS_LABEL[booking.status] ?? "Đang cập nhật"}</p>}</div><button type="button" aria-label="Đóng chi tiết" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={18} /></button></header>
      <div className="space-y-5 overflow-y-auto p-5">
        {detail.isLoading ? <p className="text-gray-500">Đang tải chi tiết...</p> : detail.isError ? <button onClick={() => void detail.refetch()} className="text-red-600">Không tải được chi tiết. Thử lại</button> : booking && <>
          <div className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">{field("Khách hàng", booking.contactName)}{field("Số điện thoại", booking.contactPhone)}{field("Email", booking.contactEmail)}{field("Ngày và giờ dùng bữa", `${booking.date.split("-").reverse().join("/")} · ${booking.time.slice(0, 5)}`)}{field("Nhóm khách", `${booking.guestCount} người lớn · ${booking.childCount} trẻ em · ${booking.requestSeats} chỗ`)}{field("Bàn phục vụ", booking.tables.map(table => table.name).join(", ") || "Chưa xếp bàn")}</div>
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-4"><span>Tiền đặt cọc <span className="ml-2 text-orange-600">{money(booking.depositAmount)}</span></span><span className="text-gray-500">{depositLabels[booking.depositStatus] ?? "Đang cập nhật"}</span></section>
          {booking.cancellationReason && <p className="rounded-xl bg-red-50 p-3 leading-5 text-red-700">Lý do hủy: {booking.cancellationReason}</p>}
          <section><h3 className="mb-2 font-normal text-gray-800">Món đặt trước</h3>{booking.booking_items.length ? <div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full"><thead className="bg-gray-50 text-left text-gray-500"><tr><th className="p-3 font-normal">Món ăn</th><th className="p-3 text-center font-normal">SL</th><th className="p-3 text-right font-normal">Thành tiền</th></tr></thead><tbody>{booking.booking_items.map(item => <tr key={item.bookingItemId} className="border-t border-gray-100"><td className="p-3">{item.name}</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-right">{money(item.price * item.quantity)}</td></tr>)}</tbody></table><p className="border-t border-gray-100 p-3 text-right text-orange-600">Tổng tiền món: {money(booking.booking_items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</p></div> : <p className="text-gray-400">Khách chưa đặt món trước.</p>}</section>
          {booking.note && <section><h3 className="mb-2 font-normal">Ghi chú của khách</h3><p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 leading-5 text-gray-600">{booking.note}</p></section>}
        </>}
      </div>
      <footer className="flex justify-end border-t border-gray-100 p-4"><button onClick={onClose} className="rounded-xl bg-red-600 px-4 py-2 text-white">Đóng</button></footer>
    </section>
  </div>, document.body);
}
