export const BOOKING_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Chờ thanh toán đặt cọc",
  payment_expired: "Thanh toán không thành công",
  rejected: "Đặt bàn không thành công",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
  expired: "Hết hạn phản hồi",
};

export const BOOKING_STATUS_COLOR: Record<string, string> = {
  awaiting_payment: "#8b5cf6",
  payment_expired: "#ef4444",
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  completed: "#10b981",
  cancelled: "#f97316",
  expired: "#ef4444",
};

// Translate status codes in notifications saved before Vietnamese labels existed.
export function translateBookingNotification(text: string): string {
  return text.replace(/\b(awaiting_payment|payment_expired|rejected|pending|confirmed|completed|cancelled|expired)\b/g, status => BOOKING_STATUS_LABEL[status] ?? status);
}

// Statistics can return translated labels instead of status codes.
for (const [status, label] of Object.entries(BOOKING_STATUS_LABEL)) {
  BOOKING_STATUS_COLOR[label] = BOOKING_STATUS_COLOR[status];
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý nhà hàng",
  user: "Khách hàng",
  customer: "Khách hàng",
};
