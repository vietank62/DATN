import { useRef, useState, useEffect } from "react";
import { useLocation } from "../../context/LocationContext";

export const SearchBar = () => {
  const { city, setCity } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const locations = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng"];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full py-3 bg-white">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
        
        {/* Custom Location Selector */}
        <div className="relative w-56 shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center w-full bg-gray-50 border transition-all duration-200 px-4 py-2.5 rounded-lg text-sm font-medium
              ${isOpen ? "border-red-400 ring-2 ring-red-50/50 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 transition-colors ${isOpen ? 'text-red-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-gray-700">{city}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-auto text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Custom Options Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-xl z-[60] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {locations.map((loc) => (
                <div
                  key={loc}
                  onClick={() => {
                    setCity(loc);
                    setIsOpen(false);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
                    ${city === loc ? "bg-red-50 text-red-600 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  {loc}
                  {city === loc && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-50/50 transition-all">
          <input
            type="text"
            placeholder="Bạn muốn đặt chỗ đến đâu?"
            className="flex-1 bg-transparent px-5 text-sm focus:outline-none text-gray-700 placeholder:text-gray-400"
          />
          <button className="bg-red-500 text-white px-8 py-2 flex items-center gap-2 hover:bg-red-600 active:scale-95 transition-all font-medium rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Tìm kiếm</span>
          </button>
        </div>

      </div>
    </div>
  );
};
