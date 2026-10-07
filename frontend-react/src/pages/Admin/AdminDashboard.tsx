import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, CalendarDays, CircleDollarSign, ClipboardCheck, Landmark, ReceiptText, ShieldAlert, Users } from "lucide-react";
import { api } from "../../services/api";
import { ROLE_LABEL } from "../../utils/status";
import type { User } from "../../types/auth";

type AdminStats = { totalRestaurants: number; totalUsers: number; totalBookings: number; activeRestaurants: number; newUsersThisMonth: number };
type UserPage = { items: User[]; total: number };
type Approval = { id: number };
type Refund = { id: number; status: string };
type Withdrawal = { id: number; status: string; amount: number };
type Violation = { id: number; status?: string };
type FeeSummary = { feesOutstanding: number; completedBookingsThisMonth: number };
const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

type Icon = typeof Users;
function MetricCard({ label, value, note, icon: IconComponent, tone, to }: { label: string; value: string | number; note: string; icon: Icon; tone: "violet" | "blue" | "emerald" | "amber"; to: string }) {
  const navigate = useNavigate();
  const tones = { violet: "bg-red-50 text-red-700 ring-red-100", blue: "bg-red-50 text-red-700 ring-red-100", emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100", amber: "bg-amber-50 text-amber-700 ring-amber-100" };
  return <button type="button" onClick={() => navigate(to)} className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-400"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-normal uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-normal tracking-tight text-gray-900">{value}</p><p className="mt-1 text-xs text-gray-500">{note}</p></div><span className={`rounded-xl p-2.5 ring-1 ${tones[tone]}`}><IconComponent className="h-5 w-5" /></span></div><span className="mt-4 inline-flex items-center gap-1 text-xs font-normal text-red-700">Xem chi tiết <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></button>;
}

function WorkItem({ title, detail, count, icon: IconComponent, tone, to }: { title: string; detail: string; count: string | number; icon: Icon; tone: "amber" | "blue" | "red" | "violet"; to: string }) {
  const navigate = useNavigate();
  const tones = { amber: "bg-amber-50 text-amber-700", blue: "bg-red-50 text-red-700", red: "bg-red-50 text-red-700", violet: "bg-red-50 text-red-700" };
  return <button type="button" onClick={() => navigate(to)} className="flex w-full items-center gap-4 rounded-xl border border-gray-100 p-4 text-left transition hover:border-red-200 hover:bg-red-50/30"><span className={`rounded-xl p-2.5 ${tones[tone]}`}><IconComponent className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-normal text-gray-900">{title}</span><span className="mt-0.5 block text-xs text-gray-500">{detail}</span></span><span className="text-right"><span className="block text-xl font-normal text-gray-900">{count}</span><ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 text-gray-400" /></span></button>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const statsQ = useQuery<AdminStats>({ queryKey: ["admin-stats"], queryFn: () => api.get("/api/stats/admin").then((response) => response.data) });
  const usersQ = useQuery<UserPage>({ queryKey: ["admin-users", "recent"], queryFn: () => api.get("/v1/users/", { params: { limit: 5, offset: 0 } }).then((response) => response.data) });
  const approvalsQ = useQuery<{ items: Approval[]; total: number }>({ queryKey: ["partner-applications", "dashboard"], queryFn: () => api.get("/v1/partners/applications", { params: { limit: 1, offset: 0 } }).then((response) => response.data) });
  const refundsQ = useQuery<Refund[]>({ queryKey: ["admin-refunds", "dashboard"], queryFn: () => api.get("/v1/deposits/admin/refunds?limit=50").then((response) => response.data) });
  const withdrawalsQ = useQuery<Withdrawal[]>({ queryKey: ["admin-withdrawals"], queryFn: () => api.get("/v1/deposits/admin/withdrawals").then((response) => response.data) });
  const violationsQ = useQuery<Violation[]>({ queryKey: ["admin-violation-reports"], queryFn: () => api.get("/v1/violation-reports").then((response) => response.data) });
  const feesQ = useQuery<FeeSummary>({ queryKey: ["booking-fees-summary"], queryFn: () => api.get("/v1/booking-fees/summary").then((response) => response.data) });
  const stats = statsQ.data;
  const pendingRefunds = (refundsQ.data ?? []).filter((item) => item.status === "processing");
  const pendingWithdrawals = (withdrawalsQ.data ?? []).filter((item) => item.status === "pending");
  const pendingWithdrawalAmount = pendingWithdrawals.reduce((total, item) => total + item.amount, 0);
  const openViolations = (violationsQ.data ?? []).filter((item) => item.status !== "resolved" && item.status !== "dismissed");
  const recentUsers = usersQ.data?.items ?? [];

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-gradient-to-r from-red-700 to-red-700 px-6 py-7 text-white shadow-sm"><p className="text-sm font-normal tracking-wide text-red-100">QUẢN TRỊ TABLE NOW</p><div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-normal">Tổng quan vận hành</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-red-100">Theo dõi số liệu nền tảng và đi thẳng đến các công việc cần xử lý.</p></div><button type="button" onClick={() => navigate("/admin/stats")} className="inline-flex w-fit items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-normal transition hover:bg-white/25">Xem thống kê <ArrowRight className="h-4 w-4" /></button></div></section>

    <section><div className="mb-3"><h2 className="font-normal text-gray-900">Tình hình hệ thống</h2><p className="mt-1 text-sm text-gray-500">Chọn một chỉ số để mở trang quản lý tương ứng.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Tài khoản" value={stats?.totalUsers ?? "—"} note={`+${stats?.newUsersThisMonth ?? 0} tài khoản trong tháng`} icon={Users} tone="violet" to="/admin/users" /><MetricCard label="Nhà hàng" value={stats?.totalRestaurants ?? "—"} note={`${stats?.activeRestaurants ?? 0} nhà hàng đang hoạt động`} icon={Building2} tone="blue" to="/admin/restaurants" /><MetricCard label="Đơn đặt bàn" value={stats?.totalBookings ?? "—"} note="Xem số liệu và xu hướng đặt bàn" icon={CalendarDays} tone="emerald" to="/admin/stats" /><MetricCard label="Phí còn cần thu" value={feesQ.isLoading ? "—" : money(feesQ.data?.feesOutstanding ?? 0)} note={`${feesQ.data?.completedBookingsThisMonth ?? 0} đơn hoàn thành trong tháng`} icon={ReceiptText} tone="amber" to="/admin/booking-fees" /></div></section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]"><div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-normal text-gray-900">Việc cần xử lý</h2><p className="mt-1 text-sm text-gray-500">Các mục dưới đây đều dẫn đến danh sách xử lý chi tiết.</p></div><div className="grid gap-3 sm:grid-cols-2"><WorkItem title="Hồ sơ đối tác chờ duyệt" detail="Đăng ký mới và yêu cầu thay đổi thông tin" count={approvalsQ.data?.total ?? "—"} icon={ClipboardCheck} tone="amber" to="/admin/partner-applications" /><WorkItem title="Hoàn cọc sẵn sàng xử lý" detail="Khách đã cung cấp thông tin nhận tiền" count={pendingRefunds.length} icon={CircleDollarSign} tone="blue" to="/admin/withdrawals" /><WorkItem title="Yêu cầu rút tiền" detail={pendingWithdrawalAmount ? `Cần chuyển ${money(pendingWithdrawalAmount)}` : "Nhà hàng đang chờ xử lý"} count={pendingWithdrawals.length} icon={Landmark} tone="violet" to="/admin/withdrawals" /><WorkItem title="Báo cáo và giải trình" detail="Theo dõi hồ sơ vi phạm cần xem xét" count={openViolations.length} icon={ShieldAlert} tone="red" to="/admin/violation-reports" /></div></div>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-normal text-gray-900">Tài khoản mới</h2><p className="mt-1 text-xs text-gray-500">5 tài khoản gần nhất</p></div><button type="button" onClick={() => navigate("/admin/users")} className="text-xs font-normal text-red-700 hover:underline">Xem tất cả</button></div><div className="divide-y divide-gray-100">{usersQ.isLoading && <p className="p-6 text-center text-sm text-gray-400">Đang tải tài khoản…</p>}{!usersQ.isLoading && recentUsers.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Chưa có tài khoản mới.</p>}{recentUsers.map((user) => <button type="button" key={user.userId} onClick={() => navigate("/admin/users")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-gray-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-normal text-red-700">{user.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-normal text-gray-900">{user.name}</span><span className="block truncate text-xs text-gray-500">{user.email}</span></span><span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-normal text-gray-600">{ROLE_LABEL[user.role] ?? user.role}</span></button>)}</div></div></section>

  </div>;
}
