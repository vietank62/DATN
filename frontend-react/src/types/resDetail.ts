export interface ResDetail {
  name: string;
  image_urls: string[];
  image_menu: string[];
  phone_number: string;
  price_range: string;
  opening_time?: string[] | string | null;
  description?: string;
  parking_info?: string;
  utilities?: number[];
  regulations?: string;
  requires_deposit?: boolean;
  deposit_amount?: number;
  deposit_min_guests?: number;
}

export interface RestaurantMenuItem {
  id: number;
  restaurant_id: number;
  name: string;
  category: string;
  price: number;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
}
