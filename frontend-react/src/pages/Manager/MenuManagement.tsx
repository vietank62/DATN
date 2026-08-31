import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { toast } from "sonner";
import { useState } from "react";
import { uploadImage } from "../../services/upload";
import { getCategoryLabel } from "../../utils/category";

interface MenuItem {
  id: number;
  restaurant_id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  category?: string;
}

interface MenuItemForm {
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
  available: boolean;
}

const EMPTY_FORM: MenuItemForm = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
  available: true,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Khai vị": "bg-orange-100 text-orange-700",
  "Món chính": "bg-blue-100 text-blue-700",
  "Tráng miệng": "bg-pink-100 text-pink-700",
  "Đồ uống": "bg-teal-100 text-teal-700",
  "Đặc sản": "bg-amber-100 text-amber-700",
};

export default function MenuManagement() {
  const qc = useQueryClient();
  const profileQ = useQuery<{ id: number }>({
    queryKey: ["partner-application"],
    queryFn: () => api.get("/v1/partners/application/me").then((r) => r.data),
  });
  const restaurantId = profileQ.data?.id;

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemForm>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const menuQ = useQuery<MenuItem[]>({
    queryKey: ["manager-menu-items", restaurantId],
    queryFn: () =>
      api.get(`/v1/menuitems/restaurant/${restaurantId}`).then((r) => r.data),
    enabled: !!restaurantId,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["manager-menu-items", restaurantId] });

  const createMut = useMutation({
    mutationFn: (data: object) =>
      api.post(`/v1/menuitems/restaurant/${restaurantId}`, data),
    onSuccess: () => {
      toast.success("Đã thêm món ăn");
      invalidate();
      closeForm();
    },
    onError: () => toast.error("Thêm thất bại"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      api.put(`/v1/menuitems/restaurant/${restaurantId}/${id}`, data),
    onSuccess: () => {
      toast.success("Đã cập nhật món ăn");
      invalidate();
      closeForm();
    },
    onError: () => toast.error("Cập nhật thất bại"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/v1/menuitems/restaurant/${restaurantId}/${id}`),
    onSuccess: () => {
      toast.success("Đã xoá món ăn");
      invalidate();
      setDeletingId(null);
    },
    onError: () => toast.error("Xoá thất bại"),
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };
  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category ?? "",
      image_url: item.image_url ?? "",
      available: item.is_available,
    });
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      price: parseFloat(form.price) || 0,
      category: form.category || "Khác",
      image_url: form.image_url || undefined,
      is_available: form.available,
    };
    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const q = search.toLowerCase();
  const filtered = (menuQ.data ?? []).filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.category ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý thực đơn</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Thêm, sửa, xoá các món ăn trong thực đơn
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition shadow-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Thêm món
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">
                {editingItem ? "Sửa món ăn" : "Thêm món ăn mới"}
              </h3>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Tên món *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:bg-white transition"
                  placeholder="Ví dụ: Phở bò tái"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Giá (VNĐ) *
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:bg-white transition"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Danh mục
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    list="categories"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:bg-white transition"
                    placeholder="Khai vị, Món chính..."
                  />
                  <datalist id="categories">
                    {Object.keys(CATEGORY_COLORS).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-amber-400 focus:bg-white transition resize-none"
                  placeholder="Mô tả ngắn về món ăn..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-medium text-gray-500">
                    Ảnh món ăn
                  </label>
                  <input
                    id="menu-item-image-file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const imageUrl = await uploadImage(file);
                        setForm((current) => ({ ...current, image_url: imageUrl }));
                        toast.success("Đã tải ảnh món ăn lên Cloudinary.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Tải ảnh thất bại.");
                      }
                    }}
                  />
                  <label htmlFor="menu-item-image-file" className="cursor-pointer rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white">
                    Chọn tệp
                  </label>
                </div>
                {form.image_url && <img src={form.image_url} alt="Xem trước món ăn" className="mt-3 h-32 w-full rounded-xl object-cover" />}
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, available: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span className="text-sm text-gray-700 font-medium">
                  Hiển thị (còn phục vụ)
                </span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {createMut.isPending || updateMut.isPending
                    ? "Đang lưu..."
                    : editingItem
                      ? "Cập nhật"
                      : "Thêm món"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + grid */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm font-medium text-gray-600">
            {filtered.length} món ăn
          </p>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Tìm theo tên, danh mục..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:bg-white transition w-60"
            />
          </div>
        </div>

        {menuQ.isLoading ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Đang tải thực đơn...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-gray-500 font-medium">Chưa có món ăn nào</p>
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-amber-600 hover:underline font-medium"
            >
              + Thêm món đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border ${item.is_available ? "border-gray-100" : "border-gray-100 opacity-60"} bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 bg-linear-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-300">
                    <svg
                      className="w-10 h-10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                      {item.name}
                    </h3>
                    {item.category && (
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-500"}`}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <p className="text-base font-bold text-amber-600 mb-3">
                    {item.price.toLocaleString("vi-VN")}đ
                  </p>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${item.is_available ? "text-emerald-600" : "text-gray-400"}`}
                    >
                      {item.is_available ? "● Đang phục vụ" : "○ Tạm ngừng"}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {deletingId === item.id ? (
                        <>
                          <button
                            onClick={() => deleteMut.mutate(item.id)}
                            className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition text-xs px-2"
                          >
                            Xoá
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition text-xs px-2"
                          >
                            Huỷ
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
