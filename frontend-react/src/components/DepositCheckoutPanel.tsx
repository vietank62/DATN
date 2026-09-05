import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../services/api";

type PaymentStatus = {
  depositStatus: string;
  bookingExpiresAt: string | null;
  sessionStatus: string;
  sessionExpiresAt: string | null;
  canCheckout: boolean;
  needsReview: boolean;
  serverNow: string;
};
type CheckoutForm = {
  checkoutUrl: string;
  fields: Record<string, string>;
};
const dateLabel = (date: string) => new Date(date).toLocaleString("vi-VN");
const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function DepositCheckoutPanel({ bookingId }: { bookingId: number }) {
  const queryClient = useQueryClient();
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const statusQ = useQuery<PaymentStatus>({
    queryKey: ["deposit-status", bookingId],
    queryFn: () => api.get(`/v1/deposits/bookings/${bookingId}/status`).then(r => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.depositStatus === "pending" ? 3000 : false,
  });
  const status = statusQ.data;
  useEffect(() => {
    if (status?.depositStatus && status.depositStatus !== "pending") {
      void queryClient.invalidateQueries({ queryKey: ["booking-detail", String(bookingId)] });
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  }, [status?.depositStatus, bookingId, queryClient]);
  const checkout = useMutation({
    mutationFn: () => api.post<CheckoutForm>(`/v1/deposits/bookings/${bookingId}/checkout`).then(r => r.data),
    onSuccess: data => {
      // A top-level form POST opens the hosted checkout without exposing server credentials.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.checkoutUrl;
      for (const [name, value] of Object.entries(data.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();
    },
    onError: error => {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.detail ?? "Không thể mở SePay." : "Không thể mở SePay.");
      void statusQ.refetch();
    },
  });
  if (statusQ.isLoading) return <p className="text-sm text-gray-500">Đang kiểm tra thanh toán…</p>;
  if (statusQ.isError || !status) return <button onClick={() => void statusQ.refetch()} className="text-sm text-red-600">Không tải được trạng thái. Thử lại</button>;
  const now = new Date(status.serverNow).getTime() + Math.max(0, clock - statusQ.dataUpdatedAt);
  const secondsLeft = status.bookingExpiresAt ? Math.max(0, Math.ceil((Date.parse(status.bookingExpiresAt) - now) / 1000)) : 0;
  const sessionLeft = status.sessionExpiresAt ? Math.max(0, Math.ceil((Date.parse(status.sessionExpiresAt) - now) / 1000)) : 0;
  if (status.needsReview) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Giao dịch đang được đối soát. Vui lòng không thanh toán thêm; quản trị viên sẽ kiểm tra và hỗ trợ.</p>;
  if (status.depositStatus === "refund_pending") return <p className="text-sm text-amber-700">Tiền đặt cọc đang được hoàn lại.</p>;
  if (status.depositStatus === "paid") return <p className="text-sm font-semibold text-emerald-700">Đã thanh toán đặt cọc thành công.</p>;
  if (!status.canCheckout || secondsLeft === 0) return <p className="text-sm text-red-600">Đơn không còn trong thời hạn thanh toán. Vui lòng tạo đơn mới nếu vẫn muốn đặt bàn.</p>;
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm text-gray-600">Đơn còn <b>{countdown(secondsLeft)}</b> để thanh toán.</p>
      {status.bookingExpiresAt && <p className="text-xs text-gray-500">Hạn đơn: {dateLabel(status.bookingExpiresAt)}</p>}
      <p className="text-sm text-gray-600">Mỗi phiên thanh toán có tối đa 10 phút và kết thúc khi đơn hết hạn.</p>
      {status.sessionStatus === "pending" && sessionLeft > 0 && <p className="text-sm text-violet-700">Phiên hiện tại còn {countdown(sessionLeft)}.</p>}
      {(status.sessionStatus === "expired" || (status.sessionStatus === "pending" && sessionLeft === 0)) && <p className="text-sm text-amber-700">Phiên cũ đã hết hạn. Bạn có thể tạo phiên thanh toán mới.</p>}
      <button type="button" disabled={checkout.isPending} onClick={() => checkout.mutate()} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-50">
        {checkout.isPending ? "Đang chuyển đến SePay…" : status.sessionStatus === "pending" && sessionLeft > 0 ? "Tiếp tục thanh toán trên SePay" : status.sessionStatus === "not_created" ? "Thanh toán qua SePay" : "Tạo phiên thanh toán mới"}
      </button>
    </div>
  );
}
