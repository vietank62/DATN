import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Building2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { toast } from "sonner";
import axios from "axios";
import type { BookingDetail } from "../../types/booking";

type ChatConversation = {
  unread_count: number;
};

type CustomerNotification = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  conversationId?: number | null;
};

export const Auth = () => {
  const { isAuthenticated, login, logout, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const { data: bookings = [] } = useQuery<BookingDetail[]>({
    queryKey: ["my-bookings"],
    queryFn: () => api.get("/v1/bookings/me").then((response) => response.data),
    enabled: isAuthenticated && user?.role === "customer",
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: ["chat-conversations"],
    queryFn: () =>
      api.get("/v1/chat/conversations/me").then((response) => response.data),
    enabled: isAuthenticated && user?.role === "customer",
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const notificationsQuery = useQuery<CustomerNotification[]>({
    queryKey: ["customer-notifications"],
    queryFn: () =>
      api.get("/v1/notifications/me?limit=10").then((response) => response.data),
    enabled: isAuthenticated && user?.role === "customer",
    refetchInterval: 30_000,
  });

  const activeBookings = bookings.filter((booking) =>
    booking.status === "pending" || booking.status === "confirmed"
  );
  const unreadChatCount = conversations.reduce(
    (total, conversation) => total + conversation.unread_count,
    0,
  );
  const notifications = notificationsQuery.data ?? [];
  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  useEffect(() => {
    if (!isNotificationOpen) {
      return;
    }

    const closeWhenClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", closeWhenClickOutside);

    return () => {
      document.removeEventListener("mousedown", closeWhenClickOutside);
    };
  }, [isNotificationOpen]);

  const openLogin = () => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  };

  const closeLogin = () => {
    setIsLoginOpen(false);
    setLoginData({ email: "", password: "" }); 
  };

  const openRegister = () => {
    setIsLoginOpen(false);
    setIsRegisterOpen(true);
  };

  const openPartnerRegistration = () => {
    closeLogin();
    closeRegister();
    navigate("/partner/register");
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

  const openCustomerNotification = async (notification: CustomerNotification) => {
    if (!notification.isRead) {
      await api.put(`/v1/notifications/${notification.id}/read`);
      await notificationsQuery.refetch();
    }

    setIsNotificationOpen(false);

    if (notification.type === "chat_message") {
      navigate(`/chat?conversation=${notification.conversationId ?? ""}`);
      return;
    }

    navigate("/account/bookings");
  };

  const markAllNotificationsRead = async () => {
    if (unreadNotificationCount === 0) {
      return;
    }

    await api.put("/v1/notifications/read-all");
    await notificationsQuery.refetch();
  };

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
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurant-base"] });
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

  const onRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        ...registerData,
      });

      const loginParams = new URLSearchParams();
      loginParams.append("username", registerData.email);
      loginParams.append("password", registerData.password);

      const { data: token } = await api.post<{
        access_token: string;
        token_type: string;
      }>("/v1/auth/login", loginParams, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { data: registeredUser } = await api.get("/v1/auth/active-user", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });

      login(token.access_token, registeredUser);
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurant-base"] });
      closeRegister();
      toast.success(`Đăng ký thành công! Xin chào ${registeredUser.name}`);
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
                  <span onClick={openRegister} className="order-2 hover:text-red-500 cursor-pointer">Đăng ký</span>
                  <span onClick={openLogin} className="order-1 hover:text-red-500 cursor-pointer">Đăng nhập</span>
                  <span className="order-3 hidden lg:inline hover:text-red-500 cursor-pointer"><a href="/contact">Liên hệ</a></span>
                </>
              ) : (
                <>
                  {user?.role === "customer" && (
                    <div ref={notificationRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsNotificationOpen((current) => !current)}
                        className="relative flex cursor-pointer items-center justify-center rounded-lg p-1 text-white transition hover:bg-white/10 hover:text-amber-300"
                        aria-label="Thông báo"
                      >
                        <Bell className="h-4 w-4" />
                        {unreadNotificationCount > 0 && (
                          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                          </span>
                        )}
                      </button>
                      {isNotificationOpen && (
                        <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white text-gray-800 shadow-xl">
                          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <p className="text-sm font-bold">Thông báo</p>
                            {unreadNotificationCount > 0 && (
                              <button
                                type="button"
                                onClick={() => void markAllNotificationsRead()}
                                className="cursor-pointer text-xs font-semibold text-amber-700 hover:text-amber-900"
                              >
                                Đánh dấu đã đọc
                              </button>
                            )}
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 && (
                              <p className="p-5 text-center text-sm text-gray-400">
                                Chưa có thông báo.
                              </p>
                            )}
                            {notifications.map((notification) => (
                              <button
                                key={notification.id}
                                type="button"
                                onClick={() => void openCustomerNotification(notification)}
                                className={`w-full cursor-pointer border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                                  notification.isRead ? "bg-white" : "bg-amber-50/80"
                                } hover:bg-gray-50`}
                              >
                                <p className="text-sm font-bold text-gray-800">
                                  {notification.title}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                                  {notification.message}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative group">
                    <button type="button" className="hover:text-red-500 cursor-pointer flex items-center gap-1.5">
                      <span>Tài khoản</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 transition-transform group-hover:rotate-180">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full pt-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                      <div className="min-w-64 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden py-2">
                        <a
                          href="/account/profile"
                          className="block w-full px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          Thông tin tài khoản
                        </a>
                        {user?.role === "customer" && (
                          <a href="/account/bookings" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <span>Thông tin đơn đặt bàn</span>
                            <span className="flex items-center gap-2">
                              {activeBookings.length > 0 && (
                                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                  {activeBookings.length}
                                </span>
                              )}
                            </span>
                          </a>
                        )}
                        <button className="w-full cursor-not-allowed px-4 py-3 text-left text-sm text-gray-400" disabled>
                          Yêu thích
                        </button>
                        {user?.role === "customer" && (
                          <a
                            href="/chat"
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <span>Quản lí cuộc trò chuyện</span>
                            {unreadChatCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                {unreadChatCount > 9 ? "9+" : unreadChatCount}
                              </span>
                            )}
                          </a>
                        )}
                        {user?.role === "customer" && (
                          <a
                            href="/account/violation-reports"
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                          >
                             Vi phạm và giải trình
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={handleOverlayClick}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto bg-gray-50 text-black shadow-2xl">
            <div className="p-6 sm:p-8">
              <h1 className="text-xl font-bold">Đăng nhập tài khoản</h1>
              <form className="flex flex-col gap-4 mt-4" onSubmit={onLoginSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500"
                  value={loginData.email}
                  onChange={e => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="Mật khẩu"
                    className="w-full border border-gray-300 p-2 pr-10 focus:outline-none focus:border-red-500"
                    value={loginData.password}
                    onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    aria-label={showLoginPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-red-600"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={handleRegisterOverlayClick}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto bg-gray-50 text-black shadow-2xl">
            <div className="p-4 sm:p-6">
              <h1 className="text-xl font-bold">Đăng ký tài khoản</h1>
              <form className="grid grid-cols-2 gap-4 mt-4" onSubmit={onRegisterSubmit}>
                <input
                  type="text"
                  placeholder="Họ và tên"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 col-span-2"
                  value={registerData.name}
                  onChange={e => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 col-span-2"
                  value={registerData.email}
                  onChange={e => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  className="border border-gray-300 p-2 focus:outline-none focus:border-red-500 col-span-2"
                  value={registerData.phone}
                  onChange={e => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
                <div className="relative col-span-2">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    placeholder="Mật khẩu"
                    className="w-full border border-gray-300 p-2 pr-10 focus:outline-none focus:border-red-500"
                    value={registerData.password}
                    onChange={e => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((current) => !current)}
                    aria-label={showRegisterPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-red-600"
                  >
                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative col-span-2">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full border border-gray-300 p-2 pr-10 focus:outline-none focus:border-red-500"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-red-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="col-span-2 flex items-center gap-2 mt-1">
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
                <div className="flex justify-between items-center col-span-2">
                  <button type="submit" className="w-30 bg-red-600 text-white p-2 hover:bg-red-700 cursor-pointer transition-colors shadow">
                    Đăng ký
                  </button>
                  <div className="flex">
                    <span onClick={openLogin} className="text-sm text-gray-500 hover:text-red-500 cursor-pointer">Đã có tài khoản? Đăng nhập</span>
                  </div>
                </div>
              </form>
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-gray-900">Đăng ký nhà hàng trên TableNow</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  Tạo tài khoản đối tác để gửi hồ sơ nhà hàng và quản lý đặt bàn.
                </p>
                <button
                  type="button"
                  onClick={openPartnerRegistration}
                  className="mt-3 inline-flex w-full items-center justify-between rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                      <Building2 className="h-4 w-4" />
                    </span>
                    Trở thành đối tác TableNow
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
