import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../services/api";
import { useTranslation } from "react-i18next";

type PaymentStatus = {
  depositStatus: string;
  bookingExpiresAt: string | null;
  canCheckout: boolean;
  needsReview: boolean;
  serverNow: string;
};
type CheckoutForm = {
  checkoutUrl: string;
  fields: Record<string, string>;
};
const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function DepositCheckoutPanel({ bookingId }: { bookingId: number }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
      const code = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined;
      toast.error(code === 401
        ? t("payment.signInAgain")
        : code === 409
          ? t("payment.bookingChanged")
          : typeof detail === "string" && detail
            ? detail
            : t("payment.openFailed"));
      void statusQ.refetch();
    },
  });
  if (statusQ.isLoading) return <p className="text-sm text-gray-500">{t("payment.checking")}</p>;
  if (statusQ.isError || !status) return <button onClick={() => void statusQ.refetch()} className="text-sm text-red-600">{t("payment.loadFailed")}</button>;
  const now = new Date(status.serverNow).getTime() + Math.max(0, clock - statusQ.dataUpdatedAt);
  const secondsLeft = status.bookingExpiresAt ? Math.max(0, Math.ceil((Date.parse(status.bookingExpiresAt) - now) / 1000)) : 0;
  if (status.needsReview) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("payment.review")}</p>;
  if (status.depositStatus === "refund_pending") return <p className="text-sm text-amber-700">{t("payment.refundPending")}</p>;
  if (status.depositStatus === "refunded") return <p className="text-sm text-emerald-700">{t("payment.refunded")}</p>;
  if (status.depositStatus === "paid") return <p className="text-sm font-semibold text-emerald-700">{t("payment.paid")}</p>;
  if (!status.canCheckout || secondsLeft === 0) return <p className="text-sm text-red-600">{t("payment.expired")}</p>;
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm text-gray-600">{t("payment.payWithin")} <b className="tabular-nums">{countdown(secondsLeft)}</b>.</p>
      <button type="button" disabled={checkout.isPending} onClick={() => checkout.mutate()} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">
        {checkout.isPending ? t("payment.opening") : t("payment.payNow")}
      </button>
    </div>
  );
}
