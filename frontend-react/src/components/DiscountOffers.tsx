import { useQuery } from "@tanstack/react-query";
import { Copy, TicketPercent } from "lucide-react";
import { api } from "../services/api";
import { toast } from "sonner";
export type Discount={id:number;restaurant_id:number;restaurant_name?:string;code:string;title:string;kind:"percent"|"amount";value:number;minimum:number;expires_at:string;is_active:boolean;is_public:boolean};
export const discountValue=(d:Discount)=>d.kind==="percent"?`${d.value}%`:`${d.value.toLocaleString("vi-VN")}đ`;
export const discountText=(d:Discount)=>`${d.title}\nMã: ${d.code} · Giảm ${discountValue(d)}\nÁp dụng tại ${d.restaurant_name??"nhà hàng"} cho hóa đơn từ ${d.minimum.toLocaleString("vi-VN")}đ\nHạn dùng: ${new Date(d.expires_at).toLocaleString("vi-VN")}\nVui lòng cung cấp mã khi thanh toán tại nhà hàng.`;
export function RestaurantDiscountBadge({restaurantId}:{restaurantId:number}){
 const q=useQuery<Discount[]>({queryKey:["public-discounts"],queryFn:()=>api.get("/v1/discounts/public").then(r=>r.data)});
 const offers=q.data?.filter(d=>d.restaurant_id===restaurantId&&d.is_public&&d.is_active&&new Date(d.expires_at)>new Date())??[];
 if(!offers.length)return null;
 const percentages=offers.filter(d=>d.kind==="percent");
 const best=(percentages.length?percentages:offers).reduce((a,b)=>a.value>=b.value?a:b);
 return <span className="promo-badge pointer-events-none absolute top-3 right-3 z-10 max-w-[calc(100%-1.5rem)] rounded px-2 py-0.5 text-[10px] font-sans uppercase tracking-wide shadow">Giảm {discountValue(best)}</span>;
}
export default function DiscountOffers({restaurantId}:{restaurantId:number}){
 const q=useQuery<Discount[]>({queryKey:["public-discounts"],queryFn:()=>api.get("/v1/discounts/public").then(r=>r.data)});
 const offers=q.data?.filter(d=>d.restaurant_id===restaurantId&&d.is_public&&d.is_active&&new Date(d.expires_at)>new Date())??[];
 if(!offers.length)return null;
 return (
  <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="restaurant-offers-title">
   <div className="mb-4 flex items-center gap-2.5">
    <span className="rounded-lg bg-red-50 p-2 text-red-600"><TicketPercent size={18} /></span>
    <h2 id="restaurant-offers-title" className="text-gray-900">Ưu đãi từ nhà hàng</h2>
   </div>
   <div className="grid gap-3 md:grid-cols-2">
    {offers.map(d=>(
     <article key={d.id} className="flex min-w-0 overflow-hidden rounded-xl border border-red-100 bg-white">
      <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-red-200 bg-red-50 px-2 py-4 text-center text-red-700 sm:w-28">
       <span className="text-xs">Giảm</span>
       <span className="break-words text-base font-semibold">{discountValue(d)}</span>
      </div>
      <div className="min-w-0 flex-1 p-3 sm:p-4">
       <h3 className="break-words text-gray-900">{d.title}</h3>
       <p className="mt-1 text-xs leading-5 text-gray-500">{d.minimum>0?`Hóa đơn từ ${d.minimum.toLocaleString("vi-VN")}đ`:"Không yêu cầu hóa đơn tối thiểu"}</p>
       <p className="text-xs leading-5 text-gray-500">Đến {new Date(d.expires_at).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</p>
       <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        <span className="max-w-full break-all text-xs font-medium tracking-wide text-gray-700">{d.code}</span>
        <button type="button" aria-label={`Sao chép mã ${d.code}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400" onClick={()=>{void navigator.clipboard.writeText(d.code).then(()=>toast.success("Đã sao chép mã")).catch(()=>toast.error(`Mã giảm giá: ${d.code}`));}}><Copy size={14} />Sao chép</button>
       </div>
      </div>
     </article>
    ))}
   </div>
  </section>
 );
}
