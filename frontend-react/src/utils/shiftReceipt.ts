type ShiftBill = { method: string; discount: number; vat: number; guests?: number; lines: { id?: number | string; name: string; price: number; quantity: number; category: string }[] };
export type ReceiptShift = { id: string; opened: string; closed?: string; openedBy?: string; closedBy?: string; opening: number; counted?: number; bills: ShiftBill[]; flows: { type: string; method: string; amount: number }[] };
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const money = (n: number) => n.toLocaleString("vi-VN") + " đ";
const date = (s?: string) => s ? new Date(s).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";

export function shiftReceiptSummary(shift: ReceiptShift) {
  let gross=0,discount=0,vat=0;
  const categories=new Map<string,{quantity:number;revenue:number}>();
  const dishes=new Map<string,Map<string,{name:string;quantity:number}>>();
  const methods=new Map<string,{bills:number;sales:number;income:number;expense:number}>();
  const method=(name:string)=>{if(!methods.has(name))methods.set(name,{bills:0,sales:0,income:0,expense:0});return methods.get(name)!;};
  for(const bill of shift.bills){
    const subtotal=bill.lines.reduce((sum,line)=>sum+line.price*line.quantity,0);
    const applied=Math.min(subtotal,bill.discount),net=Math.max(0,subtotal-applied),tax=Math.round(net*bill.vat/100);
    gross+=subtotal;discount+=applied;vat+=tax;
    const payment=method(bill.method);payment.bills+=1;payment.sales+=net+tax;
    let allocated=0;
    bill.lines.forEach((line,index)=>{
      const revenue=index===bill.lines.length-1?net-allocated:subtotal>0?Math.round(net*line.price*line.quantity/subtotal):0;
      allocated+=revenue;
      const category=line.category||"Khác",previous=categories.get(category)??{quantity:0,revenue:0};
      categories.set(category,{quantity:previous.quantity+line.quantity,revenue:previous.revenue+revenue});
      if(!dishes.has(category))dishes.set(category,new Map());
      const categoryDishes=dishes.get(category)!,key=String(line.id??line.name);
      const dish=categoryDishes.get(key)??{name:line.name,quantity:0};
      categoryDishes.set(key,{name:dish.name,quantity:dish.quantity+line.quantity});
    });
  }
  let income=0,expense=0;
  for(const flow of shift.flows){const payment=method(flow.method);if(flow.type==="Thu"){income+=flow.amount;payment.income+=flow.amount;}else{expense+=flow.amount;payment.expense+=flow.amount;}}
  const sales=gross-discount+vat,cash=methods.get("Tiền mặt");
  const expectedCash=shift.opening+(cash?cash.sales+cash.income-cash.expense:0);
  const guestCount=shift.bills.reduce((sum,bill)=>sum+(bill.guests??0),0);
  return {gross,discount,vat,sales,income,expense,revenue:sales+income-expense,expectedCash,guestCount,categories,dishes,methods};
}

