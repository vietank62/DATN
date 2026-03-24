import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchBookingsByUser, updateBookingStatus } from '../services/api';
import type { Booking } from '../types';
import styles from './MyBookingsPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã huỷ' },
];

const MyBookingsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchBookingsByUser(user.id);
      // newest first
      data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setBookings(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadBookings();
  }, [isAuthenticated, navigate, loadBookings]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn huỷ đặt bàn này?')) return;
    try {
      setCancellingId(id);
      await updateBookingStatus(id, 'cancelled');
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Huỷ thất bại');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = activeTab === 'all' ? bookings : bookings.filter((b) => b.status === activeTab);

  const statusClass = (status: string) => {
    const map: Record<string, string> = {
      pending: styles.statusPending,
      confirmed: styles.statusConfirmed,
      completed: styles.statusCompleted,
      cancelled: styles.statusCancelled,
    };
    return map[status] || '';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Đang tải đơn đặt bàn...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>📋 Đơn đặt bàn của tôi</h1>
      <p className={styles.subtitle}>Quản lý tất cả đơn đặt bàn tại các nhà hàng</p>

      {/* Filter tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === 'all'
              ? ` (${bookings.length})`
              : ` (${bookings.filter((b) => b.status === tab.key).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🍽️</span>
          <h3>Chưa có đơn đặt bàn nào</h3>
          <p>Hãy khám phá nhà hàng và đặt bàn ngay!</p>
          <Link to="/restaurants" className={styles.browseBtn}>
            Khám phá nhà hàng
          </Link>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((booking) => (
            <div key={booking.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3
                  className={styles.restaurantName}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/restaurant/${booking.restaurantId}`)}
                >
                  🏪 {booking.restaurantName || `Nhà hàng #${booking.restaurantId}`}
                </h3>
                <span className={`${styles.statusBadge} ${statusClass(booking.status)}`}>
                  {STATUS_LABELS[booking.status] || booking.status}
                </span>
              </div>

              <div className={styles.cardDetails}>
                <span>📅 {booking.date}</span>
                <span>🕐 {booking.time}</span>
                <span>👥 {booking.guestCount} khách</span>
                <span>💺 {booking.requestedSeats} chỗ</span>
                {booking.assignedSeats && <span>✅ Được xếp: {booking.assignedSeats} chỗ</span>}
              </div>

              <div className={styles.cardDetails}>
                <span>👤 {booking.contactInfo.name}</span>
                <span>📞 {booking.contactInfo.phone}</span>
                {booking.note && <span>📝 {booking.note}</span>}
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.createdAt}>
                  Đặt lúc: {booking.createdAt || '—'}
                </span>
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <button
                    className={styles.cancelBtn}
                    disabled={cancellingId === booking.id}
                    onClick={() => handleCancel(booking.id)}
                  >
                    {cancellingId === booking.id ? 'Đang huỷ...' : 'Huỷ đặt bàn'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
