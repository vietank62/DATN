import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom"; 
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RestaurantCard } from "../../types/restaurant";
import { useLocation } from "../../hooks/useLocation";
import { api } from "../../services/api";
import { getCategoryLabel, RESTAURANT_CATEGORIES } from "../../utils/category";

const BASE_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";

const fetchFilteredRestaurants = async (searchParams: URLSearchParams): Promise<RestaurantCard[]> => {
    const params = new URLSearchParams(searchParams);
    
    if (!params.has("limit")) {
        params.append("limit", "20");
    }
    const { data } = await api.get<RestaurantCard[]>(`${BASE_URL}?${params.toString()}`);
    return data;
};

const PRICE_LABELS = ["Dưới 100k", "100k - 200k", "200k - 500k", "500k - 1.000k", "Trên 1.000k"];
const SPACE_LABELS = ["1-5 người", "6-10 người", "11-20 người", "21-50 người", "Trên 50 người"];
const CATEGORIES = RESTAURANT_CATEGORIES.map(({ slug, label: name }) => ({ slug, name }));

const SUITABLE_FOR = [
  { slug: "tiec-hoi-nghi", name: "Tiệc / Hội nghị" }, { slug: "gia-dinh", name: "Gia đình" },
  { slug: "hien-dai", name: "Hiện đại" }, { slug: "truyen-thong", name: "Truyền thống" },
  { slug: "sang-trong", name: "Sang trọng" }, { slug: "co-dien", name: "Cổ điển" },
  { slug: "thien-nhien", name: "Thiên nhiên" }, { slug: "hen-ho", name: "Hẹn hò" },
  { slug: "sinh-nhat", name: "Sinh nhật" }, { slug: "ban-be", name: "Bạn bè" }
];

const SERVICE_TYPES = [
  { slug: "phuc-vu-tai-ban", name: "Phục vụ tại bàn" }, { slug: "tu-phuc-vu", name: "Tự phục vụ" },
  { slug: "quay-line", name: "Quầy line" }, { slug: "bang-chuyen", name: "Băng chuyền" },
  { slug: "omakase", name: "Omakase" }
];

