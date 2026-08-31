import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { citiesList } from "../../data/Location";
import { useLocation } from "../../hooks/useLocation";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { RESTAURANT_CATEGORIES } from "../../utils/category";
import { toast } from "sonner";
import { ImagePlus, Images, Trash2 } from "lucide-react";

type Application = {
  id: number;
  name: string;
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
};

type PartnerForm = {
  name: string;
  website_url: string;
  address: string;
  district: string;
  city: string;
  category: string[];
  image_url: string;
  image_urls: string[];
  business_license_urls: string[];
  tax_code: string;
  legal_documents_urls: string[];
  capacity: number;
  policy_accepted: boolean;
};

const initialForm: PartnerForm = {
  name: "",
  website_url: "",
  address: "",
  district: "",
  city: "",
  category: [],
  image_url: "",
  image_urls: [],
  business_license_urls: [],
  tax_code: "",
  legal_documents_urls: [],
  capacity: 20,
  policy_accepted: false,
};

export default function PartnerProfile() {
  const { city: contextCity, getDistricts, setCity, setDistrict } = useLocation();
  const [form, setForm] = useState<PartnerForm>(initialForm);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<
    | "image_url"
    | "image_urls"
    | "business_license_urls"
    | "legal_documents_urls"
    | null
  >(null);

  const applicationQ = useQuery<Application | null>({
    queryKey: ["partner-application"],
    queryFn: () => api.get("/v1/partners/application/me").then((response) => response.data),
  });

  const getErrorMessage = (error: unknown) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      return (
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || "Không thể gửi hồ sơ."
      );
    }

    return "Không thể gửi hồ sơ.";
  };

  const submit = useMutation({
    mutationFn: () => api.post("/v1/partners/application", form),
    onSuccess: () => {
      toast.success("Hồ sơ đã được gửi để TableNow xét duyệt.");
      void applicationQ.refetch();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  });

  const set = (key: keyof PartnerForm, value: string | number | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCityChange = (city: string) => {
    setCity(city);
    setForm((current) => ({ ...current, city, district: "", address: "" }));
  };

  const handleDistrictChange = (district: string) => {
    setDistrict(district);
    setForm((current) => ({ ...current, district, address: "" }));
  };

  const toggleCategory = (category: string) => {
    setForm((current) => ({
      ...current,
      category: current.category.includes(category)
        ? current.category.filter((item) => item !== category)
        : [...current.category, category],
    }));
  };

  const uploadDocumentImages = async (
    key: "business_license_urls" | "legal_documents_urls",
    files: FileList | null,
  ) => {
    if (!files?.length) {
      return;
    }

    try {
      setUploadingField(key);
      const imageUrls = await Promise.all([...files].map(uploadImage));
      setForm((current) => ({
        ...current,
        [key]: [...current[key], ...imageUrls],
      }));
      toast.success(`Đã tải lên ${imageUrls.length} ảnh.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh thất bại.");
    } finally {
      setUploadingField(null);
    }
  };

  const uploadRestaurantImages = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    try {
      setUploadingField("image_urls");
      const imageUrls = await Promise.all([...files].map(uploadImage));
      setForm((current) => ({
        ...current,
        image_urls: [...current.image_urls, ...imageUrls],
      }));
      toast.success(`Đã tải lên ${imageUrls.length} ảnh nhà hàng.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh thất bại.");
    } finally {
      setUploadingField(null);
    }
  };

  const uploadCoverImage = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      setUploadingField("image_url");
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, image_url: imageUrl }));
      toast.success("Đã tải ảnh đại diện nhà hàng.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh thất bại.");
    } finally {
      setUploadingField(null);
    }
  };

  const removeRestaurantImage = (index: number) => {
    setForm((current) => ({
      ...current,
      image_urls: current.image_urls.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const removeDocumentImage = (
    key: "business_license_urls" | "legal_documents_urls",
    index: number,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  if (applicationQ.isLoading) {
    return <p className="text-sm text-gray-400">Đang tải hồ sơ đối tác...</p>;
  }

  const app = applicationQ.data;

  if (app) {
    return (
      <div className="max-w-3xl space-y-5">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Hồ sơ đối tác
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{app.name}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Trạng thái: {" "}
            <strong>
              {app.approval_status === "approved"
                ? "Đã được duyệt"
                : app.approval_status === "rejected"
                  ? "Cần bổ sung hồ sơ"
                  : "Đang chờ xét duyệt"}
            </strong>
          </p>
          {app.approval_status !== "approved" && (
            <p className="mt-3 text-sm text-gray-500">
              Bạn sẽ nhận được thông báo sau khi TableNow hoàn tất xét duyệt. Nhà hàng chưa hiển thị với khách.
            </p>
          )}
        </div>
      </div>
    );
  }

  const field = (
    key: "name" | "website_url" | "address" | "tax_code",
    label: string,
  ) => (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        required={key !== "website_url"}
        disabled={key === "address" && !form.district}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
        placeholder={key === "address" && !form.district ? "Chọn quận / huyện trước" : undefined}
        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none"
      />
    </label>
  );

  const locationField = (key: "district" | "city", label: string) => {
    const listId = `partner-${key}-options`;
    const options = key === "city"
      ? citiesList
      : form.city === contextCity ? getDistricts() : [];

    return (
      <label className="text-sm font-medium text-gray-700">
        {label}
        <input
          required
          disabled={key === "district" && !form.city}
          list={listId}
          value={form[key]}
          onChange={(event) => {
            if (key === "city") {
              handleCityChange(event.target.value);
              return;
            }

            handleDistrictChange(event.target.value);
          }}
          placeholder={key === "city" ? "Chọn hoặc nhập thành phố" : "Chọn hoặc nhập quận / huyện"}
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none"
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>
    );
  };

  const documentImagesUpload = (
    key: "business_license_urls" | "legal_documents_urls",
    label: string,
    required: boolean,
  ) => (
    <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-xs text-gray-500">Chọn nhiều ảnh cùng lúc từ máy tính (JPG, PNG, WEBP hoặc GIF).</p>
      <input
        id={`partner-${key}`}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        required={required && form[key].length === 0}
        onChange={(event) => void uploadDocumentImages(key, event.target.files)}
        className="sr-only"
      />
      <label
        htmlFor={`partner-${key}`}
        className="mt-3 inline-flex cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white"
      >
        {uploadingField === key ? "Đang tải ảnh..." : "Chọn nhiều ảnh từ máy"}
      </label>
      {form[key].length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {form[key].map((url, index) => (
            <div key={url} className="relative overflow-hidden rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setPreviewImage(url)}
                className="block w-full cursor-zoom-in"
                aria-label={`Xem chi tiết ${label.toLowerCase()} ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`${label} ${index + 1}`}
                  className="h-24 w-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => removeDocumentImage(key, index)}
                className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const restaurantImagesUpload = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
            <Images size={18} />
          </span>
          <p className="text-sm font-bold text-gray-800">Hình ảnh nhà hàng</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {form.image_urls.length} ảnh
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Chọn nhiều ảnh cùng lúc từ máy tính để giới thiệu không gian và trải nghiệm tại nhà hàng.
      </p>
      <input
        id="partner-restaurant-images"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => void uploadRestaurantImages(event.target.files)}
        className="sr-only"
      />
      <label
        htmlFor="partner-restaurant-images"
        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-gray-800"
      >
        <ImagePlus size={16} />
        {uploadingField === "image_urls" ? "Đang tải ảnh..." : "Chọn nhiều ảnh từ máy"}
      </label>
      {form.image_urls.length > 0 && (
        <div className="mt-5 grid auto-rows-[112px] grid-cols-2 gap-3 sm:grid-cols-4">
          {form.image_urls.map((url, index) => (
            <div
              key={url}
              className={`group relative overflow-hidden rounded-xl bg-gray-100 shadow-sm ${
                index === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
              }`}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(url)}
                className="block h-full w-full cursor-zoom-in"
                aria-label={`Xem chi tiết hình ảnh nhà hàng ${index + 1}`}
              >
                <img
                  src={url}
                  alt={`Hình ảnh nhà hàng ${index + 1}`}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-7">
                <span className="text-xs font-semibold text-white">
                  {index === 0 ? "Ảnh nổi bật" : `Ảnh ${index + 1}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeRestaurantImage(index)}
                className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/70 px-2 py-1.5 text-xs font-bold text-white transition hover:bg-red-600"
              >
                <Trash2 size={14} />
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const coverImageUpload = () => (
    <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 p-4 sm:col-span-2">
      <p className="text-sm font-semibold text-gray-700">Ảnh đại diện nhà hàng</p>
      <p className="mt-1 text-xs text-gray-500">
        Ảnh này hiển thị trên thẻ nhà hàng và kết quả tìm kiếm, tách biệt với thư viện ảnh bên dưới.
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        Tỷ lệ đề xuất <strong>5:3</strong> — khoảng <strong>1500 × 900 px</strong>
        (tối thiểu 1200 × 720 px). Hãy dùng ảnh ngang và đặt chủ thể ở vùng trung tâm;
        ảnh dọc hoặc vuông có thể bị cắt khi hiển thị.
      </p>
      <input
        id="partner-restaurant-cover"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required={!form.image_url}
        onChange={(event) => void uploadCoverImage(event.target.files?.[0])}
        className="sr-only"
      />
      <label
        htmlFor="partner-restaurant-cover"
        className="mt-3 inline-flex cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white"
      >
        {uploadingField === "image_url" ? "Đang tải ảnh..." : "Chọn ảnh đại diện từ máy"}
      </label>
      {form.image_url && (
        <button
          type="button"
          onClick={() => setPreviewImage(form.image_url)}
          className="mt-4 block w-full cursor-zoom-in"
          aria-label="Xem chi tiết ảnh đại diện nhà hàng"
        >
          <img
            src={form.image_url}
            alt="Ảnh đại diện nhà hàng"
            className="aspect-[5/3] w-full rounded-lg object-cover sm:max-w-sm"
          />
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Đăng ký đối tác TableNow</h1>
        <p className="mt-1 text-sm text-gray-500">
          Hoàn thiện hồ sơ pháp lý để đưa nhà hàng của bạn lên TableNow.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
        className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("name", "Tên nhà hàng")}
          {field("website_url", "Website chính thức của nhà hàng (không bắt buộc)")}
          {locationField("city", "Thành phố")}
          {locationField("district", "Quận / huyện")}
          {field("address", "Địa chỉ")}
          {field("tax_code", "Mã số thuế")}
        </div>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Danh mục nhà hàng</h2>
            <span className="text-xs text-gray-500">Có thể chọn nhiều danh mục</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {RESTAURANT_CATEGORIES.map((category) => {
              const isSelected = form.category.includes(category.slug);

              return (
                <label
                  key={category.slug}
                  className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-medium transition ${
                    isSelected
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-red-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(category.slug)}
                    className="sr-only"
                  />
                  {category.label}
                </label>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {coverImageUpload()}
          {restaurantImagesUpload()}
          {documentImagesUpload("business_license_urls", "Ảnh giấy phép kinh doanh", true)}
          {documentImagesUpload("legal_documents_urls", "Ảnh tài liệu pháp lý khác (nếu có)", false)}
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Sức chứa tối đa
          <input
            required
            min="1"
            type="number"
            value={form.capacity}
            onChange={(event) => set("capacity", Number(event.target.value))}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-gray-700">
          <input
            required
            type="checkbox"
            checked={form.policy_accepted}
            onChange={(event) => set("policy_accepted", event.target.checked)}
          />
          <span>
            Tôi xác nhận thông tin là chính xác và đồng ý với {" "}
            <Link to="/partner/policy" className="font-bold text-red-700 underline">
              chính sách đối tác TableNow
            </Link>
            .
          </span>
        </label>

        <button
          disabled={submit.isPending || uploadingField !== null}
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {submit.isPending ? "Đang gửi..." : "Gửi hồ sơ xét duyệt"}
        </button>
      </form>

      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem chi tiết hình ảnh nhà hàng"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[90vh] max-w-5xl"
          >
            <img
              src={previewImage}
              alt="Hình ảnh nhà hàng chi tiết"
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
