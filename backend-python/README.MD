chạy backend fastapi
bước 1 : cài môi trường ảo
 cd .\backend-python\
 python -m venv .venv
 .venv\Scripts\Activate.ps1
 python -m pip install --upgrade pip
 bước 2 : cài fastapi và các thư viện
 pip install "fastapi[standard]"
 pip install -r requirements.txt
 bước 3 : chạy app
python.exe -m uvicorn app.main:app
 bước 4: mở http://127.0.0.1:8000/docs để test api
 có thể dùng postman thay thế