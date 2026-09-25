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
  const [evidenceFileName, setEvidenceFileName] = useState("");
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
  const mealTime = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`).getTime();
  const hasMealStarted = Number.isFinite(mealTime) && mealTime <= now;
  const tooLate = !hasMealStarted && Number.isFinite(mealTime) && mealTime - now <= 3600000;
  const customerCancellationUnavailable = tooLate || hasMealStarted;
  const managerCancellationUnavailable = booking.status === "confirmed" && hasMealStarted;
  const waiting = booking.cancellationStatus === "requested";
  const needsProof = manager && source === "restaurant" && booking.status === "confirmed";
  return <div className="space-y-3 text-left text-sm">
    {booking.cancellationReason && <p className="rounded-lg bg-amber-50 p-3">{waiting ? "Yêu cầu huỷ đang chờ xử lý" : booking.cancellationStatus === "rejected" ? "Yêu cầu huỷ bị từ chối; đơn vẫn được giữ" : "Lý do huỷ"}: {booking.cancellationReason}</p>}
    {booking.cancellationEvidence && <a href={booking.cancellationEvidence} target="_blank" rel="noreferrer" className="text-blue-700 underline">Xem minh chứng huỷ bàn</a>}
    {active && (manager ? !managerCancellationUnavailable : (!customerCancellationUnavailable && !waiting)) && <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">{manager && waiting ? "Xử lý yêu cầu huỷ" : manager && booking.status === "pending" ? "Từ chối đơn" : "Huỷ đặt bàn"}</button>}
    {!manager && active && tooLate && <p>Còn 1 giờ hoặc ít hơn: hãy <a className="text-blue-700 underline" href={`/chat/${booking.restaurantId}`}>nhắn tin</a> hoặc gọi hotline nhà hàng trên trang thông tin nhà hàng để yêu cầu huỷ bàn.</p>}
    {open && <div role="dialog" aria-modal="true" aria-label="Huỷ đặt bàn" className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"><form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6" onSubmit={e => { e.preventDefault(); action.mutate({ path: manager && waiting ? "cancellation-decision" : manager ? "cancel" : "customer-cancel", data: manager && waiting ? { approved: true, reason } : { reason, source, evidence_url: evidence || null, contacted_customer: contacted } }); }}>
      <h2 className="text-lg font-bold">{waiting && manager ? "Xử lý yêu cầu huỷ của khách" : "Huỷ đặt bàn"}</h2>
      {!manager && booking.status === "confirmed" && <p>Yêu cầu sẽ được gửi cho nhà hàng. Đơn vẫn đã xác nhận cho đến khi nhà hàng chấp nhận; tiền cọc được hoàn khi chấp nhận huỷ.</p>}
      {manager && !waiting && <label className="block">Bên yêu cầu<select className="mt-1 w-full rounded border p-2" value={source} onChange={e => setSource(e.target.value)}><option value="restaurant">Nhà hàng</option><option value="customer">Khách hàng yêu cầu qua điện thoại/tin nhắn</option></select></label>}
      <label className="block">Lý do<textarea required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      {needsProof && !waiting && <><label className="block"><input type="checkbox" checked={contacted} onChange={e => setContacted(e.target.checked)} required /> Đã liên hệ khách qua điện thoại, email hoặc tin nhắn</label><div><p className="text-sm font-semibold">Ảnh minh chứng</p><input id={`booking-cancellation-proof-${booking.bookingId}`} className="sr-only" type="file" accept="image/*" disabled={uploading} onChange={async e => { const file=e.target.files?.[0]; if (!file) return; setUploading(true); try { setEvidence(await uploadImage(file)); setEvidenceFileName(file.name); } catch { toast.error("Không tải được minh chứng"); } finally { setUploading(false); } }} /><div className="mt-2 flex flex-wrap items-center gap-3"><label htmlFor={`booking-cancellation-proof-${booking.bookingId}`} className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Chọn tệp</label><span className="max-w-full truncate text-sm text-gray-500">{uploading ? "Đang tải tệp…" : evidenceFileName || "Chưa chọn tệp"}</span>{evidence && !uploading && <button type="button" onClick={() => { setEvidence(""); setEvidenceFileName(""); }} className="text-sm font-semibold text-gray-600 underline hover:text-red-600">Hủy tệp đã chọn</button>}</div></div></>}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setOpen(false)}>Đóng</button><button disabled={action.isPending || uploading || (needsProof && !waiting && !evidence)} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">{manager && waiting ? "Chấp nhận huỷ và hoàn cọc" : "Gửi yêu cầu"}</button>{manager && waiting && <button type="button" disabled={action.isPending || reason.trim().length < 3} onClick={() => action.mutate({ path: "cancellation-decision", data: { approved: false, reason } })} className="rounded border px-3 py-2">Từ chối huỷ, giữ đơn</button>}</div>
    </form></div>}
    {!manager && booking.status === "completed" && reviews.isSuccess && (
      reviews.data.some((item) => item.bookingId === booking.bookingId) ? (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-emerald-900">
          <p className="text-sm font-bold">✓ Đánh giá đã được gửi</p>
          <p className="mt-1 text-sm text-emerald-800">Cảm ơn bạn đã chia sẻ trải nghiệm tại nhà hàng.</p>
        </section>
      ) : (
        <form className="space-y-5 rounded-2xl border border-red-100 bg-white p-5 shadow-sm sm:p-6" onSubmit={(event) => { event.preventDefault(); review.mutate(); }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Đánh giá bữa ăn</h2>
              <p className="mt-1 text-sm text-slate-600">Chia sẻ trải nghiệm của bạn để giúp nhà hàng phục vụ tốt hơn.</p>
            </div>
            <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">{rating}/5 sao</span>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-800">Mức độ hài lòng</legend>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Số sao đánh giá">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} sao`}
                  onClick={() => setRating(value)}
                  className={`cursor-pointer rounded-md p-1 text-3xl leading-none transition focus:outline-none focus:ring-2 focus:ring-red-400 ${value <= rating ? "text-amber-400 hover:text-amber-500" : "text-slate-200 hover:text-amber-300"}`}
                >
                  <span aria-hidden="true">★</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-slate-800">
            Nhận xét <span className="text-red-600" aria-hidden="true">*</span>
            <textarea
              aria-label="Nội dung đánh giá"
              value={comment}
              maxLength={2000}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ví dụ: Món ăn ngon, nhân viên nhiệt tình..."
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
            <span className="mt-1 block text-right text-xs font-normal text-slate-400">{comment.length}/2000</span>
          </label>
          <div className="flex justify-end">
            <button disabled={review.isPending || comment.trim().length < 3} className="cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {review.isPending ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      )
    )}
  </div>;
}
