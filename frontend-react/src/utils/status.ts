export const BOOKING_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Chờ thanh toán đặt cọc",
  payment_expired: "Hết hạn đặt cọc",
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

// Statistics can return translated labels instead of status codes.
for (const [status, label] of Object.entries(BOOKING_STATUS_LABEL)) {
  BOOKING_STATUS_COLOR[label] = BOOKING_STATUS_COLOR[status];
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý nhà hàng",
  user: "Khách hàng",
};
