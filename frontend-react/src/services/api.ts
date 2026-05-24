import type { Restaurant, Booking, FilterOptions, MenuItem, User, UserRole, ManagerStats, AdminStats, Review, BookingChartResponse, MenuChartResponse, StatusChartResponse, CuisineType } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// ─── Helpers ──────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('tablenow_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshPromise: Promise<string> | null = null;
let isRedirecting = false;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (isRedirecting) throw new Error('Session expired');

  const executeRequest = () => fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });

  let res = await executeRequest();

  if (res.status === 401 && !url.includes('/api/authentication/')) {
    // Only attempt refresh if the user HAD a token (was logged in)
    const hadToken = !!getToken();
    if (!hadToken) {
      throw new Error('Unauthenticated');
    }
    try {
      if (!refreshPromise) {
        refreshPromise = refreshToken();
      }
      await refreshPromise;
      res = await executeRequest();
    } catch (err) {
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('tablenow_token');
        localStorage.removeItem('tablenow_user');
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    } finally {
      if (!isRedirecting) {
        refreshPromise = null;
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Mappers: backend → frontend ──────────────────────────

/** Map a backend restaurant row to the frontend Restaurant type */
function mapRestaurant(r: any): Restaurant {
  return {
    id: String(r.restaurantId),
    name: r.name,
    address: r.address,
    district: r.district,
    cuisine: r.cuisine ? (typeof r.cuisine === 'string' ? JSON.parse(r.cuisine) : r.cuisine) : [],
    priceRange: r.priceRange,
    rating: r.rating,
    reviewCount: r.reviewCount,
    imageUrl: r.imageUrl ? (typeof r.imageUrl === 'string' && r.imageUrl.startsWith('[') ? JSON.parse(r.imageUrl) : (typeof r.imageUrl === 'string' ? [r.imageUrl] : r.imageUrl)) : [],
    description: r.description ?? '',
    openTime: r.openTime,
    closeTime: r.closeTime,
    phone: r.phone,
    featured: r.featured,
    totalSeats: r.totalSeats,
    availableSeats: r.availableSeats,
    managerID: r.managerID,
    status: r.status,
    businessLicenseUrl: r.businessLicenseUrl,
    taxId: r.taxId,
    promotion: r.promotion,
    menu: r.menu?.map(mapMenuItem),
  };
}

function mapMenuItem(m: any): MenuItem {
  return {
    id: String(m.itemId),
    name: m.name,
    description: m.description ?? '',
    price: m.price,
    imageUrl: m.image ?? '',
    category: m.category ?? '',
    available: m.available ?? true,
  };
}

function mapBooking(b: any): Booking {
  return {
    id: String(b.bookingId),
    restaurantId: String(b.restaurantId),
    restaurantName: b.restaurantName ?? '',
    date: b.date,
    time: b.time,
    guestCount: b.guestCount,
    requestedSeats: b.requestSeats,
    assignedSeats: b.assignedSeats || undefined,
    status: b.status,
    contactInfo: {
      name: b.contactName,
      email: b.contactEmail,
      phone: b.contactPhone,
    },
    note: b.note ?? '',
    createdAt: b.createdAt ?? '',
  };
}

function mapUser(u: any): User {
  return {
    id: String(u.userId),
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role as UserRole,
    avatar: u.avatar ?? '',
    password: u.password,
  };
}

function mapReview(r: any): Review {
  return {
    reviewId: r.reviewId,
    userId: r.userId,
    userName: r.userName,
    userAvatar: r.userAvatar,
    restaurantId: r.restaurantId,
    restaurantName: r.restaurantName,
    rating: r.rating,
    comment: r.comment ?? '',
    createdAt: r.createdAt ?? '',
  };
}

// ─── Auth ─────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  // Reset auth state flags on a fresh login
  isRedirecting = false;
  refreshPromise = null;

  // OAuth2 password flow expects form data
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/api/authentication/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Đăng nhập thất bại');
  }
  const tokenData = await res.json();
  const token = tokenData.access_token;
  localStorage.setItem('tablenow_token', token);

  // Fetch the active user profile
  const user = await getActiveUser();
  return { token, user };
}

export async function refreshToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/authentication/refresh-token`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  localStorage.setItem('tablenow_token', data.access_token);
  return data.access_token;
}

export async function logoutUser(): Promise<void> {
  // Cancel any pending token refresh — prevents race conditions
  refreshPromise = null;

  await fetch(`${API_BASE}/api/authentication/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => { });
  localStorage.removeItem('tablenow_token');
  localStorage.removeItem('tablenow_user');
}

