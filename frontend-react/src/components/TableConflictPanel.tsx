import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { toast } from "sonner";

export type TableReservation={booking_id:number;table_id:number;table_name:string;customer:string;seats:number;meal_at:string;conflict:boolean;attendance?:string|null};
type Incident={id:number;booking_id:number;table_id:number;table_name:string|null;restaurant_name:string;customer:string;date:string;time:string;state:string;solution?:string;admin_note?:string;reviewed_at?:string;seats:number};
export function useTableReservations(){
 return useQuery<{reservations:TableReservation[];incidents:Incident[]}>({queryKey:["table-reservations"],queryFn:()=>api.get("/v1/table-reservations/me").then(r=>r.data),refetchInterval:10_000,refetchOnWindowFocus:true});
}
function IncidentCard({issue,admin=false}:{issue:Incident;admin?:boolean}){
 const qc=useQueryClient();const [solution,setSolution]=useState(issue.solution??""),[note,setNote]=useState("");
 const mutation=useMutation({mutationFn:()=>admin?api.post(`/v1/table-reservations/admin/${issue.id}/review`,{note}):api.post(`/v1/table-reservations/${issue.id}/solution`,{solution}),onSuccess:()=>{toast.success(admin?"Đã gửi phản hồi cho nhà hàng":"Đã gửi phương án tới admin");void qc.invalidateQueries({queryKey:["table-reservations"]});void qc.invalidateQueries({queryKey:["admin-table-incidents"]});},onError:(e:unknown)=>{const error=e as {response?:{data?:{detail?:string}}};toast.error(error.response?.data?.detail??"Không gửi được phương án.");}});
 return <article className="rounded-xl border border-orange-200 bg-white p-4">
  <p className="text-gray-900">{admin?issue.restaurant_name+" · ":""}Đơn #{issue.booking_id} · Bàn {issue.table_name??issue.table_id} · {issue.customer}</p>
  <p className="mt-1 text-gray-500">{issue.date} · {issue.time.slice(0,5)} · {issue.seats} khách · {issue.state==="open"?"Đang xung đột":"Bàn đã hết xung đột"}</p>
  {issue.solution&&<p className="mt-3 whitespace-pre-wrap text-gray-700">Phương án đã gửi: {issue.solution}</p>}
  {issue.admin_note&&<p className="mt-2 whitespace-pre-wrap text-red-700">Admin: {issue.admin_note}</p>}
  <details className="mt-3" open={!admin&&!issue.solution}>
   <summary className="text-red-700">{admin?"Phản hồi phương án":issue.solution?"Cập nhật phương án":"Đề xuất phương án gửi admin"}</summary>
   <form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();mutation.mutate();}}>
    <textarea aria-label={admin?"Phản hồi admin":"Phương án xử lý"} required minLength={admin?3:10} maxLength={5000} rows={3} value={admin?note:solution} onChange={e=>admin?setNote(e.target.value):setSolution(e.target.value)} disabled={mutation.isPending} placeholder={admin?"Nhập phản hồi cho nhà hàng":"Mô tả cách xử lý: chuyển khách sang bàn nào, thời gian chờ, trao đổi với khách…"} className="w-full rounded-xl border border-gray-200 p-3" />
    <button disabled={mutation.isPending} className="rounded-xl bg-red-600 px-4 py-2 text-white disabled:opacity-50">{mutation.isPending?"Đang gửi…":admin?"Gửi phản hồi":"Gửi admin"}</button>
   </form>
  </details>
 </article>;
}
export default function TableConflictPanel(){
 const q=useTableReservations();
 const issues=(q.data?.incidents??[]).filter(i=>i.state==="open"||!i.solution);
 if(q.isError){
  const error=q.error as {response?:{status?:number;data?:{detail?:unknown}}};
  const detail=error.response?.data?.detail;
  const notLinked=error.response?.status===409 && typeof detail==="string" && detail.startsWith("Tài khoản chưa liên kết");
  return <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{notLinked?detail:"Không tải được trạng thái giữ bàn. Vui lòng thử lại trước khi nhận khách mới."}</p>;
 }
 if(!issues.length)return null;
 return <section className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4"><h2 className="mb-3 text-red-800">Xung đột bàn đặt trước · Cần xử lý</h2><div className="space-y-3">{issues.map(i=><IncidentCard key={i.id} issue={i} />)}</div></section>;
}
export function AdminTableIncidents(){
 const [page,setPage]=useState(0);
 const q=useQuery<Incident[]>({queryKey:["admin-table-incidents",page],queryFn:()=>api.get(`/v1/table-reservations/admin?offset=${page*20}`).then(r=>r.data),refetchInterval:15_000});
 return <div className="space-y-4"><h1>Xung đột bàn</h1>{q.isLoading&&<p>Đang tải…</p>}{q.isError&&<p>Không tải được phương án.</p>}{!q.isLoading&&!q.isError&&!q.data?.length&&<p>Chưa có phương án xử lý được gửi.</p>}{q.data?.slice(0,20).map(i=><IncidentCard key={i.id} issue={i} admin />)}<div className="flex justify-between"><span>Trang {page+1}</span><div className="flex gap-2"><button disabled={!page} onClick={()=>setPage(page-1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Trước</button><button disabled={(q.data?.length??0)<=20} onClick={()=>setPage(page+1)} className="rounded-xl border px-4 py-2 disabled:opacity-40">Sau</button></div></div></div>;
}
