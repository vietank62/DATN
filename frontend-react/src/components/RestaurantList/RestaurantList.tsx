import React, { useState, useEffect } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Reset to page 1 when the list changes (e.g. filters applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [restaurants]);

  const totalPages = Math.ceil(restaurants.length / itemsPerPage);
  const currentRestaurants = restaurants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
        {currentRestaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            id={restaurant.id}
            images={restaurant.imageUrl}
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
            description={restaurant.description}
            promotion={restaurant.promotion}
            onBooking={() => onBooking?.(restaurant.id)}
            onClick={() => navigate(`/restaurant/${restaurant.id}`)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(p => p - 1);
              document.getElementById('restaurant-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            ← Trước
          </button>
          
          <div className={styles.pageNumbers}>
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              // Simple pagination logic to show max 5 buttons
              if (
                totalPages <= 5 || 
                page === 1 || 
                page === totalPages || 
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    className={`${styles.pageNum} ${currentPage === page ? styles.pageNumActive : ''}`}
                    onClick={() => {
                      setCurrentPage(page);
                      document.getElementById('restaurant-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    {page}
                  </button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={`ellipsis-${page}`} className={styles.ellipsis}>...</span>;
              }
              return null;
            })}
          </div>

          <button
            className={styles.pageBtn}
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage(p => p + 1);
              document.getElementById('restaurant-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Sau →
          </button>
        </div>
      )}
    </section>
  );
};

export default RestaurantList;