export async function getActiveUser(): Promise<User> {
  // Use raw fetch (not request()) so that a 401 here does NOT
  // trigger the session-expired redirect for unauthenticated visitors.
  const token = getToken();
  if (!token) throw new Error('No token');

  const res = await fetch(`${API_BASE}/api/authentication/active-user`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthenticated');
  const data = await res.json();
  return mapUser(data);
}

export async function registerUser(info: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}): Promise<User> {
  const data = await request<any>('/api/create-user/', {
    method: 'POST',
    body: JSON.stringify(info),
  });
  return mapUser(data);
}

// Removed redundant registerPartner definition

// ─── Restaurants ──────────────────────────────────────────

export const fetchCuisines = async (): Promise<CuisineType[]> => {
  return request<CuisineType[]>('/api/cuisines/');
};

export const fetchRestaurants = async (filters?: FilterOptions, cuisinesList: CuisineType[] = []): Promise<Restaurant[]> => {
  const url = `/api/get-all-restaurant/`;
  const rawData = await request<any[]>(url);
  let data = rawData.map(mapRestaurant);

  if (filters) {
    if (filters.cuisineType && filters.cuisineType !== 'all') {
      const selectedCuisine = cuisinesList.find((c) => c.id === filters.cuisineType);
      const expectedLabel = selectedCuisine ? selectedCuisine.label : filters.cuisineType;

      data = data.filter((r) =>
        r.cuisine.includes(filters.cuisineType) ||
        r.cuisine.includes(expectedLabel)
      );
    }
    if (filters.area && filters.area !== 'Tất cả') {
      data = data.filter((r) => r.district === filters.area || r.district?.includes(filters.area));
    }
    if (filters.rating > 0) {
      data = data.filter((r) => r.rating >= filters.rating);
    }
    if (filters.priceRange && filters.priceRange !== 'all') {
      data = data.filter((r) => {
        if (!r.priceRange || r.priceRange === 'Chưa cập nhật') return false;

        const cleanStr = r.priceRange.replace(/[,.đ\s]/g, '');
        const numMatches = cleanStr.match(/\d+/g);
        if (!numMatches) return false;

        const minPrice = parseInt(numMatches[0], 10);
        const maxPrice = numMatches.length > 1 ? parseInt(numMatches[1], 10) : minPrice;
        const avgPrice = (minPrice + maxPrice) / 2;

        if (filters.priceRange === 'under200') return avgPrice < 200000;
        if (filters.priceRange === '200to500') return avgPrice >= 200000 && avgPrice <= 500000;
        if (filters.priceRange === '500to1m') return avgPrice > 500000 && avgPrice <= 1000000;
        if (filters.priceRange === 'above1m') return avgPrice > 1000000;

        return true;
      });
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      data = data.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (filters.guests) {
      data = data.filter((r) => r.totalSeats >= (filters.guests as number));
    }
    if (filters.time) {
      data = data.filter((r) => {
        if (!r.openTime || !r.closeTime) return true;
        const open = r.openTime;
        const close = r.closeTime;
        const time = filters.time as string;
        if (open <= close) {
          return time >= open && time <= close;
        } else {
          // Open past midnight
          return time >= open || time <= close;
        }
      });
    }
  }
  return data;
};

export const fetchRestaurantById = async (id: string): Promise<Restaurant | undefined> => {
  try {
    const data = await request<any>(`/api/get-restaurant/${id}`);
    return mapRestaurant(data);
  } catch {
    return undefined;
  }
};

export const searchRestaurants = async (query: string): Promise<Restaurant[]> => {
  if (!query.trim()) return [];
  const data = await request<any[]>(`/api/search-restaurants/?q=${encodeURIComponent(query)}`);
  return data.map(mapRestaurant);
};

export const createRestaurant = async (
  restaurant: Omit<Restaurant, 'id' | 'menu'> & { managerID: number },
): Promise<Restaurant> => {
  const data = await request<any>('/api/create-restaurant/', {
    method: 'POST',
    body: JSON.stringify({
      name: restaurant.name,
      address: restaurant.address,
      district: restaurant.district,
      cuisine: restaurant.cuisine,
      imageUrl: restaurant.imageUrl,
      description: restaurant.description,
      openTime: restaurant.openTime,
      closeTime: restaurant.closeTime,
      featured: restaurant.featured,
      phone: restaurant.phone,
      totalSeats: restaurant.totalSeats,
      availableSeats: restaurant.availableSeats,
      managerID: restaurant.managerID,
      businessLicenseUrl: (restaurant as any).businessLicenseUrl,
      taxId: (restaurant as any).taxId,
    }),
  });
  return mapRestaurant(data);
};

export const updateRestaurant = async (
  id: string,
  updates: Partial<Restaurant>,
): Promise<Restaurant> => {
  // Map frontend keys to backend keys
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.district !== undefined) payload.district = updates.district;
  if (updates.cuisine !== undefined) payload.cuisine = updates.cuisine;
  if (updates.imageUrl !== undefined) payload.imageUrl = updates.imageUrl;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.openTime !== undefined) payload.openTime = updates.openTime;
  if (updates.closeTime !== undefined) payload.closeTime = updates.closeTime;
  if (updates.featured !== undefined) payload.featured = updates.featured;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.totalSeats !== undefined) payload.totalSeats = updates.totalSeats;
  if (updates.availableSeats !== undefined) payload.availableSeats = updates.availableSeats;

  const data = await request<any>(`/api/update-restaurant/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapRestaurant(data);
};

export const deleteRestaurant = async (id: string): Promise<void> => {
  await request(`/api/delete-restaurant/${id}`, { method: 'DELETE' });
};

// ─── Menu Items ───────────────────────────────────────────

export const fetchMenuItems = async (restaurantId: string): Promise<MenuItem[]> => {
  const data = await request<any[]>(`/api/get-menuitems-by-restaurant/${restaurantId}`);
  return data.map(mapMenuItem);
};

export const createMenuItem = async (
  item: Omit<MenuItem, 'id'> & { restaurantId: string },
): Promise<MenuItem> => {
  const data = await request<any>('/api/create-menuitem/', {
    method: 'POST',
    body: JSON.stringify({
      restaurantId: Number(item.restaurantId),
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.imageUrl,
      category: item.category,
    }),
  });
  return mapMenuItem(data);
};

export const updateMenuItem = async (
  id: string,
  updates: Partial<MenuItem>,
): Promise<MenuItem> => {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.price !== undefined) payload.price = updates.price;
  if (updates.imageUrl !== undefined) payload.image = updates.imageUrl;
  if (updates.category !== undefined) payload.category = updates.category;

  const data = await request<any>(`/api/update-menuitem/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapMenuItem(data);
};

