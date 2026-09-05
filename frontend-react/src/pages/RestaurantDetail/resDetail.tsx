import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    Baby,
    Bike,
    Camera,
    Car,
    CigaretteOff,
    CircleDollarSign,
    Clock3,
    CreditCard,
    DoorOpen,
    FileText,
    Heart,
    Mic,
    MapPin,
    Puzzle,
    Receipt,
    Snowflake,
    Sparkles,
    Star,
    Tag,
    TreePine,
    Trophy,
    Tv,
    UserRound,
    UsersRound,
    Video,
    Volume2,
    Wifi,
    X,
    type LucideIcon,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import type { RestaurantCard } from "../../types/restaurant";
import type { ResDetail, RestaurantMenuItem } from "../../types/resDetail";
import type { BookingCreatePayload, BookingDetail } from "../../types/booking";
import {
    getCategoryLabel,
    getServiceTypeLabel,
    getSuitableForLabel,
} from "../../utils/category";

const BASE_RESTAURANT_URL = import.meta.env.VITE_API_BASE + "/v1/restaurants/";
const BASE_DETAIL_URL = import.meta.env.VITE_API_BASE + "/v1/details/";

type RestaurantReview = {
    reviewId: number;
    userId: number;
    restaurantId: number;
    rating: number;
    comment?: string | null;
    createdAt?: string | null;
    userName?: string | null;
    userAvatar?: string | null;
};

type ReviewSort = "recent" | "best" | "worst";

const formatReviewDate = (value?: string | null) => {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
};

const UTILITIES_MAP: Record<number, { label: string; Icon: LucideIcon }> = {
    1: { label: "Máy chiếu", Icon: Video },
    2: { label: "Âm thanh - ánh sáng", Icon: Volume2 },
    3: { label: "Ghế trẻ em", Icon: Baby },
    4: { label: "Chỗ hút thuốc", Icon: CigaretteOff },
    5: { label: "Chỗ để ô tô", Icon: Car },
    6: { label: "Chỗ để xe máy", Icon: Bike },
    7: { label: "Phòng riêng", Icon: DoorOpen },
    8: { label: "Phòng VIP", Icon: Sparkles },
    9: { label: "Karaoke", Icon: Mic },
    10: { label: "Điều hòa", Icon: Snowflake },
    11: { label: "Trang trí sự kiện", Icon: Sparkles },
    12: { label: "Màn LED", Icon: Tv },
    13: { label: "Visa / Master card", Icon: CreditCard },
    14: { label: "Hóa đơn VAT", Icon: Receipt },
    15: { label: "Wifi", Icon: Wifi },
    16: { label: "HĐ trực tiếp", Icon: FileText },
    17: { label: "MC dẫn chương trình", Icon: UserRound },
    18: { label: "Bàn ngoài trời", Icon: TreePine },
    19: { label: "Bóng đá K+", Icon: Trophy },
    20: { label: "Momo / Zalo Pay", Icon: CircleDollarSign },
    21: { label: "Chỗ chơi trẻ em", Icon: Puzzle }
};

