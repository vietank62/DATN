import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import RefundManagement from "./RefundManagement";

type Withdrawal = { id: number; restaurantName: string; amount: number; bank_name: string; account_name: string; account_number: string; qr_image_url?: string | null; status: string; requested_at: string; transfer_proof_url?: string | null; admin_note?: string | null };
type PaymentReview = { id: number; booking_id: number; invoice_number: string; received_amount: string; review_reason: string };
const money = (value: number) => `${value.toLocaleString("vi-VN")}đ`;
const withdrawalBadge: Record<string, string> = { pending: "bg-amber-50 text-amber-700", paid: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700" };
const withdrawalLabel: Record<string, string> = { pending: "Chờ xử lý", paid: "Đã chuyển", rejected: "Đã từ chối" };

function OverviewCard({ label, value, tone }: { label: string; value: string | number; tone: "violet" | "amber" | "blue" }) {
  const styles = { violet: "bg-violet-50 text-violet-700 ring-violet-100", amber: "bg-amber-50 text-amber-700 ring-amber-100", blue: "bg-blue-50 text-blue-700 ring-blue-100" };
  return <div className={`rounded-2xl p-4 ring-1 ${styles[tone]}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

export default function WithdrawalManagement() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Withdrawal | null>(null);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const reviews = useQuery<PaymentReview[]>({ queryKey: ["deposit-payment-reviews"], queryFn: () => api.get("/v1/deposits/admin/payment-reviews").then((response) => response.data) });
  const withdrawals = useQuery<Withdrawal[]>({ queryKey: ["admin-withdrawals"], queryFn: () => api.get("/v1/deposits/admin/withdrawals").then((response) => response.data) });
  const close = () => { setActive(null); setProof(""); setNote(""); };
  const settle = useMutation({
    mutationFn: (action: "pay" | "reject") => api.put(`/v1/deposits/admin/withdrawals/${active?.id}/${action}`, { transfer_proof_url: proof || undefined, admin_note: note || undefined }),
    onSuccess: () => { toast.success("Đã cập nhật yêu cầu rút tiền."); close(); void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] }); },
    onError: (error) => toast.error(axios.isAxiosError(error) ? (error.response?.data?.detail ?? "Không thể cập nhật.") : "Không thể cập nhật."),
  });
  const uploadProof = async (file?: File) => { if (!file) return; try { setProof(await uploadImage(file)); toast.success("Đã tải minh chứng."); } catch { toast.error("Không thể tải minh chứng."); } };
  const rows = withdrawals.data ?? [];
  const pending = rows.filter((item) => item.status === "pending");
  const pendingAmount = pending.reduce((sum, item) => sum + item.amount, 0);

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div><p className="text-sm font-semibold text-violet-600">TÀI CHÍNH NỀN TẢNG</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Rút tiền và hoàn cọc</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">Theo dõi yêu cầu rút tiền của nhà hàng, xử lý hoàn cọc cho khách hàng và đối soát giao dịch đặt cọc cần kiểm tra.</p></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><OverviewCard label="Yêu cầu rút đang chờ" value={pending.length} tone="amber" /><OverviewCard label="Số tiền chờ chuyển" value={money(pendingAmount)} tone="violet" /><OverviewCard label="Giao dịch cần đối soát" value={reviews.data?.length ?? 0} tone="blue" /></div>
    </section>

    {reviews.isError && <section className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Không tải được giao dịch cần đối soát. Vui lòng tải lại trang.</section>}
    {!!reviews.data?.length && <section className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"><div className="border-b border-amber-100 bg-amber-50 px-6 py-4"><h2 className="font-semibold text-amber-900">Thanh toán đặt cọc cần đối soát</h2><p className="mt-1 text-sm text-amber-700">Các giao dịch nhận được chưa thể tự động ghép với đơn đặt bàn.</p></div><div className="divide-y divide-gray-100">{reviews.data.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm"><div><p className="font-semibold text-gray-900">Đơn #{item.booking_id} · {item.invoice_number}</p><p className="mt-1 text-gray-500">{item.review_reason}</p></div><span className="font-semibold text-amber-800">{item.received_amount} VND</span></div>)}</div></section>}

    <RefundManagement />

    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-gray-100 px-6 py-5"><h2 className="text-lg font-bold text-gray-900">Yêu cầu rút tiền của nhà hàng</h2><p className="text-sm text-gray-500">Xác minh thông tin nhận tiền, thực hiện chuyển khoản và lưu chứng từ.</p></div>
      {withdrawals.isLoading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải yêu cầu rút tiền…</div>
        : !rows.length ? <div className="p-10 text-center text-sm text-gray-500">Chưa có yêu cầu rút tiền.</div>
          : <div className="overflow-x-auto"><table className="min-w-[860px] w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3 font-semibold">Nhà hàng</th><th className="px-6 py-3 font-semibold">Thông tin nhận tiền</th><th className="px-6 py-3 text-right font-semibold">Số tiền</th><th className="px-6 py-3 font-semibold">Trạng thái</th><th className="px-6 py-3 text-right font-semibold">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((item) => <tr key={item.id} className="transition-colors hover:bg-gray-50"><td className="px-6 py-4"><p className="font-semibold text-gray-900">{item.restaurantName}</p><p className="mt-1 text-xs text-gray-500">{new Date(item.requested_at).toLocaleString("vi-VN")}</p></td><td className="px-6 py-4 text-gray-600">{item.bank_name ? <><p>{item.bank_name}</p><p className="mt-1 text-xs">{item.account_name} · {item.account_number}</p></> : <a href={item.qr_image_url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 underline">Xem mã QR</a>}</td><td className="px-6 py-4 text-right font-semibold text-gray-900">{money(item.amount)}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${withdrawalBadge[item.status] ?? "bg-gray-100 text-gray-600"}`}>{withdrawalLabel[item.status] ?? item.status}</span></td><td className="px-6 py-4 text-right">{item.status === "pending" && <button onClick={() => setActive(item)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100">Xử lý</button>}</td></tr>)}</tbody></table></div>}
    </section>

    {active && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="withdrawal-dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">RÚT TIỀN NHÀ HÀNG</p><h2 id="withdrawal-dialog-title" className="mt-1 text-xl font-bold text-gray-900">Yêu cầu #{active.id}</h2><p className="mt-2 text-sm leading-6 text-gray-500">Chuyển <strong className="text-gray-900">{money(active.amount)}</strong> cho {active.restaurantName}, sau đó tải minh chứng bắt buộc.</p><div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm"><p className="font-semibold text-gray-800">{active.bank_name || "Nhận qua mã QR"}</p>{active.bank_name && <p className="mt-1 text-gray-600">{active.account_name} · {active.account_number}</p>}</div><div className="mt-5"><p className="text-sm font-semibold text-gray-800">Ảnh/chứng từ chuyển khoản <span className="text-red-600">*</span></p><input id="withdrawal-transfer-proof" type="file" accept="image/*" onChange={(event) => void uploadProof(event.target.files?.[0])} className="sr-only" /><label htmlFor="withdrawal-transfer-proof" className="mt-2 inline-flex cursor-pointer rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100">Chọn minh chứng từ máy</label></div>{proof && <img src={proof} className="mt-3 h-32 rounded-xl border object-cover" alt="Minh chứng" />}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cho nhà hàng (tùy chọn)" className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-violet-400" rows={3} /><div className="mt-5 flex flex-wrap justify-end gap-3"><button onClick={close} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700">Đóng</button><button onClick={() => settle.mutate("reject")} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">Từ chối</button><button disabled={!proof || settle.isPending} onClick={() => settle.mutate("pay")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Xác nhận đã chuyển</button></div></div></div>}
  </div>;
}