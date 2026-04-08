import type { Restaurant, Booking, FilterOptions, MenuItem, User, UserRole, ManagerStats, AdminStats } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// ─── Helpers ──────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('tablenow_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',          // for refresh-token cookie
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });
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
    cuisine: r.cuisine,
    cuisines: r.cuisines ? (typeof r.cuisines === 'string' ? JSON.parse(r.cuisines) : r.cuisines) : undefined,
    priceRange: r.priceRange,
    rating: r.rating,
    reviewCount: r.reviewCount,
    imageUrl: r.imageUrl ?? '',
    description: r.description ?? '',
    openTime: r.openTime,
    closeTime: r.closeTime,
    phone: r.phone,
    featured: r.featured,
    totalSeats: r.totalSeats,
    availableSeats: r.availableSeats,
    managerID: r.managerID,
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
  };
}

// ─── Auth ─────────────────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
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
  await fetch(`${API_BASE}/api/authentication/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
  localStorage.removeItem('tablenow_token');
  localStorage.removeItem('tablenow_user');
}

export async function getActiveUser(): Promise<User> {
  const data = await request<any>('/api/authentication/active-user');
  return mapUser(data);
}

export async function registerUser(info: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<User> {
  const data = await request<any>('/api/create-user/', {
    method: 'POST',
    body: JSON.stringify(info),
  });
  return mapUser(data);
}

// ─── Restaurants ──────────────────────────────────────────

export const fetchRestaurants = async (filters?: FilterOptions): Promise<Restaurant[]> => {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.cuisineType && filters.cuisineType !== 'all') {
      // Map frontend cuisine IDs to backend Vietnamese labels
      const cuisineMap: Record<string, string> = {
        seafood: 'Hải sản',
        european: 'Đồ Âu',
        buffet: 'Buffet',
        japanese: 'Nhật Bản',
        korean: 'Hàn Quốc',
        vietnamese: 'Việt Nam',
        hotpot: 'Lẩu',
        bbq: 'Nướng',
        italian: 'Ý',
      };
      params.set('cuisine', cuisineMap[filters.cuisineType] || filters.cuisineType);
    }
    if (filters.area && filters.area !== 'Tất cả') {
      params.set('district', filters.area);
    }
    if (filters.rating > 0) {
      params.set('minRating', String(filters.rating));
    }
    if (filters.priceRange && filters.priceRange !== 'all') {
      const priceMap: Record<string, string> = {
        under200: 'Dưới 200K',
        '200to500': '200K - 500K',
        '500to1m': '500K - 1M',
        above1m: 'Trên 1M',
      };
      if (priceMap[filters.priceRange]) {
        params.set('priceRange', priceMap[filters.priceRange]);
      }
    }
  }
  const qs = params.toString();
  const url = `/api/get-all-restaurant/${qs ? `?${qs}` : ''}`;
  const data = await request<any[]>(url);
  return data.map(mapRestaurant);
};

export const fetchRestaurantById = async (id: string): Promise<Restaurant | undefined> => {
  try {
    const data = await request<any>(`/api/get-restaurant/${id}`);
    return mapRestaurant(data);
  } catch {
    return undefined;
  }
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
      cuisines: restaurant.cuisines,  // New: support multiple cuisines
      priceRange: restaurant.priceRange,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      imageUrl: restaurant.imageUrl,
      description: restaurant.description,
      openTime: restaurant.openTime,
      closeTime: restaurant.closeTime,
      featured: restaurant.featured,
      phone: restaurant.phone,
      totalSeats: restaurant.totalSeats,
      availableSeats: restaurant.availableSeats,
      managerID: restaurant.managerID,
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
  if (updates.priceRange !== undefined) payload.priceRange = updates.priceRange;
  if (updates.rating !== undefined) payload.rating = updates.rating;
  if (updates.reviewCount !== undefined) payload.reviewCount = updates.reviewCount;
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

// ─── Statistics ───────────────────────────────────────────

export const fetchManagerStats = async (restaurantId: string): Promise<ManagerStats> => {
  return request<ManagerStats>(`/api/stats/manager/${restaurantId}`);
};

export const fetchAdminStats = async (): Promise<AdminStats> => {
  return request<AdminStats>('/api/stats/admin');
};

// ─── Search ───────────────────────────────────────────────

export const searchRestaurants = async (query: string): Promise<Restaurant[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }
  const params = new URLSearchParams({ q: query });
  const data = await request<any[]>(`/api/search-restaurants/?${params.toString()}`);
  return data.map(mapRestaurant);
};

// ─── Image Upload ─────────────────────────────────────────

export const uploadImage = async (file: File): Promise<{ url: string; filename: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/api/upload-image/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  
  const data = await res.json();
  return {
    url: data.url,
    filename: data.filename,
  };
};

// ─── Default export (backward-compatible) ─────────────────

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
  uploadImage,
  searchRestaurants,
};

export default api;