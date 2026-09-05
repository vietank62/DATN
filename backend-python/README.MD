# Chạy backend FastAPI

## 1. Tạo và kích hoạt môi trường ảo

```powershell
cd .\backend-python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

## 2. Cài thư viện

```powershell
pip install "fastapi[standard]"
pip install -r requirements.txt
```

## 3. Chạy API cục bộ

Dùng lệnh này để kiểm tra hiệu năng và log request rõ ràng:

```powershell
.\.venv313\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --access-log --log-level info
```

Khi đang phát triển và cần tự khởi động lại sau mỗi lần sửa code, thêm `--reload`:

```powershell
.\.venv313\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --access-log --log-level info
```

## 4. Kiểm tra API

Mở [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) hoặc dùng Postman.

## Database

Schema được quản lý bằng Alembic. Trước khi chạy môi trường mới, chạy:

```powershell
.\.venv313\Scripts\python.exe -m alembic upgrade head
```

Chỉ đặt `AUTO_CREATE_TABLES=true` khi cần tạo bảng cho một database cục bộ hoàn toàn mới.

### Cổng thanh toán đặt cọc SePay

Đã chuyển sang Payment Gateway với đơn tồn tại 30 phút, mỗi phiên thanh toán tối đa 10 phút. Xem [hướng dẫn cấu hình ENV, IPN và kiểm thử](docs/SEPAY_GATEWAY.md).
