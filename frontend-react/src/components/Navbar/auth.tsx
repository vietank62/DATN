import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { toast } from "sonner";
import axios from "axios";

export const Auth = () => {
  const { isAuthenticated, login, logout } = useAuth();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const openLogin = () => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  };

  const closeLogin = () => {
    setIsLoginOpen(false);
    setLoginData({ email: "", password: "" }); // Reset form khi đóng
  };

  const openRegister = () => {
    setIsLoginOpen(false);
    setIsRegisterOpen(true);
  };

  const closeRegister = () => {
    setIsRegisterOpen(false);
    setConfirmPassword("");
    setAgreeTerms(false);
  };

  // Click ra ngoài để đóng modal
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeLogin();
  };

  const handleRegisterOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeRegister();
  };

  // --- Xử lý Đăng Nhập ---
  const onLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams();
      params.append("username", loginData.email);
      params.append("password", loginData.password);
      const response = await api.post("/v1/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const { access_token } = response.data;

      const userRes = await api.get("/v1/auth/active-user", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      login(access_token, userRes.data);
      closeLogin();
      if (userRes.data.role === "admin") {
        toast.success("Đăng nhập Admin thành công!");
        window.location.href = "/admin";
        return;
      } else if (userRes.data.role === "manager") {
        toast.success("Đăng nhập Manager thành công!");
        window.location.href = "/manager";
        return;
      }
      toast.success(`Đăng nhập thành công! Xin chào ${userRes.data.name}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.detail || "Đăng nhập thất bại";
        toast.error(message);
      } else {
      toast.error("Đã xảy ra lỗi hệ thống");
      console.error(error);
    }
    }
  };

  // --- Xử lý Đăng Ký ---
  const onRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Đã chuyển validation từ onLoginSubmit về đúng vị trí ở đây!
    if (registerData.password !== confirmPassword) {
      toast.error("Mật khẩu nhập lại không khớp!");
      return;
    }
    if (!agreeTerms) {
      toast.error("Bạn phải đồng ý với điều khoản để đăng ký!");
      return;
    }

    try {
      await api.post("/v1/auth/register", {
        ...registerData
      });
      toast.success("Đăng ký thành công! Hãy đăng nhập.");

      // Xóa trắng dữ liệu cũ của form đăng ký để bảo mật
      closeRegister();
      // Tự động mở form đăng nhập để user không phải click lại lần nữa
      openLogin();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.detail || "Đăng nhập thất bại";
        toast.error(message);
      } else {
      toast.error("Đã xảy ra lỗi hệ thống");
      console.error(error);
    }
    }
  };

  return (
    <div className="relative">
      <div className={`w-full h-10 bg-[#2C2C2C] flex text-white text-sm items-center ${isLoginOpen ? "blur-sm" : ""}`}>
        <div className="lg:ml-20 md:ml-20 ml-2">
          <a href="/" className="group flex items-center gap-2">
            <span className="text-white font-black tracking-tighter text-xl italic group-hover:text-red-500 transition-colors">
              TABLE
              <span className="text-red-600 group-hover:text-white transition-colors ml-1">NOW</span>
            </span>
          </a>
        </div>
        <div className="ml-auto col-auto lg:mr-20 md:mr-20 mr-2">
          <ul>
            <li className="flex gap-6">
              {!isAuthenticated ? (
                <>
                  <span onClick={openRegister} className="hover:text-red-500 cursor-pointer">Đăng ký</span>
                  <span onClick={openLogin} className="hover:text-red-500 cursor-pointer">Đăng nhập</span>
                  <span className="hidden lg:inline hover:text-red-500 cursor-pointer"><a href="/contact">Liên hệ</a></span>
                </>
              ) : (
                <>
                  {<span className="hover:text-red-500 cursor-pointer"><a href="/account">Tài khoản</a></span>}
                  <span onClick={logout} className="hover:text-red-500 cursor-pointer">Đăng xuất</span>
                  <span className="hidden lg:inline hover:text-red-500 cursor-pointer"><a href="/contact">Liên hệ</a></span>
                </>
              )}
            </li>
          </ul>
        </div>
      </div>

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-40" onClick={handleOverlayClick}>
          <div className="flex-1 absolute w-158.75 bg-gray-50 left-[50%] translate-x-[-50%] top-12.5 text-black">
            <div className="p-10 shadow-2xl">
              <h1 className="text-xl font-bold">Đăng nhập tài khoản</h1>
              <form className="flex flex-col gap-4 mt-4" onSubmit={onLoginSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded"
                  value={loginData.email}
                  onChange={e => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded"
                  value={loginData.password}
                  onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
                <button type="submit" className="w-30 bg-red-600 text-white p-2 hover:bg-red-700 cursor-pointer transition-colors shadow">
                  Đăng nhập
                </button>
              </form>
              <div className="flex justify-between mt-4">
                <span className="text-sm text-gray-500 hover:text-red-500 cursor-pointer">Quên mật khẩu?</span>
                <span onClick={openRegister} className="text-sm text-gray-500 hover:text-red-500 cursor-pointer">Chưa có tài khoản? Đăng ký</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-40" onClick={handleRegisterOverlayClick}>
          <div className="flex-1 absolute w-158.75 bg-gray-50 left-[50%] translate-x-[-50%] top-12.5 text-black">
            <div className="p-10 shadow-2xl">
              <h1 className="text-xl font-bold">Đăng ký tài khoản</h1>
              <form className="grid grid-cols-2 gap-4 mt-4" onSubmit={onRegisterSubmit}>
                <input
                  type="text"
                  placeholder="Tên"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded col-span-2"
                  value={registerData.name}
                  onChange={e => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded col-span-2"
                  value={registerData.email}
                  onChange={e => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded col-span-2"
                  value={registerData.phone}
                  onChange={e => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded col-span-2"
                  value={registerData.password}
                  onChange={e => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 rounded col-span-2"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
                <div className="col-span-2 flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                    required
                  />
                  <label htmlFor="agreeTerms" className="text-sm text-gray-700">
                    Tôi đồng ý với các <span className="text-red-600 cursor-pointer">điều khoản và dịch vụ</span> của <span className="text-red-600">TABLE NOW</span>
                  </label>
                </div>
                <button type="submit" className="w-30 bg-red-600 text-white p-2 hover:bg-red-700 cursor-pointer transition-colors shadow">
                  Đăng ký
                </button>
              </form>
              <div className="flex mt-4">
                <span onClick={openLogin} className="text-sm text-gray-500 hover:text-red-500 cursor-pointer">Đã có tài khoản? Đăng nhập</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};