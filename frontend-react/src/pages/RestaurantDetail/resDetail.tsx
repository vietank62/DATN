import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import type { RestaurantCard } from "../../types/restaurant";
import type { ResDetail, RestaurantMenuItem } from "../../types/resDetail";
import type { BookingCreatePayload, BookingDetail } from "../../types/booking";

const BASE_RESTAURANT_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";
const BASE_DETAIL_URL = import.meta.env.VITE_API_BASE + "/v1/details/";

const UTILITIES_MAP: Record<number, { label: string; icon: string }> = {
    1: { label: "Máy chiếu", icon: "📽️" },
    2: { label: "Âm thanh - ánh sáng", icon: "🔊" },
    3: { label: "Ghế trẻ em", icon: "👶" },
    4: { label: "Chỗ hút thuốc", icon: "🚬" },
    5: { label: "Chỗ để ô tô", icon: "🚗" },
    6: { label: "Chỗ để xe máy", icon: "🏍️" },
    7: { label: "Phòng riêng", icon: "🚪" },
    8: { label: "Phòng VIP", icon: "🎉" },
    9: { label: "Karaoke", icon: "🎤" },
    10: { label: "Điều hòa", icon: "❄️" },
    11: { label: "Trang trí sự kiện", icon: "🎉" },
    12: { label: "Màn LED", icon: "📺" },
    13: { label: "Visa / Master card", icon: "💳" },
    14: { label: "Hóa đơn VAT", icon: "🧾" },
    15: { label: "Wifi", icon: "📶" },
    16: { label: "HĐ trực tiếp", icon: "📝" },
    17: { label: "MC dẫn chương trình", icon: "🎤" },
    18: { label: "Bàn ngoài trời", icon: "🌳" },
    19: { label: "Bóng đá K+", icon: "⚽" },
    20: { label: "Momo / Zalo Pay", icon: "💰" },
    21: { label: "Chỗ chơi trẻ em", icon: "🧸" }
};

