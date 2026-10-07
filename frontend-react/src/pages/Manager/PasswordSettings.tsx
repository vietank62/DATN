import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { api } from "../../services/api";
import PasswordInput from "../../components/PasswordInput";

function PasswordForm({ management }: { management: boolean }) {
  const client = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const status = useQuery<{ configured: boolean }>({ queryKey: ["management-password-status"], queryFn: () => api.get("/v1/management-access/status").then(r => r.data), enabled: management });
  const save = useMutation({
    mutationFn: () => {
      if (next !== confirm) throw new Error("Mật khẩu xác nhận chưa khớp.");
      return management ? api.put("/v1/management-access/password", { current_password: current, new_password: next }) : api.put("/v1/users/me", { current_password: current, password: next });
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["management-password-status"] }); toast.success("Đã đổi mật khẩu. Vui lòng xác thực lại để vào quản trị."); setCurrent(""); setNext(""); setConfirm(""); window.dispatchEvent(new Event("management:lock")); },
    onError: error => toast.error(axios.isAxiosError(error) && typeof error.response?.data?.detail === "string" ? error.response.data.detail : error.message),
  });
  const field = (label: string, value: string, change: (value: string) => void, isNew = false) => <label className="block text-sm text-gray-700">{label}<PasswordInput required minLength={isNew ? 8 : 1} maxLength={128} autoComplete={isNew ? "new-password" : "current-password"} value={value} onChange={event => change(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5" /></label>;
  return <form onSubmit={event => { event.preventDefault(); save.mutate(); }} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
    <h2 className="text-base font-normal text-gray-900">{management ? "Mật khẩu quản lý" : "Mật khẩu đăng nhập"}</h2>
    {field(management ? "Mật khẩu quản lý hiện tại (nếu chưa có, sử dụng mật khẩu đăng nhập hiện tại)" : "Mật khẩu đăng nhập hiện tại", current, setCurrent)}
    {field("Mật khẩu mới (ít nhất 8 ký tự)", next, setNext, true)}
    {field("Nhập lại mật khẩu mới", confirm, setConfirm, true)}
    <button disabled={save.isPending || (management && !status.isSuccess)} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white disabled:opacity-50">{save.isPending ? "Đang lưu..." : "Đổi mật khẩu"}</button>
  </form>;
}

export default function PasswordSettings() {
  return <div className="max-w-4xl space-y-5"><h1 className="text-xl font-normal">Thay đổi mật khẩu</h1><div className="grid gap-5 md:grid-cols-2"><PasswordForm management={false} /><PasswordForm management /></div></div>;
}
