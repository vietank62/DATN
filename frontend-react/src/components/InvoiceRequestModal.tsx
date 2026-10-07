import { useState } from "react";

export type InvoiceRequest = {
  buyerType: "company" | "individual";
  email: string; customerName: string; companyName: string; taxCode: string;
  address: string; phone: string; bankName: string; bankAccount: string;
  budgetCode: string; identityNumber: string; passportNumber: string; note: string;
  requestedAt: string; status: "requested";
};
const blank: InvoiceRequest = { buyerType: "company", email: "", customerName: "", companyName: "", taxCode: "", address: "", phone: "", bankName: "", bankAccount: "", budgetCode: "", identityNumber: "", passportNumber: "", note: "", requestedAt: "", status: "requested" };
type Field = Exclude<keyof InvoiceRequest, "buyerType" | "requestedAt" | "status">;
const fields: {key: Field; label: string; type?: string}[] = [
  {key:"email",label:"Email nhận hóa đơn",type:"email"}, {key:"taxCode",label:"Mã số thuế"},
  {key:"customerName",label:"Tên khách hàng"}, {key:"companyName",label:"Tên công ty"},
  {key:"address",label:"Địa chỉ"}, {key:"phone",label:"Số điện thoại",type:"tel"},
  {key:"bankName",label:"Tên ngân hàng"}, {key:"bankAccount",label:"Số tài khoản"},
  {key:"budgetCode",label:"Mã đơn vị dự toán"}, {key:"identityNumber",label:"CMND / CCCD"},
  {key:"passportNumber",label:"Số hộ chiếu"},
];

export default function InvoiceRequestModal({initial,billNumber,busy,onClose,onSkip,onSave}:{initial?:InvoiceRequest;billNumber:string;busy:boolean;onClose:()=>void;onSkip:()=>Promise<void>;onSave:(data:InvoiceRequest,print:boolean)=>Promise<boolean>}){
  const [form,setForm]=useState<InvoiceRequest>(initial??blank);
  const [error,setError]=useState("");
  async function submit(print:boolean){
    const clean=Object.fromEntries(Object.entries(form).map(([key,value])=>[key,typeof value==="string"?value.trim():value])) as InvoiceRequest;
    if(clean.buyerType==="company"&&(!clean.companyName||!clean.taxCode||!clean.address)){setError("Vui lòng nhập tên công ty, mã số thuế và địa chỉ.");return;}
    if(clean.buyerType==="individual"&&!clean.customerName){setError("Vui lòng nhập tên khách hàng.");return;}
    setError("");
    await onSave({...clean,status:"requested",requestedAt:initial?.requestedAt||new Date().toISOString()},print);
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="invoice-request-title" className="fixed inset-0 z-60 flex items-center justify-center bg-gray-950/50 p-3 backdrop-blur-sm sm:p-6" onClick={()=>{if(!busy)onClose();}} onKeyDown={e=>{if(e.key==="Escape"&&!busy)onClose();if(e.key==="Tab"){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')).filter(x=>!x.closest('fieldset:disabled'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
    <form onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const print=(e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-print")==="true";if(!busy)void submit(print);}} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4"><div><h2 id="invoice-request-title">Thông tin xuất hóa đơn</h2><p className="mt-1 text-gray-500">Bill #{billNumber}</p></div><button autoFocus type="button" disabled={busy} onClick={onClose} aria-label="Đóng thông tin hóa đơn" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50">✕</button></header>
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain p-5 sm:p-6">
      <fieldset disabled={busy} className="min-w-0">
        <p className="mb-5 rounded-xl border border-red-100 bg-red-50 p-3 text-red-800">Thông tin được lưu để nhà hàng xử lý yêu cầu xuất hóa đơn. Chưa phát hành hóa đơn điện tử qua nhà cung cấp.</p>
        <div className="mb-5 flex gap-5">{(["company","individual"] as const).map(type=><label key={type} className="flex items-center gap-2"><input type="radio" name="invoice-buyer-type" value={type} checked={form.buyerType===type} onChange={()=>setForm({...form,buyerType:type})} className="h-4 w-4 accent-red-600" />{type==="company"?"Công ty":"Cá nhân"}</label>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{fields.filter(field=>form.buyerType==="company"||!["companyName","budgetCode"].includes(field.key)).map(field=>{
          const required=form.buyerType==="company"?["companyName","taxCode","address"].includes(field.key):field.key==="customerName";
          return <label key={field.key} htmlFor={"invoice-"+field.key} className={"block text-gray-600 "+(field.key==="address"?"sm:col-span-2":"")}>{field.label}{required&&<span className="text-red-600"> *</span>}<input id={"invoice-"+field.key} type={field.type??"text"} required={required} maxLength={field.key==="address"?500:255} value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>;
        })}</div>
        <label htmlFor="invoice-note" className="mt-4 block text-gray-600">Ghi chú<textarea id="invoice-note" rows={3} maxLength={2000} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
        {error&&<p role="alert" className="mt-3 text-red-700">{error}</p>}
      </fieldset>
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4"><button type="button" disabled={busy} onClick={()=>{if(initial)onClose();else void onSkip();}} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 disabled:opacity-50">{initial ? "Đóng" : "Bỏ qua"}</button><button type="submit" data-print="true" disabled={busy} className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-red-700 disabled:opacity-50">Lưu và in phiếu</button><button type="submit" disabled={busy} className="rounded-xl bg-red-600 px-4 py-2.5 text-white hover:bg-red-700 disabled:opacity-50">{busy?"Đang lưu...":"Lưu yêu cầu xuất hóa đơn"}</button></footer>
    </form>
  </div>;
}
