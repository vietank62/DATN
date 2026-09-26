import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { citiesList } from "../../data/Location";
import { useLocation } from "../../hooks/useLocation";
import { api } from "../../services/api";
import { uploadImage } from "../../services/upload";
import { RESTAURANT_CATEGORIES } from "../../utils/category";
import { toast } from "sonner";

type Application = {
  id: number;
  name: string;
  address: string;
  district: string;
  city: string;
  category?: string[] | null;
  image_url?: string | null;
  business_license_urls?: string[] | null;
  tax_code?: string | null;
  capacity: number;
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

  useEffect(() => {
    const application = applicationQ.data;
    if (application?.approval_status !== "rejected") return;

    setForm({
      ...initialForm,
      name: application.name,
      address: application.address,
      district: application.district,
      city: application.city,
      category: application.category ?? [],
      image_url: application.image_url ?? "",
      business_license_urls: application.business_license_urls ?? [],
      tax_code: application.tax_code ?? "",
      capacity: application.capacity,
    });
    setCity(application.city);
    setDistrict(application.district);
  }, [applicationQ.data, setCity, setDistrict]);

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

  if (app && app.approval_status !== "rejected") {
    return (
      <div className="max-w-3xl space-y-5">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-7">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700">
            Hồ sơ đối tác
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{app.name}</h1>
          <p className="mt-2 text-sm text-gray-600">
            Trạng thái: {" "}
            <strong>
              {app.approval_status === "approved" ? "Đã được duyệt" : "Đang chờ xét duyệt"}
            </strong>
          </p>
          {app.approval_status !== "approved" && (
            <p className="mt-3 text-sm text-gray-500">
              Bạn sẽ nhận được thông báo sau khi TableNow hoàn tất xét duyệt. Khi hồ sơ được duyệt, hãy vào Cài đặt nhà hàng để bổ sung thông tin vận hành và nội dung giới thiệu. Nhà hàng chưa hiển thị với khách.
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
        className="mt-3 inline-flex cursor-pointer rounded-lg border-2 border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 focus-within:ring-4 focus-within:ring-red-200"
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

  const coverImageUpload = () => (
    <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 p-4 sm:col-span-2">
      <p className="text-sm font-semibold text-gray-700">Ảnh đại diện nhà hàng</p>
      <p className="mt-1 text-xs text-gray-500">
        Ảnh này hiển thị trên thẻ nhà hàng và kết quả tìm kiếm, tách biệt với thư viện ảnh bên dưới.
      </p>
      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
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
        className="mt-3 inline-flex cursor-pointer rounded-lg border-2 border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 focus-within:ring-4 focus-within:ring-red-200"
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
        {app?.approval_status === "rejected" && (
          <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Hồ sơ trước đó cần bổ sung. Hãy kiểm tra các thông tin quan trọng bên dưới rồi gửi lại để xét duyệt.
          </p>
        )}
        <p className="text-xs font-bold uppercase tracking-wide text-red-700">Bước 1 / 2 · Hồ sơ xét duyệt</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Thiết lập hồ sơ nhà hàng</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cung cấp đầy đủ thông tin pháp lý và nhận diện quan trọng để TableNow xét duyệt. Sau khi được duyệt, bạn có thể bổ sung mô tả, giờ hoạt động, tiện ích, thực đơn và hình ảnh giới thiệu.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.category.length === 0) {
            toast.error("Vui lòng chọn ít nhất một danh mục nhà hàng.");
            return;
          }
          if (!form.image_url) {
            toast.error("Vui lòng tải ảnh đại diện nhà hàng.");
            return;
          }
          if (form.business_license_urls.length === 0) {
            toast.error("Vui lòng tải ít nhất một ảnh giấy phép kinh doanh.");
            return;
          }
          submit.mutate();
        }}
        className="space-y-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("name", "Tên nhà hàng *")}
          {locationField("city", "Thành phố *")}
          {locationField("district", "Quận / huyện *")}
          {field("address", "Địa chỉ chi tiết *")}
          {field("tax_code", "Mã số thuế *")}
        </div>

        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Danh mục nhà hàng *</h2>
            <span className="text-xs text-gray-500">Chọn ít nhất một danh mục</span>
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
          {documentImagesUpload("business_license_urls", "Ảnh giấy phép kinh doanh *", true)}
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Sức chứa tối đa *
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

        <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
          Các trường có dấu <strong>*</strong> là thông tin bắt buộc để gửi xét duyệt. Website, thư viện ảnh, mô tả, giờ hoạt động, tiện ích, quy định và thiết lập đặt bàn sẽ được bổ sung sau khi hồ sơ được duyệt.
        </p>

        <button
          disabled={submit.isPending || uploadingField !== null}
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {submit.isPending ? "Đang gửi..." : app?.approval_status === "rejected" ? "Gửi lại hồ sơ xét duyệt" : "Gửi hồ sơ xét duyệt"}
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