export const RestaurantDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, isAuthenticated } = useAuth();

    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [bookingDate, setBookingDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
    });
    const [bookingTime, setBookingTime] = useState("18:30");
    const quickBookingTimes = ["11:30", "12:30", "18:00", "19:00", "20:00"];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingStep, setBookingStep] = useState(1);
    const [createdBooking, setCreatedBooking] = useState<BookingDetail | null>(null);

    const [requestSeats, setRequestSeats] = useState(2);
    const [contactName, setContactName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [note, setNote] = useState("");

    const updateAdults = (value: string | number) => {
        const nextAdults = Math.min(100, Math.max(1, Number(value) || 1));

        setAdults(nextAdults);
        setRequestSeats((currentSeats) =>
            Math.max(currentSeats, nextAdults + children),
        );
    };

    const updateChildren = (value: string | number) => {
        const nextChildren = Math.min(100, Math.max(0, Number(value) || 0));

        setChildren(nextChildren);
        setRequestSeats((currentSeats) =>
            Math.max(currentSeats, adults + nextChildren),
        );
    };

    const updateRequestSeats = (value: string | number) => {
        const totalGuests = adults + children;
        const nextSeats = Math.min(200, Math.max(1, Number(value) || 1));

        setRequestSeats(Math.max(totalGuests, nextSeats));
    };
    const [selectedMenuItems, setSelectedMenuItems] = useState<Record<number, number>>({});

    const [activeTab, setActiveTab] = useState("Mô tả");
    const [activeImgIndex, setActiveImgIndex] = useState(0); 
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0); 
    const [reviewSort, setReviewSort] = useState<ReviewSort>("recent");

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

    const { data: restaurantReviews = [], isLoading: isReviewsLoading } = useQuery<RestaurantReview[]>({
        queryKey: ["restaurant-reviews", id, reviewSort],
        queryFn: async () => {
            const { data } = await api.get<RestaurantReview[]>(
                `/api/get-restaurant-reviews/${id}`,
                {
                    params: {
                        sort: reviewSort,
                        limit: 5,
                    },
                },
            );

            return data;
        },
        enabled: !!id,
        staleTime: 1000 * 60,
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
            const { data } = await api.post<{ action: "added" | "removed"; like_count: number }>(
                "/v1/favorites/toggle",
                { restaurantId }
            );
            return data;
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
        onSuccess: (result, restaurantId) => {
            const isFavorite = result.action === "added";

            queryClient.setQueryData<RestaurantCard>(["restaurant-base", id], (oldData) => {
                if (!oldData) return oldData;
                return { ...oldData, is_favorite: isFavorite, like_count: result.like_count };
            });

            queryClient.setQueryData<{ is_favorite: boolean }>(favoriteStatusQueryKey, {
                is_favorite: isFavorite
            });

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
    });

    const bookingMutation = useMutation({
        mutationFn: async (payload: BookingCreatePayload) => {
            const { data } = await api.post<BookingDetail>("/v1/bookings", payload);
            return data;
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

    const sideImages = albumImages.slice(1, 5);
    const hasSideImages = sideImages.length > 0;
    const categoryLabels = (restaurantBase.category ?? []).map(getCategoryLabel);
    const openingHours = Array.isArray(restaurantDetail.opening_time)
        ? restaurantDetail.opening_time.filter(Boolean).join(" · ")
        : restaurantDetail.opening_time;
    const bookingHours = restaurantBase.booking_opening_time && restaurantBase.booking_closing_time
        ? `${restaurantBase.booking_opening_time} – ${restaurantBase.booking_closing_time}`
        : openingHours || "Nhà hàng chưa cập nhật";
    const customerContentClassName = "whitespace-pre-wrap text-sm font-medium leading-7 text-gray-700";

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
        setBookingStep(1);
        setCreatedBooking(null);
        setIsModalOpen(true);
    };

    const openChat = () => {
        if (!isAuthenticated) {
            toast.error("Vui lòng đăng nhập để nhắn tin với nhà hàng.");
            return;
        }

        if (user?.role !== "customer") {
            toast.error("Chức năng nhắn tin dành cho tài khoản khách hàng.");
            return;
        }

        navigate(`/chat/${restaurantBase.id}`);
    };

    const createBooking = (afterCreate: (booking: BookingDetail) => void) => {
        const guestCount = adults + children;

        if (requestSeats < guestCount) {
            toast.error("Số chỗ ngồi phải đủ cho toàn bộ người lớn và trẻ em.");
            return false;
        }

        const payload: BookingCreatePayload = {
            restaurantId: Number(id),
            date: bookingDate,
            time: bookingTime,
            guestCount,
            childCount: children,
            requestSeats,
            contactName: contactName.trim(),
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim(),
            note: note.trim() || undefined,
            items: selectedMenuItemEntries,
        };

        if (!payload.contactName || !payload.contactEmail || !payload.contactPhone) {
            toast.error("Vui lòng nhập đầy đủ tên, email và số điện thoại.");
            return false;
        }

        bookingMutation.mutate(payload, {
            onSuccess: (booking) => {
                void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
                afterCreate(booking);
            },
        });
        return true;
    };

    const handleStepOneNext = () => {
        if (!bookingDate || !bookingTime) {
            toast.error("Vui lòng chọn ngày và giờ đến.");
            return;
        }
        setBookingStep(2);
    };

    const handleStepTwoNext = () => {
        if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
            toast.error("Vui lòng nhập đầy đủ tên, email và số điện thoại.");
            return;
        }
        setBookingStep(3);
    };

    const handleStepThreeNext = () => {
        if (restaurantDetail.requires_deposit) {
            createBooking((booking) => {
                setCreatedBooking(booking);
                setBookingStep(4);
            });
            return;
        }

        createBooking((booking) => {
            toast.success("Yêu cầu đặt bàn đã được gửi thành công.");
            setIsModalOpen(false);
            navigate(`/account/bookings/${booking.bookingId}`);
        });
    };

    return (
        <div className="w-full bg-slate-100 min-h-screen flex justify-center py-4 px-6">
            <div className="max-w-7xl w-full flex flex-col gap-5">
                <section className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-2 shadow-sm sm:p-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-5">
                    <div
                        onClick={() => openLightboxAt(activeImgIndex)}
                        className={`relative h-80 overflow-hidden rounded-2xl border border-gray-200/50 bg-gray-900 shadow-sm select-none md:h-97.5 lg:h-110 ${
                            hasSideImages
                                ? "lg:col-span-8"
                                : "lg:col-span-8 lg:col-start-3"
                        }`}
                    >
                        <img
                            src={albumImages[activeImgIndex]}
                            alt={`${restaurantBase.name} - hình ảnh ${activeImgIndex + 1}`}
                            className="h-full w-full cursor-zoom-in object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                        <button
                            type="button"
                            onClick={handlePrevMainImage}
                            aria-label="Xem ảnh trước"
                            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md transition hover:scale-105 hover:bg-white sm:left-4 sm:h-11 sm:w-11"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                        </button>
                        <button
                            type="button"
                            onClick={handleNextMainImage}
                            aria-label="Xem ảnh tiếp theo"
                            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md transition hover:scale-105 hover:bg-white sm:right-4 sm:h-11 sm:w-11"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm sm:bottom-4 sm:left-4">
                            <Camera className="h-3.5 w-3.5" />
                            {activeImgIndex + 1} / {albumImages.length} hình ảnh
                        </div>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                openLightboxAt(activeImgIndex);
                            }}
                            className="absolute bottom-3 right-3 cursor-pointer rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm backdrop-blur-sm transition hover:bg-white sm:bottom-4 sm:right-4"
                        >
                            Xem toàn bộ ảnh
                        </button>
                    </div>
                    {hasSideImages && (
                    <div className="hidden h-110 grid-cols-2 grid-rows-2 gap-3 lg:col-span-4 lg:grid">
                        {sideImages.map((img, idx) => (
                            <button
                                key={img}
                                type="button"
                                onClick={() => openLightboxAt(idx + 1)}
                                className="group relative cursor-zoom-in overflow-hidden rounded-2xl border border-gray-200/50 bg-gray-100 text-left"
                                aria-label={`Xem hình ảnh ${idx + 2} của ${restaurantBase.name}`}
                            >
                                <img
                                    src={img}
                                    alt={`${restaurantBase.name} - hình ảnh ${idx + 2}`}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                {idx === sideImages.length - 1 && albumImages.length > 5 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 p-2 text-white backdrop-blur-[1px]">
                                        <span className="text-xs font-bold uppercase">Xem tất cả</span>
                                        <span className="mt-0.5 text-xs text-gray-200">+{albumImages.length - 5} ảnh</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    )}
                    </div>
                    {hasSideImages && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                            {albumImages.slice(0, 5).map((image, index) => (
                                <button
                                    key={image}
                                    type="button"
                                    onClick={() => setActiveImgIndex(index)}
                                    className={`h-15 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition ${
                                        activeImgIndex === index
                                            ? "border-amber-500"
                                            : "border-transparent opacity-75 hover:opacity-100"
                                    }`}
                                    aria-label={`Chọn hình ảnh ${index + 1}`}
                                >
                                    <img
                                        src={image}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full items-start">
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col gap-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {restaurantBase.name}
                                    </h1>
                                    {restaurantBase.has_exclusive && (
                                        <span className="promo-badge-soft rounded-md px-2 py-0.5 text-[10px] font-bold uppercase">
                                            Ưu Đãi Hot
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        disabled={toggleFavoriteMutation.isPending}
                                        onClick={() => toggleFavoriteMutation.mutate(restaurantBase.id)}
                                        aria-label={favoriteStatus?.is_favorite ? "Hủy yêu thích" : "Thêm vào yêu thích"}
                                        className={`group/heart inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                            favoriteStatus?.is_favorite
                                                ? "bg-red-50 text-red-600"
                                                : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                                        }`}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill={favoriteStatus?.is_favorite ? "currentColor" : "none"}
                                            viewBox="0 0 24 24"
                                            strokeWidth={2}
                                            stroke="currentColor"
                                            className="h-4 w-4 transition-transform group-hover/heart:scale-110"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                                        </svg>
                                        {favoriteStatus?.is_favorite
                                            ? "Đã thêm vào yêu thích"
                                            : "Thêm vào yêu thích"}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 border border-gray-100 px-4 py-2 rounded-xl shadow-2xs">
                                <div className="border-r border-gray-200 pr-3 text-center text-amber-500 text-sm font-bold">
                                    <div className="flex items-center justify-center gap-1">
                                        <Star className="h-4 w-4 fill-current" />
                                        {restaurantBase.rating || "0.0"}
                                    </div>
                                    <div className="mt-0.5 text-[9px] font-bold uppercase text-gray-400">
                                        {restaurantBase.review_count || 0} đánh giá
                                    </div>
                                </div>
                                <div className="text-center text-red-500 text-sm font-bold">
                                    <div className="flex items-center justify-center gap-1">
                                        <Heart className="h-4 w-4 fill-current" />
                                        {restaurantBase.like_count || 0}
                                    </div>
                                    <div className="mt-0.5 text-[9px] font-bold uppercase text-gray-400">
                                        Lượt thích
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-slate-50/70 p-4 sm:grid-cols-2">
                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-500">Địa chỉ</p>
                                    <p className="mt-0.5 text-sm font-semibold leading-5 text-gray-800">
                                        {restaurantBase.address}, {restaurantBase.district}, {restaurantBase.city}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-500">Giờ nhận khách</p>
                                    <p className="mt-0.5 text-sm font-semibold leading-5 text-gray-800">
                                        {bookingHours}
                                    </p>
                                </div>
                            </div>
                            {restaurantDetail.price_range && (
                                <div className="flex items-start gap-3">
                                    <Tag className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500">Khoảng giá</p>
                                        <p className="mt-0.5 text-sm font-semibold text-gray-800">
                                            {restaurantDetail.price_range}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {restaurantBase.price_avg ? (
                                <div className="flex items-start gap-3">
                                    <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500">Chi tiêu trung bình</p>
                                        <p className="mt-0.5 text-sm font-semibold text-gray-800">
                                            Từ {restaurantBase.price_avg.toLocaleString("vi-VN")} đ / khách
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        {(categoryLabels.length > 0 || (restaurantBase.suitable_for?.length ?? 0) > 0 || (restaurantBase.service_types?.length ?? 0) > 0) && (
                            <div className="flex flex-wrap items-center gap-2">
                                {categoryLabels.map((category) => (
                                    <span key={category} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                                        {category}
                                    </span>
                                ))}
                                {(restaurantBase.suitable_for ?? []).map((item) => (
                                    <span key={item} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                        Phù hợp: {getSuitableForLabel(item)}
                                    </span>
                                ))}
                                {(restaurantBase.service_types ?? []).map((item) => (
                                    <span key={item} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                        {getServiceTypeLabel(item)}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex border-b border-gray-200 overflow-x-auto -mx-6 px-6 justify-between">
                            {["Mô tả", "Thực đơn", "Tiện ích", "Bãi xe", "Quy định"].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? "border-red-600 text-red-600" : "border-transparent text-gray-500"}`}>{tab}</button>
                            ))}
                        </div>
                        <div className="py-2 text-sm text-gray-700 leading-relaxed min-h-40">
                            {activeTab === "Mô tả" && (
                                <div className={customerContentClassName}>
                                    {restaurantDetail.description || "Nhà hàng chưa cập nhật mô tả."}
                                </div>
                            )}
                            {activeTab === "Thực đơn" && (
                                <div className="flex flex-col gap-4">
                                    {Object.entries(groupedMenuItems).map(([category, items]) => (
                                        <div key={category} className="rounded-2xl border border-gray-100 bg-slate-50/80 p-4 mb-3">
                                            <h5 className="text-sm font-bold text-gray-900 mb-3">{getCategoryLabel(category)}</h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {items.map((item) => (
                                                    <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 flex gap-3">
                                                        <img src={item.image_url ?? undefined} alt={item.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
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
                            {activeTab === "Tiện ích" && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {(restaurantDetail.utilities ?? []).map((id) => {
                                        const utility = UTILITIES_MAP[id];

                                        if (!utility) {
                                            return null;
                                        }

                                        const { Icon } = utility;

                                        return (
                                            <div
                                                key={id}
                                                className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-linear-to-br from-white to-amber-50/40 p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
                                            >
                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 transition group-hover:bg-amber-200">
                                                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                                                </span>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {utility.label}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-gray-500">
                                                        Có sẵn tại nhà hàng
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!restaurantDetail.utilities?.length && (
                                        <p className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-slate-50 p-6 text-center text-sm text-gray-500">
                                            Nhà hàng chưa cập nhật tiện ích.
                                        </p>
                                    )}
                                </div>
                            )}
                            {activeTab === "Bãi xe" && (
                                <p className={customerContentClassName}>
                                    {restaurantDetail.parking_info || "Nhà hàng chưa cập nhật thông tin bãi đỗ xe."}
                                </p>
                            )}
                            {activeTab === "Quy định" && (
                                <p className={customerContentClassName}>
                                    {restaurantDetail.regulations || "Nhà hàng chưa cập nhật quy định."}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-30">
                        <div className="bg-white p-5 border-b border-gray-100 text-center flex flex-col gap-1">
                            <h3 className="font-bold text-gray-900 text-base">Đặt bàn giữ chỗ</h3>
                            <p className="text-xs text-gray-400">Chọn thời gian và số lượng khách để giữ chỗ nhé</p>
                        </div>
                        <form onSubmit={handleOpenNextStep} className="p-5 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Người lớn</label>
                                    <input type="number" min="1" max="100" value={adults} onChange={(e) => updateAdults(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none" />
                                    <select aria-hidden="true" tabIndex={-1} value={adults} onChange={(e) => updateAdults(e.target.value)} className="hidden">
                                        {[...Array(20)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} khách</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Trẻ em</label>
                                    <input type="number" min="0" max="100" value={children} onChange={(e) => updateChildren(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none" />
                                    <select aria-hidden="true" tabIndex={-1} value={children} onChange={(e) => updateChildren(e.target.value)} className="hidden">
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

                            <div className="space-y-2">
                                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-500">Khung giờ phổ biến</span><Clock3 className="w-3.5 h-3.5 text-red-500" /></div>
                                <div className="grid grid-cols-5 gap-1.5">{quickBookingTimes.map((time) => <button key={time} type="button" onClick={() => setBookingTime(time)} className={`rounded-lg border py-2 text-[11px] font-semibold transition-colors ${bookingTime === time ? "border-red-600 bg-red-50 text-red-600" : "border-gray-200 bg-white text-gray-600 hover:border-red-200"}`}>{time}</button>)}</div>
                            </div>

                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3.5 rounded-lg shadow-md transition-colors cursor-pointer mt-2">
                                Đặt bàn ngay
                            </button>
                            <button
                                type="button"
                                onClick={openChat}
                                className="w-full cursor-pointer rounded-lg border border-amber-200 bg-amber-50 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
                            >
                                Nhắn tin với nhà hàng
                            </button>
                        </form>
                    </div>
                </div>

                <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-900">Đánh giá từ thực khách</h2>
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                    {restaurantBase.review_count || 0} đánh giá
                                </span>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            Sắp xếp
                            <select
                                value={reviewSort}
                                onChange={(event) => setReviewSort(event.target.value as ReviewSort)}
                                className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition focus:border-amber-500"
                            >
                                <option value="recent">Mới nhất</option>
                                <option value="best">Tốt nhất</option>
                                <option value="worst">Tệ nhất</option>
                            </select>
                        </label>
                    </div>

                    <div className="mt-2 divide-y divide-gray-100">
                        {isReviewsLoading && (
                            <p className="py-8 text-center text-sm text-gray-400">
                                Đang tải đánh giá...
                            </p>
                        )}
                        {!isReviewsLoading && restaurantReviews.length === 0 && (
                            <p className="py-8 text-center text-sm text-gray-500">
                                Nhà hàng chưa có đánh giá nào từ thực khách.
                            </p>
                        )}
                        {restaurantReviews.map((review) => {
                            const reviewerName = review.userName?.trim() || "Thực khách";
                            const initials = reviewerName.charAt(0).toUpperCase();

                            return (
                                <article key={review.reviewId} className="py-5">
                                    <div className="flex items-start gap-3">
                                        {review.userAvatar ? (
                                            <img
                                                src={review.userAvatar}
                                                alt={reviewerName}
                                                className="h-10 w-10 shrink-0 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                                                {initials}
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="truncate text-sm font-bold text-gray-900">
                                                    {reviewerName}
                                                </p>
                                                <span className="text-xs text-gray-400">
                                                    {formatReviewDate(review.createdAt)}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-0.5" aria-label={`${review.rating} trên 5 sao`}>
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={`h-4 w-4 ${
                                                            star <= review.rating
                                                                ? "fill-amber-400 text-amber-400"
                                                                : "fill-gray-100 text-gray-200"
                                                        }`}
                                                    />
                                                ))}
                                                <span className="ml-1 text-xs font-bold text-gray-500">
                                                    {review.rating.toFixed(1)}
                                                </span>
                                            </div>
                                            {review.comment && (
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                                                    {review.comment}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Đặt bàn</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Hoàn thiện thông tin để gửi yêu cầu đến nhà hàng</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-2 text-xl">&times;</button>
                        </div>

                        <div className="p-5 sm:p-6 overflow-y-auto min-h-0 flex flex-col gap-5">
                            <div className="flex gap-1.5" aria-label={`Bước ${bookingStep} trên 4`}>
                                {[1, 2, 3, 4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= bookingStep ? "bg-red-600" : "bg-gray-200"}`} />)}
                            </div>
                            {bookingStep === 1 && <div className="flex flex-col gap-3">
                                <div><h4 className="text-sm font-bold text-gray-900">Kiểm tra thông tin đặt bàn</h4><p className="text-xs text-gray-400 mt-1">Bạn có thể điều chỉnh lại số khách, ngày và giờ đến trước khi tiếp tục.</p></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Người lớn</label>
                                        <input type="number" min="1" max="100" value={adults} onChange={(e) => updateAdults(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                        <select aria-hidden="true" tabIndex={-1} value={adults} onChange={(e) => updateAdults(e.target.value)} className="hidden">
                                            {[...Array(20)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} người lớn</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Trẻ em</label>
                                        <input type="number" min="0" max="100" value={children} onChange={(e) => updateChildren(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                        <select aria-hidden="true" tabIndex={-1} value={children} onChange={(e) => updateChildren(e.target.value)} className="hidden">
                                            {[...Array(11)].map((_, i) => <option key={i} value={i}>{i} trẻ em</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Ngày đến</label>
                                        <input required type="date" min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-500 font-semibold">Giờ đến</label>
                                        <input required type="time" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/50 p-3">
                                    <p className="text-xs font-semibold text-red-600">Khung giờ gợi ý</p>
                                    <div className="grid grid-cols-5 gap-1.5">{quickBookingTimes.map((time) => <button key={time} type="button" onClick={() => setBookingTime(time)} className={`rounded-lg border py-2 text-[11px] font-semibold ${bookingTime === time ? "border-red-600 bg-white text-red-600" : "border-transparent bg-white text-gray-600"}`}>{time}</button>)}</div>
                                </div>
                                <button type="button" onClick={handleStepOneNext} className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3 rounded-xl shadow-md transition-colors">Tiếp tục: thông tin liên hệ</button>
                            </div>}

                            {bookingStep === 2 && <div className="flex flex-col gap-3">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900">Thông tin người đặt bàn</h4>
                                    <p className="mt-1 text-xs text-gray-400">
                                        Nhà hàng sẽ dùng thông tin này để liên hệ xác nhận.
                                    </p>
                                </div>
                                {restaurantDetail.phone_number && (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                        <span className="font-semibold">Cần hỗ trợ đặt bàn? </span>
                                        <a
                                            href={`tel:${restaurantDetail.phone_number}`}
                                            className="cursor-pointer font-bold underline underline-offset-2"
                                        >
                                            Liên hệ nhà hàng: {restaurantDetail.phone_number}
                                        </a>
                                    </div>
                                )}
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
                                <div className="flex gap-3 pt-2"><button type="button" onClick={() => setBookingStep(1)} className="w-1/3 bg-gray-100 text-gray-700 text-xs font-bold py-3 rounded-xl">Quay lại</button><button type="button" onClick={handleStepTwoNext} className="w-2/3 bg-red-600 text-white text-xs font-bold py-3 rounded-xl">Tiếp tục: chỗ ngồi & món ăn</button></div>
                            </div>}

                            {bookingStep === 3 && <><div className="flex flex-col gap-3">
                                <div><h4 className="text-sm font-bold text-gray-900">Chọn chỗ ngồi và món ăn</h4><p className="text-xs text-gray-400 mt-1">Các lựa chọn này giúp nhà hàng chuẩn bị chu đáo hơn.</p></div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-500 font-semibold">Số lượng chỗ ngồi mong muốn</label>
                                    <input type="number" min={adults + children} max="200" value={requestSeats} onChange={(e) => updateRequestSeats(e.target.value)} className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    <select aria-hidden="true" tabIndex={-1} value={requestSeats} onChange={(e) => updateRequestSeats(e.target.value)} className="hidden">
1                                           {[...Array(10)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1} chỗ</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-red-600 uppercase tracking-wide">Món dùng kèm (tùy chọn)</h4>
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
                                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ví dụ: Tổ chức sinh nhật, ngồi ở tầng 2..." className="w-full border border-gray-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                            </div>

                            <div className="flex gap-3 pt-2 border-t border-gray-100"><button type="button" onClick={() => setBookingStep(2)} className="w-1/3 bg-gray-100 text-gray-700 text-xs font-bold py-3 rounded-xl">Quay lại</button><button type="button" onClick={handleStepThreeNext} disabled={bookingMutation.isPending} className="w-2/3 bg-red-600 disabled:opacity-60 text-white text-xs font-bold py-3 rounded-xl">{bookingMutation.isPending ? "Đang gửi yêu cầu..." : restaurantDetail.requires_deposit ? "Tiếp tục đến thanh toán" : "Gửi yêu cầu đặt bàn"}</button></div>
                            </>}
                            {bookingStep === 4 && <div className="flex flex-col gap-5 text-center py-4"><div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto"><CreditCard className="w-6 h-6" /></div><div><h4 className="font-bold text-gray-900">Thanh toán đặt cọc</h4><p className="text-sm text-gray-500 mt-2">Nhà hàng yêu cầu đặt cọc. Chức năng thanh toán sẽ được cập nhật sau.</p></div>{createdBooking && <button type="button" onClick={() => navigate(`/account/bookings/${createdBooking.bookingId}`)} className="w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-lg">Xem yêu cầu đặt bàn</button>}</div>}
                        </div>
                    </div>
                </div>
            )}

            {isLightboxOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 group select-none">
                    <button type="button" onClick={() => setIsLightboxOpen(false)} aria-label="Đóng ảnh" className="absolute top-6 right-6 text-white cursor-pointer"><X className="h-8 w-8" /></button>
                    
                    <button type="button" onClick={handlePrevLightbox} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    
                    <img src={albumImages[lightboxIndex]} alt="Zoomed" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                    
                    <button type="button" onClick={handleNextLightbox} className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                    
                    <div className="absolute bottom-6 flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-medium"><Camera className="h-3.5 w-3.5" /> {lightboxIndex + 1} / {albumImages.length}</div>
                </div>
            )}
        </div>
    );
};
