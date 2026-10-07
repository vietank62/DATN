import { api } from "../services/api";
import { toast } from "sonner";

export type ReceiptRestaurant = { name: string; address?: string; phone?: string };

// Fetch on every print, including reprints, rather than using a stale query cache.
export async function printRestaurantReceipt(render: (restaurant: ReceiptRestaurant) => string, preparedWindow?: Window) {
  const win = preparedWindow ?? window.open("", "_blank", "width=420,height=720");
  if (!win) { toast.error("Cho phép cửa sổ bật lên để in phiếu."); return; }
  win.document.body.textContent = "Đang cập nhật thông tin nhà hàng…";
  try {
    const { data: restaurant } = await api.get<{id:number;name:string;address?:string}>("/v1/partners/application/me");
    const { data: detail } = await api.get<{phone_number?:string}>(`/v1/details/${restaurant.id}`);
    if (win.closed) return;
    win.document.open();
    win.document.write(render({name:restaurant.name,address:restaurant.address,phone:detail.phone_number}));
    win.document.close();
    win.focus();
    win.print();
  } catch {
    win.close();
    toast.error("Không tải được thông tin nhà hàng mới nhất. Vui lòng in lại.");
  }
}
