export const RESTAURANT_CATEGORIES = [
  { slug: "lau", label: "Lẩu" },
  { slug: "nuong", label: "Nướng" },
  { slug: "buffet", label: "Buffet" },
  { slug: "hai-san", label: "Hải sản" },
  { slug: "mon-viet", label: "Món Việt" },
  { slug: "mon-nhat", label: "Món Nhật" },
  { slug: "mon-han", label: "Món Hàn" },
  { slug: "mon-au", label: "Món Âu" },
  { slug: "mon-thai", label: "Món Thái" },
  { slug: "mon-trung", label: "Món Trung" },
  { slug: "pizza", label: "Pizza" },
  { slug: "steak", label: "Steak" },
  { slug: "dac-san", label: "Đặc sản" },
  { slug: "mon-chay", label: "Món chay" },
];

const categoryLabels = new Map(
  RESTAURANT_CATEGORIES.map((category) => [category.slug, category.label]),
);

const suitableForLabels = new Map([
  ["tiec-hoi-nghi", "Tiệc / Hội nghị"],
  ["gia-dinh", "Gia đình"],
  ["hien-dai", "Hiện đại"],
  ["truyen-thong", "Truyền thống"],
  ["sang-trong", "Sang trọng"],
  ["co-dien", "Cổ điển"],
  ["thien-nhien", "Thiên nhiên"],
  ["hen-ho", "Hẹn hò"],
  ["sinh-nhat", "Sinh nhật"],
  ["ban-be", "Bạn bè"],
]);

const serviceTypeLabels = new Map([
  ["phuc-vu-tai-ban", "Phục vụ tại bàn"],
  ["tu-phuc-vu", "Tự phục vụ"],
  ["quay-line", "Quầy line"],
  ["bang-chuyen", "Băng chuyền"],
  ["omakase", "Omakase"],
]);

export function getCategoryLabel(category?: string | null): string {
  if (!category) {
    return "Khác";
  }

  return categoryLabels.get(category) ?? category;
}

export function getCategoryLabels(categories?: string[] | null): string {
  return categories?.length
    ? categories.map(getCategoryLabel).join(", ")
    : "—";
}

function fallbackLabel(value: string): string {
  return value.replace(/-/g, " ");
}

export function getSuitableForLabel(value?: string | null): string {
  if (!value) {
    return "Khác";
  }

  return suitableForLabels.get(value) ?? fallbackLabel(value);
}

export function getServiceTypeLabel(value?: string | null): string {
  if (!value) {
    return "Khác";
  }

  return serviceTypeLabels.get(value) ?? fallbackLabel(value);
}
