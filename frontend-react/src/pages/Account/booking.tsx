import { BookingActions } from "../../components/BookingActions";
import { RefundProgress } from "../../components/RefundProgress";
import { DepositCheckoutPanel } from "../../components/DepositCheckoutPanel";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../services/api";
import type { BookingDetail } from "../../types/booking";
import { getCategoryLabel } from "../../utils/category";
import { ViolationReportModal } from "../../components/ViolationReportModal";
import { useTranslation } from "react-i18next";


const REPORT_STATUS_LABEL: Record<string, string> = {
  open: "Đang chờ nhà hàng giải trình",
  appeal_pending: "Đang chờ admin xét duyệt",
  dismissed: "Đã xử lý và gỡ vi phạm",
  appeal_rejected: "Giải trình bị từ chối",
};

const STATUS_BADGE: Record<string, string> = {
  payment_expired: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  awaiting_payment: "bg-violet-100 text-violet-700",
  expired: "bg-red-100 text-red-700",
};

const formatCreatedAt = (value: string | null | undefined, locale: string, empty: string) => {
  if (!value) return empty;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

export default function BookingPage() {
  const { t, i18n } = useTranslation();
  const { bookingId } = useParams<{ bookingId?: string }>();
  const navigate = useNavigate();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const bookingDetailQ = useQuery<BookingDetail>({
    queryKey: ["booking-detail", bookingId],
    queryFn: () =>
      api.get(`/v1/bookings/${bookingId}`).then((response) => response.data),
    enabled: !!bookingId,
    refetchOnWindowFocus: true,
  });

  const myBookingsQ = useQuery<BookingDetail[]>({
    queryKey: ["my-bookings"],
    queryFn: () => api.get("/v1/bookings/me").then((response) => response.data),
    enabled: !bookingId,
  });

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const statusLabel = (status: string) => status === "rejected" ? "Đặt bàn không thành công" : t(`booking.status.${status}`, { defaultValue: status });
  const currency = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  const booking = bookingDetailQ.data;
  const bookings = myBookingsQ.data ?? [];
  if (bookingId && bookingDetailQ.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-sm border-4 border-red-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500 font-medium">
            {t("booking.loadingDetail")}
          </p>
        </div>
      </div>
    );
  }

  if (bookingId && bookingDetailQ.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-white border border-gray-100 rounded-xl shadow-sm p-8">
          <p className="text-4xl mb-3">📋</p>
          <h1 className="text-xl font-bold text-gray-900">
            {t("booking.notFound")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t("booking.notFoundHelp")}
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            {t("booking.home")}
          </button>
        </div>
      </div>
    );
  }

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("booking.myBookings")}
            </h1>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {myBookingsQ.isLoading ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                {t("booking.loading")}
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">🍽️</p>
                <p className="text-gray-500 font-medium">
                  {t("booking.empty")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bookings.map((item) => (
                  <div
                    key={item.bookingId}
                    onClick={() =>
                      navigate(`/account/bookings/${item.bookingId}`)
                    }
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-gray-900">
                          {item.restaurantName ??
                            t("booking.restaurantFallback", { id: item.restaurantId })}
                        </h2>
                        <span
                          className={`px-2.5 py-1 rounded-sm text-xs font-semibold ${STATUS_BADGE[item.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.date} · {item.time} · {t("booking.guests", { count: item.guestCount })}
                      </p>
                      {item.status === "payment_expired" && <p className="mt-2 text-xs font-medium text-red-600">{t("booking.paymentFailed")}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {item.depositStatus === "refund_pending" && item.refundStatus !== "processing" && <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/account/bookings/${item.bookingId}/refund`); }} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">{t("booking.addRefundDetails")}</button>}
                      {item.depositStatus === "refund_pending" && item.refundStatus === "processing" && <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/account/bookings/${item.bookingId}/refund`); }} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white">{t("booking.refundProcessing")}</button>}
                      {item.depositStatus === "refunded" && <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/account/bookings/${item.bookingId}/refund`); }} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">{t("booking.viewRefund")}</button>}
                      <span className="text-sm font-semibold text-red-600">{t("booking.viewDetails")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const bookingMealTime = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`).getTime();
  const canReportRestaurant = ['confirmed', 'completed'].includes(booking.status)
    && Number.isFinite(bookingMealTime)
    && now >= bookingMealTime
    && now <= bookingMealTime + 7 * 24 * 60 * 60 * 1000;

  const itemTotal = booking.booking_items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/account/bookings")}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-red-600"
            >
              <span aria-hidden="true">←</span>
              {t("booking.backToList")}
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t("booking.detailTitle")}
            </h1>
          </div>
          <span
            className={`inline-flex w-fit items-center px-4 py-2 rounded-xl text-sm font-bold shadow-sm ring-1 ring-inset ${STATUS_BADGE[booking.status] ?? "bg-gray-100 text-gray-600"} ring-current/15`}
          >
            {statusLabel(booking.status)}
          </span>
        </div>

        <BookingActions booking={booking} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white border border-red-100 rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-xl bg-linear-to-br from-red-50 via-white to-slate-50 border border-red-100 p-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {booking.restaurantName ??
                    t("booking.restaurantFallback", { id: booking.restaurantId })}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("booking.bookedFor", { date: booking.date, time: booking.time })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/restaurant/${booking.restaurantId}`)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                {t("booking.viewRestaurant")}
              </button>
              {booking.restaurantReportStatus ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-amber-900">✓ Đã gửi báo cáo</span>
                  <span className="text-amber-800">{REPORT_STATUS_LABEL[booking.restaurantReportStatus] ?? booking.restaurantReportStatus}</span>
                  <Link to="/account/violation-reports" className="font-bold text-red-700 underline hover:text-red-800">Theo dõi xử lý</Link>
                </div>
              ) : canReportRestaurant && (
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="mt-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  {t("booking.reportRestaurant")}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoCard
                label={t("booking.guestsTotal")}
                value={t("booking.people", { count: booking.guestCount })}
              />
              <InfoCard
                label={t("booking.children")}
                value={t("booking.childrenCount", { count: booking.childCount })}
              />
              <InfoCard
                label={t("booking.seats")}
                value={t("booking.seatsCount", { count: booking.requestSeats })}
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
                {t("booking.items")}
              </h3>
              {booking.booking_items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                  {t("booking.noItems")}
                </div>
              ) : (
                <div className="space-y-3">
                  {booking.booking_items.map((item) => (
                    <div
                      key={item.bookingItemId}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {t(`filter.value.${getCategoryLabel(item.category)}`, { defaultValue: getCategoryLabel(item.category) })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          x{item.quantity}
                        </p>
                        <p className="text-xs text-gray-500">
                          {currency(Number(item.price))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {booking.note && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
                  {t("booking.note")}
                </h3>
                <div className="rounded-xl bg-slate-50 border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-line">
                  {booking.note}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {t("booking.contact")}
              </h3>
              <DetailRow label={t("booking.fullName")} value={booking.contactName} />
              <DetailRow label="Email" value={booking.contactEmail} />
              <DetailRow label={t("booking.phone")} value={booking.contactPhone} />
            </div>

            {booking.depositStatus !== "not_required" && (
              <div className="bg-white border border-violet-100 rounded-xl shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  {t("booking.deposit")}
                </h3>
                <DetailRow
                  label={t("booking.amount")}
                  value={currency(booking.depositAmount)}
                />
                <DetailRow
                  label={t("booking.status")}
                  value={
                    ["paid", "forfeited"].includes(booking.depositStatus)
                      ? t("booking.deposit.paid")
                      : booking.depositStatus === "refund_pending"
                        ? t("booking.deposit.refundPending")
                        : booking.depositStatus === "refunded" ? t("booking.deposit.refunded")
                        : booking.depositStatus === "expired"
                          ? t("booking.deposit.expired")
                          : t("booking.deposit.awaiting")
                  }
                />
                {["refund_pending", "refunded"].includes(booking.depositStatus)
                  ? <RefundProgress bookingId={booking.bookingId} />
                  : <DepositCheckoutPanel bookingId={booking.bookingId} />}
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {t("booking.processing")}
              </h3>
              <DetailRow
                label={t("booking.createdAt")}
                value={formatCreatedAt(booking.createdAt, locale, t("booking.none"))}
              />
              <DetailRow
                label={t("booking.status")}
                value={statusLabel(booking.status)}
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {t("booking.subtotal")}
              </h3>
              <DetailRow
                label={t("booking.items")}
                value={currency(itemTotal)}
              />
              <DetailRow
                label={t("booking.itemCount")}
                value={String(booking.booking_items.length)}
              />
            </div>
          </div>
        </div>
      </div>
      {isReportOpen && (
        <ViolationReportModal
          bookingId={booking.bookingId}
          target="restaurant"
          onClose={() => setIsReportOpen(false)}
          onSuccess={() => void bookingDetailQ.refetch()}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
