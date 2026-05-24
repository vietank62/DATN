import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRestaurantById, createBooking, fetchReviews, createReview } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Restaurant, Review } from '../types';
import BookingModal from '../components/BookingModal/BookingModal';
import type { BookingFormData } from '../components/BookingModal/BookingModal';
import SeatStatusBadge from '../components/SeatStatusBadge/SeatStatusBadge';
import styles from './RestaurantDetailPage.module.css';

const RestaurantDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, cuisines } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [localAvailableSeats, setLocalAvailableSeats] = useState(0);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sortReview, setSortReview] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [filterStar, setFilterStar] = useState<'all' | number>('all');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Slideshow state
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const imageArray = restaurant ? (Array.isArray(restaurant.imageUrl) ? restaurant.imageUrl : (restaurant.imageUrl ? [restaurant.imageUrl] : ['/default-restaurant.jpg'])) : [];

  useEffect(() => {
    let interval: number;
    if (isHovered && imageArray.length > 1) {
      interval = window.setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % imageArray.length);
      }, 2000);
    } else {
      setCurrentImageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isHovered, imageArray.length]);

  useEffect(() => {
    const load = async () => {
      try {
        if (id) {
          window.scrollTo(0, 0);
          setLoading(true);
          const data = await fetchRestaurantById(id);
          if (data) {
            setRestaurant(data);
            setLocalAvailableSeats(data.availableSeats);
          }
          
          const reviewData = await fetchReviews(id);
          setReviews(reviewData);
        }
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleBookingSubmit = async (bookingData: BookingFormData) => {
    if (!restaurant || !id) return;
    setBookingError(null);
    try {
      await createBooking({
        restaurantId: id,
        restaurantName: restaurant.name,
        date: bookingData.date,
        time: bookingData.time,
        guestCount: bookingData.guests,
        requestedSeats: bookingData.guests,
        status: 'pending',
        contactInfo: {
          name: bookingData.name,
          email: bookingData.email,
          phone: bookingData.phone,
        },
        note: bookingData.note,
      });
      // Update available seats optimistically
      setLocalAvailableSeats((prev) => Math.max(0, prev - bookingData.guests));
    } catch (err: any) {
      setBookingError(err.message || 'Đặt bàn thất bại');
      console.error('Booking error:', err);
    }
  };

  const handleOpenBooking = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!id || !authUser) return;
    try {
      setSubmittingReview(true);
      const newReview = await createReview({
        userId: Number(authUser.id),
        restaurantId: Number(id),
        rating: newReviewRating,
        comment: newReviewComment,
      });
      setReviews([...reviews, newReview]);
      setNewReviewComment('');
      setNewReviewRating(5);
      
      // Update restaurant rating optimistically
      if (restaurant) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0) + newReviewRating;
        const newCount = reviews.length + 1;
        setRestaurant({
          ...restaurant,
          rating: Number((totalRating / newCount).toFixed(1)),
          reviewCount: newCount,
        });
      }
    } catch (err) {
      console.error('Error submitting review', err);
      alert('Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredReviews = reviews
    .filter((r) => filterStar === 'all' || r.rating === filterStar)
    .sort((a, b) => {
      if (sortReview === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortReview === 'highest') return b.rating - a.rating;
      if (sortReview === 'lowest') return a.rating - b.rating;
      return 0;
    });

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

  const isFull = localAvailableSeats <= 0;

  return (
    <div className={styles.page}>
      <div 
        className={styles.heroImage}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img src={imageArray.length > 0 ? imageArray[currentImageIndex] : '/default-restaurant.jpg'} alt={restaurant.name} />
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
            {restaurant.cuisine && Array.isArray(restaurant.cuisine) && restaurant.cuisine.map((cId) => {
              const cLabel = cuisines.find(c => c.id === cId);
              return cLabel ? (
                <span key={cId} className={styles.cuisineBadge}>{cLabel.icon} {cLabel.label}</span>
              ) : null;
            })}
            <SeatStatusBadge
              availableSeats={localAvailableSeats}
              totalSeats={restaurant.totalSeats}
              userRole="customer"
            />
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

          {/* Reviews Section */}
          <div className={styles.reviewsSection} id="reviews">
            <h2 className={styles.reviewsTitle}>Đánh giá từ người dùng</h2>
            
            <div className={styles.reviewsFilter}>
              <div className={styles.filterGroup}>
                <label>Lọc theo sao:</label>
                <select value={filterStar} onChange={(e) => setFilterStar(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">Tất cả</option>
                  <option value="5">5 Sao</option>
                  <option value="4">4 Sao</option>
                  <option value="3">3 Sao</option>
                  <option value="2">2 Sao</option>
                  <option value="1">1 Sao</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Sắp xếp:</label>
                <select value={sortReview} onChange={(e) => setSortReview(e.target.value as any)}>
                  <option value="newest">Mới nhất</option>
                  <option value="highest">Đánh giá cao nhất</option>
                  <option value="lowest">Đánh giá tiêu cực nhất</option>
                </select>
              </div>
            </div>

            {isAuthenticated ? (
              <form onSubmit={handleSubmitReview} className={styles.reviewForm}>
                <h4>Viết đánh giá của bạn</h4>
                <div className={styles.ratingInput}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                      key={star} 
                      className={star <= newReviewRating ? styles.starActive : styles.starInactive}
                      onClick={() => setNewReviewRating(star)}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <textarea 
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  required
                />
                <button type="submit" disabled={submittingReview}>
                  {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                </button>
              </form>
            ) : (
              <div className={styles.loginToReview}>
                <p>Vui lòng <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>đăng nhập</a> để viết đánh giá.</p>
              </div>
            )}

            <div className={styles.reviewsList}>
              {filteredReviews.length === 0 ? (
                <p className={styles.noReviews}>Chưa có đánh giá nào phù hợp.</p>
              ) : (
                filteredReviews.map((review) => (
                  <div key={review.reviewId} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewerInfo}>
                        {review.userAvatar ? (
                          <img src={review.userAvatar} alt="avatar" className={styles.reviewerAvatar} />
                        ) : (
                          <div className={styles.reviewerAvatarPlaceholder}>
                            {review.userName ? review.userName[0].toUpperCase() : 'K'}
                          </div>
                        )}
                        <span className={styles.reviewerName}>{review.userName || 'Khách'}</span>
                      </div>
                      <div className={styles.reviewMeta}>
                        <div className={styles.reviewStars}>
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </div>
                        <span className={styles.reviewDate}>
                          {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.bookingCard}>
            <h3>Đặt bàn ngay</h3>
            <p>Đảm bảo chỗ ngồi tại {restaurant.name}</p>

            <div className={styles.seatStatusCard}>
              <SeatStatusBadge
                availableSeats={localAvailableSeats}
                totalSeats={restaurant.totalSeats}
                userRole="customer"
                size="lg"
              />
            </div>

            {isFull ? (
              <>
                <button className={`${styles.bookBtn} ${styles.bookBtnDisabled}`} disabled>
                  🍽️ Hết chỗ
                </button>
                <p className={styles.fullNotice}>Nhà hàng hiện đã hết chỗ. Vui lòng quay lại sau.</p>
              </>
            ) : (
              <>
                <button className={styles.bookBtn} onClick={handleOpenBooking}>
                  🍽️ Đặt bàn
                </button>
                <p className={styles.bookNote}>Miễn phí · Xác nhận tức thì</p>
              </>
            )}
          </div>
        </div>
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        restaurantName={restaurant.name}
        availableSeats={localAvailableSeats}
        onSubmit={handleBookingSubmit}
      />
    </div>
  );
};

export default RestaurantDetailPage;