import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { useAuth } from "../../hooks/useAuth";
import { refundError, refundLabels, refundMoney, type DepositRefund } from "../../services/refund";
import type { BookingDetail } from "../../types/booking";

const badgeStyle: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
};

export default function RefundManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<DepositRefund | null>(null);
  const [proof, setProof] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const refunds = useQuery<DepositRefund[]>({
    queryKey: ["admin-refunds", user?.userId, offset],
    queryFn: ({ signal }) => api.get(`/v1/deposits/admin/refunds?limit=21&offset=${offset}`, { signal }).then((response) => response.data),
    refetchInterval: 30000,
    gcTime: 0,
  });
  const bookingDetail = useQuery<BookingDetail>({
    queryKey: ["admin-refund-booking", active?.booking_id],
    queryFn: ({ signal }) => api.get(`/v1/bookings/${active?.booking_id}`, { signal }).then((response) => response.data),
    enabled: !!active?.booking_id,
  });
  const settle = useMutation({
    mutationFn: () => api.put(`/v1/deposits/admin/refunds/${active?.id}/complete`, { proof_url: proof }),
    onSuccess: () => {
      toast.success("Đã xác nhận hoàn cọc và gửi thông báo cho khách.");
      setActive(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
    },
    onError: (reason) => setError(refundError(reason, "Chưa thể xác nhận hoàn cọc.")),
  });
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      setProof(await uploadImage(file));
      setProofFileName(file.name);
      toast.success("Đã tải minh chứng chuyển hoàn.");
    } catch {
      setError("Chưa tải được minh chứng. Hãy chọn ảnh PNG/JPG/WebP/GIF tối đa 10 MB và thử lại.");
    } finally {
      setUploading(false);
    }
  };
  const busy = settle.isPending || uploading;
  const rows = refunds.data?.slice(0, 20) ?? [];

  return <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Hoàn cọc cho khách hàng</h2>
        <p className="mt-1 text-sm text-gray-500">Chỉ xử lý sau khi khách đã gửi thông tin nhận hoàn cọc.</p>
      </div>
      <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{rows.filter((refund) => refund.status === "processing").length} yêu cầu sẵn sàng xử lý</span>
    </div>

    {refunds.isLoading ? <div className="p-10 text-center text-sm text-gray-400">Đang tải yêu cầu hoàn cọc…</div>
      : refunds.isError ? <div className="p-10 text-center"><button onClick={() => void refunds.refetch()} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Tải lại danh sách</button></div>
        : !rows.length ? <div className="p-10 text-center text-sm text-gray-500">Chưa có yêu cầu hoàn cọc.</div>
          : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
              <th className="px-6 py-3 font-semibold">Đơn / Nhà hàng</th><th className="px-6 py-3 font-semibold">Số tiền hoàn</th><th className="px-6 py-3 font-semibold">Trạng thái</th><th className="px-6 py-3 text-right font-semibold">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">{rows.map((refund) => <tr key={refund.id} className="transition-colors hover:bg-gray-50">
              <td className="px-6 py-4"><p className="font-semibold text-gray-900">Đơn #{refund.booking_id}</p><p className="mt-0.5 text-xs text-gray-500">{refund.restaurant_name}</p></td>
              <td className="px-6 py-4 font-semibold text-gray-800">{refundMoney(refund.amount)}</td>
              <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyle[refund.status] ?? "bg-gray-100 text-gray-600"}`}>{refundLabels[refund.status]}</span></td>
              <td className="px-6 py-4 text-right"><button onClick={() => { setActive(refund); setProof(""); setProofFileName(""); setConfirmed(false); setError(""); }} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100">Xem chi tiết</button></td>
            </tr>)}</tbody>
          </table></div>}

    {(offset > 0 || (refunds.data?.length ?? 0) > 20) && <nav className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 text-sm"><button disabled={offset === 0 || refunds.isFetching} onClick={() => setOffset((value) => Math.max(0, value - 20))} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button><span className="text-gray-500">Trang {offset / 20 + 1}</span><button disabled={(refunds.data?.length ?? 0) <= 20 || refunds.isFetching} onClick={() => setOffset((value) => value + 20)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang tiếp</button></nav>}

    {active && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" className="max-h-[90vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">HOÀN CỌC</p><h3 id="refund-dialog-title" className="mt-1 text-xl font-bold text-gray-900">Đơn #{active.booking_id}</h3><p className="mt-1 text-sm text-gray-500">{active.restaurant_name} · <strong className="text-gray-800">{refundMoney(active.amount)}</strong></p></div>
      <section className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h4 className="text-sm font-bold text-gray-900">Thông tin đơn đặt bàn</h4>
        {bookingDetail.isLoading ? <p className="mt-3 text-sm text-gray-500">Đang tải chi tiết đơn…</p>
          : bookingDetail.isError ? <button type="button" onClick={() => void bookingDetail.refetch()} className="mt-3 text-sm font-semibold text-violet-700 underline">Không tải được chi tiết đơn. Thử lại</button>
            : bookingDetail.data && <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-gray-500">Nhà hàng</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.restaurantName ?? active.restaurant_name}</p></div><div><p className="text-gray-500">Thời gian dùng bữa</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.date} · {bookingDetail.data.time.slice(0, 5)}</p></div><div><p className="text-gray-500">Khách đặt bàn</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.contactName}</p><p className="text-xs text-gray-600">{bookingDetail.data.contactPhone} · {bookingDetail.data.contactEmail}</p></div><div><p className="text-gray-500">Số khách / tiền cọc</p><p className="mt-1 font-semibold text-gray-900">{bookingDetail.data.guestCount} người · {refundMoney(bookingDetail.data.depositAmount)}</p></div>{bookingDetail.data.note && <div className="sm:col-span-2"><p className="text-gray-500">Ghi chú</p><p className="mt-1 text-gray-800">{bookingDetail.data.note}</p></div>}{bookingDetail.data.booking_items.length > 0 && <div className="sm:col-span-2"><p className="text-gray-500">Món đã chọn</p><p className="mt-1 text-gray-800">{bookingDetail.data.booking_items.map((item) => `${item.name} × ${item.quantity}`).join(", ")}</p></div>}</div>}
      </section>
      {active.status === "pending" ? <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Khách chưa gửi thông tin nhận tiền. Chưa thể thực hiện hoàn cọc.</div>
        : <dl className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">Ngân hàng</dt><dd className="mt-1 font-semibold text-gray-900">{active.bank_name}</dd></div><div><dt className="text-gray-500">Tên người nhận</dt><dd className="mt-1 font-semibold text-gray-900">{active.account_name}</dd></div><div className="sm:col-span-2"><dt className="text-gray-500">Số tài khoản</dt><dd className="mt-1 font-semibold text-gray-900">{active.account_number}</dd></div></dl>}
      {active.qr_image_url && <a href={active.qr_image_url} target="_blank" rel="noreferrer" className="block w-fit"><img src={active.qr_image_url} alt="QR nhận hoàn cọc của khách" className="h-36 w-36 rounded-xl border bg-white object-contain" /></a>}
      {active.proof_url && <a href={active.proof_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-violet-700 underline">Xem minh chứng đã hoàn</a>}
      {active.status === "processing" && <fieldset disabled={busy} className="space-y-3"><div><p className="text-sm font-semibold text-gray-800">Minh chứng đã chuyển tiền <span className="text-red-600">*</span></p><input id="refund-transfer-proof" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void upload(event.target.files?.[0])} /><div className="mt-2 flex flex-wrap items-center gap-3"><label htmlFor="refund-transfer-proof" className="cursor-pointer rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-100">Chọn tệp</label><span className="max-w-full truncate text-sm text-gray-500">{uploading ? "Đang tải tệp…" : proofFileName || "Chưa chọn tệp"}</span>{proof && !uploading && <button type="button" onClick={() => { setProof(""); setProofFileName(""); }} className="text-sm font-semibold text-gray-600 underline hover:text-red-600">Hủy tệp đã chọn</button>}</div></div>{proof && <img src={proof} alt="Minh chứng chuyển hoàn tiền" className="h-40 rounded-xl border object-contain" />}<label className="flex items-start gap-2 text-sm text-gray-700"><input className="mt-0.5" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Tôi đã chuyển đúng số tiền đến tài khoản của khách.</label></fieldset>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3"><button disabled={busy} onClick={() => setActive(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700">Đóng</button>{active.status === "processing" && <button disabled={busy || !proof || !confirmed} onClick={() => settle.mutate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : "Xác nhận đã hoàn cọc"}</button>}</div>
    </div></div>}
  </section>;
}