export const RestaurantDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, isAuthenticated } = useAuth();

    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [bookingDate, setBookingDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [bookingTime, setBookingTime] = useState("18:30");

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [requestSeats, setRequestSeats] = useState(1);
    const [contactName, setContactName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [note, setNote] = useState("");
    const [selectedMenuItems, setSelectedMenuItems] = useState<Record<number, number>>({});

    const [activeTab, setActiveTab] = useState("Mô tả");
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

    const { data: restaurantMenuItems } = useQuery<RestaurantMenuItem[]>({
        queryKey: ["restaurant-menu-items", id],
        queryFn: async () => {
            const { data } = await api.get<RestaurantMenuItem[]>(`/v1/menuitems/restaurant/${id}`);
            return data;
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
    });

    const favoriteStatusQueryKey = ["restaurant-favorite", id, user?.userId ?? undefined];

    const { data: favoriteStatus } = useQuery<{ is_favorite: boolean }>({
        queryKey: favoriteStatusQueryKey,
        queryFn: async () => {
            const { data } = await api.get<{ is_favorite: boolean }>(`/v1/favorites/check/${id}`);
            return data;
        },
        enabled: !!id && isAuthenticated,
        staleTime: 1000 * 60 * 5,
    });

    const toggleFavoriteMutation = useMutation({
        mutationFn: async (restaurantId: number) => {
            const token = localStorage.getItem("token");
            return await axios.post(
                `${import.meta.env.VITE_API_BASE}/v1/favorites/toggle`,
                { restaurantId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
        },
        onMutate: async (restaurantId: number) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: ["restaurant-base", id] }),
                queryClient.cancelQueries({ queryKey: favoriteStatusQueryKey }),
                queryClient.cancelQueries({ queryKey: ["restaurants"] })
            ]);

            const previousRestaurantBase = queryClient.getQueryData<RestaurantCard>(["restaurant-base", id]);
            const previousFavoriteStatus = queryClient.getQueryData<{ is_favorite: boolean }>((favoriteStatusQueryKey));
            const previousRestaurantLists = queryClient.getQueriesData<RestaurantCard[]>({
                queryKey: ["restaurants"]
            });

            queryClient.setQueryData<RestaurantCard>(["restaurant-base", id], (oldData) => {
                if (!oldData) return oldData;
                return { ...oldData, is_favorite: !oldData.is_favorite };
            });

            queryClient.setQueryData<{ is_favorite: boolean }>(favoriteStatusQueryKey, (oldData) => ({
                is_favorite: !(oldData?.is_favorite ?? false)
            }));

            queryClient.setQueriesData<RestaurantCard[]>({ queryKey: ["restaurants"] }, (oldData) => {
                if (!oldData) return oldData;
                return oldData.map((res) =>
                    res.id === restaurantId ? { ...res, is_favorite: !res.is_favorite } : res
                );
            });

            return { previousRestaurantBase, previousFavoriteStatus, previousRestaurantLists };
        },
        onError: (error: unknown, _restaurantId, context) => {
            if (context?.previousRestaurantBase) {
                queryClient.setQueryData(["restaurant-base", id], context.previousRestaurantBase);
            }

            if (context?.previousFavoriteStatus) {
                queryClient.setQueryData(favoriteStatusQueryKey, context.previousFavoriteStatus);
            }

            if (context?.previousRestaurantLists) {
                context.previousRestaurantLists.forEach(([queryKey, oldData]) => {
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["restaurant-base", id] });
            queryClient.invalidateQueries({ queryKey: favoriteStatusQueryKey });
            queryClient.invalidateQueries({ queryKey: ["restaurants"] });
        }
    });

    const bookingMutation = useMutation({
        mutationFn: async (payload: BookingCreatePayload) => {
            const { data } = await api.post<BookingDetail>("/v1/bookings", payload);
            return data;
        },
        onSuccess: (booking) => {
            toast.success(`Đã gửi yêu cầu đặt bàn #${booking.bookingId}`);
            setIsModalOpen(false); 
            navigate(`/account/bookings/${booking.bookingId}`);
        },
        onError: (error: unknown) => {
            const axiosError = error as { response?: { data?: { detail?: string } } };
            toast.error(axiosError.response?.data?.detail || "Không thể tạo đơn đặt bàn, vui lòng thử lại.");
        },
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

    const handlePrevLightbox = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLightboxIndex((prev) => (prev === 0 ? albumImages.length - 1 : prev - 1));
    };

    const handleNextLightbox = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLightboxIndex((prev) => (prev === albumImages.length - 1 ? 0 : prev + 1));
    };

    const openLightboxAt = (index: number) => {
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

    const groupedMenuItems = (restaurantMenuItems ?? []).reduce<Record<string, RestaurantMenuItem[]>>((groups, item) => {
        const key = item.category?.trim() || "Khác";
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});

    const selectedMenuItemEntries = Object.entries(selectedMenuItems)
        .map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity }))
        .filter((item) => item.quantity > 0);

    const selectedMenuTotal = selectedMenuItemEntries.reduce((total, entry) => {
        const menuItem = restaurantMenuItems?.find((item) => item.id === entry.itemId);
        return total + (menuItem?.price ?? 0) * entry.quantity;
    }, 0);

    const updateSelectedItemQuantity = (itemId: number, delta: number) => {
        setSelectedMenuItems((current) => {
            const nextQuantity = (current[itemId] ?? 0) + delta;
            if (nextQuantity <= 0) {
                const nextState = { ...current };
                delete nextState[itemId];
                return nextState;
            }
            return { ...current, [itemId]: nextQuantity };
        });
    };

    const handleOpenNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            toast.error("Vui lòng đăng nhập để đặt bàn.");
            return;
        }
        setIsModalOpen(true);
    };

    const handleBookingSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const guestCount = adults + children;
        const payload: BookingCreatePayload = {
            restaurantId: Number(id),
            date: bookingDate,
            time: bookingTime,
            guestCount,
            requestSeats,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim(),
            note: note.trim() || undefined,
            items: selectedMenuItemEntries,
        };

        if (!payload.contactName || !payload.contactEmail || !payload.contactPhone) {
            toast.error("Vui lòng nhập đầy đủ tên, email và số điện thoại.");
            return;
        }

        bookingMutation.mutate(payload);
    };

    return (
        <div className="w-full bg-slate-100 min-h-screen flex justify-center py-2 px-6">
            <div className="max-w-7xl w-full flex flex-col gap-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 w-full h-87.5 md:h-105 lg:h-120">
                    <div 
                        onClick={() => openLightboxAt(activeImgIndex)}
                        className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-gray-900 group cursor-zoom-in select-none shadow-md border border-gray-200/50"
                    >
                        <img src={albumImages[activeImgIndex]} alt={`Main view`} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-700 ease-out" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                        <button type="button" onClick={handlePrevMainImage} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>
                        <button type="button" onClick={handleNextMainImage} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">📷 {activeImgIndex + 1} / {albumImages.length} Hình ảnh</div>
                    </div>
                    <div className="hidden lg:grid grid-cols-2 grid-rows-2 gap-3 h-full">
                        {sideImages.map((img, idx) => (
                            <div key={idx} onClick={() => openLightboxAt(idx + 1)} className="relative overflow-hidden bg-gray-100 cursor-zoom-in group rounded-2xl border border-gray-200/50">
                                <img src={img} alt={`sub-gallery-${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                {idx === 3 && (
                                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-2 backdrop-blur-xs">
                                        <span className="font-bold text-xs uppercase">Xem tất cả ảnh</span>
                                        {albumImages.length > 5 && <span className="text-xs text-gray-300 mt-0.5">(+{albumImages.length - 5} ảnh)</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full items-start">
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col gap-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                            <div className="flex flex-col gap-2">
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {restaurantBase.name}
                                    {restaurantBase.has_exclusive && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">Ưu Đãi Hot</span>}
                                </h1>
                                <button type="button" onClick={() => toggleFavoriteMutation.mutate(restaurantBase.id)} className={`inline-flex w-fit items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase ${favoriteStatus?.is_favorite ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-gray-500 border-gray-200"}`}>
                                    ❤️ {favoriteStatus?.is_favorite ? "Đã yêu thích" : "Yêu thích"}
                                </button>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 border border-gray-100 px-4 py-2 rounded-xl shadow-2xs">
                                <div className="text-center pr-3 border-r border-gray-200 text-amber-500 font-bold text-sm">⭐ {restaurantBase.rating || "0.0"}<div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Đánh giá</div></div>
                                <div className="text-center text-red-500 font-bold text-sm">💓 {restaurantBase.like_count || 0}<div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Lượt thích</div></div>
                            </div>
                        </div>
                        <div className="flex border-b border-gray-200 overflow-x-auto -mx-6 px-6 justify-between">
                            {["Mô tả", "Thực đơn", "Tiện ích", "Bãi xe", "Quy định"].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? "border-red-600 text-red-600" : "border-transparent text-gray-500"}`}>{tab}</button>
                            ))}
                        </div>
                        <div className="py-2 text-sm text-gray-700 leading-relaxed min-h-40">
                            {activeTab === "Mô tả" && <div className="whitespace-pre-line font-medium">{restaurantDetail.description}</div>}
                            {activeTab === "Thực đơn" && (
                                <div className="flex flex-col gap-4">
                                    {Object.entries(groupedMenuItems).map(([category, items]) => (
                                        <div key={category} className="rounded-2xl border border-gray-100 bg-slate-50/80 p-4 mb-3">
                                            <h5 className="text-sm font-bold text-gray-900 mb-3">{category}</h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {items.map((item) => (
                                                    <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 flex gap-3">
                                                        <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                                                        <div>
                                                            <h6 className="text-sm font-semibold text-gray-900">{item.name}</h6>
                                                            <p className="text-xs font-bold text-red-600 mt-1">{Number(item.price || 0).toLocaleString("vi-VN")} đ</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeTab === "Tiện ích" && <div className="flex flex-wrap gap-2">{restaurantDetail.utilities?.map(id => <span key={id} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold">{UTILITIES_MAP[id]?.icon} {UTILITIES_MAP[id]?.label}</span>)}</div>}
                            {activeTab === "Bãi xe" && <p className="text-xs font-medium">{restaurantDetail.parking_info || "Chưa có thông tin."}</p>}
                            {activeTab === "Quy định" && <p className="text-xs font-medium">{restaurantDetail.regulations || "Chưa có quy định."}</p>}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-30">
                        <div className="bg-white p-5 border-b border-gray-100 text-center flex flex-col gap-1">
                            <h3 className="font-bold text-gray-900 text-base">Đặt bàn giữ chỗ</h3>
                            <p className="text-xs text-gray-400">Chọn thời gian và số lượng khách tham gia</p>
                        </div>
                        <form onSubmit={handleOpenNextStep} className="p-5 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Người lớn</label>
                                    <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none">
                                        {[...Array(20)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} khách</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Trẻ em</label>
                                    <select value={children} onChange={(e) => setChildren(Number(e.target.value))} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none">
                                        {[...Array(10)].map((_, i) => <option key={i} value={i}>{i} trẻ em</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Ngày đến</label>
                                    <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Giờ đến</label>
                                    <input type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none" />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3.5 rounded-lg shadow-md transition-colors cursor-pointer mt-2">
                                Đặt bàn ngay
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Thông tin đặt bàn chi tiết</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Áp dụng cho đơn đi ngày {bookingDate} vào lúc {bookingTime}</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-2 text-xl">&times;</button>
                        </div>

                        <form onSubmit={handleBookingSubmit} className="p-6 flex flex-col gap-5">
                            <div className="flex flex-col gap-3">
                                <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide">1. Thông tin người đặt</h4>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Họ tên người nhận bàn *</label>
                                    <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Email nhận vé *</label>
                                        <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}  className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Số điện thoại liên hệ *</label>
                                        <input required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide">2. Thiết lập cấu trúc chỗ ngồi</h4>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Số lượng chỗ ngồi mong muốn</label>
                                    <select value={requestSeats} onChange={(e) => setRequestSeats(Number(e.target.value))} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                        {[...Array(10)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} chỗ</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide">3. Chọn món dùng kèm (Tùy chọn)</h4>
                                    <span className="text-xs text-gray-400">Tạm tính: {selectedMenuTotal.toLocaleString("vi-VN")} đ</span>
                                </div>
                                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-slate-50 p-3 space-y-2">
                                    {(restaurantMenuItems ?? []).length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">Nhà hàng chưa cấu hình món ăn chọn trước.</p>
                                    ) : (
                                        (restaurantMenuItems ?? []).map((item) => {
                                            const quantity = selectedMenuItems[item.id] ?? 0;
                                            return (
                                                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-gray-100 p-2.5 shadow-2xs">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-950 truncate">{item.name}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{Number(item.price || 0).toLocaleString("vi-VN")} đ</p>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {quantity > 0 ? (
                                                            <>
                                                                <button type="button" onClick={() => updateSelectedItemQuantity(item.id, -1)} className="w-6 h-6 rounded border border-gray-200 bg-white font-bold text-xs">-</button>
                                                                <span className="w-5 text-center text-xs font-semibold">{quantity}</span>
                                                                <button type="button" onClick={() => updateSelectedItemQuantity(item.id, 1)} className="w-6 h-6 rounded border border-gray-200 bg-white font-bold text-xs">+</button>
                                                            </>
                                                        ) : (
                                                            <button type="button" onClick={() => updateSelectedItemQuantity(item.id, 1)} className="px-2.5 py-1 rounded bg-gray-900 text-white text-[10px] font-semibold">Thêm</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-500 font-semibold">Ghi chú đặc biệt gửi tới nhà hàng</label>
                                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ví dụ: Cần không gian yên tĩnh, tổ chức sinh nhật, có người già..." className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-3 rounded-lg transition-colors">
                                    Quay lại chỉnh sửa
                                </button>
                                <button type="submit" disabled={bookingMutation.isPending} className="w-2/3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold py-3 rounded-lg shadow-md transition-colors">
                                    {bookingMutation.isPending ? "Đang gửi yêu cầu..." : "Hoàn tất & Gửi yêu cầu đặt bàn"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isLightboxOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 group select-none">
                    <button type="button" onClick={() => setIsLightboxOpen(false)} className="absolute top-6 right-6 text-white text-3xl cursor-pointer">&times;</button>
                    
                    <button type="button" onClick={handlePrevLightbox} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    
                    <img src={albumImages[lightboxIndex]} alt="Zoomed" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                    
                    <button type="button" onClick={handleNextLightbox} className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                    
                    <div className="absolute bottom-6 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-medium">📷 {lightboxIndex + 1} / {albumImages.length}</div>
                </div>
            )}
        </div>
    );
};