import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom"; 
import { useLocation } from "../../hooks/useLocation";
import type { FilterState } from "../../types/search";

const PRICE_OPTIONS = [
  "Dưới 100k",
  "100k - 200k",
  "200k - 500k",
  "500k - 1.000k",
  "Trên 1.000k",
];

const CATEGORY_OPTIONS = [
  "Lẩu", "Nướng", "Buffet", "Hải sản",
  "Món Nhật", "Món Hàn", "Món Âu", "Món Thái",
  "Món Việt", "Món Trung", "Pizza",
  "Steak", "Đặc sản", "Món chay",
];

const SUITABLE_FOR_OPTIONS = [
  "Tiệc / Hội nghị", "Gia đình", "Hiện đại",
  "Truyền thống", "Sang trọng", "Cổ điển",
  "Thiên nhiên", "Hẹn hò", "Sinh nhật", "Bạn bè",
];

const ENDOW_OPTIONS = ["Độc quyền"];

const SERVICE_TYPE_OPTIONS = [
  "Phục vụ tại bàn", "Tự phục vụ",
  "Quầy line", "Băng chuyền", "Omakase",
];

const SPACE_OPTIONS = [
  "1-5 người", "6-10 người",
  "11-20 người", "21-50 người", "Trên 50 người",
];

type FilterKey = keyof FilterState;

const FILTER_OPTIONS: Record<FilterKey, string[]> = {
  district: [], 
  price: PRICE_OPTIONS,
  category: CATEGORY_OPTIONS,
  suitableFor: SUITABLE_FOR_OPTIONS,
  endow: ENDOW_OPTIONS,
  serviceType: SERVICE_TYPE_OPTIONS,
  space: SPACE_OPTIONS,
};

const LABEL_TO_KEY: Record<string, FilterKey> = {
  "Khu vực": "district",
  "Giá trung bình": "price",
  "Đồ ăn chính": "category",
  "Phù hợp": "suitableFor",
  "Ưu đãi": "endow",
  "Kiểu phục vụ": "serviceType",
  "Không gian riêng": "space",
};

const convertToSlug = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/([^a-z0-9\s/-])/g, "") 
    .replace(/[\s/]+/g, "-")      
    .replace(/-+/g, "-")          
    .trim();
};

interface DropdownProps {
  title: string;
  options: string[];
  selected: string;
  defaultLabel: string;
  onSelect: (value: string) => void;
  onReset: () => void;
}

