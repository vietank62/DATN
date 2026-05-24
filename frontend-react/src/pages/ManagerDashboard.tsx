import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import styles from './ManagerDashboard.module.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  fetchBookings, 
  fetchRestaurants, 
  fetchManagerStats, 
  updateBookingStatus, 
  updateRestaurant as apiUpdateRestaurant, 
  fetchMenuItems, 
  createMenuItem as apiCreateMenuItem, 
  updateMenuItem as apiUpdateMenuItem, 
  deleteMenuItem as apiDeleteMenuItem,
  updateUser as apiUpdateUser,
  fetchMonthlyBookings,
  fetchMenuDistribution,
  fetchBookingStatusDistribution,
  fetchFeeStats,
  payRestaurantFees,
  createPayment,
  getPaymentStatus,
  getCheckoutFields,
  simulatePaymentWebhook,
} from '../services/api';
import type { Booking, ManagerStats, Restaurant, MenuItem, BookingChartResponse, MenuChartResponse, StatusChartResponse } from '../types';
import SeatStatusBadge from '../components/SeatStatusBadge/SeatStatusBadge';
import ManagerBookingAction from '../components/ManagerBookingAction/ManagerBookingAction';
import ImageUpload from '../components/ImageUpload/ImageUpload';
// Register ChartJS components

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

const emptyMenuItem: Omit<MenuItem, 'id'> = {
  name: '', description: '', price: 0, imageUrl: '', category: '', available: true,
};

const defaultRestaurant: Restaurant = {
  id: '', name: '', address: '', district: '', cuisine: [], priceRange: '',
  rating: 0, reviewCount: 0, imageUrl: [], description: '',
  openTime: '', closeTime: '', phone: '', featured: false,
  totalSeats: 0, availableSeats: 0,
};

