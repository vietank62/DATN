import { cashierTotals } from "../../utils/cashierTotals";
import { useTableReservations } from "../../components/TableConflictPanel";
import { printRestaurantReceipt } from "../../utils/printRestaurantReceipt";
import { shiftReceiptHtml } from "../../utils/shiftReceipt";
import { Banknote, Landmark, CreditCard, Wallet, Printer, Check } from "lucide-react";
import type { PaymentSettings } from "./CashierPaymentSettings";
import InvoiceRequestModal, { type InvoiceRequest } from "../../components/InvoiceRequestModal";
import { paymentReceiptHtml } from "../../utils/paymentReceipt";
import { kitchenReceiptHtml } from "../../utils/kitchenReceipt";
import { useAuth } from "../../hooks/useAuth";
import { kitchenChanges } from "../../utils/kitchenChanges";
import { splitCashierOrder } from "../../utils/splitCashierOrder";
import RestaurantTableGraphic from "../../components/RestaurantTableGraphic";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";
import { type Discount, discountValue } from "../../components/DiscountOffers";

type Item = { id: number; name: string; price: number; category: string; image_url?: string; is_available: boolean };
type Line = Item & { quantity: number };
type Order = { depositCredit?: number; bookingId?: number; preordersImported?: boolean; openedAt?: string; lines: Line[]; note: string; discount: number; guests: number; vat: number; kitchenLines?: Line[]; kitchenNote?: string; kitchenConfirmedAt?: string; kitchenTicket?: string[]; kitchenPrintCount?: number };
type Bill = Order & { invoiceRequest?: InvoiceRequest; invoiceSkipped?: boolean; cashier?: string; id: string; table: string; time: string; method: string };
type Flow = { id: string; amount: number; method: string; reason: string; type: "Thu" | "Chi"; time: string };
type Shift = { openedBy?: string; closedBy?: string; id: string; opened: string; closed?: string; opening: number; counted?: number; bills: Bill[]; flows: Flow[] };
type State = { orders: Record<string, Order>; shifts: Shift[] };
type Table = { id: number; name: string; seats: number; is_active: boolean };
const methods = ["Tiền mặt", "Chuyển khoản", "ATM", "Apple Pay", "Visa"];
const denominations = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
const when = (s?: string) => s ? new Date(s).toLocaleString("vi-VN") : "—";
const emptyOrder = (): Order => ({ lines: [], note: "", discount: 0, guests: 1, vat: 8 });
const sums = cashierTotals;
const escape = (s: string) => s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
function printReceipt(title: string, rows: string[], preparedWindow?: Window) {
  const win=preparedWindow??window.open("", "_blank", "width=420,height=720");
  if (!win) { toast.error("Cho phép cửa sổ bật lên để in hóa đơn."); return; }
  if(rows[0]==="PHIẾU BẾP"){void printRestaurantReceipt(restaurant=>kitchenReceiptHtml(restaurant.name,rows),win);return;}
  win.document.write('<html><head><title>'+escape(title)+'</title><style>body{font:400 14px "Be Vietnam Pro",Arial,sans-serif;width:72mm;margin:12px auto}h1{font-size:18px;font-weight:400;text-align:center}p{line-height:1.6;border-bottom:1px dashed #ddd;padding:4px 0}@media print{@page{size:80mm auto;margin:4mm}body{margin:0}}</style></head><body><h1>'+escape(title)+'</h1>'+rows.map(r=>"<p>"+escape(r)+"</p>").join("")+'</body></html>');
  win.document.close(); win.focus(); win.print();
}
const button="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-normal hover:bg-gray-50 disabled:opacity-40";
const primary="rounded-xl bg-red-600 px-4 py-2 text-sm font-normal text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-40";
const input="w-full rounded-xl border border-gray-200 bg-white p-2 text-sm text-gray-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";
export default function CashierPOS() {
  const { user }=useAuth();
  const queryClient=useQueryClient();
  const reservationsQuery=useTableReservations();
  const reservations=reservationsQuery.data?.reservations??[];
  const pathname=useLocation().pathname;
  const shiftPage=pathname.endsWith("/shift");
  const invoicePage=pathname.endsWith("/invoices");
  const [invoiceBillId,setInvoiceBillId]=useState<string|null>(null);
  const navigate=useNavigate();
  const params=useParams<{tableId:string;billId:string;shiftId:string}>();
  const billPage=!!params.billId;
  const detailPage=params.tableId!==undefined;
  const tableId=params.tableId?Number(params.tableId):null;
  const setTableId=(id:number)=>navigate("/manager/cashier/table/"+id);
  const profile=useQuery<{id:number;name:string;address?:string;vat_enabled:boolean}>({queryKey:["partner-application"],queryFn:()=>api.get("/v1/partners/application/me").then(r=>r.data)});
  const paymentSettings=useQuery<PaymentSettings>({queryKey:["cashier-payment-settings"],queryFn:()=>api.get("/v1/cashier/payment-settings").then(r=>r.data)});
  const enabledMethods=paymentSettings.data?.enabled_methods??[];
  const menu=useQuery<Item[]>({queryKey:["cashier-menu",profile.data?.id],enabled:!!profile.data?.id,queryFn:()=>api.get("/v1/menuitems/restaurant/"+profile.data?.id).then(r=>r.data)});
  const tables=useQuery<Table[]>({queryKey:["restaurant-tables"],queryFn:()=>api.get("/v1/restaurant-tables/me").then(r=>r.data)});
  const workspace=useQuery<{version:number;data:State}>({queryKey:["cashier-workspace",profile.data?.id],enabled:!!profile.data?.id,refetchInterval:10_000,queryFn:()=>api.get("/v1/cashier/workspace").then(r=>r.data)});
  const discounts=useQuery<Discount[]>({queryKey:["manager-discounts"],queryFn:()=>api.get("/v1/discounts/me").then(r=>r.data)});
  const [state,setState]=useState<State>({orders:{},shifts:[]});
  const savingRef=useRef(false);
  const [version,setVersion]=useState(0), [busy,setBusy]=useState(false);
  const [category,setCategory]=useState("Tất cả"), [search,setSearch]=useState("");
  const [modal,setModal]=useState<"open"|"close"|"payment"|"flow"|"move"|"split"|"delete"|null>(null), [opening,setOpening]=useState(0);
  const [method,setMethod]=useState(methods[0]), [flowType,setFlowType]=useState<"Thu"|"Chi">("Thu"), [amount,setAmount]=useState(0), [reason,setReason]=useState("");
  const [deletingId,setDeletingId]=useState<number|null>(null);
  const [destination,setDestination]=useState<number|null>(null);
  const [splitQuantities,setSplitQuantities]=useState<Record<number,number>>({});
  const [notes,setNotes]=useState<Record<number,number>>({}), [closeStep,setCloseStep]=useState(1);
  const [invoiceOpen,setInvoiceOpen]=useState(false);
  const [billPageIndex,setBillPageIndex]=useState(0);
  const [editing,setEditing]=useState<string|null>(null), [draft,setDraft]=useState<Order>(emptyOrder()), [billFilter,setBillFilter]=useState("");
  useEffect(()=>setBillPageIndex(0),[billFilter,pathname]);
  useEffect(()=>{setEditing(null);setModal(null);setInvoiceOpen(false);setInvoiceBillId(null);},[params.billId,params.tableId,pathname]);
  useEffect(()=>{ if(workspace.data){ setState(workspace.data.data);setVersion(workspace.data.version); } },[workspace.data]);
  const shift=state.shifts.find(s=>!s.closed);
  const active=shift;
  const hasOpenOrders=Object.values(state.orders).some(o=>o.lines.length>0||(o.kitchenLines?.length??0)>0);
  const pendingInvoices=(shift?.bills??[]).filter(b=>!b.invoiceRequest&&!b.invoiceSkipped).length;
  const closeBlocked=hasOpenOrders||pendingInvoices>0;
  const billShift=state.shifts.find(s=>(!params.shiftId||(s.id===params.shiftId&&!!s.closed))&&s.bills.some(b=>b.id===(invoicePage?invoiceBillId:params.billId)));
  const selectedBill=billShift?.bills.find(b=>b.id===(invoicePage?invoiceBillId:params.billId));
  const filteredBills=(shift?.bills??[]).slice().sort((a,b)=>b.time.localeCompare(a.time)).filter(b=>(b.table+" "+b.id).toLowerCase().includes(billFilter.toLowerCase()));
  const invoiceBills=state.shifts.flatMap(s=>s.bills).filter(b=>!b.invoiceSkipped).sort((a,b)=>b.time.localeCompare(a.time)).filter(b=>(b.table+" "+b.id+" "+(b.invoiceRequest?.companyName??"")+" "+(b.invoiceRequest?.customerName??"")).toLowerCase().includes(billFilter.toLowerCase()));
  const invoicePaged=invoiceBills.slice(billPageIndex*10,(billPageIndex+1)*10);
  const pagedBills=filteredBills.slice(billPageIndex*10,(billPageIndex+1)*10);
  const table=tables.data?.find(t=>t.id===tableId);
  const held=reservations.find(r=>r.table_id===tableId);
  const reservedTableIds=new Set(reservations.map(r=>r.table_id));
  const currentVat=profile.data?.vat_enabled === false ? 0 : 8;
  const order=editing ? draft : {...(state.orders[String(tableId)] ?? emptyOrder()),vat:currentVat};
  const totals=sums(order);
  const originalBill=editing?shift?.bills.find(b=>b.id===editing):undefined;
  const selectableMethods=editing&&originalBill&&!enabledMethods.includes(originalBill.method)?[...enabledMethods,originalBill.method]:enabledMethods;
  useEffect(()=>{
    if(paymentSettings.data&&["payment","split","flow"].includes(modal??"")){
      setMethod(editing&&modal!=="flow"&&originalBill?originalBill.method:paymentSettings.data.default_method);
    }
  },[modal,editing,paymentSettings.data?.default_method]);
  useEffect(()=>{
    if(!paymentSettings.data)return;
    const allowed=modal==="flow"?enabledMethods:selectableMethods;
    if(!allowed.includes(method))setMethod(paymentSettings.data.default_method);
  },[paymentSettings.data,editing,originalBill?.method,modal,method]);
  const sentLines=order.kitchenLines??originalBill?.lines??[];
  const kitchenRows=kitchenChanges(order.lines,sentLines);
  const kitchenPending=kitchenRows.length>0;
  const deletingLine=order.lines.find(l=>l.id===deletingId);
  const categories=["Tất cả",...new Set((menu.data??[]).map(i=>i.category||"Khác"))];
  async function save(next:State):Promise<boolean>{
    if(savingRef.current||!workspace.data) return false;
    savingRef.current=true;setBusy(true);
    try { const r=await api.put("/v1/cashier/workspace",{version,data:next});setState(r.data.data);setVersion(r.data.version);queryClient.setQueryData(["cashier-workspace",profile.data?.id],r.data);void queryClient.invalidateQueries({queryKey:["table-reservations"]});void queryClient.invalidateQueries({queryKey:["cashier-bookings"]});void queryClient.invalidateQueries({queryKey:["manager-bookings"]});void queryClient.invalidateQueries({queryKey:["manager-booking-detail"]});return true; }
    catch(e:unknown){ const err=e as {response?:{status:number;data?:{detail?:string}}}; toast.error(err.response?.data?.detail ?? "Không lưu được dữ liệu thu ngân."); if(err.response?.status===409) await workspace.refetch(); return false; }
    finally{savingRef.current=false;setBusy(false);}
  }
  async function saveTableOrder(next:Order|null):Promise<boolean>{
    if(savingRef.current||!workspace.data||tableId===null)return false;
    savingRef.current=true;setBusy(true);
    try{
      const result=await api.put("/v1/cashier/tables/"+tableId+"/order",{version,order:next});
      const cached=queryClient.getQueryData<{version:number;data:State}>(["cashier-workspace",profile.data?.id]);
      const current=cached?.data??state;
      const orders={...current.orders};
      if(result.data.order)orders[String(tableId)]=result.data.order;else delete orders[String(tableId)];
      const updated={version:result.data.version,data:{...current,orders}};
      setState(updated.data);setVersion(updated.version);
      queryClient.setQueryData(["cashier-workspace",profile.data?.id],updated);
      return true;
    }catch(e:unknown){
      const error=e as {response?:{status:number;data?:{detail?:string}}};
      toast.error(error.response?.data?.detail??"Không lưu được chi tiết bàn.");
      if(error.response?.status===409)await workspace.refetch();
      return false;
    }finally{savingRef.current=false;setBusy(false);}
  }
  function change(next:Order){
    if(!editing&&held&&next.lines.length&&!order.lines.length&&!order.kitchenLines?.length&&next.bookingId!==held.booking_id){
      if(held.conflict){toast.error("Bàn đang xung đột. Hãy xử lý trước khi tiếp nhận khách.");return;}
      if(!window.confirm(`Bàn giữ cho đơn #${held.booking_id} · ${held.customer}. Tiếp nhận khách của đơn này?`))return;
      next={...next,bookingId:held.booking_id,guests:held.seats};
    }
    next={...next,openedAt:next.openedAt??new Date().toISOString()};if(editing)setDraft(next);else void saveTableOrder(next);
  }
  function add(item:Item){ const found=order.lines.find(l=>l.id===item.id);change({...order,lines:found?order.lines.map(l=>l.id===item.id?{...l,quantity:l.quantity+1}:l):[...order.lines,{...item,quantity:1}]}); }
  function qty(id:number,n:number){
    if(n<=0){setDeletingId(id);setModal("delete");return;}
    change({...order,lines:order.lines.map(l=>l.id===id?{...l,quantity:n}:l)});
  }
  async function deleteItem(){
    if(deletingId===null||busy)return;
    const next={...order,lines:order.lines.filter(l=>l.id!==deletingId)};
    if(editing){setDraft(next);setModal(null);setDeletingId(null);}
    else if(await saveTableOrder(next)){setModal(null);setDeletingId(null);}
  }
  async function confirmKitchen(){
    if(!shift||busy||!kitchenPending)return;
    const win=window.open("","_blank","width=420,height=720");
    if(!win){toast.error("Cho phép cửa sổ bật lên để mở phiếu bếp.");return;}
    const timestamp=new Date().toISOString();
    const tableName=originalBill?.table??table?.name??"";
    const printCount=(order.kitchenPrintCount??0)+1;
    const rows=["PHIẾU BẾP", "Bàn: "+tableName, "Mã phiếu: PB-"+crypto.randomUUID().slice(0,8).toUpperCase(), "Nhân viên: "+(user?.name??"—"),
      "Giờ: "+new Date(timestamp).toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"}),
      "Ngày: "+new Date(timestamp).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}), "Lần gửi: "+printCount, "Thời gian: "+when(timestamp),...kitchenRows,
      ...(order.note?["Ghi chú: "+order.note]:[])];
    const confirmed:Order={...order,kitchenLines:order.lines.map(l=>({...l})),kitchenNote:order.note,kitchenConfirmedAt:timestamp,kitchenTicket:rows,kitchenPrintCount:printCount};
    let success=false;
    if(editing&&originalBill){
      success=await save({...state,shifts:state.shifts.map(s=>s.id===shift.id?{...s,bills:s.bills.map(b=>b.id===editing?{...b,...confirmed}:b)}:s)});
      if(success)setDraft(confirmed);
    }else if(table){
      success=await saveTableOrder(confirmed.lines.length?confirmed:null);
    }
    if(success){printReceipt(profile.data?.name??"TableNow",rows,win);toast.success("Đã xác nhận món và mở phiếu bếp.");}
    else win.close();
  }
  function billPrint(b:Bill,temporary=false,preparedWindow?:Window){
    if(!temporary){
      const saved=queryClient.getQueryData<{version:number;data:State}>(["cashier-workspace",profile.data?.id]);
      b=saved?.data.shifts.flatMap(s=>s.bills).find(bill=>bill.id===b.id)??b;
    }
    const win=preparedWindow??window.open("","_blank","width=420,height=720");
    if(!win){toast.error("Cho phép cửa sổ bật lên để in hóa đơn.");return;}
    void printRestaurantReceipt(restaurant=>paymentReceiptHtml(restaurant,{...b,cashier:b.cashier??(temporary?user?.name:undefined)},temporary),win);
  }
  async function saveInvoice(data:InvoiceRequest,print:boolean):Promise<boolean>{
    if(!selectedBill||!billShift||busy||editing)return false;
    const win=print?window.open("","_blank","width=420,height=720"):null;
    if(print&&!win){toast.error("Cho phép cửa sổ bật lên để in phiếu.");return false;}
    const updated={...selectedBill,invoiceRequest:data,invoiceSkipped:false};
    const success=await save({...state,shifts:state.shifts.map(s=>s.id===billShift.id?{...s,bills:s.bills.map(b=>b.id===selectedBill.id?updated:b)}:s)});
    if(success){setInvoiceOpen(false);toast.success("Đã lưu yêu cầu xuất hóa đơn.");if(win)billPrint(updated,false,win);}
    else win?.close();
    return success;
  }
  async function skipInvoice(){
    if(!selectedBill||!billShift||busy||editing)return;
    if(await save({...state,shifts:state.shifts.map(s=>s.id===billShift.id?{...s,bills:s.bills.map(b=>b.id===selectedBill.id?{...b,invoiceSkipped:true}:b)}:s)})){setInvoiceOpen(false);toast.success("Đã bỏ qua xuất hóa đơn.");}
  }
  function report(s:Shift){
    const sales=s.bills.reduce((n,b)=>n+sums(b).gross,0);
    const income=s.flows.filter(f=>f.type==="Thu").reduce((n,f)=>n+f.amount,0);
    const expense=s.flows.filter(f=>f.type==="Chi").reduce((n,f)=>n+f.amount,0);
    const byMethod=(m:string)=>s.bills.filter(b=>b.method===m).reduce((n,b)=>n+sums(b).total,0)+s.flows.filter(f=>f.method===m).reduce((n,f)=>n+(f.type==="Thu"?f.amount:-f.amount),0);
    const vat=s.bills.reduce((n,b)=>n+sums(b).tax,0);
    const dishes:Record<string,number>={};s.bills.forEach(b=>b.lines.forEach(l=>{dishes[l.category||"Khác"]=(dishes[l.category||"Khác"]||0)+l.quantity;}));
    const dishDetails=new Map<string,Map<number,{name:string;quantity:number}>>();
    s.bills.forEach(b=>b.lines.forEach(line=>{
      const category=line.category||"Khác";
      if(!dishDetails.has(category))dishDetails.set(category,new Map());
      const items=dishDetails.get(category)!;
      const previous=items.get(line.id);
      items.set(line.id,{name:line.name,quantity:(previous?.quantity??0)+line.quantity});
    }));
    return {sales,income,expense,revenue:sales+income-expense,vat,byMethod,cash:s.opening+byMethod("Tiền mặt"),dishes,dishDetails};
  }
  function shiftPrint(s:Shift){
    const win=window.open("","_blank","width=420,height=720");
    if(!win){toast.error("Cho phép cửa sổ bật lên để in chốt ca.");return;}
    void printRestaurantReceipt(restaurant=>shiftReceiptHtml(restaurant,s),win);
  }
  async function moveTable(){
    if(!shift||!table||!destination||editing||busy)return;
    const target=tables.data?.find(t=>t.id===destination&&t.is_active!==false);
    if(!target||target.id===table.id||(state.orders[String(destination)]?.lines.length||state.orders[String(destination)]?.kitchenLines?.length)){toast.error("Chọn một bàn trống khác.");return;}
    if(target.seats<order.guests){toast.error("Bàn đích không đủ chỗ cho "+order.guests+" khách.");return;}
    const orders={...state.orders,[String(destination)]:order};
    delete orders[String(table.id)];
    if(await save({...state,orders})){setTableId(destination);setModal(null);toast.success("Đã chuyển sang bàn "+target.name);}
  }
  async function paySplit(print:boolean){
    if(!shift||!table||editing||busy)return;
    if(kitchenPending){toast.error("Xác nhận món mới với bếp trước khi tách bill.");return;}
    if(!enabledMethods.includes(method)){toast.error("Chọn phương thức thanh toán đang hoạt động.");return;}
    try{
      const {selected,remaining}=splitCashierOrder(order,splitQuantities);
      selected.kitchenLines=selected.lines.map(l=>({...l}));
      remaining.kitchenLines=remaining.lines.map(l=>({...l}));
      selected.kitchenTicket=undefined; remaining.kitchenTicket=undefined;
      const bill:Bill={...selected,cashier:user?.name,id:crypto.randomUUID(),table:table.name,time:new Date().toISOString(),method,
        note:[selected.note,"Bill tách từ bàn "+table.name].filter(Boolean).join("\n")};
      const orders={...state.orders};
      if(remaining.lines.length)orders[String(table.id)]=remaining;
      else delete orders[String(table.id)];
      if(await save({...state,orders,shifts:state.shifts.map(s=>s.id===shift.id?{...s,bills:[bill,...s.bills]}:s)})){
        setModal(null);setSplitQuantities({});if(print)billPrint(bill);toast.success("Đã thanh toán bill tách.");
      }
    }catch(e){toast.error(e instanceof Error?e.message:"Không thể tách bill");}
  }
  const splitPreview=(()=>{
    try{return splitCashierOrder(order,splitQuantities);}catch{return null;}
  })();
  async function pay(print:boolean){if(!shift||!order.lines.length)return;
    if(!selectableMethods.includes(method)){toast.error("Chọn phương thức thanh toán đang hoạt động.");return;}
    if(kitchenPending){toast.error("Xác nhận và in phiếu bếp trước khi thanh toán.");return;}
    if(editing){const original=shift.bills.find(b=>b.id===editing);if(!original)return;const b={...original,...order,method};if(await save({...state,shifts:state.shifts.map(s=>s.id===shift.id?{...s,bills:s.bills.map(x=>x.id===editing?b:x)}:s)})){setEditing(null);setModal(null);if(print)billPrint(b);}}
    else {if(!table)return;const b:Bill={...order,cashier:user?.name,id:crypto.randomUUID(),table:table.name,time:new Date().toISOString(),method};
      const orders={...state.orders};delete orders[String(tableId)];
      if(await save({...state,orders,shifts:state.shifts.map(s=>s.id===shift.id?{...s,bills:[b,...s.bills]}:s)})){setModal(null);if(print)billPrint(b);toast.success("Đã ghi nhận thanh toán.");}}
  }
  if(workspace.isLoading) return <p>Đang tải dữ liệu ca…</p>;
  if(workspace.isError) return <div className="rounded-xl bg-red-50 p-5">Không tải được dữ liệu thu ngân. <button className={button} onClick={()=>void workspace.refetch()}>Thử lại</button></div>;
  const r=active?report(active):null;
  const counted=denominations.reduce((n,v)=>n+v*(notes[v]||0),0);
  const tableList=(tables.data??[]).filter(t=>t.is_active!==false).sort((a,b)=>a.name.localeCompare(b.name,"vi",{numeric:true}));
  return <div className="space-y-6 font-sans">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-normal">{invoicePage?"Xuất hóa đơn":billPage?"Chi tiết bill":shiftPage?"Chi tiết ca":detailPage?"Chi tiết bàn "+(table?.name??""):"Khu vực"} · {profile.data?.name}</h1><span className="text-sm text-gray-500">{shift?"Ca đang mở · "+when(shift.opened):"Chưa mở ca"}</span></div>
    {detailPage&&<button className={button} disabled={busy} onClick={()=>navigate("/manager/cashier")}>← Quay lại khu vực</button>}
    {detailPage&&!tables.isLoading&&!table&&<p className="rounded-xl bg-white p-5 text-gray-500">Không tìm thấy bàn.</p>}
    {billPage&&<><button className={button} disabled={busy} onClick={()=>{setEditing(null);navigate(params.shiftId?"/manager/shifts/"+params.shiftId:billShift?.closed?"/manager/shifts/"+billShift.id:"/manager/cashier/shift");}}>← Danh sách bill</button>{selectedBill?<section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-lg font-normal">Bill #{selectedBill.id.slice(-8)} · {selectedBill.table}</h2><p className="mt-1 text-sm text-gray-500">{when(selectedBill.time)} · {selectedBill.method}</p></div><details className="relative"><summary aria-label="Thao tác bill" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-2xl hover:bg-red-50 [&::-webkit-details-marker]:hidden">⋮</summary><div className="absolute right-0 top-10 z-30 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-lg"><button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-red-50" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");billPrint(selectedBill);}}>In lại hóa đơn</button><button disabled={busy||!!editing} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-red-50 disabled:opacity-40" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");setInvoiceOpen(true);}}>Xuất hóa đơn</button>{!billShift?.closed&&<button disabled={busy} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-red-50" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");setEditing(selectedBill.id);setDraft({...selectedBill,lines:selectedBill.lines.map(l=>({...l}))});setMethod(selectedBill.method);}}>Chỉnh sửa bill</button>}</div></details></div><div className="mt-5 divide-y divide-gray-100">{selectedBill.lines.map(l=><div key={l.id} className="flex justify-between gap-3 py-3 text-sm"><span>{l.name} × {l.quantity}</span><b>{money(l.price*l.quantity)}</b></div>)}</div><div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">{selectedBill.invoiceRequest&&<div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-red-800">Yêu cầu xuất hóa đơn · Chờ xử lý</p><p className="mt-1 text-gray-700">{selectedBill.invoiceRequest.buyerType==="company"?selectedBill.invoiceRequest.companyName:selectedBill.invoiceRequest.customerName}</p>{selectedBill.invoiceRequest.taxCode&&<p className="mt-1 text-gray-600">Mã số thuế: {selectedBill.invoiceRequest.taxCode}</p>}</div>}<p>Số khách: {selectedBill.guests}</p><p>Ghi chú: {selectedBill.note||"—"}</p><p>Tạm tính: {money(sums(selectedBill).sub)}</p><p>Giảm giá: {money(selectedBill.discount)}</p><p>VAT {selectedBill.vat}%: {money(sums(selectedBill).tax)}</p>{sums(selectedBill).deposit>0&&<p className="text-emerald-700">Khấu trừ tiền cọc: −{money(sums(selectedBill).deposit)}</p>}<p className="text-xl font-normal text-red-700">Còn phải thanh toán: {money(sums(selectedBill).total)}</p></div></section>:<p>Không tìm thấy bill.</p>}</>}
    {invoiceOpen&&selectedBill&&<InvoiceRequestModal key={selectedBill.id} initial={selectedBill.invoiceRequest} billNumber={selectedBill.id.slice(-8)} busy={busy} onClose={()=>setInvoiceOpen(false)} onSkip={skipInvoice} onSave={saveInvoice}/>}
    {invoicePage&&<section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2>Danh sách bill</h2><span className="text-gray-500">{invoiceBills.length} bill</span></div>
      <input aria-label="Tìm bill để xuất hóa đơn" value={billFilter} onChange={e=>setBillFilter(e.target.value)} className={input+" mt-4"} placeholder="Tìm mã bill, tên bàn hoặc khách hàng" />
      <div className="mt-4 divide-y divide-gray-100">{invoicePaged.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p>#{b.id.slice(-8)} · {b.table} · {money(sums(b).total)}</p><p className="mt-1 text-gray-500">{when(b.time)} · {b.method}</p><p className={"mt-1 "+(b.invoiceRequest?"text-red-700":"text-gray-500")}>{b.invoiceRequest?"Đã lưu yêu cầu · Chờ xử lý":"Chưa có yêu cầu xuất hóa đơn"}</p></div><div className="flex gap-2"><button disabled={busy} className={button} onClick={()=>navigate("/manager/cashier/bill/"+b.id)}>Chi tiết bill</button><button disabled={busy} className={primary} onClick={()=>{setInvoiceBillId(b.id);setInvoiceOpen(true);}}>{b.invoiceRequest?"Thông tin hóa đơn":"Xuất hóa đơn"}</button></div></div>)}</div>
      {!invoiceBills.length&&<p className="py-6 text-center text-gray-500">Chưa có bill phù hợp.</p>}
      <div className="mt-4 flex items-center justify-between gap-3"><span>Trang {billPageIndex+1}/{Math.max(1,Math.ceil(invoiceBills.length/10))}</span><div className="flex gap-2"><button className={button} disabled={billPageIndex===0} onClick={()=>setBillPageIndex(billPageIndex-1)}>Trước</button><button className={button} disabled={(billPageIndex+1)*10>=invoiceBills.length} onClick={()=>setBillPageIndex(billPageIndex+1)}>Sau</button></div></div>
    </section>}
    {!billPage&&!invoicePage&&(shiftPage ? <>
      <div className="flex flex-wrap gap-2">{!shift?<button className={primary} disabled={busy} onClick={()=>{setOpening(0);setModal("open");}}>Mở ca</button>:<><button className={button} onClick={()=>{setAmount(0);setReason("");setModal("flow");}}>Tạo phiếu thu / chi</button><button className={primary} onClick={()=>{setNotes({});setCloseStep(1);setModal("close");}}>Đóng ca</button></>}</div>
      {active&&r&&<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Doanh thu ca",money(r.revenue)],["Doanh thu bán hàng",money(r.sales)],["Tiền thu / chi",money(r.income)+" / "+money(r.expense)],["Tiền mặt trong két",money(r.cash)],["Tổng VAT",money(r.vat)],["Tiền đầu ca",money(active.opening)],["Giờ mở ca",when(active.opened)]].map(([label,value],index)=><div key={label} className={"rounded-2xl border p-5 shadow-sm "+(index===0?"border-red-200 bg-red-50":"border-gray-100 bg-white")}><p className={"text-xs font-normal "+(index===0?"text-red-700":"text-gray-500")}>{label}</p><b className={"mt-2 block "+(index===0?"text-2xl text-red-700":"text-lg text-gray-900")}>{value}</b></div>)}</div>
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5"><h2 className="font-normal">Theo phương thức thanh toán</h2><div className="mt-3 grid gap-3 sm:grid-cols-5">{[...new Set([...methods,...enabledMethods,...active.bills.map(b=>b.method),...active.flows.map(f=>f.method)])].map(m=><div key={m}><p className="text-sm">{m}</p><b>{money(r.byMethod(m))}</b></div>)}</div></section>


      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5"><h2 className="font-normal">Phiếu thu / chi</h2>{active.flows.map(f=><p key={f.id} className="border-b border-gray-100 py-3">{f.type} · {money(f.amount)} · {f.method} · {f.reason} · {when(f.time)}</p>)}</section></>}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-normal">Chi tiết ca</h2>{!shift?<p className="mt-3 text-gray-500">Hiện tại không có ca đang mở.</p>:<><input className={input+" mt-3"} placeholder="Tìm số bill hoặc tên bàn" value={billFilter} onChange={e=>setBillFilter(e.target.value)}/>{pagedBills.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-3"><span>#{b.id.slice(-8)} · {b.table} · {when(b.time)} · {b.method}<b className="ml-3">{money(sums(b).total)}</b></span><button className={button} onClick={()=>navigate("/manager/cashier/bill/"+b.id)}>Xem chi tiết</button></div>)}{!filteredBills.length&&<p className="mt-3 text-gray-400">Chưa có bill phù hợp.</p>}<div className="mt-4 flex items-center justify-between text-sm"><span>{filteredBills.length} bill · Trang {billPageIndex+1}/{Math.max(1,Math.ceil(filteredBills.length/10))}</span><div className="flex gap-2"><button className={button} disabled={billPageIndex===0} onClick={()=>setBillPageIndex(billPageIndex-1)}>Trước</button><button className={button} disabled={(billPageIndex+1)*10>=filteredBills.length} onClick={()=>setBillPageIndex(billPageIndex+1)}>Sau</button></div></div></>}</section>
      {active&&r&&<section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-normal">Số món theo danh mục</h2>
        <p className="mt-2 text-gray-500">Số lượng món đã thanh toán trong ca hiện tại.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{Array.from(r.dishDetails.entries()).sort(([a],[b])=>a.localeCompare(b,"vi")).map(([category,items])=><div key={category} className="overflow-hidden rounded-xl border border-gray-100">
          <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3"><p className="text-gray-900">{category}</p><span className="rounded-full bg-white px-2.5 py-1 text-gray-600">{Array.from(items.values()).reduce((sum,item)=>sum+item.quantity,0)} món</span></div>
          <div className="divide-y divide-gray-100 px-4">{Array.from(items.entries()).sort(([,a],[,b])=>b.quantity-a.quantity||a.name.localeCompare(b.name,"vi")).map(([id,item])=><div key={id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0 break-words text-gray-700">{item.name}</span><span className="shrink-0 rounded-lg bg-red-50 px-3 py-1 text-red-700">× {item.quantity}</span></div>)}</div>
        </div>)}</div>
        {!r.dishDetails.size&&<p className="mt-3 text-gray-400">Chưa có món đã thanh toán.</p>}
      </section>}
    </> : !detailPage && <>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="cashier-tables-title font-normal">Bàn hiện tại ({tableList.length})</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{tableList.map(t=>{const hold=reservations.find(r=>r.table_id===t.id);const occupied=!!(state.orders[String(t.id)]?.lines.length||state.orders[String(t.id)]?.kitchenLines?.length);return <button key={t.id} disabled={busy} onClick={()=>setTableId(t.id)} className={"rounded-xl border p-4 text-left "+(hold?.conflict?"border-red-500 bg-red-100":occupied?"border-red-300 bg-red-50":hold?"border-amber-400 bg-amber-50":"border-gray-200 bg-white")}><RestaurantTableGraphic name={t.name} seats={t.seats} occupied={occupied}/><span className="mt-2 block text-xs text-red-700">{hold?.conflict?"Xung đột · Cần xử lý":occupied?"Đang phục vụ":hold?"Giữ chỗ · Đơn #"+hold.booking_id:"Trống"}</span>{hold&&<span className="mt-1 block text-xs text-gray-600">{hold.customer} · {hold.seats} khách</span>}</button>;})}</div>{!tableList.length&&<p className="mt-3 text-gray-500">Chưa có bàn. Thêm bàn ở trang quản trị nhà hàng.</p>}</section>
      {!shift&&<p className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-800">Vào Chi tiết ca để mở ca trước khi bán hàng.</p>}
    </>)}
    {detailPage&&!shift&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-red-800"><span>Chưa có ca đang mở. Cần mở ca để gọi món, gửi bếp và thanh toán cho bàn.</span><button className={primary} disabled={busy} onClick={()=>{setOpening(0);setModal("open");}}>Mở ca</button></div>}
    {detailPage&&held&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{held.attendance==="arrived"?"Khách đã tới · Đơn #":"Bàn giữ cho đơn #"}{held.booking_id} · {held.customer} · {held.seats} khách.{held.conflict?" Bàn đang có bill hoặc trùng đơn giữ chỗ. Xem cảnh báo xung đột để gửi phương án admin.":held.attendance==="arrived"?"":" Khi thêm món lần đầu, xác nhận tiếp nhận đúng khách của đơn này."}</div>}
    {((detailPage&&table)||editing)&&<div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5"><h2 className="font-normal">{editing?"Chỉnh sửa bill":"Thực đơn"}</h2><input className={input+" mt-3"} placeholder="Tìm món" value={search} onChange={e=>setSearch(e.target.value)}/><div className="my-3 flex flex-wrap gap-2">{categories.map(c=><button key={c} className={category===c?primary:button} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(menu.data??[]).filter(i=>i.is_available&&(category==="Tất cả"||(i.category||"Khác")===category)&&i.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))).map(i=><button key={i.id} disabled={!shift||busy} className="overflow-hidden rounded-xl border text-left disabled:opacity-40" onClick={()=>add(i)}>{i.image_url&&<img src={i.image_url} alt="" className="h-24 w-full object-cover"/>}<div className="p-3"><b>{i.name}</b><span className="block text-red-700">{money(i.price)}</span></div></button>)}</div></section>
      <aside className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-normal">{editing?"Bill #"+editing.slice(-8):"Bàn "+table?.name}</h2>{!editing&&<details className="relative"><summary aria-label="Thao tác bàn" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-2xl font-normal text-gray-600 hover:bg-red-50 [&::-webkit-details-marker]:hidden">⋮</summary><div className="absolute right-0 top-11 z-40 w-44 rounded-xl border border-gray-100 bg-white p-1 shadow-lg"><button disabled={busy||!shift||!order.lines.length} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-red-50 disabled:opacity-40" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");setDestination(null);setModal("move");}}>Chuyển bàn</button><button disabled={busy||!shift||!order.lines.length} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-red-50 disabled:opacity-40" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");setSplitQuantities({});setModal("split");}}>Tách bill</button>{order.kitchenTicket?.length&&<button className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-red-50" onClick={e=>{e.currentTarget.closest("details")?.removeAttribute("open");printReceipt(profile.data?.name??"TableNow",order.kitchenTicket??[]);}}>In lại phiếu bếp</button>}</div></details>}</div>{order.lines.map(l=><div key={l.id} className="border-b border-gray-100 py-3"><div className="flex justify-between text-sm"><b>{l.name}</b><span>{money(l.price*l.quantity)}</span></div><div className="mt-2 flex items-center gap-2"><button disabled={busy} className={button} onClick={()=>qty(l.id,l.quantity-1)}>−</button><input type="number" min="1" value={l.quantity} className="w-16 rounded border border-gray-200 p-1 text-center" disabled={busy} onChange={e=>qty(l.id,Math.max(0,Math.floor(Number(e.target.value))))}/><button disabled={busy} className={button} onClick={()=>qty(l.id,l.quantity+1)}>+</button><button disabled={busy} className={button+" ml-auto text-red-600"} onClick={()=>qty(l.id,0)}>Xóa</button></div></div>)}
      <div className="mt-4 space-y-3">{kitchenPending&&<div className="rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-sm font-normal text-red-800">Có thay đổi món chưa xác nhận cho bếp</p><button disabled={busy||!shift} className={primary+" mt-3 w-full"} onClick={()=>void confirmKitchen()}>Xác nhận và in phiếu bếp</button></div>}{!kitchenPending&&order.kitchenConfirmedAt&&<p className="text-xs text-gray-500">Đã xác nhận cho bếp: {when(order.kitchenConfirmedAt)}</p>}<label className="block text-sm">Số khách<input type="number" min="1" defaultValue={order.guests} key={"guests"+(editing??tableId)} disabled={busy} className={input} onBlur={e=>change({...order,guests:Math.max(1,Math.floor(Number(e.target.value)))})}/></label><label className="block text-sm">Ghi chú<textarea defaultValue={order.note} key={"note"+(editing??tableId)+":"+order.note} disabled={busy} className={input} onBlur={e=>change({...order,note:e.target.value})}/></label><label className="block text-sm">Mã giảm giá<select aria-label="Áp dụng mã giảm giá" value="" disabled={busy} className={input} onChange={e=>{const d=discounts.data?.find(x=>x.id===Number(e.target.value));if(!d)return;if(totals.sub<d.minimum){toast.error("Hóa đơn cần từ "+money(d.minimum)+" để áp dụng mã");return;}change({...order,discount:Math.min(totals.sub,d.kind==="percent"?Math.round(totals.sub*d.value/100):d.value),note:[order.note,"Mã giảm giá: "+d.code].filter(Boolean).join("\n")});}}><option value="">Chọn mã giảm giá</option>{discounts.data?.filter(d=>d.is_active&&new Date(d.expires_at)>new Date()).map(d=><option key={d.id} value={d.id}>{d.code} · Giảm {discountValue(d)}</option>)}</select></label><p className="text-sm text-gray-500">{order.vat ? `VAT ${order.vat}%` : "Không tính VAT"}</p><p>Tạm tính: {money(totals.sub)}</p>{order.discount>0&&<p>Ưu đãi: −{money(order.discount)}</p>}<p>VAT: {money(totals.tax)}</p>{totals.deposit>0&&<p className="text-emerald-700">Khấu trừ tiền cọc: −{money(totals.deposit)}</p>}<p className="text-xl font-normal text-red-700">Tổng: {money(totals.total)}</p><div className="flex flex-wrap gap-2"><button disabled={!order.lines.length||busy} className={button} onClick={()=>billPrint({...order,id:editing??"TAMTINH",table:table?.name??"Bill chỉnh sửa",time:new Date().toISOString(),method:""},true)}>In tạm tính</button><button disabled={!shift||!order.lines.length||busy||kitchenPending} className={primary} onClick={()=>setModal("payment")}>{editing?"Lưu bill":"Thanh toán"}</button>{editing&&<button className={button} onClick={()=>setEditing(null)}>Hủy chỉnh sửa</button>}</div></div></aside>
    </div>}
    {modal&&<div role="dialog" aria-modal="true" aria-labelledby="cashier-modal-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"><div className={"max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 "+(modal==="close"?"max-w-3xl":"max-w-lg")}><div className="flex justify-between"><h2 id="cashier-modal-title" className="text-lg font-normal">{{open:"Mở ca",close:"Đóng ca",payment:"Xác nhận thanh toán",flow:"Tạo phiếu thu / chi",move:"Chuyển bàn",split:"Tách bill",delete:"Xác nhận xóa món"}[modal]}</h2><button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={()=>setModal(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40">✕</button></div>
      {modal==="delete"&&<><p className="my-5 text-sm text-gray-700">Bạn có chắc chắn muốn xóa món <b>{deletingLine?.name}</b>?</p><div className="flex justify-end gap-2"><button className={button} disabled={busy} onClick={()=>{setModal(null);setDeletingId(null);}}>Không</button><button className={primary} disabled={busy} onClick={()=>void deleteItem()}>Có, xóa món</button></div></>}
      {modal==="move"&&table&&<><p className="my-3 text-sm text-gray-600">Chuyển toàn bộ món, ghi chú và giảm giá từ bàn {table.name}.</p><div className="grid grid-cols-2 gap-3">{tableList.filter(t=>t.id!==tableId).map(t=>{const occupied=!!(state.orders[String(t.id)]?.lines.length||state.orders[String(t.id)]?.kitchenLines?.length);const tooSmall=t.seats<order.guests;return <button key={t.id} disabled={busy||occupied||tooSmall||reservedTableIds.has(t.id)} className={"rounded-xl border p-2 disabled:opacity-40 "+(destination===t.id?"border-red-600 bg-red-50":"border-gray-200")} onClick={()=>setDestination(t.id)}><RestaurantTableGraphic name={t.name} seats={t.seats} selected={destination===t.id} occupied={occupied}/><span className="text-xs">{occupied?"Đang phục vụ":reservedTableIds.has(t.id)?"Đã giữ chỗ":tooSmall?"Không đủ chỗ":"Trống"}</span></button>;})}</div><button disabled={busy||!destination} className={primary+" mt-4"} onClick={()=>void moveTable()}>Xác nhận chuyển bàn</button></>}
      {modal==="split"&&<><p className="my-3 text-sm text-gray-600">Chọn số lượng món thanh toán riêng. Giảm giá được chia theo giá trị món; món còn lại vẫn ở bàn.</p>{order.lines.map(l=><label key={l.id} className="flex items-center justify-between gap-3 border-b border-gray-100 py-3"><span className="text-sm"><b>{l.name}</b><span className="block text-gray-500">{money(l.price)} · Tổng {l.quantity}</span></span><input aria-label={"Số lượng tách "+l.name} type="number" min="0" max={l.quantity} step="1" disabled={busy} value={splitQuantities[l.id]??0} onChange={e=>setSplitQuantities({...splitQuantities,[l.id]:Math.min(l.quantity,Math.max(0,Math.floor(Number(e.target.value)||0)))})} className="w-20 rounded-lg border border-gray-200 p-2 text-center"/></label>)}{splitPreview&&<div className="my-4 rounded-xl bg-red-50 p-3 text-sm"><p>Giảm giá bill tách: {money(splitPreview.selected.discount)}</p><p className="font-normal">Bill tách: {money(sums(splitPreview.selected).total)}</p><p>Phần còn lại: {money(sums(splitPreview.remaining).total)}</p></div>}<p className="mt-4 text-sm font-normal">Phương thức thanh toán bill tách</p><div className="mt-2 flex flex-wrap gap-2">{selectableMethods.map(m=><button disabled={busy} key={m} className={method===m?primary:button} onClick={()=>setMethod(m)}>{m}</button>)}</div><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy||!splitPreview||kitchenPending} className={button} onClick={()=>void paySplit(false)}>Xác nhận</button><button disabled={busy||!splitPreview||kitchenPending} className={primary} onClick={()=>void paySplit(true)}>Xác nhận và in bill</button></div></>}
      {modal==="open"&&<><label className="mt-4 block">Tiền đầu ca<input type="number" min="0" className={input} value={opening||""} onChange={e=>setOpening(Math.max(0,Number(e.target.value)))}/></label><button disabled={busy} className={primary+" mt-4"} onClick={async()=>{if(await save({...state,shifts:[{id:crypto.randomUUID(),opened:new Date().toISOString(),openedBy:user?.name,opening,bills:[],flows:[]},...state.shifts]}))setModal(null);}}>Xác nhận mở ca</button></>}
      {modal==="payment"&&<div className="mt-5 space-y-5">
        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-5">
          <div className="flex items-center justify-between gap-3 text-gray-600"><span>{editing?"Bill #"+editing.slice(-8):"Bàn "+(table?.name??"")}</span><span>{order.guests} khách</span></div>
          <div className="mt-4 flex items-end justify-between gap-4"><span className="text-gray-700">Tổng thanh toán</span><h3 className="text-red-700">{money(totals.total)}</h3></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-red-100 pt-3 text-gray-500"><span>Tạm tính: {money(totals.sub)}</span>{order.discount>0&&<span>Giảm: {money(order.discount)}</span>}<span>VAT: {money(totals.tax)}</span>{totals.deposit>0&&<span className="text-emerald-700">Đã đặt cọc: {money(totals.deposit)}</span>}</div>
        </div>
        <fieldset disabled={busy}>
          <legend className="mb-3 text-gray-700">Chọn hình thức khách đã thanh toán</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{selectableMethods.map(m=>{
            const selected=method===m;
            const Icon=m==="Tiền mặt"?Banknote:m==="Chuyển khoản"?Landmark:["ATM","Visa","Apple Pay"].includes(m)?CreditCard:Wallet;
            return <label key={m} className={"relative flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-red-400 "+(selected?"border-red-400 bg-red-50 ring-1 ring-red-200":"border-gray-200 bg-white hover:border-red-200 hover:bg-gray-50")+(busy?" opacity-50":"")}>
              <input type="radio" name="bill-payment-method" value={m} checked={selected} onChange={()=>setMethod(m)} className="sr-only" />
              <span className={"rounded-xl p-2.5 "+(selected?"bg-white text-red-600":"bg-gray-50 text-gray-500")}><Icon size={22}/></span>
              <span className={"min-w-0 flex-1 break-words "+(selected?"text-red-800":"text-gray-700")}>{m}</span>
              <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border "+(selected?"border-red-600 bg-red-600 text-white":"border-gray-300")}>{selected&&<Check size={13}/>}</span>
            </label>;
          })}</div>
        </fieldset>
        {!selectableMethods.length&&<p role="alert" className="rounded-xl bg-gray-50 p-3 text-gray-500">{paymentSettings.isError?"Không tải được phương thức thanh toán.":"Đang tải phương thức thanh toán..."}{paymentSettings.isError&&<button type="button" className="ml-2 text-red-700 underline" onClick={()=>void paymentSettings.refetch()}>Thử lại</button>}</p>}
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row">
          <button type="button" disabled={busy||!selectableMethods.includes(method)||kitchenPending} className={button+" flex-1"} onClick={()=>void pay(false)}>{busy?"Đang xử lý...":"Xác nhận"}</button>
          <button type="button" disabled={busy||!selectableMethods.includes(method)||kitchenPending} className={primary+" inline-flex flex-1 items-center justify-center gap-2"} onClick={()=>void pay(true)}><Printer size={17}/>{busy?"Đang xử lý...":"Xác nhận và in bill"}</button>
        </div>
      </div>}
      {modal==="flow"&&shift&&<><div className="my-4 flex gap-2">{(["Thu","Chi"] as const).map(t=><button key={t} className={flowType===t?primary:button} onClick={()=>setFlowType(t)}>Phiếu {t.toLowerCase()}</button>)}</div><input type="number" min="1" className={input} placeholder="Số tiền" value={amount||""} onChange={e=>setAmount(Math.max(0,Number(e.target.value)))}/><select className={input+" mt-3"} value={method} onChange={e=>setMethod(e.target.value)}>{enabledMethods.map(m=><option key={m}>{m}</option>)}</select><textarea className={input+" mt-3"} placeholder="Lý do" value={reason} onChange={e=>setReason(e.target.value)}/><button disabled={busy||amount<=0||!reason.trim()} className={primary+" mt-4"} onClick={async()=>{if(!enabledMethods.includes(method)){toast.error("Chọn phương thức thanh toán đang hoạt động.");return;}const f:Flow={id:crypto.randomUUID(),type:flowType,amount,method,reason:reason.trim(),time:new Date().toISOString()};if(await save({...state,shifts:state.shifts.map(s=>s.id===shift.id?{...s,flows:[f,...s.flows]}:s)}))setModal(null);}}>Lưu phiếu</button></>}
      {modal==="close"&&shift&&<>{closeStep===1?<><div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{denominations.map(v=><label key={v} className="flex min-w-0 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3"><span>{money(v)}</span><input type="number" min="0" step="1" aria-label={"Số tờ "+money(v)} placeholder="0" className="w-full min-w-0 rounded-lg border border-gray-200 bg-white p-2 text-center" value={notes[v]||""} onChange={e=>setNotes({...notes,[v]:Math.max(0,Math.floor(Number(e.target.value)))})}/></label>)}</div><p className="mt-4 font-normal">Tổng đếm: {money(counted)}</p><p>Trong két theo hệ thống: {money(report(shift).cash)}</p><p>Chênh lệch: {money(counted-report(shift).cash)}</p><button disabled={busy||closeBlocked} className={primary+" mt-4"} onClick={()=>{if(!closeBlocked)setCloseStep(2);}}>Tiếp tục</button>{hasOpenOrders&&<p className="mt-2 text-sm text-red-600">Thanh toán các bàn đang phục vụ và xác nhận các món hủy cho bếp trước khi đóng ca.</p>}{pendingInvoices>0&&<p className="mt-2 text-red-600">Còn {pendingInvoices} bill cần lưu yêu cầu xuất hóa đơn hoặc bỏ qua trong mục Xuất hóa đơn trước khi chốt ca.</p>}</>:<><p className="my-4 font-normal">Bước 2 · Chốt ca và in báo cáo</p><p>Doanh thu: {money(report(shift).revenue)}</p><p>Tiền kiểm đếm: {money(counted)}</p><div className="mt-4 flex gap-2"><button className={button} disabled={busy} onClick={()=>setCloseStep(1)}>Quay lại</button><button className={primary} disabled={busy||closeBlocked} onClick={async()=>{if(closeBlocked){toast.error("Cần xử lý hết đơn và yêu cầu xuất hóa đơn trước khi chốt ca.");return;}const closed={...shift,closed:new Date().toISOString(),closedBy:user?.name,counted};if(await save({...state,shifts:state.shifts.map(s=>s.id===shift.id?closed:s)})){setModal(null);shiftPrint(closed);}}}>Xác nhận và in chốt ca</button></div></>}</>}
    </div></div>}
  </div>;
}
