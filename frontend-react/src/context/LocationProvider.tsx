import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { districtsMap } from '../data/Location';
import  { LocationContext } from './LocationContext';

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [city, setCity] = useState("Hồ Chí Minh");
  const [district, setDistrict] = useState("Khu vực");

  const handleSetCity = useCallback((newCity: string) => {
    setCity(newCity);
    setDistrict("Khu vực");
  }, []);

  const districts = useMemo(() => districtsMap[city] || [], [city]);

  const getDistricts = useCallback(() => districts, [districts]);

  const contextValue = useMemo(() => ({
    city,
    district,
    setCity: handleSetCity,
    setDistrict,
    districts,
    getDistricts
  }), [city, district, districts, handleSetCity, getDistricts]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};
