const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Thermal 80mm kitchen slip; saved rows are reused unchanged for reprints. */
export function kitchenReceiptHtml(restaurant: string, rows: string[]): string {
  const value = (prefix: string) => rows.find(row => row.startsWith(prefix))?.slice(prefix.length).trim() ?? "—";
  const items = rows.flatMap(row => {
    const match = row.match(/^(THÊM|GIẢM|HỦY): (.*) × (\d+)(?: \(còn (\d+)\))?$/);
    if (!match) return [];
    const [, action, name, quantity, remaining] = match;
    return [`<tr><td>${escape(name)}${action === "THÊM" ? "" : `<small>${action === "HỦY" ? "HỦY MÓN" : `GIẢM MÓN · còn ${remaining}`}</small>`}</td><td class="quantity">${quantity}</td><td class="unit">Món</td></tr>`];
  });
  const notes = rows.filter(row => row.startsWith("Ghi chú:") || row.startsWith("CẬP NHẬT GHI CHÚ:"));
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu bếp</title><style>
    *{box-sizing:border-box}body{width:72mm;margin:4mm auto;color:#000;background:#fff;font:400 14px Arial,sans-serif;line-height:1.4}
    header{text-align:center}h1{font-size:25px;font-weight:400;margin:4px 0;overflow-wrap:anywhere}h2{font-size:21px;font-weight:400;margin:4px 0 12px}.restaurant{font-size:12px;margin:0 0 6px}
    .meta{margin:5px 0}.time{display:flex;justify-content:space-between;gap:8px}.time span{white-space:nowrap}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:8px}
    th,td{border:1px solid #000;padding:8px 5px;vertical-align:middle;overflow-wrap:anywhere}th{font-size:16px;font-weight:400}th:first-child{width:65%}th:nth-child(2){width:15%}th:last-child{width:20%}td:first-child{font-size:19px}td.quantity{font-size:24px;text-align:center}.unit{text-align:center;font-size:16px}
    small{display:block;font-size:13px;margin-top:5px}.note{white-space:pre-wrap;border-top:1px dashed #000;margin-top:10px;padding-top:8px}footer{text-align:center;margin-top:12px;font-size:14px}
    @media print{@page{size:80mm auto;margin:4mm}body{margin:0;width:72mm}tr{break-inside:avoid}header,footer{break-inside:avoid}}
    </style></head><body><header><p class="restaurant">${escape(restaurant)}</p><h1>${escape(value("Bàn:"))}</h1><h2>${escape(value("Mã phiếu:"))}</h2></header>
    <p class="meta">Nhân viên: ${escape(value("Nhân viên:"))}</p>
    <div class="time"><span>Giờ: ${escape(value("Giờ:"))}</span><span>Ngày: ${escape(value("Ngày:"))}</span></div>
    <p class="meta">Lần gửi bếp: ${escape(value("Lần gửi:"))}</p>
    ${items.length ? `<table><thead><tr><th>Tên món</th><th>SL</th><th>ĐVT</th></tr></thead><tbody>${items.join("")}</tbody></table>` : "<p>Cập nhật ghi chú</p>"}
    ${notes.map(note=>`<p class="note">${escape(note)}</p>`).join("")}<footer>Powered by TableNow</footer></body></html>`;
}
