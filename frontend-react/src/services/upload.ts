import axios from "axios";
import { api } from "./api";

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Vui lòng chọn tệp hình ảnh.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ảnh không được vượt quá 10 MB.");

  try {
    const body = new FormData();
    body.append("file", file);
    // Do not set Content-Type manually: the browser adds the required multipart boundary.
    const { data } = await api.post<{ url?: string }>("/api/upload-image/", body);
    if (!data.url) throw new Error("Dịch vụ tải ảnh không trả về đường dẫn ảnh.");
    return data.url;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") throw new Error(detail, { cause: error });
      if (Array.isArray(detail)) {
        const message = detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(". ");
        if (message) throw new Error(message, { cause: error });
      }
      if (error.code === "ECONNABORTED") throw new Error("Tải ảnh mất quá lâu. Vui lòng thử lại.", { cause: error });
    }
    throw error instanceof Error ? error : new Error("Không thể tải ảnh lên.");
  }
}

export async function uploadReviewMedia(file: File): Promise<string> {
  const isImage = file.type.startsWith("image/");
  const isVideo = ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
  if (!isImage && !isVideo) throw new Error("Chỉ hỗ trợ ảnh hoặc video MP4/WebM/MOV.");
  if (file.size > (isVideo ? 50 : 10) * 1024 * 1024) throw new Error(isVideo ? "Video không được vượt quá 50 MB." : "Ảnh không được vượt quá 10 MB.");
  const body = new FormData();
  body.append("file", file);
  const { data } = await api.post<{ url?: string }>("/api/upload-review-media/", body);
  if (!data.url) throw new Error("Dịch vụ tải tệp không trả về đường dẫn.");
  return data.url;
}
