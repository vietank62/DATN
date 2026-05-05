import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import styles from './ManagerDashboard.module.css';
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
  updateUser as apiUpdateUser
} from '../services/api';
import type { Booking, ManagerStats, Restaurant, MenuItem } from '../types';
import SeatStatusBadge from '../components/SeatStatusBadge/SeatStatusBadge';
import ManagerBookingAction from '../components/ManagerBookingAction/ManagerBookingAction';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import { cuisineTypes } from '../data/restaurants';

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
  const { user: authUser, logout, updateUser: updateContextUser } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<ManagerStats>({ 
    totalBookings: 0, todayBookings: 0, totalRevenue: 0, 
    avgRating: 0, pendingBookings: 0, confirmedBookings: 0 
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bookings' | 'restaurant' | 'menu' | 'stats'>('bookings');

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
        const created = await apiCreateMenuItem({ ...menuForm, restaurantId: Number(restaurant.id) });
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
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <h1>
            {activeTab === 'bookings' && 'Đơn đặt bàn'}
            {activeTab === 'restaurant' && 'Thông tin nhà hàng'}
            {activeTab === 'menu' && 'Thực đơn'}
            {activeTab === 'stats' && 'Thống kê'}
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
                      <th>Ngày & Giờ</th>
                      <th>Khách</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
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
                          <span className={`${styles.statusBadge} ${styles[booking.status]}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {booking.status === 'pending' && (
                              <button onClick={() => handleStatusChange(booking.id, 'confirmed')} className={styles.confirmBtn}>Xác nhận</button>
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
                      {restaurant.cuisine.map(c => <span key={c} className={styles.cuisineBadge}>{c}</span>)}
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
                          {cuisineTypes.filter(c => c.id !== 'all').map(c => (
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
              <h2>Thống kê kinh doanh</h2>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span>Tổng đơn</span>
                  <h3>{stats.totalBookings}</h3>
                </div>
                <div className={styles.statCard}>
                  <span>Doanh thu dự kiến</span>
                  <h3>{stats.totalRevenue.toLocaleString()}đ</h3>
                </div>
                <div className={styles.statCard}>
                  <span>Đánh giá TB</span>
                  <h3>⭐ {stats.avgRating.toFixed(1)}</h3>
                </div>
              </div>
            </div>
          )}
        </main>
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
