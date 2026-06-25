export interface DistrictsMap {
  [city: string]: string[];
}

export const districtsMap: DistrictsMap = {
  "Hồ Chí Minh": [
    "Quận 1",
    "Quận 3",
    "Quận 4",
    "Quận 5",
    "Quận 6",
    "Quận 7",
    "Quận 8",
    "Quận 10",
    "Quận 11",
    "Quận 12",
    "Quận Bình Tân",
    "Quận Bình Thạnh",
    "Quận Gò Vấp",
    "Quận Phú Nhuận",
    "Quận Tân Bình",
    "Quận Tân Phú",
    "Thành phố Thủ Đức",
    "Huyện Bình Chánh",
    "Huyện Cần Giờ",
    "Huyện Củ Chi",
    "Huyện Hóc Môn",
    "Huyện Nhà Bè"
  ],
  "Hà Nội": [
    "Quận Ba Đình",
    "Quận Bắc Từ Liêm",
    "Quận Cầu Giấy",
    "Quận Đống Đa",
    "Quận Hà Đông",
    "Quận Hai Bà Trưng",
    "Quận Hoàn Kiếm",
    "Quận Hoàng Mai",
    "Quận Long Biên",
    "Quận Nam Từ Liêm",
    "Quận Tây Hồ",
    "Quận Thanh Xuân",
    "Thị xã Sơn Tây",
    "Huyện Ba Vì",
    "Huyện Chương Mỹ",
    "Huyện Đan Phượng",
    "Huyện Đông Anh",
    "Huyện Gia Lâm",
    "Huyện Hoài Đức",
    "Huyện Mê Linh",
    "Huyện Mỹ Đức",
    "Huyện Phú Xuyên",
    "Huyện Phúc Thọ",
    "Huyện Quốc Oai",
    "Huyện Sóc Sơn",
    "Huyện Thạch Thất",
    "Huyện Thanh Oai",
    "Huyện Thanh Trì",
    "Huyện Thường Tín",
    "Huyện Ứng Hòa"
  ],
  "Đà Nẵng": [
    "Quận Cẩm Lệ",
    "Quận Hải Châu",
    "Quận Liên Chiểu",
    "Quận Ngũ Hành Sơn",
    "Quận Sơn Trà",
    "Quận Thanh Khê",
    "Huyện Hòa Vang",
    "Huyện Hoàng Sa"
  ],
};

export const citiesList = Object.keys(districtsMap);