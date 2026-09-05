import { BOOKING_STATUS_LABEL as STATUS_LABEL, BOOKING_STATUS_COLOR as STATUS_COLOR } from "../../utils/status";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlyBookingStat {
  month: number;
  count: number;
  label: string;
}
interface BookingChartResponse {
  monthly: MonthlyBookingStat[];
  totalYear: number;
  year: number;
}
interface StatusStat {
  status: string;
  count: number;
  percentage: number;
}
interface StatusChartResponse {
  distribution: StatusStat[];
  totalBookings: number;
}

interface FeeStats { availableBalance: number; totalDeposit: number; paidOut: number; completedBookings: number; }

// ── Colours ───────────────────────────────────────────────────────────────────
const DONUT_FALLBACK = ["#f59e0b", "#3b82f6", "#10b981", "#f97316"];

// ── Shared card ────────────────────────────────────────────────────────────────
function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
      <svg
        className="animate-spin w-5 h-5 mr-2 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
      Đang tải...
    </div>
  );
}

// ── SVG Line Chart ─────────────────────────────────────────────────────────────
function LineChart({ data }: { data: MonthlyBookingStat[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600,
    H = 200,
    PAD = { top: 20, right: 20, bottom: 36, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const stepX = chartW / (data.length - 1 || 1);

  const pts = data.map((d, i) => ({
    x: PAD.left + i * stepX,
    y: PAD.top + chartH - (d.count / maxVal) * chartH,
    ...d,
  }));

  // Smooth cubic bezier path
  const pathD = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 3;
    const cx2 = pt.x - (pt.x - prev.x) / 3;
    return `${acc} C ${cx1},${prev.y} ${cx2},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  // Area fill
  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x},${PAD.top + chartH} L ${pts[0].x},${PAD.top + chartH} Z`;

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    y: PAD.top + chartH - pct * chartH,
    label: Math.round(pct * maxVal),
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-120"
        style={{ height: 220 }}
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={g.y}
              x2={W - PAD.right}
              y2={g.y}
              stroke="#f3f4f6"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6}
              y={g.y + 4}
              textAnchor="end"
              fill="#9ca3af"
              fontSize="10"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Area */}
        <path d={areaD} fill="url(#lineGrad)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X axis labels */}
        {pts.map((pt, i) => (
          <text
            key={i}
            x={pt.x}
            y={H - 8}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            {pt.label}
          </text>
        ))}

        {/* Dots + hover tooltips */}
        {pts.map((pt, i) => (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hover === i ? 5 : 4}
              fill={hover === i ? "#f59e0b" : "#fff"}
              stroke="#f59e0b"
              strokeWidth="2.5"
              className="transition-all duration-150"
            />
            {hover === i && pt.count > 0 && (
              <g>
                <rect
                  x={pt.x - 22}
                  y={pt.y - 32}
                  width={44}
                  height={22}
                  rx="6"
                  fill="#1f2937"
                  opacity="0.88"
                />
                <text
                  x={pt.x}
                  y={pt.y - 16}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="700"
                >
                  {pt.count} đơn
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────
function StatusDonut({ data, total }: { data: StatusStat[]; total: number }) {
  const R = 52,
    CIRC = 2 * Math.PI * R;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-40 h-40 shrink-0 -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="18"
        />
        {data.map((d, i) => {
          const color = STATUS_COLOR[d.status] ?? DONUT_FALLBACK[i % 4];
          const dash = (d.count / (total || 1)) * CIRC;
          const offset = data
            .slice(0, i)
            .reduce((sum, item) => sum + (item.count / (total || 1)) * CIRC, 0);
          return (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-offset}
              className="transition-all duration-700"
            />
          );
        })}
        <text
          x="60"
          y="60"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ transform: "rotate(90deg)", transformOrigin: "60px 60px" }}
          fill="#111827"
          fontSize="13"
          fontWeight="700"
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-2.5 text-sm flex-1">
        {data.map((d, i) => {
          const color = STATUS_COLOR[d.status] ?? DONUT_FALLBACK[i % 4];
          return (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: color }}
              />
              <span className="text-gray-600 flex-1">{STATUS_LABEL[d.status] ?? d.status}</span>
              <span className="font-bold text-gray-800">{d.count}</span>
              <span className="text-gray-400 text-xs w-12 text-right">
                ({d.percentage}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Fee table ─────────────────────────────────────────────────────────────────
function FeeSummaryCard({ data }: { data: FeeStats }) {
  return <div className="grid gap-4 sm:grid-cols-3">
    {[{ label: "Tổng cọc đơn hoàn thành", amount: data.totalDeposit },
      { label: "Đã rút", amount: data.paidOut },
      { label: "Có thể rút", amount: data.availableBalance }].map(item => (
        <div key={item.label} className="rounded-xl bg-emerald-50 p-4">
          <p className="text-sm text-gray-600">{item.label}</p>
          <p className="text-lg font-bold text-emerald-700">{item.amount.toLocaleString("vi-VN")}đ</p>
        </div>
      ))}
  </div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ManagerStats() {
  const { user } = useAuth();
  const restaurantId = (user as unknown as { restaurantId?: number })
    ?.restaurantId;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const monthlyQ = useQuery<BookingChartResponse>({
    queryKey: ["manager-monthly", restaurantId, year],
    queryFn: () =>
      api
        .get(`/api/stats/manager/${restaurantId}/monthly-bookings?year=${year}`)
        .then((r) => r.data),
    enabled: !!restaurantId,
  });

  const statusQ = useQuery<StatusChartResponse>({
    queryKey: ["manager-status-chart", restaurantId],
    queryFn: () =>
      api
        .get(`/api/stats/manager/${restaurantId}/booking-status`)
        .then((r) => r.data),
    enabled: !!restaurantId,
  });

  const feeQ = useQuery<FeeStats>({
    queryKey: ["manager-deposit-summary", restaurantId],
    queryFn: () =>
      api.get("/v1/deposits/manager/summary").then((r) => r.data),
    enabled: !!restaurantId,
  });

  if (!restaurantId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3">
        <svg
          className="w-12 h-12 opacity-30"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="font-semibold text-gray-600">
          Tài khoản chưa liên kết nhà hàng
        </p>
      </div>
    );
  }

  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thống kê nhà hàng</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Phân tích dữ liệu hoạt động · Nhà hàng #{restaurantId}
        </p>
      </div>

      {/* Line chart — monthly bookings */}
      <Card
        title="📈 Tăng trưởng lượt đặt bàn theo tháng"
        subtitle={`Tổng năm ${year}: ${monthlyQ.data?.totalYear ?? 0} đơn`}
        action={
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-amber-400 transition"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        }
      >
        {monthlyQ.isLoading ? (
          <Loading />
        ) : monthlyQ.data && monthlyQ.data.monthly.length > 0 ? (
          <LineChart data={monthlyQ.data.monthly} />
        ) : (
          <p className="text-gray-400 text-sm">
            Chưa có dữ liệu cho năm {year}
          </p>
        )}
      </Card>

      {/* Status donut */}
      <Card
        title="🍩 Phân bổ trạng thái đặt bàn"
        subtitle="Tỉ lệ toàn bộ đơn trên hệ thống"
      >
        {statusQ.isLoading ? (
          <Loading />
        ) : statusQ.data && statusQ.data.distribution.length > 0 ? (
          <StatusDonut
            data={statusQ.data.distribution}
            total={statusQ.data.totalBookings}
          />
        ) : (
          <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
        )}
      </Card>

      {/* Fee summary */}
      <Card title="Tiền đặt cọc" subtitle="Tổng hợp các đơn hoàn thành">
        {feeQ.isLoading ? (
          <Loading />
        ) : feeQ.data ? (
          <FeeSummaryCard data={feeQ.data} />
        ) : (
          <p className="text-gray-400 text-sm">Chưa có dữ liệu đặt cọc</p>
        )}
      </Card>
    </div>
  );
}
