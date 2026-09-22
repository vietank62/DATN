import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, X } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "../hooks/useLocation";
import { RESTAURANT_CATEGORIES } from "../utils/category";
import type { RestaurantCard } from "../types/restaurant";

type Preference = { categories: string[]; suitable_for: string[]; service_types: string[]; price_level: number | null; city: string | null };
type Recommended = RestaurantCard & { match_reasons: string[] };
const occasions = [["gia-dinh", "Gia đình"], ["hen-ho", "Hẹn hò"], ["ban-be", "Bạn bè"], ["tiec-hoi-nghi", "Công việc / sự kiện"]];
const services = [["phuc-vu-tai-ban", "Gọi món"], ["buffet", "Buffet"], ["omakase", "Omakase"]];
const priceLevels = [[1, "Dưới 150.000đ"], [2, "150.000đ – 300.000đ"], [3, "300.000đ – 500.000đ"], [4, "500.000đ – 800.000đ"], [5, "Trên 800.000đ"]] as const;

export function PersonalizedRecommendations() {
  const { user, isAuthenticated } = useAuth();
  const { city } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Preference>({ categories: [], suitable_for: [], service_types: [], price_level: null, city });
  const preference = useQuery<Preference | null>({ queryKey: ["preferences", user?.userId], queryFn: () => api.get("/v1/recommendations/me").then(r => r.data), enabled: isAuthenticated && user?.role === "customer", retry: false });
  const recommended = useQuery<Recommended[]>({ queryKey: ["personalized-recommendations", user?.userId], queryFn: () => api.get("/v1/recommendations/me/restaurants").then(r => r.data), enabled: Boolean(preference.data), retry: false });
  const save = useMutation({
    mutationFn: (payload: Preference) => api.put("/v1/recommendations/me", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferences", user?.userId] });
      void queryClient.invalidateQueries({ queryKey: ["personalized-recommendations", user?.userId] });
      setOpen(false);
      toast.success("Đã lưu khẩu vị của bạn.");
    },
    onError: () => toast.error("Chưa thể lưu khẩu vị. Vui lòng thử lại."),
  });
  const toggle = (key: "categories" | "suitable_for" | "service_types", value: string) => setForm(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  const start = () => {
    if (!isAuthenticated) { toast.error("Vui lòng đăng nhập để nhận đề xuất riêng."); return; }
    if (user?.role !== "customer") { toast.error("Đề xuất khẩu vị dành cho tài khoản khách hàng."); return; }
    setForm(preference.data ?? { categories: [], suitable_for: [], service_types: [], price_level: null, city });
    setOpen(true);
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-bold text-slate-900">Gợi ý theo khẩu vị</h2><p className="mt-1 text-sm text-slate-500">Chọn sở thích để nhận nhà hàng phù hợp hơn.</p></div>
      <button type="button" onClick={start} className="rounded-lg border border-red-600 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">{preference.data ? "Cập nhật khẩu vị" : "Chọn khẩu vị"}</button>
    </div>
    <div className="pt-5">
      {recommended.isLoading && <p className="text-sm text-slate-500">Đang tìm nhà hàng phù hợp…</p>}
      {recommended.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommended.data.map(item => <button type="button" key={item.id} onClick={() => navigate(`/restaurant/${item.id}`)} className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-red-300 hover:shadow-sm"><img className="h-28 w-full object-cover" src={item.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"} alt={item.name}/><div className="p-3"><p className="truncate font-semibold text-slate-900">{item.name}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.match_reasons.join(" · ")}</p></div></button>)}</div> : preference.data && !recommended.isLoading ? <p className="text-sm text-slate-500">Chưa tìm thấy nhà hàng phù hợp. Hãy cập nhật khẩu vị để nhận thêm lựa chọn.</p> : <p className="text-sm text-slate-500">Khảo sát ngắn này giúp TableNow đề xuất nhà hàng sát nhu cầu của bạn.</p>}
    </div>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form onSubmit={event => { event.preventDefault(); save.mutate({ ...form, city: form.city || city || null }); }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6"><div><h3 className="text-xl font-bold text-slate-900">Khảo sát khẩu vị</h3><p className="mt-1 text-sm text-slate-500">Bạn có thể chọn nhiều mục và thay đổi sau.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Đóng khảo sát" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
        <div className="space-y-6 px-5 py-6 sm:px-6"><ChoiceGroup label="Món yêu thích" description="Chọn phong cách ẩm thực bạn thích." options={RESTAURANT_CATEGORIES.map(item => [item.slug, item.label])} selected={form.categories} onToggle={value => toggle("categories", value)} /><ChoiceGroup label="Dịp đi ăn" options={occasions} selected={form.suitable_for} onToggle={value => toggle("suitable_for", value)} /><ChoiceGroup label="Kiểu phục vụ" options={services} selected={form.service_types} onToggle={value => toggle("service_types", value)} /><fieldset><legend className="text-sm font-semibold text-slate-800">Mức giá mong muốn</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{priceLevels.map(([value, label]) => <button type="button" key={value} onClick={() => setForm(current => ({ ...current, price_level: current.price_level === value ? null : value }))} className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${form.price_level === value ? "border-red-600 bg-red-50 font-semibold text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>{label}</button>)}</div></fieldset><p className="flex items-center gap-2 text-sm text-slate-500"><MapPin size={16} /> Ưu tiên tìm tại {form.city || city || "khu vực bạn đang chọn"}.</p></div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Hủy</button><button disabled={save.isPending} className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{save.isPending ? "Đang lưu…" : "Lưu sở thích"}</button></div>
      </form>
    </div>}
  </section>;
}

function ChoiceGroup({ label, description, options, selected, onToggle }: { label: string; description?: string; options: string[][]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset><legend className="text-sm font-semibold text-slate-800">{label}</legend>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}<div className="mt-3 flex flex-wrap gap-2">{options.map(([value, text]) => { const active = selected.includes(value); return <button type="button" key={value} onClick={() => onToggle(value)} aria-pressed={active} className={`rounded-lg border px-3 py-2 text-sm transition ${active ? "border-red-600 bg-red-50 font-semibold text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>{text}</button>; })}</div></fieldset>;
}
