import React from 'react';
import styles from './RestaurantCard.module.css';
import { cuisineTypes } from '../../data/restaurants';
import SeatStatusBadge from '../SeatStatusBadge/SeatStatusBadge';

interface RestaurantCardProps {
  id: string;
  images: string | string[];
  name: string;
  address: string;
  cuisine: string[];
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
  images,
  name,
  address,
  cuisine,
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
  // Use multiple cuisines
  const displayCuisines = Array.isArray(cuisine) ? cuisine : [];
  const isFull = availableSeats <= 0;

  const [isHovered, setIsHovered] = React.useState(false);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  const imageArray = Array.isArray(images) ? images : (images ? [images] : ['/default-restaurant.jpg']);

  React.useEffect(() => {
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

  return (
    <div className={styles.card} onClick={onClick}>
      <div 
        className={styles.imageWrapper}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={imageArray[currentImageIndex]}
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