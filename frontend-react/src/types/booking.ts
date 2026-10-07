export interface BookingMenuItemInput {
  itemId: number;
  quantity: number;
}

export interface BookingMenuItemDetail {
  bookingItemId: number;
  itemId: number;
  quantity: number;
  price: number;
  name: string;
  category: string;
  image_url?: string | null;
  description?: string | null;
}

export interface BookingDetail {
  attendance?: "arrived" | "no_show" | null;
  bookingId: number;
  userId: number | null;
  restaurantId: number;
  restaurantName?: string | null;
  cancellationLeadMinutes?: number;
  date: string;
  time: string;
  guestCount: number;
  childCount: number;
  requestSeats: number;
  assignedSeats: number;
  status: string;
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationEvidence?: string | null;
  cancellationActor?: string | null;
  depositAmount: number;
  depositStatus: string;
  refundStatus?: "pending" | "processing" | "refunded" | null;
  restaurantReportStatus?: "open" | "appeal_pending" | "dismissed" | "appeal_rejected" | null;
  depositPaidAt?: string | null;
  depositExpiresAt?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note?: string | null;
  createdAt?: string | null;
  booking_items: BookingMenuItemDetail[];
}

export interface BookingCreatePayload {
  restaurantId: number;
  date: string;
  time: string;
  guestCount: number;
  childCount: number;
  requestSeats: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note?: string;
  items: BookingMenuItemInput[];
}
