import { useQuery } from "@tanstack/react-query";
import { Heart, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import type { RestaurantCard } from "../../types/restaurant";

type FavoriteItem = {
  id: number;
  restaurantId: number;
  restaurant: RestaurantCard;
};

const money = (amount?: number) => new Intl.NumberFormat("vi-VN", {
  style: "currency", currency: "VND", maximumFractionDigits: 0,
}).format(amount ?? 0);

export default function Favorites() {
  const favorites = useQuery<FavoriteItem[]>({
    queryKey: ["favorite-restaurants"],
    queryFn: () => api.get("/v1/favorites/user").then((response) => response.data),
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex text-sm font-bold text-slate-600 transition hover:text-red-600">← Về trang chủ</Link>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nhà hàng yêu thích</h1>
            <p className="mt-1 text-sm text-slate-600">Các nhà hàng bạn đã lưu để xem và đặt bàn nhanh hơn.</p>
          </div>
          {favorites.data && <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">{favorites.data.length} nhà hàng</span>}
        </div>

        {favorites.isLoading && <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500">Đang tải nhà hàng yêu thích...</div>}
        {favorites.isError && <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Không thể tải danh sách yêu thích. <button type="button" onClick={() => void favorites.refetch()} className="font-bold underline">Thử lại</button></div>}
        {favorites.data?.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><Heart className="mx-auto h-9 w-9 text-red-500" aria-hidden="true" /><h2 className="mt-4 font-bold text-slate-900">Chưa có nhà hàng yêu thích</h2><p className="mt-1 text-sm text-slate-600">Hãy nhấn biểu tượng trái tim tại trang nhà hàng để lưu lại.</p><Link to="/" className="mt-5 inline-flex rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">Khám phá nhà hàng</Link></div>}
        {favorites.data && favorites.data.length > 0 && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.data.map(({ id, restaurant }) => <Link key={id} to={`/restaurant/${restaurant.id}`} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="aspect-[16/9] bg-slate-100">{restaurant.image_url ? <img src={restaurant.image_url} alt={restaurant.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Chưa có ảnh</div>}</div>
            <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><h2 className="line-clamp-1 font-bold text-slate-900 group-hover:text-red-600">{restaurant.name}</h2><Heart className="h-4 w-4 shrink-0 fill-red-500 text-red-500" aria-label="Đã yêu thích" /></div><p className="flex items-start gap-1 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="line-clamp-2">{restaurant.address}</span></p><div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1 font-semibold text-amber-600"><Star className="h-4 w-4 fill-current" aria-hidden="true" />{Number(restaurant.rating ?? 0).toFixed(1)}</span><span className="font-semibold text-slate-700">{money(restaurant.price_avg)}</span></div></div>
          </Link>)}
        </div>}
      </section>
    </main>
  );
}
