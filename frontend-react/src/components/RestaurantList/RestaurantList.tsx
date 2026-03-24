import React from 'react';
import { useNavigate } from 'react-router-dom';
import RestaurantCard from '../RestaurantCard/RestaurantCard';
import styles from './RestaurantList.module.css';
import type { Restaurant } from '../../types';

interface RestaurantListProps {
  restaurants: Restaurant[];
  isLoading?: boolean;
  error?: string | null;
  onBooking?: (restaurantId: string) => void;
  onRetry?: () => void;
}

/**
 * Component hiển thị danh sách nhà hàng dạng grid.
 * Xử lý 3 trạng thái: Loading, Empty, Error.
 */
const RestaurantList: React.FC<RestaurantListProps> = ({
  restaurants,
  isLoading = false,
  error = null,
  onBooking,
  onRetry,
}) => {
  const navigate = useNavigate();

  if (error) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>
          <span className={styles.stateIcon}>😢</span>
          <h3>Đã có lỗi xảy ra</h3>
          <p>{error}</p>
          {onRetry && (
            <button className={styles.retryButton} onClick={onRetry}>
              🔄 Thử lại
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Đang tải danh sách nhà hàng...</p>
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.empty}>
          <span className={styles.stateIcon}>🍽️</span>
          <h3>Không tìm thấy nhà hàng</h3>
          <p>Hãy thử thay đổi bộ lọc để tìm nhà hàng phù hợp.</p>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>🍽️ Nhà hàng nổi bật</h2>
        <p className={styles.sectionSubtitle}>Khám phá những nhà hàng được yêu thích nhất</p>
      </div>
      <div className={styles.restaurantList}>
        {restaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            id={restaurant.id}
            image={restaurant.imageUrl}
            name={restaurant.name}
            address={restaurant.address}
            cuisine={restaurant.cuisine}
            district={restaurant.district}
            priceRange={restaurant.priceRange}
            rating={restaurant.rating}
            reviewCount={restaurant.reviewCount}
            featured={restaurant.featured}
            totalSeats={restaurant.totalSeats}
            availableSeats={restaurant.availableSeats}
            onBooking={() => onBooking?.(restaurant.id)}
            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
          />
        ))}
      </div>
    </section>
  );
};

export default RestaurantList;