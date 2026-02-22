import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection/HeroSection';
import FilterBar from '../components/FilterBar/FilterBar';
import RestaurantList from '../components/RestaurantList/RestaurantList';
import { fetchRestaurants } from '../services/api';
import type { Restaurant, FilterOptions } from '../types';

const defaultFilters: FilterOptions = {
  cuisineType: 'all',
  priceRange: 'all',
  area: 'Tất cả',
  rating: 0,
};

const HomePage: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const navigate = useNavigate();

  const loadRestaurants = useCallback(async (currentFilters: FilterOptions) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRestaurants(currentFilters);
      setRestaurants(data);
    } catch (err) {
      setError('Không thể tải danh sách nhà hàng. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRestaurants(filters);
  }, [filters, loadRestaurants]);

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleRetry = () => {
    loadRestaurants(filters);
  };

  const handleSearch = (params: { location: string; date: string; time: string; guests: number }) => {
    setFilters((prev) => ({
      ...prev,
      area: params.location,
    }));
  };

  const handleBooking = (restaurantId: string) => {
    navigate(`/restaurant/${restaurantId}`);
  };

  return (
    <div>
      <HeroSection onSearch={handleSearch} />
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        resultCount={restaurants.length}
      />
      <RestaurantList
        restaurants={restaurants}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        onBooking={handleBooking}
      />
    </div>
  );
};

export default HomePage;