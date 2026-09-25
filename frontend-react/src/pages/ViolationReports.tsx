import { Link } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { uploadImage } from "../services/upload";

type Report = {
  id: number;
  booking_id: number;
  reporter_id: number;
  target_type: string;
  source: string;
  reason: string;
  evidence_urls?: string[];
  status: string;
  appeal_reason?: string;
  appeal_evidence_urls?: string[];
  admin_note?: string;
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

const getApiErrorDetail = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const response = (error as ApiError).response;
  return response?.data?.detail;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Đang có hiệu lực",
  appeal_pending: "Đang chờ admin duyệt",
  dismissed: "Đã gỡ vi phạm",
  appeal_rejected: "Giải trình bị từ chối",
};

export default function ViolationReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  const [lateHistoryOffset, setLateHistoryOffset] = useState(0);

  const summaryQuery = useQuery<{
    late_response_count: number; customer_report_count: number; total_active_count: number;
    customer_report_history_count: number;
    late_response_history_total: number;
    late_response_history: Array<{ id: number; booking_id: number | null; message: string; created_at: string }>;
  }>({
    queryKey: ["violation-summary", user?.userId, lateHistoryOffset],
    queryFn: () => api.get("/v1/violation-reports/manager/summary", { params: { limit: 5, offset: lateHistoryOffset } }).then(r => r.data),
    enabled: user?.role === "manager", refetchOnWindowFocus: true, refetchInterval: 30000,
  });

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [appealFiles, setAppealFiles] = useState<FileList | null>(null);
  const [appealPreviewUrls, setAppealPreviewUrls] = useState<string[]>([]);

  const reportsQuery = useQuery<Report[]>({
    queryKey: ["violation-reports", user?.userId, isAdmin],
    queryFn: () => {
      const url = isAdmin
        ? "/v1/violation-reports?limit=50"
        : "/v1/violation-reports/me";

      return api.get(url).then((response) => response.data);
    },
  });

  const appealMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReport) {
        return;
      }

      const evidenceUrls = appealFiles?.length
        ? await Promise.all([...appealFiles].map(uploadImage))
        : [];
      const payload = {
        reason: appealReason.trim(),
        evidence_urls: evidenceUrls,
      };

      const response = await api.post(
        `/v1/violation-reports/${selectedReport.id}/appeal`,
        payload,
      );
      if (response.data?.status !== "appeal_pending") {
        throw new Error("Hệ thống chưa ghi nhận giải trình. Vui lòng thử lại.");
      }
      return response.data as Report;
    },
    onSuccess: () => {
      toast.success("Đã gửi giải trình để admin xét duyệt.");
      setSelectedReport(null);
      setAppealReason("");
      setAppealFiles(null);
      void queryClient.invalidateQueries({ queryKey: ["violation-reports", user?.userId, isAdmin] });
      void queryClient.invalidateQueries({ queryKey: ["violation-summary", user?.userId] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorDetail(error) || "Không thể gửi giải trình.");
    },
  });

  const reviewReport = async (report: Report, approved: boolean) => {
    const adminNote = approved
      ? "Admin đã duyệt gỡ vi phạm sau khi xem xét giải trình."
      : "Admin từ chối giải trình sau khi xem xét thông tin và minh chứng.";

    try {
      await api.post(`/v1/violation-reports/${report.id}/review`, {
        approved,
        admin_note: adminNote,
      });
      toast.success("Đã xử lý giải trình.");
      void queryClient.invalidateQueries({ queryKey: ["violation-reports"] });
    } catch (error: unknown) {
      toast.error(getApiErrorDetail(error) || "Không thể xử lý.");
    }
  };

  const handleAppealFilesChange = (selectedFiles: FileList | null) => {
    setAppealFiles(selectedFiles);
    setAppealPreviewUrls(
      selectedFiles
        ? [...selectedFiles].map((file) => URL.createObjectURL(file))
        : [],
    );
  };

  const renderImages = (images?: string[]) => {
    if (!images?.length) {
      return null;
    }

    return (
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {images.map((url) => (
          <img
            key={url}
            src={url}
            alt="Ảnh minh chứng"
            className="h-20 w-28 rounded-lg object-cover"
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-red-600">Quản lý tuân thủ</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {isAdmin ? "Quản lý báo cáo vi phạm" : isManager ? "Vi phạm và giải trình" : "Vi phạm và báo cáo"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {isManager ? "Theo dõi hồ sơ vi phạm của nhà hàng, báo cáo đã gửi và phản hồi từ admin." : "Theo dõi trạng thái các báo cáo và phản hồi xử lý từ admin."}
        </p>
      </div>

      {isManager && <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        {summaryQuery.isLoading && <p>Đang tải số lần vi phạm…</p>}
        {summaryQuery.isError && <button onClick={() => void summaryQuery.refetch()} className="text-red-600">Chưa tải được thống kê vi phạm. Thử lại</button>}
        {summaryQuery.data && <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Tổng vi phạm còn hiệu lực", summaryQuery.data.total_active_count, "border-red-100 bg-red-50/70 text-red-700"], ["Phản hồi trễ", summaryQuery.data.late_response_count, "border-amber-100 bg-amber-50/70 text-amber-800"], ["Bị khách báo cáo", summaryQuery.data.customer_report_count, "border-slate-200 bg-slate-50 text-slate-700"]].map(([label, count, tone]) => <div key={String(label)} className={`rounded-2xl border p-5 ${tone}`}><p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 text-3xl font-extrabold">{count} <span className="text-base font-semibold">lần</span></p></div>)}
          </div>
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Chỉ các báo cáo chưa được gỡ mới được tính là vi phạm còn hiệu lực. Khi nhà hàng đã bị xử lý vì 3 lần phản hồi trễ, hồ sơ xử lý đó không làm tăng thêm số vi phạm. Khách hàng này có tổng cộng <strong>{summaryQuery.data.customer_report_history_count}</strong> báo cáo trong lịch sử.</p>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 p-5"><h2 className="font-bold text-gray-900">Lịch sử cảnh báo phản hồi trễ</h2><p className="mt-1 text-xs text-gray-500">Hiển thị 5 đơn gần nhất. Bạn có thể chuyển trang để xem các cảnh báo trước đó.</p></div>
            {summaryQuery.data.late_response_history.length === 0 && <p className="p-5 text-sm text-gray-500">Chưa có lịch sử cảnh báo.</p>}
            {summaryQuery.data.late_response_history.map(item => <article key={item.id} className="border-t border-gray-100 px-5 py-4 text-sm"><p className="font-semibold">{item.booking_id ? `Đơn #${item.booking_id}` : "Cảnh báo phản hồi trễ trước đây"}</p><p>{item.message.replaceAll("cờ phản hồi trễ", "vi phạm phản hồi trễ")}</p><p className="mt-1 text-gray-500">{new Date(item.created_at).toLocaleString("vi-VN")}</p><Link className="mt-2 inline-block font-semibold text-blue-700 underline" to={item.booking_id ? `/manager/bookings?booking=${item.booking_id}` : "/manager/bookings?status=all"}>Xem chi tiết đơn</Link></article>)}
            {summaryQuery.data.late_response_history_total > 5 && <nav className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 text-sm"><button type="button" disabled={lateHistoryOffset === 0 || summaryQuery.isFetching} onClick={() => setLateHistoryOffset(value => Math.max(0, value - 5))} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button><span className="text-gray-500">Trang {lateHistoryOffset / 5 + 1}</span><button type="button" disabled={lateHistoryOffset + 5 >= summaryQuery.data.late_response_history_total || summaryQuery.isFetching} onClick={() => setLateHistoryOffset(value => value + 5)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang tiếp</button></nav>}
          </div>
        </>}
      </section>}

      {isManager && <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-gray-900">Hồ sơ vi phạm và giải trình</h2><p className="mt-1 text-sm text-gray-500">Theo dõi tiến trình xử lý từng hồ sơ bên dưới.</p></section>}
      {reportsQuery.isLoading && (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">
          Đang tải thông tin báo cáo...
        </div>
      )}

      {reportsQuery.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không thể tải thông tin báo cáo. Vui lòng kiểm tra lại kết nối hoặc quyền tài khoản.
        </div>
      )}

      {reportsQuery.data?.map((report) => (
        <article key={report.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-gray-900">
                {report.source === "late_response" ? "Phản hồi trễ – hồ sơ xử lý" : report.reporter_id === user?.userId ? "Báo cáo đã gửi" : "Bị báo cáo"} · Đơn #{report.booking_id}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                {report.reason}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${report.status === "dismissed" ? "bg-emerald-100 text-emerald-700" : report.status === "appeal_pending" ? "bg-amber-100 text-amber-800" : "bg-red-50 text-red-700"}`}>
              {STATUS_LABEL[report.status] || report.status}
            </span>
          </div>

          {renderImages(report.evidence_urls)}

          {report.appeal_reason && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
              <b>Giải trình:</b> {report.appeal_reason}
            </p>
          )}

          {renderImages(report.appeal_evidence_urls)}

          {report.admin_note && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <b>Phản hồi admin:</b> {report.admin_note}
            </p>
          )}

          {!isAdmin && report.reporter_id !== user?.userId && ["open", "appeal_rejected"].includes(report.status) && (
            <button
              type="button"
              onClick={() => setSelectedReport(report)}
              className="mt-4 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              Gửi giải trình
            </button>
          )}

          {isAdmin && report.status === "appeal_pending" && (
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void reviewReport(report, true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                Duyệt gỡ vi phạm
              </button>
              <button type="button" onClick={() => void reviewReport(report, false)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
                Từ chối
              </button>
            </div>
          )}
        </article>
      ))}

      {!reportsQuery.isLoading && !reportsQuery.isError && reportsQuery.data?.length === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500">
          Chưa có hồ sơ báo cáo hoặc giải trình.
        </div>
      )}

      {selectedReport && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold">Giải trình báo cáo</h2>
            <textarea value={appealReason} onChange={(event) => setAppealReason(event.target.value)} minLength={10} rows={5} className="mt-4 w-full rounded-xl border p-3" placeholder="Lý do và minh chứng giải trình..." />
            <input id="appeal-evidence-files" type="file" multiple accept="image/*" onChange={(event) => handleAppealFilesChange(event.target.files)} className="sr-only" />
            <label htmlFor="appeal-evidence-files" className="mt-3 inline-flex cursor-pointer items-center rounded-xl border-2 border-amber-600 bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 focus-within:ring-4 focus-within:ring-amber-200">
              Chọn ảnh minh chứng
            </label>
            {appealFiles?.length ? <p className="mt-2 text-xs text-gray-500">Đã chọn {appealFiles.length} ảnh.</p> : null}
            {appealPreviewUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {appealPreviewUrls.map((url) => <img key={url} src={url} alt="Ảnh giải trình đã chọn" className="aspect-square w-full rounded-xl border border-gray-200 object-cover" />)}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedReport(null)} className="rounded-xl bg-gray-100 px-4 py-2">Hủy</button>
              <button type="button" disabled={appealMutation.isPending || appealReason.trim().length < 10} onClick={() => void appealMutation.mutateAsync()} className="rounded-xl bg-red-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60">{appealMutation.isPending ? "Đang gửi…" : "Gửi giải trình"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
