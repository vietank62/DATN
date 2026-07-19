import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useState } from 'react';

interface Restaurant {
  id: number;
  name: string;
  address: string;
  district: string;
  city?: string;
  rating?: number;
  review_count?: number;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked ? 'true' : 'false'} onClick={onChange} disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40
        ${checked ? 'bg-violet-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function RestaurantManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const restaurantsQ = useQuery<Restaurant[]>({
    queryKey: ['admin-restaurants'],
    queryFn: () => api.get('/v1/restaurants/all').then(r => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => api.patch(`/v1/restaurants/${id}/toggle-active`),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái thành công');
      qc.invalidateQueries({ queryKey: ['admin-restaurants'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setTogglingId(null);
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const q = search.toLowerCase();
  const filtered = (restaurantsQ.data ?? []).filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.address.toLowerCase().includes(q) ||
    (r.district ?? '').toLowerCase().includes(q)
  );

  const activeCount = (restaurantsQ.data ?? []).filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý nhà hàng</h1>
        <p className="text-sm text-gray-400 mt-0.5">Phê duyệt và điều chỉnh trạng thái hoạt động của nhà hàng</p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm text-sm text-gray-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          {activeCount} đang hoạt động
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm text-sm text-gray-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>
          {(restaurantsQ.data?.length ?? 0) - activeCount} tạm đóng
        </span>
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm font-medium text-gray-600">{filtered.length} nhà hàng</p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Tìm theo tên, quận, địa chỉ..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition w-64"
            />
          </div>
        </div>

        {restaurantsQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Đang tải danh sách nhà hàng...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">Nhà hàng</th>
                  <th className="px-6 py-3 text-left">Địa chỉ</th>
                  <th className="px-6 py-3 text-center">Sức chứa</th>
                  <th className="px-6 py-3 text-center">Đánh giá</th>
                  <th className="px-6 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-gray-400 text-xs">#{r.id}</td>
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-gray-800">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.district}{r.city ? `, ${r.city}` : ''}</p>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 max-w-50 truncate">{r.address}</td>
                    <td className="px-6 py-3.5 text-center text-gray-600 font-medium">{r.capacity}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="text-amber-500 font-semibold">{r.rating?.toFixed(1) ?? '—'}</span>
                      <span className="text-gray-300 text-xs ml-1">({r.review_count ?? 0})</span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Toggle
                          checked={r.is_active}
                          disabled={toggleMut.isPending && togglingId === r.id}
                          onChange={() => { setTogglingId(r.id); toggleMut.mutate(r.id); }}
                        />
                        <span className={`text-xs font-medium ${r.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {r.is_active ? 'Hoạt động' : 'Tạm đóng'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">Không tìm thấy kết quả</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