const FilterDropdown = ({
  title,
  options,
  selected,
  defaultLabel,
  onSelect,
  onReset,
}: DropdownProps) => {
  const isActive = selected !== defaultLabel;

  return (
    <div className="absolute top-full left-0 mt-2 w-60 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200 overflow-visible">
      <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase bg-gray-50 border-b border-gray-100 mb-1">
        {title}
      </div>

      <div className="max-h-50 overflow-y-auto custom-scrollbar overscroll-contain py-1">
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
              ${selected === opt
                ? "bg-red-50 text-red-600 font-semibold"
                : "text-gray-600 hover:bg-red-50"
              }`}
          >
            {opt}
            {selected === opt && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {isActive && (
        <div
          onClick={onReset}
          className="border-t border-gray-100 mt-1 px-4 py-3 text-sm font-semibold text-center text-red-500 hover:bg-red-50 cursor-pointer"
        >
          Xóa lựa chọn
        </div>
      )}
    </div>
  );
};

export const FilterBar = () => {
  const navigate = useNavigate();
  const { city, district, setDistrict, getDistricts } = useLocation();
  const [activeDropdown, setActiveDropdown] = useState<FilterKey | null>(null);

  const [selected, setSelected] = useState<Omit<FilterState, "district">>({
    price: "",
    category: "",
    suitableFor: "",
    endow: "",
    serviceType: "",
    space: "",
  });

  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const filters = Object.keys(LABEL_TO_KEY) as string[];

  const getSelectedValue = (key: FilterKey): string => {
    if (key === "district") return district;
    return (selected as Record<string, string>)[key];
  };

  const handleSelect = (key: FilterKey, value: string) => {
    if (key === "district") {
      setDistrict(value);
    } else {
      setSelected((prev) => ({ ...prev, [key]: value }));
    }
    setActiveDropdown(null);
  };

  const handleReset = (key: FilterKey) => {
    if (key === "district") {
      setDistrict("Khu vực");
    } else {
      setSelected((prev) => ({ ...prev, [key]: "" }));
    }
    setActiveDropdown(null);
  };

  const getDisplayText = (label: string): string => {
    const key = LABEL_TO_KEY[label];
    const val = getSelectedValue(key);
    const defaultVal = key === "district" ? "Khu vực" : "";
    return val !== defaultVal ? val : label;
  };

  const isFilterActive = (label: string): boolean => {
    const key = LABEL_TO_KEY[label];
    const defaultVal = key === "district" ? "Khu vực" : "";
    return getSelectedValue(key) !== defaultVal;
  };

  const getOptions = (label: string): string[] => {
    const key = LABEL_TO_KEY[label];
    if (key === "district") return getDistricts();
    return FILTER_OPTIONS[key];
  };

  const handleMainFilterSubmit = () => {
    const params = new URLSearchParams();

    if (district && district !== "Khu vực") {
      params.append("district", district);
    }

    if (selected.price) {
      const priceIndex = PRICE_OPTIONS.indexOf(selected.price);
      if (priceIndex !== -1) {
        params.append("price", (priceIndex + 1).toString()); 
      }
    }

    if (selected.category) {
      params.append("category", convertToSlug(selected.category));
    }

    if (selected.suitableFor) {
      params.append("suitable_for", convertToSlug(selected.suitableFor));
    }

    if (selected.serviceType) {
      params.append("service_type", convertToSlug(selected.serviceType));
    }

    if (selected.endow === "Độc quyền") {
      params.append("has_exclusive", "true");
    }

    if (selected.space) {
      const spaceIndex = SPACE_OPTIONS.indexOf(selected.space);
      if (spaceIndex !== -1) {
        params.append("space_level", (spaceIndex + 1).toString()); 
      }
    }

    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full bg-white py-4 border-b border-gray-100 flex justify-center relative z-40 overflow-visible">
      <div
        className="max-w-7xl w-full px-10 flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-visible"
        ref={dropdownContainerRef}
      >
        <div className="flex flex-wrap flex-1 items-center gap-3 w-full justify-between">
          {filters.map((filterLabel) => {
            const key = LABEL_TO_KEY[filterLabel];
            const active = isFilterActive(filterLabel);
            const isOpen = activeDropdown === key;
            const displayText = getDisplayText(filterLabel);

            return (
              <div key={filterLabel} className="relative">
                <div
                  onClick={() => setActiveDropdown(isOpen ? null : key)}
                  className={`flex items-center justify-between border rounded-lg px-4 py-2 w-fit cursor-pointer transition-all group whitespace-nowrap
                    ${active
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 hover:border-red-400 hover:bg-red-50/30"
                    }`}
                >
                  <span
                    className={`text-xs md:text-sm font-medium transition-colors
                      ${active ? "text-red-600 font-bold" : "text-gray-700 group-hover:text-red-600"}`}
                  >
                    {displayText}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ml-2 transition-all
                      ${active ? "text-red-500" : "text-gray-400 group-hover:text-red-400"}
                      ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isOpen && (
                  <FilterDropdown
                    title={key === "district" ? `Khu vực tại ${city}` : filterLabel}
                    options={getOptions(filterLabel)}
                    selected={getSelectedValue(key)}
                    defaultLabel={key === "district" ? "Khu vực" : ""}
                    onSelect={(val) => handleSelect(key, val)}
                    onReset={() => handleReset(key)}
                  />
                )}
              </div>
            );
          })}
        </div>
        <button 
          onClick={handleMainFilterSubmit}
          className="flex items-center gap-2 border border-gray-200 rounded-lg px-5 py-2 hover:bg-gray-50 hover:border-red-500 transition-colors shrink-0 bg-white font-semibold text-gray-700 shadow-sm md:ml-4 z-10 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="text-sm">Lọc</span>
        </button>
      </div>
    </div>
  );
};