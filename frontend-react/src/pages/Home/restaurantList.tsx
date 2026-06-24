import { useRef } from "react";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css/core";
import { Splide as SplideType} from "@splidejs/splide";

export const Home = () => {
    const restaurantRef = useRef<SplideType>(null);
    const dealsRef = useRef<SplideType>(null);
    const mockRestaurants = [
        { id: 1, name: "Danh sách Nhà hàng ngon ưu đãi hấp dẫn tại Tp.HCM", image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80", spots: 64 },
        { id: 2, name: "Ưu đãi nhà hàng Việt Nam tại Tp.HCM", image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80", spots: 24 },
        { id: 3, name: "Ưu đãi nhà hàng Nướng tại Tp.HCM", image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80", spots: 10 },
        { id: 4, name: "Ưu đãi nhà hàng Chay tại Tp.HCM", image_url: "https``://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80", spots: 7 },
        { id: 5, name: "Ưu đãi tiệc Buffet lẩu nướng thả ga", image_url: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&q=80", spots: 42 },
    ];

    const mockDeals = [
        { id: 1, title: "Giảm 50% set menu cho 2 khách tại Nhà hàng Madame Lam", price_sale: 625000, price_origin: 1250000, discount: 50, is_best_seller: false, image_url: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=500&q=80", restaurant: "Bếp Madame Lam - Trần Ngọc Diện" },
        { id: 2, title: "GIẢM 18% suất Buffet lẩu 279K tại Rakuen Hotpot", price_sale: 229000, price_origin: 279000, discount: 18, is_best_seller: false, image_url: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80", restaurant: "Bếp Rakuen Hotpot - Lê Văn Sỹ" },
        { id: 3, title: "Giảm 10% Suất Buffet Tối Từ T2->CN tại Gánh", price_sale: 379000, price_origin: 419000, discount: 10, is_best_seller: false, image_url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80", restaurant: "Bếp Buffet Gánh - Khách Sạn Bông Sen" },
        { id: 4, title: "Suất Buffet Bách Liên, Giá 395K hơn 50+ món đặc sắc", price_sale: 363000, price_origin: 395000, discount: 8, is_best_seller: true, image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80", restaurant: "Lẩu Hồng Kông - Hoàng Văn Thụ" },
        { id: 5, title: "Suất Buffet Thượng Hạng hải sản tươi sống mới nhất", price_sale: 259000, price_origin: 299000, discount: 13, is_best_seller: true, image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&q=80", restaurant: "Buffet Hải Sản BBQ - Quận 1" },
    ];

    const splideOptions = {
        perPage: 4,
        gap: "1.25rem",
        arrows: false, // tắt arrow mặc định, dùng custom
        pagination: false,
        breakpoints: {
            1024: { perPage: 3 },
            768: { perPage: 2 },
            640: { perPage: 1 },
        },
    };

    const navBtnClass =
        "absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-white rounded-full border-1 border-gray-200 shadow-md text-gray-700 hover:border-red-500 hover:text-red-600 transition-all duration-200";

    return (
        <div className="w-full bg-slate-50 min-h-screen py-10 flex justify-center">
            <div className="max-w-7xl w-full px-4 sm:px-6 lg:px-8 flex flex-col gap-12">

                {/* Section 1: Top nhà hàng */}
                <div>
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Top nhà hàng ưu đãi tốt</h2>
                        <p className="text-sm text-gray-500 mt-1">Khám phá những Nhà hàng đang có ưu đãi hấp dẫn ngay</p>
                    </div>

                    <div className="relative">
                        {/* Nút prev/next custom */}
                        <button className={`${navBtnClass} -left-4`} onClick={() => restaurantRef.current?.go("<")}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 font-bold">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <button className={`${navBtnClass} -right-4`} onClick={() => restaurantRef.current?.go(">")}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 font-bold">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>

                        <Splide ref={restaurantRef} options={splideOptions}>
                            {mockRestaurants.map((res) => (
                                <SplideSlide key={res.id}>
                                    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col h-full cursor-pointer">
                                        <div className="relative pt-[60%] overflow-hidden bg-gray-100">
                                            <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow z-10 uppercase tracking-wide">
                                                Được đề xuất
                                            </span>
                                            <img src={res.image_url} alt={res.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        </div>
                                        <div className="p-4 flex flex-col justify-between bg-white">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-sm md:text-base line-clamp-2 leading-snug group-hover:text-red-600 transition-colors">{res.name}</h3>
                                                <p className="text-xs text-gray-400 mt-2">Số điểm đến: <span className="text-red-500 font-bold">{res.spots < 10 ? `0${res.spots}` : res.spots}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </SplideSlide>
                            ))}
                        </Splide>
                    </div>
                </div>

                {/* Section 2: Top sản phẩm ưu đãi */}
                <div>
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Top sản phẩm ưu đãi Hot</h2>
                            <p className="text-sm text-gray-500 mt-1">Khám phá những Sản phẩm đang có ưu đãi hấp dẫn ngay</p>
                        </div>
                        <a href="/all-deals" className="text-xs md:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1">
                            Xem tất cả &rarr;
                        </a>
                    </div>

                    <div className="relative">
                        <button className={`${navBtnClass} -left-4`} onClick={() => dealsRef.current?.go("<")}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <button className={`${navBtnClass} -right-4`} onClick={() => dealsRef.current?.go(">")}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>

                        <Splide ref={dealsRef} options={splideOptions}>
                            {mockDeals.map((item) => (
                                <SplideSlide key={item.id}>
                                    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-300 flex flex-col h-full">
                                        <div className="relative pt-[65%] overflow-hidden bg-gray-100">
                                            <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                                                <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow uppercase tracking-wider w-fit">Được đề xuất</span>
                                                {item.is_best_seller && <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow uppercase tracking-wider w-fit">Bán chạy</span>}
                                            </div>
                                            <img src={item.image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        </div>
                                        <div className="p-4 flex flex-col justify-between gap-4 bg-white">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-sm line-clamp-2 h-10 leading-tight group-hover:text-red-600 transition-colors cursor-pointer">{item.title}</h3>
                                                <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
                                                    <span className="text-red-600 font-extrabold text-base">{item.price_sale.toLocaleString()}đ</span>
                                                    <span className="text-gray-400 line-through text-xs">{item.price_origin.toLocaleString()}đ</span>
                                                    <span className="text-red-600 font-black text-[10px] bg-red-50 px-1 py-0.5 rounded">-{item.discount}%</span>
                                                </div>
                                                <p className="text-[11px] text-blue-600 underline mt-2 line-clamp-1 cursor-pointer">{item.restaurant}</p>
                                            </div>
                                            <button className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-red-700 active:scale-[0.97] transition-all shadow-sm shadow-red-100 cursor-pointer">
                                                Chọn & Đặt chỗ
                                            </button>
                                        </div>
                                    </div>
                                </SplideSlide>
                            ))}
                        </Splide>
                    </div>
                </div>

            </div>
        </div>
    );
};