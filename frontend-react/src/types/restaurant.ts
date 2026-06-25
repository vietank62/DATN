export interface RestaurantCard {
    id: number;
    name: string;
    city: string;
    district: string;
    address: string;
    image_url?: string[] | null;
    rating?: number | null;
    like_count?: number | null;
    review_count?: number | null;
    created_at: string;
    has_exclusive?: boolean | null;
};