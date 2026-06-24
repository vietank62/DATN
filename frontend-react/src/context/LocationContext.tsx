import { createContext, useContext, useState, type ReactNode } from 'react';

type LocationState = {
  city: string;
  district: string;
  setCity: (city: string) => void;
  setDistrict: (district: string) => void;
  getDistricts: () => string[];
};



const LocationContext = createContext<LocationState | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [city, setCity] = useState("Hồ Chí Minh");
  const [district, setDistrict] = useState("Khu vực");

  const handleSetCity = (newCity: string) => {
    setCity(newCity);
    setDistrict("Khu vực");
  };

  const getDistricts = () => districtsMap[city] || [];

  return (
    <LocationContext.Provider value={{ city, district, setCity: handleSetCity, setDistrict, getDistricts }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within a LocationProvider');
  return context;
};
