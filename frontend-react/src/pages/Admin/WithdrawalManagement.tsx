import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
type Withdrawal = {
  id: number;
  restaurantName: string;
  amount: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url?: string | null;
  status: string;
  requested_at: string;
  transfer_proof_url?: string | null;
  admin_note?: string | null;
};
const money = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
export default function WithdrawalManagement() {
  const reviewsQ = useQuery<Array<{ id: number; booking_id: number; invoice_number: string; received_amount: string; review_reason: string }>>({
    queryKey: ["deposit-payment-reviews"],
    queryFn: () => api.get("/v1/deposits/admin/payment-reviews").then(r => r.data),
  });
  const qc = useQueryClient();
  const [active, setActive] = useState<Withdrawal | null>(null);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const withdrawalsQ = useQuery<Withdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: () =>
      api.get("/v1/deposits/admin/withdrawals").then((r) => r.data),
  });
  const close = () => {
    setActive(null);
    setProof("");
    setNote("");
  };
  const settle = useMutation({
    mutationFn: (action: "pay" | "reject") =>
      api.put(`/v1/deposits/admin/withdrawals/${active?.id}/${action}`, {
        transfer_proof_url: proof || undefined,
        admin_note: note || undefined,
      }),
    onSuccess: () => {
      toast.success("Đã cập nhật yêu cầu rút tiền.");
      close();
      void qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (error) =>
      toast.error(
        axios.isAxiosError(error)
          ? (error.response?.data?.detail ?? "Không thể cập nhật.")
          : "Không thể cập nhật.",
      ),
  });
  const uploadProof = async (file?: File) => {
    if (!file) return;
    try {
      setProof(await uploadImage(file));
      toast.success("Đã tải minh chứng.");
    } catch {
      toast.error("Không thể tải minh chứng.");
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {reviewsQ.isError && <p className="text-red-600">Không tải được giao dịch cần đối soát.</p>}
      {!!reviewsQ.data?.length && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h2 className="font-bold text-amber-900">Thanh toán đặt cọc cần đối soát</h2>
          {reviewsQ.data.map(item => <div key={item.id} className="text-sm text-amber-900">
            <p>Đơn #{item.booking_id} · {item.invoice_number}</p>
            <p>{item.received_amount} VND · {item.review_reason}</p>
          </div>)}
        </section>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Duyệt yêu cầu rút tiền
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kiểm tra tiền đặt cọc, chuyển khoản cho nhà hàng và lưu minh chứng.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-5 py-3">Nhà hàng</th>
                <th className="px-5 py-3">Nhận tiền</th>
                <th className="px-5 py-3">Số tiền</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(withdrawalsQ.data ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {item.restaurantName}
                    <p className="mt-1 text-xs font-normal text-gray-400">
                      {new Date(item.requested_at).toLocaleString("vi-VN")}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {item.bank_name ? (
                      <>
                        {item.bank_name}
                        <br />
                        {item.account_name} · {item.account_number}
                      </>
                    ) : (
                      <a
                        href={item.qr_image_url ?? "#"}
                        target="_blank"
                        className="font-semibold text-violet-700 underline"
                      >
                        Xem mã QR
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-4 font-bold">{money(item.amount)}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">
                      {item.status === "pending"
                        ? "Chờ xử lý"
                        : item.status === "paid"
                          ? "Đã chuyển"
                          : "Từ chối"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {item.status === "pending" && (
                      <button
                        onClick={() => setActive(item)}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Xử lý
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!withdrawalsQ.isLoading && !(withdrawalsQ.data ?? []).length && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400">
                    Chưa có yêu cầu rút tiền.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Xử lý yêu cầu #{active.id}</h2>
            <p className="mt-2 text-sm text-gray-500">
              Chuyển {money(active.amount)} cho {active.restaurantName}, sau đó
              tải minh chứng bắt buộc.
            </p>
            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-700">Ảnh/chứng từ chuyển khoản</p>
              <input
                id="withdrawal-transfer-proof"
                type="file"
                accept="image/*"
                onChange={(e) => void uploadProof(e.target.files?.[0])}
                className="sr-only"
              />
              <label htmlFor="withdrawal-transfer-proof" className="mt-2 inline-flex cursor-pointer rounded-xl border-2 border-amber-600 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 focus-within:ring-4 focus-within:ring-amber-200">
                Chọn minh chứng từ máy
              </label>
            </div>
            {proof && (
              <img
                src={proof}
                className="mt-3 h-28 rounded-lg border object-cover"
                alt="Minh chứng"
              />
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cho nhà hàng (tuỳ chọn)"
              className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm"
              rows={3}
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => settle.mutate("reject")}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600"
              >
                Từ chối
              </button>
              <button
                disabled={!proof || settle.isPending}
                onClick={() => settle.mutate("pay")}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Xác nhận đã chuyển
              </button>
              <button onClick={close} className="px-3 text-sm text-gray-500">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
