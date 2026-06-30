import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useState } from 'react';
import type { User } from '../../types/auth';

// Shared KPI card (light)
function KpiCard({ label, value, sub, iconBg, icon }: {
  label: string; value: string | number; sub?: string;
  iconBg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

interface AdminStats {
  totalRestaurants: number;
  totalUsers: number;
  totalBookings: number;
  activeRestaurants: number;
  newUsersThisMonth: number;
}

export default function AdminDashboard() {
  const qc = useQueryClient();

  const statsQ = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/stats/admin').then(r => r.data),
  });

  const usersQ = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/v1/users/').then(r => r.data),
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteUserMut = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/users/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá tài khoản');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeletingId(null);
    },
    onError: () => toast.error('Xoá thất bại'),
  });

  const stats = statsQ.data;
  // 5 newest users (slice from end assuming sorted by id asc)
  const newestUsers = [...(usersQ.data ?? [])].reverse().slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản trị toàn bộ nền tảng TableNow</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Người dùng" value={stats?.totalUsers ?? '—'} sub={`+${stats?.newUsersThisMonth ?? 0} tháng này`}
          iconBg="bg-violet-50"
          icon={<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-8a4 4 0 11-8 0 4 4 0 018 0zm6 8a2 2 0 100-4 2 2 0 000 4zM3 20a2 2 0 100-4 2 2 0 000 4z"/></svg>}
        />
        <KpiCard label="Nhà hàng đối tác" value={stats?.totalRestaurants ?? '—'} sub={`${stats?.activeRestaurants ?? 0} đang hoạt động`}
          iconBg="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m13-9l2 9"/></svg>}
        />
        <KpiCard label="Tổng đặt bàn" value={stats?.totalBookings ?? '—'}
          iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />
        <KpiCard label="NH hoạt động" value={stats?.activeRestaurants ?? '—'} sub={`/ ${stats?.totalRestaurants ?? 0} đối tác`}
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* Recent registrations summary table */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">5 tài khoản đăng ký gần nhất</h2>
          <a href="/admin/users" className="text-xs text-violet-600 hover:underline font-medium">Xem tất cả →</a>
        </div>
        {usersQ.isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3 text-left">Tên</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-center">Vai trò</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {newestUsers.map(u => (
                <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{u.email}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${u.role === 'admin' ? 'bg-violet-100 text-violet-700'
                        : u.role === 'manager' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {deletingId === u.userId ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400">Xác nhận xoá?</span>
                        <button onClick={() => deleteUserMut.mutate(u.userId)}
                          className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition">Xoá</button>
                        <button onClick={() => setDeletingId(null)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition">Huỷ</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingId(u.userId)} disabled={u.role === 'admin'}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed">
                        Xoá tài khoản
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {newestUsers.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
