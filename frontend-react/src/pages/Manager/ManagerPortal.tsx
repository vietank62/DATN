import { Link } from "react-router-dom";
import { Landmark, Settings2 } from "lucide-react";

export default function ManagerPortal() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 font-sans px-5 py-10">
      <section className="w-full max-w-3xl">
        <h1 className="text-center text-2xl font-normal text-gray-900">
          Chọn khu vực làm việc
        </h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link to="/manager/dashboard" className="flex min-h-48 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-red-400 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700"><Settings2 className="h-5 w-5" /></span>
            <h2 className="mt-auto text-lg font-normal text-gray-900">Quản trị nhà hàng</h2>
            <span className="mt-1 text-sm font-normal text-red-700">Truy cập →</span>
          </Link>

          <Link to="/manager/cashier" className="flex min-h-48 flex-col rounded-2xl border border-red-200 bg-white p-6 shadow-sm transition hover:border-red-400 hover:shadow-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-700"><Landmark className="h-5 w-5" /></span>
            <h2 className="mt-auto text-lg font-normal text-gray-900">Thu ngân</h2>
            <span className="mt-1 text-sm font-normal text-red-700">Truy cập →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
