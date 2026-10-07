import { type Discount, discountValue } from "../../utils/discount";
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
  pending:   'bg-red-100 text-red-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  expired: 'bg-red-100 text-red-700',
};

function BookingDetailModal({ booking, onClose }: { booking: BookingDetail; onClose: () => void }) {
  const itemTotal = booking.booking_items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const money = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

  return <div role="dialog" aria-modal="true" aria-label={`Chi tiết đơn #${booking.bookingId}`} onClick={onClose} className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
    <section onClick={(event) => event.stopPropagation()} className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-5">
        <div><p className="text-xs font-normal uppercase tracking-wide text-red-700">Chi tiết đơn đặt bàn</p><h2 className="mt-1 text-xl font-normal text-gray-900">Đơn #{booking.bookingId} · {booking.contactName}</h2></div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết đơn" className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">✕</button>
      </header>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4"><div><p className="font-normal text-gray-900">{booking.date} · {booking.time}</p><p className="mt-1 text-sm text-gray-600">{booking.guestCount} khách · {booking.childCount} trẻ em · {booking.requestSeats} chỗ đã yêu cầu</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-normal ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[booking.status] ?? booking.status}</span></div>
        <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-normal text-gray-900">Thông tin liên hệ</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Khách đặt bàn</dt><dd className="text-right font-normal text-gray-900">{booking.contactName}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Điện thoại</dt><dd className="text-right font-normal text-gray-900">{booking.contactPhone}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Email</dt><dd className="break-all text-right font-normal text-gray-900">{booking.contactEmail}</dd></div></dl></section><section className="rounded-xl border border-gray-100 p-4"><h3 className="text-sm font-normal text-gray-900">Đặt cọc</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Số tiền</dt><dd className="font-normal text-gray-900">{money(booking.depositAmount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Trạng thái</dt><dd className="font-normal text-gray-900">{booking.depositStatus === "paid" ? "Đã thanh toán" : booking.depositStatus === "refund_pending" ? "Đang hoàn cọc" : booking.depositStatus === "refunded" ? "Đã hoàn cọc" : booking.depositStatus === "not_required" ? "Không yêu cầu" : booking.depositStatus}</dd></div></dl></section></div>
        <section className="rounded-xl border border-gray-100 p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-normal text-gray-900">Món đã chọn</h3><span className="text-sm font-normal text-gray-700">{money(itemTotal)}</span></div>{booking.booking_items.length === 0 ? <p className="mt-3 text-sm text-gray-500">Khách chưa chọn món kèm theo.</p> : <div className="mt-3 divide-y divide-gray-100">{booking.booking_items.map((item) => <div key={item.bookingItemId} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-normal text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.category}</p></div><p className="shrink-0 font-normal text-gray-700">×{item.quantity}</p></div>)}</div>}</section>
        {booking.note && <section className="rounded-xl border border-gray-100 bg-gray-50 p-4"><h3 className="text-sm font-normal text-gray-900">Ghi chú từ khách</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{booking.note}</p></section>}
      </div>
      <footer className="flex justify-end border-t border-gray-100 bg-white p-5"><button type="button" onClick={onClose} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white transition hover:bg-red-700">Đóng</button></footer>
    </section>
  </div>;
}
const canReportCustomer = (booking: BookingDetail, now: number) => {
  const mealTime = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`).getTime();
  return booking.userId !== null && ["confirmed", "completed"].includes(booking.status)
    && Number.isFinite(mealTime)
    && now >= mealTime
    && now <= mealTime + 7 * 24 * 60 * 60 * 1000;
};

export default function BookingManagement() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBookingId = Number(searchParams.get("booking")) || null;
  const [voucherBooking,setVoucherBooking]=useState<BookingDetail|null>(null);
  const [voucherId,setVoucherId]=useState<number|null>(null);
  const vouchers=useQuery<Discount[]>({queryKey:["manager-discounts"],enabled:!!voucherBooking,queryFn:()=>api.get("/v1/discounts/me").then(r=>r.data)});
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [keyword, setKeyword] = useState("");
  const [page,setPage]=useState(0);
  const [createOpen,setCreateOpen]=useState(false);
  const [form,setForm]=useState({contactName:"",contactEmail:"",contactPhone:"",date:"",time:"",guestCount:1,note:""});
  const effectiveFilter=searchParams.get("status")==="all"?"all":statusFilter;
  const profile=useQuery<{id:number;is_active:boolean;is_report_suspended:boolean;approval_status:string}>({queryKey:["partner-application"],queryFn:()=>api.get("/v1/partners/application/me").then(r=>r.data)});
  const filterKey=JSON.stringify([keyword,effectiveFilter]);
  const [previousFilter,setPreviousFilter]=useState(filterKey);
  if(previousFilter!==filterKey){setPreviousFilter(filterKey);setPage(0);}
  const [reportBookingId, setReportBookingId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const availableVouchers=(vouchers.data??[]).filter(v=>v.is_active&&new Date(v.expires_at).getTime()>now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const bookingsQ=useQuery<{items:BookingDetail[];total:number;counts:Record<string,number>}>({queryKey:["manager-bookings",page,keyword,effectiveFilter],refetchInterval:15000,queryFn:()=>api.get("/v1/bookings/manager/me",{params:{limit:10,offset:page*10,status:effectiveFilter,keyword}}).then(r=>r.data)});
  const selectedQ=useQuery<BookingDetail>({queryKey:["manager-booking-detail",selectedBookingId],enabled:!!selectedBookingId,queryFn:()=>api.get("/v1/bookings/"+selectedBookingId).then(r=>r.data)});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manager-bookings'] });
  };

  const confirmMut = useMutation({
    mutationFn: ({id,voucherId}:{id:number;voucherId?:number}) => api.put(`/v1/bookings/${id}/confirm`,voucherId?{voucher_id:voucherId}:{}),
    onSuccess: (_,v) => { setVoucherBooking(null);setVoucherId(null);toast.success(v.voucherId?'Đã xác nhận và gửi voucher qua hội thoại':'Đã xác nhận đặt bàn'); invalidate();void qc.invalidateQueries({queryKey:['chat-conversations']});void qc.invalidateQueries({queryKey:['chat-messages']});void qc.invalidateQueries({queryKey:['manager-booking-detail']}); },
    onError: e => toast.error(errorMessage(e)),
  });
  const errorMessage=(e:unknown)=>axios.isAxiosError(e)&&typeof e.response?.data?.detail==="string"?e.response.data.detail:"Thông tin không hợp lệ hoặc thao tác thất bại";
  const createMut=useMutation({mutationFn:()=>api.post("/v1/bookings/manager/create",{...form,restaurantId:profile.data?.id,requestSeats:form.guestCount,childCount:0,items:[]}),onSuccess:()=>{setCreateOpen(false);setPage(0);setStatusFilter("confirmed");setSearchParams({});invalidate();toast.success("Đã tạo đơn đặt bàn");},onError:e=>toast.error(errorMessage(e))});
  const allBookings=bookingsQ.data?.items??[];
  const filtered=allBookings;
  const counts=bookingsQ.data?.counts??{};
  const isBusy=confirmMut.isPending;
  const canConfirm=profile.data?.is_active===true && !profile.data.is_report_suspended && profile.data.approval_status==="approved";
  const FILTERS=[
    {key:"active",label:"Cần xử lý",count:counts.pending??0},
    {key:"confirmed",label:"Đã xác nhận",count:(counts.confirmed??0)+(counts.completed??0)},
    {key:"cancelled",label:"Đã hủy",count:counts.cancelled??0},
    {key:"all",label:"Tất cả",count:Object.values(counts).reduce((a,b)=>a+b,0)},
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between"><h1 className="text-2xl font-normal text-gray-900">Quản lý đặt bàn</h1><button onClick={()=>setCreateOpen(true)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-normal text-white">Tạo đơn đặt bàn</button></div>
        <p className="text-sm text-gray-400 mt-0.5">Xem và xử lý các đơn đặt bàn của nhà hàng</p>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="flex border-b border-gray-100 px-2 pt-2 gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setSearchParams({}); setStatusFilter(f.key);setPage(0); }}
              className={`px-4 py-2.5 text-sm font-normal rounded-t-xl transition-colors border-b-2
                ${effectiveFilter === f.key
                  ? 'border-red-500 text-red-700 bg-red-50/60'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {f.label}
              {f.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full
                  ${effectiveFilter === f.key ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-500'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center pr-4 pb-2">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm tên, SĐT, mã đơn…" className="mr-3 w-44 rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-red-400 sm:w-56" />
            <button onClick={invalidate} className="text-xs text-gray-400 hover:text-gray-600 transition">↻ Làm mới</button>
          </div>
        </div>

        {bookingsQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-normal">Không có đơn nào trong mục này</p>
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
                      <p className="font-normal text-gray-800">Đơn #{b.bookingId} · {b.contactName}</p>
                      <p className="text-xs text-gray-400">{b.contactPhone}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-normal text-gray-700">{b.date}</p>
                      <p className="text-xs text-gray-400">{b.time}</p>
                    </td>
                    <td className="px-5 py-3.5 text-center font-normal text-gray-700">{b.requestSeats}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-normal ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {b.status==="completed"&&b.attendance==="arrived"?"Hoàn thành · Đã đến":b.status==="completed"&&b.attendance==="no_show"?"Hoàn thành · Không đến":STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button type="button" onClick={() => setSearchParams({ booking: String(b.bookingId) })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-normal text-gray-700 transition hover:border-red-300 hover:bg-red-50">Xem chi tiết</button><BookingActions booking={b} manager />
                        {canReportCustomer(b, now) && <button onClick={() => setReportBookingId(b.bookingId)} className="rounded border px-3 py-2 text-red-600">Báo cáo khách</button>}
                        {b.status === 'pending' && (
                          <>
                            <button onClick={() => { setConfirmingId(b.bookingId); confirmMut.mutate({id:b.bookingId}); }} disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-normal transition disabled:opacity-40">
                              {confirmMut.isPending && confirmingId === b.bookingId ? '...' : '✓ Xác nhận'}
                            </button>
                            <button type="button" disabled={isBusy||!canConfirm||b.userId===null} title={b.userId===null?"Khách chưa có tài khoản để nhận voucher qua trò chuyện":undefined} onClick={()=>{setVoucherId(null);setVoucherBooking(b);}} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 disabled:opacity-40">Xác nhận kèm voucher</button>
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
      <div className="flex justify-between text-sm"><span>{bookingsQ.data?.total??0} đơn · Trang {page+1}/{Math.max(1,Math.ceil((bookingsQ.data?.total??0)/10))}</span><div className="flex gap-2"><button disabled={page===0} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={()=>setPage(page-1)}>Trước</button><button disabled={(page+1)*10>=(bookingsQ.data?.total??0)} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={()=>setPage(page+1)}>Sau</button></div></div>
      {voucherBooking&&<div role="dialog" aria-modal="true" aria-labelledby="confirm-voucher-title" className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm" onClick={()=>{if(!confirmMut.isPending)setVoucherBooking(null);}}>
        <form onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(canConfirm&&voucherId&&!confirmMut.isPending){setConfirmingId(voucherBooking.bookingId);confirmMut.mutate({id:voucherBooking.bookingId,voucherId});}}} className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-3"><h2 id="confirm-voucher-title">Xác nhận kèm voucher</h2><button type="button" disabled={confirmMut.isPending} aria-label="Đóng" className="rounded-lg p-2 hover:bg-gray-100" onClick={()=>setVoucherBooking(null)}>✕</button></div>
          <p className="text-gray-600">Đơn #{voucherBooking.bookingId} · {voucherBooking.contactName}</p>
          <label htmlFor="confirmation-voucher" className="block text-gray-700">Voucher gửi cho khách<select id="confirmation-voucher" required value={voucherId??""} disabled={confirmMut.isPending||vouchers.isLoading} onChange={e=>setVoucherId(Number(e.target.value)||null)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"><option value="">Chọn voucher</option>{availableVouchers.map(v=><option key={v.id} value={v.id}>{v.code} · {v.title} · Giảm {discountValue(v)}</option>)}</select></label>
          {vouchers.isLoading&&<p className="text-gray-500">Đang tải voucher...</p>}
          {vouchers.isError&&<div className="text-red-700">Không tải được voucher. <button type="button" className="underline" onClick={()=>void vouchers.refetch()}>Thử lại</button></div>}
          {vouchers.isSuccess&&!availableVouchers.length&&<p className="text-gray-500">Chưa có voucher đang hoạt động. Tạo voucher ở mục Mã giảm giá.</p>}
          {availableVouchers.find(v=>v.id===voucherId)&&<div className="rounded-xl border border-red-100 bg-red-50 p-4 text-gray-700">{availableVouchers.filter(v=>v.id===voucherId).map(v=><div key={v.id}><p>Hóa đơn từ {v.minimum.toLocaleString("vi-VN")}đ</p><p className="mt-1">Hạn dùng: {new Date(v.expires_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</p></div>)}</div>}
          <p className="text-gray-500">Mã ưu đãi và điều kiện áp dụng sẽ được gửi vào hội thoại với khách sau khi xác nhận.</p>
          <div className="flex justify-end gap-3"><button type="button" disabled={confirmMut.isPending} className="rounded-xl border border-gray-200 px-4 py-2.5" onClick={()=>setVoucherBooking(null)}>Hủy</button><button disabled={!canConfirm||confirmMut.isPending||!availableVouchers.some(v=>v.id===voucherId)} className="rounded-xl bg-red-600 px-4 py-2.5 text-white hover:bg-red-700 disabled:opacity-40">{confirmMut.isPending?"Đang xác nhận...":"Xác nhận và gửi voucher"}</button></div>
        </form>
      </div>}
      {createOpen && <div role="dialog" aria-modal="true" aria-labelledby="create-booking-title" onClick={()=>{if(!createMut.isPending)setCreateOpen(false);}} onKeyDown={e=>{
        if(e.key==="Escape"&&!createMut.isPending){e.stopPropagation();setCreateOpen(false);}
        if(e.key==="Tab"){
          const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')).filter(x=>!x.closest("fieldset:disabled"));
          const first=controls[0],last=controls[controls.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
        }
      }} className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-3 backdrop-blur-sm sm:p-6">
        <form onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(!createMut.isPending)createMut.mutate();}} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
            <h2 id="create-booking-title" className="font-normal text-gray-900">Tạo đơn đặt bàn</h2>
            <button type="button" aria-label="Đóng cửa sổ tạo đơn" disabled={createMut.isPending} onClick={()=>setCreateOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40">✕</button>
          </header>
          <fieldset disabled={createMut.isPending} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
            <section>
              <p className="mb-4 text-gray-900">Thông tin khách hàng</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor="create-contact-name" className="block text-gray-600 sm:col-span-2">Tên khách <span className="text-red-600">*</span>
                  <input autoFocus id="create-contact-name" required autoComplete="name" placeholder="Nhập họ và tên khách hàng" maxLength={255} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
                <label htmlFor="create-contact-phone" className="block text-gray-600">Số điện thoại <span className="text-red-600">*</span>
                  <input id="create-contact-phone" required type="tel" autoComplete="tel" placeholder="Nhập số điện thoại" value={form.contactPhone} onChange={e=>setForm({...form,contactPhone:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
                <label htmlFor="create-contact-email" className="block text-gray-600">Email <span className="text-red-600">*</span>
                  <input id="create-contact-email" required type="email" autoComplete="email" placeholder="email@example.com" value={form.contactEmail} onChange={e=>setForm({...form,contactEmail:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
              </div>
            </section>
            <section className="border-t border-gray-100 pt-5">
              <p className="mb-4 text-gray-900">Thông tin đặt bàn</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label htmlFor="create-booking-date" className="block text-gray-600">Ngày dùng bữa <span className="text-red-600">*</span>
                  <input id="create-booking-date" required type="date" min={new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"})} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="mt-2 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
                <label htmlFor="create-booking-time" className="block text-gray-600">Giờ dùng bữa <span className="text-red-600">*</span>
                  <input id="create-booking-time" required type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} className="mt-2 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
                <label htmlFor="create-booking-guests" className="block text-gray-600">Số khách <span className="text-red-600">*</span>
                  <input id="create-booking-guests" required type="number" min="1" step="1" value={form.guestCount} onChange={e=>setForm({...form,guestCount:Number(e.target.value)})} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
                </label>
              </div>
              <label htmlFor="create-booking-note" className="mt-4 block text-gray-600">Ghi chú
                <textarea id="create-booking-note" rows={3} placeholder="Yêu cầu hoặc lưu ý của khách hàng" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100" />
              </label>
            </section>
          </fieldset>
          <footer className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
            <button type="button" disabled={createMut.isPending} onClick={()=>setCreateOpen(false)} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-gray-700 transition hover:bg-gray-100 disabled:opacity-50">Hủy</button>
            <button disabled={createMut.isPending||!profile.data} type="submit" className="rounded-xl bg-red-600 px-5 py-2.5 text-white transition hover:bg-red-700 disabled:opacity-50">{createMut.isPending ? "Đang tạo đơn..." : "Tạo đơn đặt bàn"}</button>
          </footer>
        </form>
      </div>}
      {selectedBookingId && selectedQ.data && <BookingDetailModal booking={selectedQ.data} onClose={() => { const params = new URLSearchParams(searchParams); params.delete("booking"); setSearchParams(params); }} />}
      {reportBookingId && <ViolationReportModal bookingId={reportBookingId} target="customer" onClose={() => setReportBookingId(null)} onSuccess={invalidate} />}
    </div>
  );
}
