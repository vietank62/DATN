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
}
