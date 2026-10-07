import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  "Món chính": "bg-red-100 text-red-700",
  "Tráng miệng": "bg-pink-100 text-pink-700",
  "Đồ uống": "bg-red-100 text-red-700",
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
  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showForm]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuItemForm>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

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
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Không thể xóa món ăn. Vui lòng thử lại.");
    },
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
  const items = menuQ.data ?? [];
  const categories = [...new Set(items.map(item => item.category).filter((value): value is string => !!value))].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "vi"));
  const filtered = (menuQ.data ?? []).filter(
    (m) =>
      (!category || m.category === category) && (
        m.name.toLowerCase().includes(q) ||
        getCategoryLabel(m.category ?? "").toLowerCase().includes(q) ||
        (m.category ?? "").toLowerCase().includes(q)
      ),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-normal text-gray-900">Quản lý thực đơn</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Thêm, sửa, xoá các món ăn trong thực đơn
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-normal transition shadow-sm"
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
      {showForm && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="menu-form-title" className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 id="menu-form-title" className="text-base font-normal text-gray-800">
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
                <label className="block text-xs font-normal text-gray-500 mb-1">
                  Tên món *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-red-500 focus:bg-white transition"
                  placeholder="Ví dụ: Phở bò tái"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-normal text-gray-500 mb-1">
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
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-red-500 focus:bg-white transition"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-normal text-gray-500 mb-1">
                    Danh mục
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    list="categories"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-red-500 focus:bg-white transition"
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
                <label className="block text-xs font-normal text-gray-500 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-red-500 focus:bg-white transition resize-none"
                  placeholder="Mô tả ngắn về món ăn..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-normal text-gray-500">
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
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Tải ảnh thất bại.");
                      }
                    }}
                  />
                  <label htmlFor="menu-item-image-file" className="cursor-pointer rounded-lg border-2 border-red-600 bg-red-600 px-3 py-2 text-xs font-normal text-white shadow-sm transition hover:bg-red-700 focus-within:ring-4 focus-within:ring-red-200">
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
                  className="w-4 h-4 rounded accent-red-600"
                />
                <span className="text-sm text-gray-700 font-normal">
                  Hiển thị (còn phục vụ)
                </span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-normal transition disabled:opacity-50"
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
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-normal transition"
                >
                  Huỷ
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Search + grid */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="Danh mục món ăn">
        <h2 className="mb-3 text-xs font-normal text-gray-800">Danh mục món ăn</h2>
        <div className="flex flex-wrap gap-2">
          {[{ value: "", label: "Tất cả", count: items.length }, ...categories.map(value => ({ value, label: getCategoryLabel(value), count: items.filter(item => item.category === value).length }))].map(option => <button key={option.value} type="button" aria-pressed={category === option.value} onClick={() => setCategory(option.value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${category === option.value ? "border-red-600 bg-red-600 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50"}`}>
            {option.label}<span className={`rounded-md px-1.5 py-0.5 text-xs ${category === option.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{option.count}</span>
          </button>)}
        </div>
      </section>
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm font-normal text-gray-600">
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
              className="pl-9 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:bg-white transition w-60"
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
            <p className="text-gray-500 font-normal">{items.length ? "Không có món phù hợp với tìm kiếm hoặc danh mục đã chọn." : "Chưa có món ăn nào"}</p>
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-red-600 hover:underline font-normal"
            >
              + Thêm món đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-6 p-5">
            {[...new Set(filtered.map(item => item.category ?? ""))].sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b), "vi")).map(group => <section key={group}>
              <h2 className="mb-3 border-b border-gray-100 pb-2 text-xs font-normal text-gray-800">{group ? getCategoryLabel(group) : "Chưa phân loại"} <span className="text-xs text-gray-400">({filtered.filter(item => (item.category ?? "") === group).length} món)</span></h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.filter(item => (item.category ?? "") === group).map((item) => (
              <div
                key={item.id}
                className={`flex flex-col rounded-xl border ${item.is_available ? "border-gray-100" : "border-gray-100 opacity-60"} bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-36 shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 shrink-0 bg-linear-to-br from-gray-100 to-gray-50 flex items-center justify-center text-gray-300">
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
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-normal text-gray-800 text-xs leading-5">
                      {item.name}
                    </h3>
                    {item.category && (
                      <span
                        className={`shrink-0 text-[10px] font-normal px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-500"}`}
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
                  <p className="mt-auto pt-2 text-[13px] font-normal text-amber-600 mb-3">
                    {item.price.toLocaleString("vi-VN")}đ
                  </p>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-normal ${item.is_available ? "text-emerald-600" : "text-gray-400"}`}
                    >
                      {item.is_available ? "● Đang phục vụ" : "○ Tạm ngừng"}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(item)}
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
            </section>)}
          </div>
        )}
      </div>
    </div>
  );
}
