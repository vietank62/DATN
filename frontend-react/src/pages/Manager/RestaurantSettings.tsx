import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import axios from "axios";
import { toast } from "sonner";
import { citiesList } from "../../data/Location";
import { useLocation } from "../../hooks/useLocation";
import { uploadImage } from "../../services/upload";
import {
  Baby,
  Bike,
  Car,
  CigaretteOff,
  CircleDollarSign,
  CreditCard,
  DoorOpen,
  FileText,
  ImagePlus,
  Images,
  Mic,
  Puzzle,
  Receipt,
  Snowflake,
  Sparkles,
  TreePine,
  Trophy,
  Trash2,
  Tv,
  UserRound,
  Video,
  Volume2,
  Wifi,
  type LucideIcon,
} from "lucide-react";

type Restaurant = {
  id: number;
  name: string;
  address: string;
  district: string;
  city: string;
  image_url?: string;
  business_license_url?: string;
  tax_code?: string;
  capacity: number;
  price_avg?: number;
  booking_opening_time?: string;
  booking_closing_time?: string;
};

type RestaurantDetailContent = {
  image_urls?: string[];
  price_range?: string;
  description?: string;
  parking_info?: string;
  regulations?: string;
  utilities?: number[];
};
const approvalFields = [
  "name",
  "address",
  "district",
  "city",
  "tax_code",
  "image_url",
  "business_license_url",
] as const;

const quickBookingTimes = ["09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const utilityOptions: Array<{ id: number; label: string; Icon: LucideIcon }> = [
  { id: 1, label: "Máy chiếu", Icon: Video },
  { id: 2, label: "Âm thanh", Icon: Volume2 },
  { id: 3, label: "Ghế trẻ em", Icon: Baby },
  { id: 4, label: "Khu hút thuốc", Icon: CigaretteOff },
  { id: 5, label: "Đỗ ô tô", Icon: Car },
  { id: 6, label: "Đỗ xe máy", Icon: Bike },
  { id: 7, label: "Phòng riêng", Icon: DoorOpen },
  { id: 8, label: "Phòng VIP", Icon: Sparkles },
  { id: 9, label: "Karaoke", Icon: Mic },
  { id: 10, label: "Điều hòa", Icon: Snowflake },
  { id: 11, label: "Trang trí sự kiện", Icon: Sparkles },
  { id: 12, label: "Màn LED", Icon: Tv },
  { id: 13, label: "Visa / Master", Icon: CreditCard },
  { id: 14, label: "Hóa đơn VAT", Icon: Receipt },
  { id: 15, label: "Wifi", Icon: Wifi },
  { id: 16, label: "Hợp đồng trực tiếp", Icon: FileText },
  { id: 17, label: "MC dẫn chương trình", Icon: UserRound },
  { id: 18, label: "Bàn ngoài trời", Icon: TreePine },
  { id: 19, label: "Bóng đá K+", Icon: Trophy },
  { id: 20, label: "Momo / ZaloPay", Icon: CircleDollarSign },
  { id: 21, label: "Chỗ chơi trẻ em", Icon: Puzzle },
];