export const SearchRestaurants = () => {
    const { city, getDistricts } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tempFilters, setTempFilters] = useState({
        search: "",
        district: "",
        price: "",
        category: "",
        suitable_for: "",
        service_type: "",
        space_level: "",
        rating: "",
        has_exclusive: false
    });

    useEffect(() => {
        if (city && !searchParams.get("city")) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("city", city);
            setSearchParams(newParams);
        }
    }, [city, searchParams, setSearchParams]);

    const { data: restaurants, isLoading, isFetching } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants-search", searchParams.toString()],
        queryFn: () => fetchFilteredRestaurants(searchParams),
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
    });

    useEffect(() => {
        if (!restaurants || restaurants.length < 20) {
            return;
        }

        const nextPageParams = new URLSearchParams(searchParams);
        nextPageParams.set("limit", "20");
        nextPageParams.set(
            "offset",
            String(Number(nextPageParams.get("offset") ?? "0") + 20),
        );

        void queryClient.prefetchQuery({
            queryKey: ["restaurants-search", nextPageParams.toString()],
            queryFn: () => fetchFilteredRestaurants(nextPageParams),
            staleTime: 1000 * 60 * 2,
        });
    }, [queryClient, restaurants, searchParams]);

    const updateParam = (key: string, value: string | null) => {
        const newParams = new URLSearchParams(searchParams);
        if (value === null || value === "") {
            newParams.delete(key);
        } else {
            newParams.set(key, value);
        }
        setSearchParams(newParams);
    };

    const getImageUrl = (urlSource: string | string[] | null | undefined): string => {
        const url = Array.isArray(urlSource) ? urlSource[0] : urlSource;
        if (!url) return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800";
        return url.includes("res.cloudinary.com")
            ? url.replace("/upload/", "/upload/f_auto,q_auto,w_800/")
            : url;
    };

    const currentCity = searchParams.get("city") || city || "";
    const currentSearch = searchParams.get("search") || "";
    const currentDistrict = searchParams.get("district") || "";
    const currentRating = searchParams.get("rating") || "";
    const currentSortBy = searchParams.get("sort_by") || "like_count";
    const currentHasExclusive = searchParams.get("has_exclusive") === "true";
    const currentPrice = searchParams.get("price") || "";
    const currentCategory = searchParams.get("category") || "";
    const currentSuitableFor = searchParams.get("suitable_for") || "";
    const currentServiceType = searchParams.get("service_type") || "";
    const currentSpaceLevel = searchParams.get("space_level") || "";

    const hasActiveFilters = 
        currentSearch.trim() || 
        currentDistrict || 
        currentRating || 
        currentHasExclusive || 
        currentPrice || 
        currentCategory || 
        currentSuitableFor || 
        currentServiceType || 
        currentSpaceLevel;

    const handleOpenModal = () => {
        setTempFilters({
            search: currentSearch,
            district: currentDistrict,
            price: currentPrice,
            category: currentCategory,
            suitable_for: currentSuitableFor,
            service_type: currentServiceType,
            space_level: currentSpaceLevel,
            rating: currentRating,
            has_exclusive: currentHasExclusive
        });
        setIsModalOpen(true);
    };

    const handleApplyModalFilters = () => {
        const newParams = new URLSearchParams(searchParams);
        
        const filterKeys = Object.keys(tempFilters) as Array<keyof typeof tempFilters>;
        
        filterKeys.forEach((key) => {
            const val = tempFilters[key];
            if (typeof val === "boolean") {
                if (val) newParams.set(key, "true");
                else newParams.delete(key);
            } else {
                if (val && val.trim() !== "")
                     newParams.set(key, val.trim());
                else newParams.delete(key);
            }
        });

        setSearchParams(newParams);
        setIsModalOpen(false);
    };

    return (
        <div className="w-full bg-slate-50 flex justify-center">
            <div className="max-w-7xl w-full flex flex-col m-4 md:mx-10 md:my-6 rounded-lg bg-white shadow-sm border border-gray-100 h-fit">
                <div className="gap-4 p-6 items-center flex justify-between border-b border-gray-50">
                    <div>
                        <div className="font-semibold text-gray-900 text-lg tracking-tight uppercase">
                            KẾT QUẢ TÌM KIẾM TẠI {currentCity}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {isLoading ? "Đang tải dữ liệu..." : `Tìm thấy ${restaurants?.length || 0} nhà hàng`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Sắp xếp:</span>
                        <select
                            value={currentSortBy}
                            onChange={(e) => updateParam("sort_by", e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                        >
                            <option value="like_count">Yêu thích nhất</option>
                            <option value="rating">Đánh giá cao nhất</option>
                            <option value="created_at">Mới gia nhập</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 px-6 py-4 items-center bg-slate-50/50 border-b border-gray-50 min-h-15">
                    <span className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap mr-2">Bộ lọc:</span>
                    
                    {!hasActiveFilters && (
                        <span className="text-xs text-gray-400 italic">Chưa áp dụng bộ lọc nào (Đang hiển thị toàn bộ {currentCity})</span>
                    )}

                    {currentSearch.trim() && (
                        <div className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Từ khóa: "{currentSearch}"</span>
                            <button onClick={() => updateParam("search", null)} className="hover:bg-red-200/60 p-0.5 rounded-full text-red-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentDistrict && (
                        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Khu vực: {currentDistrict}</span>
                            <button onClick={() => updateParam("district", null)} className="hover:bg-blue-200/60 p-0.5 rounded-full text-blue-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentPrice && (
                        <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Mức giá: {PRICE_LABELS[Number(currentPrice) - 1] || `Mức ${currentPrice}`}</span>
                            <button onClick={() => updateParam("price", null)} className="hover:bg-orange-200/60 p-0.5 rounded-full text-orange-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentCategory && (
                        <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Danh mục: {getCategoryLabel(currentCategory)}</span>
                            <button onClick={() => updateParam("category", null)} className="hover:bg-purple-200/60 p-0.5 rounded-full text-purple-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentSuitableFor && (
                        <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Phù hợp: {currentSuitableFor}</span>
                            <button onClick={() => updateParam("suitable_for", null)} className="hover:bg-indigo-200/60 p-0.5 rounded-full text-indigo-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentServiceType && (
                        <div className="flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Kiểu phục vụ: {currentServiceType}</span>
                            <button onClick={() => updateParam("service_type", null)} className="hover:bg-teal-200/60 p-0.5 rounded-full text-teal-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentSpaceLevel && (
                        <div className="flex items-center gap-1.5 bg-cyan-50 text-cyan-700 border border-cyan-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Sức chứa: {SPACE_LABELS[Number(currentSpaceLevel) - 1] || `Mức ${currentSpaceLevel}`}</span>
                            <button onClick={() => updateParam("space_level", null)} className="hover:bg-cyan-200/60 p-0.5 rounded-full text-cyan-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentRating && (
                        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Đánh giá: ⭐ {currentRating}+</span>
                            <button onClick={() => updateParam("rating", null)} className="hover:bg-amber-200/60 p-0.5 rounded-full text-amber-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}

                    {currentHasExclusive && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-lg text-xs font-medium">
                            <span>Có ưu đãi đặc biệt</span>
                            <button onClick={() => updateParam("has_exclusive", null)} className="hover:bg-emerald-200/60 p-0.5 rounded-full text-emerald-500 font-semibold text-sm leading-none cursor-pointer">&times;</button>
                        </div>
                    )}
                    <button 
                        onClick={handleOpenModal}
                        className="ml-auto flex items-center gap-1.5 bg-white border border-gray-300 hover:border-red-500 hover:text-red-600 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                    </svg>
                    Chỉnh sửa bộ lọc
                    </button>
                </div>

                <div className="p-6">
                    {isLoading || isFetching ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 w-full">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-4 animate-pulse">
                                    <div className="w-full pt-[65%] bg-gray-200 rounded-lg" />
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    ) : restaurants && restaurants.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 w-full">
                            {restaurants.map((res) => (
                                <div onClick={() => navigate(`/restaurant/${res.id}`)} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                    <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                        <img src={getImageUrl(res.image_url)} alt={res.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                    <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                        <div>
                                            <h3 className="font-semibold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={res.name}>
                                                {res.name}
                                            </h3>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center text-xs md:text-sm font-medium text-amber-500 whitespace-nowrap">
                                                <span className="mr-1">⭐</span>
                                                <span>{res.rating || "0"}</span>
                                                <span className="text-gray-400 font-normal ml-1.5">
                                                    ({res.like_count || 0} lượt thích)
                                                </span>
                                            </div>
                                            <div className="flex items-center text-xs text-gray-600 min-w-0 gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-4">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                                </svg>
                                                <span className="truncate">
                                                    <span className="text-gray-700 font-semibold">{res.district}</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center text-xs text-gray-600 min-w-0 gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 shrink-0">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                                                </svg>
                                                <span className="truncate">
                                                    <span className="text-gray-500">{res.address}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full py-16 flex flex-col items-center justify-center text-center gap-2 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-4">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            <div className="font-semibold text-gray-700">Không tìm thấy kết quả phù hợp</div>
                            <p className="text-xs max-w-xs">Hãy thử thay đổi tiêu chí hoặc chọn thành phố khác.</p>
                        </div>
                    )}
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-100 flex flex-col gap-5 my-10 max-h-[85vh]">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 shrink-0">
                            <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                            Cấu hình nâng cao bộ lọc tại {currentCity}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold text-xl leading-none p-1 cursor-pointer">&times;</button>
                        </div>

                        <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tên nhà hàng</label>
                                <input
                                    type="text"
                                    placeholder="Nhập từ khóa tìm kiếm..."
                                    value={tempFilters.search}
                                    onChange={(e) => setTempFilters(p => ({ ...p, search: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Khu vực</label>
                                    <select
                                        value={tempFilters.district}
                                        onChange={(e) => setTempFilters(p => ({ ...p, district: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả khu vực</option>
                                        {getDistricts?.().map((d: string) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Giá trung bình</label>
                                    <select
                                        value={tempFilters.price}
                                        onChange={(e) => setTempFilters(p => ({ ...p, price: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả các mức giá</option>
                                        {PRICE_LABELS.map((label, idx) => (
                                            <option key={label} value={(idx + 1).toString()}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Đồ ăn chính</label>
                                    <select
                                        value={tempFilters.category}
                                        onChange={(e) => setTempFilters(p => ({ ...p, category: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả danh mục</option>
                                        {CATEGORIES.map(c => (
                                            <option key={c.slug} value={c.slug}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Phù hợp không gian</label>
                                    <select
                                        value={tempFilters.suitable_for}
                                        onChange={(e) => setTempFilters(p => ({ ...p, suitable_for: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả tiêu chí</option>
                                        {SUITABLE_FOR.map(s => (
                                            <option key={s.slug} value={s.slug}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Kiểu phục vụ</label>
                                    <select
                                        value={tempFilters.service_type}
                                        onChange={(e) => setTempFilters(p => ({ ...p, service_type: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả kiểu phục vụ</option>
                                        {SERVICE_TYPES.map(s => (
                                            <option key={s.slug} value={s.slug}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sức chứa tối thiểu</label>
                                    <select
                                        value={tempFilters.space_level}
                                        onChange={(e) => setTempFilters(p => ({ ...p, space_level: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">Tất cả các mức chỗ</option>
                                        {SPACE_LABELS.map((label, idx) => (
                                            <option key={label} value={(idx + 1).toString()}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Đánh giá tối thiểu</label>
                                <select
                                    value={tempFilters.rating}
                                    onChange={(e) => setTempFilters(p => ({ ...p, rating: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 bg-slate-50 cursor-pointer"
                                >
                                    <option value="">Tất cả mức sao</option>
                                    <option value="4.5">⭐ 4.5 trở lên</option>
                                    <option value="4.0">⭐ 4.0 trở lên</option>
                                    <option value="3.5">⭐ 3.5 trở lên</option>
                                </select>
                            </div>

                            <div className="pt-1">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
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

                        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-gray-500 cursor-pointer">Hủy bỏ</button>
                            <button onClick={handleApplyModalFilters} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer">Áp dụng bộ lọc</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
