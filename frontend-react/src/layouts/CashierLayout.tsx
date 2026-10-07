import { Outlet } from "react-router-dom";
import TableConflictPanel from "../components/TableConflictPanel";
import DashboardSidebar, {
  type NavItem,
} from "../components/DashboardSidebar/DashboardSidebar";

const CASHIER_NAV: NavItem[] = [
  { label: "Khu vực", to: "/manager/cashier", icon: "restaurant" },
  { label: "Danh sách món ăn", to: "/manager/cashier/menu", icon: "menu" },
  { label: "Đặt bàn online", to: "/manager/cashier/bookings", icon: "booking" },
  { label: "Chi tiết ca", to: "/manager/cashier/shift", icon: "receipt" },
  { label: "Xuất hóa đơn", to: "/manager/cashier/invoices", icon: "receipt" },
  { label: "Cài đặt thanh toán", to: "/manager/cashier/payment-settings", icon: "settings" },
];

/** A dedicated workspace for counter staff, intentionally separate from management navigation. */
export default function CashierLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800 font-sans">
      <DashboardSidebar
        navItems={CASHIER_NAV}
        brandLabel="Thu ngân"
        variant="manager"
        footerLink={{
          label: "Chọn khu vực làm việc",
          to: "/manager",
          icon: "dashboard",
        }}
      />
      <main className="min-w-0 flex-1 p-4 lg:p-7">
        <TableConflictPanel />
        <Outlet />
      </main>
    </div>
  );
}
