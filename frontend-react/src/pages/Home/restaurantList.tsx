import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css/core";
import { Splide as SplideType } from "@splidejs/splide";
import type { RestaurantCard } from "../../types/restaurant";
import { useNavigate } from "react-router-dom";
import { useLocation } from "../../hooks/useLocation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";

const BASE_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";

const fetchRestaurants = async (queryString: string): Promise<RestaurantCard[]> => {
    const { data } = await api.get<RestaurantCard[]>(`${BASE_URL}${queryString}`);
    return data;
};

const getCardImageUrl = (url?: string | null): string => {
    if (!url) {
        return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800";
    }

    if (!url.includes("res.cloudinary.com")) {
        return url;
    }

    return url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
};

export const Home = () => {
    const navigate = useNavigate();
    const { city } = useLocation(); 
    const recommendedRef = useRef<SplideType>(null);
    const hotDealsRef = useRef<SplideType>(null);
    const topRatedRef = useRef<SplideType>(null);
    const newArrivalsRef = useRef<SplideType>(null);

    const [recArrows, setRecArrows] = useState({ prev: false, next: true });
    const [dealsArrows, setDealsArrows] = useState({ prev: false, next: true });
    const [ratedArrows, setRatedArrows] = useState({ prev: false, next: true });
    const [newArrows, setNewArrows] = useState({ prev: false, next: true });

    const queryConfig = {
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    };

    const { data: recommendedData, isLoading: loadRec } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "like_count", limit: 8, city }],
        queryFn: () => fetchRestaurants(`?sort_by=like_count&limit=8&city=${city}`),
        ...queryConfig,
    });

    const { data: hotDealsData, isLoading: loadDeals } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { has_exclusive: true, limit: 8, city }],
        queryFn: () => fetchRestaurants(`?has_exclusive=true&limit=8&city=${city}`),
        ...queryConfig,
    });

    const { data: topRatedData, isLoading: loadRated } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "rating", limit: 8, city }],
        queryFn: () => fetchRestaurants(`?sort_by=rating&limit=8&city=${city}`),
        ...queryConfig,
    });

    const { data: newArrivalsData, isLoading: loadNew } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "created_at", limit: 8, city }],
        queryFn: () => fetchRestaurants(`?sort_by=created_at&limit=8&city=${city}`),
        ...queryConfig,
    });

    const splideOptions = {
        perPage: 4,
        gap: "1.25rem",
        arrows: false,
        pagination: false,
        rewind: false, 
        updateOnMove: true,
        breakpoints: {
            1024: { perPage: 3 },
            768: { perPage: 2 },
            640: { perPage: 1 },
        },
    };

    type ArrowState = { prev: boolean; next: boolean };
    const handleNavigationVisibility = (
        splide: SplideType,
        setArrows: (state: ArrowState) => void,
    ): void => {
        const { index, Components } = splide;
        const maxIndex = Components.Controller.getEnd(); 
        setArrows({
            prev: index > 0,
            next: index < maxIndex,
        });
    };

    const navBtnClass =
        "absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white rounded-full border border-gray-200 shadow-md text-gray-700 hover:border-red-500 hover:text-red-600 transition-all duration-200 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

    const renderSkeleton = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 w-full">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-4 animate-pulse">
                    <div className="w-full pt-[65%] bg-gray-200 rounded-xl" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
            ))}
        </div>
    );

    const queryClient = useQueryClient();
    const toggleFavoriteMutation = useMutation({
        mutationFn: async (restaurantId: number) => {
            const { data } = await api.post<{ action: "added" | "removed"; like_count: number }>(
                "/v1/favorites/toggle",
                { restaurantId }
            );
            return data;
        },
        onMutate: async (restaurantId: number) => {
            await queryClient.cancelQueries({ queryKey: ["restaurants"] });
            const previousQueries = queryClient.getQueriesData<{ id: number; is_favorite: boolean }[]>({ 
                queryKey: ["restaurants"] 
            });
            queryClient.setQueriesData<RestaurantCard[]>({ queryKey: ["restaurants"] }, (oldData) => {
                if (!oldData) return [];
                return oldData.map((res) => 
                    res.id === restaurantId ? { ...res, is_favorite: !res.is_favorite } : res
                );
            });
            return { previousQueries };
        },
        onSuccess: (result, restaurantId) => {
            const isFavorite = result.action === "added";
            queryClient.setQueriesData<RestaurantCard[]>({ queryKey: ["restaurants"] }, (oldData) => {
                if (!oldData) return oldData;
                return oldData.map((res) =>
                    res.id === restaurantId
                        ? { ...res, is_favorite: isFavorite, like_count: result.like_count }
                        : res
                );
            });
        },
        onError: (error: unknown, _restaurantId, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, oldData]) => {
                    queryClient.setQueryData(queryKey, oldData);
                });
            }

            const axiosError = error as { response?: { data?: unknown; status?: number } };
            console.error("Favorite Error Details:", axiosError.response?.data);
            
            if (axiosError.response?.status === 401) {
                toast.error("Vui lòng đăng nhập để thực hiện chức năng này.");
            } else {
                toast.error("Có lỗi xảy ra, vui lòng thử lại sau.");
            }
        },
    });

    const renderFavoriteButton = (restaurant: RestaurantCard) => (
        <button
            type="button"
            disabled={toggleFavoriteMutation.isPending}
            onClick={(event) => {
                event.stopPropagation();
                toggleFavoriteMutation.mutate(restaurant.id);
            }}
            aria-label={restaurant.is_favorite ? "Hủy yêu thích" : "Yêu thích"}
            className={`absolute top-3 right-3 z-20 p-2 backdrop-blur-sm rounded-full shadow-md transition-all duration-200 group/heart cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                restaurant.is_favorite
                    ? "bg-red-50 text-red-500"
                    : "bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white"
            }`}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill={restaurant.is_favorite ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5 transition-transform group-hover/heart:scale-110"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                />
            </svg>
        </button>
    );

    return (
        <div className="w-full bg-slate-50 min-h-screen py-10 flex justify-center">
            <div className="max-w-7xl w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-12">

                {/* Section 1: Đề xuất */}
                <div>
                    <div className="flex justify-between items-end mb-6">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Table Now đề xuất cho bạn</h2>
                            <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng được yêu thích nhất</p>
                        </div>
                        <a href="/all-deals" className="text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">Xem tất cả &rarr;</a>
                    </div>
                    {loadRec ? renderSkeleton() : recommendedData && recommendedData.length > 0 && (
                        <div className="relative">
                            <button className={`${navBtnClass} -left-4`} onClick={() => recommendedRef.current?.go("<")} disabled={!recArrows.prev}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-all rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => recommendedRef.current?.go(">")} disabled={!recArrows.next}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <Splide 
                                ref={recommendedRef} 
                                options={splideOptions}
                                onMoved={(splide: SplideType) => handleNavigationVisibility(splide, setRecArrows)}
                                onMounted={(splide: SplideType) => handleNavigationVisibility(splide, setRecArrows)}
                            >
                                {recommendedData.map((res) => (
                                    <SplideSlide key={res.id}>
                                        <div onClick={() => navigate(`/restaurant/${res.id}`)} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                            <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                                <span className="promo-badge absolute top-3 left-3 text-[10px] font-sans px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">
                                                    Được đề xuất
                                                </span>
                                                <button
                                                    disabled={toggleFavoriteMutation.isPending}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Ngăn chặn chuyển hướng trang
                                                        toggleFavoriteMutation.mutate(res.id);
                                                    }}
                                                    className={`absolute top-3 right-3 z-20 p-2 backdrop-blur-sm rounded-full shadow-md transition-all duration-200 group/heart cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        res.is_favorite 
                                                            ? "bg-red-50 text-red-500" // Class khi ĐÃ YÊU THÍCH
                                                            : "bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white" // Class khi CHƯA YÊU THÍCH
                                                    }`}
                                                >
                                                    <svg 
                                                        xmlns="http://www.w3.org/2000/svg" 
                                                        fill={res.is_favorite ? "currentColor" : "none"} 
                                                        viewBox="0 0 24 24" 
                                                        strokeWidth={2} 
                                                        stroke="currentColor" 
                                                        className="w-5 h-5 transition-transform group-hover/heart:scale-110"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                                                    </svg>
                                                </button>

                                                <img 
                                                    src={getCardImageUrl(res.image_url)} 
                                                    alt={res.name} 
                                                    loading="lazy"
                                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={res.name}>
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
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>

                {/* Section 2: Ưu đãi Hot */}
                <div>
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Top Nhà hàng có ưu đãi Hot</h2>
                            <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng đang có ưu đãi hấp dẫn ngay</p>
                        </div>
                        <a href="/all-deals" className="text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">Xem tất cả &rarr;</a>
                    </div>
                    {loadDeals ? renderSkeleton() : hotDealsData && hotDealsData.length > 0 && (
                        <div className="relative">
                            <button className={`${navBtnClass} -left-4`} onClick={() => hotDealsRef.current?.go("<")} disabled={!dealsArrows.prev}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-all rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => hotDealsRef.current?.go(">")} disabled={!dealsArrows.next}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <Splide 
                                ref={hotDealsRef} 
                                options={splideOptions}
                                onMoved={(splide: SplideType) => handleNavigationVisibility(splide, setDealsArrows)}
                                onMounted={(splide: SplideType) => handleNavigationVisibility(splide, setDealsArrows)}
                            >
                                {hotDealsData.map((res) => (
                                    <SplideSlide key={res.id}>
                                        <div
                                            onClick={() => navigate(`/restaurant/${res.id}`)}
                                            className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer"
                                        >
                                            <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                                <span className="promo-badge absolute top-3 left-3 text-[10px] font-sans px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">Ưu đãi</span>
                                                {renderFavoriteButton(res)}
                                                <img src={getCardImageUrl(res.image_url)} alt={res.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={res.name}>
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
                                                            <span className="font-semibold text-gray-700">{res.district}</span>
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
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>

                {/* Section 3: Top Nhà hàng được đánh giá tốt */}
                <div>
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Top Nhà hàng được đánh giá tốt</h2>
                            <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng có đánh giá cao từ khách hàng</p>
                        </div>
                        <a href="/all-deals" className="text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">Xem tất cả &rarr;</a>
                    </div>
                    {loadRated ? renderSkeleton() : topRatedData && topRatedData.length > 0 && (
                        <div className="relative">
                            <button className={`${navBtnClass} -left-4`} onClick={() => topRatedRef.current?.go("<")} disabled={!ratedArrows.prev}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-all rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => topRatedRef.current?.go(">")} disabled={!ratedArrows.next}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <Splide 
                                ref={topRatedRef} 
                                options={splideOptions}
                                onMoved={(splide: SplideType) => handleNavigationVisibility(splide, setRatedArrows)}
                                onMounted={(splide: SplideType) => handleNavigationVisibility(splide, setRatedArrows)}
                            >
                                {topRatedData.map((res) => (
                                    <SplideSlide key={res.id}>
                                        <div
                                            onClick={() => navigate(`/restaurant/${res.id}`)}
                                            className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer"
                                        >
                                            <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                                <span className="promo-badge absolute top-3 left-3 text-[10px] font-sans px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">Đánh giá tốt</span>
                                                {renderFavoriteButton(res)}
                                                <img src={getCardImageUrl(res.image_url)} alt={res.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={res.name}>
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
                                                            <span className="font-semibold text-gray-700">{res.district}</span>
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
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>

                {/* Section 4: Nhà hàng mới gia nhập */}
                <div>
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Nhà hàng mới gia nhập Table Now</h2>
                            <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng mới nhất vừa gia nhập hệ thống</p>
                        </div>
                        <a href="/all-deals" className="text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">Xem tất cả &rarr;</a>
                    </div>
                    {loadNew ? renderSkeleton() : newArrivalsData && newArrivalsData.length > 0 && (
                        <div className="relative">
                            <button className={`${navBtnClass} -left-4`} onClick={() => newArrivalsRef.current?.go("<")} disabled={!newArrows.prev}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-all rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => newArrivalsRef.current?.go(">")} disabled={!newArrows.next}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <Splide 
                                ref={newArrivalsRef} 
                                options={splideOptions}
                                onMoved={(splide: SplideType) => handleNavigationVisibility(splide, setNewArrows)}
                                onMounted={(splide: SplideType) => handleNavigationVisibility(splide, setNewArrows)}
                            >
                                {newArrivalsData.map((res) => (
                                    <SplideSlide key={res.id}>
                                        <div
                                            onClick={() => navigate(`/restaurant/${res.id}`)}
                                            className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer"
                                        >
                                            <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                                <span className="promo-badge absolute top-3 left-3 text-[10px] font-sans px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">Mới</span>
                                                {renderFavoriteButton(res)}
                                                <img src={getCardImageUrl(res.image_url)} alt={res.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between flex-1 bg-white">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm md:text-base truncate group-hover:text-red-600 transition-colors" title={res.name}>
                                                        {res.name}
                                                    </h3>
                                                </div>
                                                <div className="mt-3 space-y-2">
                                                    <div className="flex items-center text-xs md:text-sm font-medium text-amber-500 whitespace-nowrap">
                                                        <span className="mr-1">⭐</span>
                                                        <span>{res.rating}</span>
                                                        <span className="text-gray-400 font-normal ml-1.5">
                                                            ({res.like_count} lượt thích)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center text-xs text-gray-600 min-w-0 gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-4">
                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                                        </svg>
                                                        <span className="truncate">
                                                            <span className="font-semibold text-gray-700">{res.district}</span>
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
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm relative overflow-hidden flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Table Now đề xuất cho riêng bạn</h2>
                        <p className="text-sm text-gray-400 mt-1">Những địa điểm có thể bạn sẽ thích</p>
                    </div>
                    <div className="relative py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 opacity-25 select-none pointer-events-none">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col gap-4 h-48 relative">
                                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                        <span className="text-xs text-gray-300">❤️</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
                            <h3 className="text-base md:text-lg font-bold text-gray-900 max-w-xl leading-snug">
                                Table Now sẽ giới thiệu các quán phù hợp với tiêu chí của bạn
                            </h3>
                            <p className="text-xs md:text-sm text-gray-500 mt-2 max-w-xl font-medium">
                                Please tell us what kind is your favorite food and what price range you prefer
                            </p>
                        </div>
                    </div>
                    <div className="w-full">
                        <button className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors duration-200 text-sm shadow-md cursor-pointer">
                            Chọn khẩu vị của bạn
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
