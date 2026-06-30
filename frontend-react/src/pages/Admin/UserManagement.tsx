import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useState } from 'react';
import type { User } from '../../types/auth';

export default function UserManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const usersQ = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/v1/users/').then(r => r.data),
  });

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

  const q = search.toLowerCase();
  const filtered = (usersQ.data ?? []).filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.phone ?? '').includes(q)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
        <p className="text-sm text-gray-400 mt-0.5">Danh sách toàn bộ tài khoản trên hệ thống</p>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm font-medium text-gray-600">
            {filtered.length} tài khoản{search ? ' phù hợp' : ' tổng cộng'}
          </p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Tìm theo tên, email, SĐT..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition w-64"
            />
          </div>
        </div>

        {usersQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Đang tải danh sách người dùng...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">Tên</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">SĐT</th>
                  <th className="px-6 py-3 text-center">Vai trò</th>
                  <th className="px-6 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => (
                  <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-gray-400 text-xs">#{u.userId}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">{u.email}</td>
                    <td className="px-6 py-3.5 text-gray-500">{u.phone ?? '—'}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${u.role === 'admin' ? 'bg-violet-100 text-violet-700'
                          : u.role === 'manager' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {deletingId === u.userId ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-400">Xác nhận?</span>
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
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Không tìm thấy kết quả nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
