import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HeroSection from '../components/HeroSection/HeroSection';
import FilterBar from '../components/FilterBar/FilterBar';
import RestaurantList from '../components/RestaurantList/RestaurantList';
import RestaurantCard from '../components/RestaurantCard/RestaurantCard';
import { fetchRestaurants } from '../services/api';
import type { Restaurant, FilterOptions } from '../types';
import { useAuth } from '../contexts/AuthContext';
import styles from './HomePage.module.css';

const defaultFilters: FilterOptions = {
  cuisineType: 'all',
  priceRange: 'all',
  area: 'Tất cả',
  rating: 0,
};

// Reusable horizontal scrollable collection component
const CollectionRow: React.FC<{
  title: string;
  subtitle: string;
  icon: string;
  data: Restaurant[];
  onViewAll: () => void;
  onBooking: (id: string) => void;
  onCardClick: (id: string) => void;
}> = ({ title, subtitle, icon, data, onViewAll, onBooking, onCardClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (data.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.titleContainer}>
          <h2 className={styles.sectionTitle}>
            {icon} {title}
          </h2>
          <p className={styles.sectionSubtitle}>{subtitle}</p>
        </div>
        <button className={styles.viewAllBtn} onClick={onViewAll}>
          Xem tất cả ➔
        </button>
      </div>
      <div className={styles.scrollWrapper}>
        <button className={`${styles.arrowBtn} ${styles.leftArrow}`} onClick={() => handleScroll('left')}>
          ‹
        </button>
        <div className={styles.scrollContainer} ref={scrollRef}>
          {data.map((r) => (
            <div className={styles.scrollItem} key={r.id}>
              <RestaurantCard
                id={r.id}
                images={r.imageUrl}
                name={r.name}
                address={r.address}
                cuisine={r.cuisine}
                priceRange={r.priceRange}
                rating={r.rating}
                reviewCount={r.reviewCount}
                featured={r.featured}
                totalSeats={r.totalSeats}
                availableSeats={r.availableSeats}
                promotion={r.promotion}
                onBooking={() => onBooking(r.id)}
                onClick={() => onCardClick(r.id)}
              />
            </div>
          ))}
        </div>
        <button className={`${styles.arrowBtn} ${styles.rightArrow}`} onClick={() => handleScroll('right')}>
          ›
        </button>
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [displayedRestaurants, setDisplayedRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [showPromoOnly, setShowPromoOnly] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cuisines } = useAuth();

  // Update filters if URL query changes
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setFilters(prev => ({ ...prev, query: q }));
      setShowPromoOnly(false);
    }
  }, [searchParams]);

  const loadRestaurants = useCallback(async (currentFilters: FilterOptions) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRestaurants(currentFilters, cuisines);
      setAllRestaurants(data);
    } catch (err) {
      setError('Không thể tải danh sách nhà hàng. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [cuisines]);

  useEffect(() => {
    loadRestaurants(filters);
  }, [filters, loadRestaurants]);

  // Apply filters on the list of restaurants
  useEffect(() => {
    let result = [...allRestaurants];
    if (showPromoOnly) {
      result = result.filter(r => !!r.promotion);
    }
    setDisplayedRestaurants(result);
  }, [allRestaurants, showPromoOnly]);

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setShowPromoOnly(false); // Reset promo only when user interacts with standard filter bar
  };

  const handleRetry = () => {
    loadRestaurants(filters);
  };

  const handleSearch = (params: { location: string; date: string; time: string; guests: number }) => {
    setFilters((prev) => ({
      ...prev,
      area: params.location,
      time: params.time,
      guests: params.guests,
    }));
    setShowPromoOnly(false);
  };

  const handleBooking = (restaurantId: string) => {
    navigate(`/restaurant/${restaurantId}`);
  };

  // Determine if we are in the default home state (no active filters or searches)
  const isDefaultState =
    filters.cuisineType === 'all' &&
    filters.priceRange === 'all' &&
    filters.area === 'Tất cả' &&
    filters.rating === 0 &&
    !filters.query &&
    !filters.guests &&
    !filters.time &&
    !showPromoOnly;

  // Filter collections for homepage rows
  const featuredList = allRestaurants
    .filter((r) => r.rating >= 4.5 || r.featured)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  const promoList = allRestaurants
    .filter((r) => !!r.promotion)
    .slice(0, 10);

  const buffetList = allRestaurants
    .filter((r) => r.cuisine.includes('buffet') || r.cuisine.includes('Buffet'))
    .slice(0, 10);

  const vietnameseList = allRestaurants
    .filter((r) => r.cuisine.includes('vietnamese') || r.cuisine.includes('Việt Nam') || r.cuisine.includes('vietnam'))
    .slice(0, 10);

  return (
    <div className={styles.homepage}>
      <HeroSection onSearch={handleSearch} />
      
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        resultCount={displayedRestaurants.length}
      />
      
      {isLoading ? (
        <RestaurantList
          restaurants={[]}
          isLoading={true}
          error={null}
          onRetry={handleRetry}
          onBooking={handleBooking}
        />
      ) : error ? (
        <RestaurantList
          restaurants={[]}
          isLoading={false}
          error={error}
          onRetry={handleRetry}
          onBooking={handleBooking}
        />
      ) : isDefaultState ? (
        <div className={styles.collectionsContainer}>
          {/* 1. HOT / Featured collection */}
          <CollectionRow
            title="Nhà hàng Nổi bật nhất"
            subtitle="Điểm đến lý tưởng với lượt đánh giá cao ngất ngưởng"
            icon="🔥"
            data={featuredList}
            onViewAll={() => handleFilterChange({ ...defaultFilters, rating: 4 })}
            onBooking={handleBooking}
            onCardClick={(id) => navigate(`/restaurant/${id}`)}
          />

          {/* 2. Deals / Promotions collection */}
          <CollectionRow
            title="Khuyến mãi Ngập tràn"
            subtitle="Ưu đãi độc quyền cực hấp dẫn khi đặt bàn qua TableNow"
            icon="🎁"
            data={promoList}
            onViewAll={() => {
              setShowPromoOnly(true);
              document.getElementById('restaurant-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onBooking={handleBooking}
            onCardClick={(id) => navigate(`/restaurant/${id}`)}
          />

          {/* 3. Buffet collection */}
          <CollectionRow
            title="Thiên đường Buffet"
            subtitle="Thỏa thích ăn ngon không giới hạn cùng bạn bè và gia đình"
            icon="🍱"
            data={buffetList}
            onViewAll={() => handleFilterChange({ ...defaultFilters, cuisineType: 'buffet' })}
            onBooking={handleBooking}
            onCardClick={(id) => navigate(`/restaurant/${id}`)}
          />

          {/* 4. Vietnamese cuisine collection */}
          <CollectionRow
            title="Tinh hoa Ẩm thực Việt"
            subtitle="Hương vị quê hương đậm đà, thân thương đầy cảm xúc"
            icon="🍜"
            data={vietnameseList}
            onViewAll={() => handleFilterChange({ ...defaultFilters, cuisineType: 'vietnamese' })}
            onBooking={handleBooking}
            onCardClick={(id) => navigate(`/restaurant/${id}`)}
          />
        </div>
      ) : (
        <RestaurantList
          restaurants={displayedRestaurants}
          isLoading={false}
          error={null}
          onRetry={handleRetry}
          onBooking={handleBooking}
        />
      )}
    </div>
  );
};

export default HomePage;