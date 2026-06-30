import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface ManagerStats {
  totalBookings: number;
  todayBookings: number;
  avgRating: number;
  pendingBookings: number;
  confirmedBookings: number;
}
interface StatusStat { status: string; count: number; percentage: number; }
interface StatusChartResponse { distribution: StatusStat[]; totalBookings: number; }
interface MenuStat { category: string; count: number; percentage: number; }
interface MenuChartResponse { distribution: MenuStat[]; totalItems: number; }
interface FeeStats { unpaidBookingsCount: number; unpaidAmount: number; }

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  confirmed: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', confirmed: 'Xác nhận', completed: 'Hoàn thành', cancelled: 'Đã huỷ',
};

// ── Light KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, iconBg, icon }: {
  label: string; value: string | number; sub?: string; iconBg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
    </div>
  );
}

// ── SVG Donut chart ────────────────────────────────────────────────────────────
function DonutChart({ data, total }: { data: StatusStat[]; total: number }) {
  const R = 52, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const colorArr = Object.values(STATUS_COLOR);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-40 h-40 flex-shrink-0 -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f3f4f6" strokeWidth="18" />
        {data.map((d, i) => {
          const dash = (d.count / (total || 1)) * CIRC;
          const seg = (
            <circle key={i} cx="60" cy="60" r={R} fill="none"
              stroke={colorArr[i % 4]} strokeWidth="18"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-offset}
              className="transition-all duration-700" />
          );
          offset += dash;
          return seg;
        })}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
          style={{ transform: 'rotate(90deg)', transformOrigin: '60px 60px' }}
          fill="#111827" fontSize="13" fontWeight="700">{total}</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colorArr[i % 4] }} />
            <span className="text-gray-600">{STATUS_LABEL[d.status] ?? d.status}</span>
            <span className="ml-auto pl-4 font-semibold text-gray-800">{d.count}</span>
            <span className="text-gray-400 text-xs">({d.percentage}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBarChart({ data }: { data: MenuStat[] }) {
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  return (
    <ul className="space-y-4">
      {data.map((d, i) => (
        <li key={i}>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span className="truncate max-w-[60%] font-medium">{d.category}</span>
            <span className="font-semibold text-gray-700">{d.count} món ({d.percentage}%)</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${d.percentage}%`, background: COLORS[i % COLORS.length] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { user } = useAuth();
  const restaurantId = (user as unknown as { restaurantId?: number })?.restaurantId;

  const statsQ = useQuery<ManagerStats>({
    queryKey: ['manager-stats', restaurantId],
    queryFn: () => api.get(`/api/stats/manager/${restaurantId}`).then(r => r.data),
    enabled: !!restaurantId,
  });
  const statusQ = useQuery<StatusChartResponse>({
    queryKey: ['manager-status-chart', restaurantId],
    queryFn: () => api.get(`/api/stats/manager/${restaurantId}/booking-status`).then(r => r.data),
    enabled: !!restaurantId,
  });
  const menuQ = useQuery<MenuChartResponse>({
    queryKey: ['manager-menu-chart', restaurantId],
    queryFn: () => api.get(`/api/stats/manager/${restaurantId}/menu-distribution`).then(r => r.data),
    enabled: !!restaurantId,
  });
  const feeQ = useQuery<FeeStats>({
    queryKey: ['manager-fees', restaurantId],
    queryFn: () => api.get(`/api/restaurants/${restaurantId}/fee-stats`).then(r => r.data),
    enabled: !!restaurantId,
  });

  if (!restaurantId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-4">
        <svg className="w-14 h-14 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m13-9l2 9" />
        </svg>
        <p className="text-lg font-semibold text-gray-700">Tài khoản chưa liên kết nhà hàng</p>
        <p className="text-sm text-gray-400">Liên hệ Admin để được cấp quyền.</p>
      </div>
    );
  }

  const stats = statsQ.data;
  const fees = feeQ.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan nhà hàng</h1>
        <p className="text-sm text-gray-400 mt-0.5">Dữ liệu thời gian thực · Nhà hàng #{restaurantId}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Tổng đơn đặt" value={stats?.totalBookings ?? '—'} sub={`Hôm nay: ${stats?.todayBookings ?? 0}`}
          iconBg="bg-violet-50"
          icon={<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />
        <KpiCard label="Đơn chờ duyệt" value={stats?.pendingBookings ?? '—'} sub={`Đã xác nhận: ${stats?.confirmedBookings ?? 0}`}
          iconBg="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard label="Đánh giá TB" value={stats ? `${stats.avgRating} ★` : '—'}
          iconBg="bg-yellow-50"
          icon={<svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>}
        />
        <KpiCard label="Phí tích lũy" value={fees ? `${fees.unpaidAmount.toLocaleString('vi-VN')}đ` : '—'} sub={`${fees?.unpaidBookingsCount ?? 0} đơn chưa TT`}
          iconBg="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Tỉ lệ trạng thái đặt bàn</h2>
          {statusQ.isLoading ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
          ) : statusQ.data && statusQ.data.distribution.length > 0 ? (
            <DonutChart data={statusQ.data.distribution} total={statusQ.data.totalBookings} />
          ) : (
            <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
          )}
        </div>

        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Phân bổ danh mục thực đơn</h2>
          {menuQ.isLoading ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
          ) : menuQ.data && menuQ.data.distribution.length > 0 ? (
            <HBarChart data={menuQ.data.distribution} />
          ) : (
            <p className="text-gray-400 text-sm">Chưa có món ăn nào</p>
          )}
        </div>
      </div>
    </div>
  );
}
