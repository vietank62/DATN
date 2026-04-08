import React from 'react';
import styles from './RestaurantCard.module.css';
import { cuisineTypes } from '../../data/restaurants';
import SeatStatusBadge from '../SeatStatusBadge/SeatStatusBadge';

interface RestaurantCardProps {
  id: string;
  image: string;
  name: string;
  address: string;
  cuisine?: string;
  cuisines?: string[];  // New: array of cuisines
  district?: string;
  priceRange: string;
  rating: number;
  reviewCount?: number;
  featured?: boolean;
  totalSeats: number;
  availableSeats: number;
  description?: string;
  onBooking: () => void;
  onClick?: () => void;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({
  image,
  name,
  address,
  cuisine,
  cuisines,
  priceRange,
  rating,
  reviewCount,
  featured,
  totalSeats,
  availableSeats,
  description,
  onBooking,
  onClick,
}) => {
  // Use multiple cuisines if available, otherwise fall back to single cuisine
  const displayCuisines = cuisines && cuisines.length > 0 ? cuisines : (cuisine ? [cuisine] : []);
  const cuisineLabel = cuisine ? cuisineTypes.find((c) => c.id === cuisine || c.label === cuisine) : null;
  const isFull = availableSeats <= 0;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.imageWrapper}>
        <img
          src={image}
          alt={name}
          className={styles.image}
          style={{ cursor: 'pointer' }}
          title="Click để xem chi tiết"
        />
        {featured && <span className={styles.featuredBadge}>⭐ Nổi bật</span>}
        {displayCuisines.length > 0 && (
          <div className={styles.cuisineContainer}>
            {displayCuisines.slice(0, 2).map((c, idx) => {
              const label = cuisineTypes.find((ct) => ct.id === c || ct.label === c);
              return label ? (
                <span key={idx} className={styles.cuisineBadge}>
                  {label.icon} {label.label}
                </span>
              ) : null;
            })}
            {displayCuisines.length > 2 && (
              <span className={styles.cuisineBadge}>+{displayCuisines.length - 2}</span>
            )}
          </div>
        )}
        <span className={styles.seatBadge}>
          <SeatStatusBadge
            availableSeats={availableSeats}
            totalSeats={totalSeats}
            userRole="customer"
            size="sm"
          />
        </span>
      </div>
      <div className={styles.content}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.address}>📍 {address}</p>
        <div className={styles.meta}>
          <span className={styles.rating}>⭐ {rating.toFixed(1)}</span>
          {reviewCount !== undefined && (
            <span className={styles.reviews}>({reviewCount} đánh giá)</span>
          )}
          <span className={styles.priceRange}>💰 {priceRange}</span>
        </div>
        <button
          className={`${styles.bookingButton} ${isFull ? styles.bookBtnDisabled : ''}`}
          disabled={isFull}
          onClick={(e) => {
            e.stopPropagation();
            if (!isFull) onBooking();
          }}
        >
          {isFull ? 'Hết chỗ' : 'Đặt bàn ngay'}
        </button>
      </div>
    </div>
  );
};

export default RestaurantCard;