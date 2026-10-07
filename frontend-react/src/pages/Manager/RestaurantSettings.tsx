import { useState } from "react";
import AddressGeocoding from "../../components/AddressGeocoding";
import { SERVICE_TYPE_OPTIONS, SUITABLE_FOR_OPTIONS } from "../../utils/category";
import ImageOrderControls from "../../components/ImageOrderControls";
import { moveImage } from "../../utils/moveImage";
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
  LocateFixed,
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
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string;
  business_license_url?: string;
  tax_code?: string;
  capacity: number;
  vat_enabled: boolean;
  menu_prices_visible?: boolean;
  price_avg?: number;
  service_types?: string[];
  suitable_for?: string[];
  booking_lead_minutes?: number;
  booking_confirmation_minutes?: number;
  booking_hold_minutes?: number;
  booking_opening_time?: string;
  booking_closing_time?: string;
  booking_duration_minutes?: number;
  approval_status: "pending" | "approved" | "rejected";
};

type RestaurantDetailContent = {
  phone_number?: string | null;
  zalo_number?: string | null;
  image_urls?: string[];
  price_range?: string;
  description?: string;
  parking_info?: string;
  regulations?: string;
  utilities?: number[];
  requires_deposit?: boolean;
  deposit_amount?: number;
  deposit_min_guests?: number;
};
const approvalFields = [
  "name",
  "address",
  "district",
  "city",
  "latitude",
  "longitude",
  "tax_code",
  "image_url",
  "business_license_url",
] as const;

