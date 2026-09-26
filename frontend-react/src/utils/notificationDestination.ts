export type AppNotification = {
  type: string;
  bookingId?: number | null;
  conversationId?: number | null;
};

const bookingDetail = (bookingId?: number | null) =>
  bookingId ? `/account/bookings/${bookingId}` : "/account/bookings";

export function customerNotificationDestination(notification: AppNotification): string {
  if (notification.type === "chat_message") {
    return notification.conversationId ? `/chat?conversation=${notification.conversationId}` : "/chat";
  }
  if (notification.type === "violation_warning") return "/account/violation-reports";
  if (notification.type.startsWith("refund_") && notification.bookingId) {
    return `/account/bookings/${notification.bookingId}/refund`;
  }
  return bookingDetail(notification.bookingId);
}

export function managerNotificationDestination(notification: AppNotification): string {
  if (notification.type === "chat_message") {
    return notification.conversationId ? `/manager/chat?conversation=${notification.conversationId}` : "/manager/chat";
  }
  if (
    notification.type === "booking_fee" ||
    notification.type === "fee_payment_completed" ||
    notification.type.startsWith("withdrawal_")
  ) return "/manager/finance";
  if (notification.type.startsWith("approval_")) return "/manager/approval-status";
  if (notification.type === "violation_warning" || notification.type === "late_response_warning") {
    return "/manager/violation-reports";
  }
  return notification.bookingId
    ? `/manager/bookings?booking=${notification.bookingId}`
    : "/manager/bookings?status=all";
}

export function adminNotificationDestination(notification: AppNotification): string {
  if (notification.type.startsWith("partner_")) return "/admin/partner-applications";
  if (
    notification.type.startsWith("withdrawal_") ||
    notification.type.startsWith("refund_") ||
    notification.type === "payment_review"
  ) return "/admin/withdrawals";
  if (notification.type === "booking_fee" || notification.type === "fee_payment_completed") {
    return "/admin/booking-fees";
  }
  if (notification.type.startsWith("violation_")) return "/admin/violation-reports";
  return "/admin";
}
