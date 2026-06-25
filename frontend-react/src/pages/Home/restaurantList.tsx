import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css/core";
import { Splide as SplideType } from "@splidejs/splide";
import axios from "axios";
import type { RestaurantCard } from "../../types/restaurant";

const BASE_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants";

const fetchRestaurants = async (queryString: string): Promise<RestaurantCard[]> => {
    const { data } = await axios.get<RestaurantCard[]>(`${BASE_URL}${queryString}`);
    return data;
};

export const Home = () => {
    const recommendedRef = useRef<SplideType>(null);
    const hotDealsRef = useRef<SplideType>(null);
    const topRatedRef = useRef<SplideType>(null);
    const newArrivalsRef = useRef<SplideType>(null);

    // Cấu hình đồng bộ thời gian Cache: staleTime (3p) và gcTime (5p) trùng khớp với Backend TTL
    const queryConfig = {
        staleTime: 1000 * 60 * 3,
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    };

    const { data: recommendedData, isLoading: loadRec } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "like_count", limit: 8 }],
        queryFn: () => fetchRestaurants("?sort_by=like_count&limit=8"),
        ...queryConfig,
    });

    const { data: hotDealsData, isLoading: loadDeals } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { has_exclusive: true, limit: 8 }],
        queryFn: () => fetchRestaurants("?has_exclusive=true&limit=8"),
        ...queryConfig,
    });

    const { data: topRatedData, isLoading: loadRated } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "rating", limit: 8 }],
        queryFn: () => fetchRestaurants("?sort_by=rating&limit=8"),
        ...queryConfig,
    });

    const { data: newArrivalsData, isLoading: loadNew } = useQuery<RestaurantCard[]>({
        queryKey: ["restaurants", { sort_by: "created_at", limit: 8 }],
        queryFn: () => fetchRestaurants("?sort_by=created_at&limit=8"),
        ...queryConfig,
    });

    const splideOptions = {
        perPage: 4,
        gap: "1.25rem",
        arrows: false,
        pagination: false,
        breakpoints: {
            1024: { perPage: 3 },
            768: { perPage: 2 },
            640: { perPage: 1 },
        },
    };

    const navBtnClass =
        "absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white rounded-full border border-gray-200 shadow-md text-gray-700 hover:border-red-500 hover:text-red-600 transition-all duration-200 cursor-pointer";

    const getImageUrl = (urlSource: string | string[] | null | undefined): string => {
        if (Array.isArray(urlSource)) return urlSource[0] || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500";
        return urlSource || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500";
    };

    // FIX VẤN ĐỀ 2 & 3: Tạo một khối Skeleton Loading nhỏ đại diện thay vì chặn toàn màn hình
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

    return (
        <div className="w-full bg-slate-50 min-h-screen py-10 flex justify-center">
            <div className="max-w-7xl w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-12">

                {/* Section 1: Đề xuất */}
                <div>
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Table Now đề xuất cho bạn</h2>
                        <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng được yêu thích nhất</p>
                    </div>
                    {loadRec ? renderSkeleton() : recommendedData && recommendedData.length > 0 && (
                        <div className="relative">
                            <button className={`${navBtnClass} -left-4`} onClick={() => recommendedRef.current?.go("<")}>&larr;</button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => recommendedRef.current?.go(">")}>&rarr;</button>
                            <Splide ref={recommendedRef} options={splideOptions}>
                                {recommendedData.map((res) => (
                                    <SplideSlide key={res.id}>
                                        <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                            <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                                <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">Được đề xuất</span>
                                                <img src={getImageUrl(res.image_url)} alt={res.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between bg-white">
                                                <h3 className="font-bold text-gray-800 text-sm md:text-base line-clamp-2 leading-snug group-hover:text-red-600 transition-colors">{res.name}</h3>
                                                <p className="text-xs text-amber-500 font-medium mt-2">⭐ {res.rating} <span className="text-gray-400">({res.like_count} lượt thích)</span></p>
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
                            <button className={`${navBtnClass} -left-4`} onClick={() => hotDealsRef.current?.go("<")}>&larr;</button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => hotDealsRef.current?.go(">")}>&rarr;</button>
                            <Splide ref={hotDealsRef} options={splideOptions}>
                                {hotDealsData.map((item) => (
                                    <SplideSlide key={item.id}>
                                        <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-300 flex flex-col h-full">
                                            <div className="relative pt-[65%] overflow-hidden bg-gray-100">
                                                <div className="absolute top-3 left-3 z-10">
                                                    <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow uppercase tracking-wider">Ưu đãi Hot</span>
                                                </div>
                                                <img src={getImageUrl(item.image_url)} alt={item.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between gap-4 bg-white flex-1">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm line-clamp-2 group-hover:text-red-600 transition-colors cursor-pointer">{item.name}</h3>
                                                    <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
                                                        
                                                    </div>
                                                </div>
                                                <button className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer">Chọn & Đặt chỗ</button>
                                            </div>
                                        </div>
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>
                {/* Section 3: Top Nhà hàng được đánh giá tốt (Sort theo rating) */}
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
                            <button className={`${navBtnClass} -left-4`} onClick={() => topRatedRef.current?.go("<")}>&larr;</button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => topRatedRef.current?.go(">")}>&rarr;</button>

                            <Splide ref={topRatedRef} options={splideOptions}>
                                {topRatedData.map((item) => (
                                    <SplideSlide key={item.id}>
                                        <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                            <div className="relative pt-[65%] overflow-hidden bg-gray-100">
                                                <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow z-10 uppercase">Top Đánh Giá</span>
                                                <img src={getImageUrl(item.image_url)} alt={item.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between gap-4 bg-white flex-1">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                                                    <p className="text-sm text-amber-500 font-black mt-2">⭐ {item.rating?.toFixed(1) || "5.0"} / 5.0 <span className="text-gray-400 font-normal text-xs">({item.review_count || 0} bài đánh giá)</span></p>
                                                </div>
                                                <button className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer">Chọn & Đặt chỗ</button>
                                            </div>
                                        </div>
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>

                {/* Section 4: Nhà hàng mới gia nhập Table Now (Sort theo created_at) */}
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
                            <button className={`${navBtnClass} -left-4`} onClick={() => newArrivalsRef.current?.go("<")}>&larr;</button>
                            <button className={`${navBtnClass} -right-4`} onClick={() => newArrivalsRef.current?.go(">")}>&rarr;</button>

                            <Splide ref={newArrivalsRef} options={splideOptions}>
                                {newArrivalsData.map((item) => (
                                    <SplideSlide key={item.id}>
                                        <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                            <div className="relative pt-[65%] overflow-hidden bg-gray-100">
                                                <span className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow z-10 uppercase">Mới Nhất</span>
                                                <img src={getImageUrl(item.image_url)} alt={item.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="p-4 flex flex-col justify-between gap-4 bg-white flex-1">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h3>
                                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                        📅 Gia nhập: {item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN") : "Vừa xong"}
                                                    </p>
                                                </div>
                                                <button className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-red-700 active:scale-[0.97] transition-all cursor-pointer">Chọn & Đặt chỗ</button>
                                            </div>
                                        </div>
                                    </SplideSlide>
                                ))}
                            </Splide>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};