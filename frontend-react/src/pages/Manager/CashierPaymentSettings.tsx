import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Landmark, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { api } from "../../services/api";

export type PaymentSettings = { available_methods: string[]; enabled_methods: string[]; default_method: string };


export default function CashierPaymentSettings(){
  const qc=useQueryClient();
  const [newMethod,setNewMethod]=useState("");
  const [deleteMethod,setDeleteMethod]=useState<string|null>(null);
  const [draft,setDraft]=useState<PaymentSettings|null>(null);
  const query=useQuery<PaymentSettings>({queryKey:["cashier-payment-settings"],queryFn:()=>api.get("/v1/cashier/payment-settings").then(r=>r.data)});
  const save=useMutation({mutationFn:(settings:PaymentSettings)=>api.put("/v1/cashier/payment-settings",settings),onSuccess:r=>{qc.setQueryData(["cashier-payment-settings"],r.data);setDraft(null);toast.success("Đã lưu phương thức thanh toán");},onError:e=>toast.error(axios.isAxiosError(e)&&typeof e.response?.data?.detail==="string"?e.response.data.detail:"Không lưu được cài đặt thanh toán")});
  const settings=draft??query.data;
  if(query.isLoading)return <p>Đang tải cài đặt...</p>;
  if(!settings)return <div className="rounded-xl bg-white p-5"><p>Không tải được cài đặt thanh toán.</p><button className="mt-3 text-red-700 underline" onClick={()=>void query.refetch()}>Thử lại</button></div>;
  const options=settings.available_methods;
  function addMethod(){
    if(!settings)return;
    const name=newMethod.trim();if(!name)return;
    if(name.length>30){toast.error("Tên phương thức tối đa 30 ký tự");return;}
    if(options.some(value=>value.toLocaleLowerCase("vi")===name.toLocaleLowerCase("vi"))){toast.error("Phương thức đã tồn tại");return;}
    if(options.length>=30){toast.error("Tối đa 30 phương thức thanh toán");return;}
    setDraft({...settings,available_methods:[...options,name],enabled_methods:[...settings.enabled_methods,name]});setNewMethod("");
  }
  function removeMethod(method:string){
    if(!settings)return;
    const next=settings.enabled_methods.filter(value=>value!==method);
    if(!next.length){toast.error("Cần giữ ít nhất một phương thức thanh toán đang bật");return;}
    setDraft({...settings,available_methods:options.filter(value=>value!==method),enabled_methods:next,default_method:next.includes(settings.default_method)?settings.default_method:next[0]});setDeleteMethod(null);
  }
  function toggle(method:string){
    if(!settings)return;
    const enabled=settings.enabled_methods.includes(method);
    if(enabled&&settings.enabled_methods.length===1){toast.error("Cần giữ ít nhất một phương thức thanh toán");return;}
    const next=options.filter(value=>value===method?!enabled:settings.enabled_methods.includes(value));
    setDraft({...settings,enabled_methods:next,default_method:next.includes(settings.default_method)?settings.default_method:next[0]});
  }
  return <div className="max-w-3xl space-y-6"><h1>Cài đặt thanh toán</h1><section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
    <h2>Phương thức thanh toán</h2><p className="mt-2 text-gray-500">Chọn các hình thức thu ngân có thể ghi nhận khi thanh toán và lập phiếu thu/chi.</p>
    <form onSubmit={e=>{e.preventDefault();addMethod();}} className="mt-5 flex gap-3"><input aria-label="Tên phương thức thanh toán mới" maxLength={30} value={newMethod} disabled={save.isPending} onChange={e=>setNewMethod(e.target.value)} placeholder="Ví dụ: MoMo, ZaloPay" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"/><button type="submit" disabled={save.isPending||!newMethod.trim()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-white disabled:opacity-40"><Plus size={18}/>Thêm</button></form>
    <div className="mt-5 space-y-3">{options.map(method=>{const enabled=settings.enabled_methods.includes(method);const Icon=method==="Tiền mặt"?Banknote:method==="Chuyển khoản"?Landmark:CreditCard;return <div key={method} className={"flex items-center justify-between gap-3 rounded-xl border p-4 "+(enabled?"border-red-200 bg-red-50/50":"border-gray-200 bg-white")}><span className="flex items-center gap-3"><span className="rounded-lg bg-gray-50 p-2 text-red-600"><Icon size={20}/></span>{method}</span><div className="flex items-center gap-3"><input aria-label={"Bật "+method} type="checkbox" checked={enabled} disabled={save.isPending} onChange={()=>toggle(method)} className="h-5 w-5 accent-red-600" /><button type="button" disabled={save.isPending} aria-label={"Xóa "+method} onClick={()=>setDeleteMethod(method)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 size={18}/></button></div></div>;})}</div>
    <label htmlFor="cashier-default-method" className="mt-6 block text-gray-700">Phương thức mặc định<select id="cashier-default-method" value={settings.default_method} disabled={save.isPending} onChange={e=>setDraft({...settings,default_method:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100">{settings.enabled_methods.map(method=><option key={method}>{method}</option>)}</select></label>
    <p className="mt-4 text-gray-500">Tắt phương thức không thay đổi bill và thống kê đã ghi nhận. Cài đặt này không kết nối cổng thanh toán.</p>
    <div className="mt-6 flex justify-end gap-3"><button disabled={save.isPending||!draft} onClick={()=>setDraft(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 disabled:opacity-40">Hủy thay đổi</button><button disabled={save.isPending||!draft} onClick={()=>save.mutate(settings)} className="rounded-xl bg-red-600 px-5 py-2.5 text-white hover:bg-red-700 disabled:opacity-40">{save.isPending?"Đang lưu...":"Lưu cài đặt"}</button></div>
  </section>
    {deleteMethod&&<div role="dialog" aria-modal="true" aria-labelledby="delete-payment-title" className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"><section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 id="delete-payment-title">Xóa phương thức thanh toán</h2><p className="mt-4 text-gray-600">Xóa “{deleteMethod}” khỏi danh sách? Bill và thống kê cũ vẫn được giữ nguyên.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setDeleteMethod(null)} className="rounded-xl border border-gray-200 px-4 py-2.5">Hủy</button><button type="button" onClick={()=>removeMethod(deleteMethod)} className="rounded-xl bg-red-600 px-4 py-2.5 text-white">Xóa</button></div></section></div>}
  </div>;
}
