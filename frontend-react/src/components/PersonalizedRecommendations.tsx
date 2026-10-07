import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, X, LoaderCircle } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "../hooks/useLocation";
import type { RestaurantCard } from "../types/restaurant";

type Survey = { favorites: string; avoid: string; occasion: string; budget: string; atmosphere: string; location: string };
type Preference = { survey?: Partial<Survey> };
type Recommended = RestaurantCard & { match_reasons: string[] };
const emptySurvey: Survey = { favorites: "", avoid: "", occasion: "", budget: "", atmosphere: "", location: "" };
const questions: { key: keyof Survey; title: string; placeholder: string; suggestions: string[]; limit: number }[] = [
  { key: "favorites", title: "Có bữa ăn nào ngon đến mức bạn muốn ăn lại không?", placeholder: "Kể về món bạn nhớ nhất, điều bạn thích ở nó hoặc món bạn đang muốn thử…", suggestions: [], limit: 500 },
  { key: "occasion", title: "Lần đi ăn này, bạn hình dung sẽ như thế nào?", placeholder: "Chẳng hạn: Đưa bố mẹ đi ăn cuối tuần, muốn cả nhà ngồi lâu nói chuyện, có hai bé đi cùng…", suggestions: [], limit: 500 },
  { key: "avoid", title: "Có điều gì thường khiến bạn không muốn quay lại một quán?", placeholder: "Chẳng hạn: Món quá ngọt, nhiều dầu mỡ, thực đơn ít lựa chọn… Bạn cũng có thể kể món không ăn được.", suggestions: [], limit: 500 },
  { key: "atmosphere", title: "Điều gì sẽ khiến bữa ăn lần này thật trọn vẹn với bạn?", placeholder: "Chẳng hạn: Một chỗ dễ trò chuyện, món mới để thử, không phải chờ lâu. Có khu vực muốn ghé thì kể thêm nhé…", suggestions: [], limit: 500 },
  { key: "budget", title: "Bạn muốn ăn thoải mái hay dành cho mình một bữa đặc biệt?", placeholder: "Chẳng hạn: Một bữa đơn giản, ngon và vừa túi tiền; hoặc sẵn sàng chi thêm để có trải nghiệm mới…", suggestions: [], limit: 200 },
];

