import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { useAuth } from "../../hooks/useAuth";
import { refundError, refundLabels, refundMoney, type DepositRefund } from "../../services/refund";

export default function RefundManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<DepositRefund | null>(null);
  const [proof, setProof] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const q = useQuery<DepositRefund[]>({
    queryKey: ["admin-refunds", user?.userId, offset],
    queryFn: ({ signal }) => api.get(`/v1/deposits/admin/refunds?limit=21&offset=${offset}`, { signal }).then(r => r.data),
    refetchInterval: 30000, gcTime: 0,
  });
  const settle = useMutation({
    mutationFn: () => api.put(`/v1/deposits/admin/refunds/${active?.id}/complete`, { proof_url: proof }),
    onSuccess: () => { toast.success("Đã xác nhận hoàn cọc và gửi thông báo cho khách."); setActive(null); void qc.invalidateQueries({ queryKey: ["admin-refunds"] }); },
    onError: e => setError(refundError(e, "Chưa thể xác nhận hoàn cọc.")),
  });
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setError("");
    try { setProof(await uploadImage(file)); } catch { setError("Chưa tải được minh chứng. Hãy chọn ảnh PNG/JPG/WebP/GIF tối đa 10 MB và thử lại."); } finally { setUploading(false); }
  }
  const busy = settle.isPending || uploading;
  return <section id="refunds" className="rounded-2xl border bg-white p-5 space-y-4">
    <h2 className="text-xl font-bold">Hoàn cọc cho khách hàng</h2>
    <p className="text-sm text-gray-600">Các đơn nhà hàng không phản hồi đúng hạn. Khách gửi tài khoản trước khi quản trị viên chuyển hoàn tiền.</p>
    {q.isLoading && <p>Đang tải yêu cầu hoàn cọc…</p>}
    {q.isError && <button onClick={() => void q.refetch()} className="text-red-600">Chưa tải được danh sách. Thử lại</button>}
    {q.data?.length === 0 && <p>Chưa có yêu cầu hoàn cọc.</p>}
    {q.data?.slice(0,20).map(refund => <article key={refund.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div><p className="font-bold">Đơn #{refund.booking_id} · {refund.restaurant_name}</p><p>{refundMoney(refund.amount)} · {refundLabels[refund.status]}</p></div>
      <button onClick={() => { setActive(refund); setProof(""); setConfirmed(false); setError(""); }} className="rounded-lg border px-4 py-2 text-sm font-semibold">Xem yêu cầu</button>
    </article>)}
    {(offset > 0 || (q.data?.length ?? 0) > 20) && <nav className="flex gap-3"><button disabled={offset === 0 || q.isFetching} onClick={() => setOffset(v => Math.max(0,v-20))}>Trang trước</button><span>Trang {offset/20+1}</span><button disabled={(q.data?.length ?? 0) <= 20 || q.isFetching} onClick={() => setOffset(v => v+20)}>Trang tiếp</button></nav>}
    {active && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 space-y-4">
      <h3 id="refund-dialog-title" className="text-xl font-bold">Hoàn cọc đơn #{active.booking_id}</h3>
      <p>Số tiền: <strong>{refundMoney(active.amount)}</strong> · {refundLabels[active.status]}</p>
      {active.status === "pending" ? <p>Khách chưa gửi thông tin nhận tiền.</p> : <dl className="space-y-2 break-words"><dt className="font-semibold">Ngân hàng</dt><dd>{active.bank_name}</dd><dt className="font-semibold">Số tài khoản</dt><dd>{active.account_number}</dd><dt className="font-semibold">Tên người nhận</dt><dd>{active.account_name}</dd></dl>}
      {active.qr_image_url && <a href={active.qr_image_url} target="_blank" rel="noreferrer"><img src={active.qr_image_url} alt="QR nhận hoàn cọc của khách" className="h-48 w-48 object-contain" /></a>}
      {active.proof_url && <a href={active.proof_url} target="_blank" rel="noreferrer" className="block text-blue-700 underline">Xem minh chứng đã hoàn</a>}
      {active.status === "processing" && <fieldset disabled={busy} className="space-y-3">
        <label className="block font-semibold">Minh chứng đã chuyển tiền *<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => void upload(e.target.files?.[0])} className="mt-2 block w-full text-sm font-normal" /></label>
        {proof && <img src={proof} alt="Minh chứng chuyển hoàn tiền" className="h-40 object-contain" />}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi đã chuyển đúng số tiền đến tài khoản của khách.</label>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {active.status === "processing" && <button disabled={busy || !proof || !confirmed} onClick={() => settle.mutate()} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : "Xác nhận đã hoàn cọc"}</button>}
        <button disabled={busy} onClick={() => setActive(null)} className="rounded-xl border px-4 py-3">Đóng</button>
      </div>
    </div></div>}
  </section>;
}
