import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useBookingRefund, type DepositRefund } from "../services/refund";
import { useTranslation } from "react-i18next";

export function RefundTimeline({ refund }: { refund: DepositRefund }) {
  const { i18n, t } = useTranslation(); const language = i18n.language === "en" ? "en" : "vi"; const stage = refund.status === "refunded" ? 3 : refund.status === "processing" ? 2 : 1;
  const steps = language === "en" ? ["Add payout details", "Refund in progress", "Deposit refunded"] : ["Chờ thông tin nhận tiền", "Đã nhận thông tin, chờ hoàn cọc", "Đã hoàn tiền đặt cọc"];
  return <div className="space-y-3 text-sm" aria-live="polite"><ol className="space-y-2" aria-label={t("refund.timeline")}>{steps.map((label, i) => <li key={label} aria-current={stage === i + 1 ? "step" : undefined} className={stage >= i + 1 ? "font-semibold text-red-700" : "text-gray-400"}>{stage > i + 1 ? "✓" : `${i + 1}.`} {label}</li>)}</ol>{refund.status === "pending" && <p>{language === "en" ? "Please provide your payout details so we can process the refund." : "Vui lòng cung cấp tài khoản để chúng tôi xử lý hoàn tiền."}</p>}{refund.status === "processing" && <p>{language === "en" ? "We’ve received your details and will notify you once the refund is sent." : "Thông tin đã được tiếp nhận. Chúng tôi sẽ thông báo khi đã chuyển tiền."}</p>}{refund.refunded_at && <p>{language === "en" ? "Refunded on:" : "Thời gian hoàn:"} {new Date(refund.refunded_at).toLocaleString(language === "en" ? "en-US" : "vi-VN")}</p>}{refund.status === "refunded" && refund.proof_url && <a className="font-semibold text-blue-700 underline" href={refund.proof_url} target="_blank" rel="noreferrer">{language === "en" ? "View refund proof" : "Xem minh chứng hoàn tiền"}</a>}</div>;
}

export function RefundProgress({ bookingId }: { bookingId: number }) {
  const q = useBookingRefund(bookingId); const qc = useQueryClient(); const { i18n, t } = useTranslation(); const language = i18n.language === "en" ? "en" : "vi";
  useEffect(() => { if (q.data?.status === "refunded") { void qc.invalidateQueries({ queryKey: ["booking-detail", String(bookingId)] }); void qc.invalidateQueries({ queryKey: ["my-bookings"] }); } }, [q.data?.status, bookingId, qc]);
  if (q.isLoading) return <p>{t("refund.loading")}</p>; if (q.isError || !q.data) return <button type="button" onClick={() => void q.refetch()} className="text-red-600">{t("refund.loadFailed")}</button>;
  const status = q.data.status === "pending" ? (language === "en" ? "Waiting for payout details" : "Chờ thông tin nhận tiền") : q.data.status === "processing" ? (language === "en" ? "Refund in progress" : "Đang hoàn cọc") : (language === "en" ? "Deposit refunded" : "Đã hoàn tiền đặt cọc");
  return <section className="space-y-3 rounded-xl border border-red-100 bg-white p-5"><h4 className="font-bold">{status}</h4><RefundTimeline refund={q.data} />{q.data.status === "pending" && <Link to={`/account/bookings/${bookingId}/refund`} className="inline-block rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700">{t("refund.addDetails")}</Link>}</section>;
}
