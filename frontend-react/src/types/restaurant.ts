export interface RestaurantCard {
    id: number;
    name: string;
    city: string;
    district: string;
    address: string;
    image_url?: string;
    website_url?: string;
    price_avg?: number;
    rating?: number | null;
    like_count?: number | null;
    review_count?: number | null;
    category?: string[] | null;
    suitable_for?: string[] | null;
    service_types?: string[] | null;
    capacity?: number;
    booking_opening_time?: string | null;
    booking_closing_time?: string | null;
    created_at: string;
    has_exclusive?: boolean | null;
    is_favorite?: boolean | null; 
}
