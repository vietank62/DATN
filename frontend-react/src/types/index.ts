export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  district: string;
  cuisine: string;
  priceRange: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  openTime: string;
  closeTime: string;
  phone: string;
  featured: boolean;
  menu?: MenuItem[];
}

export interface Booking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  guestCount: number;
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
}

export type UserRole = 'customer' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
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