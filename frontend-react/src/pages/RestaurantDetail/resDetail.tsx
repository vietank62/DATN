import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { RestaurantCard } from "../../types/restaurant";
import type { ResDetail } from "../../types/resDetail";

const BASE_RESTAURANT_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";
const BASE_DETAIL_URL = import.meta.env.VITE_API_BASE + "/v1/details/";

const UTILITIES_MAP: Record<number, { label: string; icon: string }> = {
    1: { label: "Điều hòa", icon: "❄️" },
    2: { label: "Quầy Line tự chọn", icon: "🍲" },
    3: { label: "Phòng riêng", icon: "🚪" },
    4: { label: "Khu vui chơi trẻ em", icon: "🧸" },
    5: { label: "Thanh toán thẻ / MoMo", icon: "💳" },
    6: { label: "Có chỗ đậu ô tô", icon: "🚗" }
};

export const RestaurantDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [bookingDate, setBookingDate] = useState("2026-06-29");
    const [bookingTime, setBookingTime] = useState("16:15");

    const [activeTab, setActiveTab] = useState("Đề xuất");

    const [activeImgIndex, setActiveImgIndex] = useState(0); 
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0); 

    const { data: restaurantBase, isLoading: isBaseLoading, error: baseError } = useQuery<RestaurantCard>({
        queryKey: ["restaurant-base", id],
        queryFn: async () => {
            const { data } = await axios.get<RestaurantCard>(`${BASE_RESTAURANT_URL}${id}`);
            return data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    const { data: restaurantDetail, isLoading: isDetailLoading, error: detailError } = useQuery<ResDetail>({
        queryKey: ["restaurant-detail", id],
        queryFn: async () => {
            const { data } = await axios.get<ResDetail>(`${BASE_DETAIL_URL}${id}`);
            return data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    if (isBaseLoading || isDetailLoading) {
        return (
            <div className="w-full min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-gray-500 animate-pulse">Đang tải thông tin chi tiết nhà hàng...</p>
                </div>
            </div>
        );
    }

    if (baseError || detailError || !restaurantBase || !restaurantDetail) {
        return (
            <div className="w-full min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
                <p className="text-gray-500 font-bold">Không tìm thấy dữ liệu hoặc liên kết nhà hàng này đã hết hạn.</p>
                <button onClick={() => navigate("/")} className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold transition-transform hover:scale-105">
                    Quay lại trang chủ
                </button>
            </div>
        );
    }

    const albumImages = restaurantDetail.image_urls && restaurantDetail.image_urls.length > 0 
        ? restaurantDetail.image_urls 
        : ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"];

    const sideImages = albumImages.slice(1, 7);

    const handlePrevMainImage = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        setActiveImgIndex((prev) => (prev === 0 ? albumImages.length - 1 : prev - 1));
    };

    const handleNextMainImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveImgIndex((prev) => (prev === albumImages.length - 1 ? 0 : prev + 1));
    };

    const handlePrevLightbox = () => {
        setLightboxIndex((prev) => (prev === 0 ? albumImages.length - 1 : prev - 1));
    };

    const handleNextLightbox = () => {
        setLightboxIndex((prev) => (prev === albumImages.length - 1 ? 0 : prev + 1));
    };

    const openLightboxAt = (index: number) => {
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

    const handleBookingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert(`Đặt chỗ thành công tại ${restaurantBase.name}!`);
    };

    return (
        <div className="w-full bg-slate-100 min-h-screen flex justify-center py-2 px-6">
            <div className="max-w-7xl w-full flex flex-col gap-5">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-2 w-full aspect-21/7 min-h-50 lg:min-h-60">
                    <div 
                        onClick={() => openLightboxAt(activeImgIndex)}
                        className="lg:col-span-4 relative rounded-lg overflow-hidden bg-gray-900 group cursor-zoom-in select-none"
                    >
                        <img 
                            src={albumImages[activeImgIndex]} 
                            alt={`Main view ${activeImgIndex}`} 
                            className="w-full h-full object-cover transition-all duration-500 ease-in-out" 
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button 
                            onClick={handlePrevMainImage}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-red-600 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 cursor-pointer"
                            title="Ảnh trước"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <button 
                            onClick={handleNextMainImage}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-red-600 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 cursor-pointer"
                            title="Ảnh tiếp theo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-bold">
                            {activeImgIndex + 1} / {albumImages.length}
                        </div>
                    </div>
                    <div className="lg:col-span-3 relative rounded-lg overflow-hidden group cursor-zoom-in select-none">
                        <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full">
                            {sideImages.map((img, idx) => {
                                const realIndex = idx + 1; 
                                const isLastGridItem = idx === 5;

                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => openLightboxAt(realIndex)}
                                        className={`relative overflow-hidden bg-gray-200 cursor-zoom-in group rounded-lg ${isLastGridItem ? "col-span-2 row-span-2" : ""}
                                        `}
                                    >
                                        <img 
                                            src={img} 
                                            alt={`sub-gallery-${idx}`} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                        />
                                        {isLastGridItem && (
                                            <div className="absolute inset-0 bg-black/60 hover:bg-black/75 flex flex-col items-center justify-center text-white transition-all text-center p-2 select-none backdrop-blur-xs cursor-pointer">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 mb-1 text-red-400 animate-pulse">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                </svg>
                                                <span className="font-bold text-xs md:text-sm tracking-wide uppercase">Xem tất cả</span>
                                                {albumImages.length > 7 && (
                                                    <span className="text-[11px] font-bold text-gray-300 mt-0.5">(+{albumImages.length - 7} ảnh)</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full items-start">
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col gap-5">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                    {restaurantBase.name}
                                    {restaurantBase.has_exclusive && (
                                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Ưu Đãi Hot</span>
                                    )}
                                </h1>
                                {/* <p className="text-xs text-gray-400 mt-1">Danh mục: {restaurantBase.category}</p> */}
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 border border-gray-100 px-4 py-2 rounded-xl w-fit self-start sm:self-auto shadow-2xs">
                                <div className="text-center border-r border-gray-200 pr-3 flex flex-col items-center">
                                    <div className="text-amber-500 font-bold text-sm flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                                        </svg>
                                        {restaurantBase.rating || "0.0"}
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">Đánh giá</div>
                                </div>
                                <div className="text-center flex flex-col items-center">
                                    <div className="text-red-500 font-bold text-sm flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path d="m11.645 20.91l-.007-.003l-.022-.012a15.247 15.247 0 0 1-.383-.218a25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25C2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052A5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25c0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17a15.247 15.247 0 0 1-.383.219l-.022.012l-.007.004l-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                                        </svg>
                                        {restaurantBase.like_count || 0}
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">Lượt thích</div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3.5 text-sm border-b border-gray-100 pb-5 text-gray-700">
                            <div className="flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 shrink-0 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                </svg>
                                <div>Địa chỉ: <span className="font-semibold text-gray-850">{restaurantBase.address}, {restaurantBase.district}, {restaurantBase.city}</span></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a12.035 12.035 0 0 1-7.108-7.108c-.155-.44.01-1.272.387-1.55l1.293-.97c.361-.271.528-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.75Z" />
                                </svg>
                                <div>Phone: <span className="text-red-600 font-bold tracking-wide">{restaurantDetail.phone_number}</span></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="w-5 h-5 text-gray-400 shrink-0">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                                <div>Khoảng giá trung bình: <span className="font-bold text-emerald-600">{restaurantDetail.price_range} đ/người</span></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                                <div>Giờ hoạt động: <span className="font-semibold text-gray-800">{restaurantDetail.opening_time}</span></div>
                            </div>
                        </div>
                        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none -mx-6 px-6 justify-between">
                            {["Mô tả", "Thực đơn", "Bảng giá", "Tiện ích", "Bãi xe", "Quy định"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-3 px-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                                        activeTab === tab ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="py-2 text-sm text-gray-700 leading-relaxed min-h-40">
                            {activeTab === "Mô tả" && (
                                <div className="whitespace-pre-line text-gray-700 font-medium">
                                    {restaurantDetail.description}
                                </div>
                            )}

                            {activeTab === "Thực đơn" && (
                                <div className="flex flex-col gap-4">
                                    <p className="font-semibold text-gray-900">Hình ảnh thực đơn tham khảo:</p>
                                    {restaurantDetail.image_menu && restaurantDetail.image_menu.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {restaurantDetail.image_menu.map((menuImg, mIdx) => (
                                                <div key={mIdx} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 cursor-zoom-in aspect-3/4">
                                                    <img src={menuImg} alt="Menu Detail" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Nhà hàng chưa tải lên menu.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === "Bảng giá" && (
                                <div className="flex flex-col gap-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-1">
                                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.129-1.125V11.25c0-.442-.4-.754-.83-.658l-1.54.342a1.242 1.242 0 0 1-1.439-.814l-1.904-4.342a1.242 1.242 0 0 0-1.14-.75h-3.75a1.242 1.242 0 0 0-1.14.75L7.74 10.034a1.242 1.242 0 0 1-1.44.814l-1.54-.342A1.125 1.125 0 0 0 3.84 11.25V14.25m12 0c0-1.657-1.343-3-3-3s-3 1.343-3 3m6 0H9" />
                                            </svg>
                                            Thông tin bãi đỗ xe:
                                        </h4>
                                        <p className="text-gray-600 text-xs font-medium">{restaurantDetail.parking_info || "Có chỗ đậu đỗ miễn phí."}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide">Tiện ích sẵn có tại quán:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {restaurantDetail.utilities?.map((utilId) => (
                                                <div key={utilId} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700">
                                                    <span>{UTILITIES_MAP[utilId]?.icon || "🔹"}</span>
                                                    <span>{UTILITIES_MAP[utilId]?.label || "Tiện ích"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === "Tiện ích" && (
                                <div className="flex flex-col gap-2">
                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide">Tiện ích sẵn có tại quán:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {restaurantDetail.utilities?.map((utilId) => (
                                            <div key={utilId} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700">
                                                <span>{UTILITIES_MAP[utilId]?.icon || "🔹"}</span>
                                                <span>{UTILITIES_MAP[utilId]?.label || "Tiện ích"}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTab === "Bãi xe" && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-1">
                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.129-1.125V11.25c0-.442-.4-.754-.83-.658l-1.54.342a1.242 1.242 0 0 1-1.439-.814l-1.904-4.342a1.242 1.242 0 0 0-1.14-.75h-3.75a1.242 1.242 0 0 0-1.14.75L7.74 10.034a1.242 1.242 0 0 1-1.44.814l-1.54-.342A1.125 1.125 0 0 0 3.84 11.25V14.25m12 0c0-1.657-1.343-3-3-3s-3 1.343-3 3m6 0H9" />
                                        </svg>
                                        Thông tin bãi đỗ xe:
                                    </h4>
                                    <p className="text-gray-600 text-xs font-medium">{restaurantDetail.parking_info || "Có chỗ đậu đỗ miễn phí."}</p>
                                </div>
                            )}
                            {activeTab === "Quy định" && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-1">
                                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.129-1.125V11.25c0-.442-.4-.754-.83-.658l-1.54.342a1.242 1.242 0 0 1-1.439-.814l-1.904-4.342a1.242 1.242 0 0 0-1.14-.75h-3.75a1.242 1.242 0 0 0-1.14.75L7.74 10.034a1.242 1.242 0 0 1-1.44.814l-1.54-.342A1.125 1.125 0 0 0 3.84 11.25V14.25m12 0c0-1.657-1.343-3-3-3s-3 1.343-3 3m6 0H9" />
                                        </svg>
                                        Quy định:
                                    </h4>
                                    <p className="text-gray-600 text-xs font-medium">{restaurantDetail.parking_info || "Có chỗ đậu đỗ miễn phí."}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Đặt bàn */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-30">
                        <div className="bg-white p-5 border-b border-gray-100 text-center flex flex-col gap-1">
                            <h3 className="font-bold text-gray-900 text-base">Đặt bàn giữ chỗ</h3>
                            <p className="text-xs text-gray-400">Hoàn toàn miễn phí bàn ăn & nhận điểm</p>
                        </div>
                        <form onSubmit={handleBookingSubmit} className="p-5 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Người lớn:</label>
                                    <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none cursor-pointer">
                                        {[...Array(20)].map((_, i) => <option key={i+1} value={i+1}>{i+1} khách</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Trẻ em:</label>
                                    <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none cursor-pointer">
                                        {[...Array(10)].map((_, i) => <option key={i} value={i}>{i} trẻ em</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500 font-semibold">Thời gian đến</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="date" title="Ngày" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer" />
                                    <input type="time" title="Giờ" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none cursor-pointer" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3.5 rounded-xl shadow-md transition-colors cursor-pointer mt-2">
                                Đặt chỗ ngay
                            </button>
                        </form>
                    </div>

                </div>
            </div>

            {isLightboxOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 select-none animate-fadeIn">
                    <button 
                        onClick={() => setIsLightboxOpen(false)}
                        className="absolute top-30 right-6 text-white/70 hover:text-red-500 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all cursor-pointer"
                        title="Đóng chế độ xem (Esc)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <button 
                        onClick={handlePrevLightbox}
                        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 hover:text-red-500 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Ảnh trước"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <div className="max-w-5xl max-h-[80vh] flex flex-col items-center justify-center relative">
                        <img 
                            src={albumImages[lightboxIndex]} 
                            alt={`Zoomed view ${lightboxIndex}`} 
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-scaleIn"
                        />
                        <div className="absolute -bottom-10 bg-black/50 text-white font-medium text-xs px-4 py-1.5 rounded-full tracking-wide">
                            Hình ảnh {lightboxIndex + 1} trên tổng số {albumImages.length}
                        </div>
                    </div>
                    <button 
                        onClick={handleNextLightbox}
                        className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/5 hover:text-red-500 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Ảnh tiếp theo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>

                </div>
            )}
        </div>
    );
};