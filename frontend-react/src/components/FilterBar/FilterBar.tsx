import React, { useState } from 'react';
import styles from './FilterBar.module.css';
import { priceRanges, districts } from '../../data/restaurants';
import type { FilterOptions } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  resultCount: number;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange, resultCount }) => {
  const { cuisines } = useAuth();
  
  const updateFilter = (key: keyof FilterOptions, value: string | number) => {
    onFilterChange({ ...filters, [key]: value });
  };


  const hasActiveFilters = filters.cuisineType !== 'all' || filters.priceRange !== 'all' ||
    filters.area !== 'Tất cả' || filters.rating > 0 || !!filters.query;

  const clearFilters = () => {
    onFilterChange({ cuisineType: 'all', priceRange: 'all', area: 'Tất cả', rating: 0, query: '' });
  };

  return (
    <div id="restaurant-section" className={styles.filterBar}>
      {/* Cuisine chips */}
      <div className={styles.cuisineRow}>
        {cuisines.map((c) => (
          <button
            key={c.id}
            className={`${styles.chip} ${filters.cuisineType === c.id ? styles.chipActive : ''}`}
            onClick={() => updateFilter('cuisineType', c.id)}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>


      {/* Filters row */}
      <div className={styles.filtersRow}>
        <div className={styles.filtersLeft}>
          <select
            value={filters.priceRange}
            onChange={(e) => updateFilter('priceRange', e.target.value)}
            className={styles.filterSelect}
          >
            {priceRanges.map((p) => (
              <option key={p.id} value={p.id}>💰 {p.label}</option>
            ))}
          </select>

          <select
            value={filters.area}
            onChange={(e) => updateFilter('area', e.target.value)}
            className={styles.filterSelect}
          >
            {districts.map((d) => (
              <option key={d} value={d}>📍 {d}</option>
            ))}
          </select>

          <button
            className={`${styles.ratingBtn} ${filters.rating >= 4 ? styles.ratingActive : ''}`}
            onClick={() => updateFilter('rating', filters.rating >= 4 ? 0 : 4)}
          >
            ⭐ 4.0+
          </button>

          {hasActiveFilters && (
            <button className={styles.clearBtn} onClick={clearFilters}>✕ Xoá bộ lọc</button>
          )}
        </div>

        <span className={styles.resultCount}><strong>{resultCount}</strong> nhà hàng</span>
      </div>
    </div>
  );
};

export default FilterBar;