import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HeroSection.module.css';
import { districts, availableTimes, guestOptions } from '../../constants';

interface HeroSectionProps {
  onSearch?: (params: { location: string; date: string; time: string; guests: number }) => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onSearch }) => {
  const today = new Date().toISOString().split('T')[0];
  const [location, setLocation] = useState('Tất cả');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('19:00');
  const [guests, setGuests] = useState(2);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.({ location, date, time, guests });
    // Cuộn xuống khu vực nhà hàng
    const section = document.getElementById('restaurant-section');
    section?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroOverlay}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Khám phá & Đặt bàn<br />
            <span className={styles.highlight}>Nhà hàng yêu thích</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Tìm kiếm và đặt bàn tại những nhà hàng hàng đầu chỉ trong vài giây
          </p>
        </div>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.searchField}>
            <label>📍 Khu vực</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className={styles.searchField}>
            <label>📅 Ngày</label>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className={styles.searchField}>
            <label>🕐 Giờ</label>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {availableTimes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.searchField}>
            <label>👥 Số khách</label>
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
              {guestOptions.map((g) => <option key={g} value={g}>{g} khách</option>)}
            </select>
          </div>
          <button type="submit" className={styles.searchButton}>🔍 Tìm nhà hàng</button>
        </form>

      </div>
    </section>
  );
};

export default HeroSection;