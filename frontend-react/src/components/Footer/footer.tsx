import { Link } from "react-router-dom";

const policyLinks = [
  ["Hướng dẫn đặt bàn", "/booking-guide"],
  ["Điều khoản sử dụng", "/policies/terms"],
  ["Chính sách quyền riêng tư", "/policies/privacy"],
  ["Thanh toán & hoàn cọc", "/policies/payment-refund"],
] as const;

export const Footer = () => (
  <footer className="bg-slate-950 text-slate-300">
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
      <section className="lg:col-span-2">
        <Link to="/" className="text-2xl font-black tracking-tight text-white">Table<span className="text-red-500">Now</span></Link>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">TableNow giúp bạn khám phá nhà hàng, xem thông tin rõ ràng và đặt bàn thuận tiện cho mọi dịp ăn uống.</p>
        <Link to="/about" className="mt-5 inline-flex text-sm font-semibold text-red-400 hover:text-red-300">Tìm hiểu về TableNow →</Link>
      </section>
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Khách hàng</h2>
        <nav className="mt-4 space-y-3 text-sm">{policyLinks.slice(0, 1).map(([label, to]) => <Link key={to} to={to} className="block hover:text-white">{label}</Link>)}<Link to="/search" className="block hover:text-white">Tìm nhà hàng</Link><Link to="/map" className="block hover:text-white">Bản đồ nhà hàng</Link><Link to="/account/bookings" className="block hover:text-white">Đơn đặt bàn của tôi</Link></nav>
      </section>
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Chính sách</h2>
        <nav className="mt-4 space-y-3 text-sm">{policyLinks.slice(1).map(([label, to]) => <Link key={to} to={to} className="block hover:text-white">{label}</Link>)}</nav>
      </section>
    </div>
    <div className="border-t border-slate-800"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} TableNow. All rights reserved.</span><span>Hỗ trợ: support@tablenow.vn</span></div></div>
  </footer>
);
