import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { updateUser, uploadImage, fetchUserReviews } from '../services/api';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import type { Review } from '../types';
import styles from './ProfilePage.module.css';

const ProfilePage: React.FC = () => {
  const { user, isAuthenticated, updateUser: updateContextUser } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAvatarPreview(user.avatar || '');
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (activeTab === 'reviews' && user) {
      setLoadingReviews(true);
      fetchUserReviews(user.id)
        .then(setMyReviews)
        .catch(() => toast.error('Lỗi khi tải đánh giá'))
        .finally(() => setLoadingReviews(false));
    }
  }, [activeTab, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    const loadingToast = toast.loading('Đang cập nhật...');
    try {
      const updates: any = { name, phone };
      if (password.trim()) {
        updates.password = password;
      }
      if (avatarPreview !== user.avatar) {
        updates.avatar = avatarPreview;
      }
      const updatedUser = await updateUser(user.email, updates);
      updateContextUser(updatedUser);
      setPassword('');
      toast.success('Cập nhật thông tin thành công!', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Cập nhật thất bại', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.profileCard}>
          <div className={styles.header}>
            <h2>Hồ sơ cá nhân</h2>
            <p>Quản lý thông tin tài khoản của bạn</p>
          </div>

          <div className={styles.tabs}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'info' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Thông tin chung
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              Đánh giá của tôi
            </button>
          </div>
          
          {activeTab === 'info' ? (
            <>
              <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {avatarPreview ? <img src={avatarPreview} alt="Avatar" /> : user.name.charAt(0).toUpperCase()}
              </div>
              <label className={styles.avatarEditBtn}>
                📷
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const loadingToast = toast.loading('Đang tải ảnh lên...');
                    try {
                      const { url } = await uploadImage(file);
                      setAvatarPreview(url);
                      toast.success('Tải ảnh lên thành công', { id: loadingToast });
                    } catch (err) {
                      toast.error('Lỗi khi tải ảnh lên', { id: loadingToast });
                    }
                  }}
                />
              </label>
            </div>
            <div className={styles.userInfo}>
              <h3>{user.email}</h3>
              <span className={styles.roleBadge}>{user.role === 'customer' ? 'Khách hàng' : user.role === 'manager' ? 'Quản lý' : 'Admin'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Họ và tên</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Số điện thoại</label>
              <input 
                type="text" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Mật khẩu mới (Để trống nếu không đổi)</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
            </form>
            </>
          ) : (
            <div className={styles.reviewsList}>
              {loadingReviews ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Đang tải đánh giá...</div>
              ) : myReviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>📝</div>
                  <p>Bạn chưa viết đánh giá nào.</p>
                </div>
              ) : (
                myReviews.map(review => (
                  <div key={review.reviewId} className={styles.reviewItem}>
                    <div className={styles.reviewHeader}>
                      <div>
                        {review.restaurantName ? (
                          <Link to={`/restaurant/${review.restaurantId}`} className={styles.restaurantLink}>
                            <strong>{review.restaurantName}</strong>
                          </Link>
                        ) : (
                          <strong>Nhà hàng #{review.restaurantId}</strong>
                        )}
                        <div className={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</div>
                      </div>
                      <div className={styles.reviewRating}>{'⭐'.repeat(review.rating)}</div>
                    </div>
                    <p className={styles.reviewComment}>{review.comment}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
