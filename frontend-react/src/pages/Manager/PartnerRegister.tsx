import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

type PartnerRegisterForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

const initialForm: PartnerRegisterForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
};

export default function PartnerRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState<PartnerRegisterForm>(initialForm);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof PartnerRegisterForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.password !== confirmPassword) {
      toast.error("Mật khẩu nhập lại không khớp.");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Vui lòng đồng ý điều khoản đối tác TableNow.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/v1/auth/partner-register", form);

      const loginParams = new URLSearchParams();
      loginParams.append("username", form.email);
      loginParams.append("password", form.password);

      const { data: token } = await api.post<{
        access_token: string;
        token_type: string;
      }>("/v1/auth/login", loginParams, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { data: manager } = await api.get("/v1/auth/active-user", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });

      login(token.access_token, manager);
      toast.success(
        "Tạo tài khoản đối tác thành công. Chào mừng bạn đến với TableNow!",
      );
      navigate("/manager", { replace: true });
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? "Không thể tạo tài khoản đối tác."
        : "Đã có lỗi hệ thống xảy ra.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 sm:py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Quay lại
      </button>

      <div className="grid overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-linear-to-br from-red-400 to-amber-600 p-7 text-white sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-7 text-3xl font-black tracking-tight">
            Trở thành đối tác TableNow
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-red-50">
            Tiếp cận thực khách, quản lý đặt bàn và xây dựng hiện diện trực tuyến cho nhà hàng của bạn.
          </p>

          <ul className="mt-8 space-y-4 text-sm">
            {[
              "Tạo hồ sơ nhà hàng và gửi xét duyệt trực tuyến.",
              "Quản lý thực đơn, khung giờ nhận khách và đặt bàn.",
              "Theo dõi hoạt động tại dashboard dành cho đối tác.",
            ].map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="p-7 sm:p-10">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900">Tạo tài khoản quản lý</h2>
            <p className="mt-2 text-sm text-gray-500">
              Sau khi đăng nhập, bạn sẽ hoàn thiện thông tin pháp lý và hồ sơ nhà hàng.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              Họ tên người đại diện
              <input
                required
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Nguyễn Văn A"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-red-500 focus:bg-white"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="partner@restaurant.com"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-red-500 focus:bg-white"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Số điện thoại
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="090 123 4567"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-red-500 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Mật khẩu
                <div className="relative mt-1.5">
                  <input
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 pr-11 font-normal outline-none transition focus:border-red-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 hover:text-red-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Xác nhận mật khẩu
                <div className="relative mt-1.5">
                  <input
                    required
                    minLength={6}
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 pr-11 font-normal outline-none transition focus:border-red-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 hover:text-red-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-gray-600">
              <input
                required
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span>
                Tôi đồng ý với {" "}
                <Link
                  to="/partner/policy"
                  className="font-bold text-red-700 underline"
                >
                  chính sách đối tác TableNow
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-5 w-5" />
              {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản đối tác"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Đã có tài khoản quản lý?{" "}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-bold text-red-600 hover:text-red-700"
            >
              Về trang chủ để đăng nhập
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