export const deleteMenuItem = async (id: string): Promise<void> => {
  await request(`/api/delete-menuitem/${id}`, { method: 'DELETE' });
};

// ─── Bookings ─────────────────────────────────────────────

export const createBooking = async (
  bookingData: Omit<Booking, 'id' | 'createdAt'>,
): Promise<{ success: boolean; message: string; booking: Booking }> => {
  const payload = {
    userId: Number(localStorage.getItem('tablenow_user_id') || 0),
    restaurantId: Number(bookingData.restaurantId),
    date: bookingData.date,
    time: bookingData.time,
    guestCount: bookingData.guestCount,
    requestSeats: bookingData.requestedSeats,
    contactName: bookingData.contactInfo.name,
    contactEmail: bookingData.contactInfo.email,
    contactPhone: bookingData.contactInfo.phone,
    note: bookingData.note || null,
  };
  const data = await request<any>('/api/create-booking/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    success: true,
    message: 'Đặt bàn thành công!',
    booking: mapBooking(data),
  };
};

export const fetchBookings = async (restaurantId?: string): Promise<Booking[]> => {
  let url: string;
  if (restaurantId) {
    url = `/api/get-bookings-by-restaurant/${restaurantId}`;
  } else {
    url = '/api/get-all-booking/';
  }
  const data = await request<any[]>(url);
  return data.map(mapBooking);
};

export const fetchBookingsByUser = async (userId: string): Promise<Booking[]> => {
  const data = await request<any[]>(`/api/get-bookings-by-user/${userId}`);
  return data.map(mapBooking);
};

