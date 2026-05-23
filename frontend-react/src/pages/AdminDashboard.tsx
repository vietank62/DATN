import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { fetchRestaurants, fetchBookings, fetchAllUsers, fetchAdminStats, createRestaurant, updateRestaurant as apiUpdateRestaurant, deleteRestaurant as apiDeleteRestaurant, registerUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from '../services/api';
import type { Restaurant, Booking, User, AdminStats, UserRole } from '../types';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import styles from './AdminDashboard.module.css';


const emptyRestaurant: Omit<Restaurant, 'id'> = {
  name: '', address: '', district: '', cuisine: [], priceRange: '',
  rating: 0, reviewCount: 0, imageUrl: [], description: '',
  openTime: '10:00', closeTime: '22:00', phone: '', featured: false, menu: [],
  totalSeats: 0, availableSeats: 0, managerID: 0,
};

const emptyUser: Omit<User, 'id'> = {
  name: '', email: '', phone: '', role: 'customer', avatar: '', password: '',
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, logout, cuisines } = useAuth();  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats>({ totalRestaurants: 0, totalUsers: 0, totalBookings: 0, totalRevenue: 0, activeRestaurants: 0, newUsersThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'restaurants' | 'users' | 'bookings'>('overview');

  // Modal states
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurant);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState(emptyUser);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'restaurant' | 'user'; id: string } | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const [rData, bData, uData, sData] = await Promise.all([
          fetchRestaurants(),
          fetchBookings(),
          fetchAllUsers(),
          fetchAdminStats(),
        ]);
        setRestaurants(rData);
        setBookings(bData);
        setUsers(uData);
        setStats(sData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
  const formatNumber = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

  const getRoleLabel = (role: User['role']) => {
    const map: Record<User['role'], { label: string; className: string }> = {
      customer: { label: 'Khách hàng', className: styles.roleCustomer },
      manager: { label: 'Quản lý', className: styles.roleManager },
      admin: { label: 'Admin', className: styles.roleAdmin },
    };
    return map[role];
  };

  const getStatusInfo = (status: Booking['status']) => {
    const map: Record<Booking['status'], { label: string; className: string }> = {
      pending: { label: 'Chờ xác nhận', className: styles.statusPending },
      confirmed: { label: 'Đã xác nhận', className: styles.statusConfirmed },
      completed: { label: 'Hoàn thành', className: styles.statusCompleted },
      cancelled: { label: 'Đã huỷ', className: styles.statusCancelled },
    };
    return map[status];
  };

  // ===== Restaurant CRUD =====
  const openAddRestaurant = () => {
    setEditingRestaurant(null);
    setRestaurantForm(emptyRestaurant);
    setShowRestaurantModal(true);
  };

  const openEditRestaurant = (r: Restaurant) => {
    setEditingRestaurant(r);
    setRestaurantForm({ ...r });
    setShowRestaurantModal(true);
  };

  const saveRestaurant = async () => {
    if (!restaurantForm.name.trim()) {
      toast.error('Vui lòng nhập tên nhà hàng');
      return;
    }
    
    const loadingToast = toast.loading(editingRestaurant ? 'Đang cập nhật...' : 'Đang thêm nhà hàng...');
    try {
      if (editingRestaurant) {
        const updated = await apiUpdateRestaurant(editingRestaurant.id, restaurantForm);
        setRestaurants((prev) => prev.map((r) => r.id === editingRestaurant.id ? updated : r));
        toast.success('Cập nhật nhà hàng thành công!', { id: loadingToast });
      } else {
        // For new restaurant, we need to assign a manager. For now, use current admin or first manager.
        const created = await createRestaurant({ 
          ...restaurantForm as Restaurant, 
          availableSeats: restaurantForm.totalSeats,
          managerID: restaurantForm.managerID || (authUser ? Number(authUser.id) : 1) 
        });
        setRestaurants((prev) => [...prev, created]);
        toast.success('Thêm nhà hàng mới thành công!', { id: loadingToast });
      }
      setShowRestaurantModal(false);
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message || 'Thao tác thất bại'}`, { id: loadingToast });
      console.error(err);
    }
  };

  const deleteRestaurant = async (id: string) => {
    const loadingToast = toast.loading('Đang xoá nhà hàng...');
    try {
      await apiDeleteRestaurant(id);
      setRestaurants((prev) => prev.filter((r) => r.id !== id));
      setShowDeleteConfirm(null);
      toast.success('Xoá nhà hàng thành công!', { id: loadingToast });
    } catch (err: any) {
      toast.error(`Lỗi khi xoá: ${err.message || 'Thao tác thất bại'}`, { id: loadingToast });
    }
  };

  const toggleCuisine = (cuisineId: string) => {
    setRestaurantForm((prev) => ({
      ...prev,
      cuisine: prev.cuisine?.includes(cuisineId)
        ? prev.cuisine.filter((c) => c !== cuisineId)
        : [...(prev.cuisine || []), cuisineId],
    }));
  };
  const openAddUser = () => {
    setEditingUser(null);
    setUserForm(emptyUser);
    setShowUserModal(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatar, password: '' });
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast.error('Vui lòng nhập tên và email');
      return;
    }

    const loadingToast = toast.loading(editingUser ? 'Đang cập nhật...' : 'Đang thêm người dùng...');
    try {
      if (editingUser) {
        const payload: any = { ...userForm };
        if (!payload.password) {
          delete payload.password;
        }
        const updated = await apiUpdateUser(editingUser.email, payload);
        setUsers((prev) => prev.map((u) => u.id === editingUser.id ? updated : u));
        toast.success('Cập nhật người dùng thành công!', { id: loadingToast });
      } else {
        const created = await registerUser({ ...userForm as any, password: userForm.password || 'User@123' });
        setUsers((prev) => [...prev, created]);
        toast.success('Thêm người dùng mới thành công!', { id: loadingToast, duration: 5000 });
      }
      setShowUserModal(false);
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message || 'Thao tác thất bại'}`, { id: loadingToast });
    }
  };

  const deleteUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const loadingToast = toast.loading('Đang xoá người dùng...');
    try {
      await apiDeleteUser(user.email);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setShowDeleteConfirm(null);
      toast.success('Xoá người dùng thành công!', { id: loadingToast });
    } catch (err: any) {
      toast.error(`Lỗi khi xoá: ${err.message || 'Thao tác thất bại'}`, { id: loadingToast });
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>TableNow</h2>
          <p>Super Admin</p>
        </div>
        <nav className={styles.sidebarNav}>
          <button className={`${styles.navItem} ${activeTab === 'overview' ? styles.navActive : ''}`} onClick={() => setActiveTab('overview')}>
            Tổng quan
          </button>
          <button className={`${styles.navItem} ${activeTab === 'restaurants' ? styles.navActive : ''}`} onClick={() => setActiveTab('restaurants')}>
            Nhà hàng
          </button>
          <button className={`${styles.navItem} ${activeTab === 'users' ? styles.navActive : ''}`} onClick={() => setActiveTab('users')}>
            Người dùng
          </button>
          <button className={`${styles.navItem} ${activeTab === 'bookings' ? styles.navActive : ''}`} onClick={() => setActiveTab('bookings')}>
            Đặt bàn
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <header className={styles.topBar}>
          <h1>
            {activeTab === 'overview' && 'Tổng quan hệ thống'}
            {activeTab === 'restaurants' && 'Quản lý nhà hàng'}
            {activeTab === 'users' && 'Quản lý người dùng'}
            {activeTab === 'bookings' && 'Quản lý đặt bàn'}
          </h1>
          <div className={styles.topBarRight}>
            <div className={styles.userInfo}>
              <span className={styles.userAvatar}>{(authUser?.name || 'A')[0].toUpperCase()}</span>
              <span>{authUser?.name || 'Admin'}</span>
            </div>
            <button className={styles.logoutBtnTop} onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.statOrange}`}>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{formatNumber(stats.totalRestaurants)}</span>
              <span className={styles.statLabel}>Nhà hàng</span>
            </div>
            <span className={styles.statIcon}>🏪</span>
          </div>
          <div className={`${styles.statCard} ${styles.statBlue}`}>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{formatNumber(stats.totalUsers)}</span>
              <span className={styles.statLabel}>Người dùng</span>
            </div>
            <span className={styles.statIcon}>👥</span>
          </div>
          <div className={`${styles.statCard} ${styles.statGreen}`}>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{formatNumber(stats.totalBookings)}</span>
              <span className={styles.statLabel}>Lượt đặt bàn</span>
            </div>
            <span className={styles.statIcon}>📋</span>
          </div>
          <div className={`${styles.statCard} ${styles.statPurple}`}>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{formatCurrency(stats.totalRevenue)}</span>
              <span className={styles.statLabel}>Doanh thu</span>
            </div>
            <span className={styles.statIcon}>💰</span>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Đang tải dữ liệu...</div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className={styles.overviewGrid}>
                <div className={styles.overviewCard}>
                  <h3>Thống kê nhanh</h3>
                  <div className={styles.quickStats}>
                    <div className={styles.quickStatItem}>
                      <span className={styles.quickStatLabel}>NH đang hoạt động</span>
                      <span className={styles.quickStatValue}>{formatNumber(stats.activeRestaurants)}</span>
                    </div>
                    <div className={styles.quickStatItem}>
                      <span className={styles.quickStatLabel}>Người dùng mới (tháng)</span>
                      <span className={styles.quickStatValue}>{formatNumber(stats.newUsersThisMonth)}</span>
                    </div>
                    <div className={styles.quickStatItem}>
                      <span className={styles.quickStatLabel}>Tỷ lệ NH hoạt động</span>
                      <span className={styles.quickStatValue}>
                        {((stats.activeRestaurants / stats.totalRestaurants) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.overviewCard}>
                  <h3>Đặt bàn gần đây</h3>
                  <div className={styles.recentList}>
                    {bookings.slice(0, 5).map((b) => (
                      <div key={b.id} className={styles.recentItem}>
                        <div>
                          <strong>{b.contactInfo.name}</strong>
                          <small>{b.restaurantName}</small>
                        </div>
                        <span className={`${styles.miniStatus} ${getStatusInfo(b.status).className}`}>
                          {getStatusInfo(b.status).label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Restaurants Tab */}
            {activeTab === 'restaurants' && (
              <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                  <h3>Danh sách nhà hàng ({restaurants.length})</h3>
                  <button className={styles.addBtn} onClick={openAddRestaurant}>+ Thêm nhà hàng</button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nhà hàng</th>
                      <th>Khu vực</th>
                      <th>Loại</th>
                      <th>Đánh giá</th>
                      <th>Giá</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map((r) => (
                      <tr key={r.id}>
                        <td>                          <div className={styles.restaurantCell}>
                            <img src={Array.isArray(r.imageUrl) && r.imageUrl.length > 0 ? r.imageUrl[0] : '/default-restaurant.jpg'} alt={r.name} className={styles.tableThumbnail} />
                            <div>
                              <strong>{r.name}</strong>
                              <small>{r.address}</small>
                            </div>
                          </div>
                        </td>
                          <td>{r.district}</td>
                          <td>{r.cuisine}</td>
                          <td>⭐ {r.rating} ({r.reviewCount})</td>
                          <td>{r.priceRange}</td>
                          <td><span className={styles.activeStatus}>Hoạt động</span></td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button className={styles.editBtn} onClick={() => openEditRestaurant(r)}>Sửa</button>
                              <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm({ type: 'restaurant', id: r.id })}>Xoá</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                  <h3>Danh sách người dùng ({users.length})</h3>
                  <button className={styles.addBtn} onClick={openAddUser}>+ Thêm người dùng</button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Điện thoại</th>
                      <th>Mật khẩu</th>
                      <th>Vai trò</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const roleInfo = getRoleLabel(u.role);
                      return (
                        <tr key={u.id}>
                          <td className={styles.userId}>{u.id}</td>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td>{u.phone}</td>
                          <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.password?.startsWith('$argon') ? '*** Đã mã hóa ***' : u.password}
                          </td>
                          <td>
                            <span className={`${styles.roleBadge} ${roleInfo.className}`}>{roleInfo.label}</span>
                          </td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button className={styles.editBtn} onClick={() => openEditUser(u)}>Sửa</button>
                              <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm({ type: 'user', id: u.id })}>Xoá</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className={styles.tableContainer}>
                <div className={styles.tableHeader}>
                  <h3>Tất cả đặt bàn ({bookings.length})</h3>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Khách hàng</th>
                      <th>Nhà hàng</th>
                      <th>Ngày</th>
                      <th>Giờ</th>
                      <th>Số khách</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => {
                      const statusInfo = getStatusInfo(b.status);
                      return (
                        <tr key={b.id}>
                          <td className={styles.bookingId}>{b.id}</td>
                          <td>
                            <div>
                              <strong>{b.contactInfo.name}</strong>
                              <br />
                              <small>{b.contactInfo.phone}</small>
                            </div>
                          </td>
                          <td>{b.restaurantName}</td>
                          <td>{b.date}</td>
                          <td>{b.time}</td>
                          <td>{b.guestCount}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${statusInfo.className}`}>{statusInfo.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== Restaurant Modal ===== */}
      {showRestaurantModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRestaurantModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingRestaurant ? 'Sửa nhà hàng' : 'Thêm nhà hàng mới'}</h2>
              <button className={styles.modalClose} onClick={() => setShowRestaurantModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Tên nhà hàng *</label>
                  <input type="text" value={restaurantForm.name} onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })} placeholder="Nhập tên nhà hàng" />
                </div>
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label>Loại ẩm thực (Chọn nhiều) *</label>
                  <div className={styles.cuisineGrid}>
                    {cuisines.filter(c => c.id !== 'all').map((cuisine) => (
                      <label key={cuisine.id} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={restaurantForm.cuisine?.includes(cuisine.id)}
                          onChange={() => toggleCuisine(cuisine.id)}
                        />
                        <span>{cuisine.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Địa chỉ</label>
                  <input type="text" value={restaurantForm.address} onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })} placeholder="Số nhà, đường..." />
                </div>
                <div className={styles.formGroup}>
                  <label>Quận / Khu vực</label>
                  <select
                    value={restaurantForm.district}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, district: e.target.value })}
                  >
                    <option value="">-- Chọn quận/huyện --</option>
                    {[
                      'Quận 1','Quận 2','Quận 3','Quận 4','Quận 5','Quận 6','Quận 7',
                      'Quận 8','Quận 9','Quận 10','Quận 11','Quận 12',
                      'Bình Tân','Bình Thạnh','Gò Vấp','Phú Nhuận',
                      'Tân Bình','Tân Phú','Thủ Đức'
                    ].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Quản lý nhà hàng *</label>
                  <select
                    value={restaurantForm.managerID || ''}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, managerID: Number(e.target.value) })}
                    required
                  >
                    <option value="">-- Chọn người quản lý --</option>
                    {users.filter(u => u.role === 'manager' || u.role === 'admin').map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Điện thoại</label>
                  <input type="text" value={restaurantForm.phone} onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })} placeholder="Số điện thoại" />
                </div>
                <div className={styles.formGroup}>
                  <label>Tổng số ghế *</label>
                  <input type="number" value={restaurantForm.totalSeats} onChange={(e) => setRestaurantForm({ ...restaurantForm, totalSeats: Number(e.target.value) })} min="1" required />
                </div>
                <div className={styles.formGroup}>
                  <label>Giờ mở cửa</label>
                  <input type="time" value={restaurantForm.openTime} onChange={(e) => setRestaurantForm({ ...restaurantForm, openTime: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Giờ đóng cửa</label>
                  <input type="time" value={restaurantForm.closeTime} onChange={(e) => setRestaurantForm({ ...restaurantForm, closeTime: e.target.value })} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label>Hình ảnh nhà hàng</label>
                  <ImageUpload
                    images={restaurantForm.imageUrl}
                    onImagesChange={(urls) => setRestaurantForm({ ...restaurantForm, imageUrl: urls })}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                  <label>Mô tả</label>
                  <textarea value={restaurantForm.description} onChange={(e) => setRestaurantForm({ ...restaurantForm, description: e.target.value })} placeholder="Mô tả nhà hàng..." rows={3} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowRestaurantModal(false)}>Huỷ</button>
              <button className={styles.modalSaveBtn} onClick={saveRestaurant}>
                {editingRestaurant ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== User Modal ===== */}
      {showUserModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUserModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}</h2>
              <button className={styles.modalClose} onClick={() => setShowUserModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Họ tên *</label>
                  <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nhập họ tên" />
                </div>
                <div className={styles.formGroup}>
                  <label>Email *</label>
                  <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className={styles.formGroup}>
                  <label>Điện thoại</label>
                  <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="Số điện thoại" />
                </div>
                <div className={styles.formGroup}>
                  <label>Mật khẩu</label>
                  <input type="text" value={userForm.password || ''} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Nhập mật khẩu (nếu đổi/thêm)" />
                </div>
                <div className={styles.formGroup}>
                  <label>Vai trò</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}>
                    <option value="customer">Khách hàng</option>
                    <option value="manager">Quản lý</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowUserModal(false)}>Huỷ</button>
              <button className={styles.modalSaveBtn} onClick={saveUser}>
                {editingUser ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Confirm ===== */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={`${styles.modal} ${styles.modalSmall}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Xác nhận xoá</h2>
              <button className={styles.modalClose} onClick={() => setShowDeleteConfirm(null)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p>Bạn có chắc chắn muốn xoá {showDeleteConfirm.type === 'restaurant' ? 'nhà hàng' : 'người dùng'} này? Hành động không thể hoàn tác.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowDeleteConfirm(null)}>Huỷ</button>
              <button
                className={styles.modalDeleteBtn}
                onClick={() => {
                  if (showDeleteConfirm.type === 'restaurant') deleteRestaurant(showDeleteConfirm.id);
                  else deleteUser(showDeleteConfirm.id);
                }}
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
