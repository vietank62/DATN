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
  bookingId: number;
  userId: number;
  restaurantId: number;
  restaurantName?: string | null;
  date: string;
  time: string;
  guestCount: number;
  childCount: number;
  requestSeats: number;
  assignedSeats: number;
  status: string;
  depositAmount: number;
  depositStatus: string;
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
