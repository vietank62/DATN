import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// ── SVG Icon helpers ──────────────────────────────────────────────────────────
const Icon = ({
  path,
  className = "w-5 h-5",
}: {
  path: string;
  className?: string;
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  dashboard:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  users:
    "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-8a4 4 0 11-8 0 4 4 0 018 0zm6 8a2 2 0 100-4 2 2 0 000 4zM3 20a2 2 0 100-4 2 2 0 000 4z",
  restaurant:
    "M4 21V5a2 2 0 012-2h12a2 2 0 012 2v16M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01",
  booking:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  menu: "M4 3v18M8 3v7a4 4 0 008 0V3M8 21h8M20 3v18",
  message: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 014 11.5a8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
  partner:
    "M4 19.5A2.5 2.5 0 016.5 17H9l1.5 2h3L15 17h2.5a2.5 2.5 0 012.5 2.5V21H4v-1.5zM7 3h10v10H7z",
  stats:
    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  logout:
    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  chevronLeft: "M15 19l-7-7 7-7",
  chevronRight: "M9 5l7 7-7 7",
  hamburger: "M4 6h16M4 12h16M4 18h16",
  close: "M6 18L18 6M6 6l12 12",
};

export interface NavItem {
  label: string;
  to: string;
  icon: keyof typeof ICONS;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  brandLabel: string;
  /** 'admin' → violet active style | 'manager' → amber active style */
  variant: "admin" | "manager";
}

// Active link classes per variant
const ACTIVE_CLASSES = {
  admin: "bg-violet-50 text-violet-700 font-semibold",
  manager: "bg-amber-50 text-amber-700 font-semibold",
};
const ACTIVE_ICON = {
  admin: "text-violet-600",
  manager: "text-amber-600",
};
const BRAND_COLOR = {
  admin: "text-violet-600",
  manager: "text-amber-600",
};
const LOGO_RING = {
  admin: "ring-violet-200",
  manager: "ring-amber-200",
};

export default function DashboardSidebar({
  navItems,
  brandLabel,
  variant,
}: DashboardSidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? "justify-center" : ""}`}
      >
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ring-2 ${LOGO_RING[variant]}`}
        >
          <svg
            className={`w-5 h-5 ${BRAND_COLOR[variant]}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <p
              className={`text-sm font-bold ${BRAND_COLOR[variant]} leading-tight`}
            >
              TableNow
            </p>
            <p className="text-xs text-gray-400 leading-tight">{brandLabel}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">
            Điều hướng
          </p>
        )}
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split("/").length === 2}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150
              ${
                isActive
                  ? ACTIVE_CLASSES[variant]
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }
              ${collapsed ? "justify-center" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <span
                  className={isActive ? ACTIVE_ICON[variant] : "text-gray-400"}
                >
                  <Icon
                    path={ICONS[item.icon]}
                    className="w-5 h-5 flex-shrink-0"
                  />
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: collapse + logout */}
      <div className="px-2 pb-4 space-y-1 border-t border-gray-100 pt-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Mở rộng" : "Thu gọn"}
        >
          <Icon
            path={collapsed ? ICONS.chevronRight : ICONS.chevronLeft}
            className="w-4 h-4 flex-shrink-0"
          />
          {!collapsed && <span>Thu gọn</span>}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-orange-500 hover:bg-orange-50 hover:text-orange-600 transition-all ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Đăng xuất" : undefined}
        >
          <Icon path={ICONS.logout} className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 h-screen bg-white border-r border-gray-200 sticky top-0
        transition-all duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-64"}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200
        flex flex-col lg:hidden transform transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        id="sidebar-hamburger"
        className="fixed top-3 left-3 z-[60] lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm transition"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle sidebar"
      >
        <Icon
          path={mobileOpen ? ICONS.close : ICONS.hamburger}
          className="w-5 h-5"
        />
      </button>
    </>
  );
}

export { ICONS, Icon };
