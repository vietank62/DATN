import React from 'react';
import styles from './SeatStatusBadge.module.css';
import type { UserRole } from '../../types';

interface SeatStatusBadgeProps {
  availableSeats: number;
  totalSeats: number;
  userRole: UserRole;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const SeatStatusBadge: React.FC<SeatStatusBadgeProps> = ({
  availableSeats,
  totalSeats,
  userRole,
  size = 'md',
  compact = false,
}) => {
  const isFull = availableSeats <= 0;
  const occupancyPercent = totalSeats > 0 ? ((totalSeats - availableSeats) / totalSeats) * 100 : 100;

  const getColorLevel = () => {
    if (occupancyPercent >= 90) return 'Danger';
    if (occupancyPercent >= 70) return 'Warning';
    return 'Good';
  };

  const colorLevel = getColorLevel();

  // Customer view: simple badge
  if (userRole === 'customer') {
    const sizeClass = size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : '';
    if (isFull) {
      return (
        <span className={`${styles.badgeFull} ${sizeClass}`}>
          <span className={`${styles.badgeDot} ${styles.dotRed}`} />
          Hết chỗ
        </span>
      );
    }
    return (
      <span className={`${styles.badgeAvailable} ${sizeClass}`}>
        <span className={`${styles.badgeDot} ${styles.dotGreen}`} />
        Còn chỗ
      </span>
    );
  }

  // Manager view: compact (for table cells)
  if (compact) {
    return (
      <div className={styles.managerCompact}>
        <span className={`${styles.managerCount} ${styles[`count${colorLevel}`]}`}>
          {availableSeats}/{totalSeats}
        </span>
        <div className={styles.miniProgress}>
          <div
            className={`${styles.progressFill} ${styles[`progress${colorLevel}`]}`}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Manager view: full display
  return (
    <div className={styles.managerContainer}>
      <div className={styles.managerHeader}>
        <span className={styles.managerLabel}>🪑 Chỗ ngồi</span>
        <span className={`${styles.managerCount} ${styles[`count${colorLevel}`]}`}>
          {availableSeats} / {totalSeats} còn trống
        </span>
      </div>
      <div className={styles.progressBar}>
        <div
          className={`${styles.progressFill} ${styles[`progress${colorLevel}`]}`}
          style={{ width: `${occupancyPercent}%` }}
        />
      </div>
    </div>
  );
};

export default SeatStatusBadge;
