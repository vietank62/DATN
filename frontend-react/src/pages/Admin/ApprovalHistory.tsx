import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../services/api";

type ApprovalHistoryItem = {
  id: number;
  restaurant_name: string;
  action: "approved" | "rejected" | "cancelled";
  request_type: "new" | "update";
  change_fields: string[];
  rejection_reason?: string | null;
  deactivate_restaurant?: boolean | null;
  created_at: string;
  admin_name: string;
};

type ApprovalHistoryResponse = {
  items: ApprovalHistoryItem[];
  page: number;
  limit: number;
  total: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApprovalHistory() {
  const [page, setPage] = useState(1);
  const historyQuery = useQuery<ApprovalHistoryResponse>({
    queryKey: ["partner-approval-history", page],
    queryFn: () =>
      api
        .get("/v1/partners/approval-history", {
          params: { page, limit: 10 },
        })
        .then((response) => response.data),
  });
  const history = historyQuery.data;
  const totalPages = Math.max(1, Math.ceil((history?.total ?? 0) / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lịch sử xét duyệt</h1>
        <p className="mt-1 text-sm text-gray-500">
          Theo dõi 10 lần xét duyệt gần nhất trên mỗi trang.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {historyQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-gray-400">Đang tải lịch sử...</p>
        ) : !history?.items.length ? (
          <p className="p-8 text-center text-sm text-gray-400">Chưa có lịch sử xét duyệt.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.items.map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-gray-900">{item.restaurant_name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.action === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.action === "cancelled"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.action === "approved"
                          ? "Đã duyệt"
                          : item.action === "cancelled"
                            ? "Đã hủy yêu cầu"
                            : "Đã từ chối"}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                        {item.request_type === "new" ? "Thêm mới" : "Chỉnh sửa"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Xử lý bởi {item.admin_name} · {formatDate(item.created_at)}
                    </p>
                  </div>
                  {item.action === "rejected" && (
                    <span className="text-xs font-semibold text-gray-500">
                      {item.deactivate_restaurant ? "Đã tắt hoạt động" : "Giữ hoạt động"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.change_fields.map((field) => (
                    <span key={field} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {field}
                    </span>
                  ))}
                </div>
                {item.rejection_reason && (
                  <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-900">
                    <span className="font-bold">Lý do từ chối: </span>
                    {item.rejection_reason}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <span className="text-sm text-gray-500">
            Trang {page} / {totalPages} · {history?.total ?? 0} lần xét duyệt
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
