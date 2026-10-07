type ReceiptBill = {
  invoiceRequest?: { buyerType: "company" | "individual"; customerName: string; companyName: string; taxCode: string; address: string; email: string; phone: string };
  id: string; table: string; time: string; openedAt?: string; cashier?: string;
  guests: number; note: string; discount: number; vat: number; method: string;
  lines: { name: string; quantity: number; price: number }[];
};
type Restaurant = { name: string; address?: string; phone?: string };
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const money = (n: number) => n.toLocaleString("vi-VN") + " đ";
const time = (s?: string) => s ? new Date(s).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) : "—";

export function paymentReceiptHtml(restaurant: Restaurant, bill: ReceiptBill, temporary = false): string {
  const subtotal = bill.lines.reduce((n, line) => n + line.price * line.quantity, 0);
  const discount = Math.min(subtotal, bill.discount);
  const tax = Math.round((subtotal - discount) * bill.vat / 100);
  const total = subtotal - discount + tax;
  const row = (label: string, value: number, prominent = false) => `<div class="sum${prominent ? " total" : ""}"><span>${escape(label)}</span><span>${money(value)}</span></div>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${temporary ? "Phiếu tạm tính" : "Hóa đơn thanh toán"}</title><style>
    *{box-sizing:border-box}body{width:72mm;margin:4mm auto;font:400 12px Arial,sans-serif;line-height:1.4;color:#000;background:#fff}header{text-align:center}p{margin:3px 0}.name{font-size:16px}h1{font-size:19px;font-weight:400;margin:14px 0 3px}.number{margin-bottom:12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;overflow-wrap:anywhere}
    table{border-collapse:collapse;width:100%;table-layout:fixed;margin:8px 0}th,td{border:1px solid #000;padding:5px 2px;overflow-wrap:anywhere;vertical-align:middle}th{font-weight:400}td{text-align:right}td.name-cell{text-align:left;font-size:13px}th:nth-child(1){width:8%}th:nth-child(2){width:32%}th:nth-child(3){width:8%}th:nth-child(4){width:20%}th:nth-child(5){width:9%}th:nth-child(6){width:23%}.center{text-align:center}
    .sum{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.sum span:last-child{white-space:nowrap}.total{border-top:1px solid #000;padding-top:8px;font-size:17px}.note{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:10px}footer{border-top:1px dashed #000;text-align:center;padding-top:10px;margin-top:18px}.notice{font-size:11px}
    @media print{@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0}tr,.sum,footer{break-inside:avoid}}
    </style></head><body><header><p class="name">${escape(restaurant.name)}</p>${restaurant.address ? `<p>Địa chỉ: ${escape(restaurant.address)}</p>` : ""}${restaurant.phone ? `<p>Hotline: ${escape(restaurant.phone)}</p>` : ""}
    <h1>${temporary ? "PHIẾU TẠM TÍNH" : "HÓA ĐƠN THANH TOÁN"}</h1><p class="number">Số HĐ: ${escape(bill.id.slice(-8).toUpperCase())}</p></header>
    <div class="meta"><span>Bàn: ${escape(bill.table)}</span><span>TN: ${escape(bill.cashier ?? "—")}</span><span>Giờ vào: ${time(bill.openedAt)}</span><span>Ngày: ${new Date(bill.time).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span><span>Số khách: ${bill.guests}</span><span>${temporary ? "Giờ in" : "Giờ ra"}: ${time(bill.time)}</span></div>
    <table><thead><tr><th>STT</th><th>Tên món</th><th>SL</th><th>Đơn giá</th><th>VAT</th><th>Thành tiền</th></tr></thead><tbody>${bill.lines.map((line, index) => `<tr><td class="center">${index + 1}</td><td class="name-cell">${escape(line.name)}</td><td class="center">${line.quantity}</td><td>${money(line.price)}</td><td class="center">${bill.vat}%</td><td>${money(line.price * line.quantity)}</td></tr>`).join("")}</tbody></table>
    ${bill.invoiceRequest ? `<section class="note"><p>Thông tin yêu cầu xuất hóa đơn</p><p>Khách hàng: ${escape(bill.invoiceRequest.buyerType === "company" ? bill.invoiceRequest.companyName : bill.invoiceRequest.customerName)}</p>${bill.invoiceRequest.taxCode ? `<p>Mã số thuế: ${escape(bill.invoiceRequest.taxCode)}</p>` : ""}${bill.invoiceRequest.address ? `<p>Địa chỉ: ${escape(bill.invoiceRequest.address)}</p>` : ""}${bill.invoiceRequest.email ? `<p>Email: ${escape(bill.invoiceRequest.email)}</p>` : ""}<p>Trạng thái: Chờ xử lý · Chưa phát hành hóa đơn điện tử</p></section>` : ""}
    ${row("Thành tiền", subtotal)}${row("Giảm giá", -discount)}${row(bill.vat ? `Tiền thuế (VAT ${bill.vat}%)` : "Không tính VAT", tax)}${row("Tổng tiền", total, true)}
    ${temporary ? "" : row(`Thanh toán (${bill.method})`, total)}${bill.note ? `<p class="note">Ghi chú: ${escape(bill.note)}</p>` : ""}
    <footer><p>Cảm ơn Quý khách</p><p>Powered by TableNow</p>${temporary ? "<p class=\"notice\">Phiếu tạm tính · Chưa xác nhận thanh toán</p>" : "<p class=\"notice\">Phiếu thanh toán nội bộ · Không thay thế hóa đơn điện tử</p>"}</footer></body></html>`;
}