export const updateBookingStatus = async (
  bookingId: string,
  status: Booking['status'],
): Promise<{ success: boolean }> => {
  let url: string;
  if (status === 'confirmed') {
    url = `/api/bookings/${bookingId}/confirm`;
  } else if (status === 'cancelled') {
    url = `/api/bookings/${bookingId}/cancel`;
  } else if (status === 'completed') {
    url = `/api/bookings/${bookingId}/complete`;
  } else {
    // Generic update fallback
    await request(`/api/update-booking/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return { success: true };
  }
  await request(url, { method: 'PUT' });
  return { success: true };
};

export const deleteBooking = async (id: string): Promise<void> => {
  await request(`/api/delete-booking/${id}`, { method: 'DELETE' });
};

// ─── Users (admin) ────────────────────────────────────────

export const fetchAllUsers = async (): Promise<User[]> => {
  const data = await request<any[]>('/api/get-all-user/');
  return data.map(mapUser);
};

export const fetchUserByEmail = async (email: string): Promise<User> => {
  const data = await request<any>(`/api/get-user/${email}`);
  return mapUser(data);
};

export const updateUser = async (email: string, updates: Partial<User & { password?: string }>): Promise<User> => {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.avatar !== undefined) payload.avatar = updates.avatar;
  if ((updates as any).password !== undefined) payload.password = (updates as any).password;

  const data = await request<any>(`/api/update-user/${email}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapUser(data);
};

export const deleteUser = async (email: string): Promise<void> => {
  await request(`/api/delete-user/${email}`, { method: 'DELETE' });
};

// ─── Statistics ─────────────────────────────────────

export const fetchManagerStats = async (restaurantId: string): Promise<ManagerStats> => {
  return request<ManagerStats>(`/api/stats/manager/${restaurantId}`);
};

export const fetchAdminStats = async (): Promise<AdminStats> => {
  return request<AdminStats>('/api/stats/admin');
};

export const fetchMonthlyBookings = async (restaurantId: string, year?: number): Promise<BookingChartResponse> => {
  const url = year
    ? `/api/stats/manager/${restaurantId}/monthly-bookings?year=${year}`
    : `/api/stats/manager/${restaurantId}/monthly-bookings`;
  return request<BookingChartResponse>(url);
};

export const fetchMenuDistribution = async (restaurantId: string): Promise<MenuChartResponse> => {
  return request<MenuChartResponse>(`/api/stats/manager/${restaurantId}/menu-distribution`);
};

export const fetchBookingStatusDistribution = async (restaurantId: string): Promise<StatusChartResponse> => {
  return request<StatusChartResponse>(`/api/stats/manager/${restaurantId}/booking-status`);
};

export const fetchFeeStats = async (restaurantId: string): Promise<any> => {
  return request<any>(`/api/restaurants/${restaurantId}/fee-stats`);
};

export const payRestaurantFees = async (restaurantId: string): Promise<any> => {
  return request<any>(`/api/restaurants/${restaurantId}/pay-fees`, {
    method: 'POST',
  });
};

export const createPayment = async (restaurantId: string): Promise<any> => {
  return request<any>(`/api/payments/create?restaurant_id=${restaurantId}`, {
    method: 'POST',
  });
};

export const getPaymentStatus = async (paymentId: number): Promise<any> => {
  return request<any>(`/api/payments/${paymentId}/status`);
};

export const getCheckoutFields = async (paymentId: number): Promise<any> => {
  return request<any>(`/api/payments/${paymentId}/checkout-fields`);
};

export const simulatePaymentWebhook = async (paymentId: number): Promise<any> => {
  return request<any>(`/api/sepay/simulate-webhook?payment_id=${paymentId}`, {
    method: 'POST',
  });
};

// ─── Reviews ──────────────────────────────────────────────

export const fetchReviews = async (restaurantId: string): Promise<Review[]> => {
  const data = await request<any[]>(`/api/get-restaurant-reviews/${restaurantId}`);
  return data.map(mapReview);
};

export const fetchUserReviews = async (userId: string): Promise<Review[]> => {
  const data = await request<any[]>(`/api/get-user-reviews/${userId}`);
  return data.map(mapReview);
};

export const createReview = async (
  reviewData: Omit<Review, 'reviewId' | 'createdAt'>,
): Promise<Review> => {
  const payload = {
    userId: reviewData.userId,
    restaurantId: reviewData.restaurantId,
    rating: reviewData.rating,
    comment: reviewData.comment,
  };
  const data = await request<any>('/api/create-review/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapReview(data);
};

// ─── Upload ───────────────────────────────────────────────

export const uploadImage = async (file: File): Promise<{ url: string; filename: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/upload-image/`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return {
    url: data.url.startsWith('http') ? data.url : `${API_BASE}${data.url}`,
    filename: data.filename,
  };
};

// ─── Default export (backward-compatible) ─────────────────


export const registerPartner = async (data: {
  user: any;
  restaurant: any;
}): Promise<any> => {
  return request('/api/authentication/register-partner', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const fetchPendingRestaurants = async (): Promise<Restaurant[]> => {
  const data = await request<any[]>('/api/admin/pending-restaurants/');
  return data.map(mapRestaurant);
};

export const approveRestaurant = async (id: string): Promise<void> => {
  await request(`/api/admin/approve-restaurant/${id}`, { method: 'PATCH' });
};

export const rejectRestaurant = async (id: string): Promise<void> => {
  await request(`/api/admin/reject-restaurant/${id}`, { method: 'PATCH' });
};

const api = {
  fetchRestaurants,
  fetchRestaurantById,
  getRestaurantById: fetchRestaurantById,
  createBooking,
  fetchBookings,
  updateBookingStatus,
  loginUser,
  logoutUser,
  registerUser,
  getActiveUser,
  refreshToken,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  fetchBookingsByUser,
  deleteBooking,
  fetchAllUsers,
  fetchUserByEmail,
  updateUser,
  deleteUser,
  fetchManagerStats,
  fetchAdminStats,
  fetchMonthlyBookings,
  fetchMenuDistribution,
  fetchBookingStatusDistribution,
  fetchFeeStats,
  payRestaurantFees,
  createPayment,
  getPaymentStatus,
  getCheckoutFields,
  simulatePaymentWebhook,
  fetchReviews,
  createReview,
  registerPartner,
  fetchPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
};

export default api;