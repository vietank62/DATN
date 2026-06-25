export interface LocationState {
  city: string;
  district: string;
  setCity: (city: string) => void;
  setDistrict: (district: string) => void;
  getDistricts: () => string[];
};
