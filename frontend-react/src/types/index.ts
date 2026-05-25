export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  available: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  district: string;
  cuisine: string[];  // Mảng các loại ẩm thực (VD: ["vietnamese", "seafood"])
  priceRange: string;
  rating: number;
  reviewCount: number;
  imageUrl: string[];
  description: string;
  openTime: string;
  closeTime: string;
  phone: string;
  featured: boolean;
  menu?: MenuItem[];
  totalSeats: number;
  availableSeats: number;
  managerID?: number;
  status?: 'pending' | 'active' | 'rejected';
  businessLicenseUrl?: string;
  taxId?: string;
  promotion?: string;
}

export interface Booking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  guestCount: number;
  requestedSeats: number;
  assignedSeats?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  note: string;
  createdAt: string;
}

export interface FilterOptions {
  cuisineType: string;
  priceRange: string;
  area: string;
  rating: number;
  time?: string;
  guests?: number;
  query?: string;
}

export type UserRole = 'customer' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
  password?: string;
}

export interface ManagerStats {
  totalBookings: number;
  todayBookings: number;
  totalRevenue: number;
  avgRating: number;
  pendingBookings: number;
  confirmedBookings: number;
}

export interface AdminStats {
  totalRestaurants: number;
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  activeRestaurants: number;
  newUsersThisMonth: number;
}

export interface Review {
  reviewId: number;
  userId: number;
  userName?: string;
  userAvatar?: string;
  restaurantId: number;
  restaurantName?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ─── Chart / Statistics ───────────────────────────────────

export interface MonthlyBookingStat {
  month: number;
  count: number;
  label: string;
}

export interface BookingChartResponse {
  monthly: MonthlyBookingStat[];
  totalYear: number;
  year: number;
}

export interface MenuDistributionStat {
  category: string;
  count: number;
  percentage: number;
}

export interface MenuChartResponse {
  distribution: MenuDistributionStat[];
  totalItems: number;
}

export interface BookingStatusStat {
  status: string;
  count: number;
  percentage: number;
}

export interface StatusChartResponse {
  distribution: BookingStatusStat[];
  totalBookings: number;
}

export interface CuisineType {
  id: string;
  label: string;
  icon: string;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

