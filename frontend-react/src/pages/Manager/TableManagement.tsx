import RestaurantTableGraphic from "../../components/RestaurantTableGraphic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Armchair, LayoutGrid, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import axios from "axios";
import { api } from "../../services/api";
import { toast } from "sonner";

type RestaurantTable = { id: number; name: string; seats: number; is_active: boolean };
const input="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";
const button="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 transition hover:bg-gray-50 disabled:opacity-40";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-white transition hover:bg-red-700 disabled:opacity-40";
const errorMessage=(error:unknown)=>axios.isAxiosError(error)&&typeof error.response?.data?.detail==="string"?error.response.data.detail:"Không thể lưu thay đổi. Vui lòng thử lại.";

export default function TableManagement() {
  const qc=useQueryClient();
  const nameInput=useRef<HTMLInputElement>(null);
  const [name,setName]=useState("");
  const [seats,setSeats]=useState(4);
  const [editing,setEditing]=useState<RestaurantTable|null>(null);
  const [deleting,setDeleting]=useState<RestaurantTable|null>(null);
  const [search,setSearch]=useState("");
  const [seatFilter,setSeatFilter]=useState("all");
  const tables=useQuery<RestaurantTable[]>({queryKey:["restaurant-tables"],queryFn:()=>api.get("/v1/restaurant-tables/me").then(r=>r.data)});
  const reset=()=>{setName("");setSeats(4);setEditing(null);};
  const invalidate=()=>{void qc.invalidateQueries({queryKey:["restaurant-tables"]});void qc.invalidateQueries({queryKey:["partner-application"]});};
  const save=useMutation({
    mutationFn:()=>editing?api.put("/v1/restaurant-tables/me/"+editing.id,{name:name.trim(),seats}):api.post("/v1/restaurant-tables/me",{name:name.trim(),seats}),
    onSuccess:()=>{toast.success(editing?"Đã cập nhật bàn":"Đã thêm bàn");reset();invalidate();},
    onError:error=>toast.error(errorMessage(error)),
  });
  const remove=useMutation({mutationFn:(id:number)=>api.delete("/v1/restaurant-tables/me/"+id),onSuccess:(_,id)=>{if(editing?.id===id)reset();setDeleting(null);invalidate();toast.success("Đã xóa bàn");},onError:error=>toast.error(errorMessage(error))});
  const busy=save.isPending||remove.isPending;
  const list=(tables.data??[]).slice().sort((a,b)=>a.name.localeCompare(b.name,"vi",{numeric:true}));
  const active=list.filter(t=>t.is_active);
  const capacity=active.reduce((sum,t)=>sum+t.seats,0);
  const filtered=list.filter(t=>t.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))&&(seatFilter==="all"||(seatFilter==="8+"?t.seats>=8:t.seats===Number(seatFilter))));
  const beginEdit=(table:RestaurantTable)=>{setEditing(table);setName(table.name);setSeats(table.seats);nameInput.current?.scrollIntoView({behavior:"smooth",block:"center"});nameInput.current?.focus({preventScroll:true});};
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><h1>Sơ đồ bàn &amp; chỗ ngồi</h1><p className="mt-2 text-gray-500">Quản lý bàn và sức chứa của nhà hàng.</p></header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[{label:"Tổng số bàn",value:list.length,Icon:LayoutGrid},{label:"Bàn đang hoạt động",value:active.length,Icon:Armchair},{label:"Tổng chỗ ngồi",value:capacity,Icon:Users}].map(({label,value,Icon})=><div key={label} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div><p className="text-gray-500">{label}</p><p className="mt-2 text-gray-900">{tables.isLoading?"—":value}</p></div><span className="rounded-xl bg-red-50 p-3 text-red-600"><Icon size={22}/></span></div>)}
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <form onSubmit={e=>{e.preventDefault();if(!busy&&name.trim()&&Number.isInteger(seats)&&seats>=1&&seats<=100)save.mutate();}} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:sticky xl:top-6">
        <div className="flex items-center justify-between"><h2>{editing?"Chỉnh sửa bàn":"Thêm bàn mới"}</h2>{editing&&<button disabled={busy} type="button" onClick={reset} aria-label="Hủy chỉnh sửa bàn" className="rounded-lg p-2 text-gray-500 hover:bg-gray-50"><X size={18}/></button>}</div>
        <div className="my-5 rounded-xl border border-gray-100 bg-gray-50/70 py-3"><RestaurantTableGraphic name={name.trim()||"Bàn mới"} seats={Number.isInteger(seats)&&seats>=1&&seats<=100?seats:4} selected={!!editing}/></div>
        <fieldset disabled={busy} className="space-y-5">
          <label htmlFor="restaurant-table-name" className="block text-gray-700">Tên bàn<input ref={nameInput} id="restaurant-table-name" required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: A01, Sân vườn 2" className={input}/></label>
          <label htmlFor="restaurant-table-seats" className="block text-gray-700">Số chỗ ngồi<input id="restaurant-table-seats" type="number" min="1" max="100" step="1" required value={seats||""} onChange={e=>setSeats(Number(e.target.value))} className={input}/></label>
          <div className="flex gap-2">{[2,4,6,8].map(value=><button type="button" key={value} onClick={()=>setSeats(value)} className={"flex-1 rounded-lg border py-2 transition "+(seats===value?"border-red-200 bg-red-50 text-red-700":"border-gray-200 text-gray-600 hover:border-red-200")}>{value} chỗ</button>)}</div>
          <button type="submit" disabled={!name.trim()||!Number.isInteger(seats)||seats<1||seats>100} className={primary+" w-full"}>{save.isPending?"Đang lưu...":editing?<><Pencil size={17}/>Lưu thay đổi</>:<><Plus size={18}/>Thêm bàn</>}</button>
          {editing&&<button type="button" onClick={reset} className={button+" w-full"}>Hủy chỉnh sửa</button>}
        </fieldset>
      </form>
      <section className="min-w-0 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-4 border-b border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3"><h2>Danh sách bàn</h2><span className="rounded-full bg-gray-50 px-3 py-1.5 text-gray-500">{filtered.length} bàn</span></div>
          <div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-gray-400"/><input aria-label="Tìm tên bàn" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm theo tên bàn" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"/></div><select aria-label="Lọc số chỗ ngồi" value={seatFilter} onChange={e=>setSeatFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-700 outline-none focus:border-red-400"><option value="all">Tất cả số chỗ</option>{[2,4,6].map(value=><option key={value} value={value}>{value} chỗ</option>)}<option value="8+">Từ 8 chỗ</option></select></div>
        </div>
        {tables.isLoading?<p className="p-10 text-center text-gray-500">Đang tải danh sách bàn...</p>:tables.isError?<div className="p-8 text-center"><p className="text-red-700">Không tải được danh sách bàn.</p><button className={button+" mt-4"} onClick={()=>void tables.refetch()}>Thử lại</button></div>:filtered.length?<div className="grid gap-4 p-5 sm:grid-cols-2 2xl:grid-cols-3">{filtered.map(table=><article key={table.id} className={"group rounded-2xl border p-4 transition "+(editing?.id===table.id?"border-red-300 bg-red-50/40 ring-2 ring-red-100":"border-gray-200 bg-white hover:border-red-200 hover:shadow-sm")}>
          <div className="flex items-center justify-between gap-2"><span className={"rounded-full px-2.5 py-1 "+(table.is_active?"bg-gray-50 text-gray-600":"bg-gray-100 text-gray-400")}>{table.is_active?"Đang hoạt động":"Ngừng hoạt động"}</span><div className="flex gap-1"><button disabled={busy} type="button" onClick={()=>beginEdit(table)} aria-label={"Sửa bàn "+table.name} title="Chỉnh sửa" className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Pencil size={16}/></button><button disabled={busy} type="button" onClick={()=>setDeleting(table)} aria-label={"Xóa bàn "+table.name} title="Xóa bàn" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={16}/></button></div></div>
          <div className="my-3 rounded-xl bg-gray-50/60 py-3"><RestaurantTableGraphic name={table.name} seats={table.seats} selected={editing?.id===table.id}/></div>
          <div className="flex items-center justify-between gap-3"><p title={table.name} className="min-w-0 truncate text-gray-900">{table.name}</p><span className="inline-flex shrink-0 items-center gap-1.5 text-gray-500"><Users size={15}/>{table.seats} chỗ</span></div>
        </article>)}</div>:<div className="p-10 text-center text-gray-500"><p>{list.length?"Không tìm thấy bàn phù hợp.":"Chưa có bàn nào."}</p>{list.length>0&&<button type="button" onClick={()=>{setSearch("");setSeatFilter("all");}} className="mt-3 text-red-700 underline">Xóa bộ lọc</button>}</div>}
      </section>
    </div>
    {deleting&&<div role="dialog" aria-modal="true" aria-labelledby="delete-table-title" className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm" onClick={()=>{if(!remove.isPending)setDeleting(null);}}><section onClick={e=>e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 id="delete-table-title">Xóa bàn</h2><p className="mt-4 text-gray-600">Bạn có chắc chắn muốn xóa bàn {deleting.name} ({deleting.seats} chỗ)?</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={remove.isPending} onClick={()=>setDeleting(null)} className={button}>Hủy</button><button type="button" disabled={remove.isPending} onClick={()=>remove.mutate(deleting.id)} className={primary}>{remove.isPending?"Đang xóa...":"Xóa bàn"}</button></div></section></div>}
  </div>;
}
