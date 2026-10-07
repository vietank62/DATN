import { AdminUserDetail } from "../../components/AdminDetailDialog";
import { ROLE_LABEL } from "../../utils/status";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useState } from 'react';
import type { User } from '../../types/auth';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, Users, X } from 'lucide-react';

interface UserPage {
  items: User[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 10;

export default function UserManagement() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const usersQ = useQuery<UserPage>({
    queryKey: ['admin-users', page, search],
    queryFn: () => api.get('/v1/users/', {
      params: {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search.trim() || undefined,
      },
    }).then(r => r.data),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/users/${id}`),
    onSuccess: () => {
      toast.success('Đã xoá tài khoản');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeletingId(null);
      setSelectedId(null);
      if (usersQ.data?.items.length === 1 && page > 1) setPage(current => current - 1);
    },
    onError: () => toast.error('Xoá thất bại'),
  });

  const users = usersQ.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((usersQ.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-5 font-normal">
      {selectedId !== null && <AdminUserDetail key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><Users size={20} /></span>
        <div><h1 className="text-lg font-normal text-gray-900">Quản lý người dùng</h1>
        <p className="mt-1 text-xs text-gray-500">Danh sách tài khoản và thông tin liên hệ</p></div>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm font-normal text-gray-600">
            {usersQ.data?.total ?? 0} tài khoản{search ? ' phù hợp' : ' tổng cộng'}
          </p>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" aria-label="Tìm người dùng" placeholder="Tìm tên, email hoặc số điện thoại"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 focus:bg-white transition"
            />
            {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-red-600"><X size={16} /></button>}
          </div>
        </div>

        {usersQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Đang tải danh sách người dùng...</div>
        ) : usersQ.isError ? (
          <div className="p-8 text-center text-sm text-gray-500">Không tải được danh sách người dùng. <button type="button" onClick={() => void usersQ.refetch()} className="text-red-600 underline">Thử lại</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-normal">Người dùng</th>
                  <th className="px-4 py-3 text-left font-normal">Thông tin liên hệ</th>
                  <th className="px-4 py-3 text-center font-normal">Vai trò</th>
                  <th className="px-4 py-3 text-right font-normal">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-normal flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="min-w-0"><button type="button" onClick={() => setSelectedId(u.userId)} className="block text-left font-normal text-gray-800 hover:text-red-600">{u.name}</button><span className="mt-1 block text-xs text-gray-400">#{u.userId}</span></span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600"><span className="block break-all">{u.email}</span><span className="mt-1 block text-xs text-gray-400">{u.phone || '—'}</span></td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-normal
                        ${u.role === 'admin' ? 'bg-red-100 text-red-700'
                          : u.role === 'manager' ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-500'}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right"><div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <button type="button" onClick={() => setSelectedId(u.userId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-normal text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                        <Eye size={14} /> Chi tiết
                      </button>
                      {deletingId === u.userId ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-400">Xác nhận?</span>
                          <button disabled={deleteUserMut.isPending} onClick={() => deleteUserMut.mutate(u.userId)}
                            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-normal transition">Xoá</button>
                          <button disabled={deleteUserMut.isPending} onClick={() => setDeletingId(null)}
                            className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition">Huỷ</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(u.userId)} disabled={u.role === 'admin'}
                          aria-label={`Xóa tài khoản ${u.name}`} title="Xóa tài khoản"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div></td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm">Không tìm thấy kết quả nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            {usersQ.data?.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, usersQ.data.total)} / ${usersQ.data.total} tài khoản` : '0 tài khoản'} · Trang {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1 || usersQ.isFetching}
              onClick={() => setPage(current => current - 1)}
              className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-normal text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} aria-label="Trang trước" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || usersQ.isFetching}
              onClick={() => setPage(current => current + 1)}
              className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-normal text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={15} aria-label="Trang sau" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
