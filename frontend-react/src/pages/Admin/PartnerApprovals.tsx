import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../services/api";
import { toast } from "sonner";
import { getCategoryLabels } from "../../utils/category";

type Application = {
  id: number;
  name: string;
  address: string;
  district?: string;
  city?: string;
  website_url?: string;
  category?: string[];
  capacity?: number;
  tax_code?: string;
  image_url?: string;
  image_urls?: string[];
  business_license_url?: string;
  business_license_urls?: string[];
  legal_documents_url?: string;
  legal_documents_urls?: string[];
  approval_request_type?: "new" | "update";
  approval_change_fields?: string[];
  manager?: { name: string; email: string; phone: string } | null;
};

function getImages(images?: string[], fallback?: string) {
  return images?.length ? images : fallback ? [fallback] : [];
}

function ImageSection({ title, images, onPreview }: { title: string; images: string[]; onPreview: (url: string) => void }) {
  return (
    <section className="rounded-xl border border-gray-100 p-4">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {images.length ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((url, index) => (
            <button key={url} type="button" onClick={() => onPreview(url)} className="group overflow-hidden rounded-lg border border-gray-200" aria-label={`Xem chi tiết ${title} ${index + 1}`}>
              <img src={url} alt={`${title} ${index + 1}`} className="h-28 w-full object-cover transition group-hover:scale-105" />
            </button>
          ))}
        </div>
      ) : <p className="mt-2 text-xs text-gray-400">Chưa có ảnh được cung cấp.</p>}
    </section>
  );
}

