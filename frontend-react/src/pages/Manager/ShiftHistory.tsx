import { printRestaurantReceipt } from "../../utils/printRestaurantReceipt";
import { shiftReceiptHtml } from "../../utils/shiftReceipt";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api";
type Bill={guests?:number;id:string;table:string;time:string;method:string;discount:number;vat:number;lines:{id?:number|string;name:string;price:number;quantity:number;category:string}[]};
type Shift={openedBy?:string;closedBy?:string;id:string;opened:string;closed?:string;opening:number;counted?:number;bills:Bill[];flows:{amount:number;type:string;method:string}[]};
const money=(n:number)=>n.toLocaleString("vi-VN")+"đ";
const when=(s?:string)=>s?new Date(s).toLocaleString("vi-VN"):"—";
const total=(b:Bill)=>{const net=Math.max(0,b.lines.reduce((n,l)=>n+l.price*l.quantity,0)-b.discount);return net+Math.round(net*b.vat/100);};
const methods=["Tiền mặt","Chuyển khoản","ATM","Apple Pay","Visa"];
export default function ShiftHistory(){
 const [page,setPage]=useState(0);
 const {shiftId}=useParams<{shiftId:string}>();
 const [billPage,setBillPage]=useState(0);
 useEffect(()=>setBillPage(0),[shiftId]);
 const q=useQuery<{data:{shifts:Shift[]}}>({queryKey:["manager-shift-history"],queryFn:()=>api.get("/v1/cashier/workspace").then(r=>r.data)});
 const shifts=(q.data?.data.shifts??[]).filter(s=>s.closed).sort((a,b)=>b.opened.localeCompare(a.opened));
 const shift=shifts.find(s=>s.id===shiftId);
 const report=(s:Shift)=>{
   const sales=s.bills.reduce((n,b)=>n+total(b),0),income=s.flows.filter(f=>f.type==="Thu").reduce((n,f)=>n+f.amount,0),expense=s.flows.filter(f=>f.type==="Chi").reduce((n,f)=>n+f.amount,0);
   const byMethod=(m:string)=>s.bills.filter(b=>b.method===m).reduce((n,b)=>n+total(b),0)+s.flows.filter(f=>f.method===m).reduce((n,f)=>n+(f.type==="Thu"?f.amount:-f.amount),0);
   const cash=s.opening+byMethod("Tiền mặt");
   const vat=s.bills.reduce((n,b)=>{const net=Math.max(0,b.lines.reduce((a,l)=>a+l.price*l.quantity,0)-b.discount);return n+Math.round(net*b.vat/100);},0);
   const categories:Record<string,number>={};s.bills.forEach(b=>b.lines.forEach(l=>{categories[l.category||"Khác"]=(categories[l.category||"Khác"]||0)+l.quantity;}));
   return [["Giờ mở ca",when(s.opened)],["Giờ đóng ca",when(s.closed)],["Tiền đầu ca",money(s.opening)],["Số bill",String(s.bills.length)],["Doanh thu bán hàng",money(sales)],["Tiền thu",money(income)],["Tiền chi",money(expense)],["Doanh thu ca",money(sales+income-expense)],...[...new Set([...methods,...s.bills.map(b=>b.method),...s.flows.map(f=>f.method)])].map(m=>[m,money(byMethod(m))]),["Tổng VAT",money(vat)],["Tiền mặt trong két",money(cash)],["Tiền kiểm đếm",money(s.counted??0)],["Chênh lệch",money((s.counted??0)-cash)],...Object.entries(categories).map(([c,n])=>[c,String(n)+" món"])];
 };
 function print(s:Shift){
   const win=window.open("","_blank","width=420,height=720");
   if(!win){toast.error("Cho phép cửa sổ bật lên để in chốt ca.");return;}
   void printRestaurantReceipt(restaurant=>shiftReceiptHtml(restaurant,s),win);
 }

 return <div className="space-y-5"><h1 className="text-2xl font-normal text-gray-900">{shiftId?"Chi tiết ca":"Lịch sử ca"}</h1>{shiftId&&<Link to="/manager/shifts" className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2">← Lịch sử ca</Link>}{!shiftId&&<section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">{q.isLoading&&<p>Đang tải…</p>}{q.isError&&<p>Không tải được lịch sử ca.</p>}{shifts.slice(page*10,(page+1)*10).map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-4"><div><p className="font-normal">Mở: {when(s.opened)}</p><p className="text-sm text-gray-500">Đóng: {when(s.closed)} · {s.bills.length} bill</p></div><Link to={"/manager/shifts/"+s.id} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-normal text-red-700">Xem chi tiết ca</Link></div>)}{!q.isLoading&&!shifts.length&&<p className="text-gray-500">Chưa có ca đã đóng.</p>}<div className="mt-4 flex justify-between text-sm"><span>{shifts.length} ca · Trang {page+1}</span><div className="flex gap-2"><button disabled={page===0} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={()=>setPage(page-1)}>Trước</button><button disabled={(page+1)*10>=shifts.length} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={()=>setPage(page+1)}>Sau</button></div></div></section>}{shiftId&&q.isLoading&&<p>Đang tải chi tiết ca…</p>}{shiftId&&q.isError&&<p>Không tải được chi tiết ca.</p>}{shiftId&&!q.isLoading&&!q.isError&&!shift&&<p>Không tìm thấy ca.</p>}{shift&&<section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-normal">Chi tiết ca</h2><button onClick={()=>print(shift)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-normal text-white">In báo cáo chốt ca</button></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{report(shift).map(([k,v])=><div key={k} className="rounded-xl bg-gray-50 p-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="mt-1 font-normal">{v}</dd></div>)}</dl><h3 className="mt-5 font-normal">Danh sách bill</h3>{[...shift.bills].sort((a,b)=>b.time.localeCompare(a.time)).slice(billPage*10,(billPage+1)*10).map(b=><Link key={b.id} to={`/manager/shifts/${shift.id}/bill/${b.id}`} className="flex justify-between border-b border-gray-100 py-3 text-sm"><span>#{b.id.slice(-8)} · {b.table} · {when(b.time)} · {b.method}</span><span className="font-normal text-red-700">{money(total(b))} · Xem chi tiết →</span></Link>)}{!shift.bills.length&&<p className="mt-3 text-gray-500">Ca này chưa có bill.</p>}<div className="mt-4 flex items-center justify-between gap-3"><span>{shift.bills.length} bill · Trang {billPage+1}/{Math.max(1,Math.ceil(shift.bills.length/10))}</span><div className="flex gap-2"><button className="rounded-xl border px-3 py-2 disabled:opacity-40" disabled={billPage===0} onClick={()=>setBillPage(billPage-1)}>Trước</button><button className="rounded-xl border px-3 py-2 disabled:opacity-40" disabled={(billPage+1)*10>=shift.bills.length} onClick={()=>setBillPage(billPage+1)}>Sau</button></div></div></section>}</div>;
}
