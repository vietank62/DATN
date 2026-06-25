import { useRef, useState, useEffect } from "react";
import { useLocation } from "../../hooks/useLocation";

// ── Types ──────────────────────────────────────────────────────────────────
type FilterState = {
  district: string;
  restaurant: string;
  price: string;
  category: string;
  suitableFor: string;
  endow: string;
  serviceType: string;
  space: string;
};

const DEFAULT_LABELS: FilterState = {
  district: "Khu vực",
  restaurant: "Nhà hàng",
  price: "Giá trung bình",
  category: "Đồ ăn chính",
  suitableFor: "Phù hợp",
  endow: "Ưu đãi",
  serviceType: "Kiểu phục vụ",
  space: "Không gian riêng",
};

// ── Option data ────────────────────────────────────────────────────────────
const RESTAURANT_OPTIONS = ["Nhà hàng"];

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
  "Món Việt", "Món Trung", "Món miền Bắc",
  "Món miền Trung", "Món miền Nam", "Món chay",
];

const SUITABLE_FOR_OPTIONS = [
  "Tiệc / Hội nghị", "Gia đình", "Hiện đại",
  "Truyền thống", "Sang trọng", "Cổ điển",
  "Thiên nhiên", "Hẹn hò", "Sinh nhật",
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

// ── Filter key → option list map ───────────────────────────────────────────
type FilterKey = keyof FilterState;

const FILTER_OPTIONS: Record<FilterKey, string[]> = {
  district: [], // populated from context
  restaurant: RESTAURANT_OPTIONS,
  price: PRICE_OPTIONS,
  category: CATEGORY_OPTIONS,
  suitableFor: SUITABLE_FOR_OPTIONS,
  endow: ENDOW_OPTIONS,
  serviceType: SERVICE_TYPE_OPTIONS,
  space: SPACE_OPTIONS,
};

// Map filter display label → state key
const LABEL_TO_KEY: Record<string, FilterKey> = {
  "Khu vực": "district",
  "Nhà hàng": "restaurant",
  "Giá trung bình": "price",
  "Đồ ăn chính": "category",
  "Phù hợp": "suitableFor",
  "Ưu đãi": "endow",
  "Kiểu phục vụ": "serviceType",
  "Không gian riêng": "space",
};

// ── Reusable Dropdown ──────────────────────────────────────────────────────
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
      {/* Header */}
      <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase bg-gray-50 border-b border-gray-100 mb-1">
        {title}
      </div>

      {/* Options */}
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

      {/* Reset */}
      {isActive && (
        <div
          onClick={onReset}
          className="border-t border-gray-100 mt-1 px-4 py-3 text-xs text-center text-red-500 hover:bg-red-50 cursor-pointer"
        >
          Xóa lựa chọn
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export const FilterBar = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { city, district, setDistrict, getDistricts } = useLocation();

  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState<FilterKey | null>(null);

  // Local state for every filter (except district which lives in context)
  const [selected, setSelected] = useState<Omit<FilterState, "district">>({
    restaurant: DEFAULT_LABELS.restaurant,
    price: DEFAULT_LABELS.price,
    category: DEFAULT_LABELS.category,
    suitableFor: DEFAULT_LABELS.suitableFor,
    endow: DEFAULT_LABELS.endow,
    serviceType: DEFAULT_LABELS.serviceType,
    space: DEFAULT_LABELS.space,
  });

  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
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
      setSelected((prev) => ({ ...prev, [key]: DEFAULT_LABELS[key] }));
    }
    setActiveDropdown(null);
  };

  const getDisplayText = (label: string): string => {
    const key = LABEL_TO_KEY[label];
    const val = getSelectedValue(key);
    return val !== DEFAULT_LABELS[key] ? val : label;
  };

  const isFilterActive = (label: string): boolean => {
    const key = LABEL_TO_KEY[label];
    return getSelectedValue(key) !== DEFAULT_LABELS[key];
  };

  const getOptions = (label: string): string[] => {
    const key = LABEL_TO_KEY[label];
    if (key === "district") return getDistricts();
    return FILTER_OPTIONS[key];
  };

  // ── Scroll logic ─────────────────────────────────────────────────────────
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const currentRef = scrollRef.current;
    if (currentRef) currentRef.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    const handleOutsideAction = (event: Event) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideAction);
    window.addEventListener("scroll", handleOutsideAction, true);

    return () => {
      if (currentRef) currentRef.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      document.removeEventListener("mousedown", handleOutsideAction);
      window.removeEventListener("scroll", handleOutsideAction, true);
    };
  }, []);

  const handleScroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: dir === "left" ? -300 : 300,
        behavior: "smooth",
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full bg-white py-4 border-b border-gray-100 flex justify-center relative z-40 overflow-visible">
      <div
        className="max-w-7xl w-full pl-20 pr-10 flex items-center gap-6 relative overflow-visible"
        ref={dropdownContainerRef}
      >
        {/* Smart Left Arrow */}
        {showLeft && (
          <button
            onClick={() => handleScroll("left")}
            className="absolute left-2 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg hover:text-red-500 hover:border-red-500 transition-all ml-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Scrollable filter tags */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex flex-1 items-center gap-3 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth pb-87 -mb-87 pt-4 -mt-4 pointer-events-none"
        >
          {filters.map((filterLabel) => {
            const key = LABEL_TO_KEY[filterLabel];
            const active = isFilterActive(filterLabel);
            const isOpen = activeDropdown === key;
            const displayText = getDisplayText(filterLabel);

            return (
              <div
                key={filterLabel}
                className="relative pointer-events-auto"
              >
                {/* Pill button */}
                <div
                  onClick={() => setActiveDropdown(isOpen ? null : key)}
                  className={`flex items-center justify-between border rounded-lg px-6 py-2 w-fit cursor-pointer transition-all group whitespace-nowrap
                    ${active
                      ? "border-red-500 bg-red-50 shadow-sm"
                      : "border-gray-200 hover:border-red-400 hover:bg-red-50/30"
                    }`}
                >
                  <span
                    className={`text-sm font-medium transition-colors
                      ${active
                        ? "text-red-600 font-bold"
                        : "text-gray-700 group-hover:text-red-600"
                      }`}
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

                {/* Dropdown */}
                {isOpen && (
                  <FilterDropdown
                    title={
                      key === "district"
                        ? `Khu vực tại ${city}`
                        : filterLabel
                    }
                    options={getOptions(filterLabel)}
                    selected={getSelectedValue(key)}
                    defaultLabel={DEFAULT_LABELS[key]}
                    onSelect={(val) => handleSelect(key, val)}
                    onReset={() => handleReset(key)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Smart Right Arrow */}
        {showRight && (
          <button
            onClick={() => handleScroll("right")}
            className="absolute right-37 z-50 p-2 bg-white border border-gray-200 rounded-full shadow-lg hover:text-red-500 hover:border-red-500 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Main Filter Button */}
        <button className="flex items-center gap-2 border border-gray-200 rounded-lg px-5 py-2 hover:bg-gray-50 transition-colors shrink-0 bg-white font-semibold text-gray-700 shadow-sm ml-12 z-10 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span className="text-sm">Lọc</span>
        </button>
      </div>
    </div>
  );
};
