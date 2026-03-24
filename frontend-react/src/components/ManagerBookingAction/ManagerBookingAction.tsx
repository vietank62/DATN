import React, { useState } from 'react';
import styles from './ManagerBookingAction.module.css';

interface ManagerBookingActionProps {
  bookingId: string;
  requestedSeats: number;
  availableSeats: number;
  currentStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  assignedSeats?: number;
  onConfirm: (bookingId: string, assignedSeats: number) => void;
  onCancel: (bookingId: string) => void;
  onComplete: (bookingId: string) => void;
}

const ManagerBookingAction: React.FC<ManagerBookingActionProps> = ({
  bookingId,
  requestedSeats,
  availableSeats,
  currentStatus,
  assignedSeats: existingAssignedSeats,
  onConfirm,
  onCancel,
  onComplete,
}) => {
  const [seatCount, setSeatCount] = useState(
    Math.min(requestedSeats, availableSeats > 0 ? availableSeats : requestedSeats)
  );

  const exceedsCapacity = seatCount > availableSeats;
  const noSeatsAvailable = availableSeats <= 0;

  if (currentStatus === 'pending') {
    return (
      <div className={styles.container}>
        <div className={styles.pendingPanel}>
          <div className={styles.infoRow}>
            <span>Yêu cầu:</span>
            <span className={styles.requestedInfo}>{requestedSeats} chỗ</span>
          </div>

          <div className={styles.seatSelector}>
            <span className={styles.seatLabel}>Gán chỗ:</span>
            <div className={styles.seatControls}>
              <button
                className={styles.seatBtn}
                onClick={() => setSeatCount((prev) => Math.max(1, prev - 1))}
                disabled={seatCount <= 1}
              >
                −
              </button>
              <input
                type="number"
                className={styles.seatValue}
                value={seatCount}
                min={1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) setSeatCount(val);
                }}
              />
              <button
                className={styles.seatBtn}
                onClick={() => setSeatCount((prev) => prev + 1)}
              >
                +
              </button>
            </div>
          </div>

          {exceedsCapacity && (
            <div className={`${styles.warning} ${noSeatsAvailable ? styles.dangerWarning : ''}`}>
              <span className={styles.warningIcon}>⚠️</span>
              <span>
                {noSeatsAvailable
                  ? 'Hiện không còn chỗ trống!'
                  : `Vượt quá số chỗ trống (còn ${availableSeats} chỗ)`}
              </span>
            </div>
          )}

          <div className={styles.actionRow}>
            <button
              className={styles.confirmActionBtn}
              onClick={() => onConfirm(bookingId, seatCount)}
              disabled={noSeatsAvailable}
            >
              ✓ Xác nhận
            </button>
            <button className={styles.cancelActionBtn} onClick={() => onCancel(bookingId)}>
              ✕ Huỷ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === 'confirmed') {
    return (
      <div className={styles.container}>
        {existingAssignedSeats && (
          <div className={styles.infoRow}>
            <span>Đã gán:</span>
            <span className={styles.assignedInfo}>{existingAssignedSeats} chỗ</span>
          </div>
        )}
        <button className={styles.completeActionBtn} onClick={() => onComplete(bookingId)}>
          ✓ Hoàn thành
        </button>
      </div>
    );
  }

  // cancelled / completed: show assigned seats info only
  if (existingAssignedSeats) {
    return (
      <div className={styles.infoRow}>
        <span>Đã gán:</span>
        <span className={styles.assignedInfo}>{existingAssignedSeats} chỗ</span>
      </div>
    );
  }

  return null;
};

export default ManagerBookingAction;
