import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import type { RestaurantCard } from "../../types/restaurant";

const BASE_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";

interface FilterState {
    search: string;
    category: string;
    district: string;
    rating: string;
    has_exclusive: boolean;
    sort_by: string;
}

const fetchFilteredRestaurants = async (filters: FilterState): Promise<RestaurantCard[]> => {
    const params = new URLSearchParams();

    if (filters.search.trim()) params.append("search", filters.search.trim());
    if (filters.category) params.append("category", filters.category);
    if (filters.district) params.append("district", filters.district);
    if (filters.rating) params.append("rating", filters.rating);
    if (filters.has_exclusive) params.append("has_exclusive", "true");
    if (filters.sort_by) params.append("sort_by", filters.sort_by);
    
    params.append("limit", "24");

    const { data } = await axios.get<RestaurantCard[]>(`${BASE_URL}?${params.toString()}`);
    return data;
};

export const SearchRestaurants = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters: FilterState = {
        search: searchParams.get("search") || "",
        category: searchParams.get("category") || "",
        district: searchParams.get("district") || "",
        rating: searchParams.get("rating") || "",
        has_exclusive: searchParams.get("has_exclusive") === "true",
        sort_by: searchParams.get("sort_by") || "",
    };

    const [tempFilters, setTempFilters] = useState<FilterState>({ ...filters });
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: restaurants, isLoading, isError } = useQuery<RestaurantCard[]>({
        queryKey: ["filtered-restaurants", filters],
        queryFn: () => fetchFilteredRestaurants(filters),
    });

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newParams = new URLSearchParams(searchParams);
        if (filters.search.trim()) {
            newParams.set("search", filters.search.trim());
        } else {
            newParams.delete("search");
        }
        setSearchParams(newParams);
    };

    const handleApplyModalFilters = () => {
        setIsModalOpen(false);

        const newParams = new URLSearchParams();
        if (tempFilters.search) newParams.set("search", tempFilters.search);
        if (tempFilters.category) newParams.set("category", tempFilters.category);
        if (tempFilters.district) newParams.set("district", tempFilters.district);
        if (tempFilters.rating) newParams.set("rating", tempFilters.rating);
        if (tempFilters.has_exclusive) newParams.set("has_exclusive", "true");
        if (tempFilters.sort_by) newParams.set("sort_by", tempFilters.sort_by);
        
        setSearchParams(newParams);
    };

    const handleClearCategoryFilter = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("category");
        setSearchParams(newParams);
    };

    return (
        <div className="w-full bg-slate-50 min-h-screen py-8 px-4">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">
                <div className="w-full bg-white rounded-lg p-4 shadow-xs border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-xl flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Tìm kiếm nhà hàng, món ăn, địa điểm..."
                            value={filters.search} 
                            onChange={(e) => {
                                const newParams = new URLSearchParams(searchParams);
                                newParams.set("search", e.target.value);
                                setSearchParams(newParams, { replace: true });
                            }}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-500 font-medium bg-slate-50"
                        />
                        <button type="submit" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
                            Tìm kiếm
                        </button>
                    </form>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            onClick={() => { 
                                setTempFilters({ ...filters }); 
                                setIsModalOpen(true); 
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-gray-600 shadow-2xs cursor-pointer transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                            </svg>
                            Bộ lọc nâng cao
                        </button>
                    </div>
                </div>
                {filters.category && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                        <span>Đang lọc theo:</span>
                        <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full flex items-center gap-1.5">
                            Danh mục: {filters.category}
                            <button onClick={handleClearCategoryFilter} className="hover:text-red-800 cursor-pointer transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </span>
                    </div>
                )}
                {isLoading ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-gray-400">Đang tìm kiếm nhà hàng phù hợp...</p>
                    </div>
                ) : isError ? (
                    <div className="w-full py-16 bg-white rounded-lg text-center border border-gray-100">
                        <p className="text-sm font-bold text-red-500">Đã xảy ra lỗi kết nối khi tải danh sách. Vui lòng thử lại sau.</p>
                    </div>
                ) : restaurants && restaurants.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {restaurants.map((restaurant) => (
                            <div
                                key={restaurant.id}
                                onClick={() => window.location.href = `/restaurant/${restaurant.id}`}
                                className="bg-white rounded-lg overflow-hidden border border-gray-100 shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col group"
                            >
                                <div className="group  overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                    <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-sans px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">Ưu đãi</span>
                                            <img src={restaurant.image_url} alt={restaurant.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={restaurant.name}>
                                                {restaurant.name}
                                            </h3>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center text-xs md:text-sm font-medium text-amber-500 whitespace-nowrap">
                                                <span className="mr-1">⭐</span>
                                                <span>{restaurant.rating || "0"}</span>
                                                <span className="text-gray-400 font-normal ml-1.5">
                                                    ({restaurant.like_count || 0} lượt thích)
                                                </span>
                                            </div>
                                            <div className="flex items-center text-xs text-gray-600 min-w-0 gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-4">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                                </svg>
                                                <span className="truncate">
                                                    <span className="font-semibold text-gray-700">{restaurant.district}</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center text-xs text-gray-600 min-w-0 gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 shrink-0">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                                                </svg>
                                                <span className="truncate">
                                                    <span className="text-gray-500">{restaurant.address}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full py-24 bg-white rounded-lg border border-gray-100 text-center flex flex-col items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                        </svg>
                        <h4 className="text-sm font-bold text-gray-700">Không tìm thấy kết quả phù hợp</h4>
                        <p className="text-xs text-gray-400 font-medium">Vui lòng thử tìm kiếm lại bằng từ khóa hoặc danh mục khác.</p>
                    </div>
                )}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
                        <div className="bg-white rounded-lg w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 text-sm">Bộ lọc nâng cao</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Chọn khu vực Quận/Huyện:</label>
                                    <select
                                        value={tempFilters.district}
                                        onChange={(e) => setTempFilters(p => ({ ...p, district: e.target.value }))}
                                        className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                                    >
                                        <option value="">Tất cả khu vực</option>
                                        <option value="Quan 1">Quận 1</option>
                                        <option value="Quan 3">Quận 3</option>
                                        <option value="Quan 7">Quận 7</option>
                                        <option value="Binh Thanh">Bình Thạnh</option>
                                        <option value="Cau Giay">Cầu Giấy</option>
                                        <option value="Ba Dinh">Ba Đình</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Chọn Danh mục món ăn:</label>
                                    <select
                                        value={tempFilters.category}
                                        onChange={(e) => setTempFilters(p => ({ ...p, category: e.target.value }))}
                                        className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                                    >
                                        <option value="">Tất cả danh mục</option>
                                        <option value="Lẩu">Lẩu</option>
                                        <option value="Nướng">Nướng</option>
                                        <option value="Buffet">Buffet</option>
                                        <option value="Hải sản">Hải sản</option>
                                        <option value="Món Nhật">Món Nhật</option>
                                        <option value="Món Chay">Món chay</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Sắp xếp hiển thị theo:</label>
                                    <select
                                        value={tempFilters.sort_by}
                                        onChange={(e) => setTempFilters(p => ({ ...p, sort_by: e.target.value }))}
                                        className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                                    >
                                        <option value="">Mặc định</option>
                                        <option value="rating">Đánh giá cao nhất ⭐</option>
                                        <option value="like_count">Yêu thích nhiều nhất ❤️</option>
                                        <option value="created_at">Quán mới cập nhật 🆕</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={tempFilters.has_exclusive}
                                            onChange={(e) => setTempFilters(p => ({ ...p, has_exclusive: e.target.checked }))}
                                            className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">Chỉ hiển thị quán có ưu đãi đặc biệt</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 p-4 bg-slate-50">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-gray-500 cursor-pointer transition-colors">Hủy bỏ</button>
                                <button onClick={handleApplyModalFilters} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors">Áp dụng bộ lọc</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};