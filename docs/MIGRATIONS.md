# Quy ước migration

- Revision hiện tại: `c1d2e3f4a5b6` (một head duy nhất).
- Không sửa hoặc xoá revision đã được áp dụng trên môi trường triển khai.
- Migration cần hỗ trợ hai chế độ: online kiểm tra schema để tương thích dữ liệu cũ; offline phát SQL cho schema mới mà không gọi `inspect()`.
- Schema nghiệp vụ để vẽ ERD lấy từ `backend-python/models` và được đối chiếu với Alembic head.
- Khi thêm bảng hoặc quan hệ mới, tạo migration mới từ head, khai báo foreign key, index và unique constraint trong cùng revision; sau đó cập nhật `docs/ERD.md`.