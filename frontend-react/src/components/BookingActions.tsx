import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../services/api";
import { uploadImage } from "../services/upload";
import type { BookingDetail } from "../types/booking";

export function BookingActions({ booking, manager = false }: { booking: BookingDetail; manager?: boolean }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("restaurant");
  const [evidence, setEvidence] = useState("");
  const [contacted, setContacted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const reviews = useQuery<{ bookingId: number }[]>({
    queryKey: ["user-reviews", booking.userId],
    queryFn: () => api.get(`/api/get-user-reviews/${booking.userId}`).then(r => r.data),
    enabled: !manager && booking.status === "completed",
  });
  const action = useMutation({
    mutationFn: ({ path, data }: { path: string; data: object }) => api.put(`/v1/bookings/${booking.bookingId}/${path}`, data),
    onSuccess: () => { setOpen(false); toast.success("Đã cập nhật đơn đặt bàn"); void qc.invalidateQueries({ queryKey: ["booking-detail"] }); void qc.invalidateQueries({ queryKey: ["manager-bookings"] }); void qc.invalidateQueries({ queryKey: ["my-bookings"] }); },
    onError: error => toast.error(axios.isAxiosError(error) ? error.response?.data?.detail || "Không thể xử lý yêu cầu" : "Không thể xử lý yêu cầu"),
  });
  const review = useMutation({
    mutationFn: () => api.post("/api/create-review/", { bookingId: booking.bookingId, restaurantId: booking.restaurantId, userId: booking.userId, rating, comment }),
    onSuccess: () => { toast.success("Đã gửi đánh giá"); void qc.invalidateQueries({ queryKey: ["user-reviews"] }); void qc.invalidateQueries({ queryKey: ["restaurant-reviews"] }); },
    onError: error => toast.error(axios.isAxiosError(error) ? error.response?.data?.detail || "Không thể đánh giá" : "Không thể đánh giá"),
  });
  const active = ["pending", "awaiting_payment", "confirmed"].includes(booking.status);
  const tooLate = booking.status === "confirmed" && new Date(`${booking.date}T${booking.time.slice(0,5)}:00+07:00`).getTime() - now < 3600000;
  const waiting = booking.cancellationStatus === "requested";
  const needsProof = manager && source === "restaurant" && booking.status === "confirmed";
  return <div className="space-y-3 text-left text-sm">
    {booking.cancellationReason && <p className="rounded-lg bg-amber-50 p-3">{waiting ? "Yêu cầu huỷ đang chờ xử lý" : booking.cancellationStatus === "rejected" ? "Yêu cầu huỷ bị từ chối; đơn vẫn được giữ" : "Lý do huỷ"}: {booking.cancellationReason}</p>}
    {booking.cancellationEvidence && <a href={booking.cancellationEvidence} target="_blank" rel="noreferrer" className="text-blue-700 underline">Xem minh chứng huỷ bàn</a>}
    {active && (manager || (!tooLate && !waiting)) && <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">{manager && waiting ? "Xử lý yêu cầu huỷ" : manager && booking.status === "pending" ? "Từ chối đơn" : "Huỷ đặt bàn"}</button>}
    {!manager && active && tooLate && <p>Còn dưới 1 giờ: hãy <a className="text-blue-700 underline" href={`/chat/${booking.restaurantId}`}>nhắn tin</a> hoặc gọi hotline nhà hàng trên trang thông tin nhà hàng để yêu cầu huỷ bàn.</p>}
    {open && <div role="dialog" aria-modal="true" aria-label="Huỷ đặt bàn" className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"><form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6" onSubmit={e => { e.preventDefault(); action.mutate({ path: manager && waiting ? "cancellation-decision" : manager ? "cancel" : "customer-cancel", data: manager && waiting ? { approved: true, reason } : { reason, source, evidence_url: evidence || null, contacted_customer: contacted } }); }}>
      <h2 className="text-lg font-bold">{waiting && manager ? "Xử lý yêu cầu huỷ của khách" : "Huỷ đặt bàn"}</h2>
      {!manager && booking.status === "confirmed" && <p>Yêu cầu sẽ được gửi cho nhà hàng. Đơn vẫn đã xác nhận cho đến khi nhà hàng chấp nhận; tiền cọc được hoàn khi chấp nhận huỷ.</p>}
      {manager && !waiting && <label className="block">Bên yêu cầu<select className="mt-1 w-full rounded border p-2" value={source} onChange={e => setSource(e.target.value)}><option value="restaurant">Nhà hàng</option><option value="customer">Khách hàng yêu cầu qua điện thoại/tin nhắn</option></select></label>}
      <label className="block">Lý do<textarea required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      {needsProof && !waiting && <><label className="block"><input type="checkbox" checked={contacted} onChange={e => setContacted(e.target.checked)} required /> Đã liên hệ khách qua điện thoại, email hoặc tin nhắn</label><label className="block">Ảnh minh chứng<input type="file" accept="image/*" disabled={uploading} onChange={async e => { const file=e.target.files?.[0]; if (!file) return; setUploading(true); try { setEvidence(await uploadImage(file)); } catch { toast.error("Không tải được minh chứng"); } finally { setUploading(false); } }} /></label>{evidence && <p>Đã tải minh chứng.</p>}</>}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setOpen(false)}>Đóng</button><button disabled={action.isPending || uploading || (needsProof && !waiting && !evidence)} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">{manager && waiting ? "Chấp nhận huỷ và hoàn cọc" : "Gửi yêu cầu"}</button>{manager && waiting && <button type="button" disabled={action.isPending || reason.trim().length < 3} onClick={() => action.mutate({ path: "cancellation-decision", data: { approved: false, reason } })} className="rounded border px-3 py-2">Từ chối huỷ, giữ đơn</button>}</div>
    </form></div>}
    {!manager && booking.status === "completed" && reviews.isSuccess && (reviews.data.some(r => r.bookingId === booking.bookingId) ? <p>Bạn đã đánh giá đơn này.</p> : <form className="space-y-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); review.mutate(); }}><h3 className="font-bold">Đánh giá bữa ăn</h3><label>Số sao <select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} sao</option>)}</select></label><textarea aria-label="Nội dung đánh giá" className="w-full rounded border p-2" value={comment} maxLength={2000} onChange={e => setComment(e.target.value)} /><button disabled={review.isPending} className="rounded bg-red-600 px-4 py-2 text-white">Gửi đánh giá</button></form>)}
  </div>;
}
