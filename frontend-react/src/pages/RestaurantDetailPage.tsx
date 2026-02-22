import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRestaurantById } from '../services/api';
import type { Restaurant } from '../types';
import BookingModal from '../components/BookingModal/BookingModal';
import type { BookingFormData } from '../components/BookingModal/BookingModal';
import { cuisineTypes } from '../data/restaurants';
import styles from './RestaurantDetailPage.module.css';

const RestaurantDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (id) {
          setLoading(true);
          const data = await fetchRestaurantById(id);
          if (data) setRestaurant(data);
        }
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleBookingSubmit = (bookingData: BookingFormData) => {
    console.log('Booking submitted:', bookingData);
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Đang tải thông tin nhà hàng...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorIcon}>😢</span>
        <h2>Không tìm thấy nhà hàng</h2>
        <p>Nhà hàng bạn tìm không tồn tại hoặc đã bị xoá.</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Về trang chủ
        </button>
      </div>
    );
  }

  const cuisineLabel = cuisineTypes.find((c) => c.id === restaurant.cuisine);

  return (
    <div className={styles.page}>
      <div className={styles.heroImage}>
        <img src={restaurant.imageUrl} alt={restaurant.name} />
        <div className={styles.heroOverlay}>
          <button className={styles.backButton} onClick={() => navigate(-1)}>
            ← Quay lại
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainInfo}>
          <div className={styles.badges}>
            {restaurant.featured && <span className={styles.featuredBadge}>⭐ Nổi bật</span>}
            {cuisineLabel && (
              <span className={styles.cuisineBadge}>{cuisineLabel.icon} {cuisineLabel.label}</span>
            )}
          </div>

          <h1 className={styles.name}>{restaurant.name}</h1>
          <p className={styles.description}>{restaurant.description}</p>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>📍</span>
              <div>
                <span className={styles.infoLabel}>Địa chỉ</span>
                <span className={styles.infoValue}>{restaurant.address}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>🕐</span>
              <div>
                <span className={styles.infoLabel}>Giờ mở cửa</span>
                <span className={styles.infoValue}>{restaurant.openTime} - {restaurant.closeTime}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>📞</span>
              <div>
                <span className={styles.infoLabel}>Điện thoại</span>
                <span className={styles.infoValue}>{restaurant.phone}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>💰</span>
              <div>
                <span className={styles.infoLabel}>Khoảng giá</span>
                <span className={styles.infoValue}>{restaurant.priceRange}</span>
              </div>
            </div>
          </div>

          <div className={styles.ratingSection}>
            <div className={styles.ratingBig}>
              <span className={styles.ratingScore}>⭐ {restaurant.rating.toFixed(1)}</span>
              <span className={styles.ratingCount}>{restaurant.reviewCount} đánh giá</span>
            </div>
          </div>

          {/* Menu Section */}
          {restaurant.menu && restaurant.menu.length > 0 && (
            <div className={styles.menuSection}>
              <h2 className={styles.menuTitle}>Thực đơn</h2>
              {Object.entries(
                restaurant.menu.reduce<Record<string, typeof restaurant.menu>>((acc, item) => {
                  const cat = item.category || 'Khác';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category} className={styles.menuCategory}>
                  <h3 className={styles.menuCategoryName}>{category}</h3>
                  <div className={styles.menuGrid}>
                    {items.map((item) => (
                      <div key={item.id} className={styles.menuItem}>
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.name} className={styles.menuImage} />
                        )}
                        <div className={styles.menuItemInfo}>
                          <div className={styles.menuItemHeader}>
                            <strong className={styles.menuItemName}>{item.name}</strong>
                            <span className={styles.menuItemPrice}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                            </span>
                          </div>
                          {item.description && (
                            <p className={styles.menuItemDesc}>{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.bookingCard}>
            <h3>Đặt bàn ngay</h3>
            <p>Đảm bảo chỗ ngồi tại {restaurant.name}</p>
            <button className={styles.bookBtn} onClick={() => setModalOpen(true)}>
              🍽️ Đặt bàn
            </button>
            <p className={styles.bookNote}>Miễn phí · Xác nhận tức thì</p>
          </div>
        </div>
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        restaurantName={restaurant.name}
        onSubmit={handleBookingSubmit}
      />
    </div>
  );
};

export default RestaurantDetailPage;