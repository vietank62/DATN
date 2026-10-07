import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "../services/api";
import type { ReactNode } from "react";
import PasswordInput from "./PasswordInput";

export default function ManagementGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(() => !!sessionStorage.getItem("management-token"));
  const [expiresAt, setExpiresAt] = useState(0);
  const [password, setPassword] = useState("");
  const status = useQuery<{ configured: boolean }>({ queryKey: ["management-password-status"], queryFn: () => api.get("/v1/management-access/status").then(r => r.data) });
  useEffect(() => {
    const lock = () => { sessionStorage.removeItem("management-token"); setUnlocked(false); setChecking(false); setExpiresAt(0); setPassword(""); };
    window.addEventListener("management:lock", lock);
    window.addEventListener("auth:logout", lock);
    return () => {
      // Keep the token during refresh and React StrictMode's effect replay.
      const path = window.location.pathname;
      if (!path.startsWith("/manager/") || path.startsWith("/manager/cashier")) sessionStorage.removeItem("management-token");
      window.removeEventListener("management:lock", lock); window.removeEventListener("auth:logout", lock);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("management-token");
    if (!token) { setChecking(false); return; }
    api.get<{ valid: boolean; expires_at: number }>("/v1/management-access/session")
      .then(({ data }) => {
        if (active && sessionStorage.getItem("management-token") === token && data.valid && data.expires_at * 1000 > Date.now()) {
          setExpiresAt(data.expires_at * 1000);
          setUnlocked(true);
        }
      })
      .catch(() => {
        if (active && sessionStorage.getItem("management-token") === token) sessionStorage.removeItem("management-token");
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  const unlock = useMutation({
    mutationFn: () => api.post<{ token: string; expires_at: number }>("/v1/management-access/unlock", { password }),
    onSuccess: ({ data }) => { sessionStorage.setItem("management-token", data.token); setExpiresAt(data.expires_at * 1000); setPassword(""); setUnlocked(true); },
  });
  useEffect(() => {
    if (!unlocked) return;
    const timer = window.setTimeout(() => window.dispatchEvent(new Event("management:lock")), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [unlocked, expiresAt]);
  if (checking) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">Đang kiểm tra phiên quản trị...</main>;
  if (unlocked) return children;
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
    <form onSubmit={event => { event.preventDefault(); unlock.mutate(); }} className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-normal text-gray-900">Truy cập quản trị nhà hàng</h1>
      {status.data?.configured === false && <p className="text-sm text-gray-500">Chưa có mật khẩu quản lý riêng. Dùng mật khẩu đăng nhập để vào và cài đặt tại mục Thay đổi mật khẩu.</p>}
      <label className="block text-sm text-gray-700">Mật khẩu quản lý<PasswordInput autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
      {unlock.isError && <p role="alert" className="text-sm text-red-600">{axios.isAxiosError(unlock.error) && typeof unlock.error.response?.data?.detail === "string" ? unlock.error.response.data.detail : "Không thể xác thực. Vui lòng thử lại."}</p>}
      <button disabled={unlock.isPending || status.isLoading} className="w-full rounded-xl bg-red-600 py-2.5 text-sm text-white disabled:opacity-50">{unlock.isPending ? "Đang xác thực..." : "Vào quản trị"}</button>
      <Link to="/manager" className="block text-center text-sm text-gray-500">Quay lại chọn khu vực</Link>
    </form>
  </main>;
}
