# 📋 Phân Tích Chi Tiết Các Tính Năng Cần Thêm

> Đây là một cuộc trò chuyện giữa bạn và tôi về những gì cần làm để hoàn thiện dự án TableNow.

## 🎯 Tính Năng 1: Làm Gọn Navbar (Ưu tiên CAO)
**Vấn đề:** Navbar hiện có "Trang Chủ" và "Nhà Hàng" - lỏng lẻo, có thể gộp chúng lại.

**Giải pháp:**
- Xoá link "Nhà Hàng" vì "/" và "/restaurants" đều trỏ đến HomePage
- Giữ "Trang Chủ" hoặc gộp thành một search bar chính
- Navbar sẽ gọn hơn, đỡ lộn xộn

---

## 🎯 Tính Năng 2: User Xem Trạng Thái Đơn Đặt (Ưu tiên CAO)
**Vấn đề:** Customer muốn biết đơn của mình đang ở trạng thái nào (chưa xác nhận, đã xác nhận, hoàn thành, huỷ).

**Giải pháp:**
- Page `/my-bookings` đã tồn tại ✅
- Chỉ cần đảm bảo nó hiển thị đúng trạng thái từ backend
- Có nút cancel cho pending/confirmed bookings ✅
- ✅ **ĐÃ XONG**

---

## 🎯 Tính Năng 3: Manager Thấy Note (Ưu tiên CAO)
**Vấn đề:** Manager quản lý nhà hàng nhưng không thấy khách note gì, nên không biết yêu cầu đặc biệt.

**Giải pháp:**
- Backend booking API đã có trường `note` ✅
- Frontend ManagerDashboard hiển thị bookings nhưng chưa show note
- Thêm cột "Ghi chú" vào bảng booking của Manager

---

## 🎯 Tính Năng 4: Modal Zoom Hình Ảnh (Ưu tiên TRUNG)
**Vấn đề:** Click vào ảnh nhà hàng hay menu nhưng không thể phóng to, chi tiết kém.

**Giải pháp:**
- Tạo component `ImageModal` hoặc `LightBox`
- Click ảnh trong RestaurantCard → mở modal toàn màn hình
- Hiển thị ảnh lớn + tên, mô tả chi tiết
- Nút đóng hoặc click bên ngoài để tắt

---

## 🎯 Tính Năng 5: Multiple Selection Cuisine (Ưu tiên TRUNG)
**Vấn đề:** Restaurant chỉ có 1 cuisine, nhưng thực tế nhà hàng có thể bán cả Việt + Hải sản.

**Giải pháp:**
- Thay `cuisine: string` thành `cuisines: string[]` trong Restaurant model
- Backend: cập nhật schema + migration DB
- Frontend: MultiSelect component cho Manager
- Filter cũng cần xử lý "ít nhất 1 trong các cuisines"

---

## 🎯 Tính Năng 6: Đăng Ký Manager + Tạo Nhà Hàng (Ưu tiên TRUNG)
**Vấn đề:** Manager mới đăng ký nhưng chưa có nhà hàng, cần flow: Register → Auto Assign Role Manager → Bắt buộc tạo nhà hàng đầu tiên.

**Giải pháp:**
- RegisterPage: người dùng chọn "Đăng ký là Manager"
- Backend tạo user với role = "manager"
- Frontend redirect → NewRestaurantPage (bắt buộc)
- Form: name, address, totalSeats, cuisines, openTime, closeTime
- Tạo nhà hàng → auto assign managerID = user.id
- Sau đó redirect đến ManagerDashboard

---

## 🎯 Tính Năng 7: Tải Hình Ảnh Lên Database (Ưu tiên TRUNG)
**Vấn đề:** Hiện dùng URL hardcoded, muốn upload ảnh từ máy.

**Giải pháp:**
- Backend: endpoint POST `/api/upload-image` để nhận file
- Lưu file vào folder `backend-python/uploads/`
- Trả về URL tương đối hoặc tuyệt đối để frontend dùng
- Frontend: thêm input file, preview, upload, lưu URL vào restaurant/menu

---

## 🎯 Tính Năng 8: Chức Năng Tìm Kiếm (Ưu tiên THẤP)
**Vấn đề:** Chỉ có filter theo category, nhưng không có search text.

**Giải pháp:**
- Backend: endpoint GET `/api/search-restaurants?q=phở` → tìm theo name, description
- Frontend: thêm search box ở navbar hoặc filter bar
- Real-time search hoặc search on submit

---

## 🎯 Tính Năng 9: Chuyển Cuisine Thành List (Ưu tiên THẤP)
**Vấn đề:** Hiện tại cuisine là string, khó filter chi tiết.

**Giải pháp:**
- Này giống với Tính Năng 5 (Multiple Selection)
- Khi đã là array, có thể filter dễ dàng hơn
- Backend query: `WHERE cuisines @> ['Việt Nam']::text[]` (PostgreSQL)

---

## 📊 Kế Hoạch Thực Hiện

| # | Tính Năng | Ưu Tiên | Trạng Thái |
|---|-----------|--------|-----------|
| 1 | Làm gọn Navbar | CAO | ✅ XONG |
| 2 | User xem trạng thái đơn | CAO | ✅ XONG |
| 3 | Manager thấy note | CAO | ✅ XONG |
| 4 | Modal zoom hình | TRUNG | ✅ XONG |
| 5 | Multiple selection cuisine | TRUNG | ⏳ TODO |
| 6 | Manager register + tạo NH | TRUNG | ⏳ TODO |
| 7 | Upload hình ảnh | TRUNG | ⏳ TODO |
| 8 | Search restaurants | THẤP | ⏳ TODO |
| 9 | Cuisine thành list | THẤP | ⏳ TODO (phụ thuộc #5) |

---

## 💡 Ghi Chú

- **Thứ tự ưu tiên:** Làm những cái dễ + cần thiết trước (Navbar, Manager note)
- **Dependencies:** Tính năng #9 phụ thuộc vào #5 (cùng chuyên đề multiple cuisines)
- **Testing:** Mỗi tính năng xong là test luôn, đừng chờ tất cả xong rồi test
- **Database migration:** Các thay đổi DB (cuisine array) cần viết migrate script

---

> **Tiếp theo:** Bạn muốn tôi bắt đầu với tính năng nào? Tôi gợi ý là làm Navbar trước (5 phút), rồi Manager note (10 phút), rồi dần dần tới phức tạp hơn.
