# Chạy backend FastAPI

## AI bằng Gemini Free Tier

Tạo API key ở https://aistudio.google.com/api-keys từ dự án **Free Tier**, không liên kết billing.
Đặt cấu hình trong `backend-python/.env` (không đưa khóa lên frontend hoặc Git):

```dotenv
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_key_here
```

Khởi động lại backend sau khi sửa `.env`. Cấu hình áp dụng cho khảo sát khẩu vị và chatbot.
Không cần cài SDK mới; backend gọi REST API với JSON Schema và kiểm tra lại kết quả.
Gemini Free Tier có giới hạn lượt gọi; dữ liệu gửi lên có thể được Google sử dụng để cải thiện sản phẩm.
Không nhập thông tin cá nhân vào khảo sát. Không có tự động chuyển sang OpenAI khi Gemini lỗi.
Code không thể quyết định billing tier của Google; nếu dùng khóa từ dự án Paid Tier thì vẫn có thể phát sinh phí.

Chạy kiểm thử giả lập (không gọi AI thật):

```powershell
.\.venv-py313\Scripts\python.exe -m unittest tests.test_taste_survey tests.test_gemini_provider
```

Kiểm tra kết nối bằng một khảo sát giả (chỉ chạy khi đã cấu hình khóa):

```powershell
.\.venv-py313\Scripts\python.exe scripts/check_taste_ai.py
```

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
