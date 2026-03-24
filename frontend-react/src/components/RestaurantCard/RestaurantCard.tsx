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
  district?: string;
  priceRange: string;
  rating: number;
  reviewCount?: number;
  featured?: boolean;
  totalSeats: number;
  availableSeats: number;
  onBooking: () => void;
  onClick?: () => void;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({
  image,
  name,
  address,
  cuisine,
  priceRange,
  rating,
  reviewCount,
  featured,
  totalSeats,
  availableSeats,
  onBooking,
  onClick,
}) => {
  const cuisineLabel = cuisineTypes.find((c) => c.id === cuisine || c.label === cuisine);
  const isFull = availableSeats <= 0;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.imageWrapper}>
        <img src={image} alt={name} className={styles.image} />
        {featured && <span className={styles.featuredBadge}>⭐ Nổi bật</span>}
        {cuisineLabel && (
          <span className={styles.cuisineBadge}>
            {cuisineLabel.icon} {cuisineLabel.label}
          </span>
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