import { useState } from "react";
import { toast } from "sonner";
import { api } from "../services/api";
import { uploadImage } from "../services/upload";

type Props = { bookingId: number; target: "customer" | "restaurant"; onClose: () => void; onSuccess: () => void };

export function ViolationReportModal({ bookingId, target, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 10) { toast.error("Vui lòng mô tả rõ lý do, tối thiểu 10 ký tự."); return; }
    try {
      setIsSubmitting(true);
      const evidenceUrls = files?.length ? await Promise.all([...files].map(uploadImage)) : [];
      const payload = { booking_id: bookingId, reason: reason.trim(), evidence_urls: evidenceUrls };
      await api.post(`/v1/violation-reports/${target}`, payload);
      toast.success("Đã gửi báo cáo và ghi nhận thông báo.");
      onSuccess(); onClose();
    } catch (error: unknown) {
      toast.error((error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Không thể gửi báo cáo.");
    } finally { setIsSubmitting(false); }
  };

  const handleFilesChange = (selectedFiles: FileList | null) => {
    setFiles(selectedFiles);
    setPreviewUrls(
      selectedFiles
        ? [...selectedFiles].map((file) => URL.createObjectURL(file))
        : [],
    );
  };

  const title = target === "customer" ? "Báo cáo khách không đến" : "Báo cáo nhà hàng";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">Báo cáo có hiệu lực ngay. Bạn có thể tải tối đa 10 ảnh minh chứng.</p>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} rows={5} placeholder="Mô tả sự việc và lý do báo cáo..." className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm outline-none focus:border-red-500" />
        <input id="violation-evidence-files" type="file" multiple accept="image/*" onChange={(event) => handleFilesChange(event.target.files)} className="sr-only" />
        <label htmlFor="violation-evidence-files" className="mt-3 inline-flex cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-red-300 hover:bg-red-50">Chọn ảnh minh chứng</label>
        {files?.length ? <p className="mt-2 text-xs font-semibold text-gray-500">Đã chọn {files.length} ảnh.</p> : null}
        {previewUrls.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previewUrls.map((url) => <img key={url} src={url} alt="Ảnh minh chứng đã chọn" className="aspect-square w-full rounded-xl border border-gray-200 object-cover" />)}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold">Hủy</button><button disabled={isSubmitting} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSubmitting ? "Đang gửi..." : "Gửi báo cáo"}</button></div>
      </form>
    </div>
  );
}