const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, logout, updateUser: updateContextUser, cuisines } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<ManagerStats>({ 
    totalBookings: 0, todayBookings: 0, totalRevenue: 0, 
    avgRating: 0, pendingBookings: 0, confirmedBookings: 0 
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'restaurant' | 'menu' | 'stats' | 'fees'>('bookings');

  // Fee state
  const [feeStats, setFeeStats] = useState<{
    totalBookings: number;
    completedBookings: number;
    unpaidBookingsCount: number;
    paidBookingsCount: number;
    unpaidAmount: number;
    paidAmount: number;
    totalAmount: number;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [activePayment, setActivePayment] = useState<{
    paymentId: number;
    restaurantId: number;
    amount: number;
    transactionCode: string;
    status: string;
    qrUrl: string;
    bankId: string;
    accountNo: string;
    accountName: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ checkoutUrl: string; fields: Record<string, string> } | null>(null);

  // Restaurant state
  const [restaurant, setRestaurant] = useState<Restaurant>(defaultRestaurant);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Restaurant>(defaultRestaurant);
  const [saveMsg, setSaveMsg] = useState('');

  // Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState(emptyMenuItem);
  const [deleteMenuConfirm, setDeleteMenuConfirm] = useState<string | null>(null);

  // Filter state for bookings
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('all');
  const [bookingFilterDate, setBookingFilterDate] = useState<string>('');
  const [bookingFilterName, setBookingFilterName] = useState<string>('');

  // Profile state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', password: '', confirmPassword: '' });

  // Note modal state
  const [viewingNote, setViewingNote] = useState<{ bookingId: string; note: string; contactName: string } | null>(null);

  // Chart data state
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<BookingChartResponse | null>(null);
  const [menuDistData, setMenuDistData] = useState<MenuChartResponse | null>(null);
  const [statusData, setStatusData] = useState<StatusChartResponse | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);


  const DISTRICTS = [
    'Quận 1','Quận 2','Quận 3','Quận 4','Quận 5','Quận 6','Quận 7',
    'Quận 8','Quận 9','Quận 10','Quận 11','Quận 12',
    'Bình Tân','Bình Thạnh','Gò Vấp','Phú Nhuận',
    'Tân Bình','Tân Phú','Thủ Đức'
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const allRestaurants = await fetchRestaurants();
        const managerId = authUser ? Number(authUser.id) : undefined;
        const myRestaurant = managerId
          ? allRestaurants.find((r) => r.managerID === managerId) || allRestaurants[0]
          : allRestaurants[0];
          
        if (myRestaurant) {
          setRestaurant(myRestaurant);
          setEditForm(myRestaurant);
          const [bData, sData, mData] = await Promise.all([
            fetchBookings(myRestaurant.id),
            fetchManagerStats(myRestaurant.id),
            fetchMenuItems(myRestaurant.id),
          ]);
          setBookings(bData);
          setStats(sData);
          setMenuItems(mData);
        }
      } catch (err) {
        console.error(err);
        toast.error('Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Polling for real-time updates every 30 seconds
    const interval = setInterval(async () => {
      if (restaurant.id) {
        try {
          const [bData, sData] = await Promise.all([
            fetchBookings(restaurant.id),
            fetchManagerStats(restaurant.id),
          ]);
          setBookings(prev => {
            // Check for new bookings to notify
            if (bData.length > prev.length) {
              toast.success(`Có ${bData.length - prev.length} đơn đặt bàn mới!`, {
                icon: '🔔',
                duration: 5000,
              });
            }
            return bData;
          });
          setStats(sData);
        } catch (e) {}
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [authUser, restaurant.id]);

  // Load chart data when stats tab is active or restaurantId changes
  useEffect(() => {
    if (activeTab === 'stats' && restaurant.id) {
      loadChartData(restaurant.id, chartYear);
    }
  }, [activeTab, restaurant.id, chartYear]);

  // Load fee statistics when fees tab is active
  useEffect(() => {
    if (activeTab === 'fees' && restaurant.id) {
      loadFeeStats(restaurant.id);
      setActivePayment(null); // Reset when tab changes
    }
  }, [activeTab, restaurant.id]);

  // SePay automated polling effect
  useEffect(() => {
    let intervalId: any;
    if (activePayment && activePayment.status === 'pending') {
      intervalId = setInterval(async () => {
        try {
          const statusRes = await getPaymentStatus(activePayment.paymentId);
          if (statusRes.status === 'completed') {
            toast.success('Giao dịch chuyển khoản đã được hệ thống xác nhận! 🎉', { duration: 5000 });
            setActivePayment(null);
            if (restaurant.id) {
              await loadFeeStats(restaurant.id);
            }
          }
        } catch (e) {
          console.error('Error polling payment status:', e);
        }
      }, 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activePayment, restaurant.id]);

  // SePay Checkout Fields loading effect
  useEffect(() => {
    if (activePayment) {
      const loadFields = async () => {
        try {
          const data = await getCheckoutFields(activePayment.paymentId);
          setCheckoutData(data);
        } catch (e) {
          console.error("Failed to load checkout fields", e);
          toast.error("Không thể tải cấu hình cổng thanh toán SePay Checkout");
        }
      };
      loadFields();
    } else {
      setCheckoutData(null);
    }
  }, [activePayment]);

  const loadFeeStats = async (resId: string) => {
    try {
      const data = await fetchFeeStats(resId);
      setFeeStats(data);
    } catch (e) {
      console.error('Lỗi tải thông tin phí:', e);
      toast.error('Không thể tải thông tin phí đặt bàn');
    }
  };

  const handleCreatePayment = async () => {
    if (!restaurant.id) return;
    setPaymentLoading(true);
    const loadingToast = toast.loading('Đang khởi tạo mã VietQR SePay...');
    try {
      const payRes = await createPayment(restaurant.id);
      setActivePayment(payRes);
      toast.success('Đã tạo giao dịch thành công!', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi tạo thanh toán', { id: loadingToast });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!activePayment) return;
    setPaymentLoading(true);
    const loadingToast = toast.loading('Đang gửi tín hiệu chuyển khoản giả lập...');
    try {
      const simRes = await simulatePaymentWebhook(activePayment.paymentId);
      if (simRes.webhookResult && simRes.webhookResult.success) {
        toast.success('Ngân hàng báo: Đã nhận tiền thành công! Hệ thống đang cập nhật...', { id: loadingToast });
        
        // Manual verification check to instantly resolve the UI state
        const statusRes = await getPaymentStatus(activePayment.paymentId);
        if (statusRes.status === 'completed') {
          toast.success('Thanh toán hoàn thành! 🎉', { icon: '💰' });
          setActivePayment(null);
          if (restaurant.id) {
            await loadFeeStats(restaurant.id);
          }
        }
      } else {
        toast.error(simRes.webhookResult?.message || 'Giả lập thất bại', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi yêu cầu giả lập', { id: loadingToast });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCopyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Đã copy ${field}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePayFees = async () => {
    // Deprecated in favor of SePay, but keep fallback
    if (!restaurant.id || !feeStats || feeStats.unpaidAmount === 0) {
      toast.error('Không có phí cần thanh toán');
      return;
    }
    setPaymentLoading(true);
    const loadingToast = toast.loading('Đang kết nối cổng thanh toán...');
    try {
      await payRestaurantFees(restaurant.id);
      toast.success('Thanh toán phí dịch vụ thành công!', { id: loadingToast });
      await loadFeeStats(restaurant.id);
    } catch (err: any) {
      toast.error(err.message || 'Thanh toán thất bại', { id: loadingToast });
    } finally {
      setPaymentLoading(false);
    }
  };

  const loadChartData = async (restaurantId: string, year: number) => {
    setChartsLoading(true);
    try {
      const [monthly, menuDist, statusDist] = await Promise.all([
        fetchMonthlyBookings(restaurantId, year),
        fetchMenuDistribution(restaurantId),
        fetchBookingStatusDistribution(restaurantId),
      ]);
      setMonthlyData(monthly);
      setMenuDistData(menuDist);
      setStatusData(statusDist);
    } catch (err) {
      console.error('Chart data error:', err);
      toast.error('Lỗi khi tải dữ liệu thống kê');
    } finally {
      setChartsLoading(false);
    }
  };


  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const openProfile = () => {
    setProfileForm({ name: authUser?.name || '', phone: authUser?.phone || '', password: '', confirmPassword: '' });
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim()) { toast.error('Vui lòng nhập họ tên'); return; }
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp'); return;
    }
    const loadingToast = toast.loading('Đang cập nhật...');
    try {
      const updates: any = { name: profileForm.name, phone: profileForm.phone };
      if (profileForm.password) updates.password = profileForm.password;
      const updated = await apiUpdateUser(authUser!.email, updates);
      updateContextUser(updated);
      setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      toast.success('Cập nhật thông tin thành công!', { id: loadingToast });
      setShowProfileModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật', { id: loadingToast });
    }
  };

  const toggleCuisine = (cuisineId: string) => {
    setEditForm((prev) => ({
      ...prev,
      cuisine: prev.cuisine?.includes(cuisineId)
        ? prev.cuisine.filter((c) => c !== cuisineId)
        : [...(prev.cuisine || []), cuisineId],
    }));
  };

  const saveEdit = async () => {
    const loadingToast = toast.loading('Đang lưu thay đổi...');
    try {
      const updated = await apiUpdateRestaurant(restaurant.id, editForm);
      setRestaurant(updated);
      setEditMode(false);
      setSaveMsg('Đã cập nhật thông tin nhà hàng!');
      toast.success('Đã lưu thay đổi thành công!', { id: loadingToast });
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật', { id: loadingToast });
    }
  };

  const handleStatusChange = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      toast.success('Đã cập nhật trạng thái đặt bàn');
    } catch (err) {
      toast.error('Không thể cập nhật trạng thái');
    }
  };

  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price) {
      toast.error('Vui lòng nhập tên và giá món ăn');
      return;
    }
    const loadingToast = toast.loading('Đang lưu món ăn...');
    try {
      if (editingMenuItem) {
        const updated = await apiUpdateMenuItem(editingMenuItem.id, menuForm);
        setMenuItems((prev) => prev.map((item) => item.id === editingMenuItem.id ? updated : item));
        toast.success('Cập nhật món ăn thành công', { id: loadingToast });
      } else {
        const created = await apiCreateMenuItem({ ...menuForm, restaurantId: restaurant.id });
        setMenuItems((prev) => [...prev, created]);
        toast.success('Thêm món ăn thành công', { id: loadingToast });
      }
      setShowMenuModal(false);
    } catch (err) {
      toast.error('Lỗi khi lưu món ăn', { id: loadingToast });
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    const loadingToast = toast.loading('Đang xoá món ăn...');
    try {
      await apiDeleteMenuItem(id);
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Đã xoá món ăn thành công', { id: loadingToast });
      setDeleteMenuConfirm(null);
    } catch (err) {
      toast.error('Lỗi khi xoá món ăn', { id: loadingToast });
    }
  };

  if (loading) return <div className={styles.loading}>Đang tải...</div>;

  return (
    <div className={styles.dashboard}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Quản lý Nhà hàng</h2>
          <p>{restaurant.name || 'Đang tải...'}</p>
        </div>
        <div className={styles.sidebarNav}>
          <button 
            className={`${styles.navItem} ${activeTab === 'bookings' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            📋 Đơn đặt bàn
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'restaurant' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('restaurant')}
          >
            🏠 Thông tin nhà hàng
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'menu' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            🍱 Thực đơn
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'stats' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            📊 Thống kê
          </button>
          <button 
            className={`${styles.navItem} ${activeTab === 'fees' ? styles.navActive : ''}`}
            onClick={() => setActiveTab('fees')}
          >
            💰 Thanh toán phí
          </button>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <h1>
            {activeTab === 'bookings' && 'Đơn đặt bàn'}
            {activeTab === 'restaurant' && 'Thông tin nhà hàng'}
            {activeTab === 'menu' && 'Thực đơn'}
            {activeTab === 'stats' && 'Thống kê'}
            {activeTab === 'fees' && 'Thanh toán phí dịch vụ'}
          </h1>
          <div className={styles.topBarRight}>
            <div className={styles.userInfo}>
              <span className={styles.userAvatar}>{(authUser?.name || 'M')[0].toUpperCase()}</span>
              <span>{authUser?.name || 'Manager'}</span>
            </div>
            <button className={styles.profileBtn} onClick={openProfile} title="Cài đặt tài khoản">⚙️</button>
            <button className={styles.logoutBtnTop} onClick={handleLogout}>Đăng xuất</button>
          </div>
        </div>

        {activeTab === 'bookings' && (() => {
          const filteredBookings = bookings.filter(b => {
            const matchStatus = bookingFilterStatus === 'all' || b.status === bookingFilterStatus;
            const matchDate = bookingFilterDate === '' || b.date === bookingFilterDate;
            const matchName = bookingFilterName === '' || (b.contactInfo?.name || '').toLowerCase().includes(bookingFilterName.toLowerCase());
            return matchStatus && matchDate && matchName;
          });

          return (
          <div style={{ marginTop: '32px' }}>
            <div className={styles.tableContainer}>
              <div className={styles.tableHeader}>
                <h3>Danh sách đặt bàn</h3>
                <div className={styles.bookingFilters}>
                  <input
                    type="text"
                    placeholder="🔍 Tìm tên khách..."
                    value={bookingFilterName}
                    onChange={(e) => setBookingFilterName(e.target.value)}
                    className={styles.filterInput}
                  />
                  <input
                    type="date"
                    value={bookingFilterDate}
                    onChange={(e) => setBookingFilterDate(e.target.value)}
                    className={styles.filterInput}
                  />
                  <select
                    value={bookingFilterStatus}
                    onChange={(e) => setBookingFilterStatus(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="cancelled">Đã huỷ</option>
                  </select>
                </div>
              </div>
              <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Khách hàng</th>
                      <th>Ngày &amp; Giờ</th>
                      <th>Khách</th>
                      <th>Ghi chú</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                          Không tìm thấy đơn đặt bàn nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>#{booking.id}</td>
                        <td>
                          <strong>{booking.contactInfo.name}</strong><br/>
                          <small>{booking.contactInfo.phone}</small>
                        </td>
                        <td>{booking.date} {booking.time}</td>
                        <td>{booking.guestCount}</td>
                        <td>
                          {booking.note ? (
                            <button
                              className={styles.noteBtn}
                              onClick={() => setViewingNote({ bookingId: booking.id, note: booking.note, contactName: booking.contactInfo.name })}
                              title={booking.note}
                            >
                              📝 Xem ghi chú
                            </button>
                          ) : (
                            <span className={styles.noNote}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[booking.status]}`}>
                            {booking.status === 'pending' ? 'Chờ' :
                             booking.status === 'confirmed' ? 'Xác nhận' :
                             booking.status === 'completed' ? 'Hoàn thành' : 'Huỷ'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {booking.status === 'pending' && (
                              <button onClick={() => handleStatusChange(booking.id, 'confirmed')} className={styles.confirmBtn}>Xác nhận</button>
                            )}
                            {booking.status === 'confirmed' && (
                              <button onClick={() => handleStatusChange(booking.id, 'completed')} className={styles.completeBtn}>Xong</button>
                            )}
                            {['pending', 'confirmed'].includes(booking.status) && (
                              <button onClick={() => handleStatusChange(booking.id, 'cancelled')} className={styles.cancelBtn}>Huỷ</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
        </div>
          </div>
          );
        })()}

          {activeTab === 'restaurant' && (
            <div className={styles.restaurantInfo}>
              {saveMsg && <div className={styles.saveSuccess}>{saveMsg}</div>}

              {/* Hero banner */}
              {!editMode && restaurant.imageUrl && restaurant.imageUrl.length > 0 && (
                <div className={styles.restaurantHero}>
                  <img src={restaurant.imageUrl[0]} alt={restaurant.name} className={styles.restaurantHeroImg} />
                  <div className={styles.restaurantHeroOverlay}>
                    <h2>{restaurant.name}</h2>
                    <div className={styles.restaurantBadges}>
                      {restaurant.cuisine.map(c => {
                        const cuisine = cuisines.find(ct => ct.id === c || ct.label === c);
                        return <span key={c} className={styles.cuisineBadge}>{cuisine ? `${cuisine.icon} ${cuisine.label}` : c}</span>;
                      })}
                      {restaurant.featured && <span className={styles.featuredBadge}>⭐ Nổi bật</span>}
                    </div>

                  </div>
                </div>
              )}

              <div className={styles.restaurantCard}>
                <div className={styles.detailTitleRow}>
                  <h3>🏠 Thông tin chi tiết</h3>
                  <button className={styles.editInfoBtn} onClick={() => { setEditMode(!editMode); setEditForm(restaurant); }}>
                    {editMode ? 'Huỷ' : '✏️ Chỉnh sửa'}
                  </button>
                </div>

                {editMode ? (
                  <div className={styles.editForm}>
                    <div className={styles.editFormGrid}>
                      <div className={styles.editFormGroup}>
                        <label>Tên nhà hàng</label>
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Quận/Huyện</label>
                        <select value={editForm.district} onChange={(e) => setEditForm({...editForm, district: e.target.value})}>
                          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Giờ mở cửa</label>
                        <input type="time" value={editForm.openTime} onChange={(e) => setEditForm({...editForm, openTime: e.target.value})} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Giờ đóng cửa</label>
                        <input type="time" value={editForm.closeTime} onChange={(e) => setEditForm({...editForm, closeTime: e.target.value})} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Số điện thoại</label>
                        <input type="text" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Tổng số ghế</label>
                        <input type="number" value={editForm.totalSeats} onChange={(e) => setEditForm({...editForm, totalSeats: Number(e.target.value)})} />
                      </div>
                      <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                        <label>Loại ẩm thực (Chọn nhiều)</label>
                        <div className={styles.cuisineGrid}>
                          {cuisines.filter(c => c.id !== 'all').map(c => (
                            <label key={c.id} className={styles.checkboxLabel}>
                              <input type="checkbox" checked={editForm.cuisine.includes(c.id)} onChange={() => toggleCuisine(c.id)} />
                              <span>{c.icon} {c.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtnPrimary} onClick={saveEdit}>Lưu thay đổi</button>
                      <button className={styles.cancelEditBtn} onClick={() => setEditMode(false)}>Huỷ</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>📍</span>
                      <div>
                        <div className={styles.infoLabel}>Địa chỉ</div>
                        <div className={styles.infoValue}>{restaurant.address}</div>
                      </div>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>📞</span>
                      <div>
                        <div className={styles.infoLabel}>Điện thoại</div>
                        <div className={styles.infoValue}>{restaurant.phone}</div>
                      </div>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>🕒</span>
                      <div>
                        <div className={styles.infoLabel}>Giờ hoạt động</div>
                        <div className={styles.infoValue}>{restaurant.openTime} – {restaurant.closeTime}</div>
                      </div>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>👥</span>
                      <div>
                        <div className={styles.infoLabel}>Sức chứa</div>
                        <div className={styles.infoValue}>
                          <span className={styles.seatAvailable}>{restaurant.availableSeats}</span>
                          <span className={styles.seatSep}> / </span>
                          <span>{restaurant.totalSeats} ghế</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>💰</span>
                      <div>
                        <div className={styles.infoLabel}>Khoảng giá</div>
                        <div className={styles.infoValue}>{restaurant.priceRange || 'Chưa cập nhật'}</div>
                      </div>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoIcon}>⭐</span>
                      <div>
                        <div className={styles.infoLabel}>Đánh giá</div>
                        <div className={styles.infoValue}>{restaurant.rating.toFixed(1)} ({restaurant.reviewCount} đánh giá)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className={styles.menuSection}>
              <div className={styles.menuHeader}>
                <h3>Thực đơn ({menuItems.length})</h3>
                <button className={styles.addMenuBtn} onClick={() => { setEditingMenuItem(null); setMenuForm(emptyMenuItem); setShowMenuModal(true); }}>
                  + Thêm món ăn
                </button>
              </div>
              <div className={styles.menuGrid}>
                {menuItems.map(item => (
                  <div key={item.id} className={styles.menuCard}>
                    <img src={item.imageUrl || '/default-food.jpg'} alt={item.name} className={styles.menuCardImage} />
                    <div className={styles.menuCardBody}>
                      <div className={styles.menuCardTop}>
                        <strong>{item.name}</strong>
                        <span className={styles.menuPrice}>{item.price.toLocaleString()}đ</span>
                      </div>
                      <p className={styles.menuCardDesc}>{item.description}</p>
                      <div className={styles.menuCardActions}>
                        <button className={styles.menuEditBtn} onClick={() => { setEditingMenuItem(item); setMenuForm(item); setShowMenuModal(true); }}>Sửa</button>
                        <button className={styles.menuDeleteBtn} onClick={() => setDeleteMenuConfirm(item.id)}>Xoá</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className={styles.statsSection}>
              {/* Summary cards */}
              <div className={styles.statsSummaryGrid}>
                <div className={styles.summaryCard}><div className={styles.summaryIcon}>📋</div><div><div className={styles.summaryValue}>{stats.totalBookings}</div><div className={styles.summaryLabel}>Tổng đơn</div></div></div>
                <div className={styles.summaryCard}><div className={styles.summaryIcon}>📅</div><div><div className={styles.summaryValue}>{stats.todayBookings}</div><div className={styles.summaryLabel}>Hôm nay</div></div></div>
                <div className={styles.summaryCard}><div className={styles.summaryIcon}>⏳</div><div><div className={styles.summaryValue}>{stats.pendingBookings}</div><div className={styles.summaryLabel}>Chờ xác nhận</div></div></div>
                <div className={styles.summaryCard}><div className={styles.summaryIcon}>⭐</div><div><div className={styles.summaryValue}>{stats.avgRating.toFixed(1)}</div><div className={styles.summaryLabel}>Đánh giá TB</div></div></div>
              </div>

              {chartsLoading ? (
                <div className={styles.chartsLoading}>⏳ Đang tải dữ liệu thống kê...</div>
              ) : (
                <div className={styles.chartsGrid}>
                  {/* Chart 1: Monthly Bookings */}
                  <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.chartHeader}>
                      <div>
                        <h3>📊 Số đơn đặt bàn theo tháng</h3>
                        <p className={styles.chartSubtitle}>Năm {monthlyData?.year || chartYear} — Tổng: <strong>{monthlyData?.totalYear ?? 0} đơn</strong></p>
                      </div>
                      <div className={styles.yearSelector}>
                        <button onClick={() => setChartYear(y => y - 1)} className={styles.yearBtn}>‹</button>
                        <span className={styles.yearLabel}>{chartYear}</span>
                        <button onClick={() => setChartYear(y => y + 1)} className={styles.yearBtn}>›</button>
                      </div>
                    </div>
                    <div className={styles.chartWrap}>
                      <Bar
                        data={{
                          labels: monthlyData?.monthly.map(m => m.label) || [],
                          datasets: [{
                            label: 'Số đơn',
                            data: monthlyData?.monthly.map(m => m.count) || [],
                            backgroundColor: 'rgba(230,81,0,0.7)',
                            borderColor: '#e65100',
                            borderWidth: 2,
                            borderRadius: 6,
                          }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} đơn` } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
                      />
                    </div>
                    <div className={styles.totalYearBadge}>
                      Tổng năm {monthlyData?.year || chartYear}: <strong>{monthlyData?.totalYear ?? 0} đơn đặt bàn</strong>
                    </div>
                  </div>

                  {/* Chart 2: Menu Distribution */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <div>
                        <h3>🍽️ Tỉ lệ danh mục thực đơn</h3>
                        <p className={styles.chartSubtitle}>Tổng: {menuDistData?.totalItems ?? 0} món ăn</p>
                      </div>
                    </div>
                    <div className={styles.chartWrapSmall}>
                      {menuDistData && menuDistData.distribution.length > 0 ? (
                        <Doughnut
                          data={{
                            labels: menuDistData.distribution.map(d => d.category),
                            datasets: [{
                              data: menuDistData.distribution.map(d => d.count),
                              backgroundColor: ['#e65100','#ff9800','#ffc107','#4caf50','#2196f3','#9c27b0','#f44336','#00bcd4'],
                              borderWidth: 2,
                            }]
                          }}
                          options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} món (${menuDistData.distribution[ctx.dataIndex]?.percentage}%)` } } } }}
                        />
                      ) : <div className={styles.noChartData}>Chưa có dữ liệu thực đơn</div>}
                    </div>
                    {menuDistData && menuDistData.distribution.length > 0 && (
                      <div className={styles.legendList}>
                        {menuDistData.distribution.map((d, i) => (
                          <div key={d.category} className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: ['#e65100','#ff9800','#ffc107','#4caf50','#2196f3','#9c27b0','#f44336','#00bcd4'][i] }} />
                            <span>{d.category}: {d.count} món ({d.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chart 3: Booking Status */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <div>
                        <h3>📈 Tỉ lệ trạng thái đặt bàn</h3>
                        <p className={styles.chartSubtitle}>Tổng: {statusData?.totalBookings ?? 0} đơn</p>
                      </div>
                    </div>
                    <div className={styles.chartWrapSmall}>
                      {statusData && statusData.distribution.length > 0 ? (
                        <Doughnut
                          data={{
                            labels: statusData.distribution.map(d => d.status),
                            datasets: [{
                              data: statusData.distribution.map(d => d.count),
                              backgroundColor: ['#ff9800','#4caf50','#2196f3','#f44336'],
                              borderWidth: 2,
                            }]
                          }}
                          options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} đơn (${statusData.distribution[ctx.dataIndex]?.percentage}%)` } } } }}
                        />
                      ) : <div className={styles.noChartData}>Chưa có dữ liệu đặt bàn</div>}
                    </div>
                    {statusData && statusData.distribution.length > 0 && (
                      <div className={styles.legendList}>
                        {statusData.distribution.map((d, i) => (
                          <div key={d.status} className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: ['#ff9800','#4caf50','#2196f3','#f44336'][i] }} />
                            <span>{d.status}: {d.count} đơn ({d.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div className={styles.feesSection}>
              <div className={styles.feeNotice}>
                <h4>💡 Chính sách thu phí dịch vụ đặt bàn</h4>
                <p>
                  TableNow áp dụng mức phí dịch vụ là <strong>6.000đ cho mỗi đơn đặt bàn hoàn thành thành công</strong>.
                  Phí dịch vụ này <strong>chỉ được tính</strong> sau khi nhà hàng xác nhận khách đã đến dùng bữa thực tế (nhấp vào nút "Xong" trong tab Đơn đặt bàn để chuyển sang trạng thái "Hoàn thành"). Các đơn đang chờ, đã xác nhận nhưng chưa dùng bữa, hoặc đã hủy sẽ hoàn toàn không bị tính phí.
                </p>
              </div>

              {feeStats ? (
                <>
                  <div className={styles.statsSummaryGrid}>
                    <div className={styles.summaryCard} style={{ borderLeft: '4px solid #4caf50' }}>
                      <div className={styles.summaryIcon}>✅</div>
                      <div>
                        <div className={styles.summaryValue}>{feeStats.completedBookings}</div>
                        <div className={styles.summaryLabel}>Đơn đã hoàn thành</div>
                      </div>
                    </div>
                    <div className={styles.summaryCard} style={{ borderLeft: '4px solid #ff9800' }}>
                      <div className={styles.summaryIcon}>💸</div>
                      <div>
                        <div className={styles.summaryValue} style={{ color: '#e65100' }}>
                          {(feeStats.unpaidAmount).toLocaleString()}đ
                        </div>
                        <div className={styles.summaryLabel}>Phí cần thanh toán ({feeStats.unpaidBookingsCount} đơn)</div>
                      </div>
                    </div>
                    <div className={styles.summaryCard} style={{ borderLeft: '4px solid #2196f3' }}>
                      <div className={styles.summaryIcon}>💳</div>
                      <div>
                        <div className={styles.summaryValue} style={{ color: '#2196f3' }}>
                          {(feeStats.paidAmount).toLocaleString()}đ
                        </div>
                        <div className={styles.summaryLabel}>Phí đã thanh toán ({feeStats.paidBookingsCount} đơn)</div>
                      </div>
                    </div>
                    <div className={styles.summaryCard} style={{ borderLeft: '4px solid #9c27b0' }}>
                      <div className={styles.summaryIcon}>📊</div>
                      <div>
                        <div className={styles.summaryValue}>
                          {(feeStats.totalAmount).toLocaleString()}đ
                        </div>
                        <div className={styles.summaryLabel}>Tổng tích lũy</div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.paymentCard}>
                    <h3>💳 Cổng thanh toán phí dịch vụ tự động SePay</h3>
                    
                    {activePayment ? (
                      <div className={styles.paymentDetails}>
                        <p style={{ marginBottom: '20px', fontSize: '15px' }}>
                          Giao dịch thanh toán phí dịch vụ đặt bàn <strong>#{activePayment.paymentId}</strong> đã được khởi tạo. 
                          Vui lòng bấm nút dưới đây để được chuyển hướng an toàn qua Cổng SePay Checkout hoàn tất giao dịch.
                        </p>

                        <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                          {checkoutData ? (
                            <form action={checkoutData.checkoutUrl} method="POST" target="_blank" style={{ textAlign: 'center', padding: '16px 0' }}>
                              <strong style={{ fontSize: '18px', color: '#1a1a2e', display: 'block', marginBottom: '8px' }}>Chuyển hướng qua Cổng thanh toán bảo mật SePay</strong>
                              <p style={{ color: '#666', fontSize: '13px', margin: '0 auto 24px auto', maxWidth: '500px', lineHeight: 1.5 }}>
                                Hệ thống sẽ mở một trang thanh toán hosted bảo mật của SePay. Bạn có thể thanh toán thuận tiện qua thẻ ATM, chuyển khoản VietQR Napas, hoặc ví điện tử.
                              </p>
                              
                              <div style={{ maxWidth: '360px', margin: '0 auto 24px auto', fontSize: '14px', color: '#555', background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px solid #e9ecef', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span>Mã đơn hàng:</span>
                                  <strong>TNPAY{activePayment.paymentId}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Số tiền cần nộp:</span>
                                  <strong style={{ color: '#e65100', fontWeight: 800 }}>{activePayment.amount.toLocaleString()}đ</strong>
                                </div>
                              </div>
                              
                              {Object.keys(checkoutData.fields).map(field => (
                                <input key={field} type="hidden" name={field} value={checkoutData.fields[field]} />
                              ))}
                              
                              <button 
                                type="submit" 
                                className={styles.payBtn}
                                style={{ padding: '16px 40px', fontSize: '16px', background: 'linear-gradient(135deg, #0077b6, #0096c7)', boxShadow: '0 4px 15px rgba(0,119,182,0.25)' }}
                              >
                                ⚡ Đi tới Cổng SePay Checkout ngay
                              </button>
                            </form>
                          ) : (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>
                              ⏳ Đang kết nối và thiết lập chữ ký bảo mật giao dịch SePay...
                            </div>
                          )}
                        </div>

                        <div className={styles.pollingStatusBox}>
                          <span className={styles.pulseDot}></span>
                          <span>🔄 Hệ thống đang chờ giao dịch chuyển khoản tự động... Trạng thái sẽ được cập nhật ngay lập tức khi nhận được tiền.</span>
                        </div>

                        <div className={styles.paymentActionRow} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <button 
                            className={styles.simBtn}
                            onClick={handleSimulateWebhook}
                            disabled={paymentLoading}
                          >
                            {paymentLoading ? 'Đang gửi...' : '⚡ Giả lập chuyển khoản thành công (Test Webhook)'}
                          </button>
                          
                          <button 
                            className={styles.cancelPayBtn}
                            onClick={() => {
                              setActivePayment(null);
                              setCheckoutData(null);
                            }}
                            disabled={paymentLoading}
                          >
                            Quay lại / Huỷ giao dịch
                          </button>
                        </div>
                      </div>
                    ) : feeStats.unpaidAmount > 0 ? (
                      <div className={styles.paymentDetails}>
                        <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
                          Bạn có <strong>{(feeStats.unpaidAmount).toLocaleString()}đ</strong> phí dịch vụ đặt bàn chưa thanh toán (tổng cộng <strong>{feeStats.unpaidBookingsCount} đơn</strong> đã hoàn thành).
                          Vui lòng nhấn nút dưới đây để khởi tạo mã chuyển khoản tự động và hoàn tất nghĩa vụ phí.
                        </p>
                        
                        <div className={styles.paymentActionRow}>
                          <button 
                            className={styles.payBtn}
                            onClick={handleCreatePayment}
                            disabled={paymentLoading}
                            style={{ padding: '16px 36px', fontSize: '16px' }}
                          >
                            {paymentLoading ? 'Đang khởi tạo...' : '⚡ Khởi tạo mã chuyển khoản SePay'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.paymentSuccessState}>
                        <span className={styles.successIcon}>🎉</span>
                        <strong>Tuyệt vời! Bạn đã thanh toán đầy đủ phí dịch vụ.</strong>
                        <p>Không có bất cứ khoản phí chưa thanh toán nào tại thời điểm này. Cảm ơn bạn đã luôn đồng hành và hợp tác cùng TableNow!</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.chartsLoading}>⏳ Đang tải thông tin phí...</div>
              )}
            </div>
          )}
        </main>

      {/* Note viewing modal */}
      {viewingNote && (
        <div className={styles.modalOverlay} onClick={() => setViewingNote(null)}>
          <div className={`${styles.modal} ${styles.modalSmall}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📝 Ghi chú của {viewingNote.contactName}</h2>
              <button className={styles.modalClose} onClick={() => setViewingNote(null)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{viewingNote.note}</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelEditBtn} onClick={() => setViewingNote(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Món ăn */}
      {showMenuModal && (
        <div className={styles.modalOverlay} onClick={() => setShowMenuModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingMenuItem ? 'Sửa món ăn' : 'Thêm món ăn'}</h2>
              <button className={styles.modalClose} onClick={() => setShowMenuModal(false)}>&times;</button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.editFormGrid}>
                <div className={styles.editFormGroup}>
                  <label>Tên món *</label>
                  <input type="text" placeholder="Nhập tên món ăn" value={menuForm.name} onChange={e => setMenuForm({...menuForm, name: e.target.value})} />
                </div>
                <div className={styles.editFormGroup}>
                  <label>Giá (VNĐ) *</label>
                  <input type="number" placeholder="Nhập giá" value={menuForm.price} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} />
                </div>
                <div className={styles.editFormGroup}>
                  <label>Danh mục</label>
                  <input type="text" placeholder="VD: Món chính, Đồ uống..." value={menuForm.category} onChange={e => setMenuForm({...menuForm, category: e.target.value})} />
                </div>
                <div className={styles.editFormGroup}>
                  <label>Trạng thái</label>
                  <select value={menuForm.available ? 'true' : 'false'} onChange={e => setMenuForm({...menuForm, available: e.target.value === 'true'})}>
                    <option value="true">Có sẵn</option>
                    <option value="false">Hết hàng</option>
                  </select>
                </div>
                <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                  <label>Mô tả</label>
                  <textarea placeholder="Mô tả món ăn..." value={menuForm.description} onChange={e => setMenuForm({...menuForm, description: e.target.value})} />
                </div>
                <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                  <label>Hình ảnh món ăn</label>
                  <ImageUpload 
                    images={menuForm.imageUrl ? [menuForm.imageUrl] : []} 
                    onImagesChange={(urls) => setMenuForm({ ...menuForm, imageUrl: urls.length > 0 ? urls[0] : '' })} 
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelEditBtn} onClick={() => setShowMenuModal(false)}>Huỷ</button>
              <button className={styles.saveBtnPrimary} onClick={saveMenuItem}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Xác nhận xoá món ăn */}
      {deleteMenuConfirm && (
        <div className={styles.modalOverlay} onClick={() => setDeleteMenuConfirm(null)}>
          <div className={`${styles.modal} ${styles.modalSmall}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Xác nhận xoá</h2>
              <button className={styles.modalClose} onClick={() => setDeleteMenuConfirm(null)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p>Bạn có chắc chắn muốn xoá món ăn này khỏi thực đơn không?</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelEditBtn} onClick={() => setDeleteMenuConfirm(null)}>Huỷ</button>
              <button className={styles.deleteBtnDanger} onClick={() => handleDeleteMenuItem(deleteMenuConfirm)}>Xoá ngay</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thông tin tài khoản */}
      {showProfileModal && (
        <div className={styles.profileModalOverlay} onClick={() => setShowProfileModal(false)}>
          <div className={styles.profileModalBox} onClick={e => e.stopPropagation()}>
            <button className={styles.profileModalClose} onClick={() => setShowProfileModal(false)}>&times;</button>

            <div className={styles.profileModalHeader}>
              <div className={styles.profileAvatarLg}>
                {authUser?.avatar
                  ? <img src={authUser.avatar} alt="Avatar" />
                  : (authUser?.name || 'M').charAt(0).toUpperCase()
                }
              </div>
              <div>
                <h2 className={styles.profileModalName}>{authUser?.name}</h2>
                <p className={styles.profileModalEmail}>{authUser?.email}</p>
                <span className={styles.profileRoleBadge}>Quản lý nhà hàng</span>
              </div>
            </div>

            <form className={styles.profileForm} onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
              <div className={styles.profileFormGroup}>
                <label>Họ và tên</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required />
              </div>
              <div className={styles.profileFormGroup}>
                <label>Số điện thoại</label>
                <input type="text" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
              </div>
              <div className={styles.profileFormGroup}>
                <label>Mật khẩu mới (Bỏ trống nếu không đổi)</label>
                <input type="password" value={profileForm.password} onChange={e => setProfileForm({...profileForm, password: e.target.value})} placeholder="••••••••" />
              </div>
              {profileForm.password && (
                <div className={styles.profileFormGroup}>
                  <label>Xác nhận mật khẩu</label>
                  <input type="password" value={profileForm.confirmPassword} onChange={e => setProfileForm({...profileForm, confirmPassword: e.target.value})} placeholder="••••••••" />
                </div>
              )}
              <button type="submit" className={styles.profileSubmitBtn}>Lưu thay đổi</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
