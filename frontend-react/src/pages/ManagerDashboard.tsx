import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './ManagerDashboard.module.css';
import { fetchBookings, fetchRestaurants, fetchManagerStats, updateBookingStatus, updateRestaurant as apiUpdateRestaurant, fetchMenuItems, createMenuItem as apiCreateMenuItem, updateMenuItem as apiUpdateMenuItem, deleteMenuItem as apiDeleteMenuItem } from '../services/api';
import type { Booking, ManagerStats, Restaurant, MenuItem } from '../types';
import SeatStatusBadge from '../components/SeatStatusBadge/SeatStatusBadge';
import ManagerBookingAction from '../components/ManagerBookingAction/ManagerBookingAction';

const emptyMenuItem: Omit<MenuItem, 'id'> = {
  name: '', description: '', price: 0, imageUrl: '', category: '',
};

const defaultRestaurant: Restaurant = {
  id: '', name: '', address: '', district: '', cuisine: '', priceRange: '',
  rating: 0, reviewCount: 0, imageUrl: '', description: '',
  openTime: '', closeTime: '', phone: '', featured: false,
  totalSeats: 0, availableSeats: 0,
};

const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<ManagerStats>({ totalBookings: 0, todayBookings: 0, totalRevenue: 0, avgRating: 0, pendingBookings: 0, confirmedBookings: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'restaurant' | 'menu' | 'stats'>('bookings');

  // Restaurant state (editable) — non-null, starts with default
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

  useEffect(() => {
    const load = async () => {
      try {        const allRestaurants = await fetchRestaurants();
        // Find the restaurant managed by the current user
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
      } finally {
        setLoading(false);
      }    };
    load();
  }, [authUser]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const handleStatusChange = (bookingId: string, newStatus: Booking['status']) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );
  };
  const handleConfirmBooking = (bookingId: string, assignedSeats: number) => {
    updateBookingStatus(bookingId, 'confirmed').then(() => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: 'confirmed' as const, assignedSeats } : b
        )
      );
      setRestaurant((prev) => ({
        ...prev,
        availableSeats: Math.max(0, prev.availableSeats - assignedSeats),
      }));
    });
  };

  const handleCancelBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    updateBookingStatus(bookingId, 'cancelled').then(() => {
      handleStatusChange(bookingId, 'cancelled');
      if (booking?.status === 'confirmed' && booking.assignedSeats) {
        setRestaurant((prev) => ({
          ...prev,
          availableSeats: Math.min(prev.totalSeats, prev.availableSeats + booking.assignedSeats!),
        }));
      }
    });
  };

  const handleCompleteBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    updateBookingStatus(bookingId, 'completed').then(() => {
      handleStatusChange(bookingId, 'completed');
      if (booking?.assignedSeats) {
        setRestaurant((prev) => ({
          ...prev,
          availableSeats: Math.min(prev.totalSeats, prev.availableSeats + booking.assignedSeats!),
        }));
      }
    });
  };

  const getStatusLabel = (status: Booking['status']) => {
    const map: Record<Booking['status'], { label: string; className: string }> = {
      pending: { label: 'Chờ xác nhận', className: styles.statusPending },
      confirmed: { label: 'Đã xác nhận', className: styles.statusConfirmed },
      completed: { label: 'Hoàn thành', className: styles.statusCompleted },
      cancelled: { label: 'Đã huỷ', className: styles.statusCancelled },
    };
    return map[status];
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  // Restaurant edit handlers
  const startEdit = () => {
    setEditForm({ ...restaurant });
    setEditMode(true);
    setSaveMsg('');
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveMsg('');
  };
  const saveEdit = async () => {
    try {
      const updated = await apiUpdateRestaurant(restaurant.id, editForm);
      setRestaurant(updated);
      setEditMode(false);
      setSaveMsg('Đã lưu thay đổi thành công!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMsg('Lỗi khi lưu thay đổi!');
    }
  };

  // Menu CRUD
  const openAddMenu = () => {
    setEditingMenuItem(null);
    setMenuForm(emptyMenuItem);
    setShowMenuModal(true);
  };

  const openEditMenu = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuForm({ name: item.name, description: item.description, price: item.price, imageUrl: item.imageUrl, category: item.category });
    setShowMenuModal(true);
  };
  const saveMenuItem = async () => {
    if (!menuForm.name.trim()) return;
    try {
      if (editingMenuItem) {
        const updated = await apiUpdateMenuItem(editingMenuItem.id, menuForm);
        setMenuItems((prev) => prev.map((m) => m.id === editingMenuItem.id ? updated : m));
      } else {
        const created = await apiCreateMenuItem({ ...menuForm, restaurantId: restaurant.id });
        setMenuItems((prev) => [...prev, created]);
      }
      setShowMenuModal(false);
    } catch (err) {
      console.error('Menu save error:', err);
    }
  };

  const deleteMenuItem = async (id: string) => {
    try {
      await apiDeleteMenuItem(id);
      setMenuItems((prev) => prev.filter((m) => m.id !== id));
      setDeleteMenuConfirm(null);
    } catch (err) {
      console.error('Menu delete error:', err);
    }
  };

  // Group menu by category
  const menuByCategory = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className={styles.dashboard}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>TableNow</h2>
          <p>Quản lý nhà hàng</p>
        </div>
        <nav className={styles.sidebarNav}>
          <button className={`${styles.navItem} ${activeTab === 'bookings' ? styles.navActive : ''}`} onClick={() => setActiveTab('bookings')}>
            Đặt bàn
          </button>
          <button className={`${styles.navItem} ${activeTab === 'restaurant' ? styles.navActive : ''}`} onClick={() => setActiveTab('restaurant')}>
            Nhà hàng
          </button>
          <button className={`${styles.navItem} ${activeTab === 'menu' ? styles.navActive : ''}`} onClick={() => setActiveTab('menu')}>
            Thực đơn
          </button>
          <button className={`${styles.navItem} ${activeTab === 'stats' ? styles.navActive : ''}`} onClick={() => setActiveTab('stats')}>
            Thống kê
          </button>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Đăng xuất
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <header className={styles.topBar}>
          <h1>
            {activeTab === 'bookings' && 'Quản lý đặt bàn'}
            {activeTab === 'restaurant' && 'Thông tin nhà hàng'}
            {activeTab === 'menu' && 'Quản lý thực đơn'}
            {activeTab === 'stats' && 'Thống kê'}
          </h1>
          <div className={styles.userInfo}>
            <span>{authUser?.name || 'Manager'}</span>
          </div>
        </header>        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📋</span>
            <div>
              <span className={styles.statValue}>{stats.totalBookings}</span>
              <span className={styles.statLabel}>Tổng đặt bàn</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📅</span>
            <div>
              <span className={styles.statValue}>{stats.todayBookings}</span>
              <span className={styles.statLabel}>Hôm nay</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💰</span>
            <div>
              <span className={styles.statValue}>{formatCurrency(stats.totalRevenue)}</span>
              <span className={styles.statLabel}>Doanh thu</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🪑</span>
            <div>
              <span className={styles.statValue}>{restaurant.availableSeats}/{restaurant.totalSeats}</span>
              <span className={styles.statLabel}>Chỗ trống</span>
            </div>
          </div>
        </div>

        {/* ===== Bookings Tab ===== */}
        {activeTab === 'bookings' && (
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <h3>Danh sách đặt bàn</h3>
              <div className={styles.tableFilters}>
                <span className={styles.badge}>
                  {bookings.filter((b) => b.status === 'pending').length} chờ xác nhận
                </span>
              </div>
            </div>
            {loading ? (
              <div className={styles.loadingState}>Đang tải...</div>
            ) : bookings.length === 0 ? (
              <div className={styles.emptyState}>Chưa có đặt bàn nào</div>
            ) : (              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Khách hàng</th>
                    <th>Ngày</th>
                    <th>Giờ</th>
                    <th>Số khách</th>
                    <th>Chỗ ngồi</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => {
                    const statusInfo = getStatusLabel(booking.status);
                    return (
                      <tr key={booking.id}>
                        <td className={styles.bookingId}>{booking.id}</td>
                        <td>
                          <div className={styles.customerInfo}>
                            <strong>{booking.contactInfo.name}</strong>
                            <small>{booking.contactInfo.phone}</small>
                          </div>
                        </td>
                        <td>{booking.date}</td>
                        <td>{booking.time}</td>
                        <td>{booking.guestCount} khách</td>
                        <td>
                          <div className={styles.seatCell}>
                            <span className={styles.seatRequested}>Yêu cầu: {booking.requestedSeats}</span>
                            {booking.assignedSeats && (
                              <span className={styles.seatAssigned}>Gán: {booking.assignedSeats}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          <ManagerBookingAction
                            bookingId={booking.id}
                            requestedSeats={booking.requestedSeats}
                            availableSeats={restaurant.availableSeats}
                            currentStatus={booking.status}
                            assignedSeats={booking.assignedSeats}
                            onConfirm={handleConfirmBooking}
                            onCancel={handleCancelBooking}
                            onComplete={handleCompleteBooking}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== Restaurant Tab (Editable) ===== */}
        {activeTab === 'restaurant' && (
          <div className={styles.restaurantInfo}>
            {saveMsg && <div className={styles.saveSuccess}>{saveMsg}</div>}
            <div className={styles.restaurantCard}>
              {editMode ? (
                <>
                  <div className={styles.editImageSection}>
                    <img src={editForm.imageUrl || 'https://via.placeholder.com/800x300'} alt="Preview" className={styles.restaurantImage} />
                    <div className={styles.editImageInput}>
                      <label>URL hình ảnh nhà hàng</label>
                      <input
                        type="url"
                        value={editForm.imageUrl}
                        onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>
                  <div className={styles.restaurantDetails}>
                    <div className={styles.editFormGrid}>
                      <div className={styles.editFormGroup}>
                        <label>Tên nhà hàng</label>
                        <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Loại ẩm thực</label>
                        <input type="text" value={editForm.cuisine} onChange={(e) => setEditForm({ ...editForm, cuisine: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Địa chỉ</label>
                        <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Quận / Khu vực</label>
                        <input type="text" value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Điện thoại</label>
                        <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Khoảng giá</label>
                        <input type="text" value={editForm.priceRange} onChange={(e) => setEditForm({ ...editForm, priceRange: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Giờ mở cửa</label>
                        <input type="time" value={editForm.openTime} onChange={(e) => setEditForm({ ...editForm, openTime: e.target.value })} />
                      </div>                      <div className={styles.editFormGroup}>
                        <label>Giờ đóng cửa</label>
                        <input type="time" value={editForm.closeTime} onChange={(e) => setEditForm({ ...editForm, closeTime: e.target.value })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Tổng số chỗ</label>
                        <input type="number" value={editForm.totalSeats} onChange={(e) => setEditForm({ ...editForm, totalSeats: Number(e.target.value) })} />
                      </div>
                      <div className={styles.editFormGroup}>
                        <label>Chỗ trống hiện tại</label>
                        <input type="number" value={editForm.availableSeats} onChange={(e) => setEditForm({ ...editForm, availableSeats: Number(e.target.value) })} />
                      </div>
                      <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                        <label>Mô tả</label>
                        <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
                      </div>
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.saveBtnPrimary} onClick={saveEdit}>Lưu thay đổi</button>
                      <button className={styles.cancelEditBtn} onClick={cancelEdit}>Huỷ</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <img src={restaurant.imageUrl} alt={restaurant.name} className={styles.restaurantImage} />
                  <div className={styles.restaurantDetails}>
                    <div className={styles.detailTitleRow}>
                      <h3>{restaurant.name}</h3>
                      <button className={styles.editInfoBtn} onClick={startEdit}>Chỉnh sửa</button>
                    </div>
                    <p>{restaurant.description}</p>                    <div className={styles.detailGrid}>
                      <div><strong>Địa chỉ:</strong> {restaurant.address}</div>
                      <div><strong>Điện thoại:</strong> {restaurant.phone}</div>
                      <div><strong>Giờ mở cửa:</strong> {restaurant.openTime} - {restaurant.closeTime}</div>
                      <div><strong>Khoảng giá:</strong> {restaurant.priceRange}</div>
                      <div><strong>Đánh giá:</strong> {restaurant.rating} ({restaurant.reviewCount} đánh giá)</div>
                      <div><strong>Loại:</strong> {restaurant.cuisine}</div>
                    </div>
                    <div className={styles.seatStatusSection}>
                      <SeatStatusBadge
                        availableSeats={restaurant.availableSeats}
                        totalSeats={restaurant.totalSeats}
                        userRole="manager"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ===== Menu Tab ===== */}
        {activeTab === 'menu' && (
          <div className={styles.menuSection}>
            <div className={styles.menuHeader}>
              <h3>Thực đơn ({menuItems.length} món)</h3>
              <button className={styles.addMenuBtn} onClick={openAddMenu}>+ Thêm món</button>
            </div>
            {menuItems.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Chưa có món ăn nào. Nhấn &quot;Thêm món&quot; để bắt đầu.</p>
              </div>
            ) : (
              Object.entries(menuByCategory).map(([category, items]) => (
                <div key={category} className={styles.menuCategory}>
                  <h4 className={styles.menuCategoryTitle}>{category}</h4>
                  <div className={styles.menuGrid}>
                    {items.map((item) => (
                      <div key={item.id} className={styles.menuCard}>
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} className={styles.menuCardImage} />
                        )}
                        <div className={styles.menuCardBody}>
                          <div className={styles.menuCardTop}>
                            <strong>{item.name}</strong>
                            <span className={styles.menuPrice}>{formatCurrency(item.price)}</span>
                          </div>
                          {item.description && <p className={styles.menuCardDesc}>{item.description}</p>}
                          <div className={styles.menuCardActions}>
                            <button className={styles.menuEditBtn} onClick={() => openEditMenu(item)}>Sửa</button>
                            <button className={styles.menuDeleteBtn} onClick={() => setDeleteMenuConfirm(item.id)}>Xoá</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}        {/* ===== Stats Tab ===== */}
        {activeTab === 'stats' && (
          <div className={styles.statsContent}>
            <div className={styles.seatOverviewCard}>
              <h4>Tình trạng chỗ ngồi</h4>
              <SeatStatusBadge
                availableSeats={restaurant.availableSeats}
                totalSeats={restaurant.totalSeats}
                userRole="manager"
              />
            </div>
            <div className={styles.statsDetailGrid}>
              <div className={styles.statsDetailCard}>
                <h4>Đặt bàn chờ xác nhận</h4>
                <span className={styles.bigNumber}>{stats.pendingBookings}</span>
              </div>
              <div className={styles.statsDetailCard}>
                <h4>Đặt bàn đã xác nhận</h4>
                <span className={styles.bigNumber}>{stats.confirmedBookings}</span>
              </div>
              <div className={styles.statsDetailCard}>
                <h4>Tổng đặt bàn tháng này</h4>
                <span className={styles.bigNumber}>{stats.totalBookings}</span>
              </div>
              <div className={styles.statsDetailCard}>
                <h4>Doanh thu tháng</h4>
                <span className={styles.bigNumber}>{formatCurrency(stats.totalRevenue)}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== Menu Item Modal ===== */}
      {showMenuModal && (
        <div className={styles.modalOverlay} onClick={() => setShowMenuModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingMenuItem ? 'Sửa món ăn' : 'Thêm món ăn mới'}</h2>
              <button className={styles.modalClose} onClick={() => setShowMenuModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.editFormGrid}>
                <div className={styles.editFormGroup}>
                  <label>Tên món *</label>
                  <input type="text" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="VD: Phở bò tái" />
                </div>
                <div className={styles.editFormGroup}>
                  <label>Danh mục</label>
                  <input type="text" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="VD: Món chính, Tráng miệng..." />
                </div>
                <div className={styles.editFormGroup}>
                  <label>Giá (VNĐ) *</label>
                  <input type="number" value={menuForm.price || ''} onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })} placeholder="VD: 85000" />
                </div>
                <div className={styles.editFormGroup}>
                  <label>URL hình ảnh</label>
                  <input type="url" value={menuForm.imageUrl} onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })} placeholder="https://images.unsplash.com/..." />
                </div>
                <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                  <label>Mô tả</label>
                  <textarea value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Mô tả ngắn về món ăn..." rows={2} />
                </div>
                {menuForm.imageUrl && (
                  <div className={`${styles.editFormGroup} ${styles.editFormGroupFull}`}>
                    <label>Xem trước hình ảnh</label>
                    <img src={menuForm.imageUrl} alt="Preview" className={styles.menuImagePreview} />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelEditBtn} onClick={() => setShowMenuModal(false)}>Huỷ</button>
              <button className={styles.saveBtnPrimary} onClick={saveMenuItem}>
                {editingMenuItem ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Menu Confirm ===== */}
      {deleteMenuConfirm && (
        <div className={styles.modalOverlay} onClick={() => setDeleteMenuConfirm(null)}>
          <div className={`${styles.modal} ${styles.modalSmall}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Xác nhận xoá</h2>
              <button className={styles.modalClose} onClick={() => setDeleteMenuConfirm(null)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p>Bạn có chắc chắn muốn xoá món ăn này?</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelEditBtn} onClick={() => setDeleteMenuConfirm(null)}>Huỷ</button>
              <button className={styles.deleteBtnDanger} onClick={() => deleteMenuItem(deleteMenuConfirm)}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