export function shiftReceiptHtml(restaurant:{name:string;address?:string;phone?:string},shift:ReceiptShift):string{
  const summary=shiftReceiptSummary(shift);
  const row=(label:string,value:string,total=false)=>`<div class="row${total?" total":""}"><span>${escape(label)}</span><span>${escape(value)}</span></div>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu chốt ca</title><style>
    *{box-sizing:border-box}body{width:72mm;margin:4mm auto;font:400 13px Arial,sans-serif;line-height:1.5;color:#000;background:#fff}header{text-align:center}h1{font-size:19px;font-weight:400;margin:10px 0}h2{font-size:14px;font-weight:400;margin:16px 0 6px}p{margin:4px 0;overflow-wrap:anywhere}.row{display:flex;justify-content:space-between;gap:10px;margin:5px 0}.row span:last-child{text-align:right;white-space:nowrap}.total{border-top:1px dashed #000;padding-top:6px;font-size:15px}.section{border-top:1px dashed #000;padding-top:7px;margin-top:12px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:6px}th,td{text-align:right;padding:5px 2px;vertical-align:top;overflow-wrap:anywhere}th{font-weight:400;border-bottom:1px solid #000}th:first-child,td:first-child{text-align:left;width:45%}th:nth-child(2){width:16%}th:last-child{width:39%}.note{font-size:11px;margin-top:6px}footer{text-align:center;border-top:1px dashed #000;margin-top:16px;padding-top:10px}
    @media print{@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0}.row,tr,footer{break-inside:avoid}thead{display:table-header-group}}
    </style></head><body><header><p>${escape(restaurant.name)}</p>${restaurant.address?`<p>${escape(restaurant.address)}</p>`:""}${restaurant.phone?`<p>Hotline: ${escape(restaurant.phone)}</p>`:""}<h1>PHIẾU CHỐT CA</h1></header>
    ${row("Mã ca",shift.id.slice(-8).toUpperCase())}${row("Mở ca",date(shift.opened))}${row("Đóng ca",date(shift.closed))}${row("Nhân viên mở ca",shift.openedBy??"—")}${row("Nhân viên chốt ca",shift.closedBy??"—")}${row("Giờ in",date(new Date().toISOString()))}${row("Số dư đầu ca",money(shift.opening))}
    <section class="section">${row("Doanh thu trước giảm giá",money(summary.gross))}${row("Tổng giảm giá",money(summary.discount))}${row("Doanh thu chưa VAT",money(summary.gross-summary.discount))}${row("Tổng VAT",money(summary.vat))}${row("Doanh thu bán hàng",money(summary.sales),true)}${row("Tiền thu khác",money(summary.income))}${row("Tiền chi",money(summary.expense))}${row("Doanh thu ca",money(summary.revenue),true)}${row("Số hóa đơn",String(shift.bills.length))}${row("Số khách đã ghi nhận",String(summary.guestCount))}${row("Trung bình hóa đơn",money(shift.bills.length?Math.round(summary.sales/shift.bills.length):0))}</section>
    <section class="section"><h2>PHƯƠNG THỨC THANH TOÁN</h2><table><thead><tr><th>Phương thức</th><th>Số HĐ</th><th>Số tiền</th></tr></thead><tbody>${Array.from(summary.methods.entries()).map(([name,value])=>`<tr><td>${escape(name)}</td><td>${value.bills}</td><td>${money(value.sales+value.income-value.expense)}</td></tr>`).join("")}</tbody></table><p class="note">Số tiền gồm bill thanh toán và thu/chi khác theo từng phương thức.</p></section>
    <section class="section"><h2>KIỂM ĐẾM TIỀN MẶT</h2>${row("Trong két theo hệ thống",money(summary.expectedCash))}${row("Tiền mặt kiểm đếm",shift.counted===undefined?"—":money(shift.counted))}${row("Chênh lệch",shift.counted===undefined?"—":money(shift.counted-summary.expectedCash),true)}</section>
    <section class="section"><h2>MÓN ĐÃ THANH TOÁN</h2><table><thead><tr><th>Nhóm / tên món</th><th>Số món</th><th>Doanh thu</th></tr></thead><tbody>${Array.from(summary.categories.entries()).sort(([a],[b])=>a.localeCompare(b,"vi")).map(([name,value])=>`<tr><td>${escape(name)}</td><td>${value.quantity}</td><td>${money(value.revenue)}</td></tr>${Array.from(summary.dishes.get(name)?.values()??[]).sort((a,b)=>a.name.localeCompare(b.name,"vi")).map(dish=>`<tr><td style="padding-left:10px">↳ ${escape(dish.name)}</td><td>${dish.quantity}</td><td></td></tr>`).join("")}`).join("")}</tbody></table><p class="note">Doanh thu nhóm món đã phân bổ giảm giá, chưa bao gồm VAT.</p></section>
    <footer><p>Powered by TableNow</p></footer></body></html>`;
}
