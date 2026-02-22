import React, { useState } from 'react';
import styles from './BookingModal.module.css';
import { availableTimes, guestOptions } from '../../data/restaurants';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName?: string;
  onSubmit: (bookingData: BookingFormData) => void;
}

export interface BookingFormData {
  date: string;
  time: string;
  guests: number;
  name: string;
  phone: string;
  email: string;
  note: string;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, restaurantName, onSubmit }) => {
  const today = new Date().toISOString().split('T')[0];
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<BookingFormData>({
    date: today,
    time: '19:00',
    guests: 2,
    name: '',
    phone: '',
    email: '',
    note: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});

  if (!isOpen) return null;

  const updateField = (field: keyof BookingFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep1 = () => {
    const newErrors: typeof errors = {};
    if (!form.date) newErrors.date = 'Vui lòng chọn ngày';
    if (!form.time) newErrors.time = 'Vui lòng chọn giờ';
    if (form.guests < 1) newErrors.guests = 'Số khách không hợp lệ';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: typeof errors = {};
    if (!form.name.trim()) newErrors.name = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) newErrors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^0\d{9}$/.test(form.phone.trim())) newErrors.phone = 'Số điện thoại không hợp lệ';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Email không hợp lệ';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 2 && validateStep2()) {
      onSubmit(form);
      setSubmitted(true);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSubmitted(false);
    setForm({ date: today, time: '19:00', guests: 2, name: '', phone: '', email: '', note: '' });
    setErrors({});
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose}>✕</button>

        {submitted ? (
          <div className={styles.success}>
            <span className={styles.successIcon}>🎉</span>
            <h2>Đặt bàn thành công!</h2>
            <p>Cảm ơn bạn đã đặt bàn tại <strong>{restaurantName || 'nhà hàng'}</strong></p>
            <div className={styles.summaryBox}>
              <div className={styles.summaryItem}>
                <span>📅</span> <span>{form.date}</span>
              </div>
              <div className={styles.summaryItem}>
                <span>🕐</span> <span>{form.time}</span>
              </div>
              <div className={styles.summaryItem}>
                <span>👥</span> <span>{form.guests} khách</span>
              </div>
              <div className={styles.summaryItem}>
                <span>👤</span> <span>{form.name}</span>
              </div>
            </div>
            <p className={styles.successNote}>Nhà hàng sẽ liên hệ xác nhận qua số {form.phone}</p>
            <button className={styles.primaryBtn} onClick={handleClose}>Đóng</button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2>Đặt bàn {restaurantName ? `- ${restaurantName}` : ''}</h2>
              <div className={styles.steps}>
                <div className={`${styles.stepDot} ${step >= 1 ? styles.stepActive : ''}`}>1</div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.stepDot} ${step >= 2 ? styles.stepActive : ''}`}>2</div>
              </div>
              <p className={styles.stepLabel}>
                {step === 1 ? 'Chọn thời gian & số khách' : 'Thông tin liên hệ'}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className={styles.formBody}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>📅 Ngày đặt bàn</label>
                    <input
                      type="date"
                      className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                      value={form.date}
                      min={today}
                      onChange={(e) => updateField('date', e.target.value)}
                    />
                    {errors.date && <span className={styles.errorText}>{errors.date}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>🕐 Giờ đến</label>
                    <select
                      className={`${styles.input} ${errors.time ? styles.inputError : ''}`}
                      value={form.time}
                      onChange={(e) => updateField('time', e.target.value)}
                    >
                      {availableTimes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {errors.time && <span className={styles.errorText}>{errors.time}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>👥 Số khách</label>
                    <select
                      className={`${styles.input} ${errors.guests ? styles.inputError : ''}`}
                      value={form.guests}
                      onChange={(e) => updateField('guests', Number(e.target.value))}
                    >
                      {guestOptions.map((g) => (
                        <option key={g} value={g}>{g} khách</option>
                      ))}
                    </select>
                    {errors.guests && <span className={styles.errorText}>{errors.guests}</span>}
                  </div>

                  <button type="button" className={styles.primaryBtn} onClick={handleNext}>
                    Tiếp tục →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className={styles.formBody}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>👤 Họ và tên *</label>
                    <input
                      type="text"
                      className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                      placeholder="Nguyễn Văn A"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                    />
                    {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>📞 Số điện thoại *</label>
                    <input
                      type="tel"
                      className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                      placeholder="0901234567"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                    />
                    {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>✉️ Email</label>
                    <input
                      type="email"
                      className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                      placeholder="email@example.com"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                    />
                    {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>📝 Ghi chú</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Yêu cầu đặc biệt (bàn gần cửa sổ, sinh nhật...)"
                      value={form.note}
                      onChange={(e) => updateField('note', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.secondaryBtn} onClick={handleBack}>
                      ← Quay lại
                    </button>
                    <button type="submit" className={styles.primaryBtn}>
                      ✓ Xác nhận đặt bàn
                    </button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingModal;