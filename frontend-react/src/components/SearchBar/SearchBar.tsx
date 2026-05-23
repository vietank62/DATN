import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchRestaurants } from '../../services/api';
import { Restaurant } from '../../types';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearch?: (results: Restaurant[]) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Tìm kiếm nhà hàng...'
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const data = await searchRestaurants(query);
        setResults(data);
        onSearch?.(data);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectRestaurant = (restaurant: Restaurant) => {
    navigate(`/restaurant/${restaurant.id}`);
    setQuery('');
    setShowResults(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      // Could implement full-page search results here
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.searchBox}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowResults(true)}
          placeholder={placeholder}
          className={styles.input}
        />
        {loading && <div className={styles.loading}>⟳</div>}
      </div>

      {showResults && query && (
        <div className={styles.dropdown}>
          {loading ? (
            <div className={styles.dropdownItem}>Đang tìm kiếm...</div>
          ) : results.length > 0 ? (
            <>
              {results.slice(0, 6).map((restaurant) => (
                <div
                  key={restaurant.id}
                  className={styles.dropdownItem}
                  onClick={() => handleSelectRestaurant(restaurant)}
                >
                  <div className={styles.itemImage}>
                    <img src={restaurant.imageUrl} alt={restaurant.name} />
                  </div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemName}>{restaurant.name}</div>
                    <div className={styles.itemLocation}>📍 {restaurant.district}</div>
                    <div className={styles.itemRating}>⭐ {restaurant.rating.toFixed(1)}</div>
                  </div>
                </div>
              ))}
              {results.length > 6 && (
                <div className={styles.showMore}>
                  Xem tất cả {results.length} kết quả
                </div>
              )}
            </>
          ) : (
            <div className={styles.dropdownItem}>Không tìm thấy nhà hàng</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;