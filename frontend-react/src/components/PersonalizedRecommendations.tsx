import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarHeart, Check, ChevronRight, Heart, MapPin, Sparkles, Store, Utensils, UsersRound, WalletCards, X } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "../hooks/useLocation";
import { RESTAURANT_CATEGORIES } from "../utils/category";
import type { RestaurantCard } from "../types/restaurant";

type Preference = { categories: string[]; suitable_for: string[]; service_types: string[]; price_level: number | null; city: string | null };
type Recommended = RestaurantCard & { match_reasons: string[] };
type SurveyOption = { value: string; label: string; icon: typeof Utensils };

const occasions: SurveyOption[] = [
  { value: "gia-dinh", label: "Gia đình", icon: UsersRound },
  { value: "hen-ho", label: "Hẹn hò", icon: Heart },
  { value: "ban-be", label: "Bạn bè", icon: Sparkles },
  { value: "tiec-hoi-nghi", label: "Công việc / sự kiện", icon: CalendarHeart },
];
const services: SurveyOption[] = [
  { value: "phuc-vu-tai-ban", label: "Gọi món", icon: Utensils },
  { value: "buffet", label: "Buffet", icon: Store },
  { value: "omakase", label: "Omakase", icon: Sparkles },
];
const priceLevels = [
  { value: 1, label: "Tiết kiệm", hint: "Dưới 150k" },
  { value: 2, label: "Vừa phải", hint: "150–300k" },
  { value: 3, label: "Thoải mái", hint: "300–500k" },
  { value: 4, label: "Cao cấp", hint: "500–800k" },
  { value: 5, label: "Đặc biệt", hint: "Trên 800k" },
];

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
    if (!isAuthenticated) { toast.error("Vui lòng đăng nhập để nhận đề xuất riêng."); navigate("/login"); return; }
    if (user?.role !== "customer") { toast.error("Đề xuất khẩu vị dành cho tài khoản khách hàng."); return; }
    setForm(preference.data ?? { categories: [], suitable_for: [], service_types: [], price_level: null, city });
    setOpen(true);
  };
  const selectedCount = form.categories.length + form.suitable_for.length + form.service_types.length + Number(Boolean(form.price_level));

  return <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
    <div className="relative overflow-hidden bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 px-6 py-7 text-white sm:px-8">
      <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 right-28 h-40 w-40 rounded-full bg-amber-300/20" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide"><Sparkles size={14} /> GỢI Ý RIÊNG CHO BẠN</span><h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Hôm nay bạn muốn ăn gì?</h2><p className="mt-2 text-sm leading-6 text-white/85">Chọn vài sở thích, TableNow sẽ tìm những nhà hàng phù hợp nhất.</p></div>
        <button type="button" onClick={start} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-red-600 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"><Sparkles size={17} />{preference.data ? "Cập nhật khẩu vị" : "Bắt đầu khảo sát"}<ChevronRight size={16} /></button>
      </div>
    </div>
    <div className="p-6 sm:p-8">
      {recommended.isLoading && <p className="text-sm text-slate-500">Đang tìm nhà hàng phù hợp…</p>}
      {recommended.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommended.data.map(item => <button type="button" key={item.id} onClick={() => navigate(`/restaurant/${item.id}`)} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white text-left transition hover:-translate-y-1 hover:border-red-200 hover:shadow-lg"><img className="h-32 w-full object-cover transition duration-300 group-hover:scale-105" src={item.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"} alt={item.name}/><div className="p-3.5"><p className="truncate font-bold text-slate-900">{item.name}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.match_reasons.join(" · ")}</p></div></button>)}</div> : preference.data && !recommended.isLoading ? <div className="rounded-2xl bg-orange-50 p-5 text-sm text-slate-600">Chưa tìm thấy nhà hàng khớp hoàn toàn. Hãy mở khảo sát để cập nhật thêm khẩu vị.</div> : <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-5"><div className="rounded-2xl bg-white p-3 text-orange-500 shadow-sm"><Utensils size={24} /></div><p className="text-sm leading-6 text-slate-600">Khảo sát chỉ mất chưa đến một phút và bạn có thể thay đổi bất cứ lúc nào.</p></div>}
    </div>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <form onSubmit={event => { event.preventDefault(); save.mutate({ ...form, city: form.city || city || null }); }} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-[#fffdfa] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 border-b border-orange-100 bg-[#fffdfa]/95 px-6 py-5 backdrop-blur sm:px-8"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold tracking-wider text-orange-600"><Sparkles size={14} /> KHẢO SÁT KHẨU VỊ</div><h3 className="mt-1 text-2xl font-black text-slate-900">Tạo gu ăn uống của bạn</h3><p className="mt-1 text-sm text-slate-500">Chọn nhiều lựa chọn nếu bạn thích.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Đóng khảo sát" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={21} /></button></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all" style={{ width: `${Math.max(12, Math.min(100, selectedCount * 18))}%` }} /></div></div>
        <div className="space-y-5 p-6 sm:p-8">
          <section className="rounded-2xl border border-orange-100 bg-white p-5"><SurveyHeading icon={<Utensils size={19} />} title="Món bạn yêu thích" description="Chọn những phong cách ẩm thực bạn muốn khám phá." /><ChoiceGroup options={RESTAURANT_CATEGORIES.map(item => ({ value: item.slug, label: item.label, icon: Utensils }))} selected={form.categories} onToggle={value => toggle("categories", value)} /></section>
          <section className="rounded-2xl border border-orange-100 bg-white p-5"><SurveyHeading icon={<CalendarHeart size={19} />} title="Bạn thường đi ăn trong dịp nào?" description="Giúp gợi ý không gian và trải nghiệm phù hợp." /><ChoiceGroup options={occasions} selected={form.suitable_for} onToggle={value => toggle("suitable_for", value)} /></section>
          <section className="rounded-2xl border border-orange-100 bg-white p-5"><SurveyHeading icon={<Store size={19} />} title="Kiểu trải nghiệm" description="Bạn có thể chọn nhiều phong cách phục vụ." /><ChoiceGroup options={services} selected={form.service_types} onToggle={value => toggle("service_types", value)} /></section>
          <section className="rounded-2xl border border-orange-100 bg-white p-5"><SurveyHeading icon={<WalletCards size={19} />} title="Mức giá mong muốn" description="Mức giá trung bình trên một người." /><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">{priceLevels.map(level => <button type="button" key={level.value} onClick={() => setForm(current => ({ ...current, price_level: current.price_level === level.value ? null : level.value }))} className={`rounded-xl border p-3 text-left transition ${form.price_level === level.value ? "border-red-500 bg-red-50 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"}`}><span className="block text-sm font-bold">{level.label}</span><span className="mt-1 block text-xs text-slate-500">{level.hint}</span></button>)}</div></section>
          <div className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800"><MapPin size={18} className="shrink-0" /><span>Ưu tiên tìm tại <b>{form.city || city || "khu vực bạn đang chọn"}</b>.</span></div>
        </div>
        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-orange-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p className="text-xs text-slate-500">Đã chọn <b className="text-slate-800">{selectedCount}</b> tiêu chí</p><div className="flex gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">Để sau</button><button disabled={save.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:opacity-60"><Check size={17} />{save.isPending ? "Đang lưu…" : "Lưu và xem đề xuất"}</button></div></div>
      </form>
    </div>}
  </section>;
}

function SurveyHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">{icon}</span><div><h4 className="font-bold text-slate-900">{title}</h4><p className="mt-0.5 text-sm text-slate-500">{description}</p></div></div>;
}

function ChoiceGroup({ options, selected, onToggle }: { options: SurveyOption[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="mt-4 flex flex-wrap gap-2.5">{options.map(({ value, label, icon: Icon }) => { const active = selected.includes(value); return <button type="button" key={value} onClick={() => onToggle(value)} aria-pressed={active} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${active ? "border-red-500 bg-red-50 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"}`}><Icon size={16} />{label}{active && <Check size={15} strokeWidth={3} />}</button>; })}</div>;
}
