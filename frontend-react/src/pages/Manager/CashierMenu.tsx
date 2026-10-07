import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Utensils } from "lucide-react";
import { api } from "../../services/api";
import { getCategoryLabel } from "../../utils/category";

type MenuItem = { id: number; name: string; category: string; price: number; description?: string; image_url?: string; is_available: boolean };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function CashierMenu() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const profile = useQuery<{ id: number; name: string } | null>({ queryKey: ["partner-application"], queryFn: () => api.get("/v1/partners/application/me").then(response => response.data) });
  const menu = useQuery<MenuItem[]>({ queryKey: ["cashier-menu", profile.data?.id], enabled: !!profile.data?.id, queryFn: () => api.get(`/v1/menuitems/restaurant/${profile.data!.id}`).then(response => response.data), refetchOnMount: "always", refetchInterval: 30000 });
  const items = menu.data ?? [];
  const categories = [...new Set(items.map(item => item.category))].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "vi"));
  const filtered = items.filter(item => (!category || item.category === category) && normalize(`${item.name} ${getCategoryLabel(item.category)} ${item.description ?? ""}`).includes(normalize(search.trim())));
  return <div className="space-y-5">
    <header><h1 className="text-lg font-normal text-gray-900">Danh sách món ăn</h1>{profile.data && <p className="mt-1 text-sm text-gray-500">{profile.data.name} · {items.length} món</p>}</header>
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-0 flex-1"><Search size={18} className="absolute left-3 top-3 text-gray-400" /><input aria-label="Tìm món ăn" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên món, danh mục..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm" /></div>
    </div>
    <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Danh mục món ăn">
      <h2 className="mb-3 text-xs font-normal text-gray-800">Danh mục món ăn</h2>
      <div className="flex flex-wrap gap-2">
        {[{ value: "", label: "Tất cả", count: items.length }, ...categories.map(value => ({ value, label: getCategoryLabel(value), count: items.filter(item => item.category === value).length }))].map(option => <button key={option.value} type="button" aria-pressed={category === option.value} onClick={() => setCategory(option.value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${category === option.value ? "border-red-600 bg-red-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50"}`}>
          {option.label}<span className={`rounded-md px-1.5 py-0.5 text-xs ${category === option.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{option.count}</span>
        </button>)}
      </div>
    </section>
    {profile.isLoading || menu.isLoading ? <p className="text-sm text-gray-500">Đang tải thực đơn...</p> : profile.isError || menu.isError ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Không tải được thực đơn. <button type="button" onClick={() => { void profile.refetch(); void menu.refetch(); }} className="underline">Thử lại</button></div> : !profile.data ? <p className="text-sm text-gray-500">Tài khoản chưa liên kết với nhà hàng.</p> : !filtered.length ? <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{items.length ? "Không có món phù hợp với tìm kiếm." : "Nhà hàng chưa có món ăn."}</p> : <div className="space-y-6">
      {[...new Set(filtered.map(item => item.category ?? ""))].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "vi")).map(group => <section key={group}>
        <h2 className="mb-3 border-b border-gray-200 pb-2 text-xs font-normal text-gray-800">{group ? getCategoryLabel(group) : "Chưa phân loại"} <span className="text-xs text-gray-400">({filtered.filter(item => (item.category ?? "") === group).length} món)</span></h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {filtered.filter(item => (item.category ?? "") === group).map(item => <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" className="h-40 w-full shrink-0 object-cover" /> : <div className="flex h-40 shrink-0 items-center justify-center bg-gray-100 text-gray-300"><Utensils size={32} /></div>}
        <div className="flex flex-1 flex-col gap-2 p-4"><span className="text-xs text-gray-500">{getCategoryLabel(item.category)}</span><h2 className="text-xs font-normal leading-5 text-gray-900">{item.name}</h2>{item.description && <p className="line-clamp-2 text-xs leading-5 text-gray-500">{item.description}</p>}<p className="mt-auto pt-2 text-[13px] text-orange-600">{item.price.toLocaleString("vi-VN")}đ</p><p className={`text-xs ${item.is_available ? "text-emerald-600" : "text-gray-400"}`}>{item.is_available ? "● Đang phục vụ" : "● Tạm ngừng"}</p></div>
      </article>)}
        </div>
      </section>)}
    </div>}
  </div>;
}
