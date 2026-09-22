import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { api } from "./api";

export type DepositRefund = {
  id: number; booking_id: number; amount: number;
  status: "pending" | "processing" | "refunded";
  bank_name: string | null; account_name: string | null; account_number: string | null;
  qr_image_url: string | null; created_at: string; submitted_at: string | null;
  refunded_at: string | null; proof_url: string | null; restaurant_name?: string;
};
export const refundLabels = { pending: "Chờ thông tin nhận tiền", processing: "Chờ hoàn cọc", refunded: "Đã hoàn cọc" };
export const refundMoney = (amount: number, locale = "vi-VN") =>
  locale === "vi-VN"
    ? `${amount.toLocaleString("vi-VN")} đ`
    : new Intl.NumberFormat(locale, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
export const refundError = (error: unknown, fallback: string) => {
  const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
  return typeof detail === "string" ? detail : fallback;
};
export function useBookingRefund(bookingId: string | number) {
  const { user } = useAuth();
  return useQuery<DepositRefund>({
    queryKey: ["booking-refund", user?.userId, String(bookingId)],
    queryFn: ({ signal }) => api.get(`/v1/deposits/bookings/${bookingId}/refund`, { signal }).then(r => r.data),
    enabled: !!bookingId && user?.role === "customer",
    staleTime: 0, gcTime: 0, refetchOnWindowFocus: true,
    refetchInterval: q => q.state.data?.status === "processing" ? 15000 : false,
  });
}
