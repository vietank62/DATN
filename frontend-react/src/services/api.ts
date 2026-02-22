import type { Restaurant, Booking, FilterOptions } from '../types';
import { mockRestaurants, mockBookings } from '../data/restaurants';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lấy danh sách nhà hàng, có hỗ trợ lọc */
export const fetchRestaurants = async (filters?: FilterOptions): Promise<Restaurant[]> => {
  await delay(500);
  let result = [...mockRestaurants];

  if (filters) {
    if (filters.cuisineType && filters.cuisineType !== 'all') {
      result = result.filter((r) => r.cuisine === filters.cuisineType);
    }
    if (filters.area && filters.area !== 'Tất cả') {
      result = result.filter((r) => r.district === filters.area);
    }
    if (filters.rating > 0) {
      result = result.filter((r) => r.rating >= filters.rating);
    }
    if (filters.priceRange && filters.priceRange !== 'all') {
      result = result.filter((r) => {
        const priceMap: Record<string, string> = {
          'under200': 'Dưới 200K',
          '200to500': '200K - 500K',
          '500to1m': '500K - 1M',
          'above1m': 'Trên 1M',
        };
        return r.priceRange === priceMap[filters.priceRange];
      });
    }
  }

  return result;
};

export const fetchRestaurantById = async (id: string): Promise<Restaurant | undefined> => {
  await delay(300);
  return mockRestaurants.find((r) => r.id === id);
};

export const createBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string; booking: Booking }> => {
  await delay(800);
  const newBooking: Booking = {
    ...bookingData,
    id: 'BK' + String(Date.now()).slice(-6),
    createdAt: new Date().toISOString(),
  };
  console.log('Booking created:', newBooking);
  return { success: true, message: 'Đặt bàn thành công!', booking: newBooking };
};

export const fetchBookings = async (restaurantId?: string): Promise<Booking[]> => {
  await delay(400);
  if (restaurantId) {
    return mockBookings.filter((b) => b.restaurantId === restaurantId);
  }
  return mockBookings;
};

export const updateBookingStatus = async (bookingId: string, status: Booking['status']): Promise<{ success: boolean }> => {
  await delay(300);
  const booking = mockBookings.find((b) => b.id === bookingId);
  if (booking) {
    booking.status = status;
  }
  return { success: true };
};

const api = {
  fetchRestaurants,
  fetchRestaurantById,
  getRestaurantById: fetchRestaurantById,
  createBooking,
  fetchBookings,
  updateBookingStatus,
};

export default api;