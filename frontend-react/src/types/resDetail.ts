export interface ResDetail {
    name: string;
    image_urls: string[]; 
    image_menu: string[];
    phone_number: string;
    price_range: string;  
    opening_time: string;   
    description?: string;
    parking_info?: string;
    utilities?: number[];
    regulations?: string;
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
