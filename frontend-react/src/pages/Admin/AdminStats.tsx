import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  totalUsers: number;
  totalBookings: number;
  newUsersThisMonth: number;
}
interface RoleStat { role: string; count: number; percentage: number; }
interface TopRestaurant {
  id: number; name: string; district: string; city?: string;
  rating?: number; review_count?: number; is_active: boolean; capacity: number;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  admin:    { label: 'Admin',    color: '#8b5cf6', bg: 'bg-violet-50', bar: 'bg-violet-500' },
  manager:  { label: 'Manager',  color: '#3b82f6', bg: 'bg-blue-50',   bar: 'bg-blue-500' },
  customer: { label: 'Khách hàng', color: '#10b981', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
};

// ── SVG Donut – restaurant active ratio ───────────────────────────────────────
function RestaurantDonut({ active, total }: { active: number; total: number }) {
  const R = 48, CIRC = 2 * Math.PI * R;
  const inactive = total - active;
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  const activeDash   = total > 0 ? (active / total) * CIRC : 0;
  const inactiveDash = CIRC - activeDash;

  // One-shot spin/morph animation on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{`
        @keyframes donut-spin-in {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
        .donut-spin-in {
          animation: donut-spin-in 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div className="relative flex-shrink-0">
          <svg
            viewBox="0 0 120 120"
            className={`w-44 h-44 ${mounted ? 'donut-spin-in' : '-rotate-90'}`}
          >
            {/* Track */}
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f3f4f6" strokeWidth="16" strokeLinecap="round" />
            
            {/* Active arc */}
            {activeDash > 0 && (
              <circle
                cx="60" cy="60" r={R} fill="none"
                stroke="#10b981" strokeWidth="16" strokeLinecap="round"
                strokeDasharray={mounted ? `${activeDash} ${CIRC - activeDash}` : `0 ${CIRC}`}
                strokeDashoffset={0}
                style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            )}
            
            {/* Inactive arc */}
            {inactiveDash > 0 && activeDash < CIRC && (
              <circle
                cx="60" cy="60" r={R} fill="none"
                stroke="#f97316" strokeWidth="16" strokeLinecap="round"
                strokeDasharray={mounted ? `${inactiveDash} ${CIRC - inactiveDash}` : `0 ${CIRC}`}
                strokeDashoffset={mounted ? -activeDash : 0}
                style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4, 0, 0.2, 1), stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            )}
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-gray-900">{pct}%</span>
            <span className="text-xs text-gray-400 font-medium tracking-wide">hoạt động</span>
          </div>
        </div>

        <div className="space-y-3 text-sm min-w-[160px]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-700">{active}</p>
              <p className="text-xs text-emerald-600">Đang hoạt động</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
            <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-600">{inactive}</p>
              <p className="text-xs text-red-500">Tạm đóng cửa</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-700">{total}</p>
              <p className="text-xs text-gray-500">Tổng cộng</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Horizontal bar – role distribution ────────────────────────────────────────
function RoleBarChart({ data }: { data: RoleStat[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="space-y-5">
      {data.map((d) => {
        const cfg = ROLE_CONFIG[d.role] ?? { label: d.role, color: '#6b7280', bg: 'bg-gray-50', bar: 'bg-gray-400' };
        return (
          <div key={d.role}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-900">{d.count.toLocaleString()}</span>
                <span className="text-xs text-gray-400 ml-1">({d.percentage}%)</span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${cfg.bar}`}
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top restaurants table ─────────────────────────────────────────────────────
function TopRestaurantsTable({ data }: { data: TopRestaurant[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
            <th className="px-5 py-3 text-left">#</th>
            <th className="px-5 py-3 text-left">Nhà hàng</th>
            <th className="px-5 py-3 text-left">Địa điểm</th>
            <th className="px-5 py-3 text-center">Sức chứa</th>
            <th className="px-5 py-3 text-center">Đánh giá</th>
            <th className="px-5 py-3 text-center">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((r, idx) => (
            <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-5 py-3.5">
                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold
                  ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                  {idx + 1}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <p className="font-semibold text-gray-800">{r.name}</p>
                <p className="text-xs text-gray-400">#{r.id}</p>
              </td>
              <td className="px-5 py-3.5 text-gray-500 text-xs">{r.district}{r.city ? `, ${r.city}` : ''}</td>
              <td className="px-5 py-3.5 text-center text-gray-600">{r.capacity}</td>
              <td className="px-5 py-3.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-amber-400">★</span>
                  <span className="font-bold text-gray-800">{r.rating?.toFixed(1) ?? '—'}</span>
                  <span className="text-gray-400 text-xs">({r.review_count ?? 0})</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-center">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                  ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                  {r.is_active ? 'Hoạt động' : 'Tạm đóng'}
                </span>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">Chưa có dữ liệu đánh giá</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
      <svg className="animate-spin w-5 h-5 mr-2 text-gray-300" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Đang tải...
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminStats() {
  const statsQ = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/stats/admin').then(r => r.data),
  });

  const rolesQ = useQuery<RoleStat[]>({
    queryKey: ['admin-user-roles'],
    queryFn: () => api.get('/api/stats/admin/user-roles').then(r => r.data),
  });

  const topQ = useQuery<TopRestaurant[]>({
    queryKey: ['admin-top-restaurants'],
    queryFn: () => api.get('/api/stats/admin/top-restaurants?limit=10').then(r => r.data),
  });

  const stats = statsQ.data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thống kê hệ thống</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tổng quan toàn bộ hoạt động nền tảng TableNow</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Tổng nhà hàng', value: stats?.totalRestaurants ?? '—', iconBg: 'bg-blue-50', iconColor: 'text-blue-500', path: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m13-9l2 9' },
          { label: 'Người dùng',    value: stats?.totalUsers ?? '—',       iconBg: 'bg-violet-50', iconColor: 'text-violet-500', path: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-8a4 4 0 11-8 0 4 4 0 018 0z' },
          { label: 'Tổng đặt bàn',  value: stats?.totalBookings ?? '—',   iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', path: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          { label: 'NH hoạt động',  value: stats?.activeRestaurants ?? '—', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{k.label}</p>
              <p className="text-2xl font-extrabold text-gray-900">{k.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${k.iconBg}`}>
              <svg className={`w-5 h-5 ${k.iconColor}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={k.path} />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Tỉ lệ nhà hàng hoạt động" subtitle="So sánh hoạt động / tạm đóng">
          {statsQ.isLoading ? <LoadingCard /> : (
            <RestaurantDonut active={stats?.activeRestaurants ?? 0} total={stats?.totalRestaurants ?? 0} />
          )}
        </Card>

        <Card title="Phân bổ người dùng theo vai trò" subtitle="Admin · Manager · Khách hàng">
          {rolesQ.isLoading ? <LoadingCard /> : rolesQ.data && rolesQ.data.length > 0 ? (
            <RoleBarChart data={rolesQ.data} />
          ) : (
            <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
          )}
        </Card>
      </div>

      {/* Top restaurants */}
      <Card title="🏆 Nhà hàng đánh giá cao nhất" subtitle="Top 10 nhà hàng theo điểm rating trung bình">
        {topQ.isLoading ? <LoadingCard /> : <TopRestaurantsTable data={topQ.data ?? []} />}
      </Card>
    </div>
  );
}