export default function PartnerApprovals() {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectingApplication, setRejectingApplication] = useState<Application | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();
  const applicationsQuery = useQuery<Application[]>({
    queryKey: ["partner-applications"],
    queryFn: () => api.get("/v1/partners/applications").then((response) => response.data),
  });
  const action = useMutation({
    mutationFn: ({
      id,
      action: actionName,
      deactivate,
      rejectionReason: reason,
    }: {
      id: number;
      action: "approve" | "reject";
      deactivate?: boolean;
      rejectionReason?: string;
    }) =>
      api.put(
        `/v1/partners/applications/${id}/${actionName}`,
        actionName === "reject"
          ? {
              rejection_reason: reason,
              deactivate,
            }
          : null,
      ),
    onSuccess: () => {
      toast.success("Đã cập nhật hồ sơ.");
      setRejectingApplication(null);
      setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["partner-applications"] });
    },
    onError: () => toast.error("Không thể cập nhật hồ sơ."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hồ sơ đối tác chờ duyệt</h1>
        <p className="mt-1 text-sm text-gray-500">Kiểm tra đầy đủ thông tin, người đại diện và chứng từ trước khi công khai nhà hàng.</p>
      </div>
      <div className="grid gap-5">
        {(applicationsQuery.data ?? []).map((application) => (
          <article key={application.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{application.name}</h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      application.approval_request_type === "update"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {application.approval_request_type === "update"
                      ? "Yêu cầu chỉnh sửa"
                      : "Thêm mới"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{application.address}, {application.district}, {application.city}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={action.isPending} onClick={() => action.mutate({ id: application.id, action: "approve" })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Duyệt</button>
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={() => {
                    setRejectionReason("");
                    setRejectingApplication(application);
                  }}
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-60"
                >
                  Từ chối
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Nội dung cần xét duyệt
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(application.approval_change_fields?.length
                  ? application.approval_change_fields
                  : ["Thêm mới"]
                ).map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs text-gray-500">Mã số thuế</dt><dd className="mt-1 font-semibold">{application.tax_code || "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Sức chứa</dt><dd className="mt-1 font-semibold">{application.capacity ? `${application.capacity} chỗ` : "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Danh mục</dt><dd className="mt-1 font-semibold">{getCategoryLabels(application.category)}</dd></div>
              <div><dt className="text-xs text-gray-500">Người đại diện</dt><dd className="mt-1 font-semibold">{application.manager?.name || "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Email liên hệ</dt><dd className="mt-1 break-all font-semibold">{application.manager?.email || "—"}</dd></div>
              <div><dt className="text-xs text-gray-500">Số điện thoại</dt><dd className="mt-1 font-semibold">{application.manager?.phone || "—"}</dd></div>
              {application.website_url && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-gray-500">Website chính thức</dt><dd className="mt-1"><a href={application.website_url} target="_blank" rel="noreferrer" className="font-semibold text-red-600 underline">{application.website_url}</a></dd></div>}
            </dl>

            <div className="mt-5 grid gap-4">
              <ImageSection title="Hình ảnh nhà hàng" images={getImages(application.image_urls, application.image_url)} onPreview={setPreviewImage} />
              <ImageSection title="Giấy phép kinh doanh" images={getImages(application.business_license_urls, application.business_license_url)} onPreview={setPreviewImage} />
              <ImageSection title="Tài liệu pháp lý khác" images={getImages(application.legal_documents_urls, application.legal_documents_url)} onPreview={setPreviewImage} />
            </div>
          </article>
        ))}
        {!applicationsQuery.isLoading && !applicationsQuery.data?.length && <p className="text-sm text-gray-400">Không có hồ sơ chờ duyệt.</p>}
      </div>
      {previewImage && (
        <div role="dialog" aria-modal="true" aria-label="Xem chi tiết ảnh hồ sơ" onClick={() => setPreviewImage(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div onClick={(event) => event.stopPropagation()} className="relative max-h-[90vh] max-w-5xl">
            <img src={previewImage} alt="Ảnh hồ sơ chi tiết" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            <button type="button" onClick={() => setPreviewImage(null)} className="absolute right-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-sm font-bold text-white">Đóng</button>
          </div>
        </div>
      )}
      {rejectingApplication && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-partner-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="reject-partner-title" className="text-lg font-bold text-gray-900">
              Từ chối xét duyệt hồ sơ?
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {rejectingApplication.approval_request_type === "update"
                ? <>Bạn có muốn tạm tắt hoạt động của <strong>{rejectingApplication.name}</strong> không?</>
                : <>Hồ sơ thêm mới của <strong>{rejectingApplication.name}</strong> sẽ không được đưa vào hoạt động.</>}
            </p>
            <label className="mt-4 block text-sm font-semibold text-gray-700">
              Lý do từ chối <span className="text-red-600">*</span>
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Nêu rõ thông tin cần nhà hàng bổ sung hoặc chỉnh sửa..."
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-gray-800 outline-none transition focus:border-red-400 focus:bg-white"
              />
            </label>
            {rejectingApplication.approval_request_type === "update" && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Chọn “Có, tạm tắt” sẽ đặt nhà hàng về trạng thái không hoạt động. Chọn “Không, giữ hoạt động” sẽ giữ trạng thái hoạt động.
              </p>
            )}
            {rejectingApplication.approval_request_type === "update" ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={action.isPending || rejectionReason.trim().length < 3}
                onClick={() =>
                  action.mutate({
                    id: rejectingApplication.id,
                    action: "reject",
                    deactivate: false,
                    rejectionReason,
                  })
                }
                className="cursor-pointer rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Không, giữ hoạt động
              </button>
              <button
                type="button"
                disabled={action.isPending || rejectionReason.trim().length < 3}
                onClick={() =>
                  action.mutate({
                    id: rejectingApplication.id,
                    action: "reject",
                    deactivate: true,
                    rejectionReason,
                  })
                }
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action.isPending ? "Đang xử lý..." : "Có, tạm tắt"}
              </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={action.isPending || rejectionReason.trim().length < 3}
                onClick={() =>
                  action.mutate({
                    id: rejectingApplication.id,
                    action: "reject",
                    deactivate: true,
                    rejectionReason,
                  })
                }
                className="mt-5 w-full cursor-pointer rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action.isPending ? "Đang xử lý..." : "Từ chối hồ sơ và tắt hoạt động"}
              </button>
            )}
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => {
                setRejectingApplication(null);
                setRejectionReason("");
              }}
              className="mt-3 w-full cursor-pointer py-2 text-sm font-semibold text-gray-500 transition hover:text-gray-800 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
