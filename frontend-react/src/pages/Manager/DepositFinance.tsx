import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
type Summary = {
  totalDeposit: number;
  reservedWithdrawal: number;
  paidOut: number;
  availableBalance: number;
  completedBookings: number;
};
type Withdrawal = {
  id: number;
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

type FinanceResponse = {
  summary: Summary;
  withdrawals: Withdrawal[];
};
const money = (value: number) => `${value.toLocaleString("vi-VN")} đ`;
const statusLabel: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã chuyển",
  rejected: "Từ chối",
};
export default function DepositFinance() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: 0,
    bank_name: "",
    account_name: "",
    account_number: "",
    qr_image_url: "",
  });
  const financeQ = useQuery<FinanceResponse>({
    queryKey: ["deposit-finance"],
    queryFn: () =>
      api.get("/v1/deposits/manager/finance").then((response) => response.data),
  });
  const requestMutation = useMutation({
    mutationFn: () => api.post("/v1/deposits/manager/withdrawals", form),
    onSuccess: () => {
      toast.success("Đã gửi yêu cầu rút tiền cho quản trị viên.");
      setForm({
        amount: 0,
        bank_name: "",
        account_name: "",
        account_number: "",
        qr_image_url: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["deposit-finance"] });
    },
    onError: (error) =>
      toast.error(
        axios.isAxiosError(error)
          ? (error.response?.data?.detail ?? "Không thể gửi yêu cầu.")
          : "Không thể gửi yêu cầu.",
      ),
  });
  const summary = financeQ.data?.summary;
  const withdrawals = financeQ.data?.withdrawals ?? [];
  const uploadQr = async (file?: File) => {
    if (!file) return;
    try {
      const qrImageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, qr_image_url: qrImageUrl }));
      toast.success("Đã tải ảnh QR.");
    } catch {
      toast.error("Không thể tải ảnh QR.");
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Tiền đặt cọc & rút tiền
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Chỉ tiền đặt cọc từ đơn đã hoàn thành mới được tính vào số dư có thể rút.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Đặt cọc từ đơn hoàn thành", summary?.totalDeposit ?? 0],
          ["Có thể rút (đơn hoàn thành)", summary?.availableBalance ?? 0],
          ["Đang chờ xử lý", summary?.reservedWithdrawal ?? 0],
          ["Đã nhận", summary?.paidOut ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {label}
            </p>
            <p className="mt-2 text-xl font-extrabold text-gray-900">
              {money(Number(value))}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-bold text-gray-900">Tạo yêu cầu rút tiền</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Bạn có thể nhập tài khoản nhận hoặc tải ảnh QR. Admin sẽ chuyển
            khoản và đính kèm minh chứng.
          </p>
          <div className="mt-5 space-y-3">
            <input
              type="number"
              min="1"
              max={summary?.availableBalance ?? undefined}
              placeholder="Số tiền cần rút (VNĐ)"
              value={form.amount || ""}
              onChange={(e) =>
                setForm({ ...form, amount: Number(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Tên ngân hàng"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Tên chủ tài khoản"
              value={form.account_name}
              onChange={(e) =>
                setForm({ ...form, account_name: e.target.value })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Số tài khoản"
              value={form.account_number}
              onChange={(e) =>
                setForm({ ...form, account_number: e.target.value })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
            <div>
              <p className="text-sm font-medium text-gray-600">Ảnh QR nhận tiền (tuỳ chọn)</p>
              <input
                id="withdrawal-qr-image"
                type="file"
                accept="image/*"
                onChange={(e) => void uploadQr(e.target.files?.[0])}
                className="sr-only"
              />
              <label htmlFor="withdrawal-qr-image" className="mt-2 inline-flex cursor-pointer rounded-xl border-2 border-amber-600 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 focus-within:ring-4 focus-within:ring-amber-200">
                Chọn ảnh QR từ máy
              </label>
            </div>
            {form.qr_image_url && (
              <img
                src={form.qr_image_url}
                alt="QR nhận tiền"
                className="h-24 w-24 rounded-lg border object-cover"
              />
            )}
            <button
              disabled={!form.amount || requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {requestMutation.isPending
                ? "Đang gửi..."
                : "Gửi yêu cầu rút tiền"}
            </button>
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-3">
          <div className="border-b border-gray-100 p-5">
            <h2 className="font-bold text-gray-900">Lịch sử yêu cầu</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {withdrawals.map((item) => (
              <div key={item.id} className="p-5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      {money(item.amount)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.bank_name
                        ? `${item.bank_name} · ${item.account_number}`
                        : "Nhận bằng mã QR"}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {statusLabel[item.status] ?? item.status}
                  </span>
                </div>
                {item.admin_note && (
                  <p className="mt-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
                    {item.admin_note}
                  </p>
                )}
                {item.transfer_proof_url && (
                  <a
                    className="mt-3 inline-block text-xs font-bold text-emerald-700 underline"
                    href={item.transfer_proof_url}
                    target="_blank"
                  >
                    Xem minh chứng chuyển tiền
                  </a>
                )}
              </div>
            ))}
            {!financeQ.isLoading && withdrawals.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-400">
                Chưa có yêu cầu nào.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