export function PersonalizedRecommendations() {
  const { user, isAuthenticated } = useAuth();
  const { city } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Survey>(emptySurvey);
  const enabled = isAuthenticated && user?.role === "customer";
  const preference = useQuery<Preference | null>({ queryKey: ["preferences", user?.userId], queryFn: () => api.get("/v1/recommendations/me").then(r => r.data), enabled, retry: false });
  const surveyed = Boolean(preference.data?.survey?.favorites);
  const recommended = useQuery<Recommended[]>({ queryKey: ["personalized-recommendations", user?.userId], queryFn: () => api.get("/v1/recommendations/me/restaurants").then(r => r.data), enabled: enabled && surveyed, retry: false });
  const save = useMutation({
    mutationFn: (payload: Survey) => api.post<{ restaurants: Recommended[] }>("/v1/recommendations/me/survey", payload, { timeout: 180000 }),
    onSuccess: response => {
      qc.setQueryData(["personalized-recommendations", user?.userId], response.data.restaurants);
      void qc.invalidateQueries({ queryKey: ["preferences", user?.userId] });
      setOpen(false);
      toast.success(response.data.restaurants.length ? "Đã tìm được gợi ý theo khẩu vị." : "Đã lưu khảo sát. Chưa có nhà hàng phù hợp.");
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Chưa thể tìm bằng AI. Vui lòng thử lại.");
    },
  });
  const start = () => {
    if (!isAuthenticated) { toast.error("Vui lòng đăng nhập để nhận đề xuất riêng."); return; }
    if (user?.role !== "customer") { toast.error("Đề xuất khẩu vị dành cho tài khoản khách hàng."); return; }
    setForm({ ...emptySurvey, location: city || "", ...preference.data?.survey });
    save.reset();
    setOpen(true);
  };
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-lg text-gray-900"><Sparkles size={19} className="text-red-600" />Gợi ý theo khẩu vị</h2><p className="mt-1 text-sm text-gray-500">Trả lời khảo sát để AI tìm nhà hàng phù hợp với bạn.</p></div>
      <button type="button" onClick={start} disabled={preference.isLoading} className="rounded-xl border border-red-600 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">{surveyed ? "Cập nhật khảo sát" : "Khảo sát khẩu vị"}</button>
    </div>
    <div className="pt-5">
      {enabled && preference.isLoading ? <p className="text-sm text-gray-500">Đang tải khẩu vị của bạn…</p> : !surveyed ? <div className="flex flex-col items-start gap-3"><p className="text-sm text-gray-600">Hãy làm khảo sát khẩu vị để TableNow hiểu sở thích và gợi ý nhà hàng phù hợp với bạn.</p><button type="button" onClick={start} className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Làm khảo sát ngay</button></div> : recommended.isLoading ? <p className="text-sm text-gray-500">Đang tải gợi ý…</p> : recommended.isError ? <p className="text-sm text-red-600">Chưa tải được gợi ý. Vui lòng thử lại sau.</p> : recommended.data?.length ?
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{recommended.data.map(item => <button type="button" key={item.id} onClick={() => navigate("/restaurant/" + item.id)} className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:border-red-300 hover:shadow-sm"><img className="h-32 w-full object-cover" src={item.image_url || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"} alt={item.name} /><div className="p-3"><p className="truncate text-sm text-gray-900">{item.name}</p><p className="mt-1 text-xs text-gray-500">{item.district} · {item.city}</p><p className="mt-2 text-sm leading-5 text-gray-600">{item.match_reasons.join(" · ")}</p></div></button>)}</div>
        : <p className="text-sm text-gray-500">{surveyed ? "Chưa tìm thấy nhà hàng phù hợp. Bạn có thể điều chỉnh câu trả lời và tìm lại." : "Bạn thích món gì, đi cùng ai và mong muốn không gian ra sao?"}</p>}
      {surveyed && <p className="mt-4 text-xs text-gray-500">Gợi ý dựa trên thông tin nhà hàng và thực đơn. Không đảm bảo bàn trống hoặc an toàn dị ứng; vui lòng xác nhận với nhà hàng.</p>}
    </div>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form onSubmit={event => { event.preventDefault(); if (!save.isPending && form.favorites.trim().length >= 2) save.mutate(form); }} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-gray-100 px-5 py-4"><div><h3 className="text-lg text-gray-900">Khảo sát khẩu vị</h3><p className="mt-1 text-sm text-gray-500">Cứ kể theo cách của bạn. Không cần trả lời hết các câu.</p></div><button type="button" disabled={save.isPending} onClick={() => setOpen(false)} aria-label="Đóng khảo sát" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"><X size={20} /></button></div>
        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5">
          {questions.map(question => <div key={question.key}><label htmlFor={"taste-" + question.key} className="text-sm text-gray-800">{question.title}{question.key === "favorites" && <span className="text-red-600"> *</span>}</label><textarea id={"taste-" + question.key} required={question.key === "favorites"} minLength={question.key === "favorites" ? 2 : undefined} maxLength={question.limit} disabled={save.isPending} value={form[question.key]} onChange={event => setForm(current => ({ ...current, [question.key]: event.target.value }))} placeholder={question.placeholder} rows={2} className="mt-2 block w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" />{!!question.suggestions.length && <div className="mt-2 flex flex-wrap gap-2">{question.suggestions.map(suggestion => <button type="button" disabled={save.isPending} key={suggestion} onClick={() => setForm(current => ({ ...current, [question.key]: current[question.key] ? (current[question.key] + ", " + suggestion).slice(0,question.limit) : suggestion }))} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-red-300 hover:bg-red-50">{suggestion}</button>)}</div>}</div>)}
          {save.isError && <p role="alert" className="text-sm text-red-600">Chưa thể xử lý khảo sát. Câu trả lời vẫn được giữ để bạn thử lại.</p>}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 px-5 py-4"><button type="button" disabled={save.isPending} onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100">Hủy</button><button disabled={save.isPending || form.favorites.trim().length < 2} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">{save.isPending ? <><LoaderCircle size={16} className="animate-spin" />AI đang tìm nhà hàng…</> : <><Sparkles size={16} />Tìm bằng AI</>}</button></div>
      </form>
    </div>}
  </section>;
}
