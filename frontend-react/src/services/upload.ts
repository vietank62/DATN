import { api } from "./api";

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Vui lòng chọn tệp hình ảnh.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Ảnh không được vượt quá 10 MB.");
  const body = new FormData();
  body.append("file", file);
  const { data } = await api.post<{ url: string }>("/api/upload-image/", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}
