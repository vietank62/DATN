import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import { CalendarDays, Clock, Users, Phone, Eye } from "lucide-react";
import CashierBookingDetail from "../../components/CashierBookingDetail";

type Table = { id: number; name: string; seats: number; is_active: boolean };
type Booking = { bookingId: number; contactName: string; contactPhone: string; date: string; time: string; requestSeats: number; status: string; attendance?: string; note?: string; tables: Table[] };
const statuses: Record<string, string> = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", completed: "Hoàn thành", cancelled: "Đã hủy", awaiting_payment: "Chờ thanh toán cọc", expired: "Hết hạn" };

export default function CashierBookings() {
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [tableId, setTableId] = useState("");
  const [arriving, setArriving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const isDue = (booking: Booking) => new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`).getTime() <= now;
  const client = useQueryClient();
  const bookings = useQuery<{ items: Booking[]; total: number }>({ queryKey: ["cashier-bookings", page], queryFn: () => api.get(`/v1/cashier/bookings?limit=10&offset=${page * 10}`).then(r => r.data), refetchInterval: 15000 });
  const tables = useQuery<Table[]>({ queryKey: ["restaurant-tables"], queryFn: () => api.get("/v1/restaurant-tables/me").then(r => r.data) });
  const save = useMutation({
    mutationFn: (allowInsufficient: boolean = false) => api.put(`/v1/cashier/bookings/${selected!.bookingId}/${arriving ? "arrive" : selected!.status === "pending" ? "confirm" : "table"}`, { table_id: tableId ? Number(tableId) : null, allow_insufficient: allowInsufficient }),
    onSuccess: async response => { toast.success(arriving ? "Đã tiếp nhận khách tại bàn." : selected?.status === "pending" ? "Đã xác nhận và sắp xếp bàn." : "Đã cập nhật bàn."); await Promise.all([client.invalidateQueries({ queryKey: ["cashier-bookings"] }), client.invalidateQueries({ queryKey: ["cashier-workspace"], refetchType: "all" }), client.invalidateQueries({ queryKey: ["table-reservations"], refetchType: "all" })]); setSelected(null); if (arriving) navigate(`/manager/cashier/table/${response.data.table_id}`); },
    onError: error => {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      if (detail?.code === "INSUFFICIENT_TABLE_SEATS") {
        const table = detail.table_name ? `Bàn ${detail.table_name} · ${detail.seats} ghế / ${detail.required_seats} khách.\n` : "";
        if (window.confirm(table + detail.message)) save.mutate(true);
        return;
      }
      toast.error(typeof detail === "string" ? detail : "Không thể cập nhật đơn đặt bàn.");
      void client.invalidateQueries({ queryKey: ["table-reservations"] });
    },
  });
  return <div className="cashier-bookings space-y-4 text-[11px] font-normal">
    {detailId !== null && <CashierBookingDetail id={detailId} onClose={() => setDetailId(null)} />}
    <header className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><CalendarDays size={20} /></span><div><h1 className="text-sm font-normal text-gray-900">Đặt bàn online</h1><p className="mt-1 text-[11px] text-gray-400">{bookings.data?.total ?? 0} đơn · Mới nhất trước</p></div></header>
    {bookings.isLoading ? <p className="text-[11px] text-gray-500">Đang tải đơn...</p> : bookings.isError ? <button onClick={() => void bookings.refetch()} className="text-[11px] text-red-600">Không tải được đơn. Thử lại</button> : !bookings.data?.items.length ? <p className="text-[11px] text-gray-500">Chưa có đơn đặt bàn online.</p> : <div className="space-y-3">{bookings.data.items.map(booking => <article key={booking.bookingId} className="rounded-2xl border border-gray-200 bg-white p-4 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-normal">#{booking.bookingId} · {booking.contactName}</h2><span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">{statuses[booking.status] ?? booking.status}</span></div>
      <div className="my-3 grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-4"><span className="flex items-center gap-2 text-gray-600"><CalendarDays size={14} className="text-gray-400" />{booking.date.split("-").reverse().join("/")}</span><span className="flex items-center gap-2 text-gray-600"><Clock size={14} className="text-gray-400" />{booking.time.slice(0, 5)}</span><span className="flex items-center gap-2 text-gray-600"><Users size={14} className="text-gray-400" />{booking.requestSeats} khách</span><span className="flex items-center gap-2 text-gray-600"><Phone size={14} className="text-gray-400" />{booking.contactPhone}</span></div>
      <p className="mt-1 text-[11px] text-gray-500">Bàn: <span className="text-gray-800">{booking.tables.map(table => table.name).join(", ") || "Chưa xếp bàn"}</span></p>
      {booking.note && <p className="mt-1 text-[11px] text-gray-500">{booking.note}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3"><button onClick={() => setDetailId(booking.bookingId)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[11px] text-gray-600 hover:bg-gray-50"><Eye size={14} />Xem chi tiết</button>{(booking.status === "pending" || booking.status === "confirmed" && !isDue(booking)) && <button onClick={() => { setArriving(false); setSelected(booking); setTableId(""); }} className="rounded-xl bg-red-600 px-3 py-2 text-[11px] text-white hover:bg-red-700">{booking.status === "pending" ? "Xác nhận và chọn bàn" : "Chọn / đổi bàn"}</button>}{booking.status === "confirmed" && isDue(booking) && <button onClick={() => { setArriving(true); setSelected(booking); setTableId(""); }} className="rounded-xl bg-red-600 px-3 py-2 text-[11px] text-white hover:bg-red-700">{booking.attendance === "arrived" ? "Xem bàn của khách" : "Khách đã tới"}</button>}</div>
    </article>)}</div>}
    <div className="flex items-center justify-end gap-3 text-[11px]"><button disabled={page === 0} onClick={() => setPage(value => value - 1)} className="disabled:opacity-40">Trước</button><span>Trang {page + 1}</span><button disabled={(page + 1) * 10 >= (bookings.data?.total ?? 0)} onClick={() => setPage(value => value + 1)} className="disabled:opacity-40">Sau</button></div>
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="cashier-booking-title" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><form onSubmit={event => { event.preventDefault(); save.mutate(false); }} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
      <h2 id="cashier-booking-title" className="text-xs font-normal">{arriving ? "Tiếp nhận khách" : selected.status === "pending" ? "Xác nhận đặt bàn" : "Sắp xếp bàn"} #{selected.bookingId}</h2>
      {arriving && <div className="rounded-xl bg-red-50 p-3 text-gray-700"><p>{selected.contactName} · {selected.requestSeats} khách</p><p className="mt-2">Bàn hiện tại: {selected.tables.map(table => table.name).join(", ") || "Chưa xếp bàn"}</p></div>}
      <label className="block text-[11px]">{arriving ? "Giữ bàn hiện tại hoặc chọn bàn khác" : "Bàn phục vụ"}<select value={tableId} onChange={event => setTableId(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-[11px]"><option value="">{arriving && selected.tables.length ? `Giữ bàn ${selected.tables.map(table => table.name).join(", ")}` : "Tự động chọn bàn phù hợp"}</option>{tables.data?.filter(table => table.is_active).sort((a, b) => a.name.localeCompare(b.name, "vi")).map(table => <option key={table.id} value={table.id}>{table.name} · {table.seats} chỗ</option>)}</select></label>
      <p className="text-[11px] leading-5 text-gray-500">{arriving ? "Xác nhận để mở bàn tại khu vực thu ngân. Món đã đặt được giữ nguyên, chưa gửi bếp." : "Bàn được giữ và tự mở khi tới giờ dùng bữa. Nếu đang có bill, hệ thống báo xung đột và không ghi đè bill."}</p>
      <div className="flex justify-end gap-2"><button type="button" disabled={save.isPending} onClick={() => setSelected(null)} className="rounded-xl border px-3 py-2 text-[11px]">Hủy</button><button disabled={save.isPending || tables.isLoading || tables.isError} className="rounded-xl bg-red-600 px-3 py-2 text-[11px] text-white disabled:opacity-50">{save.isPending ? "Đang lưu..." : "Xác nhận"}</button></div>
    </form></div>}
  </div>;
}
