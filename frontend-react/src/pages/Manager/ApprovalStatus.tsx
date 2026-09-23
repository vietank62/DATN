import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";

type ApprovalHistoryItem = {
  id: number;
  action: "approved" | "rejected" | "cancelled";
  request_type: "new" | "update";
  change_fields: string[];
  rejection_reason?: string | null;
  deactivate_restaurant?: boolean | null;
  created_at: string;
};

type RestaurantApplication = {
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  pending_approval_fields?: string[] | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ApprovalStatus() {
  const applicationQuery = useQuery<RestaurantApplication | null>({
    queryKey: ["partner-application"],
    queryFn: () => api.get("/v1/partners/application/me").then((response) => response.data),
  });
  const historyQuery = useQuery<ApprovalHistoryItem[]>({
    queryKey: ["my-partner-approval-history"],
    queryFn: () => api.get("/v1/partners/approval-history/me").then((response) => response.data),
  });
  const application = applicationQuery.data;
  const statusLabel = application?.approval_status === "approved"
    ? "Đã được duyệt"
    : application?.approval_status === "rejected"
      ? "Cần chỉnh sửa và gửi lại"
      : "Đang chờ xét duyệt";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trạng thái xét duyệt</h1>
        <p className="mt-1 text-sm text-gray-500">
          Theo dõi phản hồi từ TableNow và lịch sử các lần xét duyệt hồ sơ.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Trạng thái hiện tại</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              application?.approval_status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : application?.approval_status === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {statusLabel}
          </span>
          <span className="text-sm text-gray-600">
            {application?.is_active ? "Nhà hàng đang hoạt động" : "Nhà hàng không hoạt động"}
          </span>
        </div>
        {application?.approval_status !== "approved" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">Nhà hàng tạm ngưng cho đến khi admin duyệt hồ sơ. Nếu bị từ chối, hãy chỉnh sửa thông tin và gửi lại để xét duyệt.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <h2 className="font-bold text-gray-900">Lịch sử phản hồi</h2>
        </div>
        {historyQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-gray-400">Đang tải lịch sử...</p>
        ) : !historyQuery.data?.length ? (
          <p className="p-8 text-center text-sm text-gray-400">Chưa có phản hồi xét duyệt.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {historyQuery.data.map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    item.action === "approved"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.action === "cancelled"
                        ? "bg-gray-100 text-gray-700"
                        : "bg-red-100 text-red-700"
                  }`}>
                    {item.action === "approved"
                      ? "Đã duyệt"
                      : item.action === "cancelled"
                        ? "Đã hủy yêu cầu"
                        : "Từ chối"}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
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
                    <span className="font-bold">Lý do cần chỉnh sửa: </span>
                    {item.rejection_reason}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