const quickBookingTimes = [
  "09:00",
  "10:00",
  "11:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];
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
  const {
    city: contextCity,
    getDistricts,
    setCity,
    setDistrict,
  } = useLocation();
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
  const [priceInput, setPriceInput] = useState<string | null>(null);
  const [bookingLeadInput, setBookingLeadInput] = useState<string | null>(null);
  const [bookingConfirmationInput, setBookingConfirmationInput] = useState<string | null>(null);
  const [bookingHoldInput, setBookingHoldInput] = useState<string | null>(null);
  const [priceFromInput, setPriceFromInput] = useState<string | null>(null);
  const [priceToInput, setPriceToInput] = useState<string | null>(null);
  const [depositInput, setDepositInput] = useState<string | null>(null);
  const [depositGuestsInput, setDepositGuestsInput] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[] | null>(null);
  const [detailForm, setDetailForm] = useState<RestaurantDetailContent>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (data: object) =>
      api.put("/v1/partners/application/me/operational", data),
    onSuccess: () => {
      toast.success("Đã lưu thay đổi.");
      qc.invalidateQueries({ queryKey: ["partner-application"] });
      qc.invalidateQueries({ queryKey: ["partner-gallery"] });
      qc.invalidateQueries({ queryKey: ["cashier-restaurant-detail"] });
      qc.invalidateQueries({ queryKey: ["restaurant-base"] });
      qc.invalidateQueries({ queryKey: ["restaurant-detail"] });
    },
    onError: (error: unknown) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail ?? "Không thể lưu thay đổi.")
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    }
  };
  const uploadMany = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const urls = await Promise.all([...files].map(uploadImage));
      setGallery(current => [...(current ?? galleryQ.data?.image_urls ?? []), ...urls]);
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
        <h1 className="text-lg font-normal text-gray-900">
          Chưa có hồ sơ nhà hàng
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Bạn cần hoàn tất hồ sơ nhà hàng trước khi thêm mô tả, bãi xe, quy định
          và tiện ích.
        </p>
        <a
          href="/manager/partner"
          className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white"
        >
          Hoàn tất hồ sơ nhà hàng
        </a>
      </div>
    );
  }
  if (restaurantQ.data.approval_status !== "approved") {
    return (
      <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-gray-900">Chờ duyệt hồ sơ nhà hàng</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Bạn có thể bổ sung mô tả, hình ảnh giới thiệu và thông tin vận hành sau khi TableNow duyệt hồ sơ quan trọng ban đầu.
        </p>
        <a href="/manager/approval-status" className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white">
          Xem trạng thái xét duyệt
        </a>
      </div>
    );
  }

  const currentForm = { ...restaurantQ.data, ...form } as Partial<Restaurant>;
  const currentGallery = gallery ?? galleryQ.data?.image_urls ?? [];
  const currentDetail = { ...galleryQ.data, ...detailForm };
  const savedRange = currentDetail.price_range?.match(/\d[\d.,]*/g) ?? [];
  const priceFrom = priceFromInput ?? savedRange[0] ?? "";
  const priceTo = priceToInput ?? savedRange[1] ?? "";

  const saveContentField = (
    key: "description" | "parking_info" | "regulations",
  ) => {
    save.mutate({ [key]: currentDetail[key] ?? "" });
  };

  const saveUtilities = () => {
    save.mutate({ utilities: currentDetail.utilities ?? [] });
  };

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

    const rawLead = bookingLeadInput ?? String(currentForm.booking_lead_minutes ?? 120);
    const rawConfirmation = bookingConfirmationInput ?? String(currentForm.booking_confirmation_minutes ?? 60);
    const lead = Number(rawLead);
    if (!/^\d+$/.test(rawLead) || !Number.isInteger(lead) || lead < 1 || lead > 10080) {
      toast.error("Thời gian đặt trước phải từ 1 đến 10080 phút.");
      return;
    }
    const confirmation = Number(rawConfirmation);
    if (!/^\d+$/.test(rawConfirmation) || !Number.isInteger(confirmation) || confirmation < 0 || confirmation >= lead) {
      toast.error("Thời gian xác nhận phải không âm và nhỏ hơn thời gian đặt trước giờ dùng bữa.");
      return;
    }
    const rawHold = bookingHoldInput ?? String(currentForm.booking_hold_minutes ?? 30);
    const hold = Number(rawHold);
    if (!/^\d+$/.test(rawHold) || !Number.isInteger(hold) || hold < 1 || hold > 240) {
      toast.error("Thời gian giữ bàn phải từ 1 đến 240 phút.");
      return;
    }
    save.mutate({
      booking_hold_minutes: hold,
      booking_lead_minutes: lead,
      booking_confirmation_minutes: confirmation,
      booking_opening_time: openingTime || null,
      booking_closing_time: closingTime || null,
      booking_duration_minutes: Number(currentForm.booking_duration_minutes ?? 120),
    });
  };

  const savePricing = () => {
    const rawPrice = (priceInput ?? String(currentForm.price_avg ?? 0)).trim().replace(/\s/g, "");
    if (!rawPrice || !/^\d+$|^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(rawPrice)) {
      toast.error("Nhập số tiền nguyên, ví dụ 250000 hoặc 250.000.");
      return;
    }
    const priceAverage = Number(rawPrice.replace(/[.,]/g, ""));

    if (!Number.isSafeInteger(priceAverage) || priceAverage < 0 || priceAverage > 2147483647) {
      toast.error("Chi tiêu trung bình phải là một số tiền hợp lệ.");
      return;
    }

    let priceRange = currentDetail.price_range?.trim() ?? "";
    if (priceFromInput !== null || priceToInput !== null) {
      const from = priceFrom.trim().replace(/\s/g, "");
      const to = priceTo.trim().replace(/\s/g, "");
      const moneyPattern = /^\d+$|^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/;
      if (!from && !to) {
        priceRange = "";
      } else {
        const minimum = Number(from.replace(/[.,]/g, ""));
        const maximum = Number(to.replace(/[.,]/g, ""));
        if (!moneyPattern.test(from) || !moneyPattern.test(to) || !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum > 2147483647 || minimum > maximum) {
          toast.error("Nhập đủ giá từ và đến hợp lệ; giá từ không được lớn hơn giá đến.");
          return;
        }
        priceRange = `${minimum.toLocaleString("vi-VN")}đ - ${maximum.toLocaleString("vi-VN")}đ`;
      }
    }
    save.mutate({
      vat_enabled: currentForm.vat_enabled ?? true,
      price_avg: Math.round(priceAverage),
      price_range: priceRange,
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

  const saveCoordinates = () => {
    if (currentForm.latitude == null || currentForm.longitude == null) {
      toast.error("Vui lòng nhập đầy đủ vĩ độ và kinh độ.");
      return;
    }
    const latitude = Number(currentForm.latitude);
    const longitude = Number(currentForm.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      toast.error("Vui lòng nhập tọa độ hợp lệ.");
      return;
    }
    save.mutate({ latitude, longitude });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Thiết bị này không hỗ trợ xác định vị trí.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude })),
      () => toast.error("Không lấy được vị trí. Hãy kiểm tra quyền vị trí rồi thử lại."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const text = (key: keyof Restaurant, label: string) => (
    <label className="text-sm font-normal text-gray-700">
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
        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
      />
    </label>
  );
  const locationText = (key: "city" | "district", label: string) => {
    const listId = `settings-${key}-options`;
    const selectedCity = String(currentForm.city ?? "");
    const options =
      key === "city"
        ? citiesList
        : selectedCity === contextCity
          ? getDistricts()
          : [];

    return (
      <label className="text-sm font-normal text-gray-700">
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
          placeholder={
            key === "city"
              ? "Chọn hoặc nhập thành phố"
              : "Chọn hoặc nhập quận / huyện"
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
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
      <label className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-normal text-gray-700">
        <span className="block min-h-10 sm:min-h-6">{label}</span>
        <input
          type="time"
          step="1800"
          value={value}
          onChange={(event) => setTimeValue(key, event.target.value)}
          className="mt-2 h-12 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
        />
        <span className="mt-2 block text-xs font-normal leading-5 text-gray-500">
          {description}
        </span>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickBookingTimes.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setTimeValue(key, time)}
              className={`rounded-md px-2 py-1 text-xs font-normal transition ${
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
    <div>
      <label htmlFor={`restaurant-${key}`} className="block text-sm font-normal text-gray-700">
        {label}
      </label>
      <textarea
        id={`restaurant-${key}`}
        rows={key === "description" ? 6 : 4}
        value={currentDetail[key] ?? ""}
        onChange={(event) =>
          setDetailForm((current) => ({
            ...current,
            [key]: event.target.value,
          }))
        }
        placeholder={placeholder}
        className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap outline-none focus:border-red-500 focus:bg-white"
      />
      <span className="mt-1 block text-xs font-normal text-gray-500">
        Các đoạn và dòng trống sẽ được giữ nguyên khi hiển thị cho khách hàng.
      </span>
      <button
        type="button"
        onClick={() => saveContentField(key)}
        disabled={save.isPending}
        className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {save.isPending ? "Đang lưu..." : `Lưu ${label.toLowerCase()}`}
      </button>
    </div>
  );
  const uploadBox = (
    key: "image_url" | "business_license_url",
    label: string,
    id: string,
  ) => {
    const isCoverImage = key === "image_url";

    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm font-normal text-gray-600">
        <p>{label}</p>
        {isCoverImage && (
          <p className="mt-1 text-xs font-normal leading-5 text-gray-500">
            Tỷ lệ đề xuất <strong>5:3</strong> — khoảng{" "}
            <strong>1500 × 900 px</strong>
            (tối thiểu 1200 × 720 px). Dùng ảnh ngang, đặt khu vực quan trọng ở
            giữa; ảnh dọc hoặc vuông có thể bị cắt khi hiển thị trên thẻ nhà
            hàng.
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
          className="mt-3 inline-flex cursor-pointer rounded-lg border-2 border-red-600 bg-red-500 px-3 py-2 text-xs font-normal text-white shadow-sm transition hover:bg-red-600 focus-within:ring-4 focus-within:ring-red-200"
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
                  ? "aspect-square w-full rounded-lg object-cover"
                  : "aspect-square w-full rounded-lg object-cover"
              }
            />
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="restaurant-settings max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-normal">Chỉnh sửa thông tin nhà hàng</h1>
      </div>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-red-700">Thông tin nhà hàng</h2>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {text("name", "Tên nhà hàng")}
          {locationText("city", "Thành phố")}
          {locationText("district", "Quận / huyện")}
          {text("address", "Địa chỉ")}
          {text("tax_code", "Mã số thuế")}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="font-normal text-amber-950">Vị trí trên bản đồ</h3><p className="mt-1 text-xs leading-5 text-amber-800">Dùng vị trí hiện tại khi bạn đang ở nhà hàng, hoặc nhập tọa độ chính xác. Khách sẽ thấy nhà hàng trên bản đồ sau khi admin xét duyệt.</p></div>
            <button type="button" onClick={useCurrentLocation} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-normal text-amber-800 hover:bg-amber-100"><LocateFixed size={16} />Dùng vị trí hiện tại</button>
          </div>
          <AddressGeocoding address={currentForm.address ?? ""} district={currentForm.district ?? ""} city={currentForm.city ?? ""} onSelect={(latitude, longitude) => setForm(current => ({ ...current, latitude, longitude }))} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-normal text-gray-700">Vĩ độ<input type="number" step="any" value={currentForm.latitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="Ví dụ: 10.7769" className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
            <label className="text-sm font-normal text-gray-700">Kinh độ<input type="number" step="any" value={currentForm.longitude ?? ""} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value === "" ? null : Number(event.target.value) }))} placeholder="Ví dụ: 106.7009" className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm" /></label>
          </div>
          <button type="button" onClick={saveCoordinates} disabled={save.isPending} className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white hover:bg-red-700 disabled:opacity-60">{save.isPending ? "Đang lưu..." : "Gửi vị trí để xét duyệt"}</button>
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
          className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white"
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
              <h2 className="font-normal text-gray-900">Thư viện ảnh nhà hàng</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Thêm ảnh không gian, món ăn và trải nghiệm thực tế để khách dễ
              hình dung hơn.
            </p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1.5 text-xs font-normal text-gray-600">
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
          className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-red-600 bg-red-500 px-4 py-2.5 text-sm font-normal text-white shadow-sm transition hover:bg-red-600 focus-within:ring-4 focus-within:ring-red-200"
        >
          <ImagePlus size={17} />
          Thêm ảnh từ máy
        </label>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {currentGallery.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-gray-500">
              <Images size={28} className="mb-2 text-gray-400" />
              Nhà hàng chưa có ảnh nào. Hãy thêm những hình ảnh đẹp nhất của
              bạn.
            </div>
          )}
          {currentGallery.map((url, index) => (
            <div
              key={url}
              className={`group relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm ${
                "aspect-square"
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
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pb-2 pt-8">
                <span className="text-xs font-normal text-white">
                  {index === 0 ? "Ảnh nổi bật" : `Ảnh ${index + 1}`}
                </span>
              </div>
              <ImageOrderControls index={index} count={currentGallery.length} disabled={save.isPending} onMove={to => setGallery(current => moveImage(current ?? currentGallery, index, to))} />
              <button
                type="button"
                onClick={() =>
                  setGallery(
                    currentGallery.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  )
                }
                className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-xs font-normal text-white opacity-100 transition hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
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
          className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? "Đang lưu..." : "Lưu thay đổi thư viện"}
        </button>
      </section>
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-gray-900">
          Nội dung hiển thị cho khách hàng
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Nội dung được lưu dưới dạng văn bản, giữ nguyên ngắt dòng và dùng font
          thống nhất của TableNow.
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
              <h3 className="text-sm font-normal text-gray-800">
                Tiện ích nhà hàng
              </h3>
              <span className="text-xs text-gray-500">
                Có thể chọn nhiều tiện ích
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {utilityOptions.map(({ id, label, Icon }) => {
                const isSelected = (currentDetail.utilities ?? []).includes(id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleUtility(id)}
                    className={`flex min-h-20 items-center gap-2 rounded-xl border p-3 text-left text-xs font-normal transition ${
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
            <button
              type="button"
              onClick={saveUtilities}
              disabled={save.isPending}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {save.isPending ? "Đang lưu..." : "Lưu tiện ích"}
            </button>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-gray-900">Kiểu phục vụ và phù hợp với</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {([{ key: "service_types", title: "Kiểu phục vụ", options: SERVICE_TYPE_OPTIONS }, { key: "suitable_for", title: "Phù hợp với", options: SUITABLE_FOR_OPTIONS }] as const).map(group => (
            <fieldset key={group.key}>
              <legend className="text-sm text-gray-700">{group.title}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.options.map(option => {
                  const selected = currentForm[group.key] ?? [];
                  const active = selected.includes(option.value);
                  return <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${active ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-700"}`}>
                    <input type="checkbox" disabled={save.isPending} checked={active} onChange={event => setForm(current => ({ ...current, [group.key]: event.target.checked ? [...(current[group.key] ?? selected), option.value] : (current[group.key] ?? selected).filter(value => value !== option.value) }))} className="accent-red-600" />
                    {option.label}
                  </label>;
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" disabled={save.isPending} onClick={() => save.mutate({ service_types: currentForm.service_types ?? [], suitable_for: currentForm.suitable_for ?? [] })} className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white hover:bg-red-700 disabled:opacity-60">{save.isPending ? "Đang lưu..." : "Lưu kiểu phục vụ và đối tượng"}</button>
      </section>
      <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-amber-900">Mức giá hiển thị</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Chi tiêu trung bình dùng để lọc nhà hàng và hiển thị theo mỗi khách.
          Khoảng giá là mức giá tham khảo hiển thị ở trang chi tiết.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="self-end text-sm font-normal text-gray-700">
            Chi tiêu trung bình / khách (VNĐ)
            <input
              type="text"
              inputMode="numeric"
              value={priceInput ?? String(currentForm.price_avg ?? 0)}
              onChange={(event) => setPriceInput(event.target.value)}
              placeholder="Ví dụ: 250000"
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white"
            />
          </label>
          <fieldset className="text-sm font-normal text-gray-700">
            <legend>Khoảng giá tham khảo (VNĐ)</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <label className="block">Từ<input type="text" inputMode="numeric" value={priceFrom} onChange={event => setPriceFromInput(event.target.value)} placeholder="150.000" maxLength={20} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white" /></label>
              <label className="block">Đến<input type="text" inputMode="numeric" value={priceTo} onChange={event => setPriceToInput(event.target.value)} placeholder="450.000" maxLength={20} className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:bg-white" /></label>
            </div>
          </fieldset>
        </div>
        <button
          type="button"
          onClick={savePricing}
          disabled={save.isPending}
          className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? "Đang lưu..." : "Lưu mức giá"}
        </button>
      </section>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-red-900">Thông tin liên hệ</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>Hotline nhà hàng<input type="tel" maxLength={20} value={currentDetail.phone_number??""} onChange={e=>setDetailForm(x=>({...x,phone_number:e.target.value}))} className="mt-2 w-full rounded-xl border border-gray-200 p-3" /></label>
          <label>Số điện thoại Zalo<input type="tel" maxLength={20} value={currentDetail.zalo_number??""} onChange={e=>setDetailForm(x=>({...x,zalo_number:e.target.value}))} className="mt-2 w-full rounded-xl border border-gray-200 p-3" /></label>
        </div>
        <button disabled={save.isPending} onClick={()=>save.mutate({phone_number:currentDetail.phone_number?.trim()??"",zalo_number:currentDetail.zalo_number?.trim()??""})} className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-white hover:bg-red-700 disabled:opacity-60">Lưu thông tin liên hệ</button>
      </section>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-red-900">Hiển thị giá menu</h2>
        <label className="mt-4 flex items-center gap-3 text-gray-800">
          <input type="checkbox" className="h-5 w-5 accent-red-600" checked={currentForm.menu_prices_visible ?? true} onChange={e=>setForm(x=>({...x,menu_prices_visible:e.target.checked}))} />
          Hiển thị giá món ăn trên trang khách hàng
        </label>
        <button disabled={save.isPending} onClick={()=>save.mutate({menu_prices_visible:currentForm.menu_prices_visible ?? true})} className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-white hover:bg-red-700 disabled:opacity-60">Lưu hiển thị giá menu</button>
      </section>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-red-900">Thuế VAT</h2>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-normal text-gray-800">
          <input type="checkbox" className="h-5 w-5 accent-red-600" checked={currentForm.vat_enabled ?? true} onChange={e=>setForm(x=>({...x,vat_enabled:e.target.checked}))} />
          Tính VAT 8% trên hóa đơn
        </label>
        <button disabled={save.isPending} onClick={()=>save.mutate({vat_enabled:currentForm.vat_enabled ?? true})} className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white hover:bg-red-700 disabled:opacity-60">Lưu thiết lập VAT</button>
      </section>
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-emerald-700">Thông tin vận hành</h2>
        <div className="mt-5 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
          <label className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"><span className="block min-h-10">Đặt trước giờ dùng bữa (phút)</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={bookingLeadInput ?? String(currentForm.booking_lead_minutes ?? 120)} onChange={e=>{if(/^\d*$/.test(e.target.value))setBookingLeadInput(e.target.value);}} className="mt-2 h-12 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 outline-none focus:border-emerald-500" />
            <span className="mt-2 block text-xs leading-5 text-gray-500">Ví dụ: 60 phút nghĩa là khách phải đặt trước ít nhất 1 giờ.</span>
          </label>
          <label className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"><span className="block min-h-10">Xác nhận đặt bàn trước giờ dùng bữa (phút)</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={bookingConfirmationInput ?? String(currentForm.booking_confirmation_minutes ?? 60)} onChange={e=>{if(/^\d*$/.test(e.target.value))setBookingConfirmationInput(e.target.value);}} className="mt-2 h-12 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 outline-none focus:border-emerald-500" />
            <span className="mt-2 block text-xs leading-5 text-gray-500">Hạn phản hồi của nhà hàng và hạn khách được hủy đơn phương, không mất cọc.</span>
          </label>
          <label className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700"><span className="block min-h-10">Giữ bàn sau giờ đặt (phút)</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={bookingHoldInput ?? String(currentForm.booking_hold_minutes ?? 30)} onChange={e=>{if(/^\d*$/.test(e.target.value))setBookingHoldInput(e.target.value);}} className="mt-2 h-12 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 outline-none focus:border-emerald-500" />
            <span className="mt-2 block text-xs leading-5 text-gray-500">Hết hạn sẽ trả bàn nếu khách chưa được tiếp nhận. Không áp dụng cho khách đang dùng bữa.</span>
          </label>
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
          className="mt-5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-normal text-white"
        >
          Lưu thông tin vận hành
        </button>
      </section>
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="font-normal text-red-900">Đặt cọc khi đặt bàn</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Bật tính năng này nếu yêu cầu khách hàng thanh toán trước một khoản đặt cọc khi đặt bàn. Khoản đặt cọc sẽ được hoàn trả nếu khách hủy đặt bàn theo chính sách của nhà hàng.
        </p>
        <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-normal text-gray-800">
          <input
            type="checkbox"
            checked={Boolean(currentDetail.requires_deposit)}
            onChange={(event) =>
              setDetailForm((current) => ({
                ...current,
                requires_deposit: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-red-600"
          />
          Yêu cầu khách thanh toán đặt cọc
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-normal text-gray-700">
            Số tiền đặt cọc (VNĐ)
            <input
              type="text"
              inputMode="numeric"
              value={depositInput ?? String(currentDetail.deposit_amount ?? 0)}
              onChange={(event) => setDepositInput(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-red-500"
            />
          </label>
          <label className="text-sm font-normal text-gray-700">
            Áp dụng từ số khách
            <input
              type="text"
              inputMode="numeric"
              value={depositGuestsInput ?? String(currentDetail.deposit_min_guests ?? 1)}
              onChange={(event) => setDepositGuestsInput(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-red-500"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => {
            const rawAmount = (depositInput ?? String(currentDetail.deposit_amount ?? 0)).trim().replace(/\s/g, "");
            const rawGuests = (depositGuestsInput ?? String(currentDetail.deposit_min_guests ?? 1)).trim();
            const amount = Number(rawAmount.replace(/[.,]/g, ""));
            const guests = Number(rawGuests);
            if (!/^\d+$|^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount > 2147483647) {
              toast.error("Nhập số tiền đặt cọc hợp lệ, ví dụ 100000 hoặc 100.000.");
              return;
            }
            if (!/^\d+$/.test(rawGuests) || !Number.isSafeInteger(guests) || guests < 1 || guests > 2147483647) {
              toast.error("Số khách áp dụng phải là số nguyên từ 1 trở lên.");
              return;
            }
            if (currentDetail.requires_deposit && amount <= 0) {
              toast.error("Số tiền đặt cọc phải lớn hơn 0.");
              return;
            }
            save.mutate({
              requires_deposit: Boolean(currentDetail.requires_deposit),
              deposit_amount: Math.round(amount),
              deposit_min_guests: guests,
            });
          }}
          className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-normal text-white disabled:opacity-60"
        >
          {save.isPending ? "Đang lưu..." : "Lưu cấu hình đặt cọc"}
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
              className="absolute right-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-sm font-normal text-white"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