export default function RestaurantSettings() {
  const { city: contextCity, getDistricts, setCity, setDistrict } = useLocation();
  const qc = useQueryClient();
  const restaurantQ = useQuery<Restaurant>({
    queryKey: ["partner-application"],
    queryFn: () => api.get("/v1/partners/application/me").then((r) => r.data),
  });
  const galleryQ = useQuery<RestaurantDetailContent>({
    queryKey: ["partner-gallery", restaurantQ.data?.id],
    queryFn: () =>
      api.get(`/v1/details/${restaurantQ.data?.id}`).then((r) => r.data),
    enabled: !!restaurantQ.data?.id,
  });
  const [form, setForm] = useState<Partial<Restaurant>>({});
  const [gallery, setGallery] = useState<string[]>([]);
  const [detailForm, setDetailForm] = useState<RestaurantDetailContent>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (data: object) =>
      api.put("/v1/partners/application/me/operational", data),
    onSuccess: () => {
      toast.success("Đã lưu thay đổi.");
      qc.invalidateQueries({ queryKey: ["partner-application"] });
      qc.invalidateQueries({ queryKey: ["partner-gallery"] });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? "Không thể lưu thay đổi."
        : "Không thể lưu thay đổi.";
      toast.error(message);
    },
  });
  const uploadOne = async (
    key: "image_url" | "business_license_url",
    file?: File,
  ) => {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setForm((x) => ({ ...x, [key]: url }));
      toast.success("Đã tải ảnh lên Cloudinary.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    }
  };
  const uploadMany = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const urls = await Promise.all([...files].map(uploadImage));
      setGallery([...currentGallery, ...urls]);
      toast.success("Đã tải ảnh lên Cloudinary.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    }
  };
  if (restaurantQ.isLoading)
    return <p className="text-sm text-gray-400">Đang tải thông tin...</p>;
  if (!restaurantQ.data) {
    return (
      <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-gray-900">Chưa có hồ sơ nhà hàng</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Bạn cần hoàn tất hồ sơ nhà hàng trước khi thêm mô tả, bãi xe, quy định và tiện ích.
        </p>
        <a
          href="/manager/partner"
          className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          Hoàn tất hồ sơ nhà hàng
        </a>
      </div>
    );
  }
  const currentForm = { ...restaurantQ.data, ...form } as Partial<Restaurant>;
  const currentGallery = gallery.length
    ? gallery
    : (galleryQ.data?.image_urls ?? []);
  const currentDetail = { ...galleryQ.data, ...detailForm };

  const handleCityChange = (city: string) => {
    setCity(city);
    setForm((current) => ({ ...current, city, district: "", address: "" }));
  };

  const handleDistrictChange = (district: string) => {
    setDistrict(district);
    setForm((current) => ({ ...current, district, address: "" }));
  };

  const getTimeValue = (key: "booking_opening_time" | "booking_closing_time") =>
    String(currentForm[key] ?? "").slice(0, 5);

  const setTimeValue = (
    key: "booking_opening_time" | "booking_closing_time",
    value: string,
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveOperationalSettings = () => {
    const openingTime = getTimeValue("booking_opening_time");
    const closingTime = getTimeValue("booking_closing_time");

    if (openingTime && closingTime && openingTime >= closingTime) {
      toast.error("Giờ kết thúc nhận khách phải sau giờ bắt đầu.");
      return;
    }

    save.mutate({
      capacity: currentForm.capacity,
      booking_opening_time: openingTime || null,
      booking_closing_time: closingTime || null,
    });
  };

  const savePricing = () => {
    const priceAverage = Number(currentForm.price_avg ?? 0);

    if (!Number.isFinite(priceAverage) || priceAverage < 0) {
      toast.error("Chi tiêu trung bình phải là một số tiền hợp lệ.");
      return;
    }

    save.mutate({
      price_avg: Math.round(priceAverage),
      price_range: currentDetail.price_range?.trim() ?? "",
    });
  };

  const toggleUtility = (utilityId: number) => {
    setDetailForm((current) => {
      const utilities = current.utilities ?? currentDetail.utilities ?? [];

      return {
        ...current,
        utilities: utilities.includes(utilityId)
          ? utilities.filter((id) => id !== utilityId)
          : [...utilities, utilityId],
      };
    });
  };

  const text = (key: keyof Restaurant, label: string) => (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        value={String(currentForm[key] ?? "")}
        disabled={key === "address" && !currentForm.district}
        onChange={(e) =>
          setForm((x) => ({
            ...x,
            [key]: key === "capacity" ? Number(e.target.value) : e.target.value,
          }))
        }
        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm"
      />
    </label>
  );
  const locationText = (key: "city" | "district", label: string) => {
    const listId = `settings-${key}-options`;
    const selectedCity = String(currentForm.city ?? "");
    const options = key === "city"
      ? citiesList
      : selectedCity === contextCity ? getDistricts() : [];

    return (
      <label className="text-sm font-medium text-gray-700">
        {label}
        <input
          list={listId}
          disabled={key === "district" && !selectedCity}
          value={String(currentForm[key] ?? "")}
          onChange={(event) => {
            if (key === "city") {
              handleCityChange(event.target.value);
              return;
            }

            handleDistrictChange(event.target.value);
          }}
          placeholder={key === "city" ? "Chọn hoặc nhập thành phố" : "Chọn hoặc nhập quận / huyện"}
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm"
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>
    );
  };
  const timePicker = (
    key: "booking_opening_time" | "booking_closing_time",
    label: string,
    description: string,
  ) => {
    const value = getTimeValue(key);

    return (
      <label className="rounded-xl border border-gray-200 bg-slate-50 p-3 text-sm font-medium text-gray-700">
        <span>{label}</span>
        <input
          type="time"
          step="1800"
          value={value}
          onChange={(event) => setTimeValue(key, event.target.value)}
          className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <span className="mt-2 block text-xs font-normal leading-5 text-gray-500">{description}</span>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickBookingTimes.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setTimeValue(key, time)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                value === time
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-emerald-100"
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </label>
    );
  };
  const textArea = (
    key: "description" | "parking_info" | "regulations",
    label: string,
    placeholder: string,
  ) => (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <textarea
        rows={key === "description" ? 6 : 4}
        value={currentDetail[key] ?? ""}
        onChange={(event) =>
          setDetailForm((current) => ({
            ...current,
            [key]: event.target.value,
          }))
        }
        placeholder={placeholder}
        className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap outline-none focus:border-red-500 focus:bg-white"
      />
      <span className="mt-1 block text-xs font-normal text-gray-500">
        Các đoạn và dòng trống sẽ được giữ nguyên khi hiển thị cho khách hàng.
      </span>
    </label>
  );
  const uploadBox = (
    key: "image_url" | "business_license_url",
    label: string,
    id: string,
  ) => {
    const isCoverImage = key === "image_url";

    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm font-semibold text-gray-600">
      <p>{label}</p>
      {isCoverImage && (
        <p className="mt-1 text-xs font-normal leading-5 text-gray-500">
          Tỷ lệ đề xuất <strong>5:3</strong> — khoảng <strong>1500 × 900 px</strong>
          (tối thiểu 1200 × 720 px). Dùng ảnh ngang, đặt khu vực quan trọng ở giữa;
          ảnh dọc hoặc vuông có thể bị cắt khi hiển thị trên thẻ nhà hàng.
        </p>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={(e) => uploadOne(key, e.target.files?.[0])}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className="mt-3 inline-flex cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white"
      >
        Chọn tệp
      </label>
      {currentForm[key] && (
        <button
          type="button"
          onClick={() => setPreviewImage(String(currentForm[key]))}
          className="mt-3 block w-full cursor-zoom-in"
          aria-label={`Xem chi tiết ${label.toLowerCase()}`}
        >
          <img
            src={String(currentForm[key])}
            alt={label}
            className={
              isCoverImage
                ? "aspect-[5/3] w-full rounded-lg object-cover"
                : "h-24 w-full rounded-lg object-cover"
            }
          />
        </button>
      )}
      </div>
    );
  };
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chỉnh sửa thông tin nhà hàng</h1>
      </div>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-red-700">Thông tin cần xét duyệt lại</h2>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {text("name", "Tên nhà hàng")}
          {locationText("city", "Thành phố")}
          {locationText("district", "Quận / huyện")}
          {text("address", "Địa chỉ")}
          {text("tax_code", "Mã số thuế")}
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {uploadBox(
            "image_url",
            "Ảnh đại diện nhà hàng",
            "restaurant-cover-file",
          )}
          {uploadBox(
            "business_license_url",
            "Giấy phép kinh doanh",
            "business-license-file",
          )}
        </div>
        <button
          onClick={() =>
            save.mutate(
              Object.fromEntries(approvalFields.map((k) => [k, form[k]])),
            )
          }
          className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          Gửi thay đổi để xét duyệt
        </button>
      </section>
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                <Images size={19} />
              </span>
              <h2 className="font-bold text-gray-900">Thư viện ảnh nhà hàng</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Thêm ảnh không gian, món ăn và trải nghiệm thực tế để khách dễ hình dung hơn.
            </p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
            {currentGallery.length} ảnh
          </span>
        </div>
        <input
          id="restaurant-gallery-files"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => uploadMany(e.target.files)}
          className="sr-only"
        />
        <label
          htmlFor="restaurant-gallery-files"
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
        >
          <ImagePlus size={17} />
          Thêm ảnh từ máy
        </label>
        <div className="mt-5 grid auto-rows-[132px] grid-cols-2 gap-3 md:grid-cols-4">
          {currentGallery.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-slate-50 px-4 text-center text-sm text-gray-500">
              <Images size={28} className="mb-2 text-gray-400" />
              Nhà hàng chưa có ảnh nào. Hãy thêm những hình ảnh đẹp nhất của bạn.
            </div>
          )}
          {currentGallery.map((url, index) => (
            <div
              key={url}
              className={`group relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm ${
                index === 0
                  ? "col-span-2 row-span-2"
                  : "col-span-1 row-span-1"
              }`}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(url)}
                className="block h-full w-full cursor-zoom-in"
                aria-label={`Xem chi tiết ảnh nhà hàng ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`Ảnh nhà hàng ${index + 1}`}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8">
                <span className="text-xs font-semibold text-white">
                  {index === 0 ? "Ảnh nổi bật" : `Ảnh ${index + 1}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setGallery(
                    currentGallery.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-xs font-bold text-white opacity-100 transition hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
              >
                <Trash2 size={14} />
                Xóa
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => save.mutate({ image_urls: currentGallery })}
          disabled={save.isPending}
          className="mt-5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? "Đang lưu..." : "Lưu thay đổi thư viện"}
        </button>
      </section>
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-gray-900">Nội dung hiển thị cho khách hàng</h2>
        <p className="mt-2 text-sm text-gray-500">
          Nội dung được lưu dưới dạng văn bản, giữ nguyên ngắt dòng và dùng font thống nhất của TableNow.
        </p>
        <div className="mt-5 space-y-5">
          {textArea(
            "description",
            "Mô tả nhà hàng",
            "Giới thiệu không gian, phong cách ẩm thực và điểm nổi bật của nhà hàng...",
          )}
          {textArea(
            "parking_info",
            "Thông tin bãi xe",
            "Ví dụ: Có bãi xe máy miễn phí tại tầng hầm, xe ô tô gửi ở...",
          )}
          {textArea(
            "regulations",
            "Quy định nhà hàng",
            "Ví dụ: Giữ bàn 15 phút; vui lòng thông báo trước khi thay đổi số lượng khách...",
          )}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-800">Tiện ích nhà hàng</h3>
              <span className="text-xs text-gray-500">Có thể chọn nhiều tiện ích</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {utilityOptions.map(({ id, label, Icon }) => {
                const isSelected = (currentDetail.utilities ?? []).includes(id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleUtility(id)}
                    className={`flex min-h-20 items-center gap-2 rounded-xl border p-3 text-left text-xs font-semibold transition ${
                      isSelected
                        ? "border-red-600 bg-red-50 text-red-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-red-300"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            save.mutate({
              description: currentDetail.description ?? "",
              parking_info: currentDetail.parking_info ?? "",
              regulations: currentDetail.regulations ?? "",
              utilities: currentDetail.utilities ?? [],
            })
          }
          className="mt-5 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          Lưu nội dung hiển thị
        </button>
      </section>
      <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-amber-900">Mức giá hiển thị</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Chi tiêu trung bình dùng để lọc nhà hàng và hiển thị theo mỗi khách.
          Khoảng giá là mức giá tham khảo hiển thị ở trang chi tiết.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Chi tiêu trung bình / khách (VNĐ)
            <input
              type="number"
              min="0"
              step="1000"
              value={currentForm.price_avg ?? 0}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  price_avg: Number(event.target.value) || 0,
                }))
              }
              placeholder="Ví dụ: 250000"
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Khoảng giá tham khảo
            <input
              value={currentDetail.price_range ?? ""}
              onChange={(event) =>
                setDetailForm((current) => ({
                  ...current,
                  price_range: event.target.value,
                }))
              }
              placeholder="Ví dụ: 150.000đ - 450.000đ"
              maxLength={50}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={savePricing}
          disabled={save.isPending}
          className="mt-5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? "Đang lưu..." : "Lưu mức giá"}
        </button>
      </section>
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-emerald-700">Thông tin vận hành</h2>
        <p className="mt-2 text-sm text-gray-500">
          Đây là khung giờ nhà hàng nhận đặt bàn, không phải giờ mở cửa. Để trống một ô để dùng giờ mở/đóng cửa của nhà hàng.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {text("capacity", "Sức chứa")}
          {timePicker(
            "booking_opening_time",
            "Bắt đầu nhận khách",
            "Chọn giờ khách có thể bắt đầu đặt bàn.",
          )}
          {timePicker(
            "booking_closing_time",
            "Kết thúc nhận khách",
            "Đơn mới sẽ không nhận sau giờ này.",
          )}
        </div>
        <button
          onClick={saveOperationalSettings}
          className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          Lưu thông tin vận hành
        </button>
      </section>
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem chi tiết ảnh nhà hàng"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[90vh] max-w-5xl"
          >
            <img
              src={previewImage}
              alt="Ảnh nhà hàng chi tiết"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-sm font-bold text-white"